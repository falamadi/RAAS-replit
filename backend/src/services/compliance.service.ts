import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { createHash } from 'crypto';
import { format } from 'date-fns';

export interface DataExportRequest {
  id: string;
  userId: string;
  requestType: 'gdpr_export' | 'ccpa_export';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: Date;
  completedAt?: Date;
  downloadUrl?: string;
  expiresAt?: Date;
}

export interface DataDeletionRequest {
  id: string;
  userId: string;
  requestType: 'gdpr_deletion' | 'ccpa_deletion';
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
  reason?: string;
  requestedAt: Date;
  processedAt?: Date;
  processedBy?: string;
}

export interface ConsentRecord {
  id: string;
  userId: string;
  consentType:
    | 'privacy_policy'
    | 'terms_of_service'
    | 'marketing'
    | 'data_processing'
    | 'cookies';
  version: string;
  granted: boolean;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

export interface EEOData {
  userId: string;
  gender?: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
  ethnicity?: string;
  veteranStatus?: 'yes' | 'no' | 'prefer_not_to_say';
  disabilityStatus?: 'yes' | 'no' | 'prefer_not_to_say';
  submittedAt: Date;
}

export class ComplianceService {
  // GDPR - Right to Access (Data Export)
  static async requestDataExport(
    userId: string,
    requestType: 'gdpr_export' | 'ccpa_export'
  ): Promise<DataExportRequest> {
    const requestId = uuidv4();

    const query = `
      INSERT INTO data_export_requests (
        id, user_id, request_type, status, requested_at
      ) VALUES ($1, $2, $3, 'pending', NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [requestId, userId, requestType]);

    // Queue the export job
    await this.queueDataExport(requestId);

    return result.rows[0];
  }

  static async processDataExport(requestId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update status to processing
      await client.query(
        `
        UPDATE data_export_requests 
        SET status = 'processing' 
        WHERE id = $1
      `,
        [requestId]
      );

      // Get request details
      const requestResult = await client.query(
        'SELECT * FROM data_export_requests WHERE id = $1',
        [requestId]
      );
      const request = requestResult.rows[0];

      // Collect all user data
      const userData = await this.collectUserData(request.user_id);

      // Generate export file (JSON format)
      const exportData = {
        exportDate: new Date().toISOString(),
        requestType: request.request_type,
        userData,
      };

      // In production, this would save to S3 or similar
      const fileName = `data-export-${request.user_id}-${Date.now()}.json`;
      const downloadUrl = `/exports/${fileName}`; // Placeholder URL

      // Update request with download URL
      await client.query(
        `
        UPDATE data_export_requests 
        SET status = 'completed',
            completed_at = NOW(),
            download_url = $1,
            expires_at = NOW() + INTERVAL '7 days'
        WHERE id = $2
      `,
        [downloadUrl, requestId]
      );

      await client.query('COMMIT');

      // TODO: Send email notification with download link
      logger.info(`Data export completed for request ${requestId}`);
    } catch (error) {
      await client.query('ROLLBACK');

      // Update status to failed
      await pool.query(
        `
        UPDATE data_export_requests 
        SET status = 'failed' 
        WHERE id = $1
      `,
        [requestId]
      );

      throw error;
    } finally {
      client.release();
    }
  }

  // GDPR - Right to Erasure (Data Deletion)
  static async requestDataDeletion(
    userId: string,
    requestType: 'gdpr_deletion' | 'ccpa_deletion',
    reason?: string
  ): Promise<DataDeletionRequest> {
    const requestId = uuidv4();

    const query = `
      INSERT INTO data_deletion_requests (
        id, user_id, request_type, status, reason, requested_at
      ) VALUES ($1, $2, $3, 'pending', $4, NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      requestId,
      userId,
      requestType,
      reason,
    ]);

    // Notify compliance team for review
    logger.info(`Data deletion request created: ${requestId}`);

    return result.rows[0];
  }

