import { getPool } from '../config/database';
import { logger } from '../utils/logger';

interface MatchingFactors {
  skillsMatch: number;
  experienceMatch: number;
  locationMatch: number;
  salaryMatch: number;
  availabilityMatch: number;
  educationMatch: number;
  employmentTypeMatch: number;
}

interface SkillMatch {
  required: { matched: number; total: number };
  preferred: { matched: number; total: number };
  candidateExtra: number;
}

export class MatchingService {
  // Weight configuration for different factors
  private static readonly WEIGHTS = {
    skills: 0.35, // 35% - Most important
    experience: 0.2, // 20%
    location: 0.15, // 15%
    salary: 0.15, // 15%
    availability: 0.1, // 10%
    education: 0.05, // 5%
  };

  // Calculate match score for a specific application
  static async calculateApplicationMatch(
    applicationId: string
  ): Promise<number> {
    const pool = getPool();

    try {
      // Get application details with job and candidate info
      const result = await pool.query(
        `SELECT 
          a.id as application_id,
          a.job_id,
          a.job_seeker_id,
          
          -- Job details
          jp.title as job_title,
          jp.experience_level,
          jp.salary_min,
          jp.salary_max,
          jp.location_city as job_city,
          jp.location_state as job_state,
          jp.is_remote,
          jp.employment_type,
          jp.education_requirements,
          
          -- Candidate details
          jsp.years_of_experience,
          jsp.desired_salary_min,
          jsp.desired_salary_max,
          jsp.location_city as candidate_city,
          jsp.location_state as candidate_state,
          jsp.willing_to_relocate,
          jsp.availability,
          jsp.remote_preference,
          
          -- Get job seeker profile id for skills query
          jsp.id as job_seeker_profile_id
          
        FROM applications a
        JOIN job_postings jp ON a.job_id = jp.id
        JOIN job_seeker_profiles jsp ON a.job_seeker_id = jsp.user_id
        WHERE a.id = $1`,
        [applicationId]
      );

      if (result.rows.length === 0) {
        throw new Error('Application not found');
      }

      const data = result.rows[0];

      // Calculate individual matching factors
      const factors: MatchingFactors = {
        skillsMatch: await this.calculateSkillsMatch(
          data.job_id,
          data.job_seeker_profile_id
        ),
        experienceMatch: this.calculateExperienceMatch(
          data.experience_level,
          data.years_of_experience
        ),
        locationMatch: this.calculateLocationMatch(data),
        salaryMatch: this.calculateSalaryMatch(data),
        availabilityMatch: this.calculateAvailabilityMatch(data.availability),
        educationMatch: this.calculateEducationMatch(
          data.education_requirements,
          data.job_seeker_profile_id
        ),
        employmentTypeMatch: 1.0, // TODO: Implement employment type preference matching
      };

      // Calculate weighted total score
      const totalScore =
        factors.skillsMatch * this.WEIGHTS.skills +
        factors.experienceMatch * this.WEIGHTS.experience +
        factors.locationMatch * this.WEIGHTS.location +
        factors.salaryMatch * this.WEIGHTS.salary +
        factors.availabilityMatch * this.WEIGHTS.availability +
        factors.educationMatch * this.WEIGHTS.education;

      // Convert to percentage and round
      const matchScore = Math.round(totalScore * 100);

      // Update application with match score
      await pool.query(
        'UPDATE applications SET match_score = $1 WHERE id = $2',
        [matchScore, applicationId]
      );

      logger.info(
        `Match score calculated for application ${applicationId}: ${matchScore}%`
      );

      return matchScore;
    } catch (error) {
      logger.error('Error calculating match score:', error);
      throw error;
    }
  }

