/**
 * CodeGuide.tsx
 * 
 * Knowledge Base > Code Guide - Comprehensive development documentation
 * with tabbed interface, search functionality, and modern UI
 * UI Location: Knowledge Base > Code Guide
 * Page ID: information_codeguide
 */
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Button, Typography, Divider, Tag, Space, Card, Tabs, Input, Table, 
  Descriptions, Alert, Collapse, Timeline, List, Badge, Row, Col,
  Statistic
} from 'antd';
import { 
  DownloadOutlined, SearchOutlined, CodeOutlined, ApiOutlined, 
  DatabaseOutlined, FileTextOutlined, SettingOutlined, RocketOutlined,
  BulbOutlined, FolderOutlined, CloudServerOutlined, SwapOutlined,
  SafetyOutlined, HistoryOutlined, CheckCircleOutlined, AppstoreOutlined,
  BuildOutlined, DeploymentUnitOutlined, ExperimentOutlined, LinkOutlined,
  ThunderboltOutlined, NodeIndexOutlined, FunctionOutlined
} from '@ant-design/icons';
import { 
  Document, Packer, Paragraph as DocxParagraph, TextRun, HeadingLevel, AlignmentType, 
  Table as DocxTable, TableRow, TableCell, WidthType, BorderStyle 
} from 'docx';

const { Title, Paragraph, Text, Link } = Typography;

// File Mappings Data — kept in sync with App.tsx EAMPage type
const FILE_MAPPINGS = [
  { key: '1',  fileName: 'AccountSummary.tsx',       uiTab: 'Account Summary',                    pageId: 'account_summary',       type: 'Page',             status: 'Active' },
  { key: '2',  fileName: 'FinanceSummary.tsx',        uiTab: 'Finance > Summary',                  pageId: 'executive_summary',     type: 'Page',             status: 'Active' },
  { key: '3',  fileName: 'FinanceManagement.tsx',     uiTab: 'Finance > SOW Details',              pageId: 'executive_revenue',     type: 'Page',             status: 'Active' },
  { key: '4',  fileName: 'InvoiceManagement.tsx',     uiTab: 'Finance > Invoicing Details',        pageId: 'executive_invoicing',   type: 'Page',             status: 'Active' },
  { key: '5',  fileName: 'ResourceHub.tsx',           uiTab: 'Resources > Resource Hub',           pageId: 'resources_info',        type: 'Page',             status: 'Active' },
  { key: '6',  fileName: 'ResourceIntelligence.tsx',  uiTab: 'Resources > Resource Intelligence',  pageId: 'resources_insights',    type: 'Page',             status: 'Active' },
  { key: '7',  fileName: 'EngagementMapping.tsx',     uiTab: 'Resources > Engagement Mapping',     pageId: 'resources_utilization', type: 'Page',             status: 'Active' },
  { key: '8',  fileName: 'ClientRequests.tsx',        uiTab: 'Clients > Requests',                 pageId: 'clientmgmt_requests',   type: 'Page',             status: 'Active' },
  { key: '9',  fileName: 'InternalProcess.tsx',       uiTab: 'Internal Process',                   pageId: 'clientmgmt_connects',   type: 'Page',             status: 'Active' },
  { key: '10', fileName: 'RateCard.tsx',              uiTab: 'Knowledge Base > Client Rate Card',  pageId: 'information_ratecard',  type: 'Page',             status: 'Active' },
  { key: '11', fileName: 'TeamHierarchy.tsx',         uiTab: 'Knowledge Base > Team Hierarchy',    pageId: 'information_teamhierarchy', type: 'Page',        status: 'Active' },
  { key: '12', fileName: 'CodeGuide.tsx',             uiTab: 'Knowledge Base > Code Guide',        pageId: 'information_codeguide', type: 'Page',             status: 'Active' },
  { key: '13', fileName: 'Configuration.tsx',         uiTab: 'Settings > Configuration',           pageId: 'configuration',         type: 'Page',             status: 'Active' },
  { key: '14', fileName: 'UserSettings.tsx',          uiTab: 'Settings > User Settings',           pageId: 'user_settings',         type: 'Page',             status: 'Active' },
  { key: '15', fileName: 'UserAccessControl.tsx',     uiTab: 'Settings > User Access Control',     pageId: 'user_access_control',   type: 'Page',             status: 'Active' },
  { key: '16', fileName: 'LoginPage.tsx',             uiTab: 'Login',                              pageId: 'login',                 type: 'Page',             status: 'Active' },
  { key: '17', fileName: 'EnhancedInsights.tsx',      uiTab: 'Client Requests > Insights (child)', pageId: 'enhanced_insights',     type: 'Child Component',  status: 'Active' },
  { key: '18', fileName: 'ProcessDetailPanel.tsx',    uiTab: 'Internal Process > Detail Panel',    pageId: 'process_detail_panel',  type: 'Shared Component', status: 'Active' },
  { key: '19', fileName: 'RequestDetailPanel.tsx',    uiTab: 'Client Requests > Detail Panel',     pageId: 'request_detail_panel',  type: 'Shared Component', status: 'Active' },
  { key: '20', fileName: 'ResourceDetailPanel.tsx',   uiTab: 'Resource Hub > Detail Drawer',       pageId: 'resource_detail_panel', type: 'Shared Component', status: 'Active' },
  { key: '21', fileName: 'ResourceOverviewCharts.tsx',uiTab: 'Shared Charts Component',            pageId: 'resource_overview_charts', type: 'Shared Component', status: 'Active' },
  { key: '22', fileName: 'TemplatesTab.tsx',          uiTab: 'Configuration > Templates tab',      pageId: 'templates_tab',         type: 'Shared Component', status: 'Active' },
];

// API Endpoints Data — sourced from docs/UI_API_DB_MAPPING.md and docs/ARCHITECTURE.md
const API_ENDPOINTS = [
  { key: '1',  dataSource: 'Finance Projects',     clientFile: 'financeApi.ts',          backendRoute: '/api/finance/projects',             operations: 'GET, POST, PUT, DELETE', description: 'Finance project CRUD + bulk import + Excel export' },
  { key: '2',  dataSource: 'Finance Revenue',      clientFile: 'financeApi.ts',          backendRoute: '/api/finance/revenue',               operations: 'GET, POST',              description: 'Monthly revenue entries per project' },
  { key: '3',  dataSource: 'Invoice Projects',     clientFile: 'invoiceApi.ts',          backendRoute: '/api/invoice/projects',              operations: 'GET, POST, PUT, DELETE', description: 'Invoice project management' },
  { key: '4',  dataSource: 'Invoice Amounts',      clientFile: 'invoiceApi.ts',          backendRoute: '/api/invoice/amounts',               operations: 'GET, POST',              description: 'Monthly invoice amounts per project' },
  { key: '5',  dataSource: 'Resources',            clientFile: 'resourceApi.ts',         backendRoute: '/api/resources',                     operations: 'GET, POST, PUT, DELETE', description: 'Resource CRUD, bulk upsert by ra_id, Beeline link' },
  { key: '6',  dataSource: 'Resource Comments',    clientFile: 'resourceApi.ts',         backendRoute: '/api/resources/:id/comments',        operations: 'GET, POST, PUT, DELETE', description: 'Per-resource comments and notes' },
  { key: '7',  dataSource: 'Resource Insights',    clientFile: 'resourceInsightsApi.ts', backendRoute: '/api/resource-insights',             operations: 'GET, POST, PUT, DELETE', description: 'Resource Intelligence log entries (interactions, plans, risks)' },
  { key: '8',  dataSource: 'Client Requests',      clientFile: 'requestApi.ts',          backendRoute: '/api/requests',                      operations: 'GET, POST, PUT, DELETE', description: 'Beeline request lifecycle management + bulk import' },
  { key: '9',  dataSource: 'Request Comments',     clientFile: 'requestApi.ts',          backendRoute: '/api/requests/:id/comments',         operations: 'GET, POST',              description: 'Per-request comments' },
  { key: '10', dataSource: 'Internal Process',     clientFile: 'processApi.ts',          backendRoute: '/api/process',                       operations: 'GET, POST, PUT, DELETE', description: 'SOW record CRUD + PIW link + resource engagement dates' },
  { key: '11', dataSource: 'Process Comments',     clientFile: 'processApi.ts',          backendRoute: '/api/process/:id/comments',          operations: 'GET, POST, DELETE',      description: 'Per-process comments' },
  { key: '12', dataSource: 'PIW Generation',       clientFile: 'piwApi.ts',              backendRoute: '/api/piwGeneration/generate',         operations: 'POST',                   description: 'Generate filled .xlsm PIW file from template' },
  { key: '13', dataSource: 'PIW Upload',           clientFile: 'piwApi.ts',              backendRoute: '/api/piwGeneration/upload',           operations: 'POST',                   description: 'Upload PIW file and sync resource engagement dates' },
  { key: '14', dataSource: 'SOW Generation',       clientFile: 'sowApi.ts',              backendRoute: '/api/sowGeneration/generate',         operations: 'POST',                   description: 'Generate filled .docx SOW from Word template' },
  { key: '15', dataSource: 'Audit Log',            clientFile: 'auditApi.ts',            backendRoute: '/api/audit/:module/:recordId',        operations: 'GET, POST',              description: 'Immutable audit trail — read and write field-change events' },
  { key: '16', dataSource: 'Audit (Combined)',     clientFile: 'auditApi.ts',            backendRoute: '/api/audit/process-combined/:id',    operations: 'GET',                    description: 'Merged audit: SOW fields + resource linking + engagement dates' },
  { key: '17', dataSource: 'Configuration',        clientFile: 'configApi.ts',           backendRoute: '/api/config/types, /api/config/items', operations: 'GET, POST, PUT, DELETE', description: 'Dropdown config types and option values (inc. Code Guide entries)' },
  { key: '18', dataSource: 'App Values',           clientFile: 'configApi.ts',           backendRoute: '/api/config/values',                 operations: 'GET, POST',              description: 'Generic key-value app settings store' },
  { key: '19', dataSource: 'Templates',            clientFile: 'templateApi.ts',         backendRoute: '/api/templates',                     operations: 'GET, POST, DELETE',      description: 'Binary file storage: PIW, SOW, holiday calendar templates' },
  { key: '20', dataSource: 'Authentication',       clientFile: 'authApi.ts',             backendRoute: '/api/auth/login, /api/auth/logout',  operations: 'POST',                   description: 'Login (PBKDF2-SHA256 + env salt), logout' },
  { key: '21', dataSource: 'Users',                clientFile: 'authApi.ts',             backendRoute: '/api/users',                         operations: 'GET, POST, PUT, DELETE', description: 'User account management (password never returned)' },
  { key: '22', dataSource: 'Roles',                clientFile: 'authApi.ts',             backendRoute: '/api/roles',                         operations: 'GET, POST, PUT, DELETE', description: 'Role definitions with page-level permissions JSON' },
  { key: '23', dataSource: 'User Groups',          clientFile: 'notificationApi.ts',     backendRoute: '/api/user-groups',                   operations: 'GET, POST, PUT, DELETE', description: 'Named user groups for notification targeting' },
  { key: '24', dataSource: 'Notifications',        clientFile: 'notificationApi.ts',     backendRoute: '/api/notifications',                 operations: 'GET, POST, PUT',         description: 'In-app notifications — list, mark read, send' },
  { key: '25', dataSource: 'Notification Triggers',clientFile: 'notificationTriggerApi.ts',backendRoute: '/api/notification-triggers',       operations: 'GET, POST, PUT, DELETE', description: 'Auto-fire rules: source table + trigger field → notification' },
  { key: '26', dataSource: 'User Preferences',     clientFile: 'userPreferencesApi.ts',  backendRoute: '/api/user-preferences/:userId',      operations: 'GET, PUT',               description: 'Per-user UI preferences (column visibility, theme, etc.)' },
  { key: '27', dataSource: 'AI / LLM',             clientFile: 'aiApi.ts',               backendRoute: '/api/ai/summary',                    operations: 'POST',                   description: 'OpenAI proxy for AI-assisted log summaries (no DB write)' },
  { key: '28', dataSource: 'Health Check',         clientFile: '—',                      backendRoute: '/api/health',                        operations: 'GET',                    description: 'Server health check: returns DB client type + timestamp' },
];

