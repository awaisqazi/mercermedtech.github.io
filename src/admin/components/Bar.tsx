import { clamp } from '../lib/format';

export interface BarProps {
  /** 0 to 1. Values above 1 are clamped and the bar is marked "over". */
  value: number;
  /** 0 to 1. Draws a tick where the target sits. */
  target?: number | null;
  /** Read out by a screen reader. */
  title: string;
  tone?: 'accent' | 'good' | 'warn' | 'crit' | 'neutral';
  height?: number;
  targetLabel?: string;
}

/**
 * A thin progress bar with an optional target tick. The tick is a line plus a
 * label, never a colour change on its own.
 */
export function Bar({
  value,
  target = null,
  title,
  tone = 'accent',
  height = 8,
  targetLabel = 'Target',
}: BarProps) {
  const raw = Number.isFinite(value) ? value : 0;
  const safe = clamp(raw, 0, 1);
  const over = raw > 1.001;

  return (
    <div
      class={`wb-bar wb-bar-${tone}${over ? ' is-over' : ''}`}
      style={{ height: `${height}px` }}
      role="img"
      aria-label={title}
      title={title}
    >
      <span class="wb-bar-fill" style={{ width: `${safe * 100}%` }} />
      {target !== null && target !== undefined && Number.isFinite(target) ? (
        <span
          class="wb-bar-tick"
          style={{ left: `${clamp(target, 0, 1) * 100}%` }}
          title={`${targetLabel}: ${Math.round(clamp(target, 0, 1) * 100)}%`}
        />
      ) : null}
    </div>
  );
}

/** Two bars stacked, for "term elapsed vs budget billed" style comparisons. */
export function TwinBars({
  rows,
}: {
  rows: Array<{ label: string; value: number; caption: string; tone?: BarProps['tone'] }>;
}) {
  return (
    <div class="wb-twin">
      {rows.map((row) => (
        <div class="wb-twin-row" key={row.label}>
          <div class="wb-twin-head">
            <span class="wb-twin-label">{row.label}</span>
            <span class="wb-twin-caption wb-mono">{row.caption}</span>
          </div>
          <Bar value={row.value} tone={row.tone ?? 'accent'} title={`${row.label}: ${row.caption}`} />
        </div>
      ))}
    </div>
  );
}
