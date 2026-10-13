import { ApolloServer } from '@apollo/server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from './schema.js';
import { createResolvers } from './resolvers.js';
import type { OnchainIndexer } from '../../indexer/index.js';

export function createSchema(indexer: OnchainIndexer) {
  return makeExecutableSchema({
    typeDefs,
    resolvers: createResolvers(indexer),
  });
}

export async function createGraphQLServer(
  indexer: OnchainIndexer
): Promise<{ server: ApolloServer; schema: ReturnType<typeof createSchema> }> {
  const schema = createSchema(indexer);

  const server = new ApolloServer({
    schema,
    introspection: true,
    includeStacktraceInErrorResponses: false,
  });

  await server.start();

  return { server, schema };
}