// Database Tables — sourced from docs/DATABASE_DESIGN.md
const DB_TABLES = [
  { key: '1',  table: 'finance_projects',        domain: 'Finance',         description: 'Billable projects for revenue management', keyColumns: 'id, code (UNIQUE), project, company, status, active' },
  { key: '2',  table: 'finance_revenue',         domain: 'Finance',         description: 'Monthly revenue entries per project', keyColumns: 'id, project_id (FK), month (YYYY-MM), amount, milestone_type' },
  { key: '3',  table: 'invoice_projects',        domain: 'Finance',         description: 'Projects for invoice management (separate from finance)', keyColumns: 'id, code (UNIQUE), project, company, status' },
  { key: '4',  table: 'invoice_amounts',         domain: 'Finance',         description: 'Monthly invoice amounts per invoice project', keyColumns: 'id, project_id (FK), month, amount' },
  { key: '5',  table: 'client_requests',         domain: 'Client Requests', description: 'Beeline / client resource requests (staffing requests)', keyColumns: 'id, beeline_id (UNIQUE), processing_status, overall_status, is_active' },
  { key: '6',  table: 'request_comments',        domain: 'Client Requests', description: 'Comments attached to client requests', keyColumns: 'id, request_id (FK), author, tag, body' },
  { key: '7',  table: 'resources',               domain: 'Resources',       description: 'RA employee/resource records — master list', keyColumns: 'id, ra_id (UNIQUE), emp_name, beeline_id, process_id (FK), allocation_status, engagement_start_date, engagement_end_date' },
  { key: '8',  table: 'resource_insights',       domain: 'Resources',       description: 'Resource Intelligence log entries (interactions, risks, plans)', keyColumns: 'id, resource_id (FK), section, title, body, status, priority' },
  { key: '9',  table: 'resource_comments',       domain: 'Resources',       description: 'Free-form comments on resources', keyColumns: 'id, resource_id (FK), author, tag, body' },
  { key: '10', table: 'ra_process',              domain: 'Internal Process',description: 'SOW (Statement of Work) records — core process table', keyColumns: 'id, sow (UNIQUE), process_id, piw (UNIQUE), salesforce_id, proms_id, open_air_code, eprev, account_anchor' },
  { key: '11', table: 'audit_log',               domain: 'Cross-cutting',   description: 'Immutable field-level audit trail across all modules', keyColumns: 'id, module, record_id, field, old_value, new_value, changed_by, changed_at' },
  { key: '12', table: 'app_config_types',        domain: 'Configuration',   description: 'Dropdown category definitions (e.g. code_guide, allocation_status)', keyColumns: 'id, type_id (UNIQUE), name, built_in, linked_to (JSON)' },
  { key: '13', table: 'app_config_items',        domain: 'Configuration',   description: 'Option values within each config type', keyColumns: 'id, type_id (FK), item_value, label, color, sort_order' },
  { key: '14', table: 'app_values',              domain: 'Configuration',   description: 'Generic key-value store for app-level settings', keyColumns: 'id, key (UNIQUE), value, description' },
  { key: '15', table: 'templates',               domain: 'Configuration',   description: 'Binary file storage: PIW, SOW, holiday calendar templates', keyColumns: 'id (UUID), type (UNIQUE), file_name, file_size, file_data (BLOB), uploaded_by' },
  { key: '16', table: 'roles',                   domain: 'Auth',            description: 'User access roles with page-level permissions JSON', keyColumns: 'id, name (UNIQUE), permissions (JSON: {page_id: {view,edit,delete}})' },
  { key: '17', table: 'users',                   domain: 'Auth',            description: 'Application user accounts', keyColumns: 'id, username (UNIQUE), password_hash, display_name, role_id (FK), active' },
  { key: '18', table: 'user_groups',             domain: 'Auth',            description: 'Named groups for notification targeting', keyColumns: 'id, name, description, user_type_config_id' },
  { key: '19', table: 'user_group_members',      domain: 'Auth',            description: 'Members of user groups (many-to-many)', keyColumns: 'id, group_id (FK), user_id (FK) — UNIQUE(group_id, user_id)' },
  { key: '20', table: 'user_preferences',        domain: 'Auth',            description: 'Per-user UI preferences blob', keyColumns: 'id, user_id (UNIQUE FK), preferences (JSON)' },
  { key: '21', table: 'notifications',           domain: 'Notifications',   description: 'In-app notifications (bell icon)', keyColumns: 'id, type, title, message, target_user_id, target_group_id, read_by (JSON), trigger_id (FK)' },
  { key: '22', table: 'notification_triggers',   domain: 'Notifications',   description: 'Auto-fire rules: watch a field on a table and create notifications', keyColumns: 'id, source_table, trigger_field, message_template, notify_target_type, is_active' },
];

