import { connectDatabase as connectSQLite, getDb, closeDatabase as closeSQLite, toSQLite } from './database-sqlite';
export { toSQLite } from './database-sqlite';

// Wrapper to maintain compatibility with existing code
export const connectDatabase = connectSQLite;
export const closeDatabase = closeSQLite;

// Adapter to make SQLite work with existing Pool-based code
export function getPool() {
  const db = getDb();
  
  // Create a mock pool object that adapts SQLite to Pool interface
  return {
    query: async (text: string, params?: any[]) => {
      const sqliteQuery = toSQLite(text);
      
      if (sqliteQuery.toUpperCase().startsWith('SELECT')) {
        const rows = await db.all(sqliteQuery, params);
        return { rows, rowCount: rows.length };
      } else {
        const result = await db.run(sqliteQuery, params);
        return { 
          rows: [], 
          rowCount: result.changes || 0,
          lastID: result.lastID 
        };
      }
    },
    end: closeSQLite
  };
}
