/**
 * Shared allocation percentage colour helpers.
 * Rule: >100% → red (overutilized), consistent everywhere.
 *
 * Ant Design semantic colours used:
 *   0%         → success (green)   #52c41a
 *   1–49%      → warning (yellow)  #faad14
 *   50–99%     → processing (blue) #1890ff
 *   >=100%     → error (red)       #ff4d4f  ← fully allocated / overutilized
 */
import React from 'react';
import { Tag, Tooltip } from 'antd';

/** Returns the Ant Design Tag color preset for an allocation percentage. */
export function allocPctColor(pct: number): string {
  if (pct > 100)  return 'error';      // red — overutilized
  if (pct === 100) return 'success';   // green — fully allocated
  if (pct >= 50)  return 'processing'; // blue
  if (pct > 0)    return 'warning';    // yellow
  return 'default';                    // grey — unallocated
}

/** Returns the hex colour for inline styles (non-Tag use). */
export function allocPctHex(pct: number): string {
  if (pct > 100)  return '#ff4d4f';
  if (pct === 100) return '#52c41a';
  if (pct >= 50)  return '#1890ff';
  if (pct > 0)    return '#faad14';
  return '#8c8c8c';
}

/** Returns the hex background colour for inline badge use. */
export function allocPctBg(pct: number): string {
  if (pct > 100)  return '#fff1f0';
  if (pct === 100) return '#f6ffed';
  if (pct >= 50)  return '#f0f5ff';
  if (pct > 0)    return '#fffbe6';
  return '#fafafa';
}

/** Returns the hex border colour for inline badge use. */
export function allocPctBorder(pct: number): string {
  if (pct > 100)  return '#ffccc7';
  if (pct === 100) return '#b7eb8f';
  if (pct >= 50)  return '#adc6ff';
  if (pct > 0)    return '#ffe58f';
  return '#d9d9d9';
}

/** Renders a Tag with consistent colours and an overutilization tooltip when >100%. */
export function AllocPctTag({ pct, style }: { pct: number | null | undefined; style?: React.CSSProperties }) {
  if (pct == null) return <span style={{ color: '#bbb', fontSize: '11px' }}>—</span>;
  const tag = (
    <Tag color={allocPctColor(pct)} style={{ fontSize: '10px', margin: 0, fontWeight: 600, ...style }}>
      {pct}%
    </Tag>
  );
  if (pct > 100) return <Tooltip title={`Overutilized (${pct}%)`}>{tag}</Tooltip>;
  if (pct === 100) return <Tooltip title="Fully Allocated">{tag}</Tooltip>;
  return tag;
}

/** Renders a small inline badge (non-Tag) for compact spaces like card headers. */
export function AllocPctBadge({ pct, style }: { pct: number | null | undefined; style?: React.CSSProperties }) {
  if (pct == null) return null;
  const badge = (
    <span style={{
      fontSize: '8px', padding: '0 5px', lineHeight: '14px', borderRadius: 3,
      background: allocPctBg(pct), color: allocPctHex(pct),
      border: `1px solid ${allocPctBorder(pct)}`, fontWeight: 600,
      ...style,
    }}>
      {pct}%
    </span>
  );
  if (pct > 100) return <Tooltip title="Overutilized">{badge}</Tooltip>;
  return badge;
}
