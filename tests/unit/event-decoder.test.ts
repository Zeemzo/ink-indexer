import { describe, it, expect } from 'vitest';
import { encodeEventTopics, encodeAbiParameters, type Log } from 'viem';
import { EventDecoder } from '../../src/indexer/event-decoder.js';

// ABI definitions matching the decoder
const ERC20_TRANSFER_ABI = [
  {
    type: 'event' as const,
    name: 'Transfer' as const,
    inputs: [
      { type: 'address' as const, name: 'from' as const, indexed: true },
      { type: 'address' as const, name: 'to' as const, indexed: true },
      { type: 'uint256' as const, name: 'value' as const, indexed: false },
    ],
  },
] as const;

const SWAP_V2_ABI = [
  {
    type: 'event' as const,
    name: 'Swap' as const,
    inputs: [
      { type: 'address' as const, name: 'sender' as const, indexed: true },
      { type: 'uint256' as const, name: 'amount0In' as const, indexed: false },
      { type: 'uint256' as const, name: 'amount1In' as const, indexed: false },
      { type: 'uint256' as const, name: 'amount0Out' as const, indexed: false },
      { type: 'uint256' as const, name: 'amount1Out' as const, indexed: false },
      { type: 'address' as const, name: 'to' as const, indexed: true },
    ],
  },
] as const;

const SWAP_V3_ABI = [
  {
    type: 'event' as const,
    name: 'Swap' as const,
    inputs: [
      { type: 'address' as const, name: 'sender' as const, indexed: true },
      { type: 'address' as const, name: 'recipient' as const, indexed: true },
      { type: 'int256' as const, name: 'amount0' as const, indexed: false },
      { type: 'int256' as const, name: 'amount1' as const, indexed: false },
      { type: 'uint256' as const, name: 'sqrtPriceX96' as const, indexed: false },
      { type: 'uint128' as const, name: 'liquidity' as const, indexed: false },
      { type: 'int24' as const, name: 'tick' as const, indexed: false },
    ],
  },
] as const;

const MOCK_ADDRESSES = {
  from: '0x1111111111111111111111111111111111111111' as const,
  to: '0x2222222222222222222222222222222222222222' as const,
  token: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as const,
  pool: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' as const,
  sender: '0x3333333333333333333333333333333333333333' as const,
  recipient: '0x4444444444444444444444444444444444444444' as const,
};

const BLOCK_TIMESTAMP = new Date('2024-01-15T12:00:00Z');
const BLOCK_NUMBER = 18000100n;
const TX_HASH = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

/** Helper to encode an ERC-20 Transfer log */
function encodeTransferLog(from: `0x${string}`, to: `0x${string}`, value: bigint) {
  const topics = encodeEventTopics({
    abi: ERC20_TRANSFER_ABI,
    eventName: 'Transfer',
    args: { from, to },
  });
  const data = encodeAbiParameters(
    [{ type: 'uint256' }],
    [value]
  );
  return { topics, data };
}

/** Helper to encode a V2 Swap log */
function encodeV2SwapLog(
  sender: `0x${string}`,
  to: `0x${string}`,
  amounts: { amount0In: bigint; amount1In: bigint; amount0Out: bigint; amount1Out: bigint }
) {
  const topics = encodeEventTopics({
    abi: SWAP_V2_ABI,
    eventName: 'Swap',
    args: { sender, to },
  });
  const data = encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
    [amounts.amount0In, amounts.amount1In, amounts.amount0Out, amounts.amount1Out]
  );
  return { topics, data };
}

/** Helper to encode a V3 Swap log */
function encodeV3SwapLog(
  sender: `0x${string}`,
  recipient: `0x${string}`,
  params: { amount0: bigint; amount1: bigint; sqrtPriceX96: bigint; liquidity: bigint; tick: number }
) {
  const topics = encodeEventTopics({
    abi: SWAP_V3_ABI,
    eventName: 'Swap',
    args: { sender, recipient },
  });
  const data = encodeAbiParameters(
    [{ type: 'int256' }, { type: 'int256' }, { type: 'uint256' }, { type: 'uint128' }, { type: 'int24' }],
    [params.amount0, params.amount1, params.sqrtPriceX96, params.liquidity, params.tick]
  );
  return { topics, data };
}

function createMockLog(overrides: Partial<Log> & { topics: `0x${string}`[]; data: `0x${string}` }): Log {
  return {
    address: MOCK_ADDRESSES.token,
    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000001',
    blockNumber: BLOCK_NUMBER,
    data: overrides.data,
    logIndex: 0,
    transactionHash: TX_HASH,
    transactionIndex: 0,
    removed: false,
    topics: overrides.topics,
    ...overrides,
  };
}

