import { describe, it, expect, afterAll } from 'vitest';
import { createServer, type Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from '../../src/api/graphql/schema.js';
import { PubSub } from 'graphql-subscriptions';

const TEST_PORT = 4099;
const pubsub = new PubSub();
const NEW_EVENTS_TOPIC = 'NEW_EVENTS';

// Minimal schema with a working subscription
const schema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: {
      events: () => [],
      transfers: () => [],
      swaps: () => [],
      stats: () => ({ totalEvents: '0', totalTransfers: '0', totalSwaps: '0', latestBlock: '0' }),
      status: () => ({ isIndexing: true, lastBlockNumber: '100', errorCount: 0, uptime: 60 }),
    },
    Subscription: {
      newEvents: {
        subscribe: () => pubsub.asyncIterator([NEW_EVENTS_TOPIC]),
      },
    },
    Event: {
      __resolveType(obj: any) {
        if (obj.__typename === 'Swap') return 'Swap';
        return 'ERC20Transfer';
      },
    },
  },
});

let httpServer: Server;
let wsServer: WebSocketServer;

// Start server
const serverReady = new Promise<void>((resolve) => {
  httpServer = createServer();
  wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });
  useServer({ schema }, wsServer);
  httpServer.listen(TEST_PORT, () => resolve());
});

