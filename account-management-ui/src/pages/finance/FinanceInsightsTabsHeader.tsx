import React from 'react';
import { Tabs } from 'antd';

interface FinanceInsightsTabsHeaderProps {
  activeTab: 'project' | 'booking';
  onTabChange: (next: 'project' | 'booking') => void;
}

export function FinanceInsightsTabsHeader({ activeTab, onTabChange }: FinanceInsightsTabsHeaderProps) {
  return (
    <Tabs
      size="small"
      activeKey={activeTab}
      onChange={(key) => onTabChange(key as 'project' | 'booking')}
      items={[
        { key: 'project', label: <span style={{ fontSize: '11px' }}>Project Insights</span> },
        { key: 'booking', label: <span style={{ fontSize: '11px' }}>Booking Insights</span> },
      ]}
      style={{ marginBottom: 12 }}
    />
  );
}

export default FinanceInsightsTabsHeader;
