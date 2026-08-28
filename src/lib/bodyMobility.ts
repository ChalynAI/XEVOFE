import {
  angleDeg,
  landmarkVisOk,
  JOINT_VISIBILITY_MIN,
  type Pt2,
} from './poseJointAngles'
import type { LandmarkPoint } from './techniquePose'

export type BodySide = 'LEFT' | 'RIGHT'

export type MobilityJointKey = 'head' | 'shoulder' | 'wrist' | 'knee'

export type MobilityStatus = 'good' | 'okay' | 'bad'

export type MobilityJointReading = {
  you: number | null
  ideal: number | null
  matchPct: number | null
  status: MobilityStatus | null
  /** Ideal-relative marker position on the 0–180 gauge arc. */
  gaugeDeg: number | null
}

export type SideMobilityAngles = Record<MobilityJointKey, number | null>

export type SideMobilityReadings = Record<MobilityJointKey, MobilityJointReading>

export const MOBILITY_JOINT_KEYS: MobilityJointKey[] = [
  'head',
  'shoulder',
  'wrist',
  'knee',
]

/** Joints shown under Left/Right tabs (head is shared / midline). */
export const SIDE_MOBILITY_JOINT_KEYS: MobilityJointKey[] = [
  'shoulder',
  'wrist',
  'knee',
]

const HEAD_COLLAPSED_MAX_DEG = 12

function isCollapsedHead(deg: number | null): boolean {
  return deg == null || deg <= HEAD_COLLAPSED_MAX_DEG
}

/**
 * Single Head reading for UI: prefer non-collapsed `you`, then higher angle.
 * Returns which body side supplied the preferred `you` (for optional chip).
 */
export function pickSharedHeadReading(
  left: SideMobilityReadings,
  right: SideMobilityReadings
): { reading: MobilityJointReading; side: BodySide } {
  const l = left.head
  const r = right.head
  const lCollapsed = isCollapsedHead(l.you)
  const rCollapsed = isCollapsedHead(r.you)
  if (!lCollapsed && !rCollapsed) {
    if ((r.you ?? 0) > (l.you ?? 0)) return { reading: r, side: 'RIGHT' }
    return { reading: l, side: 'LEFT' }
  }
  if (lCollapsed && !rCollapsed) return { reading: r, side: 'RIGHT' }
  if (rCollapsed && !lCollapsed) return { reading: l, side: 'LEFT' }
  if (r.you != null && (l.you == null || r.you >= l.you)) {
    return { reading: r, side: 'RIGHT' }
  }
  return { reading: l, side: 'LEFT' }
}

const GAUGE_MAX_DEG = 180
const GAUGE_SEGMENTS = 5
const MATCH_REF_DEG = 90
/** 1° real error = 1° on the gauge arc (2° miss stays in green). */
const GAUGE_ERROR_SCALE = 1

/** Left→right wedge colors matching design per joint. */
export const GAUGE_SEGMENT_COLORS_BY_JOINT: Record<
  MobilityJointKey,
  readonly [string, string, string, string, string]
> = {
  // red → yellow → green → yellow → red
  head: ['#FF0000', '#FFDD00', '#00FFA6', '#FFDD00', '#FF0000'],
  shoulder: ['#FF0000', '#FFDD00', '#00FFA6', '#FFDD00', '#FF0000'],
  // yellow → green → yellow → red → red
  wrist: ['#FFDD00', '#00FFA6', '#FFDD00', '#FF0000', '#FF0000'],
  knee: ['#FFDD00', '#00FFA6', '#FFDD00', '#FF0000', '#FF0000'],
}

/** Center of the green wedge on the 0–180 arc (Ideal lands here). */
export const GAUGE_GREEN_CENTER_DEG: Record<MobilityJointKey, number> = {
  head: 90, // bin 2 mid
  shoulder: 90,
  wrist: 54, // bin 1 mid
  knee: 54,
}

/** Legend / Ideal accent colors. */
export const STATUS_COLORS: Record<MobilityStatus, string> = {
  good: '#00FFA6',
  okay: '#00B8FF',
  bad: '#FF0004',
}

/** Status pill label colors. */
export const STATUS_PILL_TEXT: Record<MobilityStatus, string> = {
  good: '#00FFA6',
  okay: '#00B8FF',
  bad: '#FF0004',
}

