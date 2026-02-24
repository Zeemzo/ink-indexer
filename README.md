# Project 1: Onchain Event Indexer (Ink Chain)

> **Core Pattern:** Chain polling → Event decoding → PostgreSQL → GraphQL + WebSocket streaming

---

## Overview

A production-grade TypeScript service that:

1. Polls the Ink (EVM) blockchain for new blocks via viem
2. Decodes ERC-20 Transfer and Uniswap V2/V3 Swap events
3. Stores events atomically in PostgreSQL via Prisma (dual storage: raw logs + typed tables)
4. Exposes a GraphQL API with filtering, stats, and real-time subscriptions
5. Streams new events to WebSocket clients via PubSub

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 20+ (ESM) |
| Language | TypeScript 5+ (strict mode) |
| Blockchain | viem (Ink chain) |
| Database | PostgreSQL 15 + Prisma ORM |
| API | Apollo Server 4 (GraphQL) |
| Real-time | graphql-subscriptions PubSub |
| Logging | pino + pino-pretty |
| Testing | Vitest |
| Container | Docker Compose |

---

## Project Structure

```
1-ink-indexer/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── docker-compose.yml
├── .env.example
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── index.ts                    # Entry point: Express + Apollo + health endpoint
│   ├── config/
│   │   └── env.ts                  # Environment variable parsing + validation
│   ├── indexer/
│   │   ├── index.ts                # OnchainIndexer orchestrator + IndexerEventEmitter
│   │   ├── block-poller.ts         # Block polling with batch processing (100 blocks)
│   │   ├── event-decoder.ts        # ABI decoding: ERC-20, V2 Swap, V3 Swap
│   │   └── storage.ts             # Prisma transactions + query methods + serialization
│   ├── api/
│   │   └── graphql/
│   │       ├── schema.ts           # GraphQL type definitions
│   │       ├── resolvers.ts        # Query + Subscription resolvers
│   │       └── server.ts           # Apollo Server factory
│   ├── lib/
│   │   ├── logger.ts              # Pino logger singleton
│   │   ├── prisma.ts              # PrismaClient singleton + connection test
│   │   ├── retry.ts               # Exponential backoff retry utility
│   │   └── health.ts              # Health status check
│   └── types/
│       └── events.ts              # DecodedEvent union, data interfaces, IndexerState
└── tests/
    ├── setup.ts                    # Test environment setup
    ├── unit/
    │   ├── event-decoder.test.ts   # 13 tests: ERC-20, V2 Swap, V3 Swap, edge cases
    │   ├── retry.test.ts           # 8 tests: backoff, retries, error preservation
    │   └── event-emitter.test.ts   # 6 tests: subscribe, unsubscribe, error isolation
    └── integration/
        ├── storage.test.ts         # 13 tests: atomic writes, serialization, queries
        ├── resolvers.test.ts       # 12 tests: GraphQL queries, filtering, stats
        └── block-poller.test.ts    # 8 tests: batch processing, log grouping
```

---

## Quick Start

### 1. Install Dependencies

```bash
cd ink-indexer
npm install
```

### 2. Start PostgreSQL

Using Docker Compose:

```bash
docker compose up -d
```

Or if using Colima (lightweight Docker alternative for macOS):

```bash
colima start
docker compose up -d
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Default `.env` values:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ink_indexer"
RPC_URL="https://rpc-gel.inkonchain.com"
START_BLOCK=18000000
POLL_INTERVAL_MS=12000
PORT=4000
GRAPHQL_PATH="/graphql"
LOG_LEVEL="info"
```

### 4. Generate Prisma Client & Run Migrations

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 5. Start the Indexer

```bash
# Development (hot-reload)
npm run dev

# Production
npm run build
npm start
```

### 6. Verify It's Working

```bash
# Health check
curl http://localhost:4000/health

# Query recent transfers
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ transfers(first: 5) { id blockNumber from to value tokenAddress } }"}' | jq

# Query recent swaps
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ swaps(first: 5) { id blockNumber poolAddress sender recipient amount0In amount1Out } }"}' | jq

# Query stats
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ stats { totalEvents totalTransfers totalSwaps latestBlock } }"}' | jq

# Query indexer status
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ status { isIndexing lastBlockNumber errorCount uptime } }"}' | jq

# Filter transfers by address
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ transfers(first: 10, to: \"0x1234...\") { from to value } }"}' | jq

# Filter swaps by pool
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ swaps(first: 10, poolAddress: \"0xABCD...\") { sender recipient amount0In amount1Out } }"}' | jq

# Filter events by type
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ events(first: 10, type: ERC20_TRANSFER) { ... on ERC20Transfer { from to value } } }"}' | jq
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot-reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm test` | Run all tests (60 tests) |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:studio` | Open Prisma Studio GUI |

---

## Testing

### Run All Tests

```bash
npm test
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Run Specific Test Files