  static async processDataDeletion(
    requestId: string,
    approved: boolean,
    processedBy: string
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get request details
      const requestResult = await client.query(
        'SELECT * FROM data_deletion_requests WHERE id = $1',
        [requestId]
      );
      const request = requestResult.rows[0];

      if (!request || request.status !== 'pending') {
        throw new Error('Invalid deletion request');
      }

      if (!approved) {
        await client.query(
          `
          UPDATE data_deletion_requests 
          SET status = 'rejected',
              processed_at = NOW(),
              processed_by = $1
          WHERE id = $2
        `,
          [processedBy, requestId]
        );

        await client.query('COMMIT');
        return;
      }

      // Update status to approved
      await client.query(
        `
        UPDATE data_deletion_requests 
        SET status = 'approved',
            processed_at = NOW(),
            processed_by = $1
        WHERE id = $2
      `,
        [processedBy, requestId]
      );

      // Anonymize user data instead of hard delete
      await this.anonymizeUserData(request.user_id);

      // Update status to completed
      await client.query(
        `
        UPDATE data_deletion_requests 
        SET status = 'completed'
        WHERE id = $1
      `,
        [requestId]
      );

      await client.query('COMMIT');

      logger.info(`Data deletion completed for user ${request.user_id}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Consent Management
  static async recordConsent(
    userId: string,
    consentType: ConsentRecord['consentType'],
    version: string,
    granted: boolean,
    ipAddress: string,
    userAgent: string
  ): Promise<ConsentRecord> {
    const consentId = uuidv4();

    const query = `
      INSERT INTO consent_records (
        id, user_id, consent_type, version, granted,
        ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      consentId,
      userId,
      consentType,
      version,
      granted,
      ipAddress,
      userAgent,
    ]);

    return result.rows[0];
  }