/** Status pill background fills (same hue, lowered opacity). */
export const STATUS_PILL_BG: Record<MobilityStatus, string> = {
  good: 'rgba(0, 255, 166, 0.4)', // #00FFA6 @ 40%
  okay: 'rgba(0, 75, 255, 0.75)', // #004BFF @ 75%
  bad: 'rgba(255, 0, 4, 0.3)', // #FF0004 @ 30%
}

function clampDeg(n: number): number {
  return Math.max(0, Math.min(GAUGE_MAX_DEG, Math.round(n)))
}

function clampGauge(n: number): number {
  return Math.max(0, Math.min(GAUGE_MAX_DEG, n))
}

function pt(
  lm: Record<string, LandmarkPoint | undefined>,
  name: string,
  minVis = JOINT_VISIBILITY_MIN
): Pt2 | null {
  const p = lm[name]
  if (!landmarkVisOk(p, minVis) || !p) return null
  return { x: p.x, y: p.y }
}

function tripleAngle(
  lm: Record<string, LandmarkPoint | undefined>,
  a: string,
  b: string,
  c: string
): number | null {
  const pa = pt(lm, a)
  const pb = pt(lm, b)
  const pc = pt(lm, c)
  if (!pa || !pb || !pc) return null
  const deg = angleDeg(pa, pb, pc)
  if (deg == null || !Number.isFinite(deg)) return null
  return clampDeg(deg)
}

/** Per-side mobility angles from MediaPipe landmarks (image-plane included °). */
export function computeSideMobilityAngles(
  landmarks: Record<string, LandmarkPoint | undefined> | null | undefined,
  side: BodySide
): SideMobilityAngles {
  const empty: SideMobilityAngles = {
    head: null,
    shoulder: null,
    wrist: null,
    knee: null,
  }
  if (!landmarks) return empty
  const S = side
  return {
    head: tripleAngle(landmarks, `${S}_EAR`, 'NOSE', `${S}_SHOULDER`),
    shoulder: tripleAngle(landmarks, `${S}_ELBOW`, `${S}_SHOULDER`, `${S}_HIP`),
    wrist: tripleAngle(landmarks, `${S}_ELBOW`, `${S}_WRIST`, `${S}_INDEX`),
    knee: tripleAngle(landmarks, `${S}_HIP`, `${S}_KNEE`, `${S}_ANKLE`),
  }
}

export function mobilityMatchPct(you: number | null, ideal: number | null): number | null {
  if (you == null || ideal == null) return null
  const delta = Math.abs(you - ideal)
  return Math.max(0, Math.min(100, Math.round(100 - (delta / MATCH_REF_DEG) * 100)))
}

/**
 * Ideal-relative marker position on the gauge.
 * Ideal sits at the green center; signed error shifts the ball along the arc.
 */
export function gaugeDisplayDeg(
  joint: MobilityJointKey,
  you: number | null,
  ideal: number | null
): number | null {
  if (you == null || ideal == null) return null
  if (!Number.isFinite(you) || !Number.isFinite(ideal)) return null
  const center = GAUGE_GREEN_CENTER_DEG[joint]
  return clampGauge(center + (you - ideal) * GAUGE_ERROR_SCALE)
}

/** Active gauge wedge 0–4 for a 0–180° gauge position (5 × 36°). */
export function gaugeBinFromDeg(gaugeDeg: number | null): number | null {
  if (gaugeDeg == null || !Number.isFinite(gaugeDeg)) return null
  const clamped = Math.max(0, Math.min(GAUGE_MAX_DEG - 0.001, gaugeDeg))
  return Math.min(GAUGE_SEGMENTS - 1, Math.floor(clamped / (GAUGE_MAX_DEG / GAUGE_SEGMENTS)))
}

export function statusFromWedgeColor(
  joint: MobilityJointKey,
  bin: number | null
): MobilityStatus | null {
  if (bin == null || bin < 0 || bin > 4) return null
  const color = GAUGE_SEGMENT_COLORS_BY_JOINT[joint][bin]
  if (color === '#00FFA6') return 'good'
  if (color === '#FFDD00') return 'okay'
  if (color === '#FF0000') return 'bad'
  return null
}

export function buildJointReading(
  joint: MobilityJointKey,
  you: number | null,
  ideal: number | null
): MobilityJointReading {
  const matchPct = mobilityMatchPct(you, ideal)
  const gaugeDeg = gaugeDisplayDeg(joint, you, ideal)
  const bin = gaugeBinFromDeg(gaugeDeg)
  return {
    you,
    ideal,
    matchPct,
    gaugeDeg,
    status: statusFromWedgeColor(joint, bin),
  }
}

