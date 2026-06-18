import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as configApi from '../api/configApi';

// ── App Values (key:value store) ─────────────────────────────────────

export interface AppValue {
  key: string;
  value: string;
  description?: string;
}

const VALUES_STORAGE_KEY = 'eam_app_values';

const DEFAULT_APP_VALUES: AppValue[] = [
  {
    key: 'SOW_STORAGE_URL',
    value: 'https://rockwellautomation-my.sharepoint.com/:f:/r/personal/anjana_sharma_rockwellautomation_com/Documents/Anjana%20Sharma%20-%20All%20Important%20Documents/1.%20My%20work/RA%20Work/New%20folder?csf=1&web=1&e=Mchxcf',
    description: 'SharePoint folder URL where SOW documents are stored',
  },
  {
    key: 'PIW_STORAGE_URL',
    value: '',
    description: 'SharePoint folder URL where PIW documents are stored',
  },
  {
    key: 'RESUME_STORAGE_URL',
    value: '',
    description: 'SharePoint folder URL where employee resumes are stored',
  },
  {
    key: 'RESOURCE_TYPES',
    value: 'Developer,QA,BA,PM,Architect,DevOps,Data Engineer',
    description: 'Comma-separated list of resource types available for PIW generation',
  },
  {
    key: 'ENGAGEMENT_NAMES',
    value: '',
    description: 'Comma-separated list of project/engagement names for PIW generation (e.g., Next Gen Operations Support 2026,UCB Resource Allocation Q1 2026)',
  },
  {
    key: 'UTIL_LOW_THRESHOLD',
    value: '70',
    description: 'Resource utilisation % below which bench/utilisation stats are highlighted red (default: 70)',
  },
  {
    key: 'OPEN_REQUESTS_ALERT_PCT',
    value: '50',
    description: 'Open client requests % above which the open count is highlighted red (default: 50)',
  },
];

function loadValuesFromStorage(): AppValue[] {
  try {
    const raw = localStorage.getItem(VALUES_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppValue[];
  } catch { /* ignore */ }
  return DEFAULT_APP_VALUES;
}

function saveValuesToStorage(values: AppValue[]) {
  try { localStorage.setItem(VALUES_STORAGE_KEY, JSON.stringify(values)); } catch { /* ignore */ }
}

// ── Config types ──────────────────────────────────────────────────────

export interface ConfigItem {
  value: string;
  label: string;
  color?: string;
}

export interface ConfigType {
  id: string;
  name: string;
  description: string;
  items: ConfigItem[];
  builtIn?: boolean;
  linkedTo?: string[]; // array of LINK_TARGET ids
}

// All available link targets across the app
export interface LinkTarget {
  id: string;
  label: string;
  module: string;     // Sub-page label (e.g., "SOW Details")
  section: string;    // Top-level section (e.g., "Finance Management")
  description?: string;
}

export const AVAILABLE_LINK_TARGETS: LinkTarget[] = [
  // ── Finance Management → SOW Details ──────────────────────────────
  { id: 'finance_company_field',  label: 'Company dropdown',                section: 'Finance Management', module: 'SOW Details',          description: 'Inline edit + Add/Edit modal' },
  { id: 'finance_space_field',    label: 'Space dropdown',                  section: 'Finance Management', module: 'SOW Details',          description: 'Inline edit + Add/Edit modal' },
  { id: 'finance_owner_field',    label: 'Owner / Account Anchor dropdown', section: 'Finance Management', module: 'SOW Details',          description: 'Inline edit + Add/Edit modal' },
  // ── Finance Management → Invoice Details ──────────────────────────
  { id: 'invoice_company_field',  label: 'Company dropdown',                section: 'Finance Management', module: 'Invoice Details',      description: 'Inline edit + Add/Edit modal' },
  // ── Resources → Resource Information ──────────────────────────────
  { id: 'resource_piwrole_field',       label: 'PIW Role dropdown',         section: 'Resources',          module: 'Resource Information', description: 'Edit modal + filter' },
  { id: 'resource_roledomain_field',    label: 'Role / Domain dropdown',    section: 'Resources',          module: 'Resource Information', description: 'Edit modal + filter' },
  { id: 'engagement_field',             label: 'Current Engagement dropdown', section: 'Resources',        module: 'Resource Information', description: 'Inline edit + edit modal + Engagement Mapping' },
  { id: 'allocation_status_field',      label: 'Allocation Status dropdown', section: 'Resources',         module: 'Resource Information', description: 'Inline edit + edit modal' },
  // ── Request Management ─────────────────────────────────────────────
  { id: 'request_type_field',           label: 'Request Type dropdown',     section: 'Request Management', module: 'Request Management',   description: 'Type tabs + edit modal + filters' },
  { id: 'request_processing_status_field', label: 'Processing Status dropdown', section: 'Request Management', module: 'Request Management', description: 'Inline edit + filters' },
  { id: 'request_overall_status_field', label: 'Overall Status dropdown',   section: 'Request Management', module: 'Request Management',   description: 'Inline edit + filters' },
  // ── Internal Process ───────────────────────────────────────────────
  { id: 'ra_process_account_anchor_field', label: 'Account Anchor dropdown', section: 'Internal Process', module: 'Internal Process',     description: 'Inline allocation edit' },
  { id: 'piw_engagement_field',            label: 'PIW — Project / Engagement Name dropdown', section: 'Internal Process', module: 'PIW Generation', description: 'Project/Engagement name dropdown in PIW generation form' },
  // ── Resources → Comment Tags ───────────────────────────────────────
  { id: 'resource_comment_tag_field',   label: 'Comment Tag dropdown',      section: 'Resources',          module: 'Resource Information & Engagement Mapping', description: 'Tag picker when adding comments in resource detail view' },
];

const DEFAULT_CONFIGS: ConfigType[] = [];

const STORAGE_KEY = 'eam_app_configs';

function loadFromStorage(): ConfigType[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as ConfigType[];
    }
  } catch { /* ignore */ }
  return DEFAULT_CONFIGS;
}

