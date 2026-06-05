import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../index';
import { pool } from '../db';

describe('Elysia REST API Integration Tests', () => {
  let token: string = '';
  let createdDocId: number | null = null;
  
  const testUsername = process.env.APP_USERNAME || 'admin';
  const testPassword = process.env.APP_PASSWORD || 'local_app_password';

  beforeAll(async () => {
    // Clean up potential leftover test data
    await pool.query('DELETE FROM vector_documentos WHERE titulo LIKE "[TEST-API] %"');
  });

  afterAll(async () => {
    // Clean up test data
    if (createdDocId) {
      await pool.query('DELETE FROM vector_documentos WHERE id = ?', [createdDocId]);
    }
    await pool.query('DELETE FROM vector_documentos WHERE titulo LIKE "[TEST-API] %"');
  });

  it('should deny access to protected endpoints without JWT', async () => {
    const req = new Request('http://localhost/api/documents');
    const res = await app.handle(req);
    expect(res.status).toBe(401);
    const data: any = await res.json();
    expect(data.error).toBe('Não autorizado');
  });

  it('should return 401 for invalid login credentials', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'wrong_user_xyz',
        password: 'wrong_password_123'
      })
    });
    const res = await app.handle(req);
    expect(res.status).toBe(401);
    const data: any = await res.json();
    expect(data.error).toBe('Credenciais inválidas');
  });

  it('should successfully log in with correct credentials and return a token', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testUsername,
        password: testPassword
      })
    });
    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.token).toBeDefined();
    expect(typeof data.token).toBe('string');
    token = data.token;
  });

  it('should list documents with valid token', async () => {
    const req = new Request('http://localhost/api/documents', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should create a new vector document', async () => {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('⚠️ Skipping document creation test: GEMINI_API_KEY is not defined');
      return;
    }

    const req = new Request('http://localhost/api/documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        titulo: '[TEST-API] Documento de Carros Autônomos',
        conteudo: 'Os veículos que dirigem sozinhos usam sensores lidar, radares e câmeras combinados com algoritmos de aprendizado de máquina para navegar com segurança no trânsito urbano.'
      })
    });

    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.success).toBe(true);
    expect(data.id).toBeDefined();
    createdDocId = data.id;
  }, 15000);

  it('should fetch the created document by ID', async () => {
    if (!createdDocId) return;

    const req = new Request(`http://localhost/api/documents/${createdDocId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.titulo).toBe('[TEST-API] Documento de Carros Autônomos');
    expect(data.conteudo).toContain('veículos que dirigem sozinhos');
  });

  it('should perform vector ranked search and return results', async () => {
    if (!createdDocId) return;

    const req = new Request('http://localhost/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        query: 'transporte autônomo e sensores lidar'
      })
    });

    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    
    // Find our created document in results
    const found = data.find((d: any) => d.id === createdDocId);
    expect(found).toBeDefined();
    expect(found.similarity).toBeDefined();
    expect(typeof found.similarity).toBe('number');
  }, 15000);

  it('should delete the created document', async () => {
    if (!createdDocId) return;

    const req = new Request(`http://localhost/api/documents/${createdDocId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.success).toBe(true);

    // Verify it is deleted
    const checkReq = new Request(`http://localhost/api/documents/${createdDocId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const checkRes = await app.handle(checkReq);
    expect(checkRes.status).toBe(404);
    
    createdDocId = null; // Reset since it is deleted successfully
  });
});
