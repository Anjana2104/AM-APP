import React, { useState, useMemo } from 'react';
import { Tabs, Switch, Table, Typography, Tooltip, Row, Col, Space } from 'antd';
import '../style.css';

const { Title, Text } = Typography;
type Currency = 'INR' | 'USD';

const fmtNum = (n: number, cur: Currency) =>
  cur === 'INR'
    ? '₹\u00A0' + n.toLocaleString('en-IN')
    : '$\u00A0' + n.toLocaleString('en-US');

// ─── Rate Data ──────────────────────────────────────────────────────────────
const RATES = [
  { key: '1', exp: '0–3 Yrs',
    c_inr_h: 1846, c_inr_d: 14769,  c_inr_m: 324923,
    c_usd_h: 24,   c_usd_d: 192,    c_usd_m: 4224,
    s_inr_h: 2000, s_inr_d: 16000,  s_inr_m: 352000,
    s_usd_h: 26,   s_usd_d: 208,    s_usd_m: 4576,
  },
  { key: '2', exp: '3–5 Yrs',
    c_inr_h: 2308, c_inr_d: 18462,  c_inr_m: 406154,
    c_usd_h: 30,   c_usd_d: 240,    c_usd_m: 5280,
    s_inr_h: 2692, s_inr_d: 21538,  s_inr_m: 473846,
    s_usd_h: 35,   s_usd_d: 280,    s_usd_m: 6160,
  },
  { key: '3', exp: '5–8 Yrs',
    c_inr_h: 2846, c_inr_d: 22769,  c_inr_m: 500923,
    c_usd_h: 37,   c_usd_d: 296,    c_usd_m: 6512,
    s_inr_h: 3077, s_inr_d: 24615,  s_inr_m: 541538,
    s_usd_h: 40,   s_usd_d: 320,    s_usd_m: 7040,
  },
  { key: '4', exp: '8–10 Yrs',
    c_inr_h: 3462, c_inr_d: 27692,  c_inr_m: 609231,
    c_usd_h: 45,   c_usd_d: 360,    c_usd_m: 7920,
    s_inr_h: 3846, s_inr_d: 30769,  s_inr_m: 676923,
    s_usd_h: 50,   s_usd_d: 400,    s_usd_m: 8800,
  },
  { key: '5', exp: '10+ Yrs',
    c_inr_h: 3846, c_inr_d: 30769,  c_inr_m: 676923,
    c_usd_h: 50,   c_usd_d: 400,    c_usd_m: 8800,
    s_inr_h: 4615, s_inr_d: 36923,  s_inr_m: 812308,
    s_usd_h: 60,   s_usd_d: 480,    s_usd_m: 10560,
  },
];
type RateRow = typeof RATES[0];

const EXP_COLORS: Record<string, string> = {
  '0–3 Yrs':  '#52c41a',
  '3–5 Yrs':  '#1890ff',
  '5–8 Yrs':  '#722ed1',
  '8–10 Yrs': '#fa8c16',
  '10+ Yrs':  '#f5222d',
};

// ─── Skills Data ────────────────────────────────────────────────────────────
type SkillType = 'specialized' | 'not_supported' | 'commodity';
interface Skill { name: string; type: SkillType; }
interface Category { name: string; skills: Skill[]; }

