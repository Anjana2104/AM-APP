/**
 * FinanceSummary.tsx
 *
 * Executive-level Finance Summary — compares planned revenue (Revenue Details)
 * vs actual invoiced amounts (Invoicing Details) across projects, companies, FYs.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Card, Col, Row, Select, Spin, Empty, Tag, Progress, Table, Tooltip,
  Alert, Space, Typography, Segmented, Button, InputNumber,
} from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, DollarOutlined, DownloadOutlined,
  FileExcelOutlined, FileTextOutlined, WarningOutlined, CheckCircleOutlined,
  ClockCircleOutlined, TrophyOutlined, ExportOutlined,
} from '@ant-design/icons';
import html2canvas from 'html2canvas';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  Legend, ResponsiveContainer, Cell, LineChart, Line, ReferenceLine,
} from 'recharts';
import * as financeApi from '../api/financeApi';
import * as invoiceApi from '../api/invoiceApi';

const { Text } = Typography;

// ─── Fiscal year helpers ──────────────────────────────────────────────────────
const MONTH_ORDER = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

function getMonthFY(label: string): { fy: number; pos: number } | null {
  const m = label.trim().match(/^([A-Za-z]{3})[''`](\d{2})$/);
  if (!m) return null;
  const pos = MONTH_ORDER.indexOf(m[1]);
  if (pos === -1) return null;
  const yr = 2000 + parseInt(m[2]);
  return { fy: pos < 3 ? yr + 1 : yr, pos };
}

function fyMonthLabel(fyNum: number, pos: number): string {
  const mName = MONTH_ORDER[pos];
  const yr = pos < 3 ? fyNum - 1 : fyNum;
  return `${mName}'${String(yr % 100).padStart(2, '0')}`;
}

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmtINR(n: number) {
  if (!n) return '₹ 0';
  return `₹ ${Math.round(n).toLocaleString('en-IN')}`;
}
function fmtCrINR(n: number) {
  const cr = n / 1_00_00_000;
  return cr >= 0.1 ? `₹ ${cr.toFixed(2)} Cr` : fmtINR(n);
}
function fmtUSD(n: number, rate: number) {
  const v = n * rate;
  if (!v) return '$ 0';
  if (v >= 1_000_000) return `$ ${(v / 1_000_000).toFixed(2)} M`;
  if (v >= 1_000)     return `$ ${Math.round(v).toLocaleString('en-US')}`;
  return `$ ${v.toFixed(0)}`;
}
function fmtPct(num: number, denom: number) {
  if (!denom) return '—';
  return `${Math.round((num / denom) * 100)}%`;
}
function pct(num: number, denom: number) {
  if (!denom) return 0;
  return Math.round((num / denom) * 100);
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KPICard({
  title, value, sub, icon, color, badge, tooltip,
}: {
  title: string; value: string; sub?: string; icon?: React.ReactNode;
  color?: string; badge?: React.ReactNode; tooltip?: string;
}) {
  return (
    <Tooltip title={tooltip} overlayInnerStyle={{ fontSize: '11px' }}>
      <Card
        style={{ border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', borderRadius: 10, height: '100%' }}
        bodyStyle={{ padding: '16px 18px' }}
        hoverable
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '11px', color: '#8c8c8c', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</div>
          {badge}
        </div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: color || '#001529', margin: '6px 0 2px', lineHeight: 1.2 }}>{value}</div>
        {sub && <div style={{ fontSize: '11px', color: '#8c8c8c' }}>{sub}</div>}
        {icon && <div style={{ position: 'absolute', right: 16, top: 16, opacity: 0.08, fontSize: 40, color: '#001529' }}>{icon}</div>}
      </Card>
    </Tooltip>
  );
}

// ─── Status badge for coverage ───────────────────────────────────────────────
function CoverageBadge({ pct: p }: { pct: number }) {
  if (p >= 90) return <Tag color="success" style={{ fontSize: '10px' }}>On Track</Tag>;
  if (p >= 60) return <Tag color="warning" style={{ fontSize: '10px' }}>Partial</Tag>;
  if (p > 0)   return <Tag color="error"   style={{ fontSize: '10px' }}>Low</Tag>;
  return            <Tag color="default"  style={{ fontSize: '10px' }}>None</Tag>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
function CardExportIcon({ onExport }: { onExport: () => void }) {
  const [hov, setHov] = React.useState(false);
  return (
    <Tooltip title={<span style={{ fontSize: '11px' }}>Export</span>} placement="left">
      <ExportOutlined
        onClick={onExport}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{ fontSize: 13, color: hov ? '#1890FF' : '#bfbfbf', cursor: 'pointer', transition: 'color 0.15s' }}
      />
    </Tooltip>
  );
}

interface FinanceSummaryProps {
  onNavigate?: (page: 'executive_revenue' | 'executive_invoicing') => void;
}

export function FinanceSummary({ onNavigate }: FinanceSummaryProps) {
  const [loading, setLoading] = useState(true);
  const pageRef = useRef<HTMLDivElement>(null);

  // Raw server data
  const [revProjects, setRevProjects] = useState<financeApi.FinanceProject[]>([]);
  const [revMonths,   setRevMonths]   = useState<string[]>([]);
  const [invProjects, setInvProjects] = useState<invoiceApi.InvoiceProject[]>([]);
  const [invMonths,   setInvMonths]   = useState<string[]>([]);

  // Filters
  const [filterFY,      setFilterFY]      = useState<number | null>(null);
  const [filterCompany, setFilterCompany] = useState<string | null>(null);
  const [viewMode,      setViewMode]      = useState<'company' | 'project'>('company');
  const [currency,      setCurrency]      = useState<'INR' | 'USD'>('USD');
  const [exchangeRate,  setExchangeRate]  = useState<number>(0.013);
  const [exporting,     setExporting]     = useState(false);

  // Per-card export refs
  const monthlyRef    = useRef<HTMLDivElement>(null);
  const quarterlyRef  = useRef<HTMLDivElement>(null);
  const breakdownRef  = useRef<HTMLDivElement>(null);
  const cumulativeRef = useRef<HTMLDivElement>(null);

  const exportCard = (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
    if (!ref.current) return;
    html2canvas(ref.current, { backgroundColor: '#fff', scale: 2, useCORS: true }).then(canvas => {
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${filename}.png`;
      a.click();
    });
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      financeApi.getProjects(),
      invoiceApi.getInvoiceProjects(),
    ]).then(([rev, inv]) => {
      setRevProjects(rev.projects);
      setRevMonths(rev.months);
      setInvProjects(inv.projects);
      setInvMonths(inv.months);
      setLoading(false);
    });
  }, []);

  // ── Derive available FYs from union of both month sets ──────────────────────
  const allFYs = useMemo(() => {
    const fy = new Set<number>();
    [...revMonths, ...invMonths].forEach(m => {
      const info = getMonthFY(m);
      if (info) fy.add(info.fy);
    });
    return Array.from(fy).sort();
  }, [revMonths, invMonths]);

  // Auto-select first FY
  useEffect(() => {
    if (allFYs.length && filterFY === null) setFilterFY(allFYs[0]);
  }, [allFYs]);

  // ── Companies from both datasets ────────────────────────────────────────────
  const companies = useMemo(() => {
    const s = new Set<string>();
    [...revProjects, ...invProjects].forEach(p => { if (p.company?.trim()) s.add(p.company.trim()); });
    return Array.from(s).sort();
  }, [revProjects, invProjects]);

  // ── Planned revenue for a project in given FY months ───────────────────────
  function sumForFY(revenue: Record<string, number>, fyNum: number): number {
    return MONTH_ORDER.reduce((t, _, pos) => {
      const lbl = fyMonthLabel(fyNum, pos);
      return t + (revenue[lbl] || 0);
    }, 0);
  }

  // ── Aggregate helper: return { planned, invoiced } keyed by groupKey ─────────
  const grouped = useMemo(() => {
    if (!filterFY) return { byCompany: [], byProject: [], totPlanned: 0, totInvoiced: 0 };

    const revFiltered = filterCompany
      ? revProjects.filter(p => p.company?.trim() === filterCompany)
      : revProjects;
    const invFiltered = filterCompany
      ? invProjects.filter(p => p.company?.trim() === filterCompany)
      : invProjects;

    // By project code
    const byCode = new Map<string, { name: string; company: string; planned: number; invoiced: number }>();

    revFiltered.forEach(p => {
      const planned = sumForFY(p.revenue, filterFY);
      const existing = byCode.get(p.code) || { name: p.project, company: p.company || '', planned: 0, invoiced: 0 };
      byCode.set(p.code, { ...existing, planned: existing.planned + planned });
    });

    invFiltered.forEach(p => {
      const invoiced = sumForFY(p.revenue, filterFY);
      const existing = byCode.get(p.code) || { name: p.project, company: p.company || '', planned: 0, invoiced: 0 };
      byCode.set(p.code, { ...existing, invoiced: existing.invoiced + invoiced });
    });

    const byProject = Array.from(byCode.entries()).map(([code, d]) => ({
      code,
      ...d,
      gap: d.planned - d.invoiced,
      coverage: pct(d.invoiced, d.planned),
    })).sort((a, b) => b.planned - a.planned);

    // By company
    const companyMap = new Map<string, { planned: number; invoiced: number; projects: number }>();
    byProject.forEach(p => {
      const co = p.company || '(Unknown)';
      const ex = companyMap.get(co) || { planned: 0, invoiced: 0, projects: 0 };
      companyMap.set(co, {
        planned: ex.planned + p.planned,
        invoiced: ex.invoiced + p.invoiced,
        projects: ex.projects + 1,
      });
    });
    const byCompany = Array.from(companyMap.entries()).map(([company, d]) => ({
      company,
      ...d,
      gap: d.planned - d.invoiced,
      coverage: pct(d.invoiced, d.planned),
    })).sort((a, b) => b.planned - a.planned);

    const totPlanned  = byProject.reduce((s, p) => s + p.planned, 0);
    const totInvoiced = byProject.reduce((s, p) => s + p.invoiced, 0);

    return { byCompany, byProject, totPlanned, totInvoiced };
  }, [revProjects, invProjects, filterFY, filterCompany]);

  // ── Monthly trend (planned vs invoiced) for selected FY ─────────────────────
  const monthlyTrend = useMemo(() => {
    if (!filterFY) return [];
    return MONTH_ORDER.map((_, pos) => {
      const lbl = fyMonthLabel(filterFY, pos);
      const qLabel = pos < 3 ? 'Q1' : pos < 6 ? 'Q2' : pos < 9 ? 'Q3' : 'Q4';

      const revSrc = filterCompany
        ? revProjects.filter(p => p.company?.trim() === filterCompany)
        : revProjects;
      const invSrc = filterCompany
        ? invProjects.filter(p => p.company?.trim() === filterCompany)
        : invProjects;

      const planned  = revSrc.reduce((t, p) => t + (p.revenue[lbl] || 0), 0);
      const invoiced = invSrc.reduce((t, p) => t + (p.revenue[lbl] || 0), 0);
      return { month: lbl, shortMonth: MONTH_ORDER[pos], planned, invoiced, qLabel };
    });
  }, [revProjects, invProjects, filterFY, filterCompany]);

  // ── Quarterly summary ────────────────────────────────────────────────────────
  const quarterData = useMemo(() => {
    const labels = ['Q1 (Oct–Dec)', 'Q2 (Jan–Mar)', 'Q3 (Apr–Jun)', 'Q4 (Jul–Sep)'];
    return labels.map((label, qi) => {
      const months = monthlyTrend.slice(qi * 3, qi * 3 + 3);
      const planned  = months.reduce((s, m) => s + m.planned, 0);
      const invoiced = months.reduce((s, m) => s + m.invoiced, 0);
      return { label, planned, invoiced, gap: planned - invoiced, coverage: pct(invoiced, planned) };
    });
  }, [monthlyTrend]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <Spin size="large" tip="Loading Finance Summary…" />
      </div>
    );
  }

  const hasData = grouped.totPlanned > 0 || grouped.totInvoiced > 0;
  const overallCoverage = pct(grouped.totInvoiced, grouped.totPlanned);
  const billingGap = grouped.totPlanned - grouped.totInvoiced;

  // Currency formatter
  const fmt = (n: number) => currency === 'USD' ? fmtUSD(n, exchangeRate) : fmtCrINR(n);

  // Y-axis tick formatter for charts
  const axisFmt = (v: number) => {
    if (currency === 'USD') {
      const u = v * exchangeRate;
      return u >= 1_000_000 ? `$${(u / 1_000_000).toFixed(1)}M` : u >= 1000 ? `$${(u / 1000).toFixed(0)}K` : `$${u.toFixed(0)}`;
    }
    return v >= 1_00_00_000 ? `${(v / 1_00_00_000).toFixed(1)}Cr` : v >= 100000 ? `${(v / 100000).toFixed(0)}L` : `${v}`;
  };

  // Colour helpers
  const coverageColor = (p: number) => p >= 90 ? '#52C41A' : p >= 60 ? '#FFA940' : '#FF7875';
  const PLAN_COLOR    = '#1890FF';
  const INV_COLOR     = '#52C41A';

  return (
    <div ref={pageRef} style={{ padding: '8px 24px 24px', maxWidth: 1200, margin: '0 auto', minWidth: 0 }}>
      {/* ── Header + Filters ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div style={{ paddingLeft: 8 }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#001529', margin: 0 }}>
            Finance Summary
          </h2>
          <p style={{ fontSize: '12px', color: '#8c8c8c', margin: '2px 0 0' }}>
            Planned vs Invoiced — Executive Overview
          </p>
        </div>
        <Space wrap style={{ alignItems: 'center' }}>
          {companies.length > 0 && (
            <Space size={4}>
              <Text style={{ fontSize: '11px', color: '#8c8c8c' }}>Company:</Text>
              <Select
                size="small"
                allowClear
                placeholder="All Companies"
                value={filterCompany}
                onChange={v => setFilterCompany(v ?? null)}
                options={companies.map(c => ({ value: c, label: c }))}
                style={{ minWidth: 150, fontSize: '11px' }}
              />
            </Space>
          )}
          {allFYs.length > 0 && (
            <Space size={4}>
              <Text style={{ fontSize: '11px', color: '#8c8c8c' }}>FY:</Text>
              <Select
                size="small"
                value={filterFY ?? allFYs[0]}
                onChange={v => setFilterFY(v as number)}
                options={allFYs.map(fy => ({ label: `FY${fy}`, value: fy }))}
                style={{ minWidth: 90, fontSize: '11px' }}
              />
            </Space>
          )}
          {/* Currency toggle — left of export */}
          <Space size={4}>
            <Tooltip title={currency === 'INR' ? 'Switch to USD' : 'Switch to INR'} overlayInnerStyle={{ fontSize: '11px' }}>
              <Button
                size="small"
                icon={<DollarOutlined />}
                type={currency === 'USD' ? 'primary' : 'default'}
                onClick={() => setCurrency(c => c === 'INR' ? 'USD' : 'INR')}
                style={{ fontSize: '11px' }}
              >
                {currency === 'USD' ? 'USD' : 'INR'}
              </Button>
            </Tooltip>
            {currency === 'USD' && (
              <Tooltip title="Exchange rate (INR → USD)" overlayInnerStyle={{ fontSize: '11px' }}>
                <InputNumber
                  size="small"
                  value={exchangeRate}
                  onChange={v => setExchangeRate(v || 0.013)}
                  step={0.001}
                  precision={4}
                  min={0.0001}
                  style={{ width: 80, fontSize: '11px' }}
                  prefix="×"
                />
              </Tooltip>
            )}
          </Space>
          {/* Export PNG */}
          <Tooltip title="Export as PNG" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              loading={exporting}
              onClick={async () => {
                if (!pageRef.current) return;
                setExporting(true);
                try {
                  const canvas = await html2canvas(pageRef.current, { scale: 2, useCORS: true, backgroundColor: '#f5f6fa' });
                  const link = document.createElement('a');
                  link.download = `finance-summary-FY${filterFY ?? ''}.png`;
                  link.href = canvas.toDataURL('image/png');
                  link.click();
                } finally {
                  setExporting(false);
                }
              }}
              style={{ fontSize: '11px' }}
            >
              Export PNG
            </Button>
          </Tooltip>
        </Space>
      </div>

      {!hasData ? (
        <Empty
          description={
            <span>
              No data found for {filterFY ? `FY${filterFY}` : 'selected filters'}.
              <br />
              <span style={{ fontSize: '12px', color: '#aaa' }}>Upload data in Revenue Details and Invoicing Details first.</span>
            </span>
          }
          style={{ marginTop: 60 }}
        />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={20}>

          {/* ── KPI Row ── */}
          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12} md={6}>
              <div onClick={() => onNavigate?.('executive_revenue')} style={{ cursor: onNavigate ? 'pointer' : 'default' }}>
                <KPICard
                  title="Total Planned Revenue"
                  value={fmt(grouped.totPlanned)}
                  sub={`${revProjects.length} projects · click to view`}
                  color={PLAN_COLOR}
                  badge={<FileExcelOutlined style={{ fontSize: 18, color: PLAN_COLOR }} />}
                  tooltip="Go to Revenue Details"
                />
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div onClick={() => onNavigate?.('executive_invoicing')} style={{ cursor: onNavigate ? 'pointer' : 'default' }}>
                <KPICard
                  title="Total Invoiced"
                  value={fmt(grouped.totInvoiced)}
                  sub={`${invProjects.length} projects · click to view`}
                  color={INV_COLOR}
                  badge={<FileTextOutlined style={{ fontSize: 18, color: INV_COLOR }} />}
                  tooltip="Go to Invoicing Details"
                />
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <KPICard
                title="Invoice Coverage"
                value={`${overallCoverage}%`}
                sub="Invoiced ÷ Planned"
                color={coverageColor(overallCoverage)}
                badge={<CoverageBadge pct={overallCoverage} />}
                tooltip="How much of planned revenue has been invoiced"
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <KPICard
                title="Billing Gap"
                value={fmt(billingGap)}
                sub={billingGap > 0 ? 'Under-invoiced' : billingGap < 0 ? 'Over-invoiced' : 'Balanced'}
                color={billingGap > 0 ? '#FF7875' : billingGap < 0 ? '#FFA940' : '#52C41A'}
                badge={
                  billingGap > 0
                    ? <WarningOutlined style={{ fontSize: 18, color: '#FF7875' }} />
                    : <CheckCircleOutlined style={{ fontSize: 18, color: '#52C41A' }} />
                }
                tooltip="Difference between planned and invoiced amounts"
              />
            </Col>
          </Row>

          {/* ── Monthly Trend Bar Chart ── */}
          <Card
            ref={monthlyRef}
            style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.07)', borderRadius: 10 }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#001529' }}>Monthly Planned vs Invoiced</div>
                <div style={{ fontSize: '11px', color: '#8c8c8c' }}>
                  {filterFY ? `FY${filterFY} (Oct'${String(filterFY - 1).slice(-2)}–Sep'${String(filterFY).slice(-2)})` : ''}
                </div>
              </div>
              <Space size={12} align="center">
                <Space size={4}><div style={{ width: 10, height: 10, borderRadius: 2, background: PLAN_COLOR }} /><Text style={{ fontSize: '11px' }}>Planned</Text></Space>
                <Space size={4}><div style={{ width: 10, height: 10, borderRadius: 2, background: INV_COLOR }} /><Text style={{ fontSize: '11px' }}>Invoiced</Text></Space>
                <CardExportIcon onExport={() => exportCard(monthlyRef, `monthly-trend-FY${filterFY ?? ''}`)} />
              </Space>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyTrend} barCategoryGap="25%" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="shortMonth" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={axisFmt}
                />
                <RTooltip
                  formatter={(val: number, name: string) => [fmt(val), name]}
                  contentStyle={{ fontSize: '11px', borderRadius: 6 }}
                />
                <Bar dataKey="planned" name="Planned" fill={PLAN_COLOR} radius={[3, 3, 0, 0]} />
                <Bar dataKey="invoiced" name="Invoiced" fill={INV_COLOR} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* ── Quarterly Breakdown (full width) ── */}
          <Card
            ref={quarterlyRef}
            style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.07)', borderRadius: 10 }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#001529' }}>Quarterly Breakdown</div>
              <CardExportIcon onExport={() => exportCard(quarterlyRef, `quarterly-breakdown-FY${filterFY ?? ''}`)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {quarterData.map((q, i) => {
                const qColors = [PLAN_COLOR, '#722ED1', '#FFA940', '#13C2C2'];
                return (
                  <div key={q.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: qColors[i] }} />
                        <Text style={{ fontSize: '12px', fontWeight: 600 }}>{q.label}</Text>
                      </div>
                      <Space size={16}>
                        <Text style={{ fontSize: '11px', color: '#8c8c8c' }}>
                          Planned: <strong style={{ color: PLAN_COLOR }}>{fmt(q.planned)}</strong>
                        </Text>
                        <Text style={{ fontSize: '11px', color: '#8c8c8c' }}>
                          Invoiced: <strong style={{ color: INV_COLOR }}>{fmt(q.invoiced)}</strong>
                        </Text>
                        <CoverageBadge pct={q.coverage} />
                      </Space>
                    </div>
                    <div style={{ position: 'relative', height: 8, background: '#f5f5f5', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, pct(q.planned, grouped.totPlanned))}%`, background: PLAN_COLOR, opacity: 0.2, borderRadius: 4 }} />
                      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, q.coverage)}%`, background: coverageColor(q.coverage), borderRadius: 4 }} />
                    </div>
                    {q.gap > 0 && (
                      <div style={{ fontSize: '10px', color: '#FF7875', marginTop: 2 }}>
                        Gap: {fmt(q.gap)} under-invoiced
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* ── Company / Project Breakdown Table ── */}
          <Card
            ref={breakdownRef}
            style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.07)', borderRadius: 10 }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#001529' }}>Detailed Breakdown</div>
              <Space size={8} align="center">
                <Segmented
                  size="small"
                  value={viewMode}
                  onChange={v => setViewMode(v as 'company' | 'project')}
                  options={[
                    { label: <span style={{ fontSize: '11px' }}>By Company</span>, value: 'company' },
                    { label: <span style={{ fontSize: '11px' }}>By Project</span>, value: 'project' },
                  ]}
                />
                <CardExportIcon onExport={() => exportCard(breakdownRef, `detailed-breakdown-FY${filterFY ?? ''}`)} />
              </Space>
            </div>

            {viewMode === 'company' ? (
              <Table
                size="small"
                dataSource={grouped.byCompany}
                rowKey="company"
                pagination={false}
                columns={[
                  {
                    title: 'Company',
                    dataIndex: 'company',
                    render: (v: string) => <Text style={{ fontSize: '12px', fontWeight: 600 }}>{v}</Text>,
                  },
                  {
                    title: 'Projects',
                    dataIndex: 'projects',
                    align: 'right' as const,
                    render: (v: number) => <Tag style={{ fontSize: '11px' }}>{v}</Tag>,
                  },
                  {
                    title: 'Planned',
                    dataIndex: 'planned',
                    align: 'right' as const,
                    render: (v: number) => <Text style={{ fontSize: '12px', color: PLAN_COLOR, fontWeight: 600 }}>{fmt(v)}</Text>,
                    sorter: (a, b) => a.planned - b.planned,
                    defaultSortOrder: 'descend' as const,
                  },
                  {
                    title: 'Invoiced',
                    dataIndex: 'invoiced',
                    align: 'right' as const,
                    render: (v: number) => <Text style={{ fontSize: '12px', color: INV_COLOR, fontWeight: 600 }}>{fmt(v)}</Text>,
                    sorter: (a, b) => a.invoiced - b.invoiced,
                  },
                  {
                    title: 'Gap',
                    dataIndex: 'gap',
                    align: 'right' as const,
                    render: (v: number) => (
                      <Text style={{ fontSize: '12px', color: v > 0 ? '#FF7875' : '#52C41A', fontWeight: 600 }}>
                        {v > 0 ? '-' : v < 0 ? '+' : ''}{fmt(Math.abs(v))}
                      </Text>
                    ),
                    sorter: (a, b) => b.gap - a.gap,
                  },
                  {
                    title: 'Coverage',
                    dataIndex: 'coverage',
                    align: 'center' as const,
                    render: (v: number) => (
                      <div style={{ minWidth: 80 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={{ fontSize: '10px', color: coverageColor(v), fontWeight: 600 }}>{v}%</Text>
                          <CoverageBadge pct={v} />
                        </div>
                        <Progress percent={v} strokeColor={coverageColor(v)} format={() => ''} size="small" />
                      </div>
                    ),
                    sorter: (a, b) => a.coverage - b.coverage,
                  },
                ]}
                rowClassName={() => ''}
              />
            ) : (
              <Table
                size="small"
                dataSource={grouped.byProject}
                rowKey="code"
                pagination={{ pageSize: 10, size: 'small' }}
                columns={[
                  { title: 'Code', dataIndex: 'code', width: 120, render: (v: string) => <Text code style={{ fontSize: '11px' }}>{v}</Text> },
                  {
                    title: 'Project',
                    dataIndex: 'name',
                    render: (v: string) => (
                      <Tooltip title={v} overlayInnerStyle={{ fontSize: '11px' }}>
                        <Text style={{ fontSize: '11px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{v}</Text>
                      </Tooltip>
                    ),
                  },
                  { title: 'Company', dataIndex: 'company', width: 120, render: (v: string) => <Text style={{ fontSize: '11px' }}>{v || '—'}</Text> },
                  {
                    title: 'Planned',
                    dataIndex: 'planned',
                    align: 'right' as const,
                    render: (v: number) => <Text style={{ fontSize: '11px', color: PLAN_COLOR, fontWeight: 600 }}>{fmt(v)}</Text>,
                    sorter: (a, b) => a.planned - b.planned,
                    defaultSortOrder: 'descend' as const,
                  },
                  {
                    title: 'Invoiced',
                    dataIndex: 'invoiced',
                    align: 'right' as const,
                    render: (v: number) => <Text style={{ fontSize: '11px', color: INV_COLOR, fontWeight: 600 }}>{fmt(v)}</Text>,
                    sorter: (a, b) => a.invoiced - b.invoiced,
                  },
                  {
                    title: 'Coverage',
                    dataIndex: 'coverage',
                    width: 120,
                    align: 'center' as const,
                    render: (v: number) => (
                      <div style={{ minWidth: 80 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={{ fontSize: '10px', color: coverageColor(v), fontWeight: 600 }}>{v}%</Text>
                        </div>
                        <Progress percent={v} strokeColor={coverageColor(v)} format={() => ''} size="small" />
                      </div>
                    ),
                    sorter: (a, b) => a.coverage - b.coverage,
                  },
                ]}
              />
            )}
          </Card>

          {/* ── Cumulative Line Chart (running totals) ── */}
          <Card
            ref={cumulativeRef}
            style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.07)', borderRadius: 10 }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#001529' }}>Cumulative Revenue Tracking</div>
                <div style={{ fontSize: '11px', color: '#8c8c8c' }}>Running total — how invoicing tracks against plan month-by-month</div>
              </div>
              <CardExportIcon onExport={() => exportCard(cumulativeRef, `cumulative-tracking-FY${filterFY ?? ''}`)} />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={(() => {
                let cumPlan = 0, cumInv = 0;
                return monthlyTrend.map(m => {
                  cumPlan += m.planned;
                  cumInv  += m.invoiced;
                  return { month: m.shortMonth, 'Cum. Planned': cumPlan, 'Cum. Invoiced': cumInv };
                });
              })()}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={axisFmt}
                />
                <RTooltip
                  formatter={(val: number, name: string) => [fmt(val), name]}
                  contentStyle={{ fontSize: '11px', borderRadius: 6 }}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="Cum. Planned" stroke={PLAN_COLOR} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Cum. Invoiced" stroke={INV_COLOR} strokeWidth={2} dot={false} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

        </Space>
      )}
    </div>
  );
}
