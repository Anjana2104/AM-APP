/**
 * AccountSummary.tsx
 *
 * Executive Account Overview — landing dashboard combining Finance, Resources,
 * and Client Requests into a single executive-level view.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Spin, Tooltip, Tag, Select } from 'antd';
import html2canvas from 'html2canvas';
import {
  DollarOutlined, TeamOutlined, FileTextOutlined, ArrowUpOutlined, ArrowDownOutlined,
  ArrowRightOutlined, WarningOutlined, CheckCircleOutlined,
  RocketOutlined, TrophyOutlined,
  BankOutlined, FundOutlined, ApartmentOutlined, FilterOutlined, ReloadOutlined,
  DownOutlined, UpOutlined, ExportOutlined,
} from '@ant-design/icons';
import {
  AreaChart, Area, XAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import * as financeApi from '../api/financeApi';
import * as invoiceApi from '../api/invoiceApi';
import * as resourceApi from '../api/resourceApi';
import * as requestApi from '../api/requestApi';
import { useConfig } from '../context/ConfigContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTH_ORDER = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

function getMonthFY(label: string): { fy: number; pos: number } | null {
  const m = label.trim().match(/^([A-Za-z]{3})[''`](\d{2})$/);
  if (!m) return null;
  const pos = MONTH_ORDER.indexOf(m[1]);
  if (pos === -1) return null;
  const yr = 2000 + parseInt(m[2]);
  return { fy: pos < 3 ? yr + 1 : yr, pos };
}

/** Returns current fiscal year (e.g. 2026 for FY26). Oct/Nov/Dec roll into next year. */
function getCurrentFY(): number {
  const now = new Date();
  const month = now.getMonth(); // 0=Jan … 11=Dec
  const year = now.getFullYear();
  return month >= 9 ? year + 1 : year; // Oct(9), Nov(10), Dec(11) → next FY
}

const fmtCr = (n: number) => {
  if (!n) return '₹ 0';
  const cr = n / 1_00_00_000;
  return cr >= 0.1 ? `₹ ${cr.toFixed(1)} Cr` : `₹ ${Math.round(n).toLocaleString('en-IN')}`;
};

const fmtM = (n: number) => {
  if (!n) return '$ 0';
  const m = n / 1_000_000;
  return m >= 0.1 ? `$${m.toFixed(1)}M` : `$${Math.round(n).toLocaleString('en-US')}`;
};

const EXCHANGE = 0.013;
const toUSD = (inr: number) => inr * EXCHANGE;

/** Parses DD/MM/YYYY, MM/DD/YYYY, ISO, or any dayjs-compatible string robustly */
function parseDateStr(s: string): Date | null {
  if (!s) return null;
  // Try DD/MM/YYYY or DD-MM-YYYY first (most common from RequestManagement)
  const ddmmyyyy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const d = Number(ddmmyyyy[1]), mo = Number(ddmmyyyy[2]), yr = Number(ddmmyyyy[3]);
    // Heuristic: if day > 12 it must be DD/MM, else assume DD/MM (our stored format)
    const date = new Date(yr, mo - 1, d);
    if (!isNaN(date.getTime())) return date;
  }
  // Fallback to native Date (handles ISO strings)
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/** Returns "YYYY-MM" key for filtering/grouping */
function dateToMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Current month key dynamically computed */
function getCurrentMonthKey(): string {
  return dateToMonthKey(new Date());
}

// ─── Status label/color maps (match config values used in RequestManagement) ──
const STATUS_LABEL_MAP: Record<string, string> = {
  completed:   'Completed',
  in_progress: 'In Progress',
  not_started: 'Not Started',
  blocked:     'Blocked',
  cancelled:   'Cancelled',
};
const STATUS_PIE_COLORS: Record<string, string> = {
  completed:   '#52C41A',
  in_progress: '#FFA940',
  not_started: '#1890FF',
  blocked:     '#FF4D4F',
  cancelled:   '#8c8c8c',
};
const STATUS_PIE_FALLBACK = ['#722ED1', '#13C2C2', '#EB2F96', '#fadb14'];

