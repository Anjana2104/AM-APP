import { useState } from 'react';
import {
  Divider,
  Segmented,
} from 'antd';
import {
  CalendarOutlined,
  HistoryOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { NotificationTriggersTab } from './NotificationTriggersTab';
import { NotificationHistoryTab } from './notifications/NotificationHistoryTab';
import { ScheduledRulesTab } from './notifications/ScheduledRulesTab';

export function AppNotificationsTab() {
  const [section, setSection] = useState<string>('triggers');
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Segmented
          size="small"
          value={section}
          onChange={(v) => setSection(v as string)}
          options={[
            { label: <span style={{ fontSize: 11 }}><ThunderboltOutlined /> Change Triggers</span>, value: 'triggers' },
            { label: <span style={{ fontSize: 11 }}><CalendarOutlined /> Scheduled Rules</span>, value: 'rules' },
          ]}
        />
        <Segmented
          size="small"
          value={section === 'history' ? 'history' : ''}
          onChange={(v) => { if (v === 'history') setSection('history'); }}
          options={[
            { label: <span style={{ fontSize: 11 }}><HistoryOutlined /> Run History</span>, value: 'history' },
          ]}
          style={{ opacity: section === 'history' ? 1 : 0.75 }}
        />
      </div>
      <Divider style={{ margin: '8px 0 0' }} />
      {section === 'triggers' ? <NotificationTriggersTab /> : section === 'rules' ? <ScheduledRulesTab /> : <NotificationHistoryTab />}
    </div>
  );
}

export default AppNotificationsTab;
