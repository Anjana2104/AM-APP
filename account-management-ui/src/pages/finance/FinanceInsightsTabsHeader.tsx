import React from 'react';
import { Tabs } from 'antd';

interface FinanceInsightsTabsHeaderProps {
  activeTab: 'project' | 'booking' | 'resource';
  onTabChange: (next: 'project' | 'booking' | 'resource') => void;
}

export function FinanceInsightsTabsHeader({ activeTab, onTabChange }: FinanceInsightsTabsHeaderProps) {
  return (
    <Tabs
      size="small"
      activeKey={activeTab}
      onChange={(key) => onTabChange(key as 'project' | 'booking' | 'resource')}
      items={[
        { key: 'project', label: <span style={{ fontSize: '11px' }}>Project Insights</span> },
        { key: 'booking', label: <span style={{ fontSize: '11px' }}>Booking Insights</span> },
        { key: 'resource', label: <span style={{ fontSize: '11px' }}>Resource Insights</span> },
      ]}
      style={{ marginBottom: 12 }}
    />
  );
}

export default FinanceInsightsTabsHeader;
