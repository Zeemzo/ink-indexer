import type { HealthStatus } from '../types/events.js';
import { prisma } from './prisma.js';

export async function getHealthStatus(
  indexerState: {
    lastBlockNumber: bigint;
    isIndexing: boolean;
    lastError?: string;
    errorCount: number;
  },
  chainConnected: boolean
): Promise<HealthStatus> {
  const databaseConnected = await testDatabaseConnection();

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  if (!databaseConnected || !chainConnected) {
    status = 'unhealthy';
  } else if (indexerState.errorCount > 5) {
    status = 'degraded';
  }

  return {
    status,
    indexer: indexerState,
    databaseConnected,
    chainConnected,
  };
}

async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