afterAll(async () => {
  wsServer.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

/**
 * Helper: connect a graphql-ws client and subscribe.
 * Returns a promise that resolves with the first N events received.
 */
function subscribeAndCollect(count: number, timeoutMs = 5000): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const events: any[] = [];

    const ws = new WebSocket(`ws://localhost:${TEST_PORT}/graphql`, 'graphql-transport-ws');

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Timed out waiting for ${count} events (got ${events.length})`));
    }, timeoutMs);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'connection_init' }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'connection_ack') {
        ws.send(JSON.stringify({
          id: '1',
          type: 'subscribe',
          payload: {
            query: `subscription {
              newEvents {
                ... on ERC20Transfer {
                  __typename
                  blockNumber
                  transactionHash
                  from
                  to
                  value
                  tokenAddress
                }
                ... on Swap {
                  __typename
                  blockNumber
                  transactionHash
                  poolAddress
                  sender
                  recipient
                  amount0In
                  amount1In
                  amount0Out
                  amount1Out
                }
              }
            }`,
          },
        }));
      }

      if (msg.type === 'next') {
        events.push(msg.payload.data.newEvents);
        if (events.length >= count) {
          clearTimeout(timeout);
          ws.close();
          resolve(events);
        }
      }

      if (msg.type === 'error') {
        clearTimeout(timeout);
        ws.close();
        reject(new Error(`Subscription error: ${JSON.stringify(msg.payload)}`));
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

describe('GraphQL WebSocket Subscriptions', () => {
  it('should receive an ERC20Transfer event in real-time', async () => {
    await serverReady;

    const collectPromise = subscribeAndCollect(1);

    // Allow time for subscription to establish
    await new Promise((r) => setTimeout(r, 200));

    // Simulate the indexer emitting a transfer event
    pubsub.publish(NEW_EVENTS_TOPIC, {
      newEvents: {
        __typename: 'ERC20Transfer',
        id: 'test-t1',
        blockNumber: '18000100',
        blockTimestamp: '2024-01-15T12:00:00.000Z',
        transactionHash: '0xabc123',
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: '1000000000000000000',
        tokenAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
    });

    const events = await collectPromise;

    expect(events).toHaveLength(1);
    expect(events[0].__typename).toBe('ERC20Transfer');
    expect(events[0].blockNumber).toBe('18000100');
    expect(events[0].from).toBe('0x1111111111111111111111111111111111111111');
    expect(events[0].to).toBe('0x2222222222222222222222222222222222222222');
    expect(events[0].value).toBe('1000000000000000000');
    expect(events[0].tokenAddress).toBe('0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  });

  it('should receive a Swap event in real-time', async () => {
    await serverReady;

    const collectPromise = subscribeAndCollect(1);
    await new Promise((r) => setTimeout(r, 200));

    pubsub.publish(NEW_EVENTS_TOPIC, {
      newEvents: {
        __typename: 'Swap',
        id: 'test-s1',
        blockNumber: '18000200',
        blockTimestamp: '2024-01-15T12:01:00.000Z',
        transactionHash: '0xdef456',
        poolAddress: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        sender: '0x3333333333333333333333333333333333333333',
        recipient: '0x4444444444444444444444444444444444444444',
        amount0In: '1000000',
        amount1In: '0',
        amount0Out: '0',
        amount1Out: '500000',
      },
    });

    const events = await collectPromise;

    expect(events).toHaveLength(1);
    expect(events[0].__typename).toBe('Swap');
    expect(events[0].poolAddress).toBe('0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');
    expect(events[0].amount0In).toBe('1000000');
    expect(events[0].amount1Out).toBe('500000');
  });

  it('should receive multiple events in sequence', async () => {
    await serverReady;

    const collectPromise = subscribeAndCollect(3);
    await new Promise((r) => setTimeout(r, 200));

    // Emit 3 events rapidly
    pubsub.publish(NEW_EVENTS_TOPIC, {
      newEvents: {
        __typename: 'ERC20Transfer',
        id: 'test-t2',
        blockNumber: '18000300',
        blockTimestamp: '2024-01-15T12:02:00.000Z',
        transactionHash: '0x111',
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: '100',
        tokenAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
    });

    pubsub.publish(NEW_EVENTS_TOPIC, {
      newEvents: {
        __typename: 'Swap',
        id: 'test-s2',
        blockNumber: '18000300',
        blockTimestamp: '2024-01-15T12:02:00.000Z',
        transactionHash: '0x222',
        poolAddress: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        sender: '0x3333333333333333333333333333333333333333',
        recipient: '0x4444444444444444444444444444444444444444',
        amount0In: '500',
        amount1In: '0',
        amount0Out: '0',
        amount1Out: '250',
      },
    });

    pubsub.publish(NEW_EVENTS_TOPIC, {
      newEvents: {
        __typename: 'ERC20Transfer',
        id: 'test-t3',
        blockNumber: '18000301',
        blockTimestamp: '2024-01-15T12:02:01.000Z',
        transactionHash: '0x333',
        from: '0x5555555555555555555555555555555555555555',
        to: '0x6666666666666666666666666666666666666666',
        value: '9999',
        tokenAddress: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      },
    });

    const events = await collectPromise;

    expect(events).toHaveLength(3);
    expect(events[0].__typename).toBe('ERC20Transfer');
    expect(events[1].__typename).toBe('Swap');
    expect(events[2].__typename).toBe('ERC20Transfer');
    expect(events[2].blockNumber).toBe('18000301');
  });

  it('should handle client disconnect gracefully', async () => {
    await serverReady;

    const ws = new WebSocket(`ws://localhost:${TEST_PORT}/graphql`, 'graphql-transport-ws');

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'connection_init' }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'connection_ack') {
          // Subscribe then immediately disconnect
          ws.send(JSON.stringify({
            id: '1',
            type: 'subscribe',
            payload: { query: 'subscription { newEvents { ... on ERC20Transfer { blockNumber } } }' },
          }));

          setTimeout(() => {
            ws.close();
            resolve();
          }, 100);
        }
      });
    });

    // Publishing after disconnect should not throw
    expect(() => {
      pubsub.publish(NEW_EVENTS_TOPIC, {
        newEvents: {
          __typename: 'ERC20Transfer',
          id: 'test-orphan',
          blockNumber: '18000999',
          blockTimestamp: '2024-01-15T12:00:00.000Z',
          transactionHash: '0xorphan',
          from: '0x0000000000000000000000000000000000000000',
          to: '0x0000000000000000000000000000000000000000',
          value: '0',
          tokenAddress: '0x0000000000000000000000000000000000000000',
        },
      });
    }).not.toThrow();
  });
});
