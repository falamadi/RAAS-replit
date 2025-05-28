import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { redisClient } from '../config/redis';
import { Server as SocketServer } from 'socket.io';

export interface Notification {
  id: string;
  userId: string;
  type:
    | 'new_message'
    | 'application_status'
    | 'job_match'
    | 'interview_scheduled'
    | 'system';
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferences {
  userId: string;
  email: {
    newMessage: boolean;
    applicationStatus: boolean;
    jobMatch: boolean;
    interviewScheduled: boolean;
    marketing: boolean;
  };
  push: {
    newMessage: boolean;
    applicationStatus: boolean;
    jobMatch: boolean;
    interviewScheduled: boolean;
  };
  inApp: {
    newMessage: boolean;
    applicationStatus: boolean;
    jobMatch: boolean;
    interviewScheduled: boolean;
    system: boolean;
  };
}

export class NotificationService {
  private static io: SocketServer | null = null;

  static setSocketServer(io: SocketServer) {
    this.io = io;
  }

  static async createNotification(
    userId: string,
    type: Notification['type'],
    title: string,
    message: string,
    data?: any
  ): Promise<Notification> {
    const notificationId = uuidv4();

    const query = `
      INSERT INTO notifications (
        id, user_id, type, title, message, data, 
        is_read, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, false, NOW(), NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      notificationId,
      userId,
      type,
      title,
      message,
      JSON.stringify(data || {}),
    ]);

    const notification = result.rows[0];

    // Send real-time notification if user is connected
    if (this.io) {
      this.io.to(`user:${userId}`).emit('notification', notification);
    }

    // Increment unread count in Redis
    const unreadKey = `notifications:unread:${userId}`;
    await redisClient.incr(unreadKey);

    // Check user preferences and send email/push if enabled
    await this.sendExternalNotifications(userId, type, notification);

    return notification;
  }

  static async getNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false
  ): Promise<{ notifications: Notification[]; total: number }> {
    const offset = (page - 1) * limit;

    let query = `
      SELECT * FROM notifications 
      WHERE user_id = $1
    `;

    if (unreadOnly) {
      query += ' AND is_read = false';
    }

    query += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';

    const countQuery = `
      SELECT COUNT(*) FROM notifications 
      WHERE user_id = $1 ${unreadOnly ? 'AND is_read = false' : ''}
    `;

    const [notifications, count] = await Promise.all([
      pool.query(query, [userId, limit, offset]),
      pool.query(countQuery, [userId]),
    ]);

    return {
      notifications: notifications.rows,
      total: parseInt(count.rows[0].count),
    };
  }

  static async markAsRead(
    notificationId: string,
    userId: string
  ): Promise<void> {
    const query = `
      UPDATE notifications 
      SET is_read = true, read_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND user_id = $2
    `;

    const result = await pool.query(query, [notificationId, userId]);

    if (result.rowCount === 0) {
      throw new Error('Notification not found or unauthorized');
    }

    // Decrement unread count in Redis
    const unreadKey = `notifications:unread:${userId}`;
    await redisClient.decr(unreadKey);
  }

  static async markAllAsRead(userId: string): Promise<void> {
    const query = `
      UPDATE notifications 
      SET is_read = true, read_at = NOW(), updated_at = NOW()
      WHERE user_id = $1 AND is_read = false
    `;

    await pool.query(query, [userId]);

    // Reset unread count in Redis
    const unreadKey = `notifications:unread:${userId}`;
    await redisClient.del(unreadKey);
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const unreadKey = `notifications:unread:${userId}`;
    const count = await redisClient.get(unreadKey);

    if (count !== null) {
      return parseInt(count);
    }

    // If not in cache, get from database
    const query = `
      SELECT COUNT(*) FROM notifications 
      WHERE user_id = $1 AND is_read = false
    `;

    const result = await pool.query(query, [userId]);
    const dbCount = parseInt(result.rows[0].count);

    // Cache the count
    await redisClient.set(unreadKey, dbCount);

    return dbCount;
  }

  static async deleteNotification(
    notificationId: string,
    userId: string
  ): Promise<void> {
    const query = `
      DELETE FROM notifications 
      WHERE id = $1 AND user_id = $2
    `;

    const result = await pool.query(query, [notificationId, userId]);

    if (result.rowCount === 0) {
      throw new Error('Notification not found or unauthorized');
    }
  }

  static async getPreferences(
    userId: string
  ): Promise<NotificationPreferences> {
    const query = `
      SELECT * FROM notification_preferences WHERE user_id = $1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      // Return default preferences
      return {
        userId,
        email: {
          newMessage: true,
          applicationStatus: true,
          jobMatch: true,
          interviewScheduled: true,
          marketing: false,
        },
        push: {
          newMessage: true,
          applicationStatus: true,
          jobMatch: true,
          interviewScheduled: true,
        },
        inApp: {
          newMessage: true,
          applicationStatus: true,
          jobMatch: true,
          interviewScheduled: true,
          system: true,
        },
      };
    }

    return result.rows[0];
  }

  static async updatePreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const query = `
      INSERT INTO notification_preferences (
        user_id, email_preferences, push_preferences, in_app_preferences
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        email_preferences = $2,
        push_preferences = $3,
        in_app_preferences = $4,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await pool.query(query, [
      userId,
      JSON.stringify(preferences.email || {}),
      JSON.stringify(preferences.push || {}),
      JSON.stringify(preferences.inApp || {}),
    ]);

    return result.rows[0];
  }

  private static async sendExternalNotifications(
    userId: string,
    type: Notification['type'],
    notification: Notification
  ): Promise<void> {
    const preferences = await this.getPreferences(userId);

    // Map notification type to preference key
    const preferenceKey =
      type === 'new_message'
        ? 'newMessage'
        : type === 'application_status'
          ? 'applicationStatus'
          : type === 'job_match'
            ? 'jobMatch'
            : type === 'interview_scheduled'
              ? 'interviewScheduled'
              : null;

    if (!preferenceKey) return;

    // Queue email notification if enabled
    if (preferences.email[preferenceKey as keyof typeof preferences.email]) {
      // TODO: Implement email queue
      console.log(`Queuing email notification for user ${userId}`);
    }

    // Send push notification if enabled
    if (preferences.push[preferenceKey as keyof typeof preferences.push]) {
      // TODO: Implement push notifications
      console.log(`Sending push notification for user ${userId}`);
    }
  }
}
