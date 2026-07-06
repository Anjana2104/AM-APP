import React from 'react';
import { MessageOutlined, WarningOutlined, UserOutlined, BulbOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export const SECTION_META = {
  interaction: {
    label: 'Interactions',
    icon: React.createElement(MessageOutlined),
    color: '#1677ff',
    tags: ['Conversation', 'Meeting', 'Call', 'Follow-up', 'Check-in', 'Review'],
  },
  escalation: {
    label: 'Escalations',
    icon: React.createElement(WarningOutlined),
    color: '#fa541c',
    tags: ['Client Escalation', 'Internal Escalation', 'Performance Concern', 'Attendance', 'Other'],
  },
  career_preference: {
    label: 'Career',
    icon: React.createElement(UserOutlined),
    color: '#722ed1',
    tags: ['Role Preference', 'Location Preference', 'Upskilling Interest', 'Career Goal', 'Notice Period Update', 'Other'],
  },
  plan: {
    label: 'Plans',
    icon: React.createElement(BulbOutlined),
    color: '#52c41a',
    tags: ['Deployment Plan', 'Upskilling Plan', 'Retention Plan', 'Transition Plan', 'Bench Strategy', 'Note'],
  },
} as const;

export type SectionKey = keyof typeof SECTION_META;

export const LABEL_TO_SECTION: Record<string, SectionKey> = Object.fromEntries(
  (Object.entries(SECTION_META) as [SectionKey, typeof SECTION_META[SectionKey]][])
    .map(([key, meta]) => [meta.label.toLowerCase(), key])
) as Record<string, SectionKey>;

export function resolveCommentSection(tag: string): SectionKey | 'general' {
  if (!tag) return 'general';
  const t = tag.toLowerCase().trim();
  return LABEL_TO_SECTION[t] ?? 'general';
}

export const STATUS_COLOR: Record<string, string> = {
  open: 'orange',
  resolved: 'green',
  active: 'blue',
  completed: 'default',
  pending: 'purple',
  closed: 'red',
  achieved: 'cyan',
};

export const PRIORITY_COLOR: Record<string, string> = {
  low: 'default',
  medium: 'blue',
  high: 'orange',
  critical: 'red',
};

export const COMMENT_TAG_COLORS: Record<string, string> = {
  Interactions: 'blue',
  Escalations:  'red',
  Career:       'purple',
  Plans:        'green',
  General:      'default',
};

export function fmtDate(iso: string) {
  if (!iso) return '—';
  return dayjs(iso).format('DD MMM YYYY');
}

/** Truncates workex numeric value to 2 decimal places (no rounding) and appends " years". */
export function fmtWorkex(val: string | number | undefined | null): string {
  if (val == null || val === '') return '—';
  const cleaned = String(val).replace(/\s*years?\s*/gi, '').trim();
  const num = parseFloat(cleaned);
  if (isNaN(num)) return cleaned || '—';
  return `${Math.trunc(num * 100) / 100} years`;
}

export function fmtRelative(iso: string) {
  if (!iso) return '';
  return dayjs(iso).fromNow();
}

export function cleanVal(v: string | null | undefined): string {
  if (!v || v === 'null' || v === 'undefined') return '—';
  const s = String(v).trim();
  if (s === 'null' || s === 'undefined' || s === '') return '—';
  try {
    const p = JSON.parse(s);
    if (typeof p === 'string') return p || '—';
    if (typeof p === 'number' || typeof p === 'boolean') return String(p);
    return Object.entries(p as Record<string, unknown>).map(([k, val]) => `${k}: ${val}`).join(', ');
  } catch { return s; }
}
