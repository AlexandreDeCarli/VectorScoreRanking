import { pool } from './db';
import { getEmbedding } from './gemini';
import { SQL_STRING_TO_VECTOR, SQL_COSINE_SIMILARITY } from './sql-dialect';

async function runTest() {
  console.log('--- VECTOR SEARCH INTEGRATION TEST ---');
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('ERRO: GEMINI_API_KEY não definida no ambiente.');
    process.exit(1);
  }

  try {
    // 1. Clean up old test data
    console.log('Limpando dados de teste antigos...');
    await pool.query('DELETE FROM vector_documentos WHERE titulo LIKE "[TESTE] %"');

    // 2. Define test documents
    const docs = [
      {
        titulo: '[TESTE] Receita de Bolo de Chocolate',
        conteudo: 'Ingredientes: farinha, açúcar, cacau em pó, ovos, manteiga. Misture tudo e asse por 40 minutos em forno médio para fazer um delicioso bolo de chocolate cremosa.'
      },
      {
        titulo: '[TESTE] Guia de Veículos Elétricos',
        conteudo: 'Baterias de íons de lítio, autonomia de rodagem, carregamento rápido e motores elétricos síncronos de imã permanente são a base dos carros modernos sustentáveis.'
      },
      {
        titulo: '[TESTE] Tutorial de Machine Learning',
        conteudo: 'Modelos de regressão linear, redes neurais profundas, algoritmos de agrupamento k-means e pipelines de engenharia de recursos com Python e scikit-learn.'
      }
    ];

    // 3. Insert documents with embeddings
    console.log('Inserindo documentos de teste com embeddings do Gemini...');
    for (const doc of docs) {
      console.log(` - Gerando embedding para: "${doc.titulo}"`);
      const embedding = await getEmbedding(doc.conteudo);
      const embeddingString = `[${embedding.join(',')}]`;
      
      await pool.query(
        `INSERT INTO vector_documentos (titulo, conteudo, embedding) VALUES (?, ?, ${SQL_STRING_TO_VECTOR})`,
        [doc.titulo, doc.conteudo, embeddingString]
      );
    }
    console.log('Documentos inseridos com sucesso!');

    // 4. Perform ranked search
    const searchQuery = 'como programar uma inteligência artificial';
    console.log(`\nExecutando busca vetorial com a query: "${searchQuery}"`);
    
    const queryEmbedding = await getEmbedding(searchQuery);
    const queryEmbeddingString = `[${queryEmbedding.join(',')}]`;

    const [results]: any = await pool.query(
      `SELECT id, titulo, 
              ${SQL_COSINE_SIMILARITY} AS similarity 
       FROM vector_documentos 
       WHERE titulo LIKE "[TESTE] %"
       ORDER BY similarity DESC`,
      [queryEmbeddingString]
    );

    console.log('Resultados ranqueados por aproximação semântica (cosseno):');
    results.forEach((res: any, idx: number) => {
      console.log(` ${idx + 1}. [Score: ${(res.similarity * 100).toFixed(2)}%] ${res.titulo}`);
    });

    // 5. Assert ranking order
    const topResult = results[0];
    if (topResult && topResult.titulo.includes('Tutorial de Machine Learning')) {
      console.log('\n✅ TESTE BEM SUCEDIDO: A busca vetorial colocou o documento sobre Machine Learning no topo para a query de IA!');
    } else {
      console.log('\n❌ TESTE FALHOU: O documento esperado de Machine Learning não ficou no topo da busca.');
    }

    // Cleanup
    console.log('\nLimpando dados de teste...');
    await pool.query('DELETE FROM vector_documentos WHERE titulo LIKE "[TESTE] %"');
    
  } catch (err: any) {
    console.error('Ocorreu um erro no teste:', err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

runTest();
