'use client';

import { cn } from '@lmring/ui';
import {
  type ColumnDef,
  type OnChangeFn,
  type RowData,
  type SortingState,
  useTable,
} from '@tanstack/react-table';
import { useEventListener, useMemoizedFn, useRafState, useResetState } from 'ahooks';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from '@/hooks/use-translations';
import { type LeaderboardTableFeatures, leaderboardTableFeatures } from './table-features';

interface DataTableProps<TData extends RowData> {
  columns: ColumnDef<LeaderboardTableFeatures, TData>[];
  data: TData[];
  pageSize?: number;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  manualSorting?: boolean;
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  pageSize = 20,
  sorting: controlledSorting,
  onSortingChange,
  manualSorting = false,
}: DataTableProps<TData>) {
  const t = useTranslations();
  const [uncontrolledSorting, setUncontrolledSorting] = useState<SortingState>([]);
  const [resizingColumnId, setResizingColumnId, resetResizingColumnId] = useResetState<
    string | null
  >(null);
  const [guideLinePosition, setGuideLinePosition] = useRafState<number | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const sorting = controlledSorting ?? uncontrolledSorting;
  const handleSortingChange = onSortingChange ?? setUncontrolledSorting;

  const table = useTable(
    {
      features: leaderboardTableFeatures,
      data,
      columns,
      columnResizeMode: 'onChange',
      onSortingChange: handleSortingChange,
      manualSorting,
      state: { sorting },
      initialState: { pagination: { pageIndex: 0, pageSize } },
    },
    (state) => state,
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally resets page index when sorting changes
  useEffect(() => {
    table.setPageIndex(0);
  }, [sorting]);

  // Track resize state (useMemoizedFn: no deps needed, always latest closure)
  const handleResizeStart = useMemoizedFn((headerId: string, handler: (event: unknown) => void) => {
    return (event: React.MouseEvent | React.TouchEvent) => {
      setResizingColumnId(headerId);
      handler(event);
    };
  });

  // Reset resize state
  const resetResizeState = useMemoizedFn(() => {
    if (!resizingColumnId) return;
    resetResizingColumnId();
    setGuideLinePosition(null);
  });

  // Update guide line position during resize
  useEventListener(
    'mousemove',
    (e: MouseEvent) => {
      if (!resizingColumnId || !tableContainerRef.current) return;
      const { left } = tableContainerRef.current.getBoundingClientRect();
      setGuideLinePosition(e.clientX - left);
    },
    { target: document },
  );

  useEventListener('mouseup', resetResizeState, { target: document });
  useEventListener('touchend', resetResizeState, { target: document });

  const currentPage = table.state.pagination.pageIndex;
  const totalPages = table.getPageCount();

  return (
    <div className="space-y-4">
      {/* Table */}
      <div
        ref={tableContainerRef}
        className="relative overflow-x-auto rounded-lg border border-border/50"
      >
        {/* Guide line during resize */}
        {resizingColumnId && guideLinePosition !== null && (
          <div
            className="absolute top-0 bottom-0 z-50 w-0.5 pointer-events-none"
            style={{
              left: guideLinePosition,
              background:
                'linear-gradient(180deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.5) 50%, hsl(var(--primary)) 100%)',
              boxShadow: '0 0 8px hsl(var(--primary)/0.4)',
            }}
          />
        )}
        <table
          className={cn('w-full', resizingColumnId && 'select-none')}
          style={{ minWidth: '100%', tableLayout: 'fixed' }}
        >
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border/50 bg-muted/30">
                {headerGroup.headers.map((header) => {
                  const isResizing = header.column.getIsResizing();
                  const isCurrentResizing = resizingColumnId === header.id;

                  return (
                    <th
                      key={header.id}
                      className={cn(
                        'relative px-4 py-3 text-left text-xs font-medium text-muted-foreground group',
                        !isResizing && 'transition-[width] duration-150 ease-out',
                        isCurrentResizing && 'bg-primary/5',
                      )}
                      style={{ width: header.getSize() }}
                    >
                      {/* Column highlight overlay when resizing */}
                      {isCurrentResizing && (
                        <div className="absolute inset-0 bg-primary/5 border-l-2 border-r-2 border-primary/20 pointer-events-none" />
                      )}

                      <span className="relative z-10">
                        {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                      </span>

                      {/* Enhanced column resize handle */}
                      {header.column.getCanResize() && (
                        // biome-ignore lint/a11y/noStaticElementInteractions: Resize handle is mouse-only UI
                        <div
                          onMouseDown={handleResizeStart(header.id, header.getResizeHandler())}
                          onTouchStart={handleResizeStart(header.id, header.getResizeHandler())}
                          onDoubleClick={() => header.column.resetSize()}
                          className={cn(
                            'absolute right-0 top-0 h-full w-4 cursor-col-resize select-none touch-none',
                            'flex items-center justify-center',
                            'opacity-0 group-hover:opacity-100 transition-all duration-200',
                            isResizing && 'opacity-100',
                          )}
                        >
                          {/* Handle background with gradient */}
                          <div
                            className={cn(
                              'absolute right-0 top-1 bottom-1 w-1 rounded-full transition-all duration-200',
                              'bg-gradient-to-b from-border via-muted-foreground/30 to-border',
                              'group-hover:from-primary/60 group-hover:via-primary group-hover:to-primary/60',
                              'group-hover:w-1.5 group-hover:shadow-sm',
                              isResizing &&
                                'from-primary via-primary to-primary w-1.5 shadow-md shadow-primary/30',
                            )}
                          />
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, idx) => (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-border/30 transition-colors hover:bg-muted/50',
                  idx % 2 === 0 ? 'bg-background' : 'bg-muted/10',
                )}
              >
                {row.getAllCells().map((cell) => {
                  const isColumnResizing = resizingColumnId === cell.column.id;
                  const anyResizing = resizingColumnId !== null;

                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        'px-4 py-3',
                        !anyResizing && 'transition-[width] duration-150 ease-out',
                        isColumnResizing && 'bg-primary/5',
                      )}
                      style={{ width: cell.column.getSize() }}
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-1 pt-2">
        <span className="text-xs tabular-nums text-muted-foreground/70 tracking-tight">
          {table.state.pagination.pageIndex * pageSize + 1}–
          {Math.min((table.state.pagination.pageIndex + 1) * pageSize, data.length)}{' '}
          <span className="text-muted-foreground/50">{t('Leaderboard.pagination_of')}</span>{' '}
          {data.length}
        </span>

        <div className="flex items-center gap-1">
          {/* Previous */}
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer',
              'transition-all duration-150 ease-out',
              'text-muted-foreground hover:text-foreground hover:bg-muted/60',
              'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground',
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('Leaderboard.pagination_prev')}</span>
          </button>

          {/* Page Numbers */}
          <div className="flex items-center bg-muted/30 rounded-lg p-0.5">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i;
              } else if (currentPage <= 2) {
                pageNum = i;
              } else if (currentPage >= totalPages - 3) {
                pageNum = totalPages - 5 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              const isActive = currentPage === pageNum;
              return (
                <button
                  type="button"
                  key={pageNum}
                  onClick={() => table.setPageIndex(pageNum)}
                  className={cn(
                    'relative h-7 min-w-[28px] px-2 rounded-md text-xs font-medium tabular-nums cursor-pointer',
                    'transition-all duration-150 ease-out',
                    isActive
                      ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {pageNum + 1}
                </button>
              );
            })}
          </div>

          {/* Next */}
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer',
              'transition-all duration-150 ease-out',
              'text-muted-foreground hover:text-foreground hover:bg-muted/60',
              'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground',
            )}
          >
            <span className="hidden sm:inline">{t('Leaderboard.pagination_next')}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
