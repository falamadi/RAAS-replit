import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: false }
      : false
  });

  try {
    console.log('🚀 Starting database migration...');
    
    // Check if tables already exist
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('⚠️  Tables already exist. Skipping migration.');
      return;
    }

    // Run migrations in order
    const migrationFiles = [
      '01_create_tables.sql',
      '02_seed_data.sql',
      '03_messaging_notifications.sql',
      '04_analytics_tables.sql',
      '05_interview_tables.sql',
      '06_compliance_tables.sql'
    ];

    for (const file of migrationFiles) {
      const filePath = path.join(__dirname, '../../database/init', file);
      
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  Migration file not found: ${file}`);
        continue;
      }
      
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Split by semicolon and execute each statement
      const statements = sql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      for (const statement of statements) {
        try {
          await pool.query(statement);
        } catch (err) {
          console.error(`Error in ${file}:`, err.message);
          throw err;
        }
      }
      
      console.log(`✓ Executed ${file}`);
    }
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrate();
}

export default migrate;