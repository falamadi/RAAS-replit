import { logger } from '../utils/logger';
import { getDb } from './database-sqlite';

// Simple SQL-based search to replace Elasticsearch
class SimpleSearch {
  async indexJob(job: any): Promise<void> {
    // Jobs are already stored in SQLite, no separate indexing needed
    logger.debug(`Job ${job.id} indexed (SQLite storage)`);
  }

  async indexCandidate(candidate: any): Promise<void> {
    // Candidates are already stored in SQLite, no separate indexing needed
    logger.debug(`Candidate ${candidate.id} indexed (SQLite storage)`);
  }

  async searchJobs(query: string, filters?: any): Promise<any[]> {
    const db = getDb();
    let sql = `
      SELECT j.*, c.name as company_name 
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      WHERE j.status = 'active'
    `;
    const params: any[] = [];

    if (query) {
      sql += ` AND (j.title LIKE ? OR j.description LIKE ? OR c.name LIKE ?)`;
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters?.skills?.length) {
      const skillConditions = filters.skills.map(() => `j.skills LIKE ?`).join(' OR ');
      sql += ` AND (${skillConditions})`;
      filters.skills.forEach((skill: string) => {
        params.push(`%${skill}%`);
      });
    }

    if (filters?.location) {
      sql += ` AND j.location LIKE ?`;
      params.push(`%${filters.location}%`);
    }

    if (filters?.salary_min) {
      sql += ` AND j.salary_max >= ?`;
      params.push(filters.salary_min);
    }

    if (filters?.type) {
      sql += ` AND j.type = ?`;
      params.push(filters.type);
    }

    sql += ` ORDER BY j.posted_date DESC LIMIT 100`;

    const results = await db.all(sql, params);
    return results.map(job => ({
      ...job,
      skills: job.skills ? JSON.parse(job.skills) : []
    }));
  }

  async searchCandidates(query: string, filters?: any): Promise<any[]> {
    const db = getDb();
    let sql = `
      SELECT c.*, u.name, u.email 
      FROM candidates c
      JOIN users u ON c.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (query) {
      sql += ` AND (u.name LIKE ? OR c.skills LIKE ?)`;
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters?.skills?.length) {
      const skillConditions = filters.skills.map(() => `c.skills LIKE ?`).join(' OR ');
      sql += ` AND (${skillConditions})`;
      filters.skills.forEach((skill: string) => {
        params.push(`%${skill}%`);
      });
    }

    if (filters?.location) {
      sql += ` AND c.current_location LIKE ?`;
      params.push(`%${filters.location}%`);
    }

    if (filters?.experience_min) {
      sql += ` AND c.experience_years >= ?`;
      params.push(filters.experience_min);
    }

    sql += ` LIMIT 100`;

    const results = await db.all(sql, params);
    return results.map(candidate => ({
      ...candidate,
      skills: candidate.skills ? JSON.parse(candidate.skills) : [],
      preferred_locations: candidate.preferred_locations ? JSON.parse(candidate.preferred_locations) : []
    }));
  }

  async deleteJobIndex(jobId: string): Promise<void> {
    // No separate index to delete
    logger.debug(`Job ${jobId} removed from search index`);
  }

  async deleteCandidateIndex(candidateId: string): Promise<void> {
    // No separate index to delete
    logger.debug(`Candidate ${candidateId} removed from search index`);
  }
}

let searchClient: SimpleSearch;

export async function connectElasticsearch(): Promise<void> {
  try {
    searchClient = new SimpleSearch();
    logger.info('Simple search service initialized (Elasticsearch replacement for Replit)');
  } catch (error) {
    logger.error('Search service initialization failed:', error);
    throw error;
  }
}

export function getElasticsearchClient(): SimpleSearch {
  if (!searchClient) {
    throw new Error('Search service not initialized. Call connectElasticsearch() first.');
  }
  return searchClient as any; // Cast to any to maintain compatibility
}

export async function initializeIndices(): Promise<void> {
  // No separate indices needed with SQLite
  logger.info('Search indices initialized (using SQLite tables)');
}