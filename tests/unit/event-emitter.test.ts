import { describe, it, expect, vi } from 'vitest';
import { IndexerEventEmitter } from '../../src/indexer/index.js';
import type { DecodedEvent } from '../../src/types/events.js';

const mockTransferEvent: DecodedEvent = {
  type: 'erc20-transfer',
  data: {
    from: '0x1111111111111111111111111111111111111111',
    to: '0x2222222222222222222222222222222222222222',
    value: '1000000000000000000',
    tokenAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    transactionHash: '0xabcdef',
    logIndex: 0,
    blockNumber: 18000100n,
    blockTimestamp: new Date('2024-01-15T12:00:00Z'),
  },
};

const mockSwapEvent: DecodedEvent = {
  type: 'swap',
  data: {
    poolAddress: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    sender: '0x3333333333333333333333333333333333333333',
    recipient: '0x4444444444444444444444444444444444444444',
    amount0In: '1000000',
    amount1In: '0',
    amount0Out: '0',
    amount1Out: '500000',
    transactionHash: '0xabcdef',
    logIndex: 1,
    blockNumber: 18000100n,
    blockTimestamp: new Date('2024-01-15T12:00:00Z'),
  },
};

describe('IndexerEventEmitter', () => {
  it('should notify subscribers when an event is emitted', () => {
    const emitter = new IndexerEventEmitter();
    const callback = vi.fn();

    emitter.subscribe(callback);
    emitter.emit(mockTransferEvent);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(mockTransferEvent);
  });

  it('should notify multiple subscribers', () => {
    const emitter = new IndexerEventEmitter();
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const callback3 = vi.fn();

    emitter.subscribe(callback1);
    emitter.subscribe(callback2);
    emitter.subscribe(callback3);

    emitter.emit(mockSwapEvent);

    expect(callback1).toHaveBeenCalledWith(mockSwapEvent);
    expect(callback2).toHaveBeenCalledWith(mockSwapEvent);
    expect(callback3).toHaveBeenCalledWith(mockSwapEvent);
  });

  it('should allow unsubscribing', () => {
    const emitter = new IndexerEventEmitter();
    const callback = vi.fn();

    const unsubscribe = emitter.subscribe(callback);
    emitter.emit(mockTransferEvent);
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
    emitter.emit(mockTransferEvent);
    // Should still be 1 — not called after unsubscribe
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should handle errors in listeners without affecting other listeners', () => {
    const emitter = new IndexerEventEmitter();
    const errorCallback = vi.fn().mockImplementation(() => {
      throw new Error('listener error');
    });
    const goodCallback = vi.fn();

    emitter.subscribe(errorCallback);
    emitter.subscribe(goodCallback);

    // Should not throw
    emitter.emit(mockTransferEvent);

    expect(errorCallback).toHaveBeenCalledTimes(1);
    expect(goodCallback).toHaveBeenCalledTimes(1);
  });

  it('should emit different event types', () => {
    const emitter = new IndexerEventEmitter();
    const receivedEvents: DecodedEvent[] = [];

    emitter.subscribe((event) => {
      receivedEvents.push(event);
    });

    emitter.emit(mockTransferEvent);
    emitter.emit(mockSwapEvent);

    expect(receivedEvents).toHaveLength(2);
    expect(receivedEvents[0].type).toBe('erc20-transfer');
    expect(receivedEvents[1].type).toBe('swap');
  });

  it('should handle emitting with no subscribers', () => {
    const emitter = new IndexerEventEmitter();

    // Should not throw
    expect(() => emitter.emit(mockTransferEvent)).not.toThrow();
  });
});
