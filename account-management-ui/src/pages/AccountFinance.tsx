import { Tabs, Typography, Space } from 'antd';
import { ProjectList } from './ProjectList';
import { Insights } from './Insights';
import { FileExcelOutlined, BarChartOutlined } from '@ant-design/icons';
import { useState } from 'react';

const { Title, Text } = Typography;

interface AccountFinanceProps {
  onNavigate?: (module: string) => void;
}

export function AccountFinance({ onNavigate: _onNavigate }: AccountFinanceProps) {
  const [projectData, setProjectData] = useState<any[]>([]);
  const [monthHeaders, setMonthHeaders] = useState<string[]>([]);

  const items = [
    {
      key: 'milestones',
      label: <span style={{ fontSize: '11px' }}><FileExcelOutlined /> Project Milestones</span>,
      children: (
        <div style={{ padding: '0 0 16px 0' }}>
          <ProjectList onDataChange={setProjectData} onMonthsChange={setMonthHeaders} />
        </div>
      ),
    },
    {
      key: 'insights',
      label: <span style={{ fontSize: '11px' }}><BarChartOutlined /> Insights</span>,
      children: (
        <Insights data={projectData} monthHeaders={monthHeaders} />
      ),
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '12px 24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <Space direction="vertical" style={{ width: '100%' }} size={6}>
          <div>
            <Title level={4} style={{ marginBottom: 2 }}>Revenue Details</Title>
            <Text type="secondary" style={{ fontSize: '12px' }}>Planned revenue across projects and fiscal years</Text>
          </div>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '0' }}>
            <Tabs
              items={items}
              size="small"
              defaultActiveKey="milestones"
              tabBarStyle={{ fontSize: '11px' }}
              style={{ padding: '0 16px' }}
            />
          </div>
        </Space>
      </div>
    </div>
  );
}
