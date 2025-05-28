import { Request, Response } from 'express';
import { ComplianceService } from '../services/compliance.service';
import { validationResult } from 'express-validator';

export class ComplianceController {
  // Data Export (GDPR/CCPA)
  static async requestDataExport(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { requestType } = req.body;

      const exportRequest = await ComplianceService.requestDataExport(
        userId,
        requestType
      );

      res.status(201).json({
        success: true,
        request: exportRequest,
        message:
          "Data export request submitted. You will receive an email when it's ready.",
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to request data export',
      });
    }
  }

  static async getDataExportStatus(req: Request, res: Response) {
    try {
      const { requestId } = req.params;
      const userId = req.user!.userId;

      // Verify the request belongs to the user
      const query =
        'SELECT * FROM data_export_requests WHERE id = $1 AND user_id = $2';
      const result = await pool.query(query, [requestId, userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Export request not found',
        });
      }

      res.json({
        success: true,
        request: result.rows[0],
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get export status',
      });
    }
  }

  // Data Deletion (GDPR/CCPA)
  static async requestDataDeletion(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.userId;
      const { requestType, reason } = req.body;

      const deletionRequest = await ComplianceService.requestDataDeletion(
        userId,
        requestType,
        reason
      );

      res.status(201).json({
        success: true,
        request: deletionRequest,
        message: 'Data deletion request submitted for review.',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to request data deletion',
      });
    }
  }

  // Consent Management
  static async updateConsent(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.userId;
      const { consentType, granted, version } = req.body;
      const ipAddress = req.ip || 'unknown';
      const userAgent = req.get('user-agent') || 'unknown';

      const consent = await ComplianceService.recordConsent(
        userId,
        consentType,
        version,
        granted,
        ipAddress,
        userAgent
      );

      res.json({
        success: true,
        consent,
        message: 'Consent preference updated',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update consent',
      });
    }
  }

  static async getConsentHistory(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const history = await ComplianceService.getConsentHistory(userId);

      res.json({
        success: true,
        history,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get consent history',
      });
    }
  }

  static async getCurrentConsents(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const consents = await ComplianceService.getCurrentConsents(userId);

      res.json({
        success: true,
        consents,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get current consents',
      });
    }
  }

  // EEO Compliance
  static async submitEEOData(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.userId;
      const { gender, ethnicity, veteranStatus, disabilityStatus } = req.body;

      await ComplianceService.submitEEOData(userId, {
        gender,
        ethnicity,
        veteranStatus,
        disabilityStatus,
      });

      res.json({
        success: true,
        message: 'EEO information submitted successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to submit EEO data',
      });
    }
  }

  static async generateEEOReport(req: Request, res: Response) {
    try {
      const { companyId } = req.params;
      const { startDate, endDate } = req.query;
      const userType = req.user!.userType;

      // Only company admins can generate EEO reports
      if (userType !== 'company_admin') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to generate EEO reports',
        });
      }

      // Verify user belongs to the company
      const verifyQuery = `
        SELECT * FROM company_admins 
        WHERE user_id = $1 AND company_id = $2
      `;
      const verifyResult = await pool.query(verifyQuery, [
        req.user!.userId,
        companyId,
      ]);

      if (verifyResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to generate reports for this company',
        });
      }

      const report = await ComplianceService.generateEEOReport(
        companyId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json({
        success: true,
        report,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate EEO report',
      });
    }
  }

  // Privacy Settings
  static async updatePrivacySettings(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.userId;
      const settings = req.body;

      await ComplianceService.updatePrivacySettings(userId, settings);

      res.json({
        success: true,
        message: 'Privacy settings updated successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update privacy settings',
      });
    }
  }

  static async getPrivacySettings(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const settings = await ComplianceService.getPrivacySettings(userId);

      res.json({
        success: true,
        settings,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get privacy settings',
      });
    }
  }

  // Admin endpoints
  static async processDeletionRequest(req: Request, res: Response) {
    try {
      const { requestId } = req.params;
      const { approved } = req.body;
      const processedBy = req.user!.userId;

      // Only admins can process deletion requests
      if (req.user!.userType !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to process deletion requests',
        });
      }

      await ComplianceService.processDataDeletion(
        requestId,
        approved,
        processedBy
      );

      res.json({
        success: true,
        message: approved
          ? 'Deletion request approved and processed'
          : 'Deletion request rejected',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to process deletion request',
      });
    }
  }

  static async getPendingDeletionRequests(req: Request, res: Response) {
    try {
      // Only admins can view pending deletion requests
      if (req.user!.userType !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to view deletion requests',
        });
      }

      const query = `
        SELECT dr.*, u.email, u.first_name, u.last_name
        FROM data_deletion_requests dr
        JOIN users u ON dr.user_id = u.id
        WHERE dr.status = 'pending'
        ORDER BY dr.requested_at ASC
      `;

      const result = await pool.query(query);

      res.json({
        success: true,
        requests: result.rows,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get pending deletion requests',
      });
    }
  }
}

// Import pool for direct queries (should be moved to service layer in production)
import { pool } from '../config/database';
