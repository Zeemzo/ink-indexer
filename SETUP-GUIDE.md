# Ink Indexer - Setup Guide

> Project setup and development guide

---

## 📁 Files Created

### Configuration
- ✅ `package.json` - Dependencies and scripts
- ✅ `tsconfig.json` - TypeScript configuration
- ✅ `.env.example` - Environment variables template
- ✅ `.gitignore` - Git ignore rules
- ✅ `docker-compose.yml` - PostgreSQL setup

### Database
- ✅ `prisma/schema.prisma` - Database schema (EventLog, ERC20Transfer, Swap)

### Core Application
- ✅ `src/config/env.ts` - Environment configuration
- ✅ `src/types/events.ts` - TypeScript types
- ✅ `src/lib/logger.ts` - Pino logger
- ✅ `src/lib/prisma.ts` - Prisma client singleton
- ✅ `src/lib/retry.ts` - Exponential backoff retry
- ✅ `src/lib/health.ts` - Health check utilities

### Indexer
- ✅ `src/indexer/block-poller.ts` - Block polling with retry
- ✅ `src/indexer/event-decoder.ts` - ABI event decoding
- ✅ `src/indexer/storage.ts` - Database operations
- ✅ `src/indexer/index.ts` - Main orchestrator

### API
- ✅ `src/api/graphql/schema.ts` - GraphQL schema
- ✅ `src/api/graphql/resolvers.ts` - Query resolvers
- ✅ `src/api/graphql/server.ts` - Apollo Server setup

### Entry Point
- ✅ `src/index.ts` - Main application entry point

---

## 🚀 Next Steps to Run the Project

### Step 1: Install Dependencies

```bash
cd ink-indexer
npm install
```

### Step 2: Start PostgreSQL

```bash
docker compose up -d
```

### Step 3: Setup Environment

```bash
cp .env.example .env
```

Edit `.env` if needed (defaults should work for local dev)

### Step 4: Generate Prisma Client & Run Migrations

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### Step 5: Start Development Server

```bash
npm run dev
```

### Step 6: Test the API

```bash
# Health check
curl http://localhost:4000/health

# GraphQL query
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ status { isIndexing lastBlockNumber } }"}'
```

---

## 🎯 What This Project Covers

| Pattern | File | Description |
|---------|------|-------------|
| **Blockchain Polling** | `block-poller.ts` | Poll blocks with exponential backoff |
| **Event Decoding** | `event-decoder.ts` | Decode ERC-20 Transfers, Swaps |
| **Database Storage** | `storage.ts` | Prisma operations, atomic transactions |
| **GraphQL API** | `schema.ts`, `resolvers.ts` | Queries for events, transfers, swaps |
| **Type Safety** | All `.ts` files | TypeScript throughout |
| **Error Handling** | `retry.ts` | Exponential backoff retry |
| **Health Checks** | `health.ts`, `/health` | Health monitoring |
| **Docker** | `docker-compose.yml` | PostgreSQL container |

---

## 📝 Known Issues / TODO

1. **WebSocket Subscription** - The graphql-ws implementation needs testing
2. **Tests** - Unit and integration tests added (60 tests across 6 files)
3. **Block Reorg Handling** - Not implemented (would add for production)
4. **Backpressure** - Not implemented (would add for high-throughput)

These are known limitations — would be addressed in a production implementation.

---

## 💡 Key Things to Understand

### 1. Why Polling vs WebSocket Subscriptions?
```typescript
// Polling is more reliable
// WebSocket subscriptions can drop silently
// 12 seconds = ~4 Ethereum blocks
```

### 2. Why Dual Storage?
```typescript
// Generic logs: Complete audit trail, flexibility
// Typed tables: Fast queries, type safety, business logic
```

### 3. How Events Flow?
```
Block Poll → Get Logs → Decode → Store in DB → Emit to WebSocket
```

---

## Architecture Highlights

- **Blockchain Polling** with exponential backoff retry for RPC reliability
- **Dual Storage** pattern: raw event logs + typed tables for fast queries
- **GraphQL API** with real-time WebSocket streaming
- **Atomic Transactions** for data integrity across related writes
- **Type Safety** throughout with TypeScript and Prisma
