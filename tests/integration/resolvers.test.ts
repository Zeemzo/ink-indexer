import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createResolvers } from '../../src/api/graphql/resolvers.js';
import type { OnchainIndexer } from '../../src/indexer/index.js';

// Mock storage methods
const mockGetRecentTransfers = vi.fn();
const mockGetRecentSwaps = vi.fn();
const mockGetRecentEvents = vi.fn();
const mockGetTransfersByAddress = vi.fn();
const mockGetSwapsByPool = vi.fn();
const mockGetStats = vi.fn();

const mockStorage = {
  getRecentTransfers: mockGetRecentTransfers,
  getRecentSwaps: mockGetRecentSwaps,
  getRecentEvents: mockGetRecentEvents,
  getTransfersByAddress: mockGetTransfersByAddress,
  getSwapsByPool: mockGetSwapsByPool,
  getStats: mockGetStats,
};

// Mock event emitter
const mockSubscribe = vi.fn().mockReturnValue(() => {});
const mockEventEmitter = {
  subscribe: mockSubscribe,
};

// Mock indexer
const mockIndexer = {
  getStorage: () => mockStorage,
  getEventEmitter: () => mockEventEmitter,
  getState: () => ({
    isIndexing: true,
    lastBlockNumber: 18000500n,
    errorCount: 0,
  }),
  getUptime: () => 3600,
} as unknown as OnchainIndexer;

describe('GraphQL Resolvers', () => {
  let resolvers: ReturnType<typeof createResolvers>;

  beforeEach(() => {
    vi.clearAllMocks();
    resolvers = createResolvers(mockIndexer);
  });

  describe('Query.events', () => {
    it('should return transfers when type is ERC20_TRANSFER', async () => {
      const transfers = [
        { id: 't1', from: '0x111', to: '0x222', value: '1000', blockNumber: '18000100' },
      ];
      mockGetRecentTransfers.mockResolvedValue(transfers);

      const result = await resolvers.Query.events(null, { first: 10, type: 'ERC20_TRANSFER' });

      expect(mockGetRecentTransfers).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(1);
      expect(result[0].__typename).toBe('ERC20Transfer');
    });

    it('should return swaps when type is SWAP', async () => {
      const swaps = [
        { id: 's1', poolAddress: '0xBBB', amount0In: '100', blockNumber: '18000200' },
      ];
      mockGetRecentSwaps.mockResolvedValue(swaps);

      const result = await resolvers.Query.events(null, { first: 5, type: 'SWAP' });

      expect(mockGetRecentSwaps).toHaveBeenCalledWith(5);
      expect(result).toHaveLength(1);
      expect(result[0].__typename).toBe('Swap');
    });

    it('should return all events when no type specified', async () => {
      const events = [
        { id: 't1', blockNumber: '18000100', __typename: 'ERC20Transfer' },
        { id: 's1', blockNumber: '18000200', __typename: 'Swap' },
      ];
      mockGetRecentEvents.mockResolvedValue(events);

      const result = await resolvers.Query.events(null, { first: 10 });

      expect(mockGetRecentEvents).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(2);
    });

    it('should use default first=10 when not specified', async () => {
      mockGetRecentEvents.mockResolvedValue([]);

      await resolvers.Query.events(null, {});

      expect(mockGetRecentEvents).toHaveBeenCalledWith(10);
    });
  });

  describe('Query.transfers', () => {
    it('should return recent transfers without filter', async () => {
      const transfers = [
        { id: 't1', from: '0x111', to: '0x222', value: '1000' },
      ];
      mockGetRecentTransfers.mockResolvedValue(transfers);

      const result = await resolvers.Query.transfers(null, { first: 10 });

      expect(mockGetRecentTransfers).toHaveBeenCalledWith(10);
      expect(result).toEqual(transfers);
    });

    it('should filter transfers by address when "to" is provided', async () => {
      mockGetTransfersByAddress.mockResolvedValue([]);

      await resolvers.Query.transfers(null, { first: 20, to: '0x1234' });

      expect(mockGetTransfersByAddress).toHaveBeenCalledWith('0x1234', 20);
      expect(mockGetRecentTransfers).not.toHaveBeenCalled();
    });
  });

  describe('Query.swaps', () => {
    it('should return recent swaps without filter', async () => {
      const swaps = [{ id: 's1', poolAddress: '0xBBB' }];
      mockGetRecentSwaps.mockResolvedValue(swaps);

      const result = await resolvers.Query.swaps(null, { first: 10 });

      expect(mockGetRecentSwaps).toHaveBeenCalledWith(10);
      expect(result).toEqual(swaps);
    });

    it('should filter swaps by pool address', async () => {
      mockGetSwapsByPool.mockResolvedValue([]);

      await resolvers.Query.swaps(null, { first: 15, poolAddress: '0xPoolAddr' });

      expect(mockGetSwapsByPool).toHaveBeenCalledWith('0xPoolAddr', 15);
      expect(mockGetRecentSwaps).not.toHaveBeenCalled();
    });
  });

  describe('Query.stats', () => {
    it('should return stats with BigInt values serialized to strings', async () => {
      mockGetStats.mockResolvedValue({
        totalEvents: 1500n,
        totalTransfers: 1200n,
        totalSwaps: 300n,
        latestBlock: 18001000n,
      });

      const result = await resolvers.Query.stats();

      expect(result).toEqual({
        totalEvents: '1500',
        totalTransfers: '1200',
        totalSwaps: '300',
        latestBlock: '18001000',
      });
    });
  });

  describe('Query.status', () => {
    it('should return current indexer status', async () => {
      const result = await resolvers.Query.status();

      expect(result).toEqual({
        isIndexing: true,
        lastBlockNumber: '18000500',
        errorCount: 0,
        uptime: 3600,
      });
    });
  });

  describe('Subscription setup', () => {
    it('should subscribe to event emitter on initialization', () => {
      expect(mockSubscribe).toHaveBeenCalledTimes(1);
      expect(typeof mockSubscribe.mock.calls[0][0]).toBe('function');
    });

    it('should have newEvents subscription resolver', () => {
      expect(resolvers.Subscription).toBeDefined();
      expect(resolvers.Subscription.newEvents).toBeDefined();
      expect(resolvers.Subscription.newEvents.subscribe).toBeTypeOf('function');
    });
  });
});
