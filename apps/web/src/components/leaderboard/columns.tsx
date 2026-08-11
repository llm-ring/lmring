'use client';

import { cn } from '@lmring/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { CheckIcon, ChevronDown, ChevronUp, LockIcon, UnlockIcon, XIcon } from 'lucide-react';
import { ProviderIcon } from '@/components/arena/provider-icon';
import type { TranslationFunction } from '@/hooks/use-translations';
import { formatMetricValue, getNumericValue, type MetricConfig } from '@/libs/zeroeval-api';
import type { LeaderboardTableFeatures } from './table-features';
import type { LeaderboardModel } from './types';

// Rank cell with medal styling
function RankCell({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 text-white text-xs font-bold shadow-sm">
        {rank}
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 text-white text-xs font-bold shadow-sm">
        {rank}
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 text-white text-xs font-bold shadow-sm">
        {rank}
      </div>
    );
  }
  return <span className="text-muted-foreground font-medium text-sm pl-2">{rank}</span>;
}

// Model cell with provider icon and name
function ModelCell({ model, t }: { model: LeaderboardModel; t: TranslationFunction }) {
  return (
    <div className="flex items-center gap-3">
      <ProviderIcon providerId={model.organization_id} size={24} type="avatar" />
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground text-sm truncate">{model.name}</span>
          {model.isNew && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-sm shadow-emerald-500/25 flex-shrink-0">
              {t('Leaderboard.table_new')}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground truncate">{model.organization}</span>
      </div>
    </div>
  );
}

// License badge
function LicenseCell({ license }: { license: string }) {
  if (!license) return null;
  const isOpen = license !== 'proprietary' && !license.includes('proprietary');
  const displayLicense = license.length > 12 ? `${license.slice(0, 10)}...` : license;

  return (
    <div className="flex items-center gap-1.5" title={license}>
      {isOpen ? (
        <UnlockIcon className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
      ) : (
        <LockIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      )}
      <span className="text-xs text-muted-foreground">{displayLicense}</span>
    </div>
  );
}

// Multimodal indicator
function MultimodalCell({ supported }: { supported: boolean }) {
  return supported ? (
    <CheckIcon className="h-4 w-4 text-emerald-500 mx-auto" />
  ) : (
    <XIcon className="h-4 w-4 text-muted-foreground/50 mx-auto" />
  );
}

// Score cell with highlighting
function ScoreCell({
  value,
  format,
  highlight,
}: {
  value: string | number | null;
  format: MetricConfig['format'];
  highlight?: boolean;
}) {
  const formatted = formatMetricValue(value, format);
  const isHighScore = format === 'percentage' && typeof value === 'number' && value >= 0.8;

  return (
    <span
      className={cn(
        'tabular-nums text-sm',
        isHighScore && highlight && 'text-emerald-600 dark:text-emerald-400 font-semibold',
      )}
    >
      {formatted}
    </span>
  );
}

// Sortable header component - cycles: none → desc → asc → none
function SortableHeader({
  column,
  label,
  t,
}: {
  column: {
    getIsSorted: () => 'asc' | 'desc' | false;
    toggleSorting: (desc?: boolean) => void;
    clearSorting: () => void;
  };
  label: string;
  t: TranslationFunction;
}) {
  const sorted = column.getIsSorted();

  const handleClick = () => {
    if (!sorted) {
      // No sort → Descending (highest first, most common for scores)
      column.toggleSorting(true);
    } else if (sorted === 'desc') {
      // Descending → Ascending
      column.toggleSorting(false);
    } else {
      // Ascending → Clear (back to original order)
      column.clearSorting();
    }
  };

  return (
    <button
      type="button"
      className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
      onClick={handleClick}
      title={
        !sorted
          ? t('Leaderboard.sort_descending')
          : sorted === 'desc'
            ? t('Leaderboard.sort_ascending')
            : t('Leaderboard.sort_clear')
      }
    >
      {label}
      {sorted === 'desc' && <ChevronDown className="h-4 w-4" />}
      {sorted === 'asc' && <ChevronUp className="h-4 w-4" />}
      {!sorted && <span className="w-4" />}
    </button>
  );
}

// Create base columns
export function createBaseColumns(
  t: TranslationFunction,
): ColumnDef<LeaderboardTableFeatures, LeaderboardModel>[] {
  return [
    {
      accessorKey: 'rank',
      header: () => (
        <span className="text-xs uppercase tracking-wide">{t('Leaderboard.table_rank')}</span>
      ),
      cell: ({ row }) => <RankCell rank={row.original.rank} />,
      size: 70,
      enableSorting: false,
      enableResizing: false,
    },
    {
      accessorKey: 'name',
      header: () => (
        <span className="text-xs uppercase tracking-wide">{t('Leaderboard.table_model')}</span>
      ),
      cell: ({ row }) => <ModelCell model={row.original} t={t} />,
      size: 280,
      minSize: 200,
      enableSorting: false,
    },
  ];
}

// Create metric columns dynamically
export function createMetricColumns(
  metrics: MetricConfig[],
  t: TranslationFunction,
): ColumnDef<LeaderboardTableFeatures, LeaderboardModel>[] {
  return metrics.map((metric) => ({
    accessorKey: metric.field,
    header: ({ column }) => (
      <div className="text-right">
        <SortableHeader column={column} label={metric.label} t={t} />
      </div>
    ),
    cell: ({ row }) => {
      const value = row.original[metric.field as keyof LeaderboardModel] as string | number | null;
      return (
        <div className="text-right">
          <ScoreCell value={value} format={metric.format} highlight={metric.higherIsBetter} />
        </div>
      );
    },
    size: 100,
    minSize: 80,
    sortFn: (rowA, rowB) => {
      const a = getNumericValue(
        rowA.original[metric.field as keyof LeaderboardModel] as string | number | null,
      );
      const b = getNumericValue(
        rowB.original[metric.field as keyof LeaderboardModel] as string | number | null,
      );
      if (a === -Infinity && b === -Infinity) return 0;
      if (a === -Infinity) return 1;
      if (b === -Infinity) return -1;
      return a - b;
    },
  }));
}

// Create trailing columns
export function createTrailingColumns(
  t: TranslationFunction,
): ColumnDef<LeaderboardTableFeatures, LeaderboardModel>[] {
  return [
    {
      accessorKey: 'knowledge_cutoff',
      header: () => (
        <span className="text-xs uppercase tracking-wide text-center block">
          {t('Leaderboard.table_cutoff')}
        </span>
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground text-center block">
          {row.original.knowledge_cutoff || '—'}
        </span>
      ),
      size: 100,
      minSize: 80,
      enableSorting: false,
    },
    {
      accessorKey: 'multimodal',
      header: () => (
        <span className="text-xs uppercase tracking-wide text-center block">
          {t('Leaderboard.table_vision')}
        </span>
      ),
      cell: ({ row }) => <MultimodalCell supported={row.original.multimodal} />,
      size: 80,
      minSize: 60,
      enableSorting: false,
    },
    {
      accessorKey: 'license',
      header: () => (
        <span className="text-xs uppercase tracking-wide text-center block">
          {t('Leaderboard.table_license')}
        </span>
      ),
      cell: ({ row }) => <LicenseCell license={row.original.license} />,
      size: 120,
      minSize: 100,
      enableSorting: false,
    },
  ];
}
