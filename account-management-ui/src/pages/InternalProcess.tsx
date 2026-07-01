/**
 * InternalProcess.tsx
 * 
 * Internal Process — Track internal SOW documents, pipeline management,
 * and process insights with status tracking and attachments
 * UI Location: Client Management > Internal Process
 * Page ID: clientmgmt_connects
 */
import React, { useEffect, useState } from 'react';
import { Tabs } from 'antd';
import { BarChartOutlined, ExpandAltOutlined, FileWordOutlined, IdcardOutlined, NodeIndexOutlined, TableOutlined } from '@ant-design/icons';
import * as processApi from '../api/processApi';
import ProcessInsightsPanel from './internal-process/ProcessInsightsPanel';
import ProcessDetailViewPanel from './internal-process/ProcessDetailViewPanel';
import { mapProcessApiRow } from './internal-process/processRowMappers';
import { PiwTabContent } from './internal-process/PiwTabContent';
import { ProcessTabPanel } from './internal-process/ProcessTabPanel';
import { SowTabContent } from './internal-process/SowTabContent';
import type { ResourceRow } from '../types/resource';
import { useConfig } from '../context/ConfigContext';
import { useAppSelector } from '../store/hooks';
import type { ProcessRow } from './internal-process/types';

export function InternalProcess({ resources: propResources = [], initialSow }: { resources?: ResourceRow[]; initialSow?: string }) {
  const { getAppValue } = useConfig();
  const reduxResources = useAppSelector((state) => state.resources.items);
  const resources = propResources.length > 0 ? propResources : reduxResources;
  const [processRows, setProcessRows] = useState<ProcessRow[]>([]);
  const [fromServer, setFromServer] = useState(false);
  const [resourceRefreshKey, setResourceRefreshKey] = useState(0);
  const [outerTab, setOuterTab] = useState('process');
  const [innerTab, setInnerTab] = useState('overview');
  const [insightsFilters, setInsightsFilters] = useState<Record<string, string>>({});
  const [processFilterResetSignal, setProcessFilterResetSignal] = useState(0);

  useEffect(() => {
    processApi.getProcessRows().then(({ rows, fromServer: fs }) => {
      if (fs && rows.length > 0) {
        setProcessRows(rows.map(mapProcessApiRow));
        setFromServer(true);
      }
    });
  }, []);

  const handleRowCreatedFromUpload = (row: ProcessRow) => {
    const nowIso = new Date().toISOString();
    setProcessRows(prev => [...prev, {
      ...row,
      createdAt: row.createdAt || nowIso,
      updatedAt: row.updatedAt || nowIso,
    }]);
  };

  const handleUpdateProcessRow = (key: string, updates: Partial<ProcessRow>) => {
    setProcessRows(prev => prev.map(row => row.key === key ? { ...row, ...updates } : row));
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1360, margin: '0 auto' }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: '0 20px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Tabs
          activeKey={outerTab}
          onChange={setOuterTab}
          tabBarStyle={{ marginBottom: 16, paddingTop: 4 }}
          items={[
            {
              key: 'process',
              label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 5 }}><NodeIndexOutlined /> Process</span>,
              children: (
                <Tabs
                  activeKey={innerTab}
                  onChange={(nextKey) => {
                    setInnerTab(nextKey);
                    if (nextKey === 'insights') {
                      setInsightsFilters({});
                      setProcessFilterResetSignal(prev => prev + 1);
                    }
                  }}
                  size="small"
                  tabBarStyle={{ marginBottom: 14 }}
                  items={[
                    {
                      key: 'overview',
                      label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}><TableOutlined /> Overview</span>,
                      children: <ProcessTabPanel rows={processRows} setRows={setProcessRows} fromServer={fromServer} setFromServer={setFromServer} resourceRefreshKey={resourceRefreshKey} initialSow={initialSow} initialFilters={insightsFilters} resetFiltersSignal={processFilterResetSignal} />,
                    },
                    {
                      key: 'detailview',
                      label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}><ExpandAltOutlined /> Detailed View</span>,
                      children: <ProcessDetailViewPanel rows={processRows} initialSow={initialSow} />,
                    },
                    {
                      key: 'insights',
                      label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}><BarChartOutlined /> Insights</span>,
                      children: <ProcessInsightsPanel rows={processRows} onNavigate={(filters) => {
                        const normalized = Object.fromEntries(
                          Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && String(value) !== '')
                        ) as Record<string, string>;
                        setInsightsFilters(normalized);
                        setOuterTab('process');
                        setInnerTab('overview');
                      }} />,
                    },
                  ]}
                />
              ),
            },
            {
              key: 'sow',
              label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 5 }}><FileWordOutlined /> SOW</span>,
              children: <SowTabContent resources={resources} processRows={processRows} onRowCreated={handleRowCreatedFromUpload} spUrl={getAppValue('SOW_STORAGE_URL') || ''} />,
            },
            {
              key: 'piw',
              label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 5 }}><IdcardOutlined /> PIW</span>,
              children: <PiwTabContent resources={resources} processRows={processRows} onUpdateProcessRow={handleUpdateProcessRow} onResourcesLinked={() => setResourceRefreshKey(key => key + 1)} />,
            },
          ]}
        />
      </div>
    </div>
  );
}
