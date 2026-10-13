/**
 * Manual test script for GraphQL WebSocket subscriptions.
 *
 * Usage:
 *   1. Start the indexer: npm run dev
 *   2. In another terminal: npx tsx scripts/test-subscription.ts
 *
 * You should see real-time events printed as the indexer processes new blocks.
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:4000/graphql';

const SUBSCRIBE_MESSAGE = {
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
};

let eventCount = 0;

const ws = new WebSocket(WS_URL, 'graphql-transport-ws');

ws.on('open', () => {
  console.log('Connected to WebSocket server');
  // graphql-ws protocol: send connection_init first
  ws.send(JSON.stringify({ type: 'connection_init' }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());

  switch (message.type) {
    case 'connection_ack':
      console.log('Connection acknowledged — subscribing to newEvents...\n');
      ws.send(JSON.stringify(SUBSCRIBE_MESSAGE));
      break;

    case 'next':
      eventCount++;
      const event = message.payload?.data?.newEvents;
      if (!event) {
        console.log(`[#${eventCount}] Received payload with null data:`, JSON.stringify(message.payload, null, 2));
        break;
      }
      const type = event.__typename;

      if (type === 'ERC20Transfer') {
        console.log(`[#${eventCount}] ERC-20 Transfer | Block ${event.blockNumber}`);
        console.log(`  Token: ${event.tokenAddress}`);
        console.log(`  From:  ${event.from}`);
        console.log(`  To:    ${event.to}`);
        console.log(`  Value: ${event.value}\n`);
      } else if (type === 'Swap') {
        console.log(`[#${eventCount}] Swap | Block ${event.blockNumber}`);
        console.log(`  Pool:      ${event.poolAddress}`);
        console.log(`  Sender:    ${event.sender}`);
        console.log(`  Recipient: ${event.recipient}`);
        console.log(`  In:  ${event.amount0In} / ${event.amount1In}`);
        console.log(`  Out: ${event.amount0Out} / ${event.amount1Out}\n`);
      }
      break;

    case 'error':
      console.error('Subscription error:', JSON.stringify(message.payload, null, 2));
      break;

    case 'complete':
      console.log('Subscription completed');
      break;
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err.message);
  console.log('\nMake sure the indexer is running: npm run dev');
});

ws.on('close', () => {
  console.log(`\nDisconnected. Received ${eventCount} events total.`);
});

// Graceful shutdown on Ctrl+C
process.on('SIGINT', () => {
  console.log('\nClosing subscription...');
  ws.send(JSON.stringify({ id: '1', type: 'complete' }));
  ws.close();
  process.exit(0);
});
