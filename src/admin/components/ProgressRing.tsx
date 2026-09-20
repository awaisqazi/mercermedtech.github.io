import { clamp } from '../lib/format';

export interface ProgressRingProps {
  /** 0 to 1. */
  value: number;
  size?: number;
  thickness?: number;
  /** Centre text. Defaults to the rounded percentage. */
  label?: string;
  /** Read out by a screen reader, e.g. "8 of 12 tasks done". */
  title: string;
}

/** A thin ring, used on project cards for done ÷ total. */
export function ProgressRing({ value, size = 38, thickness = 4, label, title }: ProgressRingProps) {
  const safe = clamp(Number.isFinite(value) ? value : 0, 0, 1);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const centre = size / 2;
  const text = label ?? `${Math.round(safe * 100)}%`;

  return (
    <span class="wb-ring" role="img" aria-label={title} title={title}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle
          class="wb-ring-track"
          cx={centre}
          cy={centre}
          r={radius}
          fill="none"
          stroke-width={thickness}
        />
        <circle
          class="wb-ring-fill"
          cx={centre}
          cy={centre}
          r={radius}
          fill="none"
          stroke-width={thickness}
          stroke-linecap="round"
          stroke-dasharray={`${circumference} ${circumference}`}
          stroke-dashoffset={circumference * (1 - safe)}
          transform={`rotate(-90 ${centre} ${centre})`}
        />
      </svg>
      <span class="wb-ring-label wb-mono">{text}</span>
    </span>
  );
}
