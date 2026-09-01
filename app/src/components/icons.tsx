/**
 * HAI's icon set. Flat, geometric, single-color (currentColor) — a 24×24 grid,
 * straight joins, no rounded caps, in the same register as the rest of the
 * Swiss-modern chrome. Every glyph is built from the same small vocabulary
 * (line, rect, circle) rather than borrowed clip-art, so the set reads as one
 * family at any size.
 *
 * `Icon*Role` covers the six playbook roles; `PLAYBOOK_ICONS` maps a playbook
 * id (from `content/playbooks/index.json`) to its component so call sites
 * never touch the markdown frontmatter's `icon:` emoji.
 */
import type { SVGProps } from 'react';

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

function Svg({ size = 24, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Program Officer — a workplan's stepped lines and a tracked milestone. */
export function IconProgramRole(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="15" y2="12" />
      <line x1="4" y1="18" x2="18" y2="18" />
      <circle cx="20" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Protection Officer, and safety chrome elsewhere — a shield, straight-edged. */
export function IconShield(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.4 19 6.1v5.3c0 4.7-3 8-7 8.9-4-.9-7-4.2-7-8.9V6.1z" />
    </Svg>
  );
}

/** MEAL Officer — indicators as ascending bars against a baseline. */
export function IconMealRole(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="4" y1="20" x2="20" y2="20" />
      <rect x="5.8" y="14" width="2.6" height="6" />
      <rect x="10.7" y="10" width="2.6" height="10" />
      <rect x="15.6" y="6" width="2.6" height="14" />
    </Svg>
  );
}

/** Communications Officer — a signal broadcasting outward from a point. */
export function IconCommsRole(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="5" cy="19" r="1.3" fill="currentColor" stroke="none" />
      <path d="M8.4 15.6c2.9 0 5.3 2.4 5.3 5.4" />
      <path d="M10.8 12.2c4.8 0 8.7 4 8.7 8.8" />
    </Svg>
  );
}

/** Grants & Partnerships — two agreements overlapping. */
export function IconGrantsRole(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="7.5" width="10.5" height="10.5" />
      <rect x="9.5" y="4" width="10.5" height="10.5" />
    </Svg>
  );
}

/** Field Logistics — a supply route between two nodes. */
export function IconLogisticsRole(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="5" cy="18.5" r="1.5" />
      <circle cx="19" cy="5.5" r="1.5" />
      <path d="M6.4 17.3 11.8 11l2 1 3.8-4.7" />
    </Svg>
  );
}

/** Generic chat — a square bubble, flat tail. */
export function IconChat(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 5h16v10.5H9.2L5 19v-3.5H4z" />
    </Svg>
  );
}

/** Search over the standards corpus. */
export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="10" r="5.4" />
      <line x1="7.3" y1="10" x2="12.5" y2="10" />
      <line x1="14.1" y1="14.1" x2="20" y2="20" />
    </Svg>
  );
}

/** Live crisis data — a pulse ending in a current reading. */
export function IconLiveData(props: IconProps) {
  return (
    <Svg {...props}>
      <polyline points="3,17 7.5,17 10.5,9 13.5,15 16.5,11 19,11" />
      <circle cx="19" cy="11" r="1.5" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Coach mode — correcting toward the mark. */
export function IconCoach(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="7.6" />
      <circle cx="12" cy="12" r="2.6" />
      <line x1="12" y1="2.8" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="21.2" />
      <line x1="2.8" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="21.2" y2="12" />
    </Svg>
  );
}

/** Guides — an open two-page spread. */
export function IconGuides(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5" width="7.2" height="14" />
      <rect x="12.8" y="5" width="7.2" height="14" />
      <line x1="5.8" y1="8.2" x2="9.4" y2="8.2" />
      <line x1="5.8" y1="11.2" x2="9.4" y2="11.2" />
      <line x1="14.6" y1="8.2" x2="18.2" y2="8.2" />
      <line x1="14.6" y1="11.2" x2="18.2" y2="11.2" />
    </Svg>
  );
}

/** Language / locale. */
export function IconLanguage(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="7.8" />
      <line x1="4.2" y1="12" x2="19.8" y2="12" />
      <ellipse cx="12" cy="12" rx="3.1" ry="7.8" />
    </Svg>
  );
}

/** Opens outside the app. */
export function IconExternalLink(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="9" width="10" height="10.5" />
      <path d="M11 4h9v9" />
      <line x1="20" y1="4" x2="10.6" y2="13.4" />
    </Svg>
  );
}

/** A cited source document. */
export function IconDocument(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4" />
      <line x1="8.4" y1="11.2" x2="17" y2="11.2" />
      <line x1="8.4" y1="14.2" x2="17" y2="14.2" />
      <line x1="8.4" y1="17.2" x2="14" y2="17.2" />
    </Svg>
  );
}

/** Advisory / caution. */
export function IconWarning(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.4 21.4 20.4H2.6Z" />
      <line x1="12" y1="9.6" x2="12" y2="14.6" />
      <circle cx="12" cy="17.4" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Solid square — the wordmark's signal-red counterpart. Not a pictogram. */
export function IconMark(props: IconProps) {
  const { size = 24, ...rest } = props;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      {...rest}
    >
      <rect x="2" y="2" width="20" height="20" fill="currentColor" />
    </svg>
  );
}

export type IconComponent = (props: IconProps) => React.JSX.Element;

/** Playbook id (see `content/playbooks/index.json`) → role icon. */
export const PLAYBOOK_ICONS: Record<string, IconComponent> = {
  'program-officer': IconProgramRole,
  'protection-officer': IconShield,
  'meal-officer': IconMealRole,
  communications: IconCommsRole,
  'grants-partnerships': IconGrantsRole,
  'field-logistics': IconLogisticsRole,
};

/** Chat tool name → the icon shown while it runs and once it resolves. */
export const TOOL_ICONS: Record<'search_standards' | 'crisis_updates' | 'humanitarian_data', IconComponent> = {
  search_standards: IconSearch,
  crisis_updates: IconLiveData,
  humanitarian_data: IconLiveData,
};

/** A verified claim — the check the self-check step draws. */
export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <polyline points="4,12.6 9.5,18 20,6.6" />
    </Svg>
  );
}

/** A claim the evidence did not support. Flown, not ticked. */
export function IconFlag(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="6" y1="3" x2="6" y2="21" />
      <path d="M6 4.5h13l-3 4.5 3 4.5H6z" />
    </Svg>
  );
}

/** Copy to clipboard — two sheets, offset. */
export function IconCopy(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="12" height="12" />
      <polyline points="8.5,20.5 20.5,20.5 20.5,8.5" />
    </Svg>
  );
}

/** Download — out of the document, onto the disk. */
export function IconDownload(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="12" y1="3" x2="12" y2="15" />
      <polyline points="6.5,9.5 12,15 17.5,9.5" />
      <polyline points="4,18.5 4,21 20,21 20,18.5" />
    </Svg>
  );
}

/** Deliverables — a document assembled from separate blocks. */
export function IconDeliverable(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="18" height="7" />
    </Svg>
  );
}

/**
 * The icon for a tool by name, for surfaces that render whatever the registry
 * happens to hold rather than a fixed set — the trace panel, which must not
 * break when a tool is added to `lib/tools/index.ts` before anyone gets round
 * to drawing a glyph for it.
 */
export function toolIcon(name: string): IconComponent {
  return (
    (TOOL_ICONS as Record<string, IconComponent | undefined>)[name] ??
    (name.includes('standard') ? IconSearch : IconLiveData)
  );
}