  // Calculate match scores for all candidates for a specific job
  static async calculateJobMatches(
    jobId: string
  ): Promise<Array<{ candidateId: string; score: number }>> {
    const pool = getPool();

    try {
      // Get all active job seekers
      const candidates = await pool.query(
        `SELECT 
          u.id as user_id,
          jsp.id as profile_id,
          jsp.years_of_experience,
          jsp.desired_salary_min,
          jsp.desired_salary_max,
          jsp.location_city,
          jsp.location_state,
          jsp.willing_to_relocate,
          jsp.availability,
          jsp.remote_preference
        FROM users u
        JOIN job_seeker_profiles jsp ON u.id = jsp.user_id
        WHERE u.status = 'active' 
          AND u.email_verified = true
          AND jsp.availability != 'not_looking'`
      );

      // Get job details
      const jobResult = await pool.query(
        `SELECT * FROM job_postings WHERE id = $1 AND status = 'active'`,
        [jobId]
      );

      if (jobResult.rows.length === 0) {
        throw new Error('Job not found or not active');
      }

      const job = jobResult.rows[0];
      const matches = [];

      // Calculate match score for each candidate
      for (const candidate of candidates.rows) {
        const factors: MatchingFactors = {
          skillsMatch: await this.calculateSkillsMatch(
            jobId,
            candidate.profile_id
          ),
          experienceMatch: this.calculateExperienceMatch(
            job.experience_level,
            candidate.years_of_experience
          ),
          locationMatch: this.calculateLocationMatch({
            job_city: job.location_city,
            job_state: job.location_state,
            is_remote: job.is_remote,
            candidate_city: candidate.location_city,
            candidate_state: candidate.location_state,
            willing_to_relocate: candidate.willing_to_relocate,
            remote_preference: candidate.remote_preference,
          }),
          salaryMatch: this.calculateSalaryMatch({
            salary_min: job.salary_min,
            salary_max: job.salary_max,
            desired_salary_min: candidate.desired_salary_min,
            desired_salary_max: candidate.desired_salary_max,
          }),
          availabilityMatch: this.calculateAvailabilityMatch(
            candidate.availability
          ),
          educationMatch: this.calculateEducationMatch(
            job.education_requirements,
            candidate.profile_id
          ),
          employmentTypeMatch: 1.0,
        };

        const totalScore =
          factors.skillsMatch * this.WEIGHTS.skills +
          factors.experienceMatch * this.WEIGHTS.experience +
          factors.locationMatch * this.WEIGHTS.location +
          factors.salaryMatch * this.WEIGHTS.salary +
          factors.availabilityMatch * this.WEIGHTS.availability +
          factors.educationMatch * this.WEIGHTS.education;

        const matchScore = Math.round(totalScore * 100);

        if (matchScore >= 50) {
          // Only include candidates with 50%+ match
          matches.push({
            candidateId: candidate.user_id,
            score: matchScore,
          });
        }
      }

      // Sort by score descending
      matches.sort((a, b) => b.score - a.score);

      return matches;
    } catch (error) {
      logger.error('Error calculating job matches:', error);
      throw error;
    }
  }

  // Calculate skills match between job requirements and candidate skills
  private static async calculateSkillsMatch(
    jobId: string,
    jobSeekerProfileId: string
  ): Promise<number> {
    const pool = getPool();

    // Get job required skills
    const jobSkillsResult = await pool.query(
      `SELECT skill_id, is_required, min_years_required 
       FROM job_skills 
       WHERE job_id = $1`,
      [jobId]
    );

    // Get candidate skills
    const candidateSkillsResult = await pool.query(
      `SELECT skill_id, years_of_experience 
       FROM job_seeker_skills 
       WHERE job_seeker_id = $1`,
      [jobSeekerProfileId]
    );

    const jobSkills = jobSkillsResult.rows;
    const candidateSkills = new Map(
      candidateSkillsResult.rows.map(s => [s.skill_id, s.years_of_experience])
    );

    if (jobSkills.length === 0) {
      return 1.0; // No skills required, perfect match
    }

    let requiredMatched = 0;
    let requiredTotal = 0;
    let preferredMatched = 0;
    let preferredTotal = 0;

    for (const jobSkill of jobSkills) {
      const candidateYears = candidateSkills.get(jobSkill.skill_id) || 0;
      const meetsRequirement =
        candidateYears >= (jobSkill.min_years_required || 0);

      if (jobSkill.is_required) {
        requiredTotal++;
        if (meetsRequirement) requiredMatched++;
      } else {
        preferredTotal++;
        if (meetsRequirement) preferredMatched++;
      }
    }

    // Calculate score with heavy weight on required skills
    let score = 0;

    if (requiredTotal > 0) {
      score += (requiredMatched / requiredTotal) * 0.8; // 80% weight for required skills
    } else {
      score += 0.8; // No required skills, give full points
    }

    if (preferredTotal > 0) {
      score += (preferredMatched / preferredTotal) * 0.2; // 20% weight for preferred skills
    } else {
      score += 0.2; // No preferred skills, give full points
    }

    return score;
  }