  static async getConsentHistory(userId: string): Promise<ConsentRecord[]> {
    const query = `
      SELECT * FROM consent_records 
      WHERE user_id = $1 
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  static async getCurrentConsents(
    userId: string
  ): Promise<Record<string, boolean>> {
    const query = `
      SELECT DISTINCT ON (consent_type) 
        consent_type, granted
      FROM consent_records 
      WHERE user_id = $1 
      ORDER BY consent_type, created_at DESC
    `;

    const result = await pool.query(query, [userId]);

    const consents: Record<string, boolean> = {};
    result.rows.forEach(row => {
      consents[row.consent_type] = row.granted;
    });

    return consents;
  }

  // EEO Compliance
  static async submitEEOData(
    userId: string,
    data: Omit<EEOData, 'userId' | 'submittedAt'>
  ): Promise<void> {
    // EEO data should be stored separately and not linked directly to applications
    const query = `
      INSERT INTO eeo_data (
        user_id, gender, ethnicity, veteran_status,
        disability_status, submitted_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        gender = $2,
        ethnicity = $3,
        veteran_status = $4,
        disability_status = $5,
        submitted_at = NOW()
    `;

    await pool.query(query, [
      userId,
      data.gender,
      data.ethnicity,
      data.veteranStatus,
      data.disabilityStatus,
    ]);
  }

  static async generateEEOReport(
    companyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    // Generate aggregated EEO report without individual identification
    const query = `
      SELECT 
        COUNT(*) as total_applicants,
        COUNT(e.user_id) as provided_eeo_data,
        COUNT(*) FILTER (WHERE e.gender = 'male') as male_count,
        COUNT(*) FILTER (WHERE e.gender = 'female') as female_count,
        COUNT(*) FILTER (WHERE e.gender = 'non_binary') as non_binary_count,
        COUNT(*) FILTER (WHERE e.veteran_status = 'yes') as veteran_count,
        COUNT(*) FILTER (WHERE e.disability_status = 'yes') as disability_count,
        json_agg(DISTINCT e.ethnicity) FILTER (WHERE e.ethnicity IS NOT NULL) as ethnicities
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      LEFT JOIN eeo_data e ON a.user_id = e.user_id
      WHERE j.company_id = $1
        AND a.created_at BETWEEN $2 AND $3
    `;

    const result = await pool.query(query, [companyId, startDate, endDate]);

    return {
      period: {
        start: format(startDate, 'yyyy-MM-dd'),
        end: format(endDate, 'yyyy-MM-dd'),
      },
      statistics: result.rows[0],
      generated_at: new Date().toISOString(),
      disclaimer:
        'This report contains aggregated data for EEO compliance purposes only.',
    };
  }

  // Privacy Settings
  static async updatePrivacySettings(
    userId: string,
    settings: {
      profileVisibility?: 'public' | 'recruiters_only' | 'private';
      showEmail?: boolean;
      showPhone?: boolean;
      allowMessages?: boolean;
      allowNotifications?: boolean;
    }
  ): Promise<void> {
    const query = `
      INSERT INTO privacy_settings (
        user_id, profile_visibility, show_email, show_phone,
        allow_messages, allow_notifications, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        profile_visibility = COALESCE($2, privacy_settings.profile_visibility),
        show_email = COALESCE($3, privacy_settings.show_email),
        show_phone = COALESCE($4, privacy_settings.show_phone),
        allow_messages = COALESCE($5, privacy_settings.allow_messages),
        allow_notifications = COALESCE($6, privacy_settings.allow_notifications),
        updated_at = NOW()
    `;

    await pool.query(query, [
      userId,
      settings.profileVisibility,
      settings.showEmail,
      settings.showPhone,
      settings.allowMessages,
      settings.allowNotifications,
    ]);
  }

  static async getPrivacySettings(userId: string): Promise<any> {
    const query = `
      SELECT * FROM privacy_settings WHERE user_id = $1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      // Return default settings
      return {
        profileVisibility: 'recruiters_only',
        showEmail: false,
        showPhone: false,
        allowMessages: true,
        allowNotifications: true,
      };
    }

    return result.rows[0];
  }

  // Data Retention
  static async applyDataRetentionPolicies(): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete old application data (> 2 years)
      await client.query(`
        UPDATE applications 
        SET cover_letter = '[DELETED]',
            notes = '[DELETED]'
        WHERE created_at < NOW() - INTERVAL '2 years'
          AND status IN ('rejected', 'withdrawn')
      `);

      // Delete old messages (> 1 year)
      await client.query(`
        UPDATE messages 
        SET content = '[DELETED]',
            attachments = '[]'::jsonb
        WHERE created_at < NOW() - INTERVAL '1 year'
      `);

      // Delete old search logs (> 90 days)
      await client.query(`
        DELETE FROM search_logs 
        WHERE searched_at < NOW() - INTERVAL '90 days'
      `);

      // Delete old analytics events (> 180 days)
      await client.query(`
        DELETE FROM analytics_events 
        WHERE created_at < NOW() - INTERVAL '180 days'
      `);

      await client.query('COMMIT');

      logger.info('Data retention policies applied successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Helper Methods
  private static async collectUserData(userId: string): Promise<any> {
    const userData: any = {};

    // User profile
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [
      userId,
    ]);
    userData.profile = userResult.rows[0];

    // Applications
    const applicationsResult = await pool.query(
      'SELECT * FROM applications WHERE user_id = $1',
      [userId]
    );
    userData.applications = applicationsResult.rows;

    // Messages
    const messagesResult = await pool.query(
      `
      SELECT m.* FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE $1 = ANY(c.participants)
    `,
      [userId]
    );
    userData.messages = messagesResult.rows;

    // Skills, experiences, education
    const skillsResult = await pool.query(
      'SELECT s.* FROM skills s JOIN user_skills us ON s.id = us.skill_id WHERE us.user_id = $1',
      [userId]
    );
    userData.skills = skillsResult.rows;

    // Add more data collections as needed

    return userData;
  }

  private static async anonymizeUserData(userId: string): Promise<void> {
    const anonymousEmail = `deleted_${createHash('sha256').update(userId).digest('hex').substring(0, 8)}@deleted.com`;

    await pool.query(
      `
      UPDATE users 
      SET email = $1,
          password_hash = '',
          first_name = 'Deleted',
          last_name = 'User',
          phone = NULL,
          is_active = false,
          updated_at = NOW()
      WHERE id = $2
    `,
      [anonymousEmail, userId]
    );

    // Anonymize related data
    await pool.query(
      `
      UPDATE job_seeker_profiles 
      SET summary = '[DELETED]',
          location = '[DELETED]',
          resume_url = NULL
      WHERE user_id = $1
    `,
      [userId]
    );

    // Remove skills, experiences, etc.
    await pool.query('DELETE FROM user_skills WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM user_experiences WHERE user_id = $1', [
      userId,
    ]);
    await pool.query('DELETE FROM user_education WHERE user_id = $1', [userId]);
  }

  private static async queueDataExport(requestId: string): Promise<void> {
    // In production, this would queue a job to a job queue (Bull, RabbitMQ, etc.)
    // For now, we'll process it immediately in a separate process
    setTimeout(async () => {
      try {
        await this.processDataExport(requestId);
      } catch (error) {
        logger.error(`Failed to process data export ${requestId}:`, error);
      }
    }, 1000);
  }
}
