/** The shape of a recorded query, shared by the demo client and its engine. */
export interface DemoFilter {
  column: string;
  op: 'eq' | 'neq' | 'in' | 'notin' | 'lt' | 'lte' | 'gt' | 'gte' | 'is' | 'notis';
  value: unknown;
}

export interface DemoQuery {
  table: string;
  action: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  columns: string;
  filters: DemoFilter[];
  orders: Array<{ column: string; ascending: boolean }>;
  limit: number | null;
  single: 'single' | 'maybe' | null;
  /** `.select()` after a write: hand the written rows back. */
  returning: boolean;
  values: unknown;
  onConflict: string | null;
}
