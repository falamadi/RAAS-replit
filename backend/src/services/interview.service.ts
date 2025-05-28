import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { NotificationService } from './notification.service';
import { MessageService } from './message.service';
import { redisClient } from '../config/redis';
import {
  addDays,
  addHours,
  format,
  parseISO,
  isAfter,
  isBefore,
  areIntervalsOverlapping,
} from 'date-fns';

export interface Interview {
  id: string;
  applicationId: string;
  jobId: string;
  candidateId: string;
  interviewerId: string;
  scheduledAt: Date;
  duration: number; // in minutes
  type: 'phone' | 'video' | 'onsite';
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
  location?: string;
  meetingLink?: string;
  notes?: string;
  feedback?: InterviewFeedback;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterviewFeedback {
  rating: number; // 1-5
  technicalSkills?: number;
  communicationSkills?: number;
  cultureFit?: number;
  strengths?: string;
  weaknesses?: string;
  recommendation: 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no';
  notes?: string;
  submittedAt?: Date;
}

export interface InterviewSlot {
  id: string;
  userId: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  timezone: string;
  isRecurring: boolean;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  maxInterviewsPerSlot: number;
}

export interface InterviewAvailability {
  date: string;
  slots: Array<{
    startTime: string;
    endTime: string;
    available: boolean;
  }>;
}

export class InterviewService {
  static async scheduleInterview(
    applicationId: string,
    interviewerId: string,
    scheduledAt: Date,
    duration: number,
    type: Interview['type'],
    location?: string,
    meetingLink?: string,
    notes?: string
  ): Promise<Interview> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify application exists and get details
      const appQuery = `
        SELECT a.*, j.title as job_title, u.email as candidate_email,
               u.first_name || ' ' || u.last_name as candidate_name
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        JOIN users u ON a.user_id = u.id
        WHERE a.id = $1
      `;
      const appResult = await client.query(appQuery, [applicationId]);

      if (appResult.rows.length === 0) {
        throw new Error('Application not found');
      }

      const application = appResult.rows[0];

      // Check for scheduling conflicts
      const hasConflict = await this.checkScheduleConflict(
        interviewerId,
        scheduledAt,
        duration
      );

      if (hasConflict) {
        throw new Error(
          'Schedule conflict: Interviewer is not available at this time'
        );
      }

      // Create interview
      const interviewId = uuidv4();
      const insertQuery = `
        INSERT INTO interviews (
          id, application_id, job_id, candidate_id, interviewer_id,
          scheduled_at, duration, type, status, location, meeting_link,
          notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled', $9, $10, $11, NOW(), NOW())
        RETURNING *
      `;

      const interview = await client.query(insertQuery, [
        interviewId,
        applicationId,
        application.job_id,
        application.user_id,
        interviewerId,
        scheduledAt,
        duration,
        type,
        location,
        meetingLink,
        notes,
      ]);

      // Update application status
      await client.query(
        `
        UPDATE applications 
        SET status = 'interview_scheduled', updated_at = NOW()
        WHERE id = $1
      `,
        [applicationId]
      );

      // Create calendar events
      await this.createCalendarEvent(interview.rows[0], application);

      // Send notifications
      await NotificationService.createNotification(
        application.user_id,
        'interview_scheduled',
        'Interview Scheduled',
        `Your interview for ${application.job_title} has been scheduled`,
        {
          interviewId,
          scheduledAt,
          type,
          location: location || meetingLink,
        }
      );

      await NotificationService.createNotification(
        interviewerId,
        'interview_scheduled',
        'Interview Scheduled',
        `Interview with ${application.candidate_name} for ${application.job_title}`,
        {
          interviewId,
          scheduledAt,
          candidateName: application.candidate_name,
        }
      );

      await client.query('COMMIT');
      return interview.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async rescheduleInterview(
    interviewId: string,
    newScheduledAt: Date,
    reason?: string
  ): Promise<Interview> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current interview details
      const currentQuery = `
        SELECT i.*, a.user_id as candidate_id, j.title as job_title,
               u.first_name || ' ' || u.last_name as candidate_name
        FROM interviews i
        JOIN applications a ON i.application_id = a.id
        JOIN jobs j ON i.job_id = j.id
        JOIN users u ON a.user_id = u.id
        WHERE i.id = $1
      `;
      const currentResult = await client.query(currentQuery, [interviewId]);

