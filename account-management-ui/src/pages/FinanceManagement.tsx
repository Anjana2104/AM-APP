import React, { useState } from 'react';
import { Tabs, Space } from 'antd';
import { FileExcelOutlined, BarChartOutlined } from '@ant-design/icons';
import { FinanceInsightsPanel } from './finance/FinanceInsightsPanel';
import { ProjectList, type Row } from './finance/ProjectList';

interface FinanceManagementProps {
  onNavigate?: (module: string) => void;
}

export function FinanceManagement({ onNavigate: _onNavigate }: FinanceManagementProps) {
  const [projectData, setProjectData] = useState<Row[]>([]);
  const [monthHeaders, setMonthHeaders] = useState<string[]>([]);

  const items = [
    {
      key: 'milestones',
      label: <span style={{ fontSize: '11px' }}><FileExcelOutlined /> Project Milestones</span>,
      children: (
        <div style={{ padding: '0 0 16px' }}>
          <ProjectList onDataChange={setProjectData} onMonthsChange={setMonthHeaders} />
        </div>
      ),
    },
    {
      key: 'insights',
      label: <span style={{ fontSize: '11px' }}><BarChartOutlined /> Insights</span>,
      children: <FinanceInsightsPanel data={projectData} monthHeaders={monthHeaders} />,
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '12px 24px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <Space direction="vertical" style={{ width: '100%' }} size={6}>
          <div style={{ background: '#fff', borderRadius: 8 }}>
            <Tabs items={items} size="small" defaultActiveKey="milestones" style={{ padding: '0 16px' }} />
          </div>
        </Space>
      </div>
    </div>
  );
}
