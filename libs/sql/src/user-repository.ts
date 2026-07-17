import type { SQL } from 'bun';
import type {
  User,
  UserRole,
  UserRepository as UserRepositoryContract,
} from '@schediochron/core';

/**
 * Which unique field a {@link DuplicateUserError} is about. `unknown` covers a
 * unique violation whose constraint we could not attribute to a specific column.
 */
export type DuplicateUserField = 'username' | 'email' | 'unknown';

/**
 * A `username` or `email` uniqueness violation, surfaced as a typed error so the
 * API can answer 409 instead of leaking a raw driver error. Thrown on the
 * Postgres unique-violation SQLSTATE `23505`; `field` names the offending column
 * where the constraint makes it clear.
 */
export class DuplicateUserError extends Error {
  readonly field: DuplicateUserField;

  constructor(field: DuplicateUserField, options?: { cause?: unknown }) {
    const subject =
      field === 'unknown' ? 'A unique user field' : `The ${field}`;
    super(`${subject} is already taken`, options);
    this.name = 'DuplicateUserError';
    this.field = field;
  }
}

/** The `users` columns this repository owns — credentials live elsewhere. */
interface UserRow {
  id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  role: UserRole;
  created_at: Date | string;
  updated_at: Date | string;
}

// TODO(#31): extract shared row mapping once a second repository needs it; kept
// local for now because sibling repositories land on this package concurrently.

/** Normalises a `timestamptz` (Date or string from the driver) to ISO 8601 UTC. */
function toIsoUtc(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

/** Maps a `users` row to the credential-free {@link User} model. */
function mapRow(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    createdAt: toIsoUtc(row.created_at),
    updatedAt: toIsoUtc(row.updated_at),
  };
}

/** A Postgres error carrying the fields we inspect for unique violations. */
interface PgUniqueViolation {
  code: string;
  constraint?: string;
  detail?: string;
}

const UNIQUE_VIOLATION = '23505';

function asUniqueViolation(err: unknown): PgUniqueViolation | null {
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === UNIQUE_VIOLATION
  ) {
    return err as PgUniqueViolation;
  }
  return null;
}

/** Attributes a unique violation to a column via its constraint/detail text. */
function duplicateFieldOf(violation: PgUniqueViolation): DuplicateUserField {
  const haystack = `${violation.constraint ?? ''} ${violation.detail ?? ''}`;
  if (haystack.includes('username')) return 'username';
  if (haystack.includes('email')) return 'email';
  return 'unknown';
}

/**
 * Turns a driver error into a {@link DuplicateUserError} when it is a unique
 * violation, otherwise rethrows it unchanged.
 */
function rethrow(err: unknown): never {
  const violation = asUniqueViolation(err);
  if (violation) {
    throw new DuplicateUserError(duplicateFieldOf(violation), { cause: err });
  }
  throw err;
}

/**
 * PostgreSQL implementation of the `UserRepository` contract, using Bun's native
 * `SQL` client.
 *
 * Credential-free by design (ADR-002): this repository maps only the `users`
 * columns and never reads or writes `user_credentials` or any password hash —
 * the auth layer (#29/#30) owns credentials. `create` works precisely because
 * the hash is not this repository's concern.
 */
export class UserRepository implements UserRepositoryContract {
  constructor(private readonly sql: SQL) {}

  async findById(id: string): Promise<User | null> {
    const rows = (await this.sql`
      SELECT id, username, display_name, email, role, created_at, updated_at
      FROM users
      WHERE id = ${id}
    `) as UserRow[];
    return rows.length ? mapRow(rows[0]) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const rows = (await this.sql`
      SELECT id, username, display_name, email, role, created_at, updated_at
      FROM users
      WHERE username = ${username}
    `) as UserRow[];
    return rows.length ? mapRow(rows[0]) : null;
  }

  async findAll(): Promise<User[]> {
    const rows = (await this.sql`
      SELECT id, username, display_name, email, role, created_at, updated_at
      FROM users
      ORDER BY created_at, id
    `) as UserRow[];
    return rows.map(mapRow);
  }

  async create(user: User): Promise<User> {
    try {
      // created_at/updated_at are set by the persistence layer (DEFAULT now()),
      // not taken from the item, per the CrudRepository contract.
      const rows = (await this.sql`
        INSERT INTO users (id, username, display_name, email, role)
        VALUES (${user.id}, ${user.username}, ${user.displayName}, ${user.email}, ${user.role})
        RETURNING id, username, display_name, email, role, created_at, updated_at
      `) as UserRow[];
      return mapRow(rows[0]);
    } catch (err) {
      rethrow(err);
    }
  }

  async update(user: User): Promise<User> {
    try {
      const rows = (await this.sql`
        UPDATE users
        SET username = ${user.username},
            display_name = ${user.displayName},
            email = ${user.email},
            role = ${user.role},
            updated_at = now()
        WHERE id = ${user.id}
        RETURNING id, username, display_name, email, role, created_at, updated_at
      `) as UserRow[];
      if (!rows.length) {
        throw new Error(`Cannot update user ${user.id}: not found`);
      }
      return mapRow(rows[0]);
    } catch (err) {
      rethrow(err);
    }
  }

  async delete(id: string): Promise<void> {
    // Deleting an unknown id is a no-op: no row matches, nothing happens.
    await this.sql`DELETE FROM users WHERE id = ${id}`;
  }
}
