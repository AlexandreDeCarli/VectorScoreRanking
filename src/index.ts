import { Elysia, t } from 'elysia';
import { authPlugin } from './auth';
import { pool } from './db';
import { getEmbedding } from './gemini';
import { SQL_STRING_TO_VECTOR, SQL_VECTOR_TO_STRING, SQL_COSINE_SIMILARITY, getVectorSearchSQL, MetricType } from './sql-dialect';

const port = process.env.PORT || 3000;

export const app = new Elysia()
  .onRequest(({ request }) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api') || url.pathname === '/') {
      console.log(`[HTTP] 📥 ${request.method} ${url.pathname}`);
    }
  })
  .onAfterResponse(({ request, set }) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api') || url.pathname === '/') {
      console.log(`[HTTP] 📤 ${request.method} ${url.pathname} - Status: ${set.status || 200}`);
    }
  })
  // Helper for auth sign
  .use(authPlugin)
  
  // Public Login Route
  .post('/api/auth/login', async ({ body, jwt, set }) => {
    const { username, password } = body;
    
    const expectedUser = process.env.APP_USERNAME;
    const expectedPass = process.env.APP_PASSWORD;
    
    if (!expectedUser || !expectedPass) {
      set.status = 500;
      return { error: 'Configuração de autenticação ausente no servidor' };
    }
    
    if (username === expectedUser && password === expectedPass) {
      const token = await jwt.sign({ username });
      return { token };
    }
    
    set.status = 401;
    return { error: 'Credenciais inválidas' };
  }, {
    body: t.Object({
      username: t.String(),
      password: t.String()
    })
  })
  
  // Protected API Routes Group
  .group('/api', (app) => 
    app
      .onBeforeHandle(({ user, set }) => {
        if (!user) {
          set.status = 401;
          return { error: 'Não autorizado' };
        }
      })
      
      // List Documents (Metadata only)
      .get('/documents', async () => {
        const [rows] = await pool.query(
          'SELECT id, titulo, created_at, updated_at FROM vector_documentos ORDER BY created_at DESC'
        );
        return rows;
      })
      
      // Get Single Document (Includes content)
      .get('/documents/:id', async ({ params, set }) => {
        const id = parseInt(params.id);
        const [rows]: any = await pool.query(
          'SELECT id, titulo, conteudo, created_at, updated_at FROM vector_documentos WHERE id = ?',
          [id]
        );
        if (rows.length === 0) {
          set.status = 404;
          return { error: 'Documento não encontrado' };
        }
        return rows[0];
      })
      
      // Create Document (Generates vector embedding)
      .post('/documents', async ({ body, set }) => {
        const { titulo, conteudo } = body;
        
        try {
          const embedding = await getEmbedding(conteudo);
          const embeddingString = `[${embedding.join(',')}]`;
          
          const [result]: any = await pool.query(
            `INSERT INTO vector_documentos (titulo, conteudo, embedding) VALUES (?, ?, ${SQL_STRING_TO_VECTOR})`,
            [titulo, conteudo, embeddingString]
          );
          
          return { id: result.insertId, titulo, success: true };
        } catch (err: any) {
          console.error('[Error] POST /api/documents failed:', err);
          set.status = 500;
          return { error: `Erro ao gerar embedding ou salvar banco: ${err.message}` };
        }
      }, {
        body: t.Object({
          titulo: t.String(),
          conteudo: t.String()
        })
      })
      
      // Import Document (Batch Import endpoint)
      .post('/documents/import', async ({ body, set }) => {
        const { titulo, conteudoBase64 } = body;
        
        try {
          // Decode content
          const conteudo = Buffer.from(conteudoBase64, 'base64').toString('utf-8');
          
          // Query database to check if document with the same titulo already exists
          const [checkRows]: any = await pool.query(
            'SELECT id, conteudo FROM vector_documentos WHERE titulo = ?',
            [titulo]
          );
          
          if (checkRows.length === 0) {
            // Document does NOT exist -> create it
            const embedding = await getEmbedding(conteudo);
            const embeddingString = `[${embedding.join(',')}]`;
            
            const [result]: any = await pool.query(
              `INSERT INTO vector_documentos (titulo, conteudo, embedding) VALUES (?, ?, ${SQL_STRING_TO_VECTOR})`,
              [titulo, conteudo, embeddingString]
            );
            
            return { success: true, action: 'created', id: result.insertId };
          } else {
            // Document DOES exist -> compare content
            const existingId = checkRows[0].id;
            const existingConteudo = checkRows[0].conteudo;
            
            if (existingConteudo !== conteudo) {
              // Different content -> update embedding and fields (including updated_at)
              const embedding = await getEmbedding(conteudo);
              const embeddingString = `[${embedding.join(',')}]`;
              
              await pool.query(
                `UPDATE vector_documentos SET titulo = ?, conteudo = ?, embedding = ${SQL_STRING_TO_VECTOR}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [titulo, conteudo, embeddingString, existingId]
              );
              
              return { success: true, action: 'updated', id: existingId };
            } else {
              // Identical content -> skip update
              return { success: true, action: 'skipped', id: existingId };
            }
          }
        } catch (err: any) {
          console.error('[Error] POST /api/documents/import failed:', err);
          set.status = 500;
          return { error: `Erro ao importar documento: ${err.message}` };
        }
      }, {
        body: t.Object({
          titulo: t.String(),
          conteudoBase64: t.String()
        })
      })
      
      // Update Document (Re-generates vector embedding)
      .put('/documents/:id', async ({ params, body, set }) => {
        const id = parseInt(params.id);
        const { titulo, conteudo } = body;
        
        try {
          // Check if document exists
          const [checkRows]: any = await pool.query('SELECT id, conteudo FROM vector_documentos WHERE id = ?', [id]);
          if (checkRows.length === 0) {
            set.status = 404;
            return { error: 'Documento não encontrado' };
          }
          
          let embeddingString: string;
          
          // Only re-generate embedding if content has changed
          if (checkRows[0].conteudo !== conteudo) {
            const embedding = await getEmbedding(conteudo);
            embeddingString = `[${embedding.join(',')}]`;
          } else {
            // Keep existing embedding by querying it and converting back (or just update title and keep embedding)
            // But to make it simple and clean, if it doesn't change, we can just run a query without updating the embedding, or just update the embedding with the same value
            const [embRows]: any = await pool.query(`SELECT ${SQL_VECTOR_TO_STRING} as emb FROM vector_documentos WHERE id = ?`, [id]);
            embeddingString = embRows[0].emb;
          }
          
          await pool.query(
            `UPDATE vector_documentos SET titulo = ?, conteudo = ?, embedding = ${SQL_STRING_TO_VECTOR} WHERE id = ?`,
            [titulo, conteudo, embeddingString, id]
          );
          
          return { id, titulo, success: true };
        } catch (err: any) {
          console.error(`[Error] PUT /api/documents/${id} failed:`, err);
          set.status = 500;
          return { error: `Erro ao atualizar documento: ${err.message}` };
        }
      }, {
        body: t.Object({
          titulo: t.String(),
          conteudo: t.String()
        })
      })
      
      // Delete All Documents
      .delete('/documents', async () => {
        await pool.query('DELETE FROM vector_documentos');
        return { success: true };
      })

      // Delete Document
      .delete('/documents/:id', async ({ params, set }) => {
        const id = parseInt(params.id);
        const [result]: any = await pool.query('DELETE FROM vector_documentos WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
          set.status = 404;
          return { error: 'Documento não encontrado' };
        }
        return { success: true };
      })
      
      // Ranked Vector Similarity Search
      .post('/search', async ({ body, set }) => {
        const { query, metric } = body;
        const searchMetric = (metric || 'COSINE') as MetricType;
        
        try {
          // 1. Generate embedding for the search query
          const embedding = await getEmbedding(query);
          const embeddingString = `[${embedding.join(',')}]`;
          
          // 2. Resolve the query scoring function and ordering
          const { select: scoreSql, order: orderSql } = getVectorSearchSQL(searchMetric);
          
          // 3. Perform vector similarity search
          const [rows]: any = await pool.query(
            `SELECT id, titulo, conteudo, 
                    ${scoreSql} AS similarity 
             FROM vector_documentos 
             ORDER BY ${orderSql} 
             LIMIT 10`,
            [embeddingString]
          );
          
          return rows;
        } catch (err: any) {
          console.error('[Error] POST /api/search failed:', err);
          set.status = 500;
          return { error: `Erro na busca por vetor: ${err.message}` };
        }
      }, {
        body: t.Object({
          query: t.String(),
          metric: t.Optional(t.Union([t.Literal('COSINE'), t.Literal('DOT'), t.Literal('EUCLIDEAN')]))
        })
      })
  )
  
  // Serve static assets directly using Bun.file with caching headers
  .get('/assets/*', ({ params, set }) => {
    const assetPath = `src/client/dist/assets/${params['*']}`;
    set.headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    return Bun.file(assetPath);
  })
  
  // SPA Fallback: serve index.html for non-API client routes
  .get('/', () => Bun.file('src/client/dist/index.html'))
  .get('/*', ({ path, set }) => {
    if (path.startsWith('/api')) {
      set.status = 404;
      return { error: 'Not Found' };
    }
    return Bun.file('src/client/dist/index.html');
  })
  
if (process.env.NODE_ENV !== 'test') {
  // Run pending database migrations before accepting requests
  const { runMigrations } = await import('./migrate');
  await runMigrations();
  
  app.listen(port);
  console.log(`Server running at http://localhost:${port}`);
}
