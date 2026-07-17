/**
 * The CRUD surface every entity repository shares. Scoped and filtered lookups
 * belong on the specific repositories.
 */
export interface CrudRepository<T> {
  /** `null` when no entity carries that id — absence is not an error. */
  findById(id: string): Promise<T | null>;

  /** Every entity, unscoped. */
  findAll(): Promise<T[]>;

  /** Returns the entity as stored; `createdAt`/`updatedAt` are set on write. */
  create(item: T): Promise<T>;

  /** Returns the entity as stored; refreshes `updatedAt`. */
  update(item: T): Promise<T>;

  /** Deleting an unknown id is a no-op. */
  delete(id: string): Promise<void>;
}
