import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LeaderboardModel } from './types';

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
  CheckIcon: createMockIcon('CheckIcon'),
  XIcon: createMockIcon('XIcon'),
  LockIcon: createMockIcon('LockIcon'),
  UnlockIcon: createMockIcon('UnlockIcon'),
  ChevronDown: createMockIcon('ChevronDown'),
  ChevronUp: createMockIcon('ChevronUp'),
}));

vi.mock('@/components/arena/provider-icon', () => ({
  ProviderIcon: ({ providerId }: { providerId: string }) => (
    <div data-testid="provider-icon" data-provider-id={providerId} />
  ),
}));

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/libs/zeroeval-api', () => ({
  formatMetricValue: (value: number | null, format: string) => {
    if (value === null) return '—';
    if (format === 'percentage') return `${(value * 100).toFixed(1)}%`;
    return String(value);
  },
  getNumericValue: (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') return -Infinity;
    if (typeof value === 'number') return value;
    const numericValue = parseFloat(value);
    return Number.isNaN(numericValue) ? -Infinity : numericValue;
  },
}));

const mockT = (key: string) => key;

const mockModel: LeaderboardModel = {
  model_id: 'test-model-1',
  name: 'Test Model',
  organization: 'Test Org',
  organization_id: 'test-org',
  release_date: '2024-01-01',
  announcement_date: '2024-01-01',
  multimodal: false,
  license: 'MIT',
  rank: 1,
  isNew: false,
  knowledge_cutoff: '2024-01',
};

type ColumnWithAccessorKey = { accessorKey?: string; cell?: unknown };

describe('createBaseColumns', () => {
  afterEach(() => {
    cleanup();
  });

  it('should create rank and name columns', async () => {
    const { createBaseColumns } = await import('./columns');
    const columns = createBaseColumns(mockT) as ColumnWithAccessorKey[];
    expect(columns).toHaveLength(2);
    expect(columns[0]?.accessorKey).toBe('rank');
    expect(columns[1]?.accessorKey).toBe('name');
  });

  it('should render rank cell with gold styling for rank 1', async () => {
    const { createBaseColumns } = await import('./columns');
    const columns = createBaseColumns(mockT);
    // biome-ignore lint/style/noNonNullAssertion: Test knows array has elements
    const rankColumn = columns[0]!;
    const CellComponent = rankColumn.cell as unknown as React.FC<{
      row: { original: LeaderboardModel };
    }>;
    const { container } = render(<CellComponent row={{ original: { ...mockModel, rank: 1 } }} />);
    const rankDiv = container.querySelector('div');
    expect(rankDiv).toHaveClass('from-yellow-400');
  });

  it('should render rank cell with silver styling for rank 2', async () => {
    const { createBaseColumns } = await import('./columns');
    const columns = createBaseColumns(mockT);
    // biome-ignore lint/style/noNonNullAssertion: Test knows array has elements
    const rankColumn = columns[0]!;
    const CellComponent = rankColumn.cell as unknown as React.FC<{
      row: { original: LeaderboardModel };
    }>;
    const { container } = render(<CellComponent row={{ original: { ...mockModel, rank: 2 } }} />);
    const rankDiv = container.querySelector('div');
    expect(rankDiv).toHaveClass('from-gray-300');
  });

  it('should render rank cell with bronze styling for rank 3', async () => {
    const { createBaseColumns } = await import('./columns');
    const columns = createBaseColumns(mockT);
    // biome-ignore lint/style/noNonNullAssertion: Test knows array has elements
    const rankColumn = columns[0]!;
    const CellComponent = rankColumn.cell as unknown as React.FC<{
      row: { original: LeaderboardModel };
    }>;
    const { container } = render(<CellComponent row={{ original: { ...mockModel, rank: 3 } }} />);
    const rankDiv = container.querySelector('div');
    expect(rankDiv).toHaveClass('from-amber-500');
  });

  it('should render rank cell with plain text for rank 4+', async () => {
    const { createBaseColumns } = await import('./columns');
    const columns = createBaseColumns(mockT);
    // biome-ignore lint/style/noNonNullAssertion: Test knows array has elements
    const rankColumn = columns[0]!;
    const CellComponent = rankColumn.cell as unknown as React.FC<{
      row: { original: LeaderboardModel };
    }>;
    const { container } = render(<CellComponent row={{ original: { ...mockModel, rank: 4 } }} />);
    const rankSpan = container.querySelector('span');
    expect(rankSpan).toHaveTextContent('4');
  });

  it('should render model cell with provider icon and name', async () => {
    const { createBaseColumns } = await import('./columns');
    const columns = createBaseColumns(mockT);
    // biome-ignore lint/style/noNonNullAssertion: Test knows array has elements
    const nameColumn = columns[1]!;
    const CellComponent = nameColumn.cell as unknown as React.FC<{
      row: { original: LeaderboardModel };
    }>;
    render(<CellComponent row={{ original: mockModel }} />);
    expect(screen.getByTestId('provider-icon')).toBeInTheDocument();
    expect(screen.getByText('Test Model')).toBeInTheDocument();
    expect(screen.getByText('Test Org')).toBeInTheDocument();
  });

  it('should show new badge for new models', async () => {
    const { createBaseColumns } = await import('./columns');
    const columns = createBaseColumns(mockT);
    // biome-ignore lint/style/noNonNullAssertion: Test knows array has elements
    const nameColumn = columns[1]!;
    const CellComponent = nameColumn.cell as unknown as React.FC<{
      row: { original: LeaderboardModel };
    }>;
    render(<CellComponent row={{ original: { ...mockModel, isNew: true } }} />);
    expect(screen.getByText('Leaderboard.table_new')).toBeInTheDocument();
  });
});

