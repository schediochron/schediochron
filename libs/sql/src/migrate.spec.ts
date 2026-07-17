import { afterAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  discoverMigrations,
  migrationsToRevert,
  pendingMigrations,
  type Migration,
} from './migrate.js';

const tmpDirs: string[] = [];

function fixtureDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'sql-migrate-'));
  tmpDirs.push(dir);
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(dir, name), contents);
  }
  return dir;
}

afterAll(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
});

const migration = (version: string, name = `m${version}`): Migration => ({
  version,
  name,
  upPath: `${version}.up.sql`,
  downPath: `${version}.down.sql`,
});

describe('discoverMigrations', () => {
  it('reads the real migration directory in order with matching down files', () => {
    const migrations = discoverMigrations();
    expect(migrations.length).toBeGreaterThanOrEqual(1);
    expect(migrations[0]).toMatchObject({
      version: '0001',
      name: 'initial_schema',
    });
    const versions = migrations.map((m) => m.version);
    expect([...versions]).toEqual([...versions].sort());
  });

  it('orders migrations by zero-padded version, not discovery order', () => {
    const dir = fixtureDir({
      '0002_second.up.sql': '',
      '0002_second.down.sql': '',
      '0001_first.up.sql': '',
      '0001_first.down.sql': '',
    });
    expect(discoverMigrations(dir).map((m) => m.version)).toEqual([
      '0001',
      '0002',
    ]);
  });

  it('rejects a badly named migration file', () => {
    const dir = fixtureDir({ 'initial.up.sql': '', 'initial.down.sql': '' });
    expect(() => discoverMigrations(dir)).toThrow(/must be named/);
  });

  it('rejects an up migration with no matching down file', () => {
    const dir = fixtureDir({ '0001_init.up.sql': '' });
    expect(() => discoverMigrations(dir)).toThrow(/no matching/);
  });

  it('rejects duplicate versions', () => {
    const dir = fixtureDir({
      '0001_a.up.sql': '',
      '0001_a.down.sql': '',
      '0001_b.up.sql': '',
      '0001_b.down.sql': '',
    });
    expect(() => discoverMigrations(dir)).toThrow(/Duplicate migration version/);
  });
});

describe('pendingMigrations', () => {
  const all = [migration('0001'), migration('0002'), migration('0003')];

  it('returns every migration when none are applied', () => {
    expect(pendingMigrations(all, new Set()).map((m) => m.version)).toEqual([
      '0001',
      '0002',
      '0003',
    ]);
  });

  it('skips applied migrations, preserving order', () => {
    const applied = new Set(['0001', '0002']);
    expect(pendingMigrations(all, applied).map((m) => m.version)).toEqual([
      '0003',
    ]);
  });

  it('returns nothing when all are applied', () => {
    expect(pendingMigrations(all, new Set(['0001', '0002', '0003']))).toEqual(
      [],
    );
  });
});

describe('migrationsToRevert', () => {
  const all = [migration('0001'), migration('0002'), migration('0003')];
  const applied = new Set(['0001', '0002', '0003']);

  it('reverts the most recent migration newest-first by default', () => {
    expect(migrationsToRevert(all, applied, 1).map((m) => m.version)).toEqual([
      '0003',
    ]);
  });

  it('reverts multiple steps newest-first', () => {
    expect(migrationsToRevert(all, applied, 2).map((m) => m.version)).toEqual([
      '0003',
      '0002',
    ]);
  });

  it('never reverts an unapplied migration', () => {
    const partial = new Set(['0001']);
    expect(migrationsToRevert(all, partial, 5).map((m) => m.version)).toEqual([
      '0001',
    ]);
  });

  it('reverts nothing for a non-positive step count', () => {
    expect(migrationsToRevert(all, applied, 0)).toEqual([]);
  });
});
