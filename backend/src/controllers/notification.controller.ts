import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
import { validationResult } from 'express-validator';

export class NotificationController {
  static async getNotifications(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const unreadOnly = req.query.unreadOnly === 'true';

      const result = await NotificationService.getNotifications(
        userId,
        page,
        limit,
        unreadOnly
      );

      res.json({
        success: true,
        notifications: result.notifications,
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
        message: error.message || 'Failed to fetch notifications',
      });
    }
  }

  static async markAsRead(req: Request, res: Response) {
    try {
      const { notificationId } = req.params;
      const userId = req.user!.userId;

      await NotificationService.markAsRead(notificationId, userId);

      res.json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to mark notification as read',
      });
    }
  }

  static async markAllAsRead(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;

      await NotificationService.markAllAsRead(userId);

      res.json({
        success: true,
        message: 'All notifications marked as read',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to mark all notifications as read',
      });
    }
  }

  static async deleteNotification(req: Request, res: Response) {
    try {
      const { notificationId } = req.params;
      const userId = req.user!.userId;

      await NotificationService.deleteNotification(notificationId, userId);

      res.json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete notification',
      });
    }
  }

  static async getUnreadCount(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const count = await NotificationService.getUnreadCount(userId);

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

  static async getPreferences(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const preferences = await NotificationService.getPreferences(userId);

      res.json({
        success: true,
        preferences,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch notification preferences',
      });
    }
  }

  static async updatePreferences(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.userId;
      const { email, push, inApp } = req.body;

      const preferences = await NotificationService.updatePreferences(userId, {
        userId,
        email,
        push,
        inApp,
      });

      res.json({
        success: true,
        preferences,
        message: 'Notification preferences updated successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update notification preferences',
      });
    }
  }
}
