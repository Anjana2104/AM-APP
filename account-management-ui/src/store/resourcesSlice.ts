import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ResourceRow } from '../types/resource';

type ResourcesState = {
  items: ResourceRow[];
  loaded: boolean;
  fromServer: boolean;
};

const initialState: ResourcesState = {
  items: [],
  loaded: false,
  fromServer: false,
};

const resourcesSlice = createSlice({
  name: 'resources',
  initialState,
  reducers: {
    setResources(state, action: PayloadAction<ResourceRow[]>) {
      state.items = action.payload;
      state.loaded = true;
    },
    setResourcesFromServer(state, action: PayloadAction<boolean>) {
      state.fromServer = action.payload;
    },
    clearResources(state) {
      state.items = [];
      state.loaded = false;
      state.fromServer = false;
    },
  },
});

export const { setResources, setResourcesFromServer, clearResources } = resourcesSlice.actions;
export const resourcesReducer = resourcesSlice.reducer;
