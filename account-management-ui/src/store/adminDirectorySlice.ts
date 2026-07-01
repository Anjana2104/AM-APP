import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RoleRecord, UserRecord } from '../api/authApi';
import type { UserGroup } from '../api/notificationApi';

type AdminDirectoryState = {
  users: UserRecord[];
  usersLoaded: boolean;
  roles: RoleRecord[];
  rolesLoaded: boolean;
  groups: UserGroup[];
  groupsLoaded: boolean;
};

const initialState: AdminDirectoryState = {
  users: [],
  usersLoaded: false,
  roles: [],
  rolesLoaded: false,
  groups: [],
  groupsLoaded: false,
};

const adminDirectorySlice = createSlice({
  name: 'adminDirectory',
  initialState,
  reducers: {
    setUsers(state, action: PayloadAction<UserRecord[]>) {
      state.users = action.payload;
      state.usersLoaded = true;
    },
    setRoles(state, action: PayloadAction<RoleRecord[]>) {
      state.roles = action.payload;
      state.rolesLoaded = true;
    },
    setGroups(state, action: PayloadAction<UserGroup[]>) {
      state.groups = action.payload;
      state.groupsLoaded = true;
    },
    clearUsers(state) {
      state.users = [];
      state.usersLoaded = false;
    },
    clearRoles(state) {
      state.roles = [];
      state.rolesLoaded = false;
    },
    clearGroups(state) {
      state.groups = [];
      state.groupsLoaded = false;
    },
  },
});

export const {
  setUsers,
  setRoles,
  setGroups,
  clearUsers,
  clearRoles,
  clearGroups,
} = adminDirectorySlice.actions;

export const adminDirectoryReducer = adminDirectorySlice.reducer;
