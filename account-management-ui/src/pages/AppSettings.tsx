/**
 * src/pages/AppSettings.tsx
 *
 * App Settings — Global configuration manager for dropdown types, app key-value
 * settings, notification triggers and document templates.
 * UI Location: Settings & Configuration > App Settings
 * Page ID: configuration
 */
import { Tabs } from 'antd';
import {
  AppstoreOutlined,
  BellOutlined,
  DatabaseOutlined,
  FileProtectOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { TemplatesTab } from '../components/TemplatesTab';
import { AppConfigsTab } from './app-settings/AppConfigsTab';
import { AppNotificationsTab } from './app-settings/AppNotificationsTab';
import { AppValuesTab } from './app-settings/AppValuesTab';
import { ManageDataTab } from './app-settings/ManageDataTab';

export function AppSettings() {
  return (
    <div style={{ background: '#f5f7fa', minHeight: '100vh', padding: '16px 20px' }}>
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8' }}>
        <Tabs
          defaultActiveKey="triggers"
          size="small"
          style={{ padding: '0 16px' }}
          items={[
            {
              key: 'triggers',
              label: <span style={{ fontSize: 12 }}><BellOutlined /> App Notifications</span>,
              children: <AppNotificationsTab />,
            },
            {
              key: 'templates',
              label: <span style={{ fontSize: 12 }}><FileProtectOutlined /> Templates</span>,
              children: <TemplatesTab />,
            },
            {
              key: 'configs',
              label: <span style={{ fontSize: 12 }}><AppstoreOutlined /> Configs</span>,
              children: <AppConfigsTab />,
            },
            {
              key: 'app-values',
              label: <span style={{ fontSize: 12 }}><TableOutlined /> App Values</span>,
              children: <AppValuesTab />,
            },
            {
              key: 'manage-data',
              label: <span style={{ fontSize: 12 }}><DatabaseOutlined /> Manage Data</span>,
              children: <ManageDataTab />,
            },
          ]}
        />
      </div>
    </div>
  );
}

export default AppSettings;
