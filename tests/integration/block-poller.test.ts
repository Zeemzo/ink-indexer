import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlockPoller, type BlockCallback } from '../../src/indexer/block-poller.js';

// Mock viem
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn().mockReturnValue({
      getBlockNumber: vi.fn(),
      getLogs: vi.fn(),
      getBlock: vi.fn(),
    }),
  };
});

describe('BlockPoller', () => {
  let poller: BlockPoller;

  beforeEach(() => {
    vi.clearAllMocks();
    poller = new BlockPoller('https://rpc.example.com', 18000000n, 1000);
  });

  describe('constructor', () => {
    it('should initialize with correct start block', () => {
      expect(poller.getCurrentBlock()).toBe(18000000n);
    });

    it('should have zero error count initially', () => {
      expect(poller.getErrorCount()).toBe(0);
    });

    it('should create a public client', () => {
      expect(poller.client).toBeDefined();
    });
  });

  describe('getCurrentBlock', () => {
    it('should return the current block', () => {
      const currentBlock = poller.getCurrentBlock();
      expect(currentBlock).toBe(18000000n);
    });
  });

  describe('getLatestBlockNumber', () => {
    it('should call client.getBlockNumber', async () => {
      const mockGetBlockNumber = poller.client.getBlockNumber as ReturnType<typeof vi.fn>;
      mockGetBlockNumber.mockResolvedValue(18000500n);

      const latest = await poller.getLatestBlockNumber();

      expect(latest).toBe(18000500n);
    });
  });

  describe('stop', () => {
    it('should stop the poller gracefully', async () => {
      await poller.stop();
      // Should not throw
    });
  });

  describe('start and polling logic', () => {
    it('should process logs grouped by block number', async () => {
      const mockGetBlockNumber = poller.client.getBlockNumber as ReturnType<typeof vi.fn>;
      const mockGetLogs = poller.client.getLogs as ReturnType<typeof vi.fn>;

      // Return a block range with 2 blocks
      mockGetBlockNumber.mockResolvedValueOnce(18000001n);

      const mockLogs = [
        {
          address: '0xAAAA',
          blockNumber: 18000000n,
          blockHash: '0x001',
          data: '0x',
          logIndex: 0,
          transactionHash: '0xabc',
          transactionIndex: 0,
          removed: false,
          topics: ['0xddf252ad'],
        },
        {
          address: '0xBBBB',
          blockNumber: 18000000n,
          blockHash: '0x001',
          data: '0x',
          logIndex: 1,
          transactionHash: '0xdef',
          transactionIndex: 1,
          removed: false,
          topics: ['0xddf252ad'],
        },
        {
          address: '0xCCCC',
          blockNumber: 18000001n,
          blockHash: '0x002',
          data: '0x',
          logIndex: 0,
          transactionHash: '0xghi',
          transactionIndex: 0,
          removed: false,
          topics: ['0xddf252ad'],
        },
      ];

      mockGetLogs.mockResolvedValueOnce(mockLogs);

      const processedBlocks: Array<{ blockNumber: bigint; logCount: number }> = [];
      const callback: BlockCallback = async (blockNumber, logs) => {
        processedBlocks.push({ blockNumber, logCount: logs.length });
      };

      // Start the poller but stop it after one iteration
      mockGetBlockNumber.mockResolvedValue(18000001n); // For subsequent polls

      // We need to stop the poller after the first poll cycle
      const startPromise = poller.start(callback);

      // Give it time to process, then stop
      await new Promise((resolve) => setTimeout(resolve, 100));
      await poller.stop();

      // Wait for start to complete
      await startPromise.catch(() => {}); // May reject after stop

      // Should have processed both blocks with their respective logs
      expect(processedBlocks.length).toBeGreaterThanOrEqual(2);

      const block18M = processedBlocks.find((b) => b.blockNumber === 18000000n);
      const block18M1 = processedBlocks.find((b) => b.blockNumber === 18000001n);

      if (block18M) {
        expect(block18M.logCount).toBe(2); // Two logs in block 18000000
      }
      if (block18M1) {
        expect(block18M1.logCount).toBe(1); // One log in block 18000001
      }
    });

    it('should skip when no new blocks are available', async () => {
      const mockGetBlockNumber = poller.client.getBlockNumber as ReturnType<typeof vi.fn>;

      // Return a block before start block — no new blocks
      mockGetBlockNumber.mockResolvedValue(17999999n);

      const callback = vi.fn();

      const startPromise = poller.start(callback);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await poller.stop();
      await startPromise.catch(() => {});

      // Callback should not have been called since no new blocks
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
