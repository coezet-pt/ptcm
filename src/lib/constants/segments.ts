/**
 * Segment & Application taxonomy — formal workbook taxonomy (CoEZET_PTCM_v3).
 *
 * Segments = 7 tonnage bands per `Segmentwise Sales` row 1:
 *   Rigid 12–19T, Rigid 19–28.5T, Rigid 28.5–40T, Rigid >40T,
 *   TT 31–40T, TT 40–46T, TT 46–55T
 * Bands assigned by bucket GVW (NOT body type — tippers fall into the matching
 * tonnage band; there is no separate Tipper segment).
 *
 * Applications = use-case = bucket.useCase verbatim.
 */
import { BUCKETS, type Powertrain } from './extracted';

// ── 7 segment bands ─────────────────────────────────────────────────────────
export type Segment =
  | 'Rigid 12-19T'
  | 'Rigid 19-28.5T'
  | 'Rigid 28.5-40T'
  | 'Rigid >40T'
  | 'TT 31-40T'
  | 'TT 40-46T'
  | 'TT 46-55T';

export const SEGMENTS: Segment[] = [
  'Rigid 12-19T',
  'Rigid 19-28.5T',
  'Rigid 28.5-40T',
  'Rigid >40T',
  'TT 31-40T',
  'TT 40-46T',
  'TT 46-55T',
];

/** Map GVW (kg) + body family to a segment band.
 *  Tractors → TT bands; everything else → Rigid bands (tippers included).
 */
function classifySegment(gvwKg: number, size: string): Segment {
  const t = gvwKg / 1000;
  const isTractor = /tractor/i.test(size);
  if (isTractor) {
    if (t <= 40) return 'TT 31-40T';
    if (t <= 46) return 'TT 40-46T';
    return 'TT 46-55T';
  }
  // Rigid family (includes Tipper). Bands: 12–19, 19–28.5, 28.5–40, >40 (upper-exclusive).
  if (t < 19) return 'Rigid 12-19T';
  if (t < 28.5) return 'Rigid 19-28.5T';
  if (t <= 40) return 'Rigid 28.5-40T';
  return 'Rigid >40T';
}

export const SEGMENT_OF_BUCKET: Record<string, Segment> = Object.fromEntries(
  BUCKETS.map(b => [b.id, classifySegment(b.gvw, b.size)]),
);

export const SEGMENT_COLORS: Record<Segment, string> = {
  'Rigid 12-19T':   '#93c5fd',
  'Rigid 19-28.5T': '#3b82f6',
  'Rigid 28.5-40T': '#1d4ed8',
  'Rigid >40T':     '#1e3a8a',
  'TT 31-40T':      '#fbbf24',
  'TT 40-46T':      '#f59e0b',
  'TT 46-55T':      '#b45309',
};

// ── Applications = useCase (9 categories, matches workbook verbatim) ────────
export type Application = string;

export const APPLICATIONS: Application[] = Array.from(
  new Set(BUCKETS.map(b => b.useCase)),
);

export const APPLICATION_OF_BUCKET: Record<string, Application> = Object.fromEntries(
  BUCKETS.map(b => [b.id, b.useCase]),
);

export const APPLICATION_COLORS: Record<Application, string> = {
  'Market Load':                       '#3b82f6',
  'Parcel Load and FMCG':              '#8b5cf6',
  'Perishables':                       '#06b6d4',
  'Construction & Mining':             '#f59e0b',
  'Cement (Bulkers & Bagged)':         '#a3a3a3',
  'Steel & metal products':            '#64748b',
  'Tankers - POL & CNG cascades':      '#ef4444',
  'Tankers - Non POL':                 '#ec4899',
  'LPG bullet tankers':                '#14b8a6',
};

export type BucketSalesByPT = Record<string, Record<Powertrain, number>>;