      if (currentResult.rows.length === 0) {
        throw new Error('Interview not found');
      }

      const current = currentResult.rows[0];

      // Check for conflicts with new time
      const hasConflict = await this.checkScheduleConflict(
        current.interviewer_id,
        newScheduledAt,
        current.duration,
        interviewId
      );

      if (hasConflict) {
        throw new Error(
          'Schedule conflict: Interviewer is not available at this time'
        );
      }

      // Update interview
      const updateQuery = `
        UPDATE interviews 
        SET scheduled_at = $1, 
            status = 'rescheduled',
            notes = COALESCE(notes || E'\n' || $2, notes),
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;

      const rescheduledNote = reason
        ? `Rescheduled: ${reason}`
        : 'Interview rescheduled';

      const interview = await client.query(updateQuery, [
        newScheduledAt,
        rescheduledNote,
        interviewId,
      ]);

      // Send notifications
      await NotificationService.createNotification(
        current.candidate_id,
        'interview_scheduled',
        'Interview Rescheduled',
        `Your interview for ${current.job_title} has been rescheduled`,
        {
          interviewId,
          oldTime: current.scheduled_at,
          newTime: newScheduledAt,
          reason,
        }
      );

      await client.query('COMMIT');
      return interview.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async cancelInterview(
    interviewId: string,
    reason: string,
    cancelledBy: string
  ): Promise<Interview> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get interview details
      const query = `
        SELECT i.*, a.user_id as candidate_id, j.title as job_title
        FROM interviews i
        JOIN applications a ON i.application_id = a.id
        JOIN jobs j ON i.job_id = j.id
        WHERE i.id = $1
      `;
      const result = await client.query(query, [interviewId]);

      if (result.rows.length === 0) {
        throw new Error('Interview not found');
      }

      const interview = result.rows[0];

      // Update interview status
      const updateQuery = `
        UPDATE interviews 
        SET status = 'cancelled',
            notes = COALESCE(notes || E'\n' || $1, $1),
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const cancellationNote = `Cancelled by ${cancelledBy}: ${reason}`;
      const updated = await client.query(updateQuery, [
        cancellationNote,
        interviewId,
      ]);

      // Update application status back to shortlisted
      await client.query(
        `
        UPDATE applications 
        SET status = 'shortlisted', updated_at = NOW()
        WHERE id = $1
      `,
        [interview.application_id]
      );

      // Send notifications
      const recipientId =
        cancelledBy === interview.interviewer_id
          ? interview.candidate_id
          : interview.interviewer_id;

      await NotificationService.createNotification(
        recipientId,
        'interview_scheduled',
        'Interview Cancelled',
        `Interview for ${interview.job_title} has been cancelled`,
        {
          interviewId,
          reason,
          scheduledAt: interview.scheduled_at,
        }
      );

      await client.query('COMMIT');
      return updated.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async submitFeedback(
    interviewId: string,
    interviewerId: string,
    feedback: InterviewFeedback
  ): Promise<Interview> {
    const query = `
      UPDATE interviews 
      SET feedback = $1,
          status = 'completed',
          updated_at = NOW()
      WHERE id = $2 AND interviewer_id = $3
      RETURNING *
    `;

    feedback.submittedAt = new Date();
    const result = await pool.query(query, [
      JSON.stringify(feedback),
      interviewId,
      interviewerId,
    ]);

    if (result.rows.length === 0) {
      throw new Error('Interview not found or unauthorized');
    }

    // Update application based on feedback
    const interview = result.rows[0];
    if (
      feedback.recommendation === 'strong_yes' ||
      feedback.recommendation === 'yes'
    ) {
      // You might want to move to next stage or send for further review
      await pool.query(
        `
        UPDATE applications 
        SET notes = COALESCE(notes || E'\n' || $1, $1),
            updated_at = NOW()
        WHERE id = $2
      `,
        [
          `Interview feedback: ${feedback.recommendation}`,
          interview.application_id,
        ]
      );
    }

    return result.rows[0];
  }

