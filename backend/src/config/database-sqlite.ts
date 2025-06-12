import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { logger } from '../utils/logger';
import path from 'path';

let db: Database<sqlite3.Database, sqlite3.Statement>;

export async function connectDatabase(): Promise<void> {
  try {
    const dbPath = process.env.DATABASE_URL?.replace('sqlite://', '') || './database.db';
    
    db = await open({
      filename: path.resolve(dbPath),
      driver: sqlite3.Database
    });

    // Enable foreign keys
    await db.run('PRAGMA foreign_keys = ON');
    
    // Test the connection
    await db.get('SELECT datetime("now") as now');
    logger.info('SQLite database connection established');
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

export function getDb(): Database<sqlite3.Database, sqlite3.Statement> {
  if (!db) {
    throw new Error('Database not initialized. Call connectDatabase() first.');
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    logger.info('Database connection closed');
  }
}

// Helper to convert PostgreSQL queries to SQLite
export function toSQLite(query: string): string {
  return query
    .replace(/\$(\d+)/g, '?') // Convert $1, $2 to ?
    .replace(/RETURNING \*/g, '') // Remove RETURNING clause
    .replace(/ON CONFLICT.*DO UPDATE SET/g, 'ON CONFLICT REPLACE') // Simplify upsert
    .replace(/::json/g, '') // Remove JSON casting
    .replace(/::jsonb/g, '') // Remove JSONB casting
    .replace(/NOW\(\)/gi, "datetime('now')") // Convert NOW() to SQLite
    .replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT'); // Convert SERIAL
}