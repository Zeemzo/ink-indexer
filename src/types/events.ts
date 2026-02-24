import type { Log } from 'viem';

export type DecodedEvent =
  | { type: 'erc20-transfer'; data: ERC20TransferData }
  | { type: 'swap'; data: SwapData }
  | { type: 'unknown'; log: Log };

export interface ERC20TransferData {
  from: string;
  to: string;
  value: string;
  tokenAddress: string;
  transactionHash: string;
  logIndex: number;
  blockNumber: bigint;
  blockTimestamp: Date;
}

export interface SwapData {
  poolAddress: string;
  sender: string;
  recipient: string;
  amount0In: string;
  amount1In: string;
  amount0Out: string;
  amount1Out: string;
  transactionHash: string;
  logIndex: number;
  blockNumber: bigint;
  blockTimestamp: Date;
}

export interface IndexerState {
  lastBlockNumber: bigint;
  isIndexing: boolean;
  lastError?: string;
  errorCount: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  indexer: IndexerState;
  databaseConnected: boolean;
  chainConnected: boolean;
  latestBlockNumber?: bigint;
}
