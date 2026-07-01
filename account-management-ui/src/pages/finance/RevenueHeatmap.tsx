import React from 'react';
import { Card, Tooltip } from 'antd';

export interface RevenueHeatmapDatum {
  label: string;
  total: number;
  pct: number;
}

interface RevenueHeatmapProps {
  fiscalYear: string;
  revenueType: 'all' | 'booked' | 'anticipated';
  monthlyData: RevenueHeatmapDatum[];
  fmt: (n: number) => string;
  quarterColors: string[];
}

export function RevenueHeatmap({
  fiscalYear,
  revenueType,
  monthlyData,
  fmt,
  quarterColors,
}: RevenueHeatmapProps) {
  return (
    <Card style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: 8, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Monthly Breakdown — {fiscalYear}</h3>
        {revenueType !== 'all' && (
          <span style={{ fontSize: '11px', color: revenueType === 'anticipated' ? '#ff4d4f' : '#52c41a' }}>
            {revenueType === 'anticipated' ? '● Anticipated' : '● Booked'} only
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 140, width: '100%' }}>
        {monthlyData.map((month, index) => {
          const quarterIndex = Math.floor(index / 3);
          const barColor = quarterColors[quarterIndex];
          return (
            <div key={month.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Tooltip title={fmt(month.total)} overlayInnerStyle={{ fontSize: '11px' }}>
                <div style={{ width: '60%', height: 100, display: 'flex', alignItems: 'flex-end' }}>
                  <div
                    style={{
                      width: '100%',
                      height: `${Math.max(month.pct, 3)}%`,
                      background: barColor,
                      borderRadius: '3px 3px 0 0',
                      opacity: revenueType === 'anticipated' ? 0.85 : 1,
                      transition: 'height 0.3s ease',
                      cursor: 'default',
                    }}
                  />
                </div>
              </Tooltip>
              <div style={{ fontSize: '9px', color: '#8c8c8c', whiteSpace: 'nowrap', transform: 'rotate(-40deg)', transformOrigin: 'top center', marginTop: 6, lineHeight: 1 }}>
                {month.label}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 30, flexWrap: 'wrap' }}>
        {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, index) => (
          <span key={quarter} style={{ fontSize: '11px', color: '#595959', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: quarterColors[index] }} />
            {quarter}
          </span>
        ))}
      </div>
    </Card>
  );
}
