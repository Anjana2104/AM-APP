import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type AppModule = 'home' | 'eam';

type AppShellState = {
  activeModule: AppModule;
  activePage: string;
  expandedSections: string[];
  collapsedGroups: string[];
  sidebarCollapsed: boolean;
  resourceInfoRoleFilter?: string;
  resourceInfoRaIdFilter?: string;
  resourceInfoFilterType?: string;
  resourceInfoFilterValue?: string;
  requestsBeelineFilter?: string;
  requestsInitialFilters?: Record<string, unknown>;
  initialProcessSow?: string;
};

const ALL_PAGES = new Set([
  'account_summary',
  'executive_summary',
  'executive_revenue',
  'executive_invoicing',
  'resources_info',
  'resources_utilization',
  'resources_insights',
  'clientmgmt_requests',
  'clientmgmt_connects',
  'information_ratecard',
  'information_teamhierarchy',
  'information_process',
  'user_settings',
  'configuration',
  'user_access_control',
]);

const PAGE_SECTION_MAP: Record<string, string> = {
  account_summary: 'account',
  executive_summary: 'executive',
  executive_revenue: 'executive',
  executive_invoicing: 'executive',
  resources_info: 'resources',
  resources_utilization: 'resources',
  resources_insights: 'resources',
  clientmgmt_requests: 'clientmgmt',
  clientmgmt_connects: 'clientmgmt',
  information_ratecard: 'information',
  information_teamhierarchy: 'information',
  information_process: 'information',
  configuration: 'configuration',
  user_settings: 'configuration',
  user_access_control: 'configuration',
};

function parseInitialHash(): { module: AppModule; page: string } {
  if (typeof window === 'undefined') {
    return { module: 'home', page: 'account_summary' };
  }
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash === '' || hash === 'home') return { module: 'home', page: 'account_summary' };
  if (hash.startsWith('eam/')) {
    const page = hash.slice(4);
    if (ALL_PAGES.has(page)) return { module: 'eam', page };
  }
  return { module: 'home', page: 'account_summary' };
}

const initialHash = parseInitialHash();
const initialSection = PAGE_SECTION_MAP[initialHash.page];

const initialState: AppShellState = {
  activeModule: initialHash.module,
  activePage: initialHash.page,
  expandedSections: initialHash.module === 'eam' && initialSection ? [initialSection] : [],
  collapsedGroups: ['account_ops', 'settings_config', 'information'],
  sidebarCollapsed: false,
};

const appShellSlice = createSlice({
  name: 'appShell',
  initialState,
  reducers: {
    initializeFromHash(state, action: PayloadAction<{ module: AppModule; page: string }>) {
      state.activeModule = action.payload.module;
      state.activePage = action.payload.page;
      const section = PAGE_SECTION_MAP[action.payload.page];
      state.expandedSections = action.payload.module === 'eam' && section ? [section] : [];
    },
    setActiveModule(state, action: PayloadAction<AppModule>) {
      state.activeModule = action.payload;
    },
    setActivePage(state, action: PayloadAction<string>) {
      state.activePage = action.payload;
    },
    addExpandedSection(state, action: PayloadAction<string>) {
      if (!state.expandedSections.includes(action.payload)) {
        state.expandedSections.push(action.payload);
      }
    },
    clearExpandedSections(state) {
      state.expandedSections = [];
    },
    toggleExpandedSection(state, action: PayloadAction<string>) {
      state.expandedSections = state.expandedSections.includes(action.payload)
        ? state.expandedSections.filter((section) => section !== action.payload)
        : [...state.expandedSections, action.payload];
    },
    setSidebarCollapsed(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload;
    },
    toggleCollapsedGroup(state, action: PayloadAction<string>) {
      state.collapsedGroups = state.collapsedGroups.includes(action.payload)
        ? state.collapsedGroups.filter((group) => group !== action.payload)
        : [...state.collapsedGroups, action.payload];
    },
    setResourceInfoRoleFilter(state, action: PayloadAction<string | undefined>) {
      state.resourceInfoRoleFilter = action.payload;
    },
    setResourceInfoRaIdFilter(state, action: PayloadAction<string | undefined>) {
      state.resourceInfoRaIdFilter = action.payload;
    },
    setResourceInfoFilterType(state, action: PayloadAction<string | undefined>) {
      state.resourceInfoFilterType = action.payload;
    },
    setResourceInfoFilterValue(state, action: PayloadAction<string | undefined>) {
      state.resourceInfoFilterValue = action.payload;
    },
    clearResourceInfoFilters(state) {
      state.resourceInfoRoleFilter = undefined;
      state.resourceInfoRaIdFilter = undefined;
      state.resourceInfoFilterType = undefined;
      state.resourceInfoFilterValue = undefined;
    },
    setRequestsBeelineFilter(state, action: PayloadAction<string | undefined>) {
      state.requestsBeelineFilter = action.payload;
    },
    setRequestsInitialFilters(state, action: PayloadAction<Record<string, unknown> | undefined>) {
      state.requestsInitialFilters = action.payload;
    },
    clearRequestsNavigation(state) {
      state.requestsBeelineFilter = undefined;
      state.requestsInitialFilters = undefined;
    },
    setInitialProcessSow(state, action: PayloadAction<string | undefined>) {
      state.initialProcessSow = action.payload;
    },
    clearInitialProcessSow(state) {
      state.initialProcessSow = undefined;
    },
  },
});

export const {
  initializeFromHash,
  setActiveModule,
  setActivePage,
  addExpandedSection,
  clearExpandedSections,
  toggleExpandedSection,
  setSidebarCollapsed,
  toggleCollapsedGroup,
  setResourceInfoRoleFilter,
  setResourceInfoRaIdFilter,
  setResourceInfoFilterType,
  setResourceInfoFilterValue,
  clearResourceInfoFilters,
  setRequestsBeelineFilter,
  setRequestsInitialFilters,
  clearRequestsNavigation,
  setInitialProcessSow,
  clearInitialProcessSow,
} = appShellSlice.actions;

export const appShellReducer = appShellSlice.reducer;
