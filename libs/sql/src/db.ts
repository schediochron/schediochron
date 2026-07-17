import { SQL } from 'bun';

/**
 * Opens a PostgreSQL connection using Bun's native client.
 *
 * The connection string comes from `DATABASE_URL` unless one is passed
 * explicitly (tests pass an ephemeral database). There is no default: a missing
 * `DATABASE_URL` is a configuration error, not something to paper over with a
 * localhost guess.
 */
export function createSqlClient(
  connectionString: string | undefined = process.env.DATABASE_URL,
): SQL {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set — @schediochron/sql needs a PostgreSQL connection string.',
    );
  }
  return new SQL(connectionString);
}