export function buildSideReadings(
  you: SideMobilityAngles,
  ideal: SideMobilityAngles | null
): SideMobilityReadings {
  const out = {} as SideMobilityReadings
  for (const key of MOBILITY_JOINT_KEYS) {
    out[key] = buildJointReading(key, you[key], ideal?.[key] ?? null)
  }
  return out
}

/** i18n key under `technique.bodyMobility` for the kinetic-chain blurb. */
export function mobilityBlurbKey(
  joint: MobilityJointKey,
  reading: MobilityJointReading
): string {
  const { you, ideal, status } = reading
  if (you == null) return 'blurb.noRead'
  if (ideal == null || status == null) return 'blurb.pendingIdeal'

  const short = you < ideal - 2
  const long = you > ideal + 2
  const suffix =
    status === 'good'
      ? 'good'
      : status === 'okay'
        ? short
          ? 'okayShort'
          : long
            ? 'okayLong'
            : 'okay'
        : short
          ? 'badShort'
          : long
            ? 'badLong'
            : 'bad'

  return `blurb.${joint}.${suffix}`
}

/** @deprecated Prefer mobilityBlurbKey + t(); kept for English fallback. */
export function mobilityBlurb(
  joint: MobilityJointKey,
  reading: MobilityJointReading
): string {
  const key = mobilityBlurbKey(joint, reading)
  // English fallbacks matching en.ts (used only if caller skips i18n).
  const EN: Record<string, string> = {
    'blurb.noRead': 'Keep filming so we can read this joint clearly.',
    'blurb.pendingIdeal': 'Solid read on your motion. Pro match still pending.',
    'blurb.head.good': 'Head stays quiet and tracks the ball like the pro.',
    'blurb.head.okayShort': 'Settle the head a touch. Eyes on the ball through contact.',
    'blurb.head.okayLong': 'Ease the head line toward the pro. Keep vision steady.',
    'blurb.head.okay': 'Head is close. Soften any tilt through the hit.',
    'blurb.head.badShort': 'Lift and steady the head so the chain can finish clean.',
    'blurb.head.badLong': 'Bring the head quieter toward the pro and watch the ball.',
    'blurb.head.bad': 'Steady the head. Quiet eyes help the whole kinetic chain.',
    'blurb.shoulder.good': 'Shoulder transfers power well. Keep that smooth rotation.',
    'blurb.shoulder.okayShort': 'Open the shoulder a touch so energy flows into the arm.',
    'blurb.shoulder.okayLong': 'Ease shoulder load toward the pro. Let the trunk lead.',
    'blurb.shoulder.okay': 'Shoulder is close. Lead with hips then let the arm follow.',
    'blurb.shoulder.badShort': 'Free the shoulder toward the pro so the arm is not jammed.',
    'blurb.shoulder.badLong': 'Dial the shoulder back. Power should come from the chain.',
    'blurb.shoulder.bad': 'Reset shoulder timing. Hips and trunk should load it first.',
    'blurb.wrist.good': 'Wrist tracks the pro. Keep that firm release through contact.',
    'blurb.wrist.okayShort': 'Open the wrist a touch toward the pro before release.',
    'blurb.wrist.okayLong': 'Ease the wrist toward the pro. Firm early, release late.',
    'blurb.wrist.okay': 'Wrist is close. Hold firm then snap through the ball.',
    'blurb.wrist.badShort': 'Unlock the wrist toward the pro so the second pendulum works.',
    'blurb.wrist.badLong': 'Settle the wrist. Premature snap scrubs pace and control.',
    'blurb.wrist.bad': 'Rebuild wrist timing. Firm to contact, then release clean.',
    'blurb.knee.good': 'Knee loads like the pro. Keep that athletic flex from the ground.',
    'blurb.knee.okayShort': 'Bend the knee a touch more so the legs start the chain.',
    'blurb.knee.okayLong': 'Ease knee extension toward the pro. Stay loaded, not locked.',
    'blurb.knee.okay': 'Knee is close. Hold the flex that feeds power upward.',
    'blurb.knee.badShort': 'Bend the knee more toward the pro so the chain loads from the ground.',
    'blurb.knee.badLong': 'Softer knee toward the pro. A locked leg breaks the chain.',
    'blurb.knee.bad': 'Rebuild knee flex. Legs and hips should start every stroke.',
  }
  return EN[key] ?? EN['blurb.noRead']!
}
