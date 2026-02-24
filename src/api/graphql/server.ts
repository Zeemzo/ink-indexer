import { ApolloServer } from '@apollo/server';
import { typeDefs } from './schema.js';
import { createResolvers } from './resolvers.js';
import type { OnchainIndexer } from '../../indexer/index.js';

export async function createGraphQLServer(
  indexer: OnchainIndexer
): Promise<{ server: ApolloServer }> {
  const server = new ApolloServer({
    typeDefs,
    resolvers: createResolvers(indexer),
    introspection: true,
    includeStacktraceInErrorResponses: false,
  });

  await server.start();

  return { server };
}
