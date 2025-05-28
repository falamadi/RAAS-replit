import { Request, Response } from 'express';
import { InterviewService } from '../services/interview.service';
import { validationResult } from 'express-validator';

export class InterviewController {
  static async scheduleInterview(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        applicationId,
        scheduledAt,
        duration,
        type,
        location,
        meetingLink,
        notes,
      } = req.body;

      const interviewerId = req.user!.userId;

      const interview = await InterviewService.scheduleInterview(
        applicationId,
        interviewerId,
        new Date(scheduledAt),
        duration,
        type,
        location,
        meetingLink,
        notes
      );

      res.status(201).json({
        success: true,
        interview,
        message: 'Interview scheduled successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to schedule interview',
      });
    }
  }

  static async rescheduleInterview(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { interviewId } = req.params;
      const { scheduledAt, reason } = req.body;

      const interview = await InterviewService.rescheduleInterview(
        interviewId,
        new Date(scheduledAt),
        reason
      );

      res.json({
        success: true,
        interview,
        message: 'Interview rescheduled successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to reschedule interview',
      });
    }
  }

  static async cancelInterview(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { interviewId } = req.params;
      const { reason } = req.body;
      const cancelledBy = req.user!.userId;

      const interview = await InterviewService.cancelInterview(
        interviewId,
        reason,
        cancelledBy
      );

      res.json({
        success: true,
        interview,
        message: 'Interview cancelled successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to cancel interview',
      });
    }
  }

  static async submitFeedback(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { interviewId } = req.params;
      const feedback = req.body;
      const interviewerId = req.user!.userId;

      const interview = await InterviewService.submitFeedback(
        interviewId,
        interviewerId,
        feedback
      );

      res.json({
        success: true,
        interview,
        message: 'Feedback submitted successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to submit feedback',
      });
    }
  }

  static async getInterviews(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const userId = req.user!.userId;
      const userType = req.user!.userType;

      const filters: any = {};

      // Filter based on user type
      if (userType === 'job_seeker') {
        filters.candidateId = userId;
      } else if (userType === 'recruiter') {
        filters.interviewerId = userId;
      }

      // Additional filters from query params
      if (req.query.status) {
        filters.status = req.query.status;
      }
      if (req.query.jobId) {
        filters.jobId = req.query.jobId;
      }
      if (req.query.fromDate) {
        filters.fromDate = new Date(req.query.fromDate as string);
      }
      if (req.query.toDate) {
        filters.toDate = new Date(req.query.toDate as string);
      }

      const result = await InterviewService.getInterviews(filters, page, limit);

      res.json({
        success: true,
        interviews: result.interviews,
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
        message: error.message || 'Failed to fetch interviews',
      });
    }
  }

  static async getInterview(req: Request, res: Response) {
    try {
      const { interviewId } = req.params;
      const userId = req.user!.userId;

      // Fetch interview and verify access
      const result = await InterviewService.getInterviews(
        { interviewerId: userId },
        1,
        1
      );

      if (result.interviews.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Interview not found or unauthorized',
        });
      }

      res.json({
        success: true,
        interview: result.interviews[0],
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch interview',
      });
    }
  }

  static async setAvailability(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.userId;
      const { slots } = req.body;

      const savedSlots = await InterviewService.setAvailability(userId, slots);

      res.json({
        success: true,
        slots: savedSlots,
        message: 'Availability updated successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to set availability',
      });
    }
  }

  static async getAvailability(req: Request, res: Response) {
    try {
      const { interviewerId } = req.params;
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);

      const availability = await InterviewService.getAvailability(
        interviewerId,
        startDate,
        endDate
      );

      res.json({
        success: true,
        availability,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch availability',
      });
    }
  }

  static async getUpcomingInterviews(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const userType = req.user!.userType;

      const filters: any = {
        fromDate: new Date(),
        status: 'scheduled',
      };

      if (userType === 'job_seeker') {
        filters.candidateId = userId;
      } else if (userType === 'recruiter') {
        filters.interviewerId = userId;
      }

      const result = await InterviewService.getInterviews(filters, 1, 10);

      res.json({
        success: true,
        interviews: result.interviews,
        total: result.total,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch upcoming interviews',
      });
    }
  }
}