function statusColor(key: string, idx: number): string {
  return STATUS_PIE_COLORS[key] ?? STATUS_PIE_FALLBACK[idx % STATUS_PIE_FALLBACK.length];
}
function KpiTile({
  icon, label, value, sub, trend, trendUp, color, onClick,
}: {
  icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode;
  trend?: string; trendUp?: boolean; color: string; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        borderRadius: 16,
        padding: '20px 24px',
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s, box-shadow 0.15s',
        borderTop: `3px solid ${color}`,
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => { if (onClick) { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 24px rgba(0,0,0,0.12)'; } }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 16px rgba(0,0,0,0.06)'; }}
    >
      <div style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: '50%', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color }}>
        {icon}
      </div>
      <div style={{ paddingRight: 44 }}>
      <div style={{ fontSize: '11px', color: '#8c8c8c', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 800, color: '#0a1e4a', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: '#8c8c8c', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
      {trend && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: '11px', color: trendUp ? '#52C41A' : '#FF7875', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {trendUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
          {trend}
        </div>
      )}
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, icon, color, children, onExplore, exploreLabel, onExport, cardRef }: {
  title: string; subtitle: string; icon: React.ReactNode; color: string;
  children: React.ReactNode; onExplore?: () => void; exploreLabel?: string;
  onExport?: () => void; cardRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const [hoverExport, setHoverExport] = React.useState(false);
  return (
    <div ref={cardRef} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid #f0f0f0', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: onExport ? 28 : 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color }}>{icon}</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1e4a', letterSpacing: '0.2px' }}>{title}</div>
            <div style={{ fontSize: '11px', color: '#8c8c8c' }}>{subtitle}</div>
          </div>
        </div>
        {onExport && (
          <Tooltip title={<span style={{ fontSize: '11px' }}>Export</span>} placement="left">
            <div
              onClick={onExport}
              onMouseEnter={() => setHoverExport(true)}
              onMouseLeave={() => setHoverExport(false)}
              style={{
                position: 'absolute', top: 14, right: 16,
                cursor: 'pointer',
                color: hoverExport ? color : '#bfbfbf',
                fontSize: 13,
                transition: 'color 0.15s',
              }}
            >
              <ExportOutlined />
            </div>
          </Tooltip>
        )}
      </div>
      <div style={{ padding: '16px 24px', flex: 1 }}>{children}</div>
      {onExplore && (
        <div style={{ padding: '12px 24px', borderTop: '1px solid #f5f5f5' }}>
          <button onClick={onExplore} style={{ background: 'none', border: 'none', cursor: 'pointer', color, fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}>
            {exploreLabel || 'Explore'} <ArrowRightOutlined />
          </button>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, badge }: { label: string; value: string; badge?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f9f9f9' }}>
      <span style={{ fontSize: '12px', color: '#595959' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0a1e4a' }}>{value}</span>
        {badge}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface AccountSummaryProps {
  onNavigate?: (page: string) => void;
}

export function AccountSummary({ onNavigate }: AccountSummaryProps) {
  const { getAppValue } = useConfig();
  const utilLowThreshold    = parseInt(getAppValue('UTIL_LOW_THRESHOLD') ?? '70', 10) || 70;
  const openAlertPct        = parseInt(getAppValue('OPEN_REQUESTS_ALERT_PCT') ?? '50', 10) || 50;

  const [loading, setLoading] = useState(true);
  const [revProjects, setRevProjects]   = useState<financeApi.FinanceProject[]>([]);
  const [revMonths,   setRevMonths]     = useState<string[]>([]);
  const [invProjects, setInvProjects]   = useState<invoiceApi.InvoiceProject[]>([]);
  const [invMonths,   setInvMonths]     = useState<string[]>([]);
  const [resources,   setResources]     = useState<resourceApi.ResourcePayload[]>([]);
  const [requests,    setRequests]      = useState<requestApi.RequestPayload[]>([]);
  const [selectedFY,  setSelectedFY]    = useState<number>(getCurrentFY());
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // '' = all months
  const [refreshKey, setRefreshKey] = useState(0);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  const financeCardRef  = useRef<HTMLDivElement>(null);
  const resourceCardRef = useRef<HTMLDivElement>(null);
  const requestCardRef  = useRef<HTMLDivElement>(null);

  const exportCard = (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
    if (!ref.current) return;
    html2canvas(ref.current, { backgroundColor: '#fff', scale: 2 }).then(canvas => {
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${filename}.png`;
      a.click();
    });
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      financeApi.getProjects().catch(() => ({ projects: [], months: [] })),
      invoiceApi.getInvoiceProjects().catch(() => ({ projects: [], months: [] })),
      resourceApi.getResources().catch(() => ({ resources: [], fromServer: false })),
      requestApi.getRequests().catch(() => ({ requests: [], fromServer: false })),
    ]).then(([rev, inv, res, req]) => {
      setRevProjects(rev.projects);
      setRevMonths(rev.months);
      setInvProjects(inv.projects);
      setInvMonths(inv.months);
      setResources(res.resources);
      setRequests(req.requests);
      setLoading(false);
    });
  }, [refreshKey]);

  // ── Available FYs from data (scalable — never hardcoded) ──────────────────
  const availableFYs = useMemo(() => {
    const fySet = new Set<number>();
    revMonths.forEach(m => { const i = getMonthFY(m); if (i) fySet.add(i.fy); });
    invMonths.forEach(m => { const i = getMonthFY(m); if (i) fySet.add(i.fy); });
    const sorted = Array.from(fySet).sort((a, b) => a - b);
    return sorted.length ? sorted : [getCurrentFY()];
  }, [revMonths, invMonths]);

  // Sync selectedFY once data loads — default to current FY if available, else latest
  useEffect(() => {
    if (availableFYs.length === 0) return;
    const cur = getCurrentFY();
    setSelectedFY(availableFYs.includes(cur) ? cur : availableFYs[availableFYs.length - 1]);
  }, [availableFYs]);

  // ── Finance metrics (revenue uses Record<string,number> keyed by month label) ─
  const financeMetrics = useMemo(() => {
    // Collect all month labels belonging to selected FY
    const fyRevMonths = revMonths.filter(m => { const i = getMonthFY(m); return i?.fy === selectedFY; });
    const fyInvMonths = invMonths.filter(m => { const i = getMonthFY(m); return i?.fy === selectedFY; });

    let totalPlanned = 0, totalInvoiced = 0;
    revProjects.forEach(p => {
      fyRevMonths.forEach(m => { totalPlanned += (p.revenue as Record<string, number>)[m] || 0; });
    });
    invProjects.forEach(p => {
      fyInvMonths.forEach(m => { totalInvoiced += (p.revenue as Record<string, number>)[m] || 0; });
    });

    // Monthly trend — show all months in selected FY that have data
    const monthlyData: { month: string; planned: number; invoiced: number }[] = [];
    fyRevMonths.forEach(m => {
      const lbl = m.replace(/[''`]/g, "'").slice(0, 3);
      const planned = revProjects.reduce((s, p) => s + ((p.revenue as Record<string, number>)[m] || 0), 0);
      const invoiced = fyInvMonths.includes(m)
        ? invProjects.reduce((s, p) => s + ((p.revenue as Record<string, number>)[m] || 0), 0)
        : 0;
      if (lbl) monthlyData.push({ month: lbl, planned, invoiced });
    });

    const coverage = totalPlanned ? Math.round((totalInvoiced / totalPlanned) * 100) : 0;
    return { totalPlanned, totalInvoiced, coverage, monthlyData, projectCount: revProjects.length };
  }, [revProjects, revMonths, invProjects, invMonths, selectedFY]);

  // ── Resource metrics ───────────────────────────────────────────────────────
  const resourceMetrics = useMemo(() => {
    const total = resources.length;
    const onBench = resources.filter(r => r.engagement?.toLowerCase() === 'bench').length;
    const active = total - onBench;
    const engagementMap = new Map<string, number>();
    resources.forEach(r => {
      const eng = r.engagement || 'Unknown';
      engagementMap.set(eng, (engagementMap.get(eng) || 0) + 1);
    });
    const engagementData = Array.from(engagementMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    const roleMap = new Map<string, number>();
    resources.forEach(r => { const role = r.piwRole || 'Other'; roleMap.set(role, (roleMap.get(role) || 0) + 1); });
    const topRoles = Array.from(roleMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
    return { total, active, onBench, engagementData, topRoles, utilPct: total ? Math.round((active / total) * 100) : 0 };
  }, [resources]);

  // ── Available months for request filter ───────────────────────────────────
  const availableRequestMonths = useMemo(() => {
    const monthSet = new Map<string, string>(); // key → display label
    requests.forEach(r => {
      if (!r.dateRaised) return;
      const d = parseDateStr(r.dateRaised);
      if (!d) return;
      const key = dateToMonthKey(d);
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      monthSet.set(key, label);
    });
    return Array.from(monthSet.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([value, label]) => ({ value, label }));
  }, [requests]);

  // ── Request metrics ────────────────────────────────────────────────────────
  const requestMetrics = useMemo(() => {
    // Filter by selected month if set
    const filtered = selectedMonth
      ? requests.filter(r => {
          if (!r.dateRaised) return false;
          const d = parseDateStr(r.dateRaised);
          return d ? dateToMonthKey(d) === selectedMonth : false;
        })
      : requests;

    const total = filtered.length;
    // Closed = overallStatus is "completed" (any casing). Open = everything else.
    const closed = filtered.filter(r => r.overallStatus?.toLowerCase() === 'completed').length;
    const open = total - closed;

    const statusMap = new Map<string, number>();
    filtered.forEach(r => {
      const s = r.overallStatus || r.processingStatus || 'Unknown';
      statusMap.set(s, (statusMap.get(s) || 0) + 1);
    });
    const byType = Array.from(statusMap.entries())
      .map(([key, count]) => ({
        key,
        name: STATUS_LABEL_MAP[key] ?? key,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // This month — always computed dynamically against current real date
    const curMonthKey = getCurrentMonthKey();
    const thisMonth = requests.filter(r => {
      if (!r.dateRaised) return false;
      const d = parseDateStr(r.dateRaised);
      return d ? dateToMonthKey(d) === curMonthKey : false;
    }).length;
    const thisMonthClosed = requests.filter(r => {
      if (!r.dateRaised) return false;
      const d = parseDateStr(r.dateRaised);
      return d ? dateToMonthKey(d) === curMonthKey && r.overallStatus?.toLowerCase() === 'completed' : false;
    }).length;

    return { total, open, closed, byType, thisMonth, thisMonthClosed };
  }, [requests, selectedMonth]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="Loading Account Overview…" />
      </div>
    );
  }

  const PIE_COLORS = ['#1890FF', '#52C41A', '#FFA940', '#722ED1', '#13C2C2', '#EB2F96'];

  return (
    <div style={{ padding: '0 0 40px', maxWidth: 1200, margin: '0 auto', minWidth: 0, position: 'relative' }}>

      {/* ── Refresh icon — top right, white, icon-only ── */}
      <div
        onClick={() => setRefreshKey(k => k + 1)}
        title="Refresh data"
        style={{
          position: 'absolute', top: 12, right: 12, zIndex: 10,
          cursor: 'pointer', color: '#fff', fontSize: 16,
          opacity: loading ? 1 : 0.7,
          transition: 'opacity 0.2s',
          animation: loading ? 'spin 1s linear infinite' : 'none',
        }}
      >
        <ReloadOutlined />
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* ── Hero Header ── */}
      <div style={{
        textAlign: 'center',
        padding: headerCollapsed ? '12px 24px 0' : '28px 24px 0',
        background: 'linear-gradient(135deg, #0a1e4a 0%, #1a3a6e 50%, #0d2d5e 100%)',
        borderRadius: '0 0 20px 20px',
        marginBottom: 20,
        position: 'relative',
        overflow: 'hidden',
        transition: 'padding 0.25s ease',
      }}>
        {/* decorative blobs — hidden when collapsed */}
        {!headerCollapsed && <>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(24,144,255,0.12)' }} />
          <div style={{ position: 'absolute', bottom: -20, left: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(82,196,26,0.08)' }} />
        </>}

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Executive View badge — always visible */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: headerCollapsed ? 0 : 8 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: '3px 12px' }}>
              <RocketOutlined style={{ color: '#60a5fa', fontSize: 11 }} />
              <span style={{ color: '#93c5fd', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>Executive View</span>
            </div>
          </div>

          {/* Expandable content */}
          {!headerCollapsed && (
            <>
              <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', margin: '8px 0 6px', letterSpacing: '-0.5px' }}>
                Executive Account Overview
              </h1>
              <div style={{ width: 40, height: 3, background: '#1890FF', borderRadius: 2, margin: '0 auto 8px' }} />
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: '0 0 4px' }}>
                Finance · Resources · Client Engagement — at a glance
              </p>
            </>
          )}
        </div>

        {/* Collapse toggle — centred at bottom of header, icon only */}
        <div
          onClick={() => setHeaderCollapsed(c => !c)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '6px 0 10px',
            cursor: 'pointer',
            position: 'relative', zIndex: 1,
          }}
        >
          <div style={{
            width: 28, height: 28,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.1)', borderRadius: '50%',
            color: 'rgba(255,255,255,0.6)',
            transition: 'background 0.2s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
          >
            {headerCollapsed ? <UpOutlined style={{ fontSize: 11 }} /> : <DownOutlined style={{ fontSize: 11 }} />}
          </div>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 28, padding: '0 8px' }}>
        <KpiTile
          icon={<DollarOutlined />} color="#1890FF"
          label="Planned Revenue" value={fmtM(toUSD(financeMetrics.totalPlanned))}
          sub={
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
              <span style={{ whiteSpace: 'nowrap', color: '#8c8c8c' }}>{fmtCr(financeMetrics.totalPlanned)}</span>
              <Select
                value={selectedFY}
                onChange={setSelectedFY}
                size="small"
                variant="borderless"
                style={{ minWidth: 60, maxWidth: 72, color: '#1890FF', fontWeight: 700, fontSize: '11px' }}
                styles={{ popup: { root: { minWidth: 80 } } }}
                options={availableFYs.map(fy => ({ value: fy, label: `FY${String(fy).slice(-2)}` }))}
                onClick={e => e.stopPropagation()}
              />
            </span>
          }
        />
        <KpiTile
          icon={<BankOutlined />} color="#52C41A"
          label="Total Invoiced" value={fmtM(toUSD(financeMetrics.totalInvoiced))}
          sub={`${fmtCr(financeMetrics.totalInvoiced)} · ${financeMetrics.coverage}%`}
          trend={financeMetrics.coverage >= 70 ? 'On track' : 'Needs attention'}
          trendUp={financeMetrics.coverage >= 70}
          onClick={() => onNavigate?.('executive_invoicing')}
        />
        <KpiTile
          icon={<TeamOutlined />} color="#722ED1"
          label="Total Resources" value={`${resourceMetrics.total}`}
          sub={
            <span>
              <span style={{ color: '#52C41A', fontWeight: 600 }}>{resourceMetrics.active} active</span>
              {' · '}
              <span style={{ color: resourceMetrics.utilPct < utilLowThreshold ? '#FF4D4F' : '#FFA940', fontWeight: 600 }}>
                {resourceMetrics.onBench} bench
              </span>
            </span>
          }
          onClick={() => onNavigate?.('resources_info')}
        />
        <KpiTile
          icon={<ApartmentOutlined />} color="#FFA940"
          label="Resource Utilisation"
          value={<span style={{ color: resourceMetrics.utilPct < utilLowThreshold ? '#FF4D4F' : undefined }}>{resourceMetrics.utilPct}%</span>}
          sub={`${resourceMetrics.total} team members`}
          onClick={() => onNavigate?.('resources_utilization')}
        />
        <KpiTile
          icon={<FileTextOutlined />} color="#EB2F96"
          label="Client Requests" value={`${requestMetrics.total}`}
          sub={
            <span>
              <span style={{ color: requestMetrics.total && (requestMetrics.open / requestMetrics.total * 100) > openAlertPct ? '#FF4D4F' : '#1890FF', fontWeight: 600 }}>
                {requestMetrics.open} open
              </span>
              {' · '}
              <span style={{ color: '#52C41A', fontWeight: 600 }}>{requestMetrics.closed} closed</span>
            </span>
          }
          onClick={() => onNavigate?.('clientmgmt_requests')}
        />
      </div>

      {/* ── Three Panel Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, padding: '0 8px', marginBottom: 24 }}>

        {/* Finance Snapshot */}
        <SectionCard
          title="Finance Snapshot"
          subtitle="Planned vs Invoiced overview"
          icon={<FundOutlined />} color="#1890FF"
          onExplore={() => onNavigate?.('executive_summary')} exploreLabel="Explore Finance"
          onExport={() => exportCard(financeCardRef, 'finance-snapshot')}
          cardRef={financeCardRef}
        >
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            <div style={{ flex: 1, background: '#e6f4ff', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#1890FF', fontWeight: 600 }}>Planned</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#0a1e4a' }}>{fmtM(toUSD(financeMetrics.totalPlanned))}</div>
            </div>
            <div style={{ flex: 1, background: '#f6ffed', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#52C41A', fontWeight: 600 }}>Invoiced</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#0a1e4a' }}>{fmtM(toUSD(financeMetrics.totalInvoiced))}</div>
            </div>
          </div>
          {/* Coverage bar */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '11px', color: '#8c8c8c' }}>Invoice Coverage</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: financeMetrics.coverage >= 70 ? '#52C41A' : '#FFA940' }}>{financeMetrics.coverage}%</span>
            </div>
            <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, financeMetrics.coverage)}%`, background: financeMetrics.coverage >= 70 ? '#52C41A' : financeMetrics.coverage >= 40 ? '#FFA940' : '#FF7875', borderRadius: 3, transition: 'width 0.6s ease' }} />
            </div>
          </div>
          {/* Mini area chart */}
          {financeMetrics.monthlyData.length > 0 && (
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={financeMetrics.monthlyData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gPlan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1890FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1890FF" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gInv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#52C41A" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#52C41A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <RTooltip formatter={(v: number) => [fmtCr(v)]} contentStyle={{ fontSize: '10px', borderRadius: 6 }} />
                <Area type="monotone" dataKey="planned" stroke="#1890FF" strokeWidth={1.5} fill="url(#gPlan)" dot={false} />
                <Area type="monotone" dataKey="invoiced" stroke="#52C41A" strokeWidth={1.5} fill="url(#gInv)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <StatRow label="Active Projects" value={`${financeMetrics.projectCount}`} />
          <StatRow label="Billing Gap" value={fmtM(toUSD(financeMetrics.totalPlanned - financeMetrics.totalInvoiced))}
            badge={<span style={{ fontSize: '10px', color: '#FF7875' }}>under-invoiced</span>} />
        </SectionCard>

        {/* Resource Overview */}
        <SectionCard
          title="Resource Overview"
          subtitle="Team utilisation & bench strength"
          icon={<TeamOutlined />} color="#722ED1"
          onExplore={() => onNavigate?.('resources_info')} exploreLabel="Explore Resources"
          onExport={() => exportCard(resourceCardRef, 'resource-overview')}
          cardRef={resourceCardRef}
        >
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            {[
              { label: 'Total', val: resourceMetrics.total, color: '#722ED1', bg: '#f9f0ff' },
              { label: 'Active', val: resourceMetrics.active, color: '#52C41A', bg: '#f6ffed' },
              { label: 'Bench', val: resourceMetrics.onBench, color: resourceMetrics.utilPct < utilLowThreshold ? '#FF4D4F' : '#FFA940', bg: resourceMetrics.utilPct < utilLowThreshold ? '#fff1f0' : '#fffbe6' },
            ].map(m => (
              <div key={m.label} style={{ flex: 1, background: m.bg, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: m.color, fontWeight: 600 }}>{m.label}</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: m.label === 'Bench' && resourceMetrics.utilPct < utilLowThreshold ? '#FF4D4F' : '#0a1e4a' }}>{m.val}</div>
              </div>
            ))}
          </div>
          {resourceMetrics.engagementData.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <ResponsiveContainer width={100} height={100}>
                <PieChart>
                  <Pie data={resourceMetrics.engagementData} dataKey="value" cx="50%" cy="50%" outerRadius={45} innerRadius={25}>
                    {resourceMetrics.engagementData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip contentStyle={{ fontSize: '10px', borderRadius: 6 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {resourceMetrics.engagementData.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span style={{ fontSize: '10px', color: '#595959' }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#0a1e4a' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#bfbfbf', fontSize: '12px', padding: '16px 0' }}>No resource data</div>
          )}
          <StatRow label="Utilisation Rate" value={`${resourceMetrics.utilPct}%`}
            badge={<span style={{ fontSize: '10px', color: resourceMetrics.utilPct >= utilLowThreshold ? '#52C41A' : '#FF4D4F' }}>{resourceMetrics.utilPct >= utilLowThreshold ? '✓ Healthy' : '⚠ Low'}</span>}
          />
        </SectionCard>

        {/* Client Requests Overview */}
        <SectionCard
          title="Client Requests"
          subtitle="Incoming requests & engagement status"
          icon={<FileTextOutlined />} color="#EB2F96"
          onExplore={() => onNavigate?.('clientmgmt_requests')} exploreLabel="Explore Requests"
          onExport={() => exportCard(requestCardRef, 'client-requests')}
          cardRef={requestCardRef}
        >
          {/* Month filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: '11px', color: '#8c8c8c' }}>Month:</span>
            <Select
              value={selectedMonth || undefined}
              onChange={v => setSelectedMonth(v ?? '')}
              allowClear
              placeholder="All months"
              size="small"
              style={{ flex: 1, fontSize: '11px' }}
              options={availableRequestMonths}
              showSearch
              filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            {[
              { label: 'Total', val: requestMetrics.total, color: '#595959', bg: '#fafafa' },
              { label: 'Open', val: requestMetrics.open, color: requestMetrics.total && (requestMetrics.open / requestMetrics.total * 100) > openAlertPct ? '#FF4D4F' : '#1890FF', bg: requestMetrics.total && (requestMetrics.open / requestMetrics.total * 100) > openAlertPct ? '#fff1f0' : '#e6f4ff' },
              { label: 'Closed', val: requestMetrics.closed, color: '#52C41A', bg: '#f6ffed' },
            ].map(m => (
              <div key={m.label} style={{ flex: 1, background: m.bg, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: m.color, fontWeight: 600 }}>{m.label}</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: m.color }}>{m.val}</div>
              </div>
            ))}
          </div>
          {requestMetrics.byType.length > 0 ? (
            <>
              <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 6, fontWeight: 600 }}>By Status</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ResponsiveContainer width={100} height={100}>
                  <PieChart>
                    <Pie
                      data={requestMetrics.byType}
                      dataKey="count"
                      nameKey="name"
                      cx="50%" cy="50%"
                      innerRadius={28} outerRadius={44}
                      strokeWidth={0}
                    >
                      {requestMetrics.byType.map((d, i) => (
                        <Cell key={d.key} fill={statusColor(d.key, i)} />
                      ))}
                    </Pie>
                    <RTooltip contentStyle={{ fontSize: '10px', borderRadius: 6 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {requestMetrics.byType.map((d, i) => (
                    <div key={d.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor(d.key, i), flexShrink: 0 }} />
                        <span style={{ fontSize: '10px', color: '#595959' }}>{d.name}</span>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#0a1e4a' }}>{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: '#bfbfbf', fontSize: '12px', padding: '16px 0' }}>No request data</div>
          )}
          <StatRow
            label="This Month (New)"
            value={`${requestMetrics.thisMonth}`}
            badge={requestMetrics.thisMonthClosed > 0
              ? <span style={{ fontSize: '10px', color: '#52C41A' }}>{requestMetrics.thisMonthClosed} closed</span>
              : undefined}
          />
        </SectionCard>
      </div>

      {/* ── Insights + Focus Areas ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, padding: '0 8px' }}>

        {/* Executive Insights */}
        <div style={{ background: 'linear-gradient(135deg, #0a1e4a 0%, #1a3a6e 100%)', borderRadius: 16, padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RocketOutlined style={{ color: '#93c5fd', fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Executive Insights</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Auto-generated from live data</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              {
                icon: <DollarOutlined />,
                color: '#60a5fa',
                text: (() => {
                  if (!financeMetrics.totalPlanned) return 'No revenue data for this FY. Upload data in SOW Details.';
                  const gap = financeMetrics.totalPlanned - financeMetrics.totalInvoiced;
                  const fyTag = `FY${String(selectedFY).slice(-2)}`;
                  if (financeMetrics.coverage >= 90) return `Excellent billing health — ${financeMetrics.coverage}% of planned ${fmtM(toUSD(financeMetrics.totalPlanned))} already invoiced in ${fyTag}. On course to close the year strong.`;
                  if (financeMetrics.coverage >= 70) return `${fyTag} billing on track at ${financeMetrics.coverage}% coverage. ${fmtM(toUSD(gap))} outstanding — maintain invoicing cadence.`;
                  if (financeMetrics.coverage >= 40) return `${fyTag} invoice coverage at ${financeMetrics.coverage}% — moderate gap of ${fmtM(toUSD(gap))}. Accelerate billing on active projects to close the shortfall.`;
                  return `Critical: only ${financeMetrics.coverage}% of ${fyTag} planned revenue (${fmtM(toUSD(financeMetrics.totalPlanned))}) has been invoiced. Immediate billing action required — ${fmtM(toUSD(gap))} at risk.`;
                })(),
              },
              {
                icon: <TeamOutlined />,
                color: '#86efac',
                text: (() => {
                  if (!resourceMetrics.total) return 'No resource data loaded. Upload in Resource Information.';
                  const utilPct = resourceMetrics.utilPct;
                  if (utilPct >= 90) return `High utilisation at ${utilPct}% — all ${resourceMetrics.active} active resources deployed. Monitor workload to prevent burnout; plan ahead for pipeline demand.`;
                  if (utilPct >= 70) return `Team utilisation healthy at ${utilPct}%. ${resourceMetrics.active} engaged, ${resourceMetrics.onBench} on bench. ${resourceMetrics.onBench > 0 ? 'Review bench pipeline for upcoming opportunities.' : 'Capacity is well-balanced.'}`;
                  return `Utilisation at ${utilPct}% — ${resourceMetrics.onBench} resource${resourceMetrics.onBench > 1 ? 's' : ''} on bench out of ${resourceMetrics.total} total. Action needed to deploy bench strength onto active projects.`;
                })(),
              },
              {
                icon: <FileTextOutlined />,
                color: '#f9a8d4',
                text: (() => {
                  if (!requestMetrics.total) return 'No client request data available yet.';
                  const pct = requestMetrics.total ? Math.round((requestMetrics.closed / requestMetrics.total) * 100) : 0;
                  if (pct >= 80) return `Strong request management — ${pct}% closure rate (${requestMetrics.closed}/${requestMetrics.total}). ${requestMetrics.open} open request${requestMetrics.open !== 1 ? 's' : ''} in progress. ${requestMetrics.thisMonth} new this month.`;
                  if (pct >= 50) return `${requestMetrics.open} open client request${requestMetrics.open !== 1 ? 's' : ''} out of ${requestMetrics.total} total (${pct}% closed). Schedule review to improve response time.`;
                  return `Attention required: ${requestMetrics.open} open requests with only ${pct}% overall closure rate. Prioritise resolution to maintain client satisfaction. ${requestMetrics.thisMonth} new request${requestMetrics.thisMonth !== 1 ? 's' : ''} raised this month.`;
                })(),
              },
            ].map((ins, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ marginTop: 2, width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, color: ins.color }}>
                  {ins.icon}
                </div>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px', margin: 0, lineHeight: 1.6 }}>{ins.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Key Focus Areas */}
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <TrophyOutlined style={{ fontSize: 18, color: '#FFA940' }} />
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1e4a' }}>Key Focus Areas</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(() => {
              const fyTag = `FY${String(selectedFY).slice(-2)}`;
              const gap = financeMetrics.totalPlanned - financeMetrics.totalInvoiced;
              const items = [
                {
                  dot: financeMetrics.coverage < 60 ? '#FF4D4F' : financeMetrics.coverage < 80 ? '#FFA940' : '#52C41A',
                  icon: <DollarOutlined />,
                  title: financeMetrics.coverage < 80 ? 'Accelerate Invoicing' : 'Maintain Billing Momentum',
                  text: financeMetrics.totalPlanned === 0
                    ? `Upload ${fyTag} revenue data to track billing performance`
                    : financeMetrics.coverage < 80
                      ? `${fyTag}: ${fmtM(toUSD(gap))} billing gap at ${financeMetrics.coverage}% coverage across ${financeMetrics.projectCount} projects`
                      : `Invoice coverage strong at ${financeMetrics.coverage}% — ensure timely closure for remaining ${fmtM(toUSD(gap > 0 ? gap : 0))}`,
                },
                {
                  dot: resourceMetrics.onBench > 3 ? '#FF4D4F' : resourceMetrics.onBench > 0 ? '#FFA940' : '#52C41A',
                  icon: <TeamOutlined />,
                  title: resourceMetrics.onBench > 0 ? 'Resource Deployment' : 'Capacity Planning',
                  text: resourceMetrics.total === 0
                    ? 'Upload resource data to monitor team utilisation'
                    : resourceMetrics.onBench > 0
                      ? `${resourceMetrics.onBench} resource${resourceMetrics.onBench > 1 ? 's' : ''} on bench (${resourceMetrics.total - resourceMetrics.onBench}/${resourceMetrics.total} deployed at ${resourceMetrics.utilPct}%) — align with upcoming demand`
                      : `All ${resourceMetrics.total} resources deployed at ${resourceMetrics.utilPct}% utilisation — forecast capacity for future pipeline`,
                },
                {
                  dot: requestMetrics.open > 5 ? '#FF4D4F' : requestMetrics.open > 0 ? '#FFA940' : '#52C41A',
                  icon: <FileTextOutlined />,
                  title: requestMetrics.open > 0 ? 'Request Resolution' : 'Client Engagement',
                  text: requestMetrics.total === 0
                    ? 'Log client requests to track engagement and response metrics'
                    : requestMetrics.open > 0
                      ? `${requestMetrics.open} open request${requestMetrics.open > 1 ? 's' : ''} pending — ${Math.round((requestMetrics.closed / requestMetrics.total) * 100)}% closure rate; drive resolution to improve SLA`
                      : `All ${requestMetrics.total} requests closed — ${requestMetrics.thisMonth} new this month. Keep engagement cadence high`,
                },
              ];
              return items.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', background: '#fafafa', borderRadius: 10, borderLeft: `3px solid ${f.dot}` }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${f.dot}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, color: f.dot }}>
                    {f.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0a1e4a', marginBottom: 2 }}>{f.title}</div>
                    <div style={{ fontSize: '11px', color: '#595959', lineHeight: 1.5 }}>{f.text}</div>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

    </div>
  );
}