```bash
# Unit tests only
npx vitest run tests/unit/

# Integration tests only
npx vitest run tests/integration/

# Single test file
npx vitest run tests/unit/event-decoder.test.ts
```

### Watch Mode

```bash
npx vitest
```

### Test Summary (60 tests)

**Unit Tests (27 tests):**

| File | Tests | What's Covered |
|------|-------|----------------|
| `event-decoder.test.ts` | 13 | ERC-20 Transfer decoding, V2 Swap decoding, V3 Swap decoding (signed amounts to in/out), unknown events, malformed data, null field handling |
| `retry.test.ts` | 8 | First-attempt success, retry on failure, max retries exceeded, exponential backoff timing, custom error preservation, zero-retry mode |
| `event-emitter.test.ts` | 6 | Subscribe/emit, multiple subscribers, unsubscribe, error isolation between listeners, mixed event types, no-subscriber emit |

**Integration Tests (33 tests):**

| File | Tests | What's Covered |
|------|-------|----------------|
| `storage.test.ts` | 13 | Atomic transaction writes (transfers, swaps, mixed, unknown), empty events, DB failure propagation, BigInt/Date serialization, query filtering by address/pool, combined event sorting, stats aggregation |
| `resolvers.test.ts` | 12 | GraphQL query resolution (events, transfers, swaps, stats, status), type filtering (ERC20_TRANSFER, SWAP), address/pool filtering, default pagination, BigInt-to-string serialization, subscription setup |
| `block-poller.test.ts` | 8 | Constructor initialization, block number tracking, log grouping by block, batch processing with mocked viem client, no-new-blocks skip behavior |

---

## Database Schema

Three tables with dual-storage pattern (raw logs + typed tables):

```
event_logs           — Complete audit trail of all raw blockchain logs
erc20_transfers      — Decoded ERC-20 Transfer events
swaps                — Decoded Uniswap V2/V3 Swap events
```

Indexed fields: `blockNumber`, `transactionHash`, `address`, `to`, `tokenAddress`, `poolAddress`, `recipient`

### Prisma Commands

```bash
# View database in browser
npx prisma studio

# Create a new migration
npx prisma migrate dev --name <migration-name>

# Reset database (destructive)
npx prisma migrate reset

# Check migration status
npx prisma migrate status
```

---

## GraphQL Schema

```graphql
type Query {
  events(first: Int, after: String, type: EventType): [Event!]!
  transfers(first: Int, after: String, to: String): [ERC20Transfer!]!
  swaps(first: Int, after: String, poolAddress: String): [Swap!]!
  stats: Stats!
  status: IndexerStatus!
}

type Subscription {
  newEvents: Event!
}

union Event = ERC20Transfer | Swap
enum EventType { ERC20_TRANSFER, SWAP }
```

GraphQL Playground available at: `http://localhost:4000/graphql` (introspection enabled)

---

## Architecture

```
Ink Chain (RPC)
    |
    v
BlockPoller ---- polls every 12s, batches of 100 blocks
    |              uses exponential retry (3 retries, 1s base)
    v
EventDecoder --- tries ERC-20 -> V2 Swap -> V3 Swap -> unknown
    |              decodes via viem's decodeEventLog
    v
EventStorage --- Prisma $transaction (atomic)
    |              writes to: event_logs + erc20_transfers/swaps
    v
IndexerEventEmitter --- in-memory PubSub
    |
    |-->  GraphQL Subscriptions (newEvents)
    |-->  REST /health endpoint
```

**Key patterns:**
- **Dual storage:** Raw logs for audit trail + typed tables for fast queries
- **Atomic writes:** Prisma transactions ensure consistency across tables
- **Exponential retry:** RPC calls retry with backoff (1s -> 2s -> 4s, max 30s)
- **Batch processing:** 100 blocks per getLogs call, logs grouped by block
- **Graceful shutdown:** SIGTERM/SIGINT handlers stop poller, close DB, drain HTTP

---

## Shutting Down

```bash
# Stop the indexer (Ctrl+C if running in foreground, or):
lsof -ti:4000 | xargs kill

# Stop PostgreSQL
docker compose down

# Stop Colima (if using)
colima stop
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Polling over WebSocket subscriptions | More reliable, no silent drops, guaranteed no missed blocks |
| Dual storage (raw + typed) | Raw logs for audit/flexibility, typed tables for fast queries |
| viem over ethers.js | TypeScript-first, lighter, modern API |
| PostgreSQL over MongoDB | ACID transactions, relational data, Prisma type safety |
| BigInt stored as String in GraphQL | GraphQL has no native BigInt type; string avoids precision loss |
| 12s poll interval | ~4 Ethereum blocks, good latency/load balance |
| Batch size of 100 blocks | Balance between throughput and RPC rate limits |