describe('createMetricColumns', () => {
  afterEach(() => {
    cleanup();
  });

  it('should create columns for each metric', async () => {
    const { createMetricColumns } = await import('./columns');
    const metrics = [
      {
        id: 'gpqa',
        field: 'gpqa_score',
        label: 'GPQA',
        format: 'percentage' as const,
        higherIsBetter: true,
      },
      {
        id: 'hle',
        field: 'hle_score',
        label: 'HLE',
        format: 'percentage' as const,
        higherIsBetter: true,
      },
    ];
    const columns = createMetricColumns(metrics, mockT) as ColumnWithAccessorKey[];
    expect(columns).toHaveLength(2);
    expect(columns[0]?.accessorKey).toBe('gpqa_score');
    expect(columns[1]?.accessorKey).toBe('hle_score');
  });
});

describe('createTrailingColumns', () => {
  afterEach(() => {
    cleanup();
  });

  it('should create cutoff, multimodal, and license columns', async () => {
    const { createTrailingColumns } = await import('./columns');
    const columns = createTrailingColumns(mockT) as ColumnWithAccessorKey[];
    expect(columns).toHaveLength(3);
    expect(columns[0]?.accessorKey).toBe('knowledge_cutoff');
    expect(columns[1]?.accessorKey).toBe('multimodal');
    expect(columns[2]?.accessorKey).toBe('license');
  });

  it('should render multimodal check icon when supported', async () => {
    const { createTrailingColumns } = await import('./columns');
    const columns = createTrailingColumns(mockT);
    // biome-ignore lint/style/noNonNullAssertion: Test knows array has elements
    const multimodalColumn = columns[1]!;
    const CellComponent = multimodalColumn.cell as unknown as React.FC<{
      row: { original: LeaderboardModel };
    }>;
    render(<CellComponent row={{ original: { ...mockModel, multimodal: true } }} />);
    expect(screen.getByTestId('icon-CheckIcon')).toBeInTheDocument();
  });

  it('should render multimodal X icon when not supported', async () => {
    const { createTrailingColumns } = await import('./columns');
    const columns = createTrailingColumns(mockT);
    // biome-ignore lint/style/noNonNullAssertion: Test knows array has elements
    const multimodalColumn = columns[1]!;
    const CellComponent = multimodalColumn.cell as unknown as React.FC<{
      row: { original: LeaderboardModel };
    }>;
    render(<CellComponent row={{ original: { ...mockModel, multimodal: false } }} />);
    expect(screen.getByTestId('icon-XIcon')).toBeInTheDocument();
  });

  it('should render license cell with unlock icon for open license', async () => {
    const { createTrailingColumns } = await import('./columns');
    const columns = createTrailingColumns(mockT);
    // biome-ignore lint/style/noNonNullAssertion: Test knows array has elements
    const licenseColumn = columns[2]!;
    const CellComponent = licenseColumn.cell as unknown as React.FC<{
      row: { original: LeaderboardModel };
    }>;
    render(<CellComponent row={{ original: { ...mockModel, license: 'MIT' } }} />);
    expect(screen.getByTestId('icon-UnlockIcon')).toBeInTheDocument();
  });

  it('should render license cell with lock icon for proprietary license', async () => {
    const { createTrailingColumns } = await import('./columns');
    const columns = createTrailingColumns(mockT);
    // biome-ignore lint/style/noNonNullAssertion: Test knows array has elements
    const licenseColumn = columns[2]!;
    const CellComponent = licenseColumn.cell as unknown as React.FC<{
      row: { original: LeaderboardModel };
    }>;
    render(<CellComponent row={{ original: { ...mockModel, license: 'proprietary' } }} />);
    expect(screen.getByTestId('icon-LockIcon')).toBeInTheDocument();
  });

  it('should truncate long license names', async () => {
    const { createTrailingColumns } = await import('./columns');
    const columns = createTrailingColumns(mockT);
    // biome-ignore lint/style/noNonNullAssertion: Test knows array has elements
    const licenseColumn = columns[2]!;
    const CellComponent = licenseColumn.cell as unknown as React.FC<{
      row: { original: LeaderboardModel };
    }>;
    render(
      <CellComponent
        row={{ original: { ...mockModel, license: 'Apache 2.0 with Commons Clause' } }}
      />,
    );
    expect(screen.getByText('Apache 2.0...')).toBeInTheDocument();
  });
});

