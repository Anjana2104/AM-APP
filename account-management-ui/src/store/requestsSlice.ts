import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface RequestRow {
  id?: number;
  sno: string;
  beelineId: string;
  description: string;
  raisedBy: string;
  processingStatus: string;
  overallStatus: string;
  accountAnchor: string;
  dateRaised: string;
  requestType?: string;
  updatedOn?: string;
  isActive?: boolean;
}

export interface ActiveRequestOption {
  beelineId: string;
}

type RequestsState = {
  items: RequestRow[];
  loaded: boolean;
  fromServer: boolean;
  activeRequestOptions: ActiveRequestOption[];
  activeRequestOptionsLoaded: boolean;
};

const initialState: RequestsState = {
  items: [],
  loaded: false,
  fromServer: false,
  activeRequestOptions: [],
  activeRequestOptionsLoaded: false,
};

const requestsSlice = createSlice({
  name: 'requests',
  initialState,
  reducers: {
    setRequests(state, action: PayloadAction<RequestRow[]>) {
      state.items = action.payload;
      state.loaded = true;
    },
    clearRequests(state) {
      state.items = [];
      state.loaded = false;
      state.fromServer = false;
    },
    setRequestsFromServer(state, action: PayloadAction<boolean>) {
      state.fromServer = action.payload;
    },
    setActiveRequestOptions(state, action: PayloadAction<ActiveRequestOption[]>) {
      state.activeRequestOptions = action.payload;
      state.activeRequestOptionsLoaded = true;
    },
    clearActiveRequestOptions(state) {
      state.activeRequestOptions = [];
      state.activeRequestOptionsLoaded = false;
    },
  },
});

export const {
  setRequests,
  clearRequests,
  setRequestsFromServer,
  setActiveRequestOptions,
  clearActiveRequestOptions,
} = requestsSlice.actions;

export const requestsReducer = requestsSlice.reducer;
