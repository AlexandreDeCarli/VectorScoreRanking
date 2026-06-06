/**
 * SQL Dialect Abstraction Layer
 * 
 * Centralizes all database-specific SQL function syntax to support:
 * - MariaDB 11.7+ (local development & testing)
 * - MySQL HeatWave (OCI production)
 * 
 * Controlled by the DB_DIALECT environment variable:
 * - 'mariadb'  (default) → uses VEC_FROM_TEXT, VEC_DISTANCE_COSINE, VEC_TO_TEXT
 * - 'heatwave'           → uses STRING_TO_VECTOR, DISTANCE(..., 'COSINE'), VECTOR_TO_STRING
 */

const dialect = (process.env.DB_DIALECT || 'mariadb').toLowerCase();

export const isMariaDB = dialect === 'mariadb';
export const isHeatWave = dialect === 'heatwave';

/** 
 * SQL fragment: converts a JSON string of floats into a VECTOR column value.
 * Usage: pool.query(`INSERT ... VALUES (?, ?, ${SQL_STRING_TO_VECTOR})`, [..., embeddingStr])
 */
export const SQL_STRING_TO_VECTOR = isMariaDB
  ? 'VEC_FromText(?)'
  : 'STRING_TO_VECTOR(?)';

/**
 * SQL fragment: converts a VECTOR column back to a readable string.
 * Usage: pool.query(`SELECT ${SQL_VECTOR_TO_STRING} as emb FROM ...`)
 */
export const SQL_VECTOR_TO_STRING = isMariaDB
  ? 'VEC_ToText(embedding)'
  : 'VECTOR_TO_STRING(embedding)';

/**
 * SQL fragment: computes cosine similarity (0 to 1, higher = more similar).
 * The placeholder (?) receives the embedding string.
 * Usage: pool.query(`SELECT ${SQL_COSINE_SIMILARITY} AS similarity FROM ...`, [embeddingStr])
 */
export const SQL_COSINE_SIMILARITY = isMariaDB
  ? '(1 - VEC_DISTANCE_COSINE(embedding, VEC_FromText(?)))'
  : "(1 - DISTANCE(embedding, STRING_TO_VECTOR(?), 'COSINE'))";

export type MetricType = 'COSINE' | 'DOT' | 'EUCLIDEAN';

/**
 * Returns the dynamic SQL fragments for scoring and sorting based on the requested metric.
 */
export function getVectorSearchSQL(metric: MetricType = 'COSINE') {
  if (isMariaDB) {
    switch (metric) {
      case 'COSINE':
        return {
          select: '(1 - VEC_DISTANCE_COSINE(embedding, VEC_FromText(?)))',
          order: 'similarity DESC'
        };
      case 'EUCLIDEAN':
        return {
          select: 'VEC_DISTANCE_EUCLIDEAN(embedding, VEC_FromText(?))',
          order: 'similarity ASC'
        };
      case 'DOT':
        return {
          select: 'VEC_DISTANCE(embedding, VEC_FromText(?))',
          order: 'similarity DESC'
        };
    }
  } else {
    switch (metric) {
      case 'COSINE':
        return {
          select: "(1 - DISTANCE(embedding, STRING_TO_VECTOR(?), 'COSINE'))",
          order: 'similarity DESC'
        };
      case 'EUCLIDEAN':
        return {
          select: "DISTANCE(embedding, STRING_TO_VECTOR(?), 'EUCLIDEAN')",
          order: 'similarity ASC'
        };
      case 'DOT':
        return {
          select: "DISTANCE(embedding, STRING_TO_VECTOR(?), 'DOT')",
          order: 'similarity DESC'
        };
    }
  }
}

