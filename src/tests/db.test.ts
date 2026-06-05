import { describe, it, expect, afterAll } from 'bun:test';
import { pool } from '../db';

describe('Database Integration Tests', () => {
  it('should successfully connect to the database and query the version', async () => {
    const [rows]: any = await pool.query('SELECT VERSION() as version');
    expect(rows).toBeDefined();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].version).toBeDefined();
    console.log(' - MySQL Version:', rows[0].version);
  });

  it('should be able to query the vector_documentos table', async () => {
    const [rows]: any = await pool.query('SELECT COUNT(*) as count FROM vector_documentos');
    expect(rows).toBeDefined();
    expect(rows[0].count).toBeDefined();
    expect(typeof rows[0].count).toBe('number');
  });
});
