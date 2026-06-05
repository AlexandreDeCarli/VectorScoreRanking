import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
const modelName = process.env.GEMINI_MODEL || 'gemini-embedding-2';

const genAI = new GoogleGenerativeAI(apiKey);

export async function getEmbedding(text: string): Promise<number[]> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in the environment.');
  }
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.embedContent(text);
  if (!result.embedding || !result.embedding.values) {
    throw new Error('Failed to generate embedding: empty response.');
  }
  return result.embedding.values;
}