// Key Workflows — sourced from docs/WORKFLOW.md
const WORKFLOWS = [
  {
    key: '1', title: 'Resource Onboarding',
    steps: [
      'Upload Excel → POST /api/resources/bulk-upload',
      'System upserts records by ra_id (INSERT or UPDATE)',
      'Audit log written for each changed field',
      'Resource appears in Resource Hub list',
      '(Optional) Link to SOW: PUT /api/resources/:id/link-process',
      '(Optional) Set engagement dates: PUT /api/resources/batch',
    ]
  },
  {
    key: '2', title: 'PIW Upload → Resource Date Sync',
    steps: [
      'User selects process and clicks Upload PIW',
      'Upload .xlsm file → POST /api/piwGeneration/upload',
      'Server parses Excel: extracts PIW filename, RAID tab, Resource Summary',
      'UPDATE ra_process SET piw = filename + write audit_log',
      'For each resource in RAID tab: match by ra_id, UPDATE engagement dates',
      'Audit log written per resource date change',
    ]
  },
  {
    key: '3', title: 'PIW Generation',
    steps: [
      'Select PIW template, holiday calendar, billing period (Step 1)',
      'POST /api/piwGeneration/generate → load .xlsm template from DB',
      'Populate sheets: Resource Summary, RAID, Calculation; inject holidays',
      'Preview filled data (Step 2)',
      'Download generated .xlsm file (Step 3)',
    ]
  },
  {
    key: '4', title: 'SOW Generation',
    steps: [
      'Click Generate SOW on a process',
      'POST /api/sowGeneration/generate',
      'Load SOW Word template from templates table',
      'Replace placeholders: {{sow_name}}, {{start_date}}, {{resources}}, etc.',
      'Return filled .docx as download',
    ]
  },
  {
    key: '5', title: 'Audit Trail Flow',
    steps: [
      'Any data mutation (edit, link, upload) triggers audit write',
      'POST /api/audit with: {module, record_id, field, old_value, new_value, changed_by}',
      'Server inserts into audit_log table',
      'Process audit: GET /api/audit/process-combined/:id (merges field + link + engagement changes)',
      'Resource audit: GET /api/audit/resources/:id',
      'Visible in: SOW Detail → Audit tab, Resource panel → Audit Log, Resource Intelligence panel',
    ]
  },
  {
    key: '6', title: 'Notification Trigger Flow',
    steps: [
      'User edits a field (e.g. processing_status on a client request)',
      'PUT /api/requests/:id → UPDATE client_requests',
      'Server calls evaluateTriggers(db, "client_requests", changedFields)',
      'Query notification_triggers WHERE source_table matches AND is_active = 1',
      'For each matching trigger: resolve target users/groups',
      'INSERT into notifications',
      'Bell icon in UI updates (polling every 30s)',
    ]
  },
  {
    key: '7', title: 'Browser Navigation (Back/Forward)',
    steps: [
      'Click sidebar → navigateTo(page, section) in App.tsx',
      'window.history.pushState({module, page}, "", "#/eam/page_id")',
      'setState: activePage, activeModule',
      'Browser Back pressed → "popstate" event fires',
      'Restore: activePage and activeModule from event.state',
      'Previous filters, selected tab, open panels are all preserved',
    ]
  },
  {
    key: '8', title: 'SOW → Resource Cross-Navigation',
    steps: [
      'Resource has process_id linked to ra_process',
      'User clicks "Linked SOW" tag in Resource Hub or Resource Intelligence panel',
      'onNavigateToProcess(sowName) callback fires in App.tsx',
      'App.tsx sets initialProcessSow = sowName and navigates to internal process',
      'InternalProcess renders with initialSow prop → filters pre-filled → detail auto-opens',
    ]
  },
];

