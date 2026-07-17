import React, { useMemo, useState } from 'react';
import { Card, Empty, Select, Space, Table, Tag, Typography } from 'antd';
import type { ResourceRow } from '../../types/resource';
import {
  calculateExperienceYearsFromDoj,
  formatTwoDecimalNoRound,
  parseWorkexNumber,
  resolveExperienceBucket,
  truncateToTwoDecimals,
} from './resourceVerificationUtils';

const { Text } = Typography;

type VerificationRow = {
  key: string;
  raId: string;
  empName: string;
  engagement: string;
  totalWorkex: number | null;
  previousWorkex: number | null;
  doj: string;
  expRange: string;
  calculatedTotalWorkex: number | null;
  calcExpRange: string;
  experienceMismatch: boolean;
  rangeMismatch: boolean;
};

interface ResourceVerificationTabProps {
  resources: ResourceRow[];
}

type VerificationFilter = 'all' | 'matched' | 'mismatch';

export default function ResourceVerificationTab({ resources }: ResourceVerificationTabProps) {
  const [experienceVerificationFilter, setExperienceVerificationFilter] = useState<VerificationFilter>('all');
  const [rangeVerificationFilter, setRangeVerificationFilter] = useState<VerificationFilter>('all');
  const [engagementFilter, setEngagementFilter] = useState<string>('all');

  const verificationRows = useMemo<VerificationRow[]>(() => {
    return resources.map((resource) => {
      const totalWorkex = parseWorkexNumber(resource.totalWorkex);
      const previousWorkex = parseWorkexNumber(resource.previousWorkex) ?? 0;
      const yearsFromDoj = calculateExperienceYearsFromDoj(resource.doj);
      const calculatedTotalWorkex = yearsFromDoj == null ? null : truncateToTwoDecimals(previousWorkex + yearsFromDoj);
      const expRange = resolveExperienceBucket(totalWorkex);
      const calcExpRange = resolveExperienceBucket(calculatedTotalWorkex);
      const experienceMismatch = totalWorkex != null && calculatedTotalWorkex != null
        ? totalWorkex !== calculatedTotalWorkex
        : false;
      const rangeMismatch = expRange !== '—' && calcExpRange !== '—' ? expRange !== calcExpRange : false;
      return {
        key: resource.key,
        raId: resource.raId || '—',
        empName: resource.empName || '—',
        engagement: String(resource.engagement || '').trim() || '—',
        totalWorkex,
        previousWorkex: parseWorkexNumber(resource.previousWorkex),
        doj: resource.doj || '—',
        expRange,
        calculatedTotalWorkex,
        calcExpRange,
        experienceMismatch,
        rangeMismatch,
      };
    });
  }, [resources]);

  const engagementOptions = useMemo(
    () => Array.from(new Set(verificationRows.map((row) => row.engagement).filter((value) => value && value !== '—')))
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: <span style={{ fontSize: 11 }}>{value}</span> })),
    [verificationRows],
  );

  const filteredVerificationRows = useMemo(() => verificationRows.filter((row) => {
    const experienceMatched = !row.experienceMismatch;
    const rangeMatched = !row.rangeMismatch;
    if (experienceVerificationFilter === 'matched' && !experienceMatched) return false;
    if (experienceVerificationFilter === 'mismatch' && experienceMatched) return false;
    if (rangeVerificationFilter === 'matched' && !rangeMatched) return false;
    if (rangeVerificationFilter === 'mismatch' && rangeMatched) return false;
    if (engagementFilter !== 'all' && row.engagement !== engagementFilter) return false;
    return true;
  }), [verificationRows, experienceVerificationFilter, rangeVerificationFilter, engagementFilter]);

  const mismatchCount = useMemo(
    () => filteredVerificationRows.filter((row) => row.experienceMismatch || row.rangeMismatch).length,
    [filteredVerificationRows],
  );
  const headerCellStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600 };
  const bodyCellStyle: React.CSSProperties = { fontSize: 11 };
  const titleText = (label: string) => <span style={{ fontSize: 11 }}>{label}</span>;

  return (
    <div style={{ padding: '12px 0' }}>
      <Card size="small" style={{ borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
          <Tag color={mismatchCount > 0 ? 'volcano' : 'success'} style={{ fontSize: 11, marginInlineEnd: 0 }}>
            {mismatchCount} mismatch{mismatchCount !== 1 ? 'es' : ''}
          </Tag>
        </div>

        <Space wrap size={8} style={{ marginBottom: 10 }}>
          <Space size={6}>
            <Text style={{ fontSize: 11, color: '#595959' }}>Experience Verification</Text>
            <Select
              size="small"
              value={experienceVerificationFilter}
              onChange={(value) => setExperienceVerificationFilter(value as VerificationFilter)}
              style={{ width: 130, fontSize: 11 }}
              options={[
                { value: 'all', label: <span style={{ fontSize: 11 }}>All</span> },
                { value: 'matched', label: <span style={{ fontSize: 11 }}>Matched</span> },
                { value: 'mismatch', label: <span style={{ fontSize: 11 }}>Mismatch</span> },
              ]}
            />
          </Space>
          <Space size={6}>
            <Text style={{ fontSize: 11, color: '#595959' }}>Range Verification</Text>
            <Select
              size="small"
              value={rangeVerificationFilter}
              onChange={(value) => setRangeVerificationFilter(value as VerificationFilter)}
              style={{ width: 130, fontSize: 11 }}
              options={[
                { value: 'all', label: <span style={{ fontSize: 11 }}>All</span> },
                { value: 'matched', label: <span style={{ fontSize: 11 }}>Matched</span> },
                { value: 'mismatch', label: <span style={{ fontSize: 11 }}>Mismatch</span> },
              ]}
            />
          </Space>
          <Space size={6}>
            <Text style={{ fontSize: 11, color: '#595959' }}>Current Engagement</Text>
            <Select
              size="small"
              value={engagementFilter}
              onChange={(value) => setEngagementFilter(value)}
              style={{ width: 220, fontSize: 11 }}
              showSearch
              options={[
                { value: 'all', label: <span style={{ fontSize: 11 }}>All</span> },
                ...engagementOptions,
              ]}
            />
          </Space>
        </Space>

        {resources.length === 0 ? (
          <Empty description={<span style={{ fontSize: 11 }}>No resource data available</span>} />
        ) : (
          <Table<VerificationRow>
            size="small"
            rowKey="key"
            dataSource={filteredVerificationRows}
            pagination={{ pageSize: 25, showSizeChanger: true, pageSizeOptions: [10, 25, 50, 100] }}
            onRow={(record) => ({
              style: (record.experienceMismatch || record.rangeMismatch) ? { background: '#fff2f0' } : undefined,
            })}
            columns={[
              {
                title: titleText('RA ID'),
                dataIndex: 'raId',
                key: 'raId',
                width: 120,
                onHeaderCell: () => ({ style: headerCellStyle }),
                onCell: () => ({ style: bodyCellStyle }),
              },
              {
                title: titleText('Resource Name'),
                dataIndex: 'empName',
                key: 'empName',
                width: 220,
                onHeaderCell: () => ({ style: headerCellStyle }),
                onCell: () => ({ style: bodyCellStyle }),
              },
              {
                title: titleText('Total Experience'),
                dataIndex: 'totalWorkex',
                key: 'totalWorkex',
                width: 140,
                onHeaderCell: () => ({ style: headerCellStyle }),
                onCell: () => ({ style: bodyCellStyle }),
                render: (value: number | null) => <Text style={{ fontSize: 11 }}>{formatTwoDecimalNoRound(value)}</Text>,
              },
              {
                title: titleText('Calculated Total Workex (Yr)'),
                dataIndex: 'calculatedTotalWorkex',
                key: 'calculatedTotalWorkex',
                width: 190,
                onHeaderCell: () => ({ style: headerCellStyle }),
                onCell: () => ({ style: bodyCellStyle }),
                render: (value: number | null, row: VerificationRow) => (
                  <Text style={{ fontSize: 11, color: row.experienceMismatch ? '#cf1322' : undefined }}>
                    {formatTwoDecimalNoRound(value)}
                  </Text>
                ),
              },
              {
                title: titleText('Experience Verification'),
                key: 'experienceVerification',
                width: 170,
                onHeaderCell: () => ({ style: headerCellStyle }),
                onCell: () => ({ style: bodyCellStyle }),
                render: (_: unknown, row: VerificationRow) => (
                  row.experienceMismatch
                    ? <Tag color="error" style={{ fontSize: 10, marginInlineEnd: 0 }}>Mismatch</Tag>
                    : <Tag color="success" style={{ fontSize: 10, marginInlineEnd: 0 }}>Matched</Tag>
                ),
              },
              {
                title: titleText('Prior Ex'),
                dataIndex: 'previousWorkex',
                key: 'previousWorkex',
                width: 120,
                onHeaderCell: () => ({ style: headerCellStyle }),
                onCell: () => ({ style: bodyCellStyle }),
                render: (value: number | null) => <Text style={{ fontSize: 11 }}>{formatTwoDecimalNoRound(value)}</Text>,
              },
              {
                title: titleText('DOJ'),
                dataIndex: 'doj',
                key: 'doj',
                width: 130,
                onHeaderCell: () => ({ style: headerCellStyle }),
                onCell: () => ({ style: bodyCellStyle }),
              },
              {
                title: titleText('Exp Range'),
                dataIndex: 'expRange',
                key: 'expRange',
                width: 120,
                onHeaderCell: () => ({ style: headerCellStyle }),
                onCell: () => ({ style: bodyCellStyle }),
                render: (value: string, row: VerificationRow) => (
                  <Tag color={row.rangeMismatch ? 'volcano' : 'blue'} style={{ fontSize: 10, marginInlineEnd: 0 }}>
                    {value}
                  </Tag>
                ),
              },
              {
                title: titleText('Calc Exp Range'),
                dataIndex: 'calcExpRange',
                key: 'calcExpRange',
                width: 130,
                onHeaderCell: () => ({ style: headerCellStyle }),
                onCell: () => ({ style: bodyCellStyle }),
                render: (value: string, row: VerificationRow) => (
                  <Tag color={row.rangeMismatch ? 'volcano' : 'geekblue'} style={{ fontSize: 10, marginInlineEnd: 0 }}>
                    {value}
                  </Tag>
                ),
              },
              {
                title: titleText('Range Verification'),
                key: 'rangeVerification',
                width: 140,
                onHeaderCell: () => ({ style: headerCellStyle }),
                onCell: () => ({ style: bodyCellStyle }),
                render: (_: unknown, row: VerificationRow) => (
                  row.rangeMismatch
                    ? <Tag color="error" style={{ fontSize: 10, marginInlineEnd: 0 }}>Mismatch</Tag>
                    : <Tag color="success" style={{ fontSize: 10, marginInlineEnd: 0 }}>Matched</Tag>
                ),
              },
            ]}
            scroll={{ x: 1200 }}
          />
        )}

      </Card>
    </div>
  );
}
