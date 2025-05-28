import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { NotificationService } from './notification.service';
import { redisClient } from '../config/redis';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  attachments?: Array<{
    type: string;
    url: string;
    name: string;
  }>;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  participants: string[];
  jobId?: string;
  applicationId?: string;
  lastMessageAt: Date;
  lastMessage?: Message;
  unreadCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export class MessageService {
  static async createConversation(
    participants: string[],
    jobId?: string,
    applicationId?: string
  ): Promise<Conversation> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if conversation already exists
      const existingQuery = `
        SELECT c.*
        FROM conversations c
        WHERE c.participants @> $1::uuid[]
          AND c.participants <@ $1::uuid[]
          AND ($2::uuid IS NULL OR c.job_id = $2)
          AND ($3::uuid IS NULL OR c.application_id = $3)
      `;

      const existing = await client.query(existingQuery, [
        participants,
        jobId || null,
        applicationId || null,
      ]);

      if (existing.rows.length > 0) {
        await client.query('COMMIT');
        return existing.rows[0];
      }

      // Create new conversation
      const conversationId = uuidv4();
      const insertQuery = `
        INSERT INTO conversations (
          id, participants, job_id, application_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING *
      `;

      const result = await client.query(insertQuery, [
        conversationId,
        participants,
        jobId || null,
        applicationId || null,
      ]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    attachments?: Message['attachments']
  ): Promise<Message> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify sender is participant
      const verifyQuery = `
        SELECT * FROM conversations 
        WHERE id = $1 AND $2 = ANY(participants)
      `;
      const conversation = await client.query(verifyQuery, [
        conversationId,
        senderId,
      ]);

      if (conversation.rows.length === 0) {
        throw new Error('Unauthorized to send message in this conversation');
      }

      // Insert message
      const messageId = uuidv4();
      const insertQuery = `
        INSERT INTO messages (
          id, conversation_id, sender_id, content, attachments, 
          is_read, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
        RETURNING *
      `;

      const message = await client.query(insertQuery, [
        messageId,
        conversationId,
        senderId,
        content,
        JSON.stringify(attachments || []),
      ]);

      // Update conversation
      await client.query(
        `
        UPDATE conversations 
        SET last_message_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
        [conversationId]
      );

      // Send notifications to other participants
      const otherParticipants = conversation.rows[0].participants.filter(
        (p: string) => p !== senderId
      );

      for (const recipientId of otherParticipants) {
        await NotificationService.createNotification(
          recipientId,
          'new_message',
          'New Message',
          `You have a new message`,
          {
            conversationId,
            messageId,
            senderId,
          }
        );

        // Update unread count in Redis
        const unreadKey = `unread:${recipientId}:${conversationId}`;
        await redisClient.incr(unreadKey);
      }

      await client.query('COMMIT');
      return message.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getConversations(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ conversations: Conversation[]; total: number }> {
    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        c.*,
        m.content as last_message_content,
        m.sender_id as last_message_sender_id,
        m.created_at as last_message_created_at,
        COALESCE(
          (SELECT COUNT(*) 
           FROM messages msg 
           WHERE msg.conversation_id = c.id 
             AND msg.sender_id != $1 
             AND msg.is_read = false), 
          0
        )::int as unread_count
      FROM conversations c
      LEFT JOIN LATERAL (
        SELECT * FROM messages 
        WHERE conversation_id = c.id 
        ORDER BY created_at DESC 
        LIMIT 1
      ) m ON true
      WHERE $1 = ANY(c.participants)
      ORDER BY COALESCE(m.created_at, c.created_at) DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*) FROM conversations WHERE $1 = ANY(participants)
    `;

    const [conversations, count] = await Promise.all([
      pool.query(query, [userId, limit, offset]),
      pool.query(countQuery, [userId]),
    ]);

    return {
      conversations: conversations.rows,
      total: parseInt(count.rows[0].count),
    };
  }

  static async getMessages(
    conversationId: string,
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ messages: Message[]; total: number }> {
    // Verify user is participant
    const verifyQuery = `
      SELECT * FROM conversations 
      WHERE id = $1 AND $2 = ANY(participants)
    `;
    const conversation = await pool.query(verifyQuery, [
      conversationId,
      userId,
    ]);

    if (conversation.rows.length === 0) {
      throw new Error('Unauthorized to view this conversation');
    }

    const offset = (page - 1) * limit;

    const query = `
      SELECT * FROM messages 
      WHERE conversation_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*) FROM messages WHERE conversation_id = $1
    `;

    const [messages, count] = await Promise.all([
      pool.query(query, [conversationId, limit, offset]),
      pool.query(countQuery, [conversationId]),
    ]);

    return {
      messages: messages.rows.reverse(), // Return in chronological order
      total: parseInt(count.rows[0].count),
    };
  }

  static async markMessagesAsRead(
    conversationId: string,
    userId: string
  ): Promise<void> {
    const query = `
      UPDATE messages 
      SET is_read = true, read_at = NOW(), updated_at = NOW()
      WHERE conversation_id = $1 
        AND sender_id != $2 
        AND is_read = false
    `;

    await pool.query(query, [conversationId, userId]);

    // Clear unread count in Redis
    const unreadKey = `unread:${userId}:${conversationId}`;
    await redisClient.del(unreadKey);
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) 
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE $1 = ANY(c.participants)
        AND m.sender_id != $1
        AND m.is_read = false
    `;

    const result = await pool.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }

  static async deleteMessage(messageId: string, userId: string): Promise<void> {
    const query = `
      UPDATE messages 
      SET content = '[Message deleted]', 
          attachments = '[]'::jsonb,
          updated_at = NOW()
      WHERE id = $1 AND sender_id = $2
    `;

    const result = await pool.query(query, [messageId, userId]);

    if (result.rowCount === 0) {
      throw new Error('Message not found or unauthorized');
    }
  }
}
