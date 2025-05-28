import { Router } from 'express';
import { MessageController } from '../controllers/message.controller';
import { authMiddleware } from '../middleware/auth';
import { body, param } from 'express-validator';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Create a new conversation
router.post(
  '/conversations',
  body('participants').isArray().withMessage('Participants must be an array'),
  body('participants.*').isUUID().withMessage('Invalid participant ID'),
  body('jobId').optional().isUUID().withMessage('Invalid job ID'),
  body('applicationId')
    .optional()
    .isUUID()
    .withMessage('Invalid application ID'),
  MessageController.createConversation
);

// Get user's conversations
router.get('/conversations', MessageController.getConversations);

// Get messages in a conversation
router.get(
  '/conversations/:conversationId/messages',
  param('conversationId').isUUID().withMessage('Invalid conversation ID'),
  MessageController.getMessages
);

// Send a message
router.post(
  '/conversations/:conversationId/messages',
  param('conversationId').isUUID().withMessage('Invalid conversation ID'),
  body('content').notEmpty().withMessage('Message content is required'),
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),
  MessageController.sendMessage
);

// Mark messages as read
router.put(
  '/conversations/:conversationId/read',
  param('conversationId').isUUID().withMessage('Invalid conversation ID'),
  MessageController.markAsRead
);

// Delete a message
router.delete(
  '/messages/:messageId',
  param('messageId').isUUID().withMessage('Invalid message ID'),
  MessageController.deleteMessage
);

// Get unread message count
router.get('/unread-count', MessageController.getUnreadCount);

export default router;
