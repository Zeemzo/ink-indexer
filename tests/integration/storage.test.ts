import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DecodedEvent } from '../../src/types/events.js';

// Use vi.hoisted to create mock functions before vi.mock is hoisted
const mocks = vi.hoisted(() => ({
  prismaTransaction: vi.fn(),
  eventLogCreate: vi.fn(),
  erc20TransferCreate: vi.fn(),
  swapCreate: vi.fn(),
  erc20TransferFindMany: vi.fn(),
  swapFindMany: vi.fn(),
  eventLogCount: vi.fn(),
  erc20TransferCount: vi.fn(),
  swapCount: vi.fn(),
  eventLogFindFirst: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    $transaction: mocks.prismaTransaction,
    eventLog: {
      create: mocks.eventLogCreate,
      count: mocks.eventLogCount,
      findFirst: mocks.eventLogFindFirst,
    },
    eRC20Transfer: {
      create: mocks.erc20TransferCreate,
      findMany: mocks.erc20TransferFindMany,
      count: mocks.erc20TransferCount,
    },
    swap: {
      create: mocks.swapCreate,
      findMany: mocks.swapFindMany,
      count: mocks.swapCount,
    },
  },
}));

import { EventStorage } from '../../src/indexer/storage.js';

const BLOCK_NUMBER = 18000100n;
const BLOCK_TIMESTAMP = new Date('2024-01-15T12:00:00Z');

const mockTransferEvent: DecodedEvent = {
  type: 'erc20-transfer',
  data: {
    from: '0x1111111111111111111111111111111111111111',
    to: '0x2222222222222222222222222222222222222222',
    value: '1000000000000000000',
    tokenAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    logIndex: 0,
    blockNumber: BLOCK_NUMBER,
    blockTimestamp: BLOCK_TIMESTAMP,
  },
};

const mockSwapEvent: DecodedEvent = {
  type: 'swap',
  data: {
    poolAddress: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    sender: '0x3333333333333333333333333333333333333333',
    recipient: '0x4444444444444444444444444444444444444444',
    amount0In: '1000000',
    amount1In: '0',
    amount0Out: '0',
    amount1Out: '500000',
    transactionHash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
    logIndex: 1,
    blockNumber: BLOCK_NUMBER,
    blockTimestamp: BLOCK_TIMESTAMP,
  },
};

