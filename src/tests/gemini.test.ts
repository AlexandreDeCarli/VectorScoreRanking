import { describe, it, expect } from 'bun:test';
import { getEmbedding } from '../gemini';

describe('Gemini Embedding Tests', () => {
  it('should generate a 768-dimensional embedding for valid text', async () => {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('⚠️ Skipping live Gemini test: GEMINI_API_KEY not defined');
      return;
    }
    
    const text = 'Esta é uma frase de teste para verificar a dimensão do vetor gerado.';
    const embedding = await getEmbedding(text);
    
    expect(embedding).toBeDefined();
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(768);
    expect(typeof embedding[0]).toBe('number');
  }, 15000);

  it('should throw an error when API key is missing (simulated)', async () => {
    // Save original API key
    const origKey = process.env.GEMINI_API_KEY;
    
    // Temporarily delete API key to test validation
    delete process.env.GEMINI_API_KEY;
    
    expect(getEmbedding('Teste')).rejects.toThrow();
    
    // Restore API key
    process.env.GEMINI_API_KEY = origKey;
  });
});
