import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import * as notifApi from '../api/notificationApi';
import type { Notification } from '../api/notificationApi';

const PAGE_SIZE = 20;

interface NotificationContextValue {
  // Unread items — paginated
  unreadNotifications: Notification[];
  unreadHasMore: boolean;
  unreadLoading: boolean;
  // Read (history) items — loaded on demand
  historyNotifications: Notification[];
  historyTotal: number;
  historyHasMore: boolean;
  unreadCount: number; // lightweight count from /count endpoint
  loading: boolean;
  historyLoading: boolean;
  /** Called when panel opens — loads first page of unread notifications */
  refreshUnread: () => Promise<void>;
  /** Load next page of unread notifications */
  loadMoreUnread: () => Promise<void>;
  /** Load next page of read history */
  loadMoreHistory: () => Promise<void>;
  /** Reset history (call when panel closes or history collapses) */
  resetHistory: () => void;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  createNotification: (data: {
    type?: string;
    title: string;
    message: string;
    target_user_id?: number | null;
    target_group_id?: number | null;
    source_user?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [unreadNotifications, setUnreadNotifications] = useState<Notification[]>([]);
  const [unreadHasMore, setUnreadHasMore] = useState(false);
  const [unreadLoading, setUnreadLoading] = useState(false);
  const [historyNotifications, setHistoryNotifications] = useState<Notification[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const historyOffsetRef = useRef(0);
  const unreadOffsetRef = useRef(0);

  // Lightweight count poll every 30s — only hits /count endpoint
  const pollCount = useCallback(async () => {
    if (!currentUser) return;
    const count = await notifApi.getUnreadCount(currentUser.id);
    setUnreadCount(count);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    pollCount();
    const interval = setInterval(pollCount, 30_000);
    return () => clearInterval(interval);
  }, [currentUser, pollCount]);

  // Called when panel opens — loads first PAGE_SIZE unread items
  const refreshUnread = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    const page = await notifApi.getNotifications(currentUser.id, { limit: PAGE_SIZE, offset: 0, unreadOnly: true });
    setUnreadNotifications(page.notifications);
    setUnreadCount(page.total);
    setUnreadHasMore(page.has_more);
    unreadOffsetRef.current = PAGE_SIZE;
    setLoading(false);
  }, [currentUser]);

  // Load next page of unread notifications
  const loadMoreUnread = useCallback(async () => {
    if (!currentUser || unreadLoading) return;
    setUnreadLoading(true);
    const offset = unreadOffsetRef.current;
    const page = await notifApi.getNotifications(currentUser.id, { limit: PAGE_SIZE, offset, unreadOnly: true });
    setUnreadNotifications(prev => [...prev, ...page.notifications]);
    setUnreadHasMore(page.has_more);
    unreadOffsetRef.current = offset + PAGE_SIZE;
    setUnreadLoading(false);
  }, [currentUser, unreadLoading]);

  // Load next page of history (read items)
  const loadMoreHistory = useCallback(async () => {
    if (!currentUser || historyLoading) return;
    setHistoryLoading(true);
    const offset = historyOffsetRef.current;
    const page = await notifApi.getNotifications(currentUser.id, { limit: PAGE_SIZE, offset, unreadOnly: false });
    // Filter to only already-read items on frontend (server returns all, we separate)
    const readItems = page.notifications.filter(n => n.is_read_by_user);
    setHistoryNotifications(prev => offset === 0 ? readItems : [...prev, ...readItems]);
    setHistoryTotal(page.total);
    setHistoryHasMore(page.has_more);
    historyOffsetRef.current = offset + PAGE_SIZE;
    setHistoryLoading(false);
  }, [currentUser, historyLoading]);

  const resetHistory = useCallback(() => {
    setHistoryNotifications([]);
    setHistoryTotal(0);
    setHistoryHasMore(false);
    historyOffsetRef.current = 0;
  }, []);

  const markRead = useCallback(async (id: number) => {
    if (!currentUser) return;
    await notifApi.markNotificationRead(id, currentUser.id);
    setUnreadNotifications(prev => prev.filter(n => n.id !== id));
    setUnreadCount(c => Math.max(0, c - 1));
  }, [currentUser]);

  const markAllRead = useCallback(async () => {
    if (!currentUser) return;
    await notifApi.markAllRead(currentUser.id);
    setUnreadNotifications([]);
    setUnreadCount(0);
    setUnreadHasMore(false);
    unreadOffsetRef.current = 0;
  }, [currentUser]);

  const createNotification = useCallback(async (data: {
    type?: string;
    title: string;
    message: string;
    target_user_id?: number | null;
    target_group_id?: number | null;
    source_user?: string;
  }) => {
    const result = await notifApi.createNotification(data);
    if (result.ok) { await refreshUnread(); await pollCount(); }
    return result;
  }, [refreshUnread, pollCount]);

  return (
    <NotificationContext.Provider value={{
      unreadNotifications,
      unreadHasMore,
      unreadLoading,
      historyNotifications,
      historyTotal,
      historyHasMore,
      unreadCount,
      loading,
      historyLoading,
      refreshUnread,
      loadMoreUnread,
      loadMoreHistory,
      resetHistory,
      markRead,
      markAllRead,
      createNotification,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