function saveToStorage(configs: ConfigType[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(configs)); } catch { /* ignore */ }
}

interface ConfigContextValue {
  configs: ConfigType[];
  getConfig: (id: string) => ConfigType | undefined;
  /** Find the config type linked to a given link-target ID (e.g. 'engagement_field') */
  getConfigByLink: (linkTargetId: string) => ConfigType | undefined;
  addConfigType: (name: string, description: string) => void;
  renameConfigType: (id: string, newName: string) => void;
  deleteConfigType: (id: string) => void;
  /** Bulk import: each entry has a type name + values array; single state update */
  bulkImportConfigs: (entries: Array<{ name: string; values: string[] }>) => { created: number; added: number };
  addItem: (configId: string, label: string, color?: string) => void;
  removeItem: (configId: string, itemValue: string) => void;
  editItem: (configId: string, itemValue: string, newLabel: string, newColor?: string) => void;
  reorderItems: (configId: string, items: ConfigItem[]) => void;
  updateLinks: (configId: string, linkedTo: string[]) => void;
  clearAllConfigs: () => void;
  // App Values (key:value)
  appValues: AppValue[];
  getAppValue: (key: string) => string | undefined;
  setAppValue: (key: string, value: string, description?: string) => void;
  addAppValue: (key: string, value: string, description?: string) => void;
  removeAppValue: (key: string) => void;
  clearAllValues: () => void;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [configs, setConfigs] = useState<ConfigType[]>(() => loadFromStorage());
  const [appValues, setAppValues] = useState<AppValue[]>(() => loadValuesFromStorage());

  // ── Load from DB on mount ───────────────────────────────────────────
  useEffect(() => {
    configApi.getConfigTypes().then(({ configTypes, fromServer }) => {
      if (fromServer && configTypes.length > 0) {
        const mapped: ConfigType[] = configTypes.map((t: any) => ({
          id: t.typeId,
          name: t.name,
          description: t.description || '',
          builtIn: !!t.builtIn,
          linkedTo: t.linkedTo || [],
          items: (t.items || []).map((i: any) => ({
            value: i.itemValue,
            label: i.label,
            color: i.color || 'default',
          })),
        }));
        setConfigs(mapped);
        saveToStorage(mapped);
      }
    }).catch(() => { /* ignore, use localStorage fallback */ });

    configApi.getValues().then(({ values, fromServer }) => {
      if (fromServer && values.length > 0) {
        const mapped: AppValue[] = values.map((v: any) => ({
          key: v.key,
          value: v.value || '',
          description: v.description || '',
        }));
        setAppValues(mapped);
        saveValuesToStorage(mapped);
      }
    }).catch(() => { /* ignore */ });
  }, []);

  const persist = useCallback((next: ConfigType[]) => {
    setConfigs(next);
    saveToStorage(next);
  }, []);

  const getConfig = useCallback((id: string) => configs.find(c => c.id === id), [configs]);
  const getConfigByLink = useCallback((linkTargetId: string) => configs.find(c => c.linkedTo?.includes(linkTargetId)), [configs]);

  const addConfigType = useCallback((name: string, description: string) => {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now();
    const next = [...configs, { id, name, description, items: [], builtIn: false, linkedTo: [] }];
    persist(next);
    configApi.createType({ typeId: id, name, description, builtIn: false, linkedTo: [] });
  }, [configs, persist]);

