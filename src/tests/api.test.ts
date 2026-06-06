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

  it('should perform vector ranked search and return results with COSINE, EUCLIDEAN, and DOT metrics', async () => {
    if (!createdDocId) return;

    // Test Cosine Search
    const reqCosine = new Request('http://localhost/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        query: 'transporte autônomo e sensores lidar',
        metric: 'COSINE'
      })
    });
    const resCosine = await app.handle(reqCosine);
    expect(resCosine.status).toBe(200);
    const dataCosine: any = await resCosine.json();
    expect(Array.isArray(dataCosine)).toBe(true);
    expect(dataCosine.length).toBeGreaterThan(0);
    const foundCosine = dataCosine.find((d: any) => d.id === createdDocId);
    expect(foundCosine).toBeDefined();
    expect(foundCosine.similarity).toBeDefined();
    expect(typeof foundCosine.similarity).toBe('number');

    // Test Euclidean Search
    const reqEuclidean = new Request('http://localhost/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        query: 'transporte autônomo e sensores lidar',
        metric: 'EUCLIDEAN'
      })
    });
    const resEuclidean = await app.handle(reqEuclidean);
    expect(resEuclidean.status).toBe(200);
    const dataEuclidean: any = await resEuclidean.json();
    expect(Array.isArray(dataEuclidean)).toBe(true);
    expect(dataEuclidean.length).toBeGreaterThan(0);
    const foundEuclidean = dataEuclidean.find((d: any) => d.id === createdDocId);
    expect(foundEuclidean).toBeDefined();
    expect(foundEuclidean.similarity).toBeDefined();

    // Test Dot Search
    const reqDot = new Request('http://localhost/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        query: 'transporte autônomo e sensores lidar',
        metric: 'DOT'
      })
    });
    const resDot = await app.handle(reqDot);
    expect(resDot.status).toBe(200);
    const dataDot: any = await resDot.json();
    expect(Array.isArray(dataDot)).toBe(true);
    expect(dataDot.length).toBeGreaterThan(0);
    const foundDot = dataDot.find((d: any) => d.id === createdDocId);
    expect(foundDot).toBeDefined();
    expect(foundDot.similarity).toBeDefined();
  }, 30000);

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

  describe('POST /api/documents/import integration tests', () => {
    it('should create a new document via import', async () => {
      if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️ Skipping import creation test: GEMINI_API_KEY is not defined');
        return;
      }

      const title = '[TEST-API] Documento Importado Novo';
      const content = 'Este é o conteúdo do documento importado novo.';
      const contentBase64 = Buffer.from(content).toString('base64');

      const req = new Request('http://localhost/api/documents/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          titulo: title,
          conteudoBase64: contentBase64
        })
      });

      const res = await app.handle(req);
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.action).toBe('created');
      expect(data.id).toBeDefined();
      
      // Check if it was actually created with decoded content
      const checkReq = new Request(`http://localhost/api/documents/${data.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const checkRes = await app.handle(checkReq);
      expect(checkRes.status).toBe(200);
      const checkData: any = await checkRes.json();
      expect(checkData.titulo).toBe(title);
      expect(checkData.conteudo).toBe(content);
    });

    it('should update an existing document via import when content changes', async () => {
      if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️ Skipping import update test: GEMINI_API_KEY is not defined');
        return;
      }

      const title = '[TEST-API] Documento Importado Existente';
      const originalContent = 'Conteúdo original do documento.';
      const originalContentBase64 = Buffer.from(originalContent).toString('base64');

      // 1. Create first
      const createReq = new Request('http://localhost/api/documents/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          titulo: title,
          conteudoBase64: originalContentBase64
        })
      });
      const createRes = await app.handle(createReq);
      expect(createRes.status).toBe(200);
      const createData: any = await createRes.json();
      expect(createData.action).toBe('created');
      const docId = createData.id;

      // 2. Import again with updated content
      const updatedContent = 'Conteúdo modificado do documento.';
      const updatedContentBase64 = Buffer.from(updatedContent).toString('base64');

      const updateReq = new Request('http://localhost/api/documents/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          titulo: title,
          conteudoBase64: updatedContentBase64
        })
      });
      const updateRes = await app.handle(updateReq);
      expect(updateRes.status).toBe(200);
      const updateData: any = await updateRes.json();
      expect(updateData.success).toBe(true);
      expect(updateData.action).toBe('updated');
      expect(updateData.id).toBe(docId);

      // Verify database has updated content
      const checkReq = new Request(`http://localhost/api/documents/${docId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const checkRes = await app.handle(checkReq);
      expect(checkRes.status).toBe(200);
      const checkData: any = await checkRes.json();
      expect(checkData.conteudo).toBe(updatedContent);
    });

    it('should skip updating when content is identical', async () => {
      if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️ Skipping import skip test: GEMINI_API_KEY is not defined');
        return;
      }

      const title = '[TEST-API] Documento Importado Identico';
      const content = 'Conteúdo idêntico do documento.';
      const contentBase64 = Buffer.from(content).toString('base64');

      // 1. Create first
      const createReq = new Request('http://localhost/api/documents/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          titulo: title,
          conteudoBase64: contentBase64
        })
      });
      const createRes = await app.handle(createReq);
      expect(createRes.status).toBe(200);
      const createData: any = await createRes.json();
      expect(createData.action).toBe('created');
      const docId = createData.id;

      // 2. Import again with identical content
      const skipReq = new Request('http://localhost/api/documents/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          titulo: title,
          conteudoBase64: contentBase64
        })
      });
      const skipRes = await app.handle(skipReq);
      expect(skipRes.status).toBe(200);
      const skipData: any = await skipRes.json();
      expect(skipData.success).toBe(true);
      expect(skipData.action).toBe('skipped');
      expect(skipData.id).toBe(docId);
    });

    it('should return validation error for invalid import payload', async () => {
      // Missing conteudoBase64
      const req1 = new Request('http://localhost/api/documents/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          titulo: '[TEST-API] Documento Sem Conteudo'
        })
      });
      const res1 = await app.handle(req1);
      expect(res1.status).toBe(422);
      
      // Missing titulo
      const req2 = new Request('http://localhost/api/documents/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          conteudoBase64: 'YWJj'
        })
      });
      const res2 = await app.handle(req2);
      expect(res2.status).toBe(422);
    });
  });

  it('should delete all documents via DELETE /api/documents', async () => {
    // Insert a dummy document
    const embeddingStr = '[' + new Array(768).fill(0.1).join(',') + ']';
    const vecFunc = process.env.DB_DIALECT === 'heatwave' ? 'STRING_TO_VECTOR(?)' : 'VEC_FromText(?)';
    await pool.query(`INSERT INTO vector_documentos (titulo, conteudo, embedding) VALUES (?, ?, ${vecFunc})`, 
      ['[TEST-API] Temp Delete All Doc', 'Temporary content', embeddingStr]
    );

    const req = new Request('http://localhost/api/documents', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.success).toBe(true);

    // Verify table is empty
    const [rows]: any = await pool.query('SELECT COUNT(*) as count FROM vector_documentos');
    expect(rows[0].count).toBe(0);
  });
});
