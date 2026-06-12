/**
 * src/context/UserPreferencesContext.tsx
 *
 * Stores and syncs per-user preferences:
 *  - Column visibility per module
 *  - Notification snooze rules
 *
 * MODULE_COLUMN_CONFIGS defines every toggle-able column per module.
 * It is the single source of truth used by both UserSettings page and each table page.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as prefsApi from '../api/userPreferencesApi';
import type { UserPreferences, SnoozeRule } from '../api/userPreferencesApi';

// ── Column definitions per module ───────────────────────────────────────────

export interface ColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
}

export const MODULE_COLUMN_CONFIGS: Record<string, ColumnDef[]> = {
  sow: [
    { key: 'project',  label: 'Project',  defaultVisible: true },
    { key: 'company',  label: 'Company',  defaultVisible: true },
    { key: 'code',     label: 'Code',     defaultVisible: true },
    { key: 'space',    label: 'Space',    defaultVisible: true },
    { key: 'owner',    label: 'Owner',    defaultVisible: true },
    { key: 'comments', label: 'Comments', defaultVisible: true },
  ],
  invoice: [
    { key: 'project',  label: 'Project',  defaultVisible: true },
    { key: 'company',  label: 'Company',  defaultVisible: true },
    { key: 'code',     label: 'Code',     defaultVisible: true },
    { key: 'comments', label: 'Comments', defaultVisible: false },
  ],
  resources: [
    { key: 'raId',            label: 'RA ID',            defaultVisible: true },
    { key: 'empName',         label: 'Employee Name',    defaultVisible: true },
    { key: 'emailId',         label: 'Email ID',         defaultVisible: true },
    { key: 'piwRole',         label: 'PIW Role',         defaultVisible: true },
    { key: 'roleOrDomain',    label: 'Role / Domain',    defaultVisible: true },
    { key: 'previousWorkex',  label: 'Previous Workex',  defaultVisible: true },
    { key: 'doj',             label: 'DOJ',              defaultVisible: true },
    { key: 'totalWorkex',     label: 'Total Workex',     defaultVisible: true },
    { key: 'engagement',      label: 'Engagement',       defaultVisible: true },
    { key: 'allocationStatus',label: 'Allocation Status',defaultVisible: true },
    { key: 'skills',          label: 'Skills',           defaultVisible: true },
  ],
  requests: [
    { key: 'sno',               label: 'S.No',              defaultVisible: true },
    { key: 'beelineId',         label: 'Beeline ID',        defaultVisible: true },
    { key: 'requestType',       label: 'Request Type',      defaultVisible: true },
    { key: 'description',       label: 'Description',       defaultVisible: true },
    { key: 'raisedBy',          label: 'Raised By',         defaultVisible: true },
    { key: 'processingStatus',  label: 'Processing Status', defaultVisible: true },
    { key: 'overallStatus',     label: 'Overall Status',    defaultVisible: true },
    { key: 'accountAnchor',     label: 'Account Anchor',    defaultVisible: true },
    { key: 'dateRaised',        label: 'Date Raised',       defaultVisible: true },
  ],
  process: [
    { key: 'sno',          label: 'S.No',          defaultVisible: true },
    { key: 'startDate',    label: 'Start Date',    defaultVisible: true },
    { key: 'sow',          label: 'SOW',           defaultVisible: true },
    { key: 'signedSow',    label: 'Signed SOW',    defaultVisible: true },
    { key: 'piw',          label: 'PIW',           defaultVisible: true },
    { key: 'active',       label: 'Active',        defaultVisible: true },
    { key: 'salesforceId', label: 'Salesforce ID', defaultVisible: true },
    { key: 'promsId',      label: 'PROMS ID',      defaultVisible: true },
    { key: 'budget',       label: 'Budget',        defaultVisible: true },
    { key: 'openAirCode',  label: 'Open Air Code', defaultVisible: true },
    { key: 'comments',     label: 'Comments',      defaultVisible: true },
    { key: 'accountAnchor',label: 'Account Anchor',defaultVisible: true },
  ],
};

/** Build the default visibility map for a module (key → boolean) */
export function getDefaultColumnVisibility(module: string): Record<string, boolean> {
  const cols = MODULE_COLUMN_CONFIGS[module] || [];
  return Object.fromEntries(cols.map(c => [c.key, c.defaultVisible]));
}

