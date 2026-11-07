/**
 * A thin bar with its number in words beside it: "3 of 5" for a checklist,
 * "40%" for a manual figure. The words are what a screen reader hears; the
 * bar is hidden from it.
 */
export function Progress({
  done,
  total,
  percent,
  compact = false,
  class: className,
}: {
  /** With `total`, shows "done of total". */
  done?: number;
  total?: number;
  /** 0 to 100. Used when there is no total. */
  percent?: number;
  /** A shorter bar, for list rows and cards. */
  compact?: boolean;
  class?: string;
}) {
  const hasCount = typeof total === 'number' && total > 0;
  const value = hasCount
    ? Math.round(((done ?? 0) / (total as number)) * 100)
    : Math.max(0, Math.min(100, Math.round(percent ?? 0)));
  const words = hasCount ? `${done ?? 0} of ${total}` : `${value}%`;
  return (
    <span
      class={`wb-progress${compact ? ' is-compact' : ''}${value >= 100 ? ' is-full' : ''}${className ? ` ${className}` : ''}`}
    >
      <span class="wb-progress-track" aria-hidden="true">
        <span class="wb-progress-fill" style={{ transform: `scaleX(${value / 100})` }} />
      </span>
      <span class="wb-progress-words">
        <span class="wb-sr">Progress: </span>
        {words}
      </span>
    </span>
  );
}
