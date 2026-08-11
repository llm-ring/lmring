import type { ColumnDef } from '@tanstack/react-table';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LeaderboardTableFeatures } from './table-features';

const { createMockIcon } = vi.hoisted(() => ({
  createMockIcon: (name: string) => {
    const MockIcon = ({ className }: { className?: string }) => (
      <svg data-testid={`icon-${name}`} className={className} />
    );
    MockIcon.displayName = name;
    return MockIcon;
  },
}));

vi.mock('lucide-react', () => ({
  ChevronLeft: createMockIcon('ChevronLeft'),
  ChevronRight: createMockIcon('ChevronRight'),
}));

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string) => key,
}));

type TestData = {
  id: number;
  name: string;
  score: number;
};

const testColumns: ColumnDef<LeaderboardTableFeatures, TestData>[] = [
  {
    accessorKey: 'id',
    header: () => <span>ID</span>,
    cell: ({ row }) => row.original.id,
  },
  {
    accessorKey: 'name',
    header: () => <span>Name</span>,
    cell: ({ row }) => row.original.name,
  },
  {
    accessorKey: 'score',
    header: () => <span>Score</span>,
    cell: ({ row }) => row.original.score,
  },
];

const testData: TestData[] = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  name: `Model ${i + 1}`,
  score: 100 - i,
}));

describe('DataTable', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render table with columns', async () => {
    const { DataTable } = await import('./DataTable');
    render(<DataTable columns={testColumns} data={testData} />);
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Score')).toBeInTheDocument();
  });

  it('should render data rows', async () => {
    const { DataTable } = await import('./DataTable');
    render(<DataTable columns={testColumns} data={testData} pageSize={10} />);
    expect(screen.getByText('Model 1')).toBeInTheDocument();
    expect(screen.getByText('Model 10')).toBeInTheDocument();
  });

  it('should show pagination info', async () => {
    const { DataTable } = await import('./DataTable');
    render(<DataTable columns={testColumns} data={testData} pageSize={10} />);
    expect(screen.getByText(/1–10/)).toBeInTheDocument();
    expect(screen.getByText('Leaderboard.pagination_of')).toBeInTheDocument();
  });

  it('should navigate to next page', async () => {
    const { DataTable } = await import('./DataTable');
    render(<DataTable columns={testColumns} data={testData} pageSize={10} />);

    const nextButton = screen.getByText('Leaderboard.pagination_next');
    fireEvent.click(nextButton);

    expect(screen.getByText('Model 11')).toBeInTheDocument();
    expect(screen.getByText(/11–20/)).toBeInTheDocument();
  });

  it('should navigate to previous page', async () => {
    const { DataTable } = await import('./DataTable');
    render(<DataTable columns={testColumns} data={testData} pageSize={10} />);

    const nextButton = screen.getByText('Leaderboard.pagination_next');
    fireEvent.click(nextButton);

    const prevButton = screen.getByText('Leaderboard.pagination_prev');
    fireEvent.click(prevButton);

    expect(screen.getByText('Model 1')).toBeInTheDocument();
  });

  it('should disable previous button on first page', async () => {
    const { DataTable } = await import('./DataTable');
    render(<DataTable columns={testColumns} data={testData} pageSize={10} />);

    const prevButton = screen.getByText('Leaderboard.pagination_prev').closest('button');
    expect(prevButton).toBeDisabled();
  });

  it('should navigate to specific page', async () => {
    const { DataTable } = await import('./DataTable');
    render(<DataTable columns={testColumns} data={testData} pageSize={10} />);

    const pageButton = screen.getByRole('button', { name: '2' });
    fireEvent.click(pageButton);

    expect(screen.getByText('Model 11')).toBeInTheDocument();
  });

  it('should use default page size of 20', async () => {
    const { DataTable } = await import('./DataTable');
    render(<DataTable columns={testColumns} data={testData} />);
    expect(screen.getByText(/1–20/)).toBeInTheDocument();
  });

  it('should render empty table when no data', async () => {
    const { DataTable } = await import('./DataTable');
    const { container } = render(<DataTable columns={testColumns} data={[]} />);
    const tbody = container.querySelector('tbody');
    expect(tbody?.children).toHaveLength(0);
  });

  it('should render table with rounded border', async () => {
    const { DataTable } = await import('./DataTable');
    const { container } = render(<DataTable columns={testColumns} data={testData} />);
    const tableContainer = container.querySelector('.rounded-lg');
    expect(tableContainer).toBeInTheDocument();
  });

  it('should respect controlled sorting state', async () => {
    const { DataTable } = await import('./DataTable');

    render(
      <DataTable
        columns={testColumns}
        data={testData.slice(0, 3)}
        sorting={[{ id: 'score', desc: false }]}
      />,
    );

    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Model 3');
    expect(rows[2]).toHaveTextContent('Model 2');
    expect(rows[3]).toHaveTextContent('Model 1');
  });

  it('should reset to first page when sorting changes', async () => {
    const { DataTable } = await import('./DataTable');

    const { rerender } = render(
      <DataTable
        columns={testColumns}
        data={testData}
        pageSize={10}
        sorting={[{ id: 'score', desc: false }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText('Model 15')).toBeInTheDocument();

    rerender(
      <DataTable
        columns={testColumns}
        data={testData}
        pageSize={10}
        sorting={[{ id: 'score', desc: true }]}
      />,
    );

    expect(screen.getByText('Model 1')).toBeInTheDocument();
    expect(screen.queryByText('Model 11')).not.toBeInTheDocument();
  });

  it('should preserve provided row order in manual sorting mode', async () => {
    const { DataTable } = await import('./DataTable');

    render(
      <DataTable
        columns={testColumns}
        data={[
          { id: 72, name: 'Model 72', score: 84 },
          { id: 1, name: 'Model 1', score: 99 },
          { id: 2, name: 'Model 2', score: 98 },
        ]}
        sorting={[{ id: 'score', desc: true }]}
        manualSorting
      />,
    );

    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Model 72');
    expect(rows[2]).toHaveTextContent('Model 1');
    expect(rows[3]).toHaveTextContent('Model 2');
  });
});
