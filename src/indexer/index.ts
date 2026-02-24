import { BlockPoller } from './block-poller.js';
import { EventDecoder } from './event-decoder.js';
import { EventStorage } from './storage.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';
import type { DecodedEvent, IndexerState } from '../types/events.js';

// Event emitter for WebSocket streaming
export class IndexerEventEmitter {
  private listeners: Set<(event: DecodedEvent) => void> = new Set();

  subscribe(callback: (event: DecodedEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  emit(event: DecodedEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        logger.error({ error }, 'Error in event listener');
      }
    }
  }
}

export class OnchainIndexer {
  private blockPoller: BlockPoller;
  private eventDecoder: EventDecoder;
  private storage: EventStorage;
  private eventEmitter: IndexerEventEmitter;
  private state: IndexerState;
  private startTime: Date;

  constructor() {
    this.blockPoller = new BlockPoller(
      env.rpcUrl,
      env.startBlock,
      env.pollIntervalMs
    );
    this.eventDecoder = new EventDecoder();
    this.storage = new EventStorage();
    this.eventEmitter = new IndexerEventEmitter();
    this.startTime = new Date();

    this.state = {
      lastBlockNumber: env.startBlock,
      isIndexing: false,
      errorCount: 0,
    };
  }

  /**
   * Start the indexer
   */
  async start(): Promise<void> {
    logger.info('Starting Onchain Indexer...');

    this.state.isIndexing = true;

    // Start block polling
    await this.blockPoller.start(async (blockNumber, logs) => {
      await this.processBlock(blockNumber, logs);
    });

    logger.info('Onchain Indexer stopped');
  }

  /**
   * Process a single block
   */
  private async processBlock(
    blockNumber: bigint,
    logs: any[]
  ): Promise<void> {
    try {
      logger.debug({ blockNumber, logCount: logs.length }, 'Processing block');

      // Get block timestamp
      const block = await this.blockPoller.client?.getBlock({ blockNumber });
      const blockTimestamp = new Date(Number(block?.timestamp || 0) * 1000);

      // Decode all logs
      const decodedEvents: DecodedEvent[] = [];
      for (const log of logs) {
        const decoded = this.eventDecoder.decode(log, blockTimestamp);
        decodedEvents.push(decoded);
      }

      // Save to database
      await this.storage.saveBlockEvents(blockNumber, blockTimestamp, decodedEvents);

      // Emit events for WebSocket subscribers
      for (const event of decodedEvents) {
        this.eventEmitter.emit(event);
      }

      // Update state
      this.state.lastBlockNumber = blockNumber;

      logger.debug(
        { blockNumber, decodedCount: decodedEvents.length },
        'Block processed successfully'
      );
    } catch (error) {
      this.state.errorCount++;
      logger.error({ error, blockNumber }, 'Error processing block');
      throw error;
    }
  }

  /**
   * Stop the indexer
   */
  async stop(): Promise<void> {
    logger.info('Stopping Onchain Indexer...');
    this.state.isIndexing = false;
    await this.blockPoller.stop();
  }

  /**
   * Get current indexer state
   */
  getState(): IndexerState {
    return { ...this.state };
  }

  /**
   * Get event emitter for WebSocket subscriptions
   */
  getEventEmitter(): IndexerEventEmitter {
    return this.eventEmitter;
  }

  /**
   * Get storage instance for queries
   */
  getStorage(): EventStorage {
    return this.storage;
  }

  /**
   * Get uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }
}
