import { PubSub } from 'graphql-subscriptions';
import type { OnchainIndexer } from '../../indexer/index.js';

const pubsub = new PubSub();
const NEW_EVENTS_TOPIC = 'NEW_EVENTS';

export function createResolvers(indexer: OnchainIndexer) {
  const storage = indexer.getStorage();
  const eventEmitter = indexer.getEventEmitter();

  // Subscribe to indexer events and publish to GraphQL subscriptions
  eventEmitter.subscribe((event) => {
    if (event.type === 'erc20-transfer') {
      pubsub.publish(NEW_EVENTS_TOPIC, {
        newEvents: { ...event.data, __typename: 'ERC20Transfer' },
      });
    } else if (event.type === 'swap') {
      pubsub.publish(NEW_EVENTS_TOPIC, {
        newEvents: { ...event.data, __typename: 'Swap' },
      });
    }
  });

  return {
    Query: {
      async events(_: any, args: { first?: number; after?: string; type?: string }) {
        const { first = 10, type } = args;

        if (type === 'ERC20_TRANSFER') {
          const transfers = await storage.getRecentTransfers(first);
          return transfers.map((t: any) => ({ ...t, __typename: 'ERC20Transfer' }));
        } else if (type === 'SWAP') {
          const swaps = await storage.getRecentSwaps(first);
          return swaps.map((s: any) => ({ ...s, __typename: 'Swap' }));
        } else {
          return await storage.getRecentEvents(first);
        }
      },

      async transfers(_: any, args: { first?: number; to?: string }) {
        const { first = 10, to } = args;
        if (to) {
          return await storage.getTransfersByAddress(to, first);
        }
        return await storage.getRecentTransfers(first);
      },

      async swaps(_: any, args: { first?: number; poolAddress?: string }) {
        const { first = 10, poolAddress } = args;
        if (poolAddress) {
          return await storage.getSwapsByPool(poolAddress, first);
        }
        return await storage.getRecentSwaps(first);
      },

      async stats() {
        const stats = await storage.getStats();
        return {
          totalEvents: stats.totalEvents.toString(),
          totalTransfers: stats.totalTransfers.toString(),
          totalSwaps: stats.totalSwaps.toString(),
          latestBlock: stats.latestBlock.toString(),
        };
      },

      async status() {
        const currentState = indexer.getState();
        return {
          isIndexing: currentState.isIndexing,
          lastBlockNumber: currentState.lastBlockNumber.toString(),
          errorCount: currentState.errorCount,
          uptime: indexer.getUptime(),
        };
      },
    },

    Subscription: {
      newEvents: {
        subscribe: () => pubsub.asyncIterator([NEW_EVENTS_TOPIC]),
      },
    },
  };
}
