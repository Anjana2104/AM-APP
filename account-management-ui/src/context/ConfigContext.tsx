import React, { createContext, useContext, useState, useCallback } from 'react';

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
  module: string;
}

export const AVAILABLE_LINK_TARGETS: LinkTarget[] = [
  { id: 'request_processing_status_field', label: 'Processing Status dropdown', module: 'Request Management' },
  { id: 'request_overall_status_field', label: 'Overall Status dropdown', module: 'Request Management' },
  { id: 'ra_process_account_anchor_field', label: 'Account Anchor allocation', module: 'RA Process' },
  { id: 'resource_skill_field', label: 'Resource Skill dropdown', module: 'Resource Details' },
  { id: 'resource_designation_field', label: 'Resource Designation dropdown', module: 'Resource Details' },
  { id: 'request_type_field', label: 'Request Type dropdown', module: 'Request Management' },
];

const DEFAULT_CONFIGS: ConfigType[] = [
  {
    id: 'request_processing_status',
    name: 'Request Processing Status',
    description: 'Status values used in the Request Management processing pipeline.',
    builtIn: true,
    linkedTo: ['request_processing_status_field'],
    items: [
      { value: 'accepted_staffing', label: 'Accepted by Staffing Team', color: 'blue' },
      { value: 'resource_shortlisted', label: 'Resource Shortlisted', color: 'cyan' },
      { value: 'uploaded_profile_beeline', label: 'Uploaded Profile on Beeline', color: 'geekblue' },
      { value: 'resource_assessment_scheduled', label: 'Resource Assessment Scheduled', color: 'purple' },
      { value: 'resource_assessment_completed', label: 'Resource Assessment Completed', color: 'gold' },
      { value: 'resource_selected', label: 'Resource Selected', color: 'green' },
      { value: 'resource_rejected', label: 'Resource Rejected', color: 'red' },
      { value: 'zs_onboarding_initiated', label: 'ZS Onboarding Initiated', color: 'lime' },
      { value: 'onboarded_in_zs', label: 'Onboarded in ZS', color: 'success' },
      { value: 'zs_offboarding_initiated', label: 'ZS Offboarding Initiated', color: 'orange' },
      { value: 'resource_offboarded', label: 'Resource Offboarded', color: 'default' },
    ],
  },
  {
    id: 'request_overall_status',
    name: 'Request Overall Status',
    description: 'High-level status values for requests (e.g. Not Started, In Progress).',
    builtIn: true,
    linkedTo: ['request_overall_status_field'],
    items: [
      { value: 'not_started', label: 'Not Started', color: 'blue' },
      { value: 'in_progress', label: 'In Progress', color: 'gold' },
      { value: 'completed', label: 'Completed', color: 'green' },
      { value: 'blocked', label: 'Blocked', color: 'red' },
      { value: 'cancelled', label: 'Cancelled', color: 'default' },
    ],
  },
];

const STORAGE_KEY = 'eam_app_configs';

function loadFromStorage(): ConfigType[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ConfigType[];
      // Merge: ensure built-in configs always have their linkedTo set
      return parsed.map(c => {
        const def = DEFAULT_CONFIGS.find(d => d.id === c.id);
        return def ? { ...c, linkedTo: c.linkedTo ?? def.linkedTo } : c;
      });
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
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [configs, setConfigs] = useState<ConfigType[]>(() => loadFromStorage());

  const persist = useCallback((next: ConfigType[]) => {
    setConfigs(next);
    saveToStorage(next);
  }, []);

  const getConfig = useCallback((id: string) => configs.find(c => c.id === id), [configs]);

  const addConfigType = useCallback((name: string, description: string) => {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now();
    persist([...configs, { id, name, description, items: [], builtIn: false, linkedTo: [] }]);
  }, [configs, persist]);

  const renameConfigType = useCallback((id: string, newName: string) => {
    persist(configs.map(c => c.id === id ? { ...c, name: newName } : c));
  }, [configs, persist]);

  const deleteConfigType = useCallback((id: string) => {
    persist(configs.filter(c => c.id !== id || !!c.builtIn));
  }, [configs, persist]);

  const bulkImportConfigs = useCallback((entries: Array<{ name: string; values: string[] }>) => {
    let created = 0;
    let added = 0;
    // Work on a mutable copy of current configs
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
          const value = valTrim.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
          target!.items.push({ value, label: valTrim, color: 'default' });
          added++;
        }
      });
    });

    persist(next);
    return { created, added };
  }, [configs, persist]);

  const addItem = useCallback((configId: string, label: string, color?: string) => {
    const value = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now();
    persist(configs.map(c =>
      c.id === configId ? { ...c, items: [...c.items, { value, label, color: color || 'default' }] } : c
    ));
  }, [configs, persist]);

  const removeItem = useCallback((configId: string, itemValue: string) => {
    persist(configs.map(c =>
      c.id === configId ? { ...c, items: c.items.filter(i => i.value !== itemValue) } : c
    ));
  }, [configs, persist]);

  const editItem = useCallback((configId: string, itemValue: string, newLabel: string, newColor?: string) => {
    persist(configs.map(c =>
      c.id === configId
        ? { ...c, items: c.items.map(i => i.value === itemValue ? { ...i, label: newLabel, color: newColor || i.color } : i) }
        : c
    ));
  }, [configs, persist]);

  const reorderItems = useCallback((configId: string, items: ConfigItem[]) => {
    persist(configs.map(c => c.id === configId ? { ...c, items } : c));
  }, [configs, persist]);

  const updateLinks = useCallback((configId: string, linkedTo: string[]) => {
    persist(configs.map(c => c.id === configId ? { ...c, linkedTo } : c));
  }, [configs, persist]);

  return (
    <ConfigContext.Provider value={{ configs, getConfig, addConfigType, renameConfigType, deleteConfigType, bulkImportConfigs, addItem, removeItem, editItem, reorderItems, updateLinks }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used inside ConfigProvider');
  return ctx;
}