// Download guide as Word document
async function downloadGuide() {
  try {
    const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Title Page
        new DocxParagraph({
          text: 'EAM - Enterprise Account Management',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),
        new DocxParagraph({
          text: 'Code Guide & Technical Documentation',
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        }),
        new DocxParagraph({
          text: new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          alignment: AlignmentType.CENTER,
          spacing: { after: 800 }
        }),

        // Section 1: Overview
        new DocxParagraph({
          text: 'Technology Stack',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        }),

        // Frontend Stack
        new DocxParagraph({
          text: 'Frontend',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        }),
        new DocxParagraph({ text: '� React 18 + TypeScript', spacing: { after: 100 } }),
        new DocxParagraph({ text: '� Vite (build tool & dev server)', spacing: { after: 100 } }),
        new DocxParagraph({ text: '� Ant Design (UI components)', spacing: { after: 100 } }),
        new DocxParagraph({ text: '� xlsx / SheetJS (Excel operations)', spacing: { after: 100 } }),
        new DocxParagraph({ text: '� dayjs (date handling)', spacing: { after: 100 } }),
        new DocxParagraph({ text: '� Recharts (data visualization)', spacing: { after: 100 } }),
        new DocxParagraph({ text: '� html2canvas + jsPDF (exports)', spacing: { after: 100 } }),
        new DocxParagraph({ text: '� React Context (state management)', spacing: { after: 200 } }),

        // Backend Stack
        new DocxParagraph({
          text: 'Backend',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        }),
        new DocxParagraph({ text: '� Node.js + Express (REST API)', spacing: { after: 100 } }),
        new DocxParagraph({ text: '� SQLite (embedded database)', spacing: { after: 100 } }),
        new DocxParagraph({ text: '� Knex.js (query builder)', spacing: { after: 100 } }),
        new DocxParagraph({ text: '� bcrypt (password hashing)', spacing: { after: 200 } }),

        // Development Tools
        new DocxParagraph({
          text: 'Development Tools',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        }),
        new DocxParagraph({ text: '� TypeScript (type safety)', spacing: { after: 100 } }),
        new DocxParagraph({ text: '� ESLint (code quality)', spacing: { after: 100 } }),
        new DocxParagraph({ text: '� Git (version control)', spacing: { after: 200 } }),

        // Quick Commands
        new DocxParagraph({
          text: 'Quick Commands',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Start Backend: ', bold: true }),
            new TextRun({ text: 'cd server && node index.js', font: 'Courier New' })
          ],
          spacing: { after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Start Frontend: ', bold: true }),
            new TextRun({ text: 'npm run dev', font: 'Courier New' })
          ],
          spacing: { after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Run Migrations: ', bold: true }),
            new TextRun({ text: 'node server/db/migrate.js', font: 'Courier New' })
          ],
          spacing: { after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Seed Data: ', bold: true }),
            new TextRun({ text: 'node server/db/seed.js', font: 'Courier New' })
          ],
          spacing: { after: 400 }
        }),

        // Section 2: File Structure
        new DocxParagraph({
          text: 'File Structure',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        }),
        new DocxParagraph({
          text: 'File Mappings',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 }
        }),

        // File Mappings Table
        new DocxTable({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new DocxParagraph({ text: 'File Name', bold: true })] }),
                new TableCell({ children: [new DocxParagraph({ text: 'UI Tab', bold: true })] }),
                new TableCell({ children: [new DocxParagraph({ text: 'Page ID', bold: true })] }),
                new TableCell({ children: [new DocxParagraph({ text: 'Type', bold: true })] }),
                new TableCell({ children: [new DocxParagraph({ text: 'Status', bold: true })] })
              ]
            }),
            ...FILE_MAPPINGS.map(file => 
              new TableRow({
                children: [
                  new TableCell({ children: [new DocxParagraph({ text: file.fileName, font: 'Courier New' })] }),
                  new TableCell({ children: [new DocxParagraph({ text: file.uiTab })] }),
                  new TableCell({ children: [new DocxParagraph({ text: file.pageId })] }),
                  new TableCell({ children: [new DocxParagraph({ text: file.type })] }),
                  new TableCell({ children: [new DocxParagraph({ text: file.status })] })
                ]
              })
            )
          ]
        }),

        // Section 3: Backend API
        new DocxParagraph({
          text: 'Backend API',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        }),
        new DocxParagraph({
          text: 'API Endpoints',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 }
        }),

        // API Endpoints Table
        new DocxTable({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new DocxParagraph({ text: 'Data Source', bold: true })] }),
                new TableCell({ children: [new DocxParagraph({ text: 'Client File', bold: true })] }),
                new TableCell({ children: [new DocxParagraph({ text: 'Backend Route', bold: true })] }),
                new TableCell({ children: [new DocxParagraph({ text: 'Operations', bold: true })] }),
                new TableCell({ children: [new DocxParagraph({ text: 'Description', bold: true })] })
              ]
            }),
            ...API_ENDPOINTS.map(api => 
              new TableRow({
                children: [
                  new TableCell({ children: [new DocxParagraph({ text: api.dataSource })] }),
                  new TableCell({ children: [new DocxParagraph({ text: api.clientFile, font: 'Courier New' })] }),
                  new TableCell({ children: [new DocxParagraph({ text: api.backendRoute, font: 'Courier New' })] }),
                  new TableCell({ children: [new DocxParagraph({ text: api.operations })] }),
                  new TableCell({ children: [new DocxParagraph({ text: api.description })] })
                ]
              })
            )
          ]
        }),

        // Backend Setup
        new DocxParagraph({
          text: 'Backend Setup',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Entry Point: ', bold: true }),
            new TextRun({ text: 'server/index.js � Express on port 3001' })
          ],
          spacing: { after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Start Command: ', bold: true }),
            new TextRun({ text: 'cd server && node index.js', font: 'Courier New' })
          ],
          spacing: { after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Vite Proxy: ', bold: true }),
            new TextRun({ text: 'vite.config.ts proxies /api/* to http://localhost:3001' })
          ],
          spacing: { after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Database: ', bold: true }),
            new TextRun({ text: 'SQLite (embedded) - switch to PostgreSQL/MySQL by changing server/config/database.js' })
          ],
          spacing: { after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Migration: ', bold: true }),
            new TextRun({ text: 'node server/db/migrate.js', font: 'Courier New' }),
            new TextRun({ text: ' � creates all tables' })
          ],
          spacing: { after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Seeding: ', bold: true }),
            new TextRun({ text: 'node server/db/seed.js', font: 'Courier New' }),
            new TextRun({ text: ' � populates initial data' })
          ],
          spacing: { after: 400 }
        }),

        // Section 4: Development Guide
        new DocxParagraph({
          text: 'Development Guide',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        }),

        // Adding a New Page
        new DocxParagraph({
          text: 'Adding a New Page',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        }),
        new DocxParagraph({ text: '1. Create src/pages/YourPage.tsx with named export', spacing: { after: 100 } }),
        new DocxParagraph({ text: '2. Add to EAMPage union type in App.tsx', spacing: { after: 100 } }),
        new DocxParagraph({ text: '3. Map in PAGE_SECTION_MAP object', spacing: { after: 100 } }),
        new DocxParagraph({ text: '4. Add case in renderContent() switch statement', spacing: { after: 100 } }),
        new DocxParagraph({ text: '5. Add SubNavItem or SideNavGroup in sidebar', spacing: { after: 100 } }),
        new DocxParagraph({ text: '6. Import at top of App.tsx', spacing: { after: 200 } }),

        // Routing Pattern
        new DocxParagraph({
          text: 'Routing Pattern',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Hash-based routing: ', bold: true }),
            new TextRun({ text: 'The application uses hash-based routing with patterns like ' }),
            new TextRun({ text: '#/home', font: 'Courier New' }),
            new TextRun({ text: ' and ' }),
            new TextRun({ text: '#/eam/page_id', font: 'Courier New' })
          ],
          spacing: { after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'No external router: ', bold: true }),
            new TextRun({ text: 'Custom implementation in App.tsx - no external router library required' })
          ],
          spacing: { after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Route flow: ', bold: true }),
            new TextRun({ text: 'URL hash ? App.tsx currentPage state ? PAGE_SECTION_MAP ? renderContent() ? Page component' })
          ],
          spacing: { after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Examples:', bold: true })
          ],
          spacing: { after: 50 }
        }),
        new DocxParagraph({ text: '� Dashboard: #/eam/account_summary', spacing: { after: 50 } }),
        new DocxParagraph({ text: '� Finance Summary: #/eam/executive_summary', spacing: { after: 50 } }),
        new DocxParagraph({ text: '� Resource Hub: #/eam/resources_info', spacing: { after: 50 } }),
        new DocxParagraph({ text: '� Client Requests: #/eam/clientmgmt_requests', spacing: { after: 50 } }),
        new DocxParagraph({ text: '� Code Guide: #/eam/information_codeguide', spacing: { after: 200 } }),

        // ConfigContext
        new DocxParagraph({
          text: 'ConfigContext',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Purpose: ', bold: true }),
            new TextRun({ text: 'Global configuration store with localStorage persistence' })
          ],
          spacing: { after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Usage: ', bold: true }),
            new TextRun({ text: 'const { config } = useConfig()', font: 'Courier New' })
          ],
          spacing: { after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Methods: ', bold: true }),
            new TextRun({ text: 'addConfigType, addItem, deleteItem, bulkImportConfigs, updateLinks' })
          ],
          spacing: { after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Storage Key: ', bold: true }),
            new TextRun({ text: "localStorage['eam_app_configs']", font: 'Courier New' })
          ],
          spacing: { after: 200 }
        }),

        // Excel Upload Pattern
        new DocxParagraph({
          text: 'Excel Upload Pattern',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        }),
        new DocxParagraph({ text: '1. Download template - blank .xlsx with headers (using SheetJS)', spacing: { after: 100 } }),
        new DocxParagraph({ text: '2. Upload - map columns case-insensitively, merge into state + localStorage', spacing: { after: 100 } }),
        new DocxParagraph({ text: '3. Status and S.No are auto-derived, never included in template', spacing: { after: 100 } }),
        new DocxParagraph({ text: '4. Use xlsx library for parsing and generation', spacing: { after: 200 } }),

        // Database Switching
        new DocxParagraph({
          text: 'Database Switching (PostgreSQL/MySQL)',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Only file to change: ', bold: true }),
            new TextRun({ text: 'server/config/database.js', font: 'Courier New' })
          ],
          spacing: { after: 200 }
        }),
        new DocxParagraph({ text: 'PostgreSQL:', bold: true, spacing: { after: 100 } }),
        new DocxParagraph({ text: '1. npm install pg (in server/ directory)', spacing: { after: 50 } }),
        new DocxParagraph({ text: '2. Set DB_CLIENT=pg', spacing: { after: 50 } }),
        new DocxParagraph({ text: '3. Configure DB_HOST, DB_PORT=5432, DB_NAME, DB_USER, DB_PASSWORD', spacing: { after: 50 } }),
        new DocxParagraph({ text: '4. Optional: DB_SSL=true', spacing: { after: 200 } }),
        new DocxParagraph({ text: 'MySQL / MariaDB:', bold: true, spacing: { after: 100 } }),
        new DocxParagraph({ text: '1. npm install mysql2 (in server/ directory)', spacing: { after: 50 } }),
        new DocxParagraph({ text: '2. Set DB_CLIENT=mysql2', spacing: { after: 50 } }),
        new DocxParagraph({ text: '3. Configure DB_HOST, DB_PORT=3306, DB_NAME, DB_USER, DB_PASSWORD', spacing: { after: 200 } }),
        new DocxParagraph({ text: 'After switching:', bold: true, spacing: { after: 100 } }),
        new DocxParagraph({ text: 'node server/db/migrate.js � create tables in new DB', spacing: { after: 50 } }),
        new DocxParagraph({ text: 'node server/db/seed.js � optional: seed initial data', spacing: { after: 50 } }),
        new DocxParagraph({ text: 'No changes needed in routes, frontend, or any other file', spacing: { after: 50 } }),
        new DocxParagraph({ text: 'Cloud deploy: set env vars in platform settings (Azure/AWS/GCP)', spacing: { after: 400 } }),

        // Section 5: Production
        new DocxParagraph({
          text: 'Production',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        }),

        // Cleanup History
        new DocxParagraph({
          text: 'Cleanup History',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        }),
        new DocxParagraph({ text: 'Files Removed (12 total):', bold: true, spacing: { after: 100 } }),
        new DocxParagraph({ text: '� Empty files: App_new.tsx, ClientM_new.tsx, RequestInsights.tsx', spacing: { after: 50 } }),
        new DocxParagraph({ text: '� Duplicates: ClientRateCard.tsx, ClientTeamHierarchy.tsx, ResourceUtilization.tsx', spacing: { after: 50 } }),
        new DocxParagraph({ text: '� Unused: AccountFinance.tsx, ResourceMgmt.tsx, ClientM.tsx', spacing: { after: 50 } }),
        new DocxParagraph({ text: '� Orphaned: FinanceInsightsChart.tsx, ProjectList.tsx, RAProcess.tsx', spacing: { after: 200 } }),

        // Production Checklist
        new DocxParagraph({
          text: 'Production Checklist',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        }),
        new DocxParagraph({ text: '? No unused files or components', spacing: { after: 100 } }),
        new DocxParagraph({ text: '? All pages documented with JSDoc comments', spacing: { after: 100 } }),
        new DocxParagraph({ text: '? Clear file-to-UI mapping established', spacing: { after: 100 } }),
        new DocxParagraph({ text: '? Build successful with no TypeScript errors', spacing: { after: 100 } }),
        new DocxParagraph({ text: '? All console logs removed from server code', spacing: { after: 100 } }),
        new DocxParagraph({ text: '? Bundle size optimized: 4,306 kB (gzip: 1,320 kB)', spacing: { after: 200 } }),

        // Deployment Notes
        new DocxParagraph({
          text: 'Deployment Notes',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Data Layer: ', bold: true }),
            new TextRun({ text: 'ALL data wired to SQLite backend with graceful offline fallback' })
          ],
          spacing: { after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'API Detection: ', bold: true }),
            new TextRun({ text: 'API clients auto-detect server availability' })
          ],
          spacing: { after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Offline Mode: ', bold: true }),
            new TextRun({ text: 'localStorage used ONLY as fallback when server is offline' })
          ],
          spacing: { after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Authentication: ', bold: true }),
            new TextRun({ text: 'No auth layer currently - add guard in main.tsx around ConfigProvider' })
          ],
          spacing: { after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Optimization: ', bold: true }),
            new TextRun({ text: 'Tree-shake antd via vite.config.ts for bundle optimization' })
          ],
          spacing: { after: 100 }
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: 'Cloud Deploy: ', bold: true }),
            new TextRun({ text: 'Set environment variables in platform settings (Azure/AWS/GCP)' })
          ],
          spacing: { after: 100 }
        })
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'EAM_Code_Guide.docx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    alert('Failed to generate document: ' + error.message);
  }
}

