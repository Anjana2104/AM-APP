import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { FinanceProject } from '../api/financeApi';
import type { InvoiceProject } from '../api/invoiceApi';

type FinanceDataState = {
  financeProjects: FinanceProject[];
  financeMonths: string[];
  financeLoaded: boolean;
  financeFromServer: boolean;
  invoiceProjects: InvoiceProject[];
  invoiceMonths: string[];
  invoiceLoaded: boolean;
  invoiceFromServer: boolean;
};

const initialState: FinanceDataState = {
  financeProjects: [],
  financeMonths: [],
  financeLoaded: false,
  financeFromServer: false,
  invoiceProjects: [],
  invoiceMonths: [],
  invoiceLoaded: false,
  invoiceFromServer: false,
};

const financeDataSlice = createSlice({
  name: 'financeData',
  initialState,
  reducers: {
    setFinanceData(state, action: PayloadAction<{ projects: FinanceProject[]; months: string[]; fromServer: boolean }>) {
      state.financeProjects = action.payload.projects;
      state.financeMonths = action.payload.months;
      state.financeFromServer = action.payload.fromServer;
      state.financeLoaded = true;
    },
    clearFinanceData(state) {
      state.financeProjects = [];
      state.financeMonths = [];
      state.financeFromServer = false;
      state.financeLoaded = false;
    },
    setInvoiceData(state, action: PayloadAction<{ projects: InvoiceProject[]; months: string[]; fromServer: boolean }>) {
      state.invoiceProjects = action.payload.projects;
      state.invoiceMonths = action.payload.months;
      state.invoiceFromServer = action.payload.fromServer;
      state.invoiceLoaded = true;
    },
    clearInvoiceData(state) {
      state.invoiceProjects = [];
      state.invoiceMonths = [];
      state.invoiceFromServer = false;
      state.invoiceLoaded = false;
    },
  },
});

export const { setFinanceData, clearFinanceData, setInvoiceData, clearInvoiceData } = financeDataSlice.actions;
export const financeDataReducer = financeDataSlice.reducer;
