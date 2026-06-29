/**
 * RateCard.tsx
 *
 * Client Rate Card — Config-driven rate visualization with derived hourly/monthly
 * values for commodity and specialized skills.
 * UI Location: Knowledge Base > Client Rate Card
 * Page ID: information_ratecard
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Empty, Segmented, Space, Spin, Table, Tag, Typography } from 'antd';
import { CalculatorOutlined, DatabaseOutlined, InfoCircleOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import * as templateApi from '../api/templateApi';
import {
  buildCalculatedRows,
  HOURS_PER_DAY,
  parseRateBandsFromTemplateRows,
  USD_CONVERSION_FACTOR,
  WORKING_DAYS_PER_MONTH,
  type RateBand,
  type CalculatedRateRow,
  type Currency,
} from './rate-card/rateCardUtils';

const { Title, Text } = Typography;

function formatMoney(value: number, currency: Currency): string {
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
  }
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
}

function buildRateColumns(currency: Currency) {
  const hStyle = { fontSize: '11px', fontWeight: 700, textAlign: 'center' as const };
  const cStyle = { fontSize: '12px', textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' };
  const expStyle = { fontSize: '12px', fontWeight: 600 };

  const valueCol = (title: string, dataIndex: keyof CalculatedRateRow) => ({
    title,
    dataIndex,
    key: String(dataIndex),
    width: 140,
    onHeaderCell: () => ({ style: hStyle }),
    onCell: () => ({ style: cStyle }),
    render: (v: number) => formatMoney(v, currency),
  });

  return [
    {
      title: 'Experience Range',
      dataIndex: 'experienceRange',
      key: 'experienceRange',
      width: 180,
      onHeaderCell: () => ({ style: hStyle }),
      onCell: () => ({ style: expStyle }),
      render: (v: string) => <Tag color="blue" style={{ fontSize: '11px', marginInlineEnd: 0 }}>{v}</Tag>,
    },
    {
      title: 'Commodity Skills',
      key: 'commodityGroup',
      onHeaderCell: () => ({ style: { ...hStyle, background: '#fff7e6', color: '#d46b08' } }),
      children: [
        valueCol('Hourly', 'commodityHourly'),
        valueCol('Daily', 'commodityDaily'),
        valueCol('Monthly', 'commodityMonthly'),
      ],
    },
    {
      title: 'Specialized Skills',
      key: 'specializedGroup',
      onHeaderCell: () => ({ style: { ...hStyle, background: '#e6f7ff', color: '#096dd9' } }),
      children: [
        valueCol('Hourly', 'specializedHourly'),
        valueCol('Daily', 'specializedDaily'),
        valueCol('Monthly', 'specializedMonthly'),
      ],
    },
  ];
}

export function RateCard() {
  const [currency, setCurrency] = useState<Currency>('INR');
  const [sourceBands, setSourceBands] = useState<RateBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');

  useEffect(() => {
    const loadFromTemplate = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const templatesRes = await templateApi.getTemplates('rate_card_template');
        if (!templatesRes.ok || !templatesRes.data?.length) {
          setSourceBands([]);
          setLoading(false);
          return;
        }
        const latest = templatesRes.data[0];
        const fileRes = await templateApi.getTemplate(latest.id);
        if (!fileRes.ok || !fileRes.blob) {
          throw new Error(fileRes.error || 'Failed to download rate card template');
        }
        const buffer = await fileRes.blob.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) throw new Error('No worksheet found in uploaded rate card template');
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const parsed = parseRateBandsFromTemplateRows(rows);
        setSourceBands(parsed);
      } catch (err: any) {
        setLoadError(err?.message || 'Failed to load rate card data from template');
        setSourceBands([]);
      } finally {
        setLoading(false);
      }
    };
    loadFromTemplate();
  }, []);

  const calculatedRows = useMemo(
    () => buildCalculatedRows(sourceBands, currency),
    [sourceBands, currency],
  );
  const columns = useMemo(() => buildRateColumns(currency), [currency]);

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1360, margin: '0 auto' }}>
      <div style={{ marginBottom: 14 }}>
        <Title level={4} style={{ margin: 0 }}>Client Rate Card</Title>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          Template-driven rate card with standardized hourly, daily, and monthly calculations.
        </Text>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12, display: 'flex' }} wrap>
          <Space size={8}>
            <DatabaseOutlined style={{ color: '#1677ff' }} />
            <Text style={{ fontSize: '12px' }}>
              Data Source: App Settings → Templates → Rate Card Template
            </Text>
          </Space>
          <Segmented
            value={currency}
            onChange={value => setCurrency(value as Currency)}
            options={[
              { label: <span style={{ fontSize: '11px' }}>INR</span>, value: 'INR' },
              { label: <span style={{ fontSize: '11px' }}>USD</span>, value: 'USD' },
            ]}
          />
        </Space>

        {loading ? (
          <div style={{ padding: '30px 0', textAlign: 'center' }}>
            <Spin />
          </div>
        ) : !calculatedRows.length ? (
          <Card size="small" style={{ borderRadius: 8 }}>
            <Empty
              description={
                <span style={{ fontSize: '12px' }}>
                  No valid rate rows found. Upload your Excel in <strong>App Settings &gt; Templates</strong> using
                  <strong> Rate Card Template (.xlsx)</strong>.
                </span>
              }
            />
          </Card>
        ) : (
          <div className="compact-table">
            <Table<CalculatedRateRow>
              rowKey="key"
              size="small"
              bordered
              pagination={false}
              dataSource={calculatedRows}
              columns={columns as any}
              scroll={{ x: 'max-content' }}
            />
          </div>
        )}

        {!!loadError && (
          <Alert
            type="error"
            showIcon
            style={{ marginTop: 12 }}
            message={<span style={{ fontSize: '11px' }}>{loadError}</span>}
          />
        )}

        <Card
          size="small"
          title={<span style={{ fontSize: '12px' }}><CalculatorOutlined /> Calculation Details</span>}
          style={{ marginTop: 14, borderRadius: 8 }}
        >
          <Space direction="vertical" size={4}>
            <Text style={{ fontSize: '12px' }}>1. Hourly Rate = Daily Rate / {HOURS_PER_DAY}</Text>
            <Text style={{ fontSize: '12px' }}>2. Monthly Rate = Daily Rate × {WORKING_DAYS_PER_MONTH}</Text>
            <Text style={{ fontSize: '12px' }}>3. USD Conversion = INR × {USD_CONVERSION_FACTOR}</Text>
          </Space>
          <Alert
            style={{ marginTop: 10 }}
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
            message={
              <span style={{ fontSize: '11px' }}>
                Source values are interpreted as <strong>Daily INR</strong> from uploaded template. All other values are derived at runtime.
              </span>
            }
          />
        </Card>
      </div>
    </div>
  );
}