// ── Context types ────────────────────────────────────────────────────────────

interface UserPreferencesContextValue {
  preferencesLoaded: boolean;
  /** Returns saved visibility map; falls back to defaults if not saved yet */
  getColumnVisibility: (module: string) => Record<string, boolean>;
  /** Persist a new visibility map for a module */
  saveColumnVisibility: (module: string, vis: Record<string, boolean>) => void;
  /** Currently active snooze rules */
  notificationSnooze: SnoozeRule[];
  /** Check whether a given triggerId (or all, if null) is snoozed right now */
  isSnoozed: (triggerId: number | null) => boolean;
  /** Persist a full list of snooze rules */
  saveNotificationSnooze: (rules: SnoozeRule[]) => void;
}

const UserPreferencesContext = createContext<UserPreferencesContextValue>({
  preferencesLoaded: false,
  getColumnVisibility: getDefaultColumnVisibility,
  saveColumnVisibility: () => {},
  notificationSnooze: [],
  isSnoozed: () => false,
  saveNotificationSnooze: () => {},
});

export function useUserPreferences() {
  return useContext(UserPreferencesContext);
}

// ── Provider ─────────────────────────────────────────────────────────────────

interface Props {
  userId: number | null;
  children: React.ReactNode;
}

export function UserPreferencesProvider({ userId, children }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences>({ columnVisibility: {}, notificationSnooze: [] });
  // Debounce ref for auto-save
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load on mount / userId change
  useEffect(() => {
    if (!userId) { setLoaded(false); return; }
    prefsApi.getUserPreferences(userId).then(p => {
      setPrefs(p || { columnVisibility: {}, notificationSnooze: [] });
      setLoaded(true);
    }).catch(() => setLoaded(true)); // fallback to defaults on error
  }, [userId]);

  const persistPrefs = useCallback((updated: UserPreferences) => {
    if (!userId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      prefsApi.saveUserPreferences(userId, updated).catch(() => {});
    }, 600); // debounce 600ms
  }, [userId]);

  const getColumnVisibility = useCallback((module: string): Record<string, boolean> => {
    const saved = prefs.columnVisibility?.[module];
    if (!saved) return getDefaultColumnVisibility(module);
    // Merge with defaults so new columns that weren't saved yet get their default value
    const defaults = getDefaultColumnVisibility(module);
    return { ...defaults, ...saved };
  }, [prefs]);

  const saveColumnVisibility = useCallback((module: string, vis: Record<string, boolean>) => {
    setPrefs(prev => {
      const updated: UserPreferences = {
        ...prev,
        columnVisibility: { ...prev.columnVisibility, [module]: vis },
      };
      persistPrefs(updated);
      return updated;
    });
  }, [persistPrefs]);

  const notificationSnooze = prefs.notificationSnooze || [];

  const isSnoozed = useCallback((triggerId: number | null): boolean => {
    const now = new Date();
    return notificationSnooze.some(rule => {
      if (new Date(rule.until) <= now) return false; // expired
      if (rule.triggerId === null) return true; // all-trigger snooze
      if (triggerId === null) return rule.triggerId === null;
      return rule.triggerId === triggerId;
    });
  }, [notificationSnooze]);

  const saveNotificationSnooze = useCallback((rules: SnoozeRule[]) => {
    setPrefs(prev => {
      const updated: UserPreferences = { ...prev, notificationSnooze: rules };
      persistPrefs(updated);
      return updated;
    });
  }, [persistPrefs]);

  return (
    <UserPreferencesContext.Provider value={{
      preferencesLoaded: loaded,
      getColumnVisibility,
      saveColumnVisibility,
      notificationSnooze,
      isSnoozed,
      saveNotificationSnooze,
    }}>
      {children}
    </UserPreferencesContext.Provider>
  );
}