  const renameConfigType = useCallback((id: string, newName: string) => {
    persist(configs.map(c => c.id === id ? { ...c, name: newName } : c));
    configApi.updateType(id, { name: newName });
  }, [configs, persist]);

  const deleteConfigType = useCallback((id: string) => {
    persist(configs.filter(c => c.id !== id));
    configApi.deleteType(id);
  }, [configs, persist]);

  const bulkImportConfigs = useCallback((entries: Array<{ name: string; values: string[] }>) => {
    let created = 0;
    let added = 0;
    const next = configs.map(c => ({ ...c, items: [...c.items] }));

    entries.forEach(({ name, values }) => {
      const nameLower = name.toLowerCase();
      let target = next.find(c => c.name.toLowerCase() === nameLower);
      if (!target) {
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        target = { id, name, description: '', items: [], builtIn: false, linkedTo: [] };
        next.push(target);
        created++;
      }
      values.forEach(val => {
        const valTrim = val.trim();
        if (valTrim && !target!.items.some(i => i.label.toLowerCase() === valTrim.toLowerCase())) {
          target!.items.push({ value: valTrim, label: valTrim, color: 'default' }); // use exact label as value
          added++;
        }
      });
    });

    persist(next);
    configApi.bulkImport(entries);
    return { created, added };
  }, [configs, persist]);

  const addItem = useCallback((configId: string, label: string, color?: string) => {
    const value = label.trim(); // use exact label as value — no transformation or random suffix
    persist(configs.map(c =>
      c.id === configId ? { ...c, items: [...c.items, { value, label, color: color || 'default' }] } : c
    ));
    configApi.addItem(configId, { itemValue: value, label, color: color || 'default' });
  }, [configs, persist]);

  const removeItem = useCallback((configId: string, itemValue: string) => {
    persist(configs.map(c =>
      c.id === configId ? { ...c, items: c.items.filter(i => i.value !== itemValue) } : c
    ));
    configApi.deleteItem(configId, itemValue);
  }, [configs, persist]);

  const editItem = useCallback((configId: string, itemValue: string, newLabel: string, newColor?: string) => {
    persist(configs.map(c =>
      c.id === configId
        ? { ...c, items: c.items.map(i => i.value === itemValue ? { ...i, label: newLabel, color: newColor || i.color } : i) }
        : c
    ));
    configApi.updateItem(configId, itemValue, { label: newLabel, color: newColor });
  }, [configs, persist]);

  const reorderItems = useCallback((configId: string, items: ConfigItem[]) => {
    persist(configs.map(c => c.id === configId ? { ...c, items } : c));
    configApi.reorderItems(configId, items.map((it, idx) => ({ itemValue: it.value, label: it.label, color: it.color || 'default', sortOrder: idx })));
  }, [configs, persist]);

  const updateLinks = useCallback((configId: string, linkedTo: string[]) => {
    persist(configs.map(c => c.id === configId ? { ...c, linkedTo } : c));
    configApi.updateType(configId, { linkedTo });
  }, [configs, persist]);

  const clearAllConfigs = useCallback(() => {
    persist([]);
    configApi.deleteAllTypes();
  }, [persist]);

  // ── App Values ──────────────────────────────────────────────────────
  const persistValues = useCallback((next: AppValue[]) => {
    setAppValues(next);
    saveValuesToStorage(next);
  }, []);

  const getAppValue = useCallback((key: string) => {
    return appValues.find(v => v.key === key)?.value;
  }, [appValues]);

  const setAppValue = useCallback((key: string, value: string, description?: string) => {
    persistValues(appValues.map(v => v.key === key ? { ...v, value, ...(description !== undefined ? { description } : {}) } : v));
    configApi.upsertValue(key, value, description);
  }, [appValues, persistValues]);

  const addAppValue = useCallback((key: string, value: string, description?: string) => {
    if (appValues.some(v => v.key === key)) {
      setAppValue(key, value, description);
      return;
    }
    persistValues([...appValues, { key, value, description: description ?? '' }]);
    configApi.upsertValue(key, value, description);
  }, [appValues, persistValues, setAppValue]);

  const removeAppValue = useCallback((key: string) => {
    persistValues(appValues.filter(v => v.key !== key));
    configApi.deleteValue(key);
  }, [appValues, persistValues]);

  const clearAllValues = useCallback(() => {
    persistValues([]);
    configApi.deleteAllValues();
  }, [persistValues]);

  return (
    <ConfigContext.Provider value={{
      configs, getConfig, getConfigByLink, addConfigType, renameConfigType, deleteConfigType, bulkImportConfigs,
      addItem, removeItem, editItem, reorderItems, updateLinks, clearAllConfigs,
      appValues, getAppValue, setAppValue, addAppValue, removeAppValue, clearAllValues,
    }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used inside ConfigProvider');
  return ctx;
}

