import { Request, Response } from 'express';
import { MessageService } from '../services/message.service';
import { validationResult } from 'express-validator';

export class MessageController {
  static async createConversation(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { participants, jobId, applicationId } = req.body;
      const userId = req.user!.userId;

      // Ensure current user is included in participants
      if (!participants.includes(userId)) {
        participants.push(userId);
      }

      const conversation = await MessageService.createConversation(
        participants,
        jobId,
        applicationId
      );

      res.status(201).json({
        success: true,
        conversation,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create conversation',
      });
    }
  }

  static async getConversations(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await MessageService.getConversations(userId, page, limit);

      res.json({
        success: true,
        conversations: result.conversations,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch conversations',
      });
    }
  }

  static async getMessages(req: Request, res: Response) {
    try {
      const { conversationId } = req.params;
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await MessageService.getMessages(
        conversationId,
        userId,
        page,
        limit
      );

      // Mark messages as read
      await MessageService.markMessagesAsRead(conversationId, userId);

      res.json({
        success: true,
        messages: result.messages,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch messages',
      });
    }
  }

  static async sendMessage(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { conversationId } = req.params;
      const { content, attachments } = req.body;
      const senderId = req.user!.userId;

      const message = await MessageService.sendMessage(
        conversationId,
        senderId,
        content,
        attachments
      );

      res.status(201).json({
        success: true,
        message,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to send message',
      });
    }
  }

  static async markAsRead(req: Request, res: Response) {
    try {
      const { conversationId } = req.params;
      const userId = req.user!.userId;

      await MessageService.markMessagesAsRead(conversationId, userId);

      res.json({
        success: true,
        message: 'Messages marked as read',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to mark messages as read',
      });
    }
  }

  static async deleteMessage(req: Request, res: Response) {
    try {
      const { messageId } = req.params;
      const userId = req.user!.userId;

      await MessageService.deleteMessage(messageId, userId);

      res.json({
        success: true,
        message: 'Message deleted successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete message',
      });
    }
  }

  static async getUnreadCount(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const count = await MessageService.getUnreadCount(userId);

      res.json({
        success: true,
        count,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get unread count',
      });
    }
  }
}
