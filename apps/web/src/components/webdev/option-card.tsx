'use client';

import { cn } from '@lmring/ui';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ProviderIcon } from '@/components/arena/provider-icon';
import { STATUS_COLORS } from '@/constants/webdev';
import { formatErrorForDisplay } from '@/libs/format-api-error';
import { useWebDevStore } from '@/stores/webdev-store';
import { useWorkflowStore } from '@/stores/workflow-store';
import type { SandboxStatus } from '@/types/webdev';
import { ActivityLog, type ActivityLogItem } from './activity-log';

function getStatusKey(status: SandboxStatus): string {
  switch (status) {
    case 'idle':
      return 'WebDev.status_waiting';
    case 'creating':
      return 'WebDev.status_creating_sandbox';
    case 'installing':
      return 'WebDev.status_installing_deps';
    case 'starting':
      return 'WebDev.status_starting_server';
    case 'ready':
      return 'WebDev.status_ready';
    case 'error':
      return 'WebDev.status_error';
    case 'expired':
      return 'WebDev.status_expired';
    case 'stopped':
      return 'WebDev.status_stopped';
    case 'snapshotting':
      return 'WebDev.status_snapshotting';
    case 'restoring':
      return 'WebDev.status_restoring';
  }
}

function getStatusColorClass(status: SandboxStatus): string {
  switch (status) {
    case 'ready':
      return STATUS_COLORS.complete.tw;
    case 'creating':
    case 'installing':
    case 'starting':
    case 'snapshotting':
    case 'restoring':
      return STATUS_COLORS.building.tw;
    case 'error':
    case 'expired':
    case 'stopped':
      return STATUS_COLORS.error.tw;
    default:
      return STATUS_COLORS.idle.tw;
  }
}

function isActiveStatus(status: SandboxStatus): boolean {
  return (
    status === 'creating' ||
    status === 'installing' ||
    status === 'starting' ||
    status === 'snapshotting' ||
    status === 'restoring'
  );
}

function buildActivityItems(
  status: SandboxStatus,
  files: Record<string, string>,
  error: string | null,
  t: ReturnType<typeof useTranslation>['t'],
  workflowStatus?: string,
): ActivityLogItem[] {
  const items: ActivityLogItem[] = [];

  if (workflowStatus === 'running' && status === 'idle') {
    items.push({ id: 'generating', icon: 'pencil', text: t('WebDev.generating_code') });
    return items;
  }

  const fileCount = Object.keys(files).length;
  if (fileCount > 0) {
    items.push({
      id: 'files',
      icon: 'file-plus',
      text: t(fileCount > 1 ? 'WebDev.files_generated_plural' : 'WebDev.files_generated', {
        count: fileCount,
      }),
    });
  }

  if (
    status === 'creating' ||
    status === 'installing' ||
    status === 'starting' ||
    status === 'ready' ||
    status === 'snapshotting' ||
    status === 'restoring'
  ) {
    items.push({ id: 'sandbox', icon: 'folder', text: t('WebDev.sandbox_created') });
  }

  if (status === 'installing' || status === 'starting' || status === 'ready') {
    items.push({ id: 'install', icon: 'pencil', text: t('WebDev.dependencies_installed') });
  }

  if (status === 'ready') {
    items.push({ id: 'ready', icon: 'circle-check', text: t('WebDev.preview_ready') });
  }

  if (status === 'snapshotting') {
    items.push({ id: 'snapshot', icon: 'pencil', text: t('WebDev.status_snapshotting') });
  }

  if (status === 'restoring') {
    items.push({ id: 'restore', icon: 'folder', text: t('WebDev.status_restoring') });
  }

  if (status === 'error' && error) {
    const formatted = formatErrorForDisplay(error);
    items.push({ id: 'error', icon: 'circle-x', text: `${formatted.title}: ${formatted.detail}` });
  }

  return items;
}

interface OptionCardProps {
  workflowId: string;
  index: number;
  modelName: string;
  isActive: boolean;
  showVote: boolean;
  onClick: () => void;
}

export const OptionCard = React.memo(function OptionCard({
  workflowId,
  modelName,
  isActive,
  onClick,
}: OptionCardProps) {
  const { t } = useTranslation();
  const sandbox = useWebDevStore((s) => s.sandboxes.get(workflowId));
  const workflow = useWorkflowStore((s) => s.workflows.get(workflowId));
  const modelId = workflow?.modelId ?? '';
  const providerId = modelId.split(':')[0] ?? '';
  const workflowStatus = workflow?.status;
  const status = sandbox?.status ?? 'idle';
  const files = sandbox?.files ?? {};
  const error = sandbox?.error ?? null;

  const activityItems = React.useMemo(
    () => buildActivityItems(status, files, error, t, workflowStatus),
    [status, files, error, t, workflowStatus],
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border border-[var(--webdev-border)] bg-[var(--webdev-card-bg)] p-4 text-left transition-colors',
        isActive && 'ring-2 ring-[var(--webdev-border)]',
      )}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <ProviderIcon providerId={providerId} size={20} type="avatar" />
        <span className="text-sm font-semibold text-[var(--webdev-text)] truncate">
          {modelName}
        </span>
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          {isActiveStatus(status) && (
            <Loader2 className={cn('h-3.5 w-3.5 animate-spin', getStatusColorClass(status))} />
          )}
          <span className={cn('text-xs font-medium', getStatusColorClass(status))}>
            {t(getStatusKey(status))}
          </span>
        </span>
      </div>

      <ActivityLog items={activityItems} />
    </button>
  );
});
