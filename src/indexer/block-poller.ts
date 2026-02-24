import { createPublicClient, http, type PublicClient, type Log } from 'viem';
import { ink } from 'viem/chains';
import { logger } from '../lib/logger.js';
import { exponentialRetry } from '../lib/retry.js';

export type BlockCallback = (blockNumber: bigint, logs: Log[]) => Promise<void>;

export class BlockPoller {
  public client: PublicClient;
  private currentBlock: bigint;
  private pollInterval: number;
  private isRunning: boolean = false;
  private errorCount: number = 0;

  constructor(rpcUrl: string, startBlock: bigint, pollInterval: number) {
    this.client = createPublicClient({
      chain: ink,
      transport: http(rpcUrl, {
        retryCount: 3,
        timeout: 30_000,
      }),
    });
    this.currentBlock = startBlock;
    this.pollInterval = pollInterval;
  }

  async start(callback: BlockCallback): Promise<void> {
    if (this.isRunning) {
      logger.warn('Block poller is already running');
      return;
    }

    this.isRunning = true;
    logger.info({ startBlock: this.currentBlock, pollIntervalMs: this.pollInterval }, 'Block poller started');

    while (this.isRunning) {
      try {
        await this.pollBlocks(callback);
        this.errorCount = 0;
      } catch (error) {
        this.errorCount++;
        logger.error(
          { error, errorCount: this.errorCount },
          'Error in block poller loop'
        );

        if (this.errorCount > 10) {
          logger.error('Too many consecutive errors, stopping poller');
          this.isRunning = false;
          throw error;
        }
      }

      await this.sleep(this.pollInterval);
    }
  }

  private async pollBlocks(callback: BlockCallback): Promise<void> {
    return exponentialRetry(
      async () => {
        const latestBlock = await this.client.getBlockNumber();

        if (latestBlock < this.currentBlock) {
          logger.debug('No new blocks');
          return;
        }

        const endBlock = latestBlock;
        logger.debug(
          { from: this.currentBlock, to: endBlock, blockCount: Number(endBlock - this.currentBlock) + 1 },
          'Processing block range'
        );

        const BATCH_SIZE = 100n;
        for (let block = this.currentBlock; block <= endBlock; block += BATCH_SIZE) {
          const batchEnd = block + BATCH_SIZE - 1n > endBlock ? endBlock : block + BATCH_SIZE - 1n;

          const logs = await this.client.getLogs({
            fromBlock: block,
            toBlock: batchEnd,
          });

          const blockNumbers = new Set(logs.map((log) => log.blockNumber));
          for (const blockNumber of blockNumbers) {
            const blockLogs = logs.filter((log) => log.blockNumber === blockNumber);
            await callback(blockNumber, blockLogs);
          }

          logger.debug(
            { from: block, to: batchEnd, logCount: logs.length },
            'Processed batch'
          );
        }

        this.currentBlock = endBlock + 1n;
      },
      { maxRetries: 3, baseDelayMs: 1000 }
    );
  }

  async stop(): Promise<void> {
    logger.info('Stopping block poller...');
    this.isRunning = false;
  }

  getCurrentBlock(): bigint {
    return this.currentBlock;
  }

  async getLatestBlockNumber(): Promise<bigint> {
    return exponentialRetry(() => this.client.getBlockNumber());
  }

  getErrorCount(): number {
    return this.errorCount;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
