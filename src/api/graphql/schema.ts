import { gql } from 'graphql-tag';

export const typeDefs = gql`
  type EventLog {
    id: String!
    blockNumber: String!
    blockTimestamp: String!
    transactionHash: String!
    address: String!
    topics: [String!]!
    data: String!
  }

  type ERC20Transfer {
    id: String!
    blockNumber: String!
    blockTimestamp: String!
    transactionHash: String!
    from: String!
    to: String!
    value: String!
    tokenAddress: String!
  }

  type Swap {
    id: String!
    blockNumber: String!
    blockTimestamp: String!
    transactionHash: String!
    poolAddress: String!
    sender: String!
    recipient: String!
    amount0In: String!
    amount1In: String!
    amount0Out: String!
    amount1Out: String!
  }

  type Stats {
    totalEvents: String!
    totalTransfers: String!
    totalSwaps: String!
    latestBlock: String!
  }

  type IndexerStatus {
    isIndexing: Boolean!
    lastBlockNumber: String!
    errorCount: Int!
    uptime: Int!
  }

  enum EventType {
    ERC20_TRANSFER
    SWAP
  }

  type Query {
    """Get recent events with optional filtering"""
    events(first: Int, after: String, type: EventType): [Event!]!

    """Get recent ERC-20 transfers"""
    transfers(first: Int, after: String, to: String): [ERC20Transfer!]!

    """Get recent swaps"""
    swaps(first: Int, after: String, poolAddress: String): [Swap!]!

    """Get indexer statistics"""
    stats: Stats!

    """Get indexer status"""
    status: IndexerStatus!
  }

  type Subscription {
    """Subscribe to new events in real-time"""
    newEvents: Event!
  }

  union Event = ERC20Transfer | Swap

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  type EventEdge {
    node: Event!
    cursor: String!
  }

  type EventConnection {
    edges: [EventEdge!]!
    pageInfo: PageInfo!
  }
`;
