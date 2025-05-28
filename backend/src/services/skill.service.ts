import { getPool } from '../config/database';
import { Skill } from '../types';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export class SkillService {
  static async getAll(category?: string): Promise<Skill[]> {
    const pool = getPool();

    let query = 'SELECT * FROM skills';
    const values: any[] = [];

    if (category) {
      query += ' WHERE category = $1';
      values.push(category);
    }

    query += ' ORDER BY name ASC';

    const result = await pool.query(query, values);

    return result.rows.map(row => this.mapToSkill(row));
  }

  static async search(query: string): Promise<Skill[]> {
    const pool = getPool();

    const result = await pool.query(
      `SELECT * FROM skills 
       WHERE name ILIKE $1 OR synonyms::text ILIKE $1
       ORDER BY 
         CASE WHEN name ILIKE $2 THEN 0 ELSE 1 END,
         name ASC
       LIMIT 20`,
      [`%${query}%`, `${query}%`]
    );

    return result.rows.map(row => this.mapToSkill(row));
  }

  static async getById(skillId: string): Promise<Skill> {
    const pool = getPool();

    const result = await pool.query('SELECT * FROM skills WHERE id = $1', [
      skillId,
    ]);

    if (result.rows.length === 0) {
      throw new AppError('Skill not found', 404, 'SKILL_NOT_FOUND');
    }

    return this.mapToSkill(result.rows[0]);
  }

  static async create(skillData: Partial<Skill>): Promise<Skill> {
    const pool = getPool();

    try {
      // Check if skill already exists
      const existing = await pool.query(
        'SELECT id FROM skills WHERE LOWER(name) = LOWER($1)',
        [skillData.name]
      );

      if (existing.rows.length > 0) {
        throw new AppError('Skill already exists', 409, 'SKILL_EXISTS');
      }

      const result = await pool.query(
        `INSERT INTO skills (name, category, is_technical, synonyms)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          skillData.name,
          skillData.category,
          skillData.isTechnical !== undefined ? skillData.isTechnical : true,
          JSON.stringify(skillData.synonyms || []),
        ]
      );

      logger.info(`Skill created: ${result.rows[0].name}`);
      return this.mapToSkill(result.rows[0]);
    } catch (error) {
      logger.error('Error creating skill:', error);
      throw error;
    }
  }

  static async update(
    skillId: string,
    updates: Partial<Skill>
  ): Promise<Skill> {
    const pool = getPool();

    const allowedFields = ['name', 'category', 'is_technical', 'synonyms'];
    const updateFields: string[] = [];
    const values: any[] = [skillId];
    let paramIndex = 2;

    Object.entries(updates).forEach(([key, value]) => {
      const dbKey = this.camelToSnake(key);
      if (allowedFields.includes(dbKey)) {
        updateFields.push(`${dbKey} = $${paramIndex}`);
        if (dbKey === 'synonyms') {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      throw new AppError('No valid fields to update', 400, 'INVALID_UPDATE');
    }

    const result = await pool.query(
      `UPDATE skills SET ${updateFields.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new AppError('Skill not found', 404, 'SKILL_NOT_FOUND');
    }

    logger.info(`Skill updated: ${skillId}`);
    return this.mapToSkill(result.rows[0]);
  }

  static async delete(skillId: string): Promise<void> {
    const pool = getPool();

    // Check if skill is being used
    const usageCheck = await pool.query(
      `SELECT COUNT(*) FROM (
         SELECT 1 FROM job_skills WHERE skill_id = $1
         UNION ALL
         SELECT 1 FROM job_seeker_skills WHERE skill_id = $1
       ) as usage`,
      [skillId]
    );

    if (parseInt(usageCheck.rows[0].count) > 0) {
      throw new AppError(
        'Cannot delete skill that is in use',
        400,
        'SKILL_IN_USE'
      );
    }

    const result = await pool.query('DELETE FROM skills WHERE id = $1', [
      skillId,
    ]);

    if (result.rowCount === 0) {
      throw new AppError('Skill not found', 404, 'SKILL_NOT_FOUND');
    }

    logger.info(`Skill deleted: ${skillId}`);
  }

  static async getCategories(): Promise<string[]> {
    const pool = getPool();

    const result = await pool.query(
      'SELECT DISTINCT category FROM skills WHERE category IS NOT NULL ORDER BY category'
    );

    return result.rows.map(row => row.category);
  }

  static async getPopular(limit: number = 20): Promise<Skill[]> {
    const pool = getPool();

    const result = await pool.query(
      `SELECT s.*, COUNT(js.skill_id) as usage_count
       FROM skills s
       LEFT JOIN job_skills js ON s.id = js.skill_id
       GROUP BY s.id
       ORDER BY usage_count DESC, s.name ASC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => this.mapToSkill(row));
  }

  private static mapToSkill(row: any): Skill {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      isTechnical: row.is_technical,
      synonyms: row.synonyms || [],
      createdAt: new Date(row.created_at),
    };
  }

  private static camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
