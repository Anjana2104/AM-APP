import { Tabs, Typography } from 'antd';
import { ProjectList } from './ProjectList';
import { Insights } from './Insights';
import { FileExcelOutlined, BarChartOutlined } from '@ant-design/icons';
import { useState } from 'react';

const { Title } = Typography;

interface AccountFinanceProps {
  onNavigate?: (module: string) => void;
}

export function AccountFinance({ onNavigate }: AccountFinanceProps) {
  const [projectData, setProjectData] = useState<any[]>([]);
  const [monthHeaders, setMonthHeaders] = useState<string[]>([]);

  const items = [
    {
      key: 'milestones',
      label: (
        <span>
          <FileExcelOutlined />
          Project Milestones
        </span>
      ),
      children: (
        <ProjectList onDataChange={setProjectData} onMonthsChange={setMonthHeaders} />
      ),
    },
    {
      key: 'insights',
      label: (
        <span>
          <BarChartOutlined />
          Insights
        </span>
      ),
      children: (
        <Insights data={projectData} monthHeaders={monthHeaders} />
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '12px 24px' }}>
          <Tabs items={items} size="middle" defaultActiveKey="milestones" />
        </div>
      </div>
    </div>
  );
}
