import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import type { DecodedEvent, ERC20TransferData, SwapData } from '../types/events.js';

/** Convert BigInt and Date fields to strings for GraphQL serialization */
function serialize(row: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'bigint') {
      result[key] = value.toString();
    } else if (value instanceof Date) {
      result[key] = value.toISOString();
    } else {
      result[key] = value;
    }
  }
  return result;
}

export class EventStorage {
  /**
   * Save all events from a block atomically
   */
  async saveBlockEvents(
    blockNumber: bigint,
    blockTimestamp: Date,
    events: DecodedEvent[]
  ): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        for (const event of events) {
          if (event.type === 'erc20-transfer') {
            await tx.eventLog.create({
              data: {
                blockNumber,
                blockTimestamp,
                transactionHash: event.data.transactionHash || '',
                logIndex: event.data.logIndex || 0,
                address: event.data.tokenAddress || '0x',
                topics: [],
                data: '0x',
              },
            });
            await this.saveERC20Transfer(tx, event.data);
          } else if (event.type === 'swap') {
            await tx.eventLog.create({
              data: {
                blockNumber,
                blockTimestamp,
                transactionHash: event.data.transactionHash || '',
                logIndex: event.data.logIndex || 0,
                address: event.data.poolAddress || '0x',
                topics: [],
                data: '0x',
              },
            });
            await this.saveSwap(tx, event.data);
          } else if (event.type === 'unknown' && event.log) {
            await tx.eventLog.create({
              data: {
                blockNumber,
                blockTimestamp,
                transactionHash: event.log.transactionHash || '',
                logIndex: event.log.logIndex || 0,
                address: event.log.address || '0x',
                topics: (event.log.topics as string[]) || [],
                data: event.log.data || '0x',
              },
            });
          }
        }
      });

      logger.info(
        { blockNumber, eventCount: events.length },
        'Saved block events successfully'
      );
    } catch (error) {
      logger.error({ error, blockNumber }, 'Failed to save block events');
      throw error;
    }
  }

  private async saveERC20Transfer(tx: any, data: ERC20TransferData): Promise<void> {
    await tx.eRC20Transfer.create({
      data: {
        blockNumber: data.blockNumber,
        blockTimestamp: data.blockTimestamp,
        transactionHash: data.transactionHash,
        logIndex: data.logIndex,
        from: data.from,
        to: data.to,
        value: data.value,
        tokenAddress: data.tokenAddress,
      },
    });
  }

  private async saveSwap(tx: any, data: SwapData): Promise<void> {
    await tx.swap.create({
      data: {
        blockNumber: data.blockNumber,
        blockTimestamp: data.blockTimestamp,
        transactionHash: data.transactionHash,
        logIndex: data.logIndex,
        poolAddress: data.poolAddress,
        sender: data.sender,
        recipient: data.recipient,
        amount0In: data.amount0In,
        amount1In: data.amount1In,
        amount0Out: data.amount0Out,
        amount1Out: data.amount1Out,
      },
    });
  }

  async getRecentTransfers(limit: number = 10): Promise<any[]> {
    const rows = await prisma.eRC20Transfer.findMany({
      take: limit,
      orderBy: { blockNumber: 'desc' },
    });
    return rows.map(serialize);
  }

  async getRecentSwaps(limit: number = 10): Promise<any[]> {
    const rows = await prisma.swap.findMany({
      take: limit,
      orderBy: { blockNumber: 'desc' },
    });
    return rows.map(serialize);
  }

  async getRecentEvents(limit: number = 10): Promise<any[]> {
    const [transfers, swaps] = await Promise.all([
      this.getRecentTransfers(limit),
      this.getRecentSwaps(limit),
    ]);

    const allEvents = [
      ...transfers.map((t) => ({ ...t, __typename: 'ERC20Transfer' })),
      ...swaps.map((s) => ({ ...s, __typename: 'Swap' })),
    ];

    return allEvents
      .sort((a, b) => Number(BigInt(b.blockNumber) - BigInt(a.blockNumber)))
      .slice(0, limit);
  }

  async getTransfersByAddress(address: string, limit: number = 50): Promise<any[]> {
    const rows = await prisma.eRC20Transfer.findMany({
      where: {
        OR: [{ from: address }, { to: address }],
      },
      take: limit,
      orderBy: { blockNumber: 'desc' },
    });
    return rows.map(serialize);
  }

  async getSwapsByPool(poolAddress: string, limit: number = 50): Promise<any[]> {
    const rows = await prisma.swap.findMany({
      where: { poolAddress },
      take: limit,
      orderBy: { blockNumber: 'desc' },
    });
    return rows.map(serialize);
  }

  async getStats(): Promise<{
    totalEvents: bigint;
    totalTransfers: bigint;
    totalSwaps: bigint;
    latestBlock: bigint;
  }> {
    const [events, transfers, swaps, latestLog] = await Promise.all([
      prisma.eventLog.count(),
      prisma.eRC20Transfer.count(),
      prisma.swap.count(),
      prisma.eventLog.findFirst({ orderBy: { blockNumber: 'desc' } }),
    ]);

    return {
      totalEvents: BigInt(events),
      totalTransfers: BigInt(transfers),
      totalSwaps: BigInt(swaps),
      latestBlock: latestLog?.blockNumber || 0n,
    };
  }
}