  static async getInterviews(
    filters: {
      interviewerId?: string;
      candidateId?: string;
      jobId?: string;
      status?: string;
      fromDate?: Date;
      toDate?: Date;
    },
    page: number = 1,
    limit: number = 20
  ): Promise<{ interviews: Interview[]; total: number }> {
    let query = `
      SELECT i.*, 
             u1.first_name || ' ' || u1.last_name as candidate_name,
             u2.first_name || ' ' || u2.last_name as interviewer_name,
             j.title as job_title,
             c.name as company_name
      FROM interviews i
      JOIN applications a ON i.application_id = a.id
      JOIN users u1 ON a.user_id = u1.id
      JOIN users u2 ON i.interviewer_id = u2.id
      JOIN jobs j ON i.job_id = j.id
      JOIN companies c ON j.company_id = c.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 0;

    if (filters.interviewerId) {
      query += ` AND i.interviewer_id = $${++paramCount}`;
      params.push(filters.interviewerId);
    }

    if (filters.candidateId) {
      query += ` AND a.user_id = $${++paramCount}`;
      params.push(filters.candidateId);
    }

    if (filters.jobId) {
      query += ` AND i.job_id = $${++paramCount}`;
      params.push(filters.jobId);
    }

    if (filters.status) {
      query += ` AND i.status = $${++paramCount}`;
      params.push(filters.status);
    }

    if (filters.fromDate) {
      query += ` AND i.scheduled_at >= $${++paramCount}`;
      params.push(filters.fromDate);
    }

    if (filters.toDate) {
      query += ` AND i.scheduled_at <= $${++paramCount}`;
      params.push(filters.toDate);
    }

    // Get count
    const countQuery = query.replace(
      "SELECT i.*, u1.first_name || ' ' || u1.last_name as candidate_name, u2.first_name || ' ' || u2.last_name as interviewer_name, j.title as job_title, c.name as company_name",
      'SELECT COUNT(*)'
    );
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    const offset = (page - 1) * limit;
    query += ` ORDER BY i.scheduled_at ASC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    return {
      interviews: result.rows,
      total,
    };
  }

  static async setAvailability(
    userId: string,
    slots: Omit<InterviewSlot, 'id' | 'userId'>[]
  ): Promise<InterviewSlot[]> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing slots for the user
      await client.query('DELETE FROM interview_slots WHERE user_id = $1', [
        userId,
      ]);

