import { createServer } from 'http';
import { env, validateEnv } from './config/env.js';
import { logger } from './lib/logger.js';
import { testDatabaseConnection, disconnectPrisma } from './lib/prisma.js';
import { OnchainIndexer } from './indexer/index.js';
import { createGraphQLServer } from './api/graphql/server.js';
import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';

// Validate environment variables
validateEnv();

// Global state
let indexer: OnchainIndexer;
let httpServer: ReturnType<typeof createServer>;

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down gracefully...');

  try {
    if (indexer) {
      await indexer.stop();
    }

    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }

    await disconnectPrisma();

    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

async function main(): Promise<void> {
  logger.info('Starting Ink Indexer...');

  const dbConnected = await testDatabaseConnection();
  if (!dbConnected) {
    throw new Error('Database connection failed');
  }

  indexer = new OnchainIndexer();

  const app = express();

  httpServer = createServer(app);

  const { server: graphqlServer } = await createGraphQLServer(indexer);

  app.use(
    env.graphqlPath,
    express.json(),
    expressMiddleware(graphqlServer, {
      context: async () => ({ indexer }),
    })
  );

  app.get('/health', async (_req, res) => {
    const state = indexer.getState();
    const latestBlock = await indexer.getStorage().getStats();

    res.json({
      status: 'healthy',
      uptime: indexer.getUptime(),
      indexer: {
        isIndexing: state.isIndexing,
        lastBlockNumber: state.lastBlockNumber.toString(),
        errorCount: state.errorCount,
        latestBlockInDb: latestBlock.latestBlock.toString(),
      },
      database: dbConnected,
    });
  });

  httpServer.listen(env.port, () => {
    logger.info(
      {
        port: env.port,
        graphqlPath: env.graphqlPath,
        startBlock: env.startBlock.toString(),
        pollIntervalMs: env.pollIntervalMs,
      },
      'Server started'
    );
  });

  indexer.start().catch((error) => {
    logger.error({ error }, 'Indexer failed to start');
    shutdown('INDEXER_ERROR');
  });

  logger.info('Ink Indexer is running');
}

main().catch((error) => {
  logger.error({ error }, 'Failed to start application');
  process.exit(1);
});