function CodeGuide() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('1');

  // Filtered data based on search
  const filteredFiles = useMemo(() => {
    if (!searchQuery) return FILE_MAPPINGS;
    const query = searchQuery.toLowerCase();
    return FILE_MAPPINGS.filter(item =>
      item.fileName.toLowerCase().includes(query) ||
      item.uiTab.toLowerCase().includes(query) ||
      item.pageId.toLowerCase().includes(query) ||
      item.type.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const filteredAPIs = useMemo(() => {
    if (!searchQuery) return API_ENDPOINTS;
    const query = searchQuery.toLowerCase();
    return API_ENDPOINTS.filter(item =>
      item.dataSource.toLowerCase().includes(query) ||
      item.clientFile.toLowerCase().includes(query) ||
      item.backendRoute.toLowerCase().includes(query) ||
      item.operations.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Global search: Check which tabs have matching content
  const searchMatchesByTab = useMemo(() => {
    if (!searchQuery) return { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0 };
    
    const query = searchQuery.toLowerCase();
    const matches: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0 };
    
    // Tab 1: Overview (check tech stack and quick links)
    const overviewKeywords = [
      'react', 'typescript', 'vite', 'ant design', 'excel', 'xlsx', 'dayjs', 
      'recharts', 'html2canvas', 'jspdf', 'context', 'node', 'express', 'sqlite',
      'pbkdf2', 'logger', 'eslint', 'git', 'backend', 'frontend', 'server', 'migrate', 'seed'
    ];
    matches['1'] = overviewKeywords.filter(kw => kw.includes(query) || query.includes(kw)).length;
    
    // Tab 2: File Structure
    matches['2'] = filteredFiles.length;
    
    // Tab 3: Backend API
    matches['3'] = filteredAPIs.length;
    if (query.includes('api') || query.includes('backend') || query.includes('route') || 
        query.includes('endpoint') || query.includes('server') || query.includes('database')) {
      matches['3'] += 1;
    }
    
    // Tab 4: Development (routing, config, excel, etc.)
    if (query.includes('routing') || query.includes('page') || query.includes('hash') ||
        query.includes('config') || query.includes('context') || query.includes('excel') ||
        query.includes('upload') || query.includes('postgresql') || query.includes('mysql') ||
        query.includes('database') || query.includes('switching')) {
      matches['4'] += 5;
    }
    
    // Tab 5: Production (cleanup, checklist, deployment)
    if (query.includes('production') || query.includes('cleanup') || query.includes('deployment') ||
        query.includes('checklist') || query.includes('build') || query.includes('bundle') ||
        query.includes('removed') || query.includes('files') || query.includes('cloud')) {
      matches['5'] += 5;
    }

    // Tab 6: Database
    matches['6'] = DB_TABLES.filter(t =>
      t.table.includes(query) || t.domain.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) || t.keyColumns.toLowerCase().includes(query)
    ).length;
    if (query.includes('table') || query.includes('db') || query.includes('schema') || query.includes('sqlite')) {
      matches['6'] += 3;
    }

    // Tab 7: Workflows
    matches['7'] = WORKFLOWS.filter(wf =>
      wf.title.toLowerCase().includes(query) ||
      wf.steps.some(s => s.toLowerCase().includes(query))
    ).length;
    if (query.includes('workflow') || query.includes('flow') || query.includes('process') ||
        query.includes('upload') || query.includes('piv') || query.includes('sow') ||
        query.includes('audit') || query.includes('notification')) {
      matches['7'] += 3;
    }
    
    return matches;
  }, [searchQuery, filteredFiles.length, filteredAPIs.length]);

  // Auto-switch to first tab with results
  useEffect(() => {
    if (!searchQuery) return;
    
    const currentTabMatches = searchMatchesByTab[activeTab];
    if (currentTabMatches === 0) {
      // Find first tab with matches
      const firstMatchTab = Object.entries(searchMatchesByTab)
        .find(([_, count]) => count > 0)?.[0];
      
      if (firstMatchTab) {
        setActiveTab(firstMatchTab);
      }
    }
  }, [searchQuery, searchMatchesByTab, activeTab]);

  // Total search results count
  const totalMatches = useMemo(() => {
    return Object.values(searchMatchesByTab).reduce((sum, count) => sum + count, 0);
  }, [searchMatchesByTab]);

  const tabsWithMatches = useMemo(() => {
    return Object.entries(searchMatchesByTab)
      .filter(([_, count]) => count > 0)
      .map(([tab, _]) => tab);
  }, [searchMatchesByTab]);

  // Table columns for File Mappings
  const fileColumns = [
    {
      title: 'File Name',
      dataIndex: 'fileName',
      key: 'fileName',
      sorter: (a: any, b: any) => a.fileName.localeCompare(b.fileName),
      render: (text: string) => <code style={{ fontSize: '11px', color: '#000000', background: '#f5f5f5', padding: '2px 4px', borderRadius: '2px', fontFamily: 'monospace' }}>{text}</code>
    },
    {
      title: 'UI Tab',
      dataIndex: 'uiTab',
      key: 'uiTab',
      filters: Array.from(new Set(FILE_MAPPINGS.map(f => f.uiTab))).map(tab => ({ text: tab, value: tab })),
      onFilter: (value: any, record: any) => record.uiTab === value,
      render: (text: string) => <Text style={{ fontSize: '11px', color: '#000' }}>{text}</Text>
    },
    {
      title: 'Page ID',
      dataIndex: 'pageId',
      key: 'pageId',
      render: (text: string) => <Text type="secondary" style={{ fontSize: '11px', color: '#595959' }}>{text}</Text>
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      filters: [
        { text: 'Page', value: 'Page' },
        { text: 'Child Component', value: 'Child Component' },
        { text: 'Shared Component', value: 'Shared Component' }
      ],
      onFilter: (value: any, record: any) => record.type === value,
      render: (type: string) => {
        const color = type === 'Page' ? 'blue' : type === 'Child Component' ? 'green' : 'purple';
        const icon = type === 'Page' ? <FileTextOutlined /> : type === 'Child Component' ? <NodeIndexOutlined /> : <AppstoreOutlined />;
        return <Tag icon={icon} color={color} style={{ fontSize: '11px' }}>{type}</Tag>;
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Badge status="success" text={<span style={{ fontSize: '11px' }}>{status}</span>} />
    }
  ];

  // Table columns for API Endpoints
  const apiColumns = [
    {
      title: 'Data Source',
      dataIndex: 'dataSource',
      key: 'dataSource',
      render: (text: string) => <Text strong style={{ fontSize: '11px', color: '#000000' }}>{text}</Text>
    },
    {
      title: 'Client File',
      dataIndex: 'clientFile',
      key: 'clientFile',
      render: (text: string) => <code style={{ fontSize: '11px', color: '#000', background: '#f5f5f5', padding: '2px 4px', borderRadius: '2px', fontFamily: 'monospace' }}>{text}</code>
    },
    {
      title: 'Backend Route',
      dataIndex: 'backendRoute',
      key: 'backendRoute',
      render: (text: string) => <Tag icon={<ApiOutlined />} color="cyan" style={{ fontSize: '11px' }}>{text}</Tag>
    },
    {
      title: 'Operations',
      dataIndex: 'operations',
      key: 'operations',
      render: (ops: string) => (
        <Space size="small">
          {ops.split(', ').map(op => (
            <Tag key={op} color={op === 'GET' ? 'green' : op === 'POST' ? 'blue' : op === 'PUT' ? 'orange' : 'red'} style={{ fontSize: '11px' }}>
              {op}
            </Tag>
          ))}
        </Space>
      )
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => <Text type="secondary" style={{ fontSize: '11px', color: '#595959' }}>{text}</Text>
    }
  ];

  // Tab 1: Overview Content
  const overviewContent = (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card title={<><CodeOutlined /> Frontend Stack</>} bordered={false} size="small">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <List
              size="small"
              header={<Text strong style={{ fontSize: '12px' }}>Core Technologies</Text>}
              dataSource={[
                'React 18 + TypeScript',
                'Vite (build tool & dev server)',
                'Ant Design (UI components)',
                'React Context (state management)'
              ]}
              renderItem={(item) => (
                <List.Item style={{ padding: '2px 0', lineHeight: '1.4' }}>
                  <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 4, fontSize: '12px' }} />
                  <span style={{ fontSize: '12px', color: '#000' }}>{item}</span>
                </List.Item>
              )}
            />
          </Col>
          <Col xs={24} md={12}>
            <List
              size="small"
              header={<Text strong style={{ fontSize: '12px' }}>Key Libraries</Text>}
              dataSource={[
                'xlsx / SheetJS (Excel operations)',
                'dayjs (date handling)',
                'Recharts (data visualization)',
                'html2canvas + jsPDF (exports)'
              ]}
              renderItem={(item) => (
                <List.Item style={{ padding: '2px 0', lineHeight: '1.4' }}>
                  <CheckCircleOutlined style={{ color: '#1890ff', marginRight: 4, fontSize: '12px' }} />
                  <span style={{ fontSize: '12px', color: '#000' }}>{item}</span>
                </List.Item>
              )}
            />
          </Col>
        </Row>
      </Card>

      <Card title={<><DatabaseOutlined /> Backend Stack</>} bordered={false} size="small">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <List
              size="small"
              header={<Text strong style={{ fontSize: '12px' }}>Server</Text>}
              dataSource={[
                'Node.js + Express (REST API)',
                'SQLite via better-sqlite3 (embedded)',
                'Native crypto (PBKDF2-SHA256 hashing)',
                'Structured JSON logger (server/utils/logger.js)'
              ]}
              renderItem={(item) => (
                <List.Item style={{ padding: '2px 0', lineHeight: '1.4' }}>
                  <CheckCircleOutlined style={{ color: '#fa8c16', marginRight: 4, fontSize: '12px' }} />
                  <span style={{ fontSize: '12px', color: '#000' }}>{item}</span>
                </List.Item>
              )}
            />
          </Col>
          <Col xs={24} md={12}>
            <List
              size="small"
              header={<Text strong style={{ fontSize: '12px' }}>Development</Text>}
              dataSource={[
                'TypeScript (type safety)',
                'ESLint (code quality)',
                'Git (version control)',
                'Veracode + SonarQube (security scans)'
              ]}
              renderItem={(item) => (
                <List.Item style={{ padding: '2px 0', lineHeight: '1.4' }}>
                  <CheckCircleOutlined style={{ color: '#722ed1', marginRight: 4, fontSize: '12px' }} />
                  <span style={{ fontSize: '12px', color: '#000' }}>{item}</span>
                </List.Item>
              )}
            />
          </Col>
        </Row>
      </Card>

      <Card title={<><LinkOutlined /> Quick Commands</>} bordered={false} size="small">
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Paragraph style={{ margin: '2px 0', fontSize: '12px', color: '#000', lineHeight: '1.4' }}>
            <RocketOutlined style={{ fontSize: '12px', color: '#000' }} /> <Text strong style={{ fontSize: '12px', color: '#000' }}>Start Backend:</Text> <code style={{ fontSize: '11px', color: '#000', background: '#f5f5f5', padding: '2px 4px', borderRadius: '2px', fontFamily: 'monospace' }}>cd server && node index.js</code>
          </Paragraph>
          <Paragraph style={{ margin: '2px 0', fontSize: '12px', color: '#000', lineHeight: '1.4' }}>
            <BuildOutlined style={{ fontSize: '12px', color: '#000' }} /> <Text strong style={{ fontSize: '12px', color: '#000' }}>Start Frontend:</Text> <code style={{ fontSize: '11px', color: '#000', background: '#f5f5f5', padding: '2px 4px', borderRadius: '2px', fontFamily: 'monospace' }}>npm run dev</code>
          </Paragraph>
          <Paragraph style={{ margin: '2px 0', fontSize: '12px', color: '#000', lineHeight: '1.4' }}>
            <DatabaseOutlined style={{ fontSize: '12px', color: '#000' }} /> <Text strong style={{ fontSize: '12px', color: '#000' }}>Run Migrations:</Text> <code style={{ fontSize: '11px', color: '#000', background: '#f5f5f5', padding: '2px 4px', borderRadius: '2px', fontFamily: 'monospace' }}>node server/db/migrate.js</code>
          </Paragraph>
          <Paragraph style={{ margin: '2px 0', fontSize: '12px', color: '#000', lineHeight: '1.4' }}>
            <ThunderboltOutlined style={{ fontSize: '12px', color: '#000' }} /> <Text strong style={{ fontSize: '12px', color: '#000' }}>Seed Data:</Text> <code style={{ fontSize: '11px', color: '#000', background: '#f5f5f5', padding: '2px 4px', borderRadius: '2px', fontFamily: 'monospace' }}>node server/db/seed.js</code>
          </Paragraph>
        </Space>
      </Card>
    </Space>
  );

  // Tab 2: File Structure Content
  const fileStructureContent = (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Table
        columns={fileColumns}
        dataSource={filteredFiles}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Total ${total} files` }}
        size="small"
      />
    </Space>
  );

  // Tab 3: Backend API Content
  const backendAPIContent = (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Table
        columns={apiColumns}
        dataSource={filteredAPIs}
        pagination={{ pageSize: 8, showTotal: (total) => `Total ${total} endpoints` }}
        size="small"
      />
      <Card title={<><SettingOutlined /> Backend Setup</>} bordered={false} size="small">
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label={<span style={{ fontSize: '11px', color: '#000' }}>Entry Point</span>}>
            <span style={{ fontSize: '11px', color: '#000' }}>server/index.js � Express on port 3001</span>
          </Descriptions.Item>
          <Descriptions.Item label={<span style={{ fontSize: '11px', color: '#000' }}>Start Command</span>}>
            <code style={{ fontSize: '11px', color: '#000', background: '#f5f5f5', padding: '2px 4px', borderRadius: '2px', fontFamily: 'monospace' }}>cd server && node index.js</code>
          </Descriptions.Item>
          <Descriptions.Item label={<span style={{ fontSize: '11px', color: '#000' }}>Vite Proxy</span>}>
            <span style={{ fontSize: '11px', color: '#000' }}>vite.config.ts proxies /api/* to http://localhost:3001</span>
          </Descriptions.Item>
          <Descriptions.Item label={<span style={{ fontSize: '11px', color: '#000' }}>Database</span>}>
            <span style={{ fontSize: '11px', color: '#000' }}>SQLite (embedded) - switch to PostgreSQL/MySQL by changing server/config/database.js</span>
          </Descriptions.Item>
          <Descriptions.Item label={<span style={{ fontSize: '11px', color: '#000' }}>Migration</span>}>
            <code style={{ fontSize: '11px', color: '#000', background: '#f5f5f5', padding: '2px 4px', borderRadius: '2px', fontFamily: 'monospace' }}>node server/db/migrate.js</code> <span style={{ fontSize: '11px', color: '#000' }}>� creates all tables</span>
          </Descriptions.Item>
          <Descriptions.Item label={<span style={{ fontSize: '11px', color: '#000' }}>Seeding</span>}>
            <code style={{ fontSize: '11px', color: '#000', background: '#f5f5f5', padding: '2px 4px', borderRadius: '2px', fontFamily: 'monospace' }}>node server/db/seed.js</code> <span style={{ fontSize: '11px', color: '#000' }}>� populates initial data</span>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  );

  // Tab 4: Development Guide Content
  const developmentContent = (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Collapse
        items={[
          {
            key: '1',
            label: <span style={{ fontSize: '12px' }}><FileTextOutlined /> Adding a New Page</span>,
            children: (
              <List
                size="small"
                dataSource={[
                  '1. Create src/pages/YourPage.tsx with named export',
                  '2. Add to EAMPage union type in App.tsx',
                  '3. Map in PAGE_SECTION_MAP object',
                  '4. Add case in renderContent() switch statement',
                  '5. Add SubNavItem or SideNavGroup in sidebar',
                  '6. Import at top of App.tsx'
                ]}
                renderItem={(item) => <List.Item style={{ padding: '2px 0', fontSize: '12px', color: '#000', lineHeight: '1.4' }}>{item}</List.Item>}
              />
            )
          },
          {
            key: '2',
            label: <span style={{ fontSize: '12px' }}><SwapOutlined /> Routing Pattern</span>,
            children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Paragraph style={{ margin: '2px 0', fontSize: '12px', color: '#000', lineHeight: '1.4' }}>
                  <Text strong style={{ fontSize: '12px', color: '#000' }}>Hash-based routing:</Text> The application uses hash-based routing with patterns like <code style={{ fontSize: '11px', color: '#000', background: '#f5f5f5', padding: '2px 4px', borderRadius: '2px', fontFamily: 'monospace' }}>#/home</code> and <code style={{ fontSize: '11px', color: '#000', background: '#f5f5f5', padding: '2px 4px', borderRadius: '2px', fontFamily: 'monospace' }}>#/eam/page_id</code>
                </Paragraph>
                <Paragraph style={{ margin: '2px 0', fontSize: '12px', color: '#000', lineHeight: '1.4' }}>
                  <Text strong style={{ fontSize: '12px', color: '#000' }}>No external router:</Text> Custom implementation in App.tsx - no external router library required
                </Paragraph>
                <Paragraph style={{ margin: '2px 0', fontSize: '12px', color: '#000', lineHeight: '1.4' }}>
                  <Text strong style={{ fontSize: '12px', color: '#000' }}>Route flow:</Text> URL hash ? App.tsx currentPage state ? PAGE_SECTION_MAP ? renderContent() ? Page component
                </Paragraph>
                <Paragraph style={{ margin: '2px 0', fontSize: '12px', color: '#000', lineHeight: '1.4' }}>
                  <Text strong style={{ fontSize: '12px', color: '#000' }}>Navigation:</Text> Use window.location.hash to navigate between pages programmatically
                </Paragraph>
                <List
                  size="small"
                  header={<Text strong style={{ fontSize: '12px', color: '#000' }}>Examples:</Text>}
                  dataSource={[
                    'Dashboard: #/eam/account_summary',
                    'Finance Summary: #/eam/executive_summary',
                    'Resource Hub: #/eam/resources_info',
                    'Client Requests: #/eam/clientmgmt_requests',
                    'Code Guide: #/eam/information_codeguide'
                  ]}
                  renderItem={(item) => <List.Item style={{ padding: '2px 0', lineHeight: '1.4' }}><code style={{ fontSize: '11px', color: '#000', background: '#f5f5f5', padding: '2px 4px', borderRadius: '2px', fontFamily: 'monospace' }}>{item}</code></List.Item>}
                />
              </Space>
            )
          },
          {
            key: '3',
            label: <span style={{ fontSize: '12px' }}><DatabaseOutlined /> ConfigContext</span>,
            children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Paragraph style={{ margin: '4px 0', fontSize: '12px', color: '#000' }}>
                  <Text strong style={{ fontSize: '12px', color: '#000' }}>Purpose:</Text> Global configuration store with localStorage persistence
                </Paragraph>
                <Paragraph style={{ margin: '4px 0', fontSize: '12px', color: '#000' }}>
                  <Text strong style={{ fontSize: '12px', color: '#000' }}>Usage:</Text> <code style={{ fontSize: '11px', color: '#000', background: '#f5f5f5', padding: '2px 4px', borderRadius: '2px', fontFamily: 'monospace' }}>const {'{ config }'} = useConfig()</code>
                </Paragraph>
                <Paragraph style={{ margin: '4px 0', fontSize: '12px', color: '#000' }}>
                  <Text strong style={{ fontSize: '12px', color: '#000' }}>Methods:</Text> addConfigType, addItem, deleteItem, bulkImportConfigs, updateLinks
                </Paragraph>
                <Paragraph style={{ margin: '4px 0', fontSize: '12px', color: '#000' }}>
                  <Text strong style={{ fontSize: '12px', color: '#000' }}>Storage Key:</Text> <code style={{ fontSize: '11px', color: '#000', background: '#f5f5f5', padding: '2px 4px', borderRadius: '2px', fontFamily: 'monospace' }}>localStorage['eam_app_configs']</code>
                </Paragraph>
              </Space>
            )
          },
          {
            key: '4',
            label: <span style={{ fontSize: '12px' }}><FileTextOutlined /> Excel Upload Pattern</span>,
            children: (
              <List
                size="small"
                dataSource={[
                  '1. Download template - blank .xlsx with headers (using SheetJS)',
                  '2. Upload - map columns case-insensitively, merge into state + localStorage',
                  '3. Status and S.No are auto-derived, never included in template',
                  '4. Use xlsx library for parsing and generation'
                ]}
                renderItem={(item) => <List.Item style={{ padding: '2px 0', fontSize: '12px', color: '#000', lineHeight: '1.4' }}>{item}</List.Item>}
              />
            )
          },
          {
            key: '5',
            label: <span style={{ fontSize: '12px' }}><SwapOutlined /> Database Switching (PostgreSQL/MySQL)</span>,
            children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Paragraph style={{ margin: '2px 0', fontSize: '12px', color: '#000', lineHeight: '1.4' }}>
                  <Text strong style={{ fontSize: '12px', color: '#000' }}>Only file to change:</Text> <code style={{ fontSize: '11px', color: '#000', background: '#f5f5f5', padding: '2px 4px', borderRadius: '2px', fontFamily: 'monospace' }}>server/config/database.js</code>
                </Paragraph>
                <Divider style={{ margin: '8px 0' }} />
                <Paragraph style={{ margin: '2px 0', fontSize: '12px', color: '#000', lineHeight: '1.4' }}>
                  <Text strong style={{ fontSize: '12px', color: '#000' }}>PostgreSQL:</Text>
                </Paragraph>
                <List
                  size="small"
                  dataSource={[
                    '1. npm install pg (in server/ directory)',
                    '2. Set DB_CLIENT=pg',
                    '3. Configure DB_HOST, DB_PORT=5432, DB_NAME, DB_USER, DB_PASSWORD',
                    '4. Optional: DB_SSL=true'
                  ]}
                  renderItem={(item) => <List.Item style={{ padding: '2px 0', fontSize: '12px', color: '#000', lineHeight: '1.4' }}>{item}</List.Item>}
                />
                <Divider style={{ margin: '8px 0' }} />
                <Paragraph style={{ margin: '2px 0', fontSize: '12px', color: '#000', lineHeight: '1.4' }}>
                  <Text strong style={{ fontSize: '12px', color: '#000' }}>MySQL / MariaDB:</Text>
                </Paragraph>
                <List
                  size="small"
                  dataSource={[
                    '1. npm install mysql2 (in server/ directory)',
                    '2. Set DB_CLIENT=mysql2',
                    '3. Configure DB_HOST, DB_PORT=3306, DB_NAME, DB_USER, DB_PASSWORD'
                  ]}
                  renderItem={(item) => <List.Item style={{ padding: '2px 0', fontSize: '12px', color: '#000', lineHeight: '1.4' }}>{item}</List.Item>}
                />
                <Divider style={{ margin: '8px 0' }} />
                <Paragraph style={{ margin: '2px 0', fontSize: '12px', color: '#000', lineHeight: '1.4' }}>
                  <Text strong style={{ fontSize: '12px', color: '#000' }}>After switching:</Text>
                </Paragraph>
                <List
                  size="small"
                  dataSource={[
                    'node server/db/migrate.js � create tables in new DB',
                    'node server/db/seed.js � optional: seed initial data',
                    'No changes needed in routes, frontend, or any other file',
                    'Cloud deploy: set env vars in platform settings (Azure/AWS/GCP)'
                  ]}
                  renderItem={(item) => <List.Item style={{ padding: '2px 0', fontSize: '12px', color: '#000', lineHeight: '1.4' }}>{item}</List.Item>}
                />
              </Space>
            )
          }
        ]}
        defaultActiveKey={['1']}
        size="small"
      />
    </Space>
  );

  // Tab 5: Production Content
  const productionContent = (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card title={<span style={{ fontSize: '14px' }}><SafetyOutlined /> Production Checklist</span>} bordered={false} size="small">
        <List
          dataSource={[
            { icon: <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '12px' }} />, text: 'No unused files or components' },
            { icon: <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '12px' }} />, text: 'All pages documented with JSDoc comments' },
            { icon: <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '12px' }} />, text: 'Clear file-to-UI mapping established' },
            { icon: <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '12px' }} />, text: 'Build successful with no TypeScript errors' },
            { icon: <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '12px' }} />, text: 'All console logs removed from server code' },
            { icon: <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '12px' }} />, text: 'Bundle size optimized: 4,306 kB (gzip: 1,320 kB)' }
          ]}
          renderItem={(item) => (
            <List.Item style={{ padding: '2px 0', lineHeight: '1.4' }}>
              {item.icon} <Text style={{ marginLeft: 4, fontSize: '12px', color: '#000' }}>{item.text}</Text>
            </List.Item>
          )}
        />
      </Card>
      <Card title={<span style={{ fontSize: '14px' }}><HistoryOutlined /> Cleanup Timeline</span>} bordered={false} size="small">
        <Timeline
          items={[
            {
              color: 'red',
              children: (
                <>
                  <Text strong style={{ fontSize: '12px', color: '#000' }}>Files Removed (12 total)</Text>
                  <List
                    size="small"
                    style={{ marginTop: 4 }}
                    dataSource={[
                      'Empty files: App_new.tsx, ClientM_new.tsx, RequestInsights.tsx',
                      'Duplicates: ClientRateCard.tsx, ClientTeamHierarchy.tsx, ResourceUtilization.tsx',
                      'Unused: AccountFinance.tsx, ResourceMgmt.tsx, ClientM.tsx',
                      'Orphaned: FinanceInsightsChart.tsx, ProjectList.tsx, RAProcess.tsx'
                    ]}
                    renderItem={(item) => <List.Item style={{ padding: '2px 0', fontSize: '12px', color: '#000', lineHeight: '1.4' }}>{item}</List.Item>}
                  />
                </>
              )
            },
            {
              color: 'blue',
              children: (
                <>
                  <Text strong style={{ fontSize: '12px', color: '#000' }}>Documentation Added</Text>
                  <Paragraph style={{ marginTop: 4, fontSize: '12px', color: '#000', lineHeight: '1.4' }}>
                    Added JSDoc comments to all 21 active page/component files with UI location and Page ID
                  </Paragraph>
                </>
              )
            },
            {
              color: 'green',
              children: (
                <>
                  <Text strong style={{ fontSize: '12px', color: '#000' }}>Code Cleanup</Text>
                  <List
                    size="small"
                    style={{ marginTop: 4 }}
                    dataSource={[
                      'Updated EngagementMapping.tsx import (ResourceMgmt ? ResourceHub)',
                      'Removed ~1,500+ lines of dead code',
                      'All builds verified successful after each deletion'
                    ]}
                    renderItem={(item) => <List.Item style={{ padding: '2px 0', fontSize: '12px', color: '#000', lineHeight: '1.4' }}>{item}</List.Item>}
                  />
                </>
              )
            },
            {
              color: 'green',
              dot: <CheckCircleOutlined />,
              children: (
                <>
                  <Text strong style={{ fontSize: '12px', color: '#000' }}>Production Ready</Text>
                  <Paragraph style={{ marginTop: 4, fontSize: '12px', color: '#000', lineHeight: '1.4' }}>
                    Bundle size unchanged: 4,306 kB (gzip: 1,320 kB). Application ready for deployment.
                  </Paragraph>
                </>
              )
            }
          ]}
        />
      </Card>
      <Card title={<span style={{ fontSize: '14px' }}><DeploymentUnitOutlined /> Deployment Notes</span>} bordered={false} size="small">
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label={<span style={{ fontSize: '11px', color: '#000' }}>Data Layer</span>}>
            <span style={{ fontSize: '11px', color: '#000' }}>ALL data wired to SQLite backend with graceful offline fallback</span>
          </Descriptions.Item>
          <Descriptions.Item label={<span style={{ fontSize: '11px', color: '#000' }}>API Detection</span>}>
            <span style={{ fontSize: '11px', color: '#000' }}>API clients auto-detect server availability</span>
          </Descriptions.Item>
          <Descriptions.Item label={<span style={{ fontSize: '11px', color: '#000' }}>Offline Mode</span>}>
            <span style={{ fontSize: '11px', color: '#000' }}>localStorage used ONLY as fallback when server is offline</span>
          </Descriptions.Item>
          <Descriptions.Item label={<span style={{ fontSize: '11px', color: '#000' }}>Authentication</span>}>
            <span style={{ fontSize: '11px', color: '#000' }}>Login via JWT-style session token stored in localStorage; roles control page-level access via UserAccessControl</span>
          </Descriptions.Item>
          <Descriptions.Item label={<span style={{ fontSize: '11px', color: '#000' }}>Optimization</span>}>
            <span style={{ fontSize: '11px', color: '#000' }}>Tree-shake antd via vite.config.ts for bundle optimization</span>
          </Descriptions.Item>
          <Descriptions.Item label={<span style={{ fontSize: '11px', color: '#000' }}>Cloud Deploy</span>}>
            <span style={{ fontSize: '11px', color: '#000' }}>Set environment variables in platform settings (Azure/AWS/GCP)</span>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  );

  // Tab 6: Database Design Content
  const databaseContent = (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        message="22 tables — all defined in server/db/migrate.js and documented in docs/DATABASE_DESIGN.md"
        type="info"
        showIcon
        style={{ fontSize: '11px', padding: '4px 12px' }}
      />
      <Table
        columns={[
          { title: 'Table', dataIndex: 'table', key: 'table', render: (t: string) => <code style={{ fontSize: '11px', background: '#f5f5f5', padding: '2px 4px', borderRadius: '2px', fontFamily: 'monospace' }}>{t}</code> },
          { title: 'Domain', dataIndex: 'domain', key: 'domain', filters: Array.from(new Set(DB_TABLES.map(d => d.domain))).map(v => ({ text: v, value: v })), onFilter: (val: any, rec: any) => rec.domain === val, render: (t: string) => <Tag color="blue" style={{ fontSize: '11px' }}>{t}</Tag> },
          { title: 'Purpose', dataIndex: 'description', key: 'description', render: (t: string) => <Text style={{ fontSize: '11px', color: '#000' }}>{t}</Text> },
          { title: 'Key Columns', dataIndex: 'keyColumns', key: 'keyColumns', render: (t: string) => <Text type="secondary" style={{ fontSize: '11px' }}>{t}</Text> },
        ]}
        dataSource={DB_TABLES}
        pagination={{ pageSize: 12, showTotal: (total) => `Total ${total} tables` }}
        size="small"
      />
    </Space>
  );

  // Tab 7: Workflow Content
  const workflowContent = (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        message="Key end-to-end workflows — full diagrams in docs/WORKFLOW.md"
        type="info"
        showIcon
        style={{ fontSize: '11px', padding: '4px 12px' }}
      />
      <Collapse
        size="small"
        items={WORKFLOWS.map(wf => ({
          key: wf.key,
          label: <span style={{ fontSize: '12px' }}><SwapOutlined style={{ marginRight: 6 }} />{wf.title}</span>,
          children: (
            <List
              size="small"
              dataSource={wf.steps}
              renderItem={(step, i) => (
                <List.Item style={{ padding: '2px 0', lineHeight: '1.5' }}>
                  <Text style={{ fontSize: '12px', color: '#000' }}>
                    <Text type="secondary" style={{ fontSize: '11px', marginRight: 8 }}>{i + 1}.</Text>
                    {step}
                  </Text>
                </List.Item>
              )}
            />
          )
        }))}
        defaultActiveKey={['1']}
      />
    </Space>
  );

  return (
    <div style={{ padding: '16px' }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* Global Search */}
        <Card size="small" style={{ padding: '4px 8px' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search files, APIs, routes, descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="middle"
              allowClear
              style={{ fontSize: '12px' }}
            />
            {searchQuery && totalMatches > 0 && (
              <Alert
                message={`Found ${totalMatches} results across ${tabsWithMatches.length} tab${tabsWithMatches.length > 1 ? 's' : ''}`}
                type="info"
                showIcon
                style={{ fontSize: '11px', padding: '4px 12px' }}
              />
            )}
            {searchQuery && totalMatches === 0 && (
              <Alert
                message="No results found"
                type="warning"
                showIcon
                style={{ fontSize: '11px', padding: '4px 12px' }}
              />
            )}
          </Space>
        </Card>

        {/* Tabbed Content */}
        <Card size="small">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            size="small"
            tabBarExtraContent={
              <Link onClick={() => downloadGuide()} style={{ fontSize: '12px' }}>
                <DownloadOutlined /> Download Guide
              </Link>
            }
            items={[
              {
                key: '1',
                label: (
                  <span style={{ fontSize: '12px' }}>
                    <BulbOutlined />
                    Overview
                    {searchQuery && searchMatchesByTab['1'] > 0 && (
                      <Badge 
                        count={searchMatchesByTab['1']} 
                        style={{ marginLeft: 8, fontSize: '10px' }} 
                      />
                    )}
                  </span>
                ),
                children: overviewContent
              },
              {
                key: '2',
                label: (
                  <span style={{ fontSize: '12px' }}>
                    <FolderOutlined />
                    File Structure
                    {searchQuery && searchMatchesByTab['2'] > 0 && (
                      <Badge 
                        count={searchMatchesByTab['2']} 
                        style={{ marginLeft: 8, fontSize: '10px' }} 
                      />
                    )}
                  </span>
                ),
                children: fileStructureContent
              },
              {
                key: '3',
                label: (
                  <span style={{ fontSize: '12px' }}>
                    <ApiOutlined />
                    Backend API
                    {searchQuery && searchMatchesByTab['3'] > 0 && (
                      <Badge 
                        count={searchMatchesByTab['3']} 
                        style={{ marginLeft: 8, fontSize: '10px' }} 
                      />
                    )}
                  </span>
                ),
                children: backendAPIContent
              },
              {
                key: '4',
                label: (
                  <span style={{ fontSize: '12px' }}>
                    <BuildOutlined />
                    Development
                    {searchQuery && searchMatchesByTab['4'] > 0 && (
                      <Badge 
                        count={searchMatchesByTab['4']} 
                        style={{ marginLeft: 8, fontSize: '10px' }} 
                      />
                    )}
                  </span>
                ),
                children: developmentContent
              },
              {
                key: '5',
                label: (
                  <span style={{ fontSize: '12px' }}>
                    <RocketOutlined />
                    Production
                    {searchQuery && searchMatchesByTab['5'] > 0 && (
                      <Badge 
                        count={searchMatchesByTab['5']} 
                        style={{ marginLeft: 8, fontSize: '10px' }} 
                      />
                    )}
                  </span>
                ),
                children: productionContent
              },
              {
                key: '6',
                label: (
                  <span style={{ fontSize: '12px' }}>
                    <DatabaseOutlined />
                    Database
                    {searchQuery && searchMatchesByTab['6'] > 0 && (
                      <Badge 
                        count={searchMatchesByTab['6']} 
                        style={{ marginLeft: 8, fontSize: '10px' }} 
                      />
                    )}
                  </span>
                ),
                children: databaseContent
              },
              {
                key: '7',
                label: (
                  <span style={{ fontSize: '12px' }}>
                    <SwapOutlined />
                    Workflows
                    {searchQuery && searchMatchesByTab['7'] > 0 && (
                      <Badge 
                        count={searchMatchesByTab['7']} 
                        style={{ marginLeft: 8, fontSize: '10px' }} 
                      />
                    )}
                  </span>
                ),
                children: workflowContent
              }
            ]}
          />
        </Card>
      </Space>
    </div>
  );
}

export { CodeGuide };

