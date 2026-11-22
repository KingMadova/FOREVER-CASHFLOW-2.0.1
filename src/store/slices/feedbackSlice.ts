import { create } from 'zustand';
import {
  ActionFeedbackItem,
  ConfirmDialogOptions,
  FeedbackType,
} from '../../lib/actionFeedback';

interface ActiveConfirmRequest {
  options: ConfirmDialogOptions;
  resolve: (confirmed: boolean) => void;
}

interface FeedbackState {
  notifications: ActionFeedbackItem[];
  pendingActions: Record<string, boolean>;
  confirmRequest: ActiveConfirmRequest | null;
  notify: (type: FeedbackType, message: string, title?: string, durationMs?: number) => string;
  notifySuccess: (message: string, title?: string) => string;
  notifyError: (message: string, title?: string) => string;
  notifyWarning: (message: string, title?: string) => string;
  dismissNotification: (id: string) => void;
  setPending: (actionKey: string, pending: boolean) => void;
  isPending: (actionKey: string) => boolean;
  confirmAction: (options: ConfirmDialogOptions) => Promise<boolean>;
  resolveConfirm: (confirmed: boolean) => void;
}

const DEFAULT_DURATIONS: Record<FeedbackType, number> = {
  success: 4500,
  warning: 5500,
  error: 7000,
};

const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
  notifications: [],
  pendingActions: {},
  confirmRequest: null,

  notify: (type, message, title, durationMs) => {
    const id = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const resolvedDuration = durationMs ?? DEFAULT_DURATIONS[type];

    set((state) => ({
      notifications: [
        ...state.notifications.slice(-3),
        { id, type, title, message, durationMs: resolvedDuration },
      ],
    }));

    if (resolvedDuration > 0 && typeof setTimeout !== 'undefined') {
      const timer = setTimeout(() => {
        activeTimers.delete(id);
        get().dismissNotification(id);
      }, resolvedDuration);
      activeTimers.set(id, timer);
    }

    return id;
  },

  notifySuccess: (message, title) => get().notify('success', message, title),
  notifyError: (message, title) => get().notify('error', message, title),
  notifyWarning: (message, title) => get().notify('warning', message, title),

  dismissNotification: (id) => {
    const timer = activeTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      activeTimers.delete(id);
    }
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  setPending: (actionKey, pending) => {
    set((state) => {
      const next = { ...state.pendingActions };
      if (pending) {
        next[actionKey] = true;
      } else {
        delete next[actionKey];
      }
      return { pendingActions: next };
    });
  },

  isPending: (actionKey) => !!get().pendingActions[actionKey],

  confirmAction: (options) => {
    const existing = get().confirmRequest;
    if (existing) {
      existing.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      set({ confirmRequest: { options, resolve } });
    });
  },

  resolveConfirm: (confirmed) => {
    const current = get().confirmRequest;
    if (current) {
      set({ confirmRequest: null });
      current.resolve(confirmed);
    }
  },
}));
