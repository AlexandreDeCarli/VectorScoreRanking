import { GoogleGenerativeAI } from '@google/generative-ai';

const modelName = process.env.GEMINI_MODEL || 'gemini-embedding-2';

export async function getEmbedding(text: string): Promise<number[]> {
  const currentApiKey = process.env.GEMINI_API_KEY;
  if (!currentApiKey) {
    throw new Error('GEMINI_API_KEY is not defined in the environment.');
  }
  const genAI = new GoogleGenerativeAI(currentApiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.embedContent({
    content: { parts: [{ text }] },
    outputDimensionality: 768
  });
  if (!result.embedding || !result.embedding.values) {
    throw new Error('Failed to generate embedding: empty response.');
  }
  return result.embedding.values;
}
