import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authMiddleware } from '../middleware/auth';
import { body, param } from 'express-validator';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get user's notifications
router.get('/', NotificationController.getNotifications);

// Get unread notification count
router.get('/unread-count', NotificationController.getUnreadCount);

// Get notification preferences
router.get('/preferences', NotificationController.getPreferences);

// Update notification preferences
router.put(
  '/preferences',
  body('email')
    .optional()
    .isObject()
    .withMessage('Email preferences must be an object'),
  body('push')
    .optional()
    .isObject()
    .withMessage('Push preferences must be an object'),
  body('inApp')
    .optional()
    .isObject()
    .withMessage('In-app preferences must be an object'),
  NotificationController.updatePreferences
);

// Mark notification as read
router.put(
  '/:notificationId/read',
  param('notificationId').isUUID().withMessage('Invalid notification ID'),
  NotificationController.markAsRead
);

// Mark all notifications as read
router.put('/mark-all-read', NotificationController.markAllAsRead);

// Delete a notification
router.delete(
  '/:notificationId',
  param('notificationId').isUUID().withMessage('Invalid notification ID'),
  NotificationController.deleteNotification
);

export default router;