const SKILL_CATEGORIES: Category[] = [
  { name: 'BE', skills: [
    { name: 'Data Engineers',  type: 'commodity' },
    { name: 'API Developers',  type: 'commodity' },
    { name: 'AWS Engineer',    type: 'commodity' },
    { name: 'Azure Engineer',  type: 'commodity' },
    { name: 'Node Js',         type: 'commodity' },
    { name: 'Technical Lead',  type: 'commodity' },
  ]},
  { name: 'Data Science', skills: [
    { name: 'GenAI',           type: 'specialized' },
    { name: 'Agentic AI',      type: 'specialized' },
    { name: 'Scaled AI',       type: 'not_supported' },
    { name: 'ML',              type: 'specialized' },
    { name: 'NLP',             type: 'specialized' },
  ]},
  { name: 'UI Dev', skills: [
    { name: 'React Js',        type: 'commodity' },
    { name: 'Angular',         type: 'commodity' },
  ]},
  { name: 'DevOps', skills: [
    { name: 'AWS CI/CD',       type: 'commodity' },
    { name: 'Azure CI/CD',     type: 'commodity' },
    { name: 'MLOps',           type: 'specialized' },
    { name: 'AgentOps',        type: 'specialized' },
  ]},
  { name: 'Reporting', skills: [
    { name: 'Power BI',        type: 'commodity' },
    { name: 'Spotfire',        type: 'commodity' },
  ]},
  { name: 'Testing', skills: [
    { name: 'ETL',             type: 'commodity' },
    { name: 'Validated',       type: 'commodity' },
    { name: 'Automation',      type: 'commodity' },
    { name: 'GenAI',           type: 'specialized' },
    { name: 'Testing Leads',   type: 'commodity' },
  ]},
  { name: 'Others', skills: [
    { name: 'Full Stack',          type: 'commodity' },
    { name: 'Project Managers',    type: 'not_supported' },
    { name: 'Solution Architect',  type: 'not_supported' },
    { name: 'KTLO',                type: 'commodity' },
    { name: 'Admin',               type: 'not_supported' },
    { name: 'Scrum Masters',       type: 'not_supported' },
  ]},
];

const SKILL_STYLE: Record<SkillType, { bg: string; color: string; border: string; icon: string; tooltip: string }> = {
  specialized:   { bg: '#e6f7ff', color: '#0050b3', border: '#91d5ff',  icon: '★', tooltip: 'Specialized Skill' },
  not_supported: { bg: '#fff1f0', color: '#a8071a', border: '#ffa39e',  icon: '✕', tooltip: 'Not Supported by RA' },
  commodity:     { bg: '#f5f5f5', color: '#434343', border: '#d9d9d9',  icon: '●', tooltip: 'Commodity Skill' },
};

const CAT_GRADIENTS = [
  'linear-gradient(135deg,#1890ff,#096dd9)',
  'linear-gradient(135deg,#722ed1,#531dab)',
  'linear-gradient(135deg,#13c2c2,#08979c)',
  'linear-gradient(135deg,#fa8c16,#d46b08)',
  'linear-gradient(135deg,#eb2f96,#c41d7f)',
  'linear-gradient(135deg,#52c41a,#389e0d)',
  'linear-gradient(135deg,#f5222d,#cf1322)',
];

// ─── Column builder ──────────────────────────────────────────────────────────
function buildColumns(cur: Currency): any[] {
  const hStyle = { fontSize: '11px', fontWeight: 700, padding: '6px 8px', textAlign: 'center' as const };
  const cellStyle = { fontSize: '12px', textAlign: 'right' as const, padding: '8px 12px', fontVariantNumeric: 'tabular-nums' };

  const mkLeaf = (title: string, field: keyof RateRow) => ({
    title,
    key: field as string,
    width: cur === 'INR' ? 115 : 82,
    onHeaderCell: () => ({ style: hStyle }),
    onCell: () => ({ style: cellStyle }),
    render: (_: any, r: RateRow) => fmtNum(r[field] as number, cur),
  });

  const commodityChildren = cur === 'INR'
    ? [mkLeaf('Hourly', 'c_inr_h'), mkLeaf('Daily', 'c_inr_d'), mkLeaf('Monthly', 'c_inr_m')]
    : [mkLeaf('Hourly', 'c_usd_h'), mkLeaf('Daily', 'c_usd_d'), mkLeaf('Monthly', 'c_usd_m')];

  const specializedChildren = cur === 'INR'
    ? [mkLeaf('Hourly', 's_inr_h'), mkLeaf('Daily', 's_inr_d'), mkLeaf('Monthly', 's_inr_m')]
    : [mkLeaf('Hourly', 's_usd_h'), mkLeaf('Daily', 's_usd_d'), mkLeaf('Monthly', 's_usd_m')];

  return [
    {
      title: 'Experience Range',
      dataIndex: 'exp',
      key: 'exp',
      width: 115,
      onHeaderCell: () => ({ style: { ...hStyle, background: '#f0f5ff', color: '#2f54eb', verticalAlign: 'middle' } }),
      render: (v: string) => (
        <span style={{ fontWeight: 700, fontSize: '12px', color: EXP_COLORS[v] || '#1890ff', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: EXP_COLORS[v] || '#1890ff', display: 'inline-block', flexShrink: 0 }} />
          {v}
        </span>
      ),
    },
    {
      title: 'For Commodity Skills',
      key: 'commodity_group',
      onHeaderCell: () => ({ style: { ...hStyle, background: '#fff7e6', color: '#d46b08', borderBottom: '3px solid #ffa940' } }),
      children: commodityChildren,
    },
    {
      title: 'For Specialized Skills',
      key: 'specialized_group',
      onHeaderCell: () => ({ style: { ...hStyle, background: '#e6f7ff', color: '#096dd9', borderBottom: '3px solid #1890ff' } }),
      children: specializedChildren,
    },
  ];
}

