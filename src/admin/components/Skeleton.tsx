/**
 * Loading placeholders. They keep the layout from jumping when the data
 * arrives, and they hold still for anyone who has asked for reduced motion.
 */
export function Skeleton({
  width = '100%',
  height = 14,
  radius = 6,
  class: className,
}: {
  width?: string | number;
  height?: string | number;
  radius?: number;
  class?: string;
}) {
  return (
    <span
      class={`wb-skeleton${className ? ` ${className}` : ''}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: `${radius}px`,
      }}
      aria-hidden="true"
    />
  );
}

/** A few stacked lines, for a list that is still loading. */
export function SkeletonLines({ count = 3, class: className }: { count?: number; class?: string }) {
  return (
    <div class={`wb-skeleton-lines${className ? ` ${className}` : ''}`} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} width={index === count - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}

/** Card-shaped placeholders for a grid. */
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div class="wb-card-grid" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <div class="wb-card wb-card-skeleton" key={index}>
          <Skeleton width="45%" height={16} />
          <Skeleton width="90%" />
          <Skeleton width="70%" />
        </div>
      ))}
    </div>
  );
}