describe('EventDecoder', () => {
  const decoder = new EventDecoder();

  describe('ERC-20 Transfer decoding', () => {
    it('should decode a valid ERC-20 Transfer event', () => {
      const { topics, data } = encodeTransferLog(
        MOCK_ADDRESSES.from,
        MOCK_ADDRESSES.to,
        1000000000000000000n
      );

      const log = createMockLog({
        address: MOCK_ADDRESSES.token,
        topics: topics as `0x${string}`[],
        data,
      });

      const result = decoder.decode(log, BLOCK_TIMESTAMP);

      expect(result.type).toBe('erc20-transfer');
      if (result.type === 'erc20-transfer') {
        expect(result.data.from).toBe(MOCK_ADDRESSES.from);
        expect(result.data.to).toBe(MOCK_ADDRESSES.to);
        expect(result.data.value).toBe('1000000000000000000');
        expect(result.data.tokenAddress).toBe(MOCK_ADDRESSES.token);
        expect(result.data.transactionHash).toBe(TX_HASH);
        expect(result.data.logIndex).toBe(0);
        expect(result.data.blockNumber).toBe(BLOCK_NUMBER);
        expect(result.data.blockTimestamp).toBe(BLOCK_TIMESTAMP);
      }
    });

    it('should decode a Transfer with zero value', () => {
      const { topics, data } = encodeTransferLog(
        MOCK_ADDRESSES.from,
        MOCK_ADDRESSES.to,
        0n
      );

      const log = createMockLog({
        address: MOCK_ADDRESSES.token,
        topics: topics as `0x${string}`[],
        data,
      });

      const result = decoder.decode(log, BLOCK_TIMESTAMP);
      expect(result.type).toBe('erc20-transfer');
      if (result.type === 'erc20-transfer') {
        expect(result.data.value).toBe('0');
      }
    });

    it('should decode a Transfer with very large value (uint256 max)', () => {
      const largeValue = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;
      const { topics, data } = encodeTransferLog(
        MOCK_ADDRESSES.from,
        MOCK_ADDRESSES.to,
        largeValue
      );

      const log = createMockLog({
        address: MOCK_ADDRESSES.token,
        topics: topics as `0x${string}`[],
        data,
      });

      const result = decoder.decode(log, BLOCK_TIMESTAMP);
      expect(result.type).toBe('erc20-transfer');
      if (result.type === 'erc20-transfer') {
        expect(result.data.value).toBe(largeValue.toString());
      }
    });
  });

  describe('Uniswap V2 Swap decoding', () => {
    it('should decode a V2 Swap event (token0 in, token1 out)', () => {
      const { topics, data } = encodeV2SwapLog(
        MOCK_ADDRESSES.sender,
        MOCK_ADDRESSES.recipient,
        { amount0In: 1000000n, amount1In: 0n, amount0Out: 0n, amount1Out: 500000n }
      );

      const log = createMockLog({
        address: MOCK_ADDRESSES.pool,
        topics: topics as `0x${string}`[],
        data,
      });

      const result = decoder.decode(log, BLOCK_TIMESTAMP);

      expect(result.type).toBe('swap');
      if (result.type === 'swap') {
        expect(result.data.poolAddress).toBe(MOCK_ADDRESSES.pool);
        expect(result.data.sender).toBe(MOCK_ADDRESSES.sender);
        expect(result.data.recipient).toBe(MOCK_ADDRESSES.recipient);
        expect(result.data.amount0In).toBe('1000000');
        expect(result.data.amount1In).toBe('0');
        expect(result.data.amount0Out).toBe('0');
        expect(result.data.amount1Out).toBe('500000');
        expect(result.data.transactionHash).toBe(TX_HASH);
        expect(result.data.blockNumber).toBe(BLOCK_NUMBER);
      }
    });

    it('should decode a V2 Swap event (token1 in, token0 out)', () => {
      const { topics, data } = encodeV2SwapLog(
        MOCK_ADDRESSES.sender,
        MOCK_ADDRESSES.recipient,
        { amount0In: 0n, amount1In: 2000000n, amount0Out: 1000000n, amount1Out: 0n }
      );

      const log = createMockLog({
        address: MOCK_ADDRESSES.pool,
        topics: topics as `0x${string}`[],
        data,
      });

      const result = decoder.decode(log, BLOCK_TIMESTAMP);

      expect(result.type).toBe('swap');
      if (result.type === 'swap') {
        expect(result.data.amount0In).toBe('0');
        expect(result.data.amount1In).toBe('2000000');
        expect(result.data.amount0Out).toBe('1000000');
        expect(result.data.amount1Out).toBe('0');
      }
    });
  });

  describe('Uniswap V3 Swap decoding', () => {
    it('should decode a V3 Swap with negative amount0 (token0 in) and positive amount1 (token1 out)', () => {
      const { topics, data } = encodeV3SwapLog(
        MOCK_ADDRESSES.sender,
        MOCK_ADDRESSES.recipient,
        {
          amount0: -500000n,
          amount1: 1000000n,
          sqrtPriceX96: 79228162514264337593543950336n,
          liquidity: 1000000000n,
          tick: 0,
        }
      );

      const log = createMockLog({
        address: MOCK_ADDRESSES.pool,
        topics: topics as `0x${string}`[],
        data,
      });

      const result = decoder.decode(log, BLOCK_TIMESTAMP);

      expect(result.type).toBe('swap');
      if (result.type === 'swap') {
        expect(result.data.poolAddress).toBe(MOCK_ADDRESSES.pool);
        expect(result.data.sender).toBe(MOCK_ADDRESSES.sender);
        expect(result.data.recipient).toBe(MOCK_ADDRESSES.recipient);
        expect(result.data.amount0In).toBe('500000');
        expect(result.data.amount1In).toBe('0');
        expect(result.data.amount0Out).toBe('0');
        expect(result.data.amount1Out).toBe('1000000');
      }
    });

    it('should decode a V3 Swap with positive amount0 (token0 out) and negative amount1 (token1 in)', () => {
      const { topics, data } = encodeV3SwapLog(
        MOCK_ADDRESSES.sender,
        MOCK_ADDRESSES.recipient,
        {
          amount0: 750000n,
          amount1: -300000n,
          sqrtPriceX96: 79228162514264337593543950336n,
          liquidity: 1000000000n,
          tick: -100,
        }
      );

      const log = createMockLog({
        address: MOCK_ADDRESSES.pool,
        topics: topics as `0x${string}`[],
        data,
      });

      const result = decoder.decode(log, BLOCK_TIMESTAMP);

      expect(result.type).toBe('swap');
      if (result.type === 'swap') {
        expect(result.data.amount0In).toBe('0');
        expect(result.data.amount1In).toBe('300000');
        expect(result.data.amount0Out).toBe('750000');
        expect(result.data.amount1Out).toBe('0');
      }
    });
  });

  describe('Unknown event handling', () => {
    it('should return unknown for unrecognized log topics', () => {
      const log = createMockLog({
        topics: ['0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'],
        data: '0x0000000000000000000000000000000000000000000000000000000000000001',
      });

      const result = decoder.decode(log, BLOCK_TIMESTAMP);

      expect(result.type).toBe('unknown');
      if (result.type === 'unknown') {
        expect(result.log).toBe(log);
      }
    });

    it('should return unknown for empty topics', () => {
      const log = createMockLog({
        topics: [],
        data: '0x',
      });

      const result = decoder.decode(log, BLOCK_TIMESTAMP);
      expect(result.type).toBe('unknown');
    });

    it('should return unknown for malformed data with Transfer topic', () => {
      const log = createMockLog({
        topics: [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        ],
        data: '0xdeadbeef',
      });

      const result = decoder.decode(log, BLOCK_TIMESTAMP);
      expect(result.type).toBe('unknown');
    });
  });

  describe('Field extraction edge cases', () => {
    it('should handle null transactionHash gracefully', () => {
      const { topics, data } = encodeTransferLog(
        MOCK_ADDRESSES.from,
        MOCK_ADDRESSES.to,
        100n
      );

      const log = createMockLog({
        address: MOCK_ADDRESSES.token,
        topics: topics as `0x${string}`[],
        data,
        transactionHash: null as any,
      });

      const result = decoder.decode(log, BLOCK_TIMESTAMP);
      expect(result.type).toBe('erc20-transfer');
      if (result.type === 'erc20-transfer') {
        expect(result.data.transactionHash).toBe('');
      }
    });

    it('should handle null logIndex gracefully', () => {
      const { topics, data } = encodeTransferLog(
        MOCK_ADDRESSES.from,
        MOCK_ADDRESSES.to,
        100n
      );

      const log = createMockLog({
        address: MOCK_ADDRESSES.token,
        topics: topics as `0x${string}`[],
        data,
        logIndex: null as any,
      });

      const result = decoder.decode(log, BLOCK_TIMESTAMP);
      expect(result.type).toBe('erc20-transfer');
      if (result.type === 'erc20-transfer') {
        expect(result.data.logIndex).toBe(0);
      }
    });

    it('should handle null blockNumber gracefully', () => {
      const { topics, data } = encodeTransferLog(
        MOCK_ADDRESSES.from,
        MOCK_ADDRESSES.to,
        100n
      );

      const log = createMockLog({
        address: MOCK_ADDRESSES.token,
        topics: topics as `0x${string}`[],
        data,
        blockNumber: null as any,
      });

      const result = decoder.decode(log, BLOCK_TIMESTAMP);
      expect(result.type).toBe('erc20-transfer');
      if (result.type === 'erc20-transfer') {
        expect(result.data.blockNumber).toBe(0n);
      }
    });
  });
});
