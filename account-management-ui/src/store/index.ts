import { configureStore } from '@reduxjs/toolkit';
import { resourcesReducer } from './resourcesSlice';
import { appShellReducer } from './appShellSlice';
import { requestsReducer } from './requestsSlice';
import { adminDirectoryReducer } from './adminDirectorySlice';
import { financeDataReducer } from './financeDataSlice';

export const store = configureStore({
  reducer: {
    adminDirectory: adminDirectoryReducer,
    appShell: appShellReducer,
    financeData: financeDataReducer,
    requests: requestsReducer,
    resources: resourcesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
