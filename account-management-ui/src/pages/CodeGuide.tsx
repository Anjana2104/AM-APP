import React from 'react';
import { Button, Typography, Divider, Tag, Space, Card } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

function downloadGuide() {
  const lines: string[] = [
    '# EAM - Enterprise Account Management UI',
    '## High-Level Code Guide', '',
    '### 1. Tech Stack',
    'React 18 + TypeScript | Vite | Ant Design | xlsx/SheetJS | dayjs | React Context + localStorage', '',
    '### 2. File Map',
    '  App.tsx - Shell: sidebar, routing, home page',
    '  context/ConfigContext.tsx - Global config store',
    '  pages/FinanceManagement.tsx - Finance tab',
    '  pages/ResourceInformation.tsx - Resources > Information',
    '  pages/EngagementMapping.tsx - Resources > Engagement Mapping',
    '  pages/RequestManagement.tsx - Client Requests',
    '  pages/InternalProcess.tsx - Internal Process (SOW, Pipeline)',
    '  pages/RateCard.tsx - Client Rate Card',
    '  pages/TeamHierarchy.tsx - Team Hierarchy',
    '  pages/Configuration.tsx - Dropdown config manager',
    '  pages/CodeGuide.tsx - This guide', '',
    '### 3. Routing',
    'Hash-based: #/home and #/eam/page. No external router.',
    'To add a page: EAMPage union -> PAGE_SECTION_MAP -> renderContent() -> sidebar item.', '',
    '### 4. ConfigContext',
    'Persists to localStorage[eam_app_configs]. useConfig() to read dropdowns.',
    'Methods: addConfigType, addItem, deleteItem, bulkImportConfigs, updateLinks.', '',
    '### 5. localStorage Keys',
    'eam_app_configs, eam_sow_files, eam_process_entries',
    'eam_requests, eam_resources, eam_rate_card, eam_finance_projects', '',
    '### 6. Excel Upload Pattern',
    '1. Download template - blank .xlsx with headers (SheetJS)',
    '2. Upload - map columns case-insensitively, merge into state + localStorage',
    '3. Status and S.No are auto-derived, never in template', '',
    '### 7. Adding a New Page',
    '1. Create src/pages/YourPage.tsx with named export',
    '2. Add to EAMPage union in App.tsx',
    '3. Map in PAGE_SECTION_MAP',
    '4. Add case in renderContent()',
    '5. Add SubNavItem/SideNavGroup in sidebar',
    '6. Import at top of App.tsx', '',
    '### 8. Production Notes',
    '- Finance data is wired to SQLite backend (see sections 9 & 10 for details).',
    '- Other data still uses localStorage - swap with API calls to extend.',
    '- No auth: add guard in main.tsx around ConfigProvider.',
    '- Bundle ~2MB: tree-shake antd via vite.config.ts.', '',
    '### 9. Backend API Layer (Express + SQLite)',
    '- Entry: server/index.js — Express on port 3001',
    '- Start: cd server && node index.js',
    '- Proxy: vite.config.ts proxies /api/* to http://localhost:3001',
    '- API client: src/api/financeApi.ts (auto-detects server, graceful fallback)',
    '- Routes: GET /api/finance/projects | GET /api/finance/month-headers',
    '- Routes: POST /api/finance/projects/bulk | PUT /projects/:id | DELETE /projects/:id',
    '- Setup: node server/db/migrate.js (create tables)',
    '- Seed:  node server/db/seed.js (load from Excel)', '',
    '### 10. Switching to PostgreSQL or MySQL',
    'Only file to change: server/config/database.js',
    '',
    'PostgreSQL:',
    '  1. npm install pg   (in server/ directory)',
    '  2. DB_CLIENT=pg',
    '  3. DB_HOST, DB_PORT=5432, DB_NAME, DB_USER, DB_PASSWORD',
    '  4. DB_SSL=true (if required)',
    '',
    'MySQL / MariaDB:',
    '  1. npm install mysql2  (in server/ directory)',
    '  2. DB_CLIENT=mysql2',
    '  3. DB_HOST, DB_PORT=3306, DB_NAME, DB_USER, DB_PASSWORD',
    '',
    'After switching DB:',
    '  node server/db/migrate.js  — create tables in new DB',
    '  node server/db/seed.js     — optional: seed initial data',
    '  No changes in routes, frontend, or any other file.',
    '  Cloud deploy: set env vars in Azure / AWS / GCP platform settings.',
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'EAM_Code_Guide.md'; a.click();
  URL.revokeObjectURL(url);
}

const ROWS = [
  { tag: '01', color: '#1890ff', title: 'Technology Stack',
    items: ['React 18 + TypeScript', 'Vite (build tool)', 'Ant Design (UI library)', 'xlsx / SheetJS (Excel upload/download)', 'dayjs (date handling)', 'React Context + localStorage (state)'] },
  { tag: '02', color: '#13c2c2', title: 'File Map',
    items: ['App.tsx - Shell, sidebar, routing, home page', 'context/ConfigContext.tsx - Global config store', 'pages/FinanceManagement.tsx - Finance tab', 'pages/ResourceInformation.tsx - Resource data', 'pages/EngagementMapping.tsx - Engagement tracking', 'pages/RequestManagement.tsx - Client requests', 'pages/InternalProcess.tsx - SOW, pipeline, insights', 'pages/RateCard.tsx - Client rate card', 'pages/TeamHierarchy.tsx - Org chart', 'pages/Configuration.tsx - Dropdown manager'] },
  { tag: '03', color: '#fa8c16', title: 'Routing',
    items: ['Hash-based: #/home | #/eam/<page>', 'No external router library', 'activeModule + activePage state in App.tsx', 'EAMPage union type lists all valid pages', 'PAGE_SECTION_MAP maps pages to sidebar sections', 'renderContent() renders the right component per page'] },
  { tag: '04', color: '#722ed1', title: 'ConfigContext (Global State)',
    items: ['Persists to localStorage[eam_app_configs]', 'Call useConfig() to read dropdown values anywhere', 'addConfigType - create a new config group', 'addItem / deleteItem - manage values', 'bulkImportConfigs - atomic batch import from Excel', 'updateLinks - link config type to UI fields'] },
  { tag: '05', color: '#52c41a', title: 'localStorage Keys',
    items: ['eam_app_configs - Config dropdown values', 'eam_sow_files - SOW documents (base64)', 'eam_process_entries - Internal Process rows', 'eam_requests - Client Request rows', 'eam_resources - Resource information rows', 'eam_rate_card - Rate card data', 'eam_finance_projects - Finance project data'] },
  { tag: '06', color: '#eb2f96', title: 'Excel Upload/Download Pattern',
    items: ['1. Download template generates blank .xlsx with headers', '2. Upload reads file and maps columns case-insensitively', '3. Rows merged into React state and localStorage', '4. Status and S.No never in template - auto-derived'] },
  { tag: '07', color: '#1890ff', title: 'Adding a New Page (Checklist)',
    items: ['1. Create src/pages/YourPage.tsx with named export', '2. Add to EAMPage union type in App.tsx', '3. Map in PAGE_SECTION_MAP to an EAMSection', '4. Add case in renderContent() switch', '5. Add SubNavItem or SideNavGroup in sidebar', '6. Import component at top of App.tsx'] },
  { tag: '08', color: '#f5222d', title: 'Production Readiness',
    items: ['Data is localStorage-only for most features — swap get/setItem for API calls to add a backend', 'ConfigContext persist() is single config write point', 'No auth layer - add guard around ConfigProvider in main.tsx', 'Bundle ~2MB - configure antd tree-shaking in vite.config.ts', 'Finance data is already wired to the SQLite backend (see section 09 & 10)'] },
  { tag: '09', color: '#1677ff', title: 'Backend API Layer (Express + SQLite)',
    items: [
      'Entry point: server/index.js — Express app on port 3001',
      'Start server: cd server && node index.js',
      'Frontend proxies /api/* → http://localhost:3001 via vite.config.ts',
      'API client: src/api/financeApi.ts — auto-detects server; falls back gracefully if offline',
      'Routes: GET /api/finance/projects | GET /api/finance/month-headers',
      'Routes: POST /api/finance/projects/bulk (full replace on upload)',
      'Routes: PUT /api/finance/projects/:id | DELETE /api/finance/projects/:id',
      'Finance page loads from DB on mount; shows green cloud icon when connected',
      'Save Changes button appears on any edit — bulk-saves all rows back to DB',
      'Run once: node server/db/migrate.js → creates tables',
      'Seed from Excel: node server/db/seed.js (or pass custom path as argument)',
    ] },
  { tag: '10', color: '#722ed1', title: 'Switching Database (SQLite → PostgreSQL / MySQL)',
    items: [
      'ONLY file to change: server/config/database.js',
      '─── PostgreSQL ───',
      '1. npm install pg  (inside server/ directory)',
      '2. Set env var: DB_CLIENT=pg',
      '3. Set: DB_HOST, DB_PORT (5432), DB_NAME, DB_USER, DB_PASSWORD',
      '4. Optional SSL: DB_SSL=true',
      '─── MySQL / MariaDB ───',
      '1. npm install mysql2  (inside server/ directory)',
      '2. Set env var: DB_CLIENT=mysql2',
      '3. Set: DB_HOST, DB_PORT (3306), DB_NAME, DB_USER, DB_PASSWORD',
      '─── After switching ───',
      'Run: node server/db/migrate.js  — creates tables in new DB',
      'Run: node server/db/seed.js     — seeds initial data (optional)',
      'No changes needed in routes, adapters, or frontend code',
      'Cloud deploy: set env vars in your cloud platform (Azure / AWS / GCP)',
    ] },
];

export function CodeGuide() {
  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#0d1b2e' }}>Code Guide</Title>
          <Paragraph style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>
            High-level overview of the EAM architecture, file structure and conventions.
          </Paragraph>
        </div>
        <Button type="primary" icon={<DownloadOutlined />} onClick={downloadGuide} style={{ background: '#0d1b2e', borderColor: '#0d1b2e' }}>
          Download Guide (.md)
        </Button>
      </div>
      <Divider style={{ margin: '0 0 24px' }} />
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {ROWS.map(sec => (
          <Card
            key={sec.tag} size="small"
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Tag color={sec.color} style={{ fontWeight: 700, fontSize: 11 }}>{sec.tag}</Tag>
                <Text strong style={{ fontSize: 14, color: '#0d1b2e' }}>{sec.title}</Text>
              </span>
            }
            style={{ borderRadius: 10 }}
          >
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {sec.items.map((item, i) => <li key={i} style={{ fontSize: 13, lineHeight: 1.9, color: '#444' }}>{item}</li>)}
            </ul>
          </Card>
        ))}
      </Space>
      <div style={{ marginTop: 28, textAlign: 'center', color: '#bbb', fontSize: 12 }}>
        Generated {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
    </div>
  );
}