/**
 * InvoiceManagement.tsx
 * 
 * Invoicing Details — Track and manage invoices with Excel upload/download,
 * monthly invoice tracking, and status management
 * UI Location: Account Operations > Finance > Invoicing Details
 * Page ID: executive_invoicing
 */
import React, { useState } from 'react';
import { Tabs, Space } from 'antd';
import { BarChartOutlined, FileTextOutlined } from '@ant-design/icons';
import { InvoiceInsightsPanel } from './invoice/InvoiceInsightsPanel';
import { InvoiceListTable } from './invoice/InvoiceListTable';
import type { InvRow } from './invoice/invoiceTypes';

interface InvoiceManagementProps {
  onNavigate?: (module: string) => void;
}

export function InvoiceManagement({ onNavigate: _onNavigate }: InvoiceManagementProps) {
  const [projectData, setProjectData] = useState<InvRow[]>([]);
  const [monthHeaders, setMonthHeaders] = useState<string[]>([]);

  const items = [
    {
      key: 'invoices',
      label: <span style={{ fontSize: '11px' }}><FileTextOutlined /> Project Invoices</span>,
      children: (
        <div style={{ padding: '0 0 16px' }}>
          <InvoiceListTable onDataChange={setProjectData} onMonthsChange={setMonthHeaders} />
        </div>
      ),
    },
    {
      key: 'insights',
      label: <span style={{ fontSize: '11px' }}><BarChartOutlined /> Insights</span>,
      children: <InvoiceInsightsPanel data={projectData} monthHeaders={monthHeaders} />,
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '12px 24px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <Space direction="vertical" style={{ width: '100%' }} size={6}>
          <div style={{ background: '#fff', borderRadius: 8 }}>
            <Tabs items={items} size="small" defaultActiveKey="invoices" style={{ padding: '0 16px' }} />
          </div>
        </Space>
      </div>
    </div>
  );
}