// ─── Component ───────────────────────────────────────────────────────────────
export function ClientRateCard() {
  const [currency, setCurrency] = useState<Currency>('INR');
  const columns = useMemo(() => buildColumns(currency), [currency]);

  // ── Rate Card Tab ────────────────────────────────────────────────────────
  const rateCardContent = (
    <div>
      {/* Currency toggle + note */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 16, fontSize: '11px', color: '#8c8c8c' }}>
          <span>🕐 Assumes 8 hrs/day · 22 working days/month</span>
          <span>🔄 1 USD ≈ ₹ 76.92</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 20, padding: '5px 14px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: currency === 'INR' ? '#52c41a' : '#8c8c8c' }}>₹ INR</span>
          <Switch
            size="small"
            checked={currency === 'USD'}
            onChange={(v) => setCurrency(v ? 'USD' : 'INR')}
            style={{ background: currency === 'USD' ? '#1890ff' : '#52c41a' }}
          />
          <span style={{ fontSize: '12px', fontWeight: 600, color: currency === 'USD' ? '#1890ff' : '#8c8c8c' }}>$ USD</span>
        </div>
      </div>

      {/* Summary KPI strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, overflowX: 'auto' }}>
        {RATES.map((r) => (
          <div key={r.key} style={{
            background: '#fff', border: `1px solid ${EXP_COLORS[r.exp]}22`,
            borderLeft: `4px solid ${EXP_COLORS[r.exp]}`,
            borderRadius: 8, padding: '10px 16px', minWidth: 170, flexShrink: 0,
          }}>
            <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, color: EXP_COLORS[r.exp] }}>{r.exp}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: '11px' }}>
              <span style={{ color: '#8c8c8c' }}>Commodity</span>
              <span style={{ color: '#d46b08', fontWeight: 600 }}>
                {fmtNum(currency === 'INR' ? r.c_inr_h : r.c_usd_h, currency)}<span style={{ fontSize: '10px', fontWeight: 400 }}>/hr</span>
              </span>
              <span style={{ color: '#8c8c8c' }}>Specialized</span>
              <span style={{ color: '#096dd9', fontWeight: 600 }}>
                {fmtNum(currency === 'INR' ? r.s_inr_h : r.s_usd_h, currency)}<span style={{ fontSize: '10px', fontWeight: 400 }}>/hr</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Full rate table */}
      <div className="compact-table">
        <Table<RateRow>
          dataSource={RATES}
          columns={columns}
          pagination={false}
          size="small"
          bordered
          scroll={{ x: 'max-content' }}
          style={{ background: '#fff', borderRadius: '8px' }}
          rowClassName={(_, i) => i % 2 !== 0 ? 'rate-row-alt' : ''}
        />
      </div>

      {/* Footer note */}
      <div style={{ marginTop: 12, fontSize: '11px', color: '#8c8c8c', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <span>⚠️ Rates are indicative and subject to change</span>
        <span>📋 Final rates may vary based on engagement model</span>
      </div>
    </div>
  );

  // ── Skills Tab ────────────────────────────────────────────────────────────
  const specializedCount = SKILL_CATEGORIES.flatMap(c => c.skills).filter(s => s.type === 'specialized').length;
  const notSupportedCount = SKILL_CATEGORIES.flatMap(c => c.skills).filter(s => s.type === 'not_supported').length;
  const commodityCount = SKILL_CATEGORIES.flatMap(c => c.skills).filter(s => s.type === 'commodity').length;

  const skillsContent = (
    <div>
      {/* Legend + summary row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <Space size={8} wrap>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#595959' }}>Legend:</span>
          {(['specialized', 'not_supported', 'commodity'] as SkillType[]).map((type) => {
            const s = SKILL_STYLE[type];
            const count = type === 'specialized' ? specializedCount : type === 'not_supported' ? notSupportedCount : commodityCount;
            return (
              <span key={type} style={{
                padding: '3px 12px', borderRadius: 20, fontSize: '11px', fontWeight: 600,
                background: s.bg, color: s.color, border: `1px solid ${s.border}`,
              }}>
                {s.icon} {type === 'specialized' ? 'Specialized' : type === 'not_supported' ? 'Not Supported by RA' : 'Commodity'} ({count})
              </span>
            );
          })}
        </Space>
        <span style={{ fontSize: '11px', color: '#8c8c8c' }}>{SKILL_CATEGORIES.reduce((a, c) => a + c.skills.length, 0)} total skills across {SKILL_CATEGORIES.length} categories</span>
      </div>

      {/* Category cards */}
      <Row gutter={[14, 14]}>
        {SKILL_CATEGORIES.map((cat, idx) => {
          const specCount = cat.skills.filter(s => s.type === 'specialized').length;
          const notSupCount = cat.skills.filter(s => s.type === 'not_supported').length;
          return (
            <Col key={cat.name} xs={24} sm={12} md={8} lg={6}>
              <div style={{
                background: '#fff', borderRadius: 10, overflow: 'hidden',
                boxShadow: '0 2px 10px rgba(0,0,0,0.07)', height: '100%',
                display: 'flex', flexDirection: 'column',
              }}>
                {/* Header */}
                <div style={{
                  background: CAT_GRADIENTS[idx % CAT_GRADIENTS.length],
                  padding: '10px 14px', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>{cat.name}</span>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {specCount > 0 && (
                      <Tooltip title={`${specCount} specialized`} overlayInnerStyle={{ fontSize: '11px' }}>
                        <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 10, padding: '1px 7px', fontSize: '10px' }}>★ {specCount}</span>
                      </Tooltip>
                    )}
                    {notSupCount > 0 && (
                      <Tooltip title={`${notSupCount} not supported`} overlayInnerStyle={{ fontSize: '11px' }}>
                        <span style={{ background: 'rgba(255,80,80,0.35)', borderRadius: 10, padding: '1px 7px', fontSize: '10px' }}>✕ {notSupCount}</span>
                      </Tooltip>
                    )}
                  </div>
                </div>
                {/* Skills list */}
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  {cat.skills.map((skill) => {
                    const st = SKILL_STYLE[skill.type];
                    return (
                      <Tooltip key={skill.name + skill.type} title={st.tooltip} overlayInnerStyle={{ fontSize: '11px' }}>
                        <div style={{
                          background: st.bg, color: st.color,
                          border: `1px solid ${st.border}`, borderRadius: 6,
                          padding: '5px 10px', fontSize: '11px',
                          fontWeight: skill.type === 'commodity' ? 400 : 700,
                          cursor: 'default', display: 'flex', alignItems: 'center', gap: 6,
                          transition: 'box-shadow 0.2s',
                        }}>
                          <span style={{ fontSize: '9px', opacity: 0.8 }}>{st.icon}</span>
                          {skill.name}
                        </div>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            </Col>
          );
        })}
      </Row>
    </div>
  );

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '20px 24px', maxWidth: 1360, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#262626' }}>Client Rate Card</Title>
        <Text type="secondary" style={{ fontSize: '12px' }}>Standard billing rates by experience and skill type · FY 2025–26</Text>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, padding: '0 20px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Tabs
          defaultActiveKey="rates"
          tabBarStyle={{ marginBottom: 16, paddingTop: 4 }}
          items={[
            {
              key: 'rates',
              label: <span style={{ fontSize: '12px' }}>💰 Rate Card</span>,
              children: rateCardContent,
            },
            {
              key: 'skills',
              label: <span style={{ fontSize: '12px' }}>🎯 Skills Categorization</span>,
              children: skillsContent,
            },
          ]}
        />
      </div>
    </div>
  );
}