describe('EventStorage', () => {
  let storage: EventStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new EventStorage();

    // Default: transaction executes the callback immediately
    mocks.prismaTransaction.mockImplementation(async (callback: any) => {
      const tx = {
        eventLog: { create: mocks.eventLogCreate },
        eRC20Transfer: { create: mocks.erc20TransferCreate },
        swap: { create: mocks.swapCreate },
      };
      return callback(tx);
    });
  });

  describe('saveBlockEvents', () => {
    it('should save ERC-20 transfer events atomically', async () => {
      mocks.eventLogCreate.mockResolvedValue({});
      mocks.erc20TransferCreate.mockResolvedValue({});

      await storage.saveBlockEvents(BLOCK_NUMBER, BLOCK_TIMESTAMP, [mockTransferEvent]);

      expect(mocks.prismaTransaction).toHaveBeenCalledTimes(1);
      expect(mocks.eventLogCreate).toHaveBeenCalledTimes(1);
      expect(mocks.erc20TransferCreate).toHaveBeenCalledTimes(1);

      const eventLogCall = mocks.eventLogCreate.mock.calls[0][0];
      expect(eventLogCall.data.blockNumber).toBe(BLOCK_NUMBER);
      expect(eventLogCall.data.transactionHash).toBe(mockTransferEvent.data.transactionHash);
    });

    it('should save swap events atomically', async () => {
      mocks.eventLogCreate.mockResolvedValue({});
      mocks.swapCreate.mockResolvedValue({});

      await storage.saveBlockEvents(BLOCK_NUMBER, BLOCK_TIMESTAMP, [mockSwapEvent]);

      expect(mocks.prismaTransaction).toHaveBeenCalledTimes(1);
      expect(mocks.eventLogCreate).toHaveBeenCalledTimes(1);
      expect(mocks.swapCreate).toHaveBeenCalledTimes(1);

      const swapCall = mocks.swapCreate.mock.calls[0][0];
      expect(swapCall.data.poolAddress).toBe('0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');
      expect(swapCall.data.amount0In).toBe('1000000');
    });

    it('should save mixed events in a single transaction', async () => {
      mocks.eventLogCreate.mockResolvedValue({});
      mocks.erc20TransferCreate.mockResolvedValue({});
      mocks.swapCreate.mockResolvedValue({});

      await storage.saveBlockEvents(BLOCK_NUMBER, BLOCK_TIMESTAMP, [
        mockTransferEvent,
        mockSwapEvent,
      ]);

      expect(mocks.prismaTransaction).toHaveBeenCalledTimes(1);
      expect(mocks.eventLogCreate).toHaveBeenCalledTimes(2);
      expect(mocks.erc20TransferCreate).toHaveBeenCalledTimes(1);
      expect(mocks.swapCreate).toHaveBeenCalledTimes(1);
    });

    it('should handle unknown events (only EventLog, no typed table)', async () => {
      mocks.eventLogCreate.mockResolvedValue({});

      const unknownEvent: DecodedEvent = {
        type: 'unknown',
        log: {
          address: '0x5555555555555555555555555555555555555555',
          blockHash: '0x0000000000000000000000000000000000000000000000000000000000000001',
          blockNumber: BLOCK_NUMBER,
          data: '0xdeadbeef',
          logIndex: 2,
          transactionHash: '0xaaaa',
          transactionIndex: 0,
          removed: false,
          topics: ['0xdeadbeef'],
        },
      };

      await storage.saveBlockEvents(BLOCK_NUMBER, BLOCK_TIMESTAMP, [unknownEvent]);

      expect(mocks.eventLogCreate).toHaveBeenCalledTimes(1);
      expect(mocks.erc20TransferCreate).not.toHaveBeenCalled();
      expect(mocks.swapCreate).not.toHaveBeenCalled();
    });

    it('should handle empty events array', async () => {
      await storage.saveBlockEvents(BLOCK_NUMBER, BLOCK_TIMESTAMP, []);

      expect(mocks.prismaTransaction).toHaveBeenCalledTimes(1);
      expect(mocks.eventLogCreate).not.toHaveBeenCalled();
    });

    it('should throw when transaction fails', async () => {
      mocks.prismaTransaction.mockRejectedValue(new Error('DB write failed'));

      await expect(
        storage.saveBlockEvents(BLOCK_NUMBER, BLOCK_TIMESTAMP, [mockTransferEvent])
      ).rejects.toThrow('DB write failed');
    });
  });

  describe('Query methods', () => {
    it('should serialize BigInt and Date in getRecentTransfers', async () => {
      mocks.erc20TransferFindMany.mockResolvedValue([
        {
          id: 'test-1',
          blockNumber: 18000100n,
          blockTimestamp: new Date('2024-01-15T12:00:00Z'),
          transactionHash: '0xabc',
          from: '0x111',
          to: '0x222',
          value: '1000',
          tokenAddress: '0xAAA',
        },
      ]);

      const results = await storage.getRecentTransfers(10);

      expect(results).toHaveLength(1);
      expect(results[0].blockNumber).toBe('18000100');
      expect(typeof results[0].blockNumber).toBe('string');
      expect(results[0].blockTimestamp).toBe('2024-01-15T12:00:00.000Z');
      expect(typeof results[0].blockTimestamp).toBe('string');
    });

    it('should serialize BigInt and Date in getRecentSwaps', async () => {
      mocks.swapFindMany.mockResolvedValue([
        {
          id: 'swap-1',
          blockNumber: 18000200n,
          blockTimestamp: new Date('2024-01-16T12:00:00Z'),
          poolAddress: '0xBBB',
          sender: '0x333',
          recipient: '0x444',
          amount0In: '100',
          amount1Out: '200',
        },
      ]);

      const results = await storage.getRecentSwaps(5);

      expect(results).toHaveLength(1);
      expect(results[0].blockNumber).toBe('18000200');
      expect(results[0].blockTimestamp).toBe('2024-01-16T12:00:00.000Z');
    });

    it('should combine and sort events in getRecentEvents', async () => {
      mocks.erc20TransferFindMany.mockResolvedValue([
        {
          id: 't1',
          blockNumber: 18000100n,
          blockTimestamp: new Date('2024-01-15T12:00:00Z'),
          from: '0x111',
          to: '0x222',
          value: '1000',
          tokenAddress: '0xAAA',
          transactionHash: '0xaaa',
        },
        {
          id: 't2',
          blockNumber: 18000050n,
          blockTimestamp: new Date('2024-01-14T12:00:00Z'),
          from: '0x111',
          to: '0x222',
          value: '2000',
          tokenAddress: '0xAAA',
          transactionHash: '0xbbb',
        },
      ]);

      mocks.swapFindMany.mockResolvedValue([
        {
          id: 's1',
          blockNumber: 18000075n,
          blockTimestamp: new Date('2024-01-14T18:00:00Z'),
          poolAddress: '0xBBB',
          sender: '0x333',
          recipient: '0x444',
          amount0In: '100',
          amount1Out: '200',
          transactionHash: '0xccc',
        },
      ]);

      const results = await storage.getRecentEvents(10);

      expect(results).toHaveLength(3);
      // Sorted by blockNumber descending
      expect(results[0].__typename).toBe('ERC20Transfer');
      expect(results[0].blockNumber).toBe('18000100');
      expect(results[1].__typename).toBe('Swap');
      expect(results[1].blockNumber).toBe('18000075');
      expect(results[2].__typename).toBe('ERC20Transfer');
      expect(results[2].blockNumber).toBe('18000050');
    });

    it('should filter transfers by address', async () => {
      mocks.erc20TransferFindMany.mockResolvedValue([]);

      await storage.getTransfersByAddress('0x1234', 20);

      expect(mocks.erc20TransferFindMany).toHaveBeenCalledWith({
        where: {
          OR: [{ from: '0x1234' }, { to: '0x1234' }],
        },
        take: 20,
        orderBy: { blockNumber: 'desc' },
      });
    });

    it('should filter swaps by pool address', async () => {
      mocks.swapFindMany.mockResolvedValue([]);

      await storage.getSwapsByPool('0xPoolAddress', 30);

      expect(mocks.swapFindMany).toHaveBeenCalledWith({
        where: { poolAddress: '0xPoolAddress' },
        take: 30,
        orderBy: { blockNumber: 'desc' },
      });
    });
  });

  describe('getStats', () => {
    it('should return aggregated stats', async () => {
      mocks.eventLogCount.mockResolvedValue(1000);
      mocks.erc20TransferCount.mockResolvedValue(800);
      mocks.swapCount.mockResolvedValue(200);
      mocks.eventLogFindFirst.mockResolvedValue({ blockNumber: 18001000n });

      const stats = await storage.getStats();

      expect(stats.totalEvents).toBe(1000n);
      expect(stats.totalTransfers).toBe(800n);
      expect(stats.totalSwaps).toBe(200n);
      expect(stats.latestBlock).toBe(18001000n);
    });

    it('should return 0n for latestBlock when no events exist', async () => {
      mocks.eventLogCount.mockResolvedValue(0);
      mocks.erc20TransferCount.mockResolvedValue(0);
      mocks.swapCount.mockResolvedValue(0);
      mocks.eventLogFindFirst.mockResolvedValue(null);

      const stats = await storage.getStats();

      expect(stats.totalEvents).toBe(0n);
      expect(stats.latestBlock).toBe(0n);
    });
  });
});
