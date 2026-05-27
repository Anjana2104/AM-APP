import { Layout, Tabs, Typography } from 'antd';
import { ProjectList } from './ProjectList';
import { Insights } from './Insights';
import { FileExcelOutlined, BarChartOutlined } from '@ant-design/icons';
import { useState } from 'react';

const { Header, Content } = Layout;
const { Title } = Typography;

interface AccountFinanceProps {
  onNavigate?: (module: string) => void;
}

export function AccountFinance({ onNavigate }: AccountFinanceProps) {
  const [projectData, setProjectData] = useState<any[]>([]);
  const [monthHeaders, setMonthHeaders] = useState<string[]>([]);

  const items = [
    {
      key: 'projects',
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
          Revenue Insights
        </span>
      ),
      children: (
        <Insights data={projectData} monthHeaders={monthHeaders} />
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', display: 'flex', alignItems: 'center' }}>
        <Title level={4} style={{ color: '#fff', margin: 0 }}>
          Account Finance Management
        </Title>
      </Header>
      <Content style={{ padding: 24 }}>
        <Tabs items={items} size="large" defaultActiveKey="projects" />
      </Content>
    </Layout>
  );
}
