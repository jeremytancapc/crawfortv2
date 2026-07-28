/**
 * In-memory data client with a Supabase-like query surface.
 * No external database — data lives in process memory (seeded with dummy rows).
 */

import {
  getMemoryStore,
  newId,
  timestampNow,
  type TableName,
} from "./memory-store";
import type { DbRow } from "./types";

export type DbError = {
  message: string;
  code?: string;
  details?: string;
};

export type DbResult<T = any> = {
  // `any` matches the previous admin client (untyped PostgREST rows).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: T;
  error: DbError | null;
};

type Filter = { column: string; value: unknown };
type Order = { column: string; ascending: boolean };

function project(row: DbRow, columns: string | null): DbRow {
  if (!columns || columns === "*") return { ...row };
  const out: DbRow = {};
  for (const col of columns.split(",").map((c) => c.trim()).filter(Boolean)) {
    out[col] = row[col];
  }
  return out;
}

function matches(row: DbRow, filters: Filter[]) {
  return filters.every((f) => row[f.column] === f.value);
}

class QueryBuilder {
  private filters: Filter[] = [];
  private orderBy: Order | null = null;
  private limitCount: number | null = null;
  private selectColumns: string | null = null;
  private mutation:
    | { type: "insert"; rows: DbRow[] }
    | { type: "update"; patch: DbRow }
    | { type: "upsert"; rows: DbRow[]; onConflict?: string }
    | null = null;

  constructor(private table: TableName) {}

  select(columns = "*") {
    this.selectColumns = columns;
    return this;
  }

  insert(values: DbRow | DbRow[]) {
    const rows = Array.isArray(values) ? values : [values];
    this.mutation = { type: "insert", rows };
    return this;
  }

  update(patch: DbRow) {
    this.mutation = { type: "update", patch };
    return this;
  }

  upsert(values: DbRow | DbRow[], opts?: { onConflict?: string }) {
    const rows = Array.isArray(values) ? values : [values];
    this.mutation = { type: "upsert", rows, onConflict: opts?.onConflict };
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: opts?.ascending !== false };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  private applyDefaults(row: DbRow): DbRow {
    const now = timestampNow();
    const next: DbRow = { ...row };
    if (next.id == null) next.id = newId();
    if (next.created_at == null) next.created_at = now;
    if (
      (this.table === "leads" || this.table === "appointments") &&
      next.updated_at == null
    ) {
      next.updated_at = now;
    }
    return next;
  }

  private runMutation(): DbResult<any[]> {
    const store = getMemoryStore();
    const table = store[this.table];

    try {
      if (!this.mutation) {
        let rows = table.filter((r) => matches(r, this.filters));
        if (this.orderBy) {
          const { column, ascending } = this.orderBy;
          rows = [...rows].sort((a, b) => {
            const av = a[column];
            const bv = b[column];
            if (av === bv) return 0;
            if (av == null) return 1;
            if (bv == null) return -1;
            return (av < bv ? -1 : 1) * (ascending ? 1 : -1);
          });
        }
        if (this.limitCount != null) {
          rows = rows.slice(0, this.limitCount);
        }
        return {
          data: rows.map((r) => project(r, this.selectColumns)),
          error: null,
        };
      }

      if (this.mutation.type === "insert") {
        const inserted = this.mutation.rows.map((r) => this.applyDefaults(r));
        table.push(...inserted);
        return {
          data: inserted.map((r) => project(r, this.selectColumns)),
          error: null,
        };
      }

      if (this.mutation.type === "update") {
        const now = timestampNow();
        const updated: any[] = [];
        for (let i = 0; i < table.length; i++) {
          if (!matches(table[i], this.filters)) continue;
          const next = {
            ...table[i],
            ...this.mutation.patch,
            updated_at: now,
          };
          table[i] = next;
          updated.push(project(next, this.selectColumns));
        }
        return { data: updated, error: null };
      }

      // upsert
      const conflict = this.mutation.onConflict;
      const upserted: any[] = [];
      for (const raw of this.mutation.rows) {
        const row = this.applyDefaults(raw);
        if (conflict && row[conflict] != null) {
          const idx = table.findIndex((r) => r[conflict] === row[conflict]);
          if (idx >= 0) {
            const next = {
              ...table[idx],
              ...row,
              id: table[idx].id,
              created_at: table[idx].created_at,
              updated_at: timestampNow(),
            };
            table[idx] = next;
            upserted.push(project(next, this.selectColumns));
            continue;
          }
        }
        table.push(row);
        upserted.push(project(row, this.selectColumns));
      }
      return { data: upserted, error: null };
    } catch (err) {
      return {
        data: [],
        error: {
          message: err instanceof Error ? err.message : "Memory DB error",
        },
      };
    }
  }

  then<TResult1 = DbResult<any>, TResult2 = never>(
    onfulfilled?:
      | ((value: DbResult<any>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.runMutation()).then(onfulfilled, onrejected);
  }

  async single(): Promise<DbResult<any>> {
    const { data, error } = this.runMutation();
    if (error) return { data: null, error };
    if (data.length === 0) {
      return {
        data: null,
        error: { message: "No rows found", code: "PGRST116" },
      };
    }
    return { data: data[0], error: null };
  }

  async maybeSingle(): Promise<DbResult<any>> {
    const { data, error } = this.runMutation();
    if (error) return { data: null, error };
    return { data: data[0] ?? null, error: null };
  }
}

export type AdminClient = {
  from: (table: TableName) => QueryBuilder;
};

/** Server-side data client — in-memory store, no external DB. */
export function createAdminClient(): AdminClient {
  return {
    from(table: TableName) {
      return new QueryBuilder(table);
    },
  };
}