  // Calculate experience match based on job requirements
  private static calculateExperienceMatch(
    jobExperienceLevel: string,
    candidateYears: number
  ): number {
    const experienceRanges: Record<
      string,
      { min: number; max: number; ideal: number }
    > = {
      entry: { min: 0, max: 3, ideal: 1 },
      mid: { min: 2, max: 7, ideal: 4 },
      senior: { min: 5, max: 15, ideal: 8 },
      executive: { min: 10, max: 30, ideal: 15 },
    };

    const range =
      experienceRanges[jobExperienceLevel] || experienceRanges['mid'];

    if (candidateYears < range.min) {
      // Under-qualified: sharp penalty
      const gap = range.min - candidateYears;
      return Math.max(0, 1 - gap * 0.2); // -20% per year under
    } else if (candidateYears > range.max) {
      // Over-qualified: mild penalty
      const gap = candidateYears - range.max;
      return Math.max(0.7, 1 - gap * 0.05); // -5% per year over, min 70%
    } else {
      // Within range: calculate proximity to ideal
      const deviation = Math.abs(candidateYears - range.ideal);
      const maxDeviation = Math.max(
        range.ideal - range.min,
        range.max - range.ideal
      );
      return 1 - (deviation / maxDeviation) * 0.3; // Max 30% penalty for deviation
    }
  }

  // Calculate location match considering remote work and relocation
  private static calculateLocationMatch(data: any): number {
    // Remote job or remote-preferring candidate: high match
    if (data.is_remote || data.remote_preference === 'remote_only') {
      return 1.0;
    }

    // Same city: perfect match
    if (
      data.job_city === data.candidate_city &&
      data.job_state === data.candidate_state
    ) {
      return 1.0;
    }

    // Same state: good match
    if (data.job_state === data.candidate_state) {
      return 0.8;
    }

    // Willing to relocate: moderate match
    if (data.willing_to_relocate) {
      return 0.6;
    }

    // Different location, not willing to relocate: poor match
    return 0.2;
  }

  // Calculate salary expectation match
  private static calculateSalaryMatch(data: any): number {
    // If no salary data, assume match
    if (!data.salary_min || !data.desired_salary_min) {
      return 0.8; // Slight penalty for unknown
    }

    const jobMin = data.salary_min || 0;
    const jobMax = data.salary_max || jobMin * 1.3; // Assume 30% range if not specified
    const candidateMin = data.desired_salary_min || 0;
    const candidateMax = data.desired_salary_max || candidateMin * 1.2;

    // Check if ranges overlap
    const overlapStart = Math.max(jobMin, candidateMin);
    const overlapEnd = Math.min(jobMax, candidateMax);

    if (overlapStart <= overlapEnd) {
      // Ranges overlap: calculate overlap percentage
      const jobRange = jobMax - jobMin;
      const candidateRange = candidateMax - candidateMin;
      const overlapRange = overlapEnd - overlapStart;

      const overlapPercentage =
        overlapRange / Math.min(jobRange, candidateRange);
      return Math.min(1.0, 0.5 + overlapPercentage * 0.5); // 50-100% score
    }

    // No overlap: calculate gap
    if (candidateMin > jobMax) {
      // Candidate expects more than job offers
      const gap = candidateMin - jobMax;
      const gapPercentage = gap / jobMax;
      return Math.max(0, 0.5 - gapPercentage); // Penalty based on gap
    } else {
      // Candidate expects less than job offers (usually good)
      return 0.9;
    }
  }

  // Calculate availability match
  private static calculateAvailabilityMatch(availability: string): number {
    const scores: Record<string, number> = {
      immediately: 1.0,
      within_month: 0.8,
      within_3_months: 0.5,
      not_looking: 0,
    };

    return scores[availability] || 0.3;
  }

