/**
 * The icon set. Drawn here rather than pulled from a font or a package: a
 * dozen shapes on a 24 grid, 1.75px stroke, round caps, `currentColor`.
 *
 * Every icon is decorative by default (`aria-hidden`); give it a `label` when
 * it is the only thing in a button.
 */
import type { JSX } from 'preact';

export interface IconProps {
  size?: number;
  label?: string;
  class?: string;
}

function Svg({
  size = 18,
  label,
  class: className,
  children,
}: IconProps & { children: JSX.Element | JSX.Element[] }) {
  return (
    <svg
      class={`wb-icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconHome = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3.5 10.5 12 4l8.5 6.5V19a1 1 0 0 1-1 1h-4v-6h-7v6h-4a1 1 0 0 1-1-1z" />
  </Svg>
);

export const IconProjects = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3.5" y="4.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="4.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="14.5" width="7" height="5" rx="1.5" />
    <rect x="13.5" y="14.5" width="7" height="5" rx="1.5" />
  </Svg>
);

export const IconPeople = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
    <path d="M16 5.6a3.25 3.25 0 0 1 0 6.3" />
    <path d="M17.2 14.9c2 .6 3.3 2.3 3.3 4.6" />
  </Svg>
);

export const IconAccount = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 19.5c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
  </Svg>
);

export const IconSun = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="3.75" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
  </Svg>
);

export const IconMoon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2z" />
  </Svg>
);

export const IconPlus = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconClose = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const IconCheck = (props: IconProps) => (
  <Svg {...props}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const IconChevron = (props: IconProps) => (
  <Svg {...props}>
    <path d="m9 5.5 6.5 6.5L9 18.5" />
  </Svg>
);

export const IconChevronDown = (props: IconProps) => (
  <Svg {...props}>
    <path d="m5.5 9 6.5 6.5L18.5 9" />
  </Svg>
);

export const IconSearch = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m15 15 4.5 4.5" />
  </Svg>
);

export const IconDots = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="5.5" cy="12" r="1.1" fill="currentColor" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" />
    <circle cx="18.5" cy="12" r="1.1" fill="currentColor" />
  </Svg>
);

export const IconTrash = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4.5 6.5h15M9.5 6.5V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" />
    <path d="M6.5 6.5 7.4 19a1 1 0 0 0 1 1h7.2a1 1 0 0 0 1-1l.9-12.5" />
    <path d="M10.5 10v6M13.5 10v6" />
  </Svg>
);

export const IconCopy = (props: IconProps) => (
  <Svg {...props}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M15 6.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h.5" />
  </Svg>
);

export const IconLink = (props: IconProps) => (
  <Svg {...props}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1.5 1.5" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1.5-1.5" />
  </Svg>
);

export const IconDocument = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 3.5h7L18.5 9v11a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
    <path d="M13 3.5V9h5.5M8.5 13h7M8.5 16.5h5" />
  </Svg>
);

export const IconFlag = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 20.5V4m0 .8h10.5l-2 3.6 2 3.6H6" />
  </Svg>
);

export const IconClock = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const IconWarning = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 4.5 21 19.5H3z" />
    <path d="M12 10v4" />
    <circle cx="12" cy="16.8" r=".9" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconSignOut = (props: IconProps) => (
  <Svg {...props}>
    <path d="M14 7.5V5.5a1 1 0 0 0-1-1H5.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H13a1 1 0 0 0 1-1v-2" />
    <path d="M10 12h10m0 0-3-3m3 3-3 3" />
  </Svg>
);

export const IconArrowLeft = (props: IconProps) => (
  <Svg {...props}>
    <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
  </Svg>
);

export const IconDownload = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 4v10m0 0-4-4m4 4 4-4" />
    <path d="M5 17v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2" />
  </Svg>
);

export const IconUpload = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 16V5.5m0 0-4 4m4-4 4 4" />
    <path d="M5 17v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2" />
  </Svg>
);

export const IconGrip = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="9.5" cy="6.5" r="1.1" fill="currentColor" />
    <circle cx="14.5" cy="6.5" r="1.1" fill="currentColor" />
    <circle cx="9.5" cy="12" r="1.1" fill="currentColor" />
    <circle cx="14.5" cy="12" r="1.1" fill="currentColor" />
    <circle cx="9.5" cy="17.5" r="1.1" fill="currentColor" />
    <circle cx="14.5" cy="17.5" r="1.1" fill="currentColor" />
  </Svg>
);

export const IconComment = (props: IconProps) => (
  <Svg {...props}>
    <path d="M20 12.5c0 3.6-3.6 6.5-8 6.5a9.6 9.6 0 0 1-2.6-.35L4.5 20.5l1.2-3.2A6.4 6.4 0 0 1 4 12.5C4 8.9 7.6 6 12 6s8 2.9 8 6.5z" />
  </Svg>
);

export const IconEye = (props: IconProps) => (
  <Svg {...props}>
    <path d="M2.8 12S6.5 6 12 6s9.2 6 9.2 6-3.7 6-9.2 6-9.2-6-9.2-6z" />
    <circle cx="12" cy="12" r="2.6" />
  </Svg>
);

export const IconEyeOff = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 4.5 20 19.5" />
    <path d="M9.6 9.7A2.6 2.6 0 0 0 12 14.6c.7 0 1.4-.3 1.9-.8" />
    <path d="M6.6 6.9C4.2 8.6 2.8 12 2.8 12s3.7 6 9.2 6c1.6 0 3-.5 4.2-1.2" />
    <path d="M18.4 15A13 13 0 0 0 21.2 12S17.5 6 12 6c-.8 0-1.5.1-2.2.3" />
  </Svg>
);

export const IconSettings = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="2.8" />
    <path d="M12 3.5h0l.6 2.1 2 .8 2-1 1.5 1.5-1 2 .8 2 2.1.6v2.1l-2.1.6-.8 2 1 2-1.5 1.5-2-1-2 .8-.6 2.1H12l-.6-2.1-2-.8-2 1-1.5-1.5 1-2-.8-2-2.1-.6v-2.1l2.1-.6.8-2-1-2L7.4 5.4l2 1 2-.8z" />
  </Svg>
);

export const IconArchive = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3.5" y="4.5" width="17" height="4" rx="1" />
    <path d="M5.5 8.5v10a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-10" />
    <path d="M10 12h4" />
  </Svg>
);

export const IconList = (props: IconProps) => (
  <Svg {...props}>
    <path d="M9 6.5h11M9 12h11M9 17.5h11" />
    <circle cx="4.75" cy="6.5" r="1.1" fill="currentColor" />
    <circle cx="4.75" cy="12" r="1.1" fill="currentColor" />
    <circle cx="4.75" cy="17.5" r="1.1" fill="currentColor" />
  </Svg>
);

export const IconBoard = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3.5" y="4.5" width="5" height="15" rx="1.5" />
    <rect x="9.5" y="4.5" width="5" height="10" rx="1.5" />
    <rect x="15.5" y="4.5" width="5" height="13" rx="1.5" />
  </Svg>
);

export const IconRefresh = (props: IconProps) => (
  <Svg {...props}>
    <path d="M19.5 11a7.5 7.5 0 1 0-.7 4.5" />
    <path d="M19.5 5.5V11H14" />
  </Svg>
);

export const IconBell = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2H5z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Svg>
);

export const IconChart = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4.5 19.5h15" />
    <rect x="6" y="11" width="3" height="6" rx="0.75" />
    <rect x="10.5" y="6.5" width="3" height="10.5" rx="0.75" />
    <rect x="15" y="9" width="3" height="8" rx="0.75" />
  </Svg>
);

export const IconInfo = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5" />
    <circle cx="12" cy="7.75" r="0.9" fill="currentColor" />
  </Svg>
);

export const IconToday = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
    <circle cx="12" cy="14.5" r="1.6" fill="currentColor" />
  </Svg>
);

export const IconPlan = (props: IconProps) => (
  <Svg {...props}>
    <path d="m4 7 1.6 1.6L8.5 5.7" />
    <path d="m4 13 1.6 1.6 2.9-2.9" />
    <path d="M11.5 7h8.5M11.5 13h8.5M11.5 19h8.5" />
    <circle cx="6" cy="19" r="1.1" fill="currentColor" />
  </Svg>
);

export const IconMenu = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4.5 7h15M4.5 12h15M4.5 17h15" />
  </Svg>
);

export const IconStar = (props: IconProps) => (
  <Svg {...props}>
    <path d="m12 4.5 2.3 4.7 5.2.8-3.8 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1-3.8-3.6 5.2-.8z" />
  </Svg>
);

export const IconFilter = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4.5 6h15M7.5 12h9M10.5 18h3" />
  </Svg>
);
