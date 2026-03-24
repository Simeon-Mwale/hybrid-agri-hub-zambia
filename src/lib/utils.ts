// lib/utils.ts

/**
 * Safely stringify metadata for SQLite storage
 */
export function toMetadataString(obj: unknown): string | null {
  if (!obj) return null;
  try {
    return JSON.stringify(obj);
  } catch (e) {
    console.error('Failed to stringify metadata:', e);
    return null;
  }
}

/**
 * Safely parse metadata string from SQLite
 */
export function fromMetadataString<T>(str: string | null): T | null {
  if (!str) return null;
  try {
    return JSON.parse(str) as T;
  } catch (e) {
    console.error('Failed to parse metadata:', e);
    return null;
  }
}

/**
 * Type definition for prediction activity metadata
 */
export interface PredictionActivityMetadata {
  duration: number;
  count: number;
  cropsProcessed?: number;
  marketsProcessed?: number;
  error?: string;
  timestamp?: string;
  stack?: string;
}