  // Calculate education match (simplified for now)
  private static calculateEducationMatch(
    educationRequirements: any,
    jobSeekerProfileId: string
  ): number {
    // TODO: Implement education matching based on requirements
    // For now, return a default score
    return 0.8;
  }

  // Get recommended jobs for a candidate
  static async getRecommendedJobs(
    userId: string,
    limit: number = 20
  ): Promise<any[]> {
    const pool = getPool();

    try {
      // Get candidate profile
      const profileResult = await pool.query(
        'SELECT id FROM job_seeker_profiles WHERE user_id = $1',
        [userId]
      );

      if (profileResult.rows.length === 0) {
        return [];
      }

      const profileId = profileResult.rows[0].id;

      // Get all active jobs
      const jobsResult = await pool.query(
        `SELECT 
          jp.*,
          c.name as company_name,
          c.logo_url as company_logo,
          c.is_verified as company_verified
        FROM job_postings jp
        JOIN companies c ON jp.company_id = c.id
        WHERE jp.status = 'active'
          AND jp.application_deadline > NOW()
        ORDER BY jp.posted_date DESC
        LIMIT 100`
      );

      const recommendations = [];

      // Calculate match score for each job
      for (const job of jobsResult.rows) {
        // Check if already applied
        const appliedCheck = await pool.query(
          'SELECT id FROM applications WHERE job_id = $1 AND job_seeker_id = $2',
          [job.id, userId]
        );

        if (appliedCheck.rows.length > 0) {
          continue; // Skip jobs already applied to
        }

        // Create temporary match calculation
        const factors: MatchingFactors = {
          skillsMatch: await this.calculateSkillsMatch(job.id, profileId),
          experienceMatch: 0.8, // Simplified for recommendations
          locationMatch: 0.8,
          salaryMatch: 0.8,
          availabilityMatch: 1.0,
          educationMatch: 0.8,
          employmentTypeMatch: 1.0,
        };

        const totalScore =
          factors.skillsMatch * this.WEIGHTS.skills +
          factors.experienceMatch * this.WEIGHTS.experience +
          factors.locationMatch * this.WEIGHTS.location +
          factors.salaryMatch * this.WEIGHTS.salary +
          factors.availabilityMatch * this.WEIGHTS.availability +
          factors.educationMatch * this.WEIGHTS.education;

        const matchScore = Math.round(totalScore * 100);

        if (matchScore >= 60) {
          // Only recommend 60%+ matches
          recommendations.push({
            job: {
              id: job.id,
              title: job.title,
              companyName: job.company_name,
              companyLogo: job.company_logo,
              companyVerified: job.company_verified,
              location: `${job.location_city}, ${job.location_state}`,
              isRemote: job.is_remote,
              salaryMin: job.salary_min,
              salaryMax: job.salary_max,
              employmentType: job.employment_type,
              experienceLevel: job.experience_level,
              postedDate: job.posted_date,
            },
            matchScore,
            matchFactors: factors,
          });
        }
      }

      // Sort by match score and return top recommendations
      recommendations.sort((a, b) => b.matchScore - a.matchScore);
      return recommendations.slice(0, limit);
    } catch (error) {
      logger.error('Error getting job recommendations:', error);
      throw error;
    }
  }

  // Get similar candidates for a job (for recruiters)
  static async getSimilarCandidates(
    jobId: string,
    limit: number = 20
  ): Promise<any[]> {
    const matches = await this.calculateJobMatches(jobId);
    const pool = getPool();

    const topMatches = matches.slice(0, limit);
    const candidates = [];

    for (const match of topMatches) {
      const result = await pool.query(
        `SELECT 
          u.id,
          u.email,
          jsp.first_name,
          jsp.last_name,
          jsp.headline,
          jsp.location_city,
          jsp.location_state,
          jsp.years_of_experience,
          jsp.profile_picture_url,
          jsp.availability
        FROM users u
        JOIN job_seeker_profiles jsp ON u.id = jsp.user_id
        WHERE u.id = $1`,
        [match.candidateId]
      );

      if (result.rows.length > 0) {
        candidates.push({
          ...result.rows[0],
          matchScore: match.score,
        });
      }
    }

    return candidates;
  }
}
