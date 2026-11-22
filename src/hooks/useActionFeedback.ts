import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ConfirmDialogOptions,
  ExecuteActionOutcome,
  MutationPersistenceResult,
  runFeedbackAction,
} from '../lib/actionFeedback';
import { useFeedbackStore } from '../store/slices/feedbackSlice';

export interface RunActionParams<T extends MutationPersistenceResult = MutationPersistenceResult> {
  actionKey: string;
  operation: () => Promise<T>;
  successMessage: string;
  queuedMessage?: string;
  errorContext: string;
  redirectToDashboard?: boolean;
  onSuccess?: (result: T) => void | Promise<void>;
  getPartialWarning?: (result: T) => string | undefined;
  onError?: (formattedMessage: string, rawError: unknown) => void;
}

export function useActionFeedback() {
  const navigate = useNavigate();
  const location = useLocation();
  const pendingActions = useFeedbackStore((s) => s.pendingActions);
  const confirmAction = useFeedbackStore((s) => s.confirmAction);
  const notifySuccess = useFeedbackStore((s) => s.notifySuccess);
  const notifyError = useFeedbackStore((s) => s.notifyError);
  const notifyWarning = useFeedbackStore((s) => s.notifyWarning);

  const executeAction = useCallback(
    async <T extends MutationPersistenceResult = MutationPersistenceResult>(
      params: RunActionParams<T>
    ): Promise<ExecuteActionOutcome<T>> => {
      const store = useFeedbackStore.getState();
      return runFeedbackAction(
        {
          notifySuccess: store.notifySuccess,
          notifyWarning: store.notifyWarning,
          notifyError: store.notifyError,
          setPending: store.setPending,
        },
        {
          ...params,
          currentPath: location.pathname,
          navigate: (to: string) => navigate(to),
        }
      );
    },
    [location.pathname, navigate]
  );

  const isActionPending = useCallback(
    (actionKey: string) => !!pendingActions[actionKey],
    [pendingActions]
  );

  const askConfirmation = useCallback(
    (options: ConfirmDialogOptions) => confirmAction(options),
    [confirmAction]
  );

  return {
    executeAction,
    isActionPending,
    confirmAction: askConfirmation,
    notifySuccess,
    notifyError,
    notifyWarning,
  };
}
