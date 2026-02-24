import { decodeEventLog, type Log, type Abi, type Address } from 'viem';
import { logger } from '../lib/logger.js';
import type { DecodedEvent, ERC20TransferData, SwapData } from '../types/events.js';

// ERC-20 Transfer event ABI
const ERC20_TRANSFER_ABI = [
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { type: 'address', name: 'from', indexed: true },
      { type: 'address', name: 'to', indexed: true },
      { type: 'uint256', name: 'value', indexed: false },
    ],
  },
] as const;

// Uniswap V2/PancakeSwap Swap event ABI
const SWAP_ABI = [
  {
    type: 'event',
    name: 'Swap',
    inputs: [
      { type: 'address', name: 'sender', indexed: true },
      { type: 'uint256', name: 'amount0In', indexed: false },
      { type: 'uint256', name: 'amount1In', indexed: false },
      { type: 'uint256', name: 'amount0Out', indexed: false },
      { type: 'uint256', name: 'amount1Out', indexed: false },
      { type: 'address', name: 'to', indexed: true },
    ],
  },
] as const;

// Uniswap V3 Swap event ABI (different signature)
const SWAP_V3_ABI = [
  {
    type: 'event',
    name: 'Swap',
    inputs: [
      { type: 'address', name: 'sender', indexed: true },
      { type: 'address', name: 'recipient', indexed: true },
      { type: 'int256', name: 'amount0', indexed: false },
      { type: 'int256', name: 'amount1', indexed: false },
      { type: 'uint256', name: 'sqrtPriceX96', indexed: false },
      { type: 'uint128', name: 'liquidity', indexed: false },
      { type: 'int24', name: 'tick', indexed: false },
    ],
  },
] as const;

export class EventDecoder {
  /**
   * Decode a single log into a structured event
   */
  decode(log: Log, blockTimestamp: Date): DecodedEvent {
    // Try ERC-20 Transfer first (most common)
    const erc20Transfer = this.tryDecodeERC20Transfer(log, blockTimestamp);
    if (erc20Transfer) {
      return { type: 'erc20-transfer', data: erc20Transfer };
    }

    // Try Uniswap V2/PancakeSwap Swap
    const swap = this.tryDecodeSwapV2(log, blockTimestamp);
    if (swap) {
      return { type: 'swap', data: swap };
    }

    // Try Uniswap V3 Swap
    const swapV3 = this.tryDecodeSwapV3(log, blockTimestamp);
    if (swapV3) {
      return { type: 'swap', data: swapV3 };
    }

    // Unknown event type
    return { type: 'unknown', log };
  }

  /**
   * Try to decode as ERC-20 Transfer
   */
  private tryDecodeERC20Transfer(
    log: Log,
    blockTimestamp: Date
  ): ERC20TransferData | null {
    try {
      const decoded = decodeEventLog({
        abi: ERC20_TRANSFER_ABI,
        data: log.data,
        topics: log.topics as any,
      });

      if (decoded.eventName === 'Transfer') {
        return {
          from: decoded.args.from as Address,
          to: decoded.args.to as Address,
          value: (decoded.args.value as bigint).toString(),
          tokenAddress: log.address,
          transactionHash: log.transactionHash || '',
          logIndex: log.logIndex ?? 0,
          blockNumber: log.blockNumber ?? 0n,
          blockTimestamp,
        };
      }
    } catch {
      // Not an ERC-20 Transfer, continue
    }
    return null;
  }

  /**
   * Try to decode as Uniswap V2/PancakeSwap Swap
   */
  private tryDecodeSwapV2(log: Log, blockTimestamp: Date): SwapData | null {
    try {
      const decoded = decodeEventLog({
        abi: SWAP_ABI,
        data: log.data,
        topics: log.topics as any,
      });

      if (decoded.eventName === 'Swap') {
        const amount0In = (decoded.args.amount0In as bigint);
        const amount1In = (decoded.args.amount1In as bigint);
        const amount0Out = (decoded.args.amount0Out as bigint);
        const amount1Out = (decoded.args.amount1Out as bigint);

        return {
          poolAddress: log.address,
          sender: decoded.args.sender as Address,
          recipient: decoded.args.to as Address,
          amount0In: amount0In > 0n ? amount0In.toString() : '0',
          amount1In: amount1In > 0n ? amount1In.toString() : '0',
          amount0Out: amount0Out > 0n ? amount0Out.toString() : '0',
          amount1Out: amount1Out > 0n ? amount1Out.toString() : '0',
          transactionHash: log.transactionHash || '',
          logIndex: log.logIndex ?? 0,
          blockNumber: log.blockNumber ?? 0n,
          blockTimestamp,
        };
      }
    } catch {
      // Not a V2 Swap, continue
    }
    return null;
  }

  /**
   * Try to decode as Uniswap V3 Swap
   */
  private tryDecodeSwapV3(log: Log, blockTimestamp: Date): SwapData | null {
    try {
      const decoded = decodeEventLog({
        abi: SWAP_V3_ABI,
        data: log.data,
        topics: log.topics as any,
      });

      if (decoded.eventName === 'Swap') {
        const amount0 = decoded.args.amount0 as bigint;
        const amount1 = decoded.args.amount1 as bigint;

        return {
          poolAddress: log.address,
          sender: decoded.args.sender as Address,
          recipient: decoded.args.recipient as Address,
          amount0In: amount0 < 0n ? (-amount0).toString() : '0',
          amount1In: amount1 < 0n ? (-amount1).toString() : '0',
          amount0Out: amount0 > 0n ? amount0.toString() : '0',
          amount1Out: amount1 > 0n ? amount1.toString() : '0',
          transactionHash: log.transactionHash || '',
          logIndex: log.logIndex ?? 0,
          blockNumber: log.blockNumber ?? 0n,
          blockTimestamp,
        };
      }
    } catch {
      // Not a V3 Swap, continue
    }
    return null;
  }
}