      // Insert new slots
      const inserted: InterviewSlot[] = [];
      for (const slot of slots) {
        const id = uuidv4();
        const query = `
          INSERT INTO interview_slots (
            id, user_id, day_of_week, start_time, end_time,
            timezone, is_recurring, effective_from, effective_until,
            max_interviews_per_slot
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `;

        const result = await client.query(query, [
          id,
          userId,
          slot.dayOfWeek,
          slot.startTime,
          slot.endTime,
          slot.timezone,
          slot.isRecurring,
          slot.effectiveFrom,
          slot.effectiveUntil,
          slot.maxInterviewsPerSlot || 1,
        ]);

        inserted.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return inserted;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getAvailability(
    interviewerId: string,
    startDate: Date,
    endDate: Date
  ): Promise<InterviewAvailability[]> {
    // Get interviewer's availability slots
    const slotsQuery = `
      SELECT * FROM interview_slots 
      WHERE user_id = $1 
        AND effective_from <= $2
        AND (effective_until IS NULL OR effective_until >= $3)
    `;
    const slotsResult = await pool.query(slotsQuery, [
      interviewerId,
      endDate,
      startDate,
    ]);
    const slots = slotsResult.rows;

    // Get existing interviews
    const interviewsQuery = `
      SELECT scheduled_at, duration 
      FROM interviews 
      WHERE interviewer_id = $1 
        AND scheduled_at BETWEEN $2 AND $3
        AND status IN ('scheduled', 'confirmed', 'rescheduled')
    `;
    const interviewsResult = await pool.query(interviewsQuery, [
      interviewerId,
      startDate,
      endDate,
    ]);
    const existingInterviews = interviewsResult.rows;

    // Calculate availability for each day
    const availability: InterviewAvailability[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      const dateStr = format(currentDate, 'yyyy-MM-dd');

      // Find slots for this day
      const daySlots = slots.filter(
        slot =>
          slot.day_of_week === dayOfWeek &&
          (slot.is_recurring ||
            format(parseISO(slot.effective_from), 'yyyy-MM-dd') === dateStr)
      );

      const dayAvailability: InterviewAvailability = {
        date: dateStr,
        slots: [],
      };

      for (const slot of daySlots) {
        // Check each hour within the slot
        const slotStart = parseISO(`${dateStr}T${slot.start_time}`);
        const slotEnd = parseISO(`${dateStr}T${slot.end_time}`);
        let currentSlot = new Date(slotStart);

        while (currentSlot < slotEnd) {
          const slotEndTime = addHours(currentSlot, 1);

          // Check if this slot conflicts with existing interviews
          const hasConflict = existingInterviews.some(interview => {
            const interviewStart = new Date(interview.scheduled_at);
            const interviewEnd = addHours(
              interviewStart,
              interview.duration / 60
            );

            return areIntervalsOverlapping(
              { start: currentSlot, end: slotEndTime },
              { start: interviewStart, end: interviewEnd }
            );
          });

          dayAvailability.slots.push({
            startTime: format(currentSlot, 'HH:mm'),
            endTime: format(slotEndTime, 'HH:mm'),
            available: !hasConflict,
          });

          currentSlot = slotEndTime;
        }
      }

      if (dayAvailability.slots.length > 0) {
        availability.push(dayAvailability);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return availability;
  }

  static async sendReminders(): Promise<void> {
    // Send reminders for interviews happening in the next 24 hours
    const query = `
      SELECT i.*, a.user_id as candidate_id, j.title as job_title,
             u.email as candidate_email, u.first_name as candidate_name
      FROM interviews i
      JOIN applications a ON i.application_id = a.id
      JOIN jobs j ON i.job_id = j.id
      JOIN users u ON a.user_id = u.id
      WHERE i.status IN ('scheduled', 'confirmed')
        AND i.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
        AND NOT EXISTS (
          SELECT 1 FROM interview_reminders 
          WHERE interview_id = i.id 
          AND reminder_type = '24_hour'
        )
    `;

    const result = await pool.query(query);

    for (const interview of result.rows) {
      // Send reminder notifications
      await NotificationService.createNotification(
        interview.candidate_id,
        'interview_scheduled',
        'Interview Reminder',
        `Your interview for ${interview.job_title} is tomorrow at ${format(new Date(interview.scheduled_at), 'h:mm a')}`,
        {
          interviewId: interview.id,
          scheduledAt: interview.scheduled_at,
          type: interview.type,
          location: interview.location || interview.meeting_link,
        }
      );

      // Record that reminder was sent
      await pool.query(
        `
        INSERT INTO interview_reminders (interview_id, reminder_type, sent_at)
        VALUES ($1, '24_hour', NOW())
      `,
        [interview.id]
      );
    }
  }

  private static async checkScheduleConflict(
    interviewerId: string,
    scheduledAt: Date,
    duration: number,
    excludeInterviewId?: string
  ): Promise<boolean> {
    let query = `
      SELECT COUNT(*) FROM interviews
      WHERE interviewer_id = $1
        AND status IN ('scheduled', 'confirmed', 'rescheduled')
        AND (
          (scheduled_at <= $2 AND scheduled_at + INTERVAL '1 minute' * duration > $2)
          OR (scheduled_at < $3 AND scheduled_at + INTERVAL '1 minute' * duration >= $3)
          OR (scheduled_at >= $2 AND scheduled_at < $3)
        )
    `;

    const params: any[] = [
      interviewerId,
      scheduledAt,
      addHours(scheduledAt, duration / 60),
    ];

    if (excludeInterviewId) {
      query += ' AND id != $4';
      params.push(excludeInterviewId);
    }

    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count) > 0;
  }

  private static async createCalendarEvent(
    interview: Interview,
    application: any
  ): Promise<void> {
    // TODO: Integrate with calendar API (Google Calendar, Outlook, etc.)
    // For now, we'll just log the event creation
    console.log('Creating calendar event for interview:', {
      title: `Interview: ${application.candidate_name} - ${application.job_title}`,
      start: interview.scheduledAt,
      duration: interview.duration,
      location: interview.location || interview.meetingLink,
      attendees: [interview.interviewerId, interview.candidateId],
    });

    // In a real implementation, this would:
    // 1. Create calendar events in interviewer's calendar
    // 2. Send calendar invites to both parties
    // 3. Include meeting links, dial-in info, etc.
  }
}
