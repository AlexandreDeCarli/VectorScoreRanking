import { describe, it, expect, afterAll } from 'bun:test';
import { pool } from '../db';
import { isMariaDB } from '../sql-dialect';

describe('Database Integration Tests', () => {
  it('should successfully connect to the database and query the version', async () => {
    const [rows]: any = await pool.query('SELECT VERSION() as version');
    expect(rows).toBeDefined();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].version).toBeDefined();
    console.log(' - Database Version:', rows[0].version);
  });

  it('should match the configured DB_DIALECT with the actual database engine', async () => {
    const [rows]: any = await pool.query('SELECT VERSION() as version');
    const version: string = rows[0].version;
    if (isMariaDB) {
      expect(version.toLowerCase()).toContain('mariadb');
      console.log(' - Dialect: MariaDB (confirmed)');
    } else {
      // HeatWave/MySQL should NOT contain 'mariadb'
      expect(version.toLowerCase()).not.toContain('mariadb');
      console.log(' - Dialect: MySQL HeatWave (confirmed)');
    }
  });

  it('should be able to query the vector_documentos table', async () => {
    const [rows]: any = await pool.query('SELECT COUNT(*) as count FROM vector_documentos');
    expect(rows).toBeDefined();
    expect(rows[0].count).toBeDefined();
    expect(typeof rows[0].count).toBe('number');
  });
});

