import { Router } from 'express';
import { ComplianceController } from '../controllers/compliance.controller';
import { authMiddleware } from '../middleware/auth';
import { body, param, query } from 'express-validator';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Data Export (GDPR/CCPA)
router.post(
  '/data-export',
  body('requestType')
    .isIn(['gdpr_export', 'ccpa_export'])
    .withMessage('Invalid request type'),
  ComplianceController.requestDataExport
);

router.get(
  '/data-export/:requestId',
  param('requestId').isUUID().withMessage('Invalid request ID'),
  ComplianceController.getDataExportStatus
);

// Data Deletion (GDPR/CCPA)
router.post(
  '/data-deletion',
  body('requestType')
    .isIn(['gdpr_deletion', 'ccpa_deletion'])
    .withMessage('Invalid request type'),
  body('reason').optional().isString(),
  ComplianceController.requestDataDeletion
);

// Consent Management
router.post(
  '/consent',
  body('consentType')
    .isIn([
      'privacy_policy',
      'terms_of_service',
      'marketing',
      'data_processing',
      'cookies',
    ])
    .withMessage('Invalid consent type'),
  body('granted').isBoolean().withMessage('Granted must be a boolean'),
  body('version').notEmpty().withMessage('Version is required'),
  ComplianceController.updateConsent
);

router.get('/consent/history', ComplianceController.getConsentHistory);
router.get('/consent/current', ComplianceController.getCurrentConsents);

// EEO Compliance
router.post(
  '/eeo-data',
  body('gender')
    .optional()
    .isIn(['male', 'female', 'non_binary', 'prefer_not_to_say']),
  body('ethnicity').optional().isString(),
  body('veteranStatus').optional().isIn(['yes', 'no', 'prefer_not_to_say']),
  body('disabilityStatus').optional().isIn(['yes', 'no', 'prefer_not_to_say']),
  ComplianceController.submitEEOData
);

router.get(
  '/eeo-report/:companyId',
  param('companyId').isUUID().withMessage('Invalid company ID'),
  query('startDate').isISO8601().withMessage('Start date is required'),
  query('endDate').isISO8601().withMessage('End date is required'),
  ComplianceController.generateEEOReport
);

// Privacy Settings
router.put(
  '/privacy-settings',
  body('profileVisibility')
    .optional()
    .isIn(['public', 'recruiters_only', 'private']),
  body('showEmail').optional().isBoolean(),
  body('showPhone').optional().isBoolean(),
  body('allowMessages').optional().isBoolean(),
  body('allowNotifications').optional().isBoolean(),
  ComplianceController.updatePrivacySettings
);

router.get('/privacy-settings', ComplianceController.getPrivacySettings);

// Admin endpoints
router.put(
  '/admin/deletion-request/:requestId',
  param('requestId').isUUID().withMessage('Invalid request ID'),
  body('approved').isBoolean().withMessage('Approved must be a boolean'),
  ComplianceController.processDeletionRequest
);

router.get(
  '/admin/deletion-requests/pending',
  ComplianceController.getPendingDeletionRequests
);

export default router;
