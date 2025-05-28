// User related types
export enum UserType {
  JOB_SEEKER = 'job_seeker',
  RECRUITER = 'recruiter',
  HIRING_MANAGER = 'hiring_manager',
  ADMIN = 'admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification',
}

export interface User {
  id: string;
  email: string;
  userType: UserType;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

export interface CreateUserDTO {
  email: string;
  password: string;
  userType: UserType;
  firstName: string;
  lastName: string;
  companyId?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Job Seeker types
export enum AvailabilityStatus {
  IMMEDIATELY = 'immediately',
  WITHIN_MONTH = 'within_month',
  WITHIN_3_MONTHS = 'within_3_months',
  NOT_LOOKING = 'not_looking',
}

export interface JobSeekerProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  latitude?: number;
  longitude?: number;
  headline?: string;
  summary?: string;
  resumeUrl?: string;
  profilePictureUrl?: string;
  yearsOfExperience: number;
  availability: AvailabilityStatus;
  desiredSalaryMin?: number;
  desiredSalaryMax?: number;
  willingToRelocate: boolean;
  remotePreference?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Company types
export enum CompanySize {
  STARTUP = 'startup',
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  ENTERPRISE = 'enterprise',
}

export interface Company {
  id: string;
  name: string;
  description?: string;
  industry?: string;
  size?: CompanySize;
  website?: string;
  logoUrl?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  latitude?: number;
  longitude?: number;
  foundedYear?: number;
  employeeCountMin?: number;
  employeeCountMax?: number;
  cultureInfo?: Record<string, any>;
  benefits?: string[];
  techStack?: string[];
  isVerified: boolean;
  verificationDate?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Job types
export enum EmploymentType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  TEMPORARY = 'temporary',
  INTERNSHIP = 'internship',
}

export enum ExperienceLevel {
  ENTRY = 'entry',
  MID = 'mid',
  SENIOR = 'senior',
  EXECUTIVE = 'executive',
}

export enum JobStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  CLOSED = 'closed',
  ARCHIVED = 'archived',
}

export interface JobPosting {
  id: string;
  companyId: string;
  recruiterId: string;
  title: string;
  description: string;
  requirements?: string;
  responsibilities?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  latitude?: number;
  longitude?: number;
  isRemote: boolean;
  remoteType?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency: string;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel;
  educationRequirements?: Record<string, any>;
  benefits?: string[];
  postedDate: Date;
  applicationDeadline?: Date;
  status: JobStatus;
  viewsCount: number;
  applicationCount: number;
  createdAt: Date;
  updatedAt: Date;
  // Additional fields from joins
  company?: {
    name: string;
    logoUrl?: string;
    industry?: string;
    size?: string;
    isVerified: boolean;
  };
  skills?: Array<{
    skillId: string;
    skillName: string;
    category?: string;
    isRequired: boolean;
    minYearsRequired: number;
  }>;
}

export interface CreateJobDTO {
  title: string;
  description: string;
  requirements?: string;
  responsibilities?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  isRemote: boolean;
  remoteType?: string;
  salaryMin?: number;
  salaryMax?: number;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel;
  skills: { skillId: string; isRequired: boolean; minYearsRequired?: number }[];
  benefits?: string[];
  applicationDeadline?: Date;
}

// Application types
export enum ApplicationStatus {
  SUBMITTED = 'submitted',
  SCREENING = 'screening',
  INTERVIEWING = 'interviewing',
  OFFERED = 'offered',
  HIRED = 'hired',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
}

export interface Application {
  id: string;
  jobId: string;
  jobSeekerId: string;
  coverLetter?: string;
  customResumeUrl?: string;
  answers?: Record<string, any>;
  status: ApplicationStatus;
  matchScore?: number;
  recruiterNotes?: string;
  rejectionReason?: string;
  appliedAt: Date;
  statusUpdatedAt: Date;
  viewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Skill types
export enum ProficiencyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

export interface Skill {
  id: string;
  name: string;
  category?: string;
  isTechnical: boolean;
  synonyms?: string[];
  createdAt: Date;
}

export interface JobSeekerSkill {
  skillId: string;
  proficiencyLevel: ProficiencyLevel;
  yearsOfExperience: number;
}

// Request types
export interface AuthenticatedRequest extends Express.Request {
  user?: {
    id: string;
    email: string;
    userType: UserType;
  };
}

// Pagination
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Search and Filter types
export interface JobSearchFilters {
  keywords?: string;
  location?: string;
  radius?: number;
  employmentType?: EmploymentType[];
  experienceLevel?: ExperienceLevel[];
  salaryMin?: number;
  salaryMax?: number;
  isRemote?: boolean;
  companySize?: CompanySize[];
  skills?: string[];
  postedWithin?: number; // days
}

export interface CandidateSearchFilters {
  keywords?: string;
  location?: string;
  radius?: number;
  skills?: string[];
  experienceMin?: number;
  experienceMax?: number;
  availability?: AvailabilityStatus[];
  willingToRelocate?: boolean;
}