describe('ScoreCell', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render formatted value with formatMetricValue', async () => {
    const { createMetricColumns } = await import('./columns');
    const metrics = [
      {
        id: 'gpqa',
        field: 'gpqa_score',
        label: 'GPQA',
        format: 'percentage' as const,
        higherIsBetter: true,
      },
    ];
    const columns = createMetricColumns(metrics, mockT);
    // biome-ignore lint/style/noNonNullAssertion: test - column existence verified
    const metricColumn = columns[0]!;
    const CellComponent = metricColumn.cell as unknown as React.FC<{
      row: { original: LeaderboardModel & { gpqa_score: number } };
    }>;
    render(<CellComponent row={{ original: { ...mockModel, gpqa_score: 0.75 } }} />);
    expect(screen.getByText('75.0%')).toBeInTheDocument();
  });

  it('should apply highlight styling when value >= 0.8 AND highlight=true', async () => {
    const { createMetricColumns } = await import('./columns');
    const metrics = [
      {
        id: 'gpqa',
        field: 'gpqa_score',
        label: 'GPQA',
        format: 'percentage' as const,
        higherIsBetter: true,
      },
    ];
    const columns = createMetricColumns(metrics, mockT);
    // biome-ignore lint/style/noNonNullAssertion: test - column existence verified
    const metricColumn = columns[0]!;
    const CellComponent = metricColumn.cell as unknown as React.FC<{
      row: { original: LeaderboardModel & { gpqa_score: number } };
    }>;
    const { container } = render(
      <CellComponent row={{ original: { ...mockModel, gpqa_score: 0.85 } }} />,
    );
    const span = container.querySelector('span');
    expect(span).toHaveClass('text-emerald-600');
    expect(span).toHaveClass('font-semibold');
  });

  it('should NOT apply highlight when value < 0.8', async () => {
    const { createMetricColumns } = await import('./columns');
    const metrics = [
      {
        id: 'gpqa',
        field: 'gpqa_score',
        label: 'GPQA',
        format: 'percentage' as const,
        higherIsBetter: true,
      },
    ];
    const columns = createMetricColumns(metrics, mockT);
    // biome-ignore lint/style/noNonNullAssertion: test - column existence verified
    const metricColumn = columns[0]!;
    const CellComponent = metricColumn.cell as unknown as React.FC<{
      row: { original: LeaderboardModel & { gpqa_score: number } };
    }>;
    const { container } = render(
      <CellComponent row={{ original: { ...mockModel, gpqa_score: 0.7 } }} />,
    );
    const span = container.querySelector('span');
    expect(span).not.toHaveClass('text-emerald-600');
    expect(span).not.toHaveClass('font-semibold');
  });

  it('should NOT apply highlight when highlight=false (higherIsBetter=false)', async () => {
    const { createMetricColumns } = await import('./columns');
    const metrics = [
      {
        id: 'gpqa',
        field: 'gpqa_score',
        label: 'GPQA',
        format: 'percentage' as const,
        higherIsBetter: false,
      },
    ];
    const columns = createMetricColumns(metrics, mockT);
    // biome-ignore lint/style/noNonNullAssertion: test - column existence verified
    const metricColumn = columns[0]!;
    const CellComponent = metricColumn.cell as unknown as React.FC<{
      row: { original: LeaderboardModel & { gpqa_score: number } };
    }>;
    const { container } = render(
      <CellComponent row={{ original: { ...mockModel, gpqa_score: 0.95 } }} />,
    );
    const span = container.querySelector('span');
    expect(span).not.toHaveClass('text-emerald-600');
    expect(span).not.toHaveClass('font-semibold');
  });

  it('should render "—" for null values', async () => {
    const { createMetricColumns } = await import('./columns');
    const metrics = [
      {
        id: 'gpqa',
        field: 'gpqa_score',
        label: 'GPQA',
        format: 'percentage' as const,
        higherIsBetter: true,
      },
    ];
    const columns = createMetricColumns(metrics, mockT);
    // biome-ignore lint/style/noNonNullAssertion: test - column existence verified
    const metricColumn = columns[0]!;
    const CellComponent = metricColumn.cell as unknown as React.FC<{
      row: { original: LeaderboardModel & { gpqa_score: null } };
    }>;
    render(<CellComponent row={{ original: { ...mockModel, gpqa_score: null } }} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
  it('should push empty string values after numeric values when sorting', async () => {
    const { createMetricColumns } = await import('./columns');
    const metrics = [
      {
        id: 'input_price',
        field: 'input_price',
        label: 'Input $/M',
        format: 'currency' as const,
        higherIsBetter: false,
      },
    ];
    const columns = createMetricColumns(metrics, mockT);
    // biome-ignore lint/style/noNonNullAssertion: test - column existence verified
    const metricColumn = columns[0]!;
    const sortingFn = metricColumn.sortFn as unknown as (
      rowA: { original: LeaderboardModel & { input_price: string } },
      rowB: { original: LeaderboardModel & { input_price: string } },
    ) => number;

    const comparison = sortingFn(
      { original: { ...mockModel, input_price: '' } },
      { original: { ...mockModel, model_id: 'test-model-2', input_price: '1.50' } },
    );

    expect(comparison).toBeGreaterThan(0);
  });
});

describe('SortableHeader', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render label text', async () => {
    const { createMetricColumns } = await import('./columns');
    const metrics = [
      {
        id: 'gpqa',
        field: 'gpqa_score',
        label: 'GPQA Score',
        format: 'percentage' as const,
        higherIsBetter: true,
      },
    ];
    const columns = createMetricColumns(metrics, mockT);
    // biome-ignore lint/style/noNonNullAssertion: test - column existence verified
    const metricColumn = columns[0]!;
    const mockColumn = {
      getIsSorted: () => false as false | 'asc' | 'desc',
      toggleSorting: vi.fn(),
      clearSorting: vi.fn(),
    };
    const HeaderComponent = metricColumn.header as unknown as React.FC<{
      column: typeof mockColumn;
    }>;
    render(<HeaderComponent column={mockColumn} />);
    expect(screen.getByText('GPQA Score')).toBeInTheDocument();
  });

  it('should show no icon when not sorted', async () => {
    const { createMetricColumns } = await import('./columns');
    const metrics = [
      {
        id: 'gpqa',
        field: 'gpqa_score',
        label: 'GPQA',
        format: 'percentage' as const,
        higherIsBetter: true,
      },
    ];
    const columns = createMetricColumns(metrics, mockT);
    // biome-ignore lint/style/noNonNullAssertion: test - column existence verified
    const metricColumn = columns[0]!;
    const mockColumn = {
      getIsSorted: () => false as false | 'asc' | 'desc',
      toggleSorting: vi.fn(),
      clearSorting: vi.fn(),
    };
    const HeaderComponent = metricColumn.header as unknown as React.FC<{
      column: typeof mockColumn;
    }>;
    render(<HeaderComponent column={mockColumn} />);
    expect(screen.queryByTestId('icon-ChevronDown')).not.toBeInTheDocument();
    expect(screen.queryByTestId('icon-ChevronUp')).not.toBeInTheDocument();
  });

  it('should show ChevronDown when sorted === desc', async () => {
    const { createMetricColumns } = await import('./columns');
    const metrics = [
      {
        id: 'gpqa',
        field: 'gpqa_score',
        label: 'GPQA',
        format: 'percentage' as const,
        higherIsBetter: true,
      },
    ];
    const columns = createMetricColumns(metrics, mockT);
    // biome-ignore lint/style/noNonNullAssertion: test - column existence verified
    const metricColumn = columns[0]!;
    const mockColumn = {
      getIsSorted: () => 'desc' as false | 'asc' | 'desc',
      toggleSorting: vi.fn(),
      clearSorting: vi.fn(),
    };
    const HeaderComponent = metricColumn.header as unknown as React.FC<{
      column: typeof mockColumn;
    }>;
    render(<HeaderComponent column={mockColumn} />);
    expect(screen.getByTestId('icon-ChevronDown')).toBeInTheDocument();
  });

  it('should show ChevronUp when sorted === asc', async () => {
    const { createMetricColumns } = await import('./columns');
    const metrics = [
      {
        id: 'gpqa',
        field: 'gpqa_score',
        label: 'GPQA',
        format: 'percentage' as const,
        higherIsBetter: true,
      },
    ];
    const columns = createMetricColumns(metrics, mockT);
    // biome-ignore lint/style/noNonNullAssertion: test - column existence verified
    const metricColumn = columns[0]!;
    const mockColumn = {
      getIsSorted: () => 'asc' as false | 'asc' | 'desc',
      toggleSorting: vi.fn(),
      clearSorting: vi.fn(),
    };
    const HeaderComponent = metricColumn.header as unknown as React.FC<{
      column: typeof mockColumn;
    }>;
    render(<HeaderComponent column={mockColumn} />);
    expect(screen.getByTestId('icon-ChevronUp')).toBeInTheDocument();
  });

  it('should call toggleSorting(true) on click when not sorted', async () => {
    const { createMetricColumns } = await import('./columns');
    const { fireEvent } = await import('@testing-library/react');
    const metrics = [
      {
        id: 'gpqa',
        field: 'gpqa_score',
        label: 'GPQA',
        format: 'percentage' as const,
        higherIsBetter: true,
      },
    ];
    const columns = createMetricColumns(metrics, mockT);
    // biome-ignore lint/style/noNonNullAssertion: test - column existence verified
    const metricColumn = columns[0]!;
    const mockColumn = {
      getIsSorted: () => false as false | 'asc' | 'desc',
      toggleSorting: vi.fn(),
      clearSorting: vi.fn(),
    };
    const HeaderComponent = metricColumn.header as unknown as React.FC<{
      column: typeof mockColumn;
    }>;
    render(<HeaderComponent column={mockColumn} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockColumn.toggleSorting).toHaveBeenCalledWith(true);
  });

  it('should call toggleSorting(false) on click when sorted desc', async () => {
    const { createMetricColumns } = await import('./columns');
    const { fireEvent } = await import('@testing-library/react');
    const metrics = [
      {
        id: 'gpqa',
        field: 'gpqa_score',
        label: 'GPQA',
        format: 'percentage' as const,
        higherIsBetter: true,
      },
    ];
    const columns = createMetricColumns(metrics, mockT);
    // biome-ignore lint/style/noNonNullAssertion: test - column existence verified
    const metricColumn = columns[0]!;
    const mockColumn = {
      getIsSorted: () => 'desc' as false | 'asc' | 'desc',
      toggleSorting: vi.fn(),
      clearSorting: vi.fn(),
    };
    const HeaderComponent = metricColumn.header as unknown as React.FC<{
      column: typeof mockColumn;
    }>;
    render(<HeaderComponent column={mockColumn} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockColumn.toggleSorting).toHaveBeenCalledWith(false);
  });

  it('should call clearSorting() on click when sorted asc', async () => {
    const { createMetricColumns } = await import('./columns');
    const { fireEvent } = await import('@testing-library/react');
    const metrics = [
      {
        id: 'gpqa',
        field: 'gpqa_score',
        label: 'GPQA',
        format: 'percentage' as const,
        higherIsBetter: true,
      },
    ];
    const columns = createMetricColumns(metrics, mockT);
    // biome-ignore lint/style/noNonNullAssertion: test - column existence verified
    const metricColumn = columns[0]!;
    const mockColumn = {
      getIsSorted: () => 'asc' as false | 'asc' | 'desc',
      toggleSorting: vi.fn(),
      clearSorting: vi.fn(),
    };
    const HeaderComponent = metricColumn.header as unknown as React.FC<{
      column: typeof mockColumn;
    }>;
    render(<HeaderComponent column={mockColumn} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockColumn.clearSorting).toHaveBeenCalled();
  });
});
