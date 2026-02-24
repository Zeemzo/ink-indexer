// Ensure env vars are set for tests
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ink_indexer_test';
process.env.RPC_URL = process.env.RPC_URL || 'https://rpc-gel.inkonchain.com';
process.env.LOG_LEVEL = 'silent';
