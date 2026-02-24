import { config } from 'dotenv';

// Load environment variables
config();

export const env = {
  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // Blockchain RPC
  rpcUrl: process.env.RPC_URL || 'https://rpc-gel.inkonchain.com',

  // Indexer Configuration
  startBlock: BigInt(process.env.START_BLOCK || '18000000'),
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '12000', 10),

  // API
  port: parseInt(process.env.PORT || '4000', 10),
  graphqlPath: process.env.GRAPHQL_PATH || '/graphql',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
} as const;

// Validate required environment variables
export function validateEnv(): void {
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  if (!env.rpcUrl) {
    throw new Error('RPC_URL is required');
  }
}
