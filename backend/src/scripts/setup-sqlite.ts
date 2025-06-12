import { connectDatabase, getDb } from '../config/database-sqlite';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

async function setupDatabase() {
  try {
    await connectDatabase();
    const db = getDb();

    logger.info('Creating SQLite tables...');

    // Users table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'recruiter', 'client', 'candidate')) NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // Companies table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        website TEXT,
        logo_url TEXT,
        industry TEXT,
        size TEXT,
        location TEXT,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );
    `);

    // Jobs table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        company_id INTEGER NOT NULL,
        location TEXT,
        type TEXT CHECK(type IN ('full-time', 'part-time', 'contract', 'freelance')),
        experience_level TEXT,
        salary_min INTEGER,
        salary_max INTEGER,
        currency TEXT DEFAULT 'USD',
        skills TEXT, -- JSON array stored as text
        requirements TEXT,
        benefits TEXT,
        status TEXT CHECK(status IN ('draft', 'active', 'closed', 'archived')) DEFAULT 'draft',
        posted_by INTEGER,
        posted_date TEXT DEFAULT (datetime('now')),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (company_id) REFERENCES companies(id),
        FOREIGN KEY (posted_by) REFERENCES users(id)
      );
    `);

    // Candidates table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE,
        resume_url TEXT,
        portfolio_url TEXT,
        linkedin_url TEXT,
        github_url TEXT,
        skills TEXT, -- JSON array stored as text
        experience_years INTEGER,
        current_location TEXT,
        preferred_locations TEXT, -- JSON array stored as text
        availability TEXT CHECK(availability IN ('immediate', 'notice', 'not-looking')),
        expected_salary_min INTEGER,
        expected_salary_max INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    // Applications table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL,
        candidate_id INTEGER NOT NULL,
        status TEXT CHECK(status IN ('submitted', 'screening', 'interview', 'offer', 'rejected', 'withdrawn')) DEFAULT 'submitted',
        cover_letter TEXT,
        resume_url TEXT,
        notes TEXT,
        applied_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (candidate_id) REFERENCES candidates(id),
        UNIQUE(job_id, candidate_id)
      );
    `);

    // Messages table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        recipient_id INTEGER NOT NULL,
        application_id INTEGER,
        subject TEXT,
        content TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (sender_id) REFERENCES users(id),
        FOREIGN KEY (recipient_id) REFERENCES users(id),
        FOREIGN KEY (application_id) REFERENCES applications(id)
      );
    `);

    // Create indexes
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
      CREATE INDEX IF NOT EXISTS idx_applications_candidate ON applications(candidate_id);
      CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
    `);

    logger.info('SQLite database setup completed successfully');

    // Create admin user if it doesn't exist
    const adminEmail = 'admin@raas.com';
    const existingAdmin = await db.get('SELECT id FROM users WHERE email = ?', adminEmail);
    
    if (!existingAdmin) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await db.run(
        'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
        [adminEmail, hashedPassword, 'Admin User', 'admin']
      );
      
      logger.info('Admin user created: admin@raas.com / admin123');
    }

  } catch (error) {
    logger.error('Database setup failed:', error);
    throw error;
  }
}

setupDatabase().catch(console.error);