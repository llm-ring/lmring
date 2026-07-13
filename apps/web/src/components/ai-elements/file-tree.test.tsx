import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  FileTree,
  FileTreeActions,
  FileTreeFile,
  FileTreeFolder,
  FileTreeIcon,
  FileTreeName,
} from './file-tree';

describe('FileTree', () => {
  it('renders nested folders and files and selects paths', () => {
    const onSelect = vi.fn();
    const onExpandedChange = vi.fn();

    render(
      <FileTree
        defaultExpanded={new Set(['src'])}
        selectedPath="src/App.tsx"
        onSelect={onSelect}
        onExpandedChange={onExpandedChange}
      >
        <FileTreeFolder path="src" name="src">
          <FileTreeFile path="src/App.tsx" name="App.tsx" />
          <FileTreeFile path="src/index.ts" name="index.ts" />
        </FileTreeFolder>
      </FileTree>,
    );

    expect(screen.getByText('App.tsx')).toBeTruthy();
    fireEvent.click(screen.getByText('index.ts'));
    expect(onSelect).toHaveBeenCalledWith('src/index.ts');

    // toggle folder closed
    fireEvent.click(screen.getByText('src'));
    expect(onExpandedChange).toHaveBeenCalled();
  });

  it('supports controlled expansion and keyboard selection', () => {
    const onSelect = vi.fn();
    const expanded = new Set<string>(['src']);

    render(
      <FileTree expanded={expanded} onSelect={onSelect}>
        <FileTreeFolder path="src" name="src">
          <FileTreeFile path="src/main.ts" name="main.ts">
            <FileTreeIcon data-testid="custom-icon">I</FileTreeIcon>
            <FileTreeName>main.ts</FileTreeName>
            <FileTreeActions>
              <button type="button">more</button>
            </FileTreeActions>
          </FileTreeFile>
        </FileTreeFolder>
      </FileTree>,
    );

    const file = screen.getByRole('treeitem');
    fireEvent.keyDown(file, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('src/main.ts');
    fireEvent.keyDown(file, { key: ' ' });
    expect(onSelect).toHaveBeenCalledTimes(2);

    // actions stop propagation
    fireEvent.click(screen.getByText('more'));
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('uses custom file icon when provided', () => {
    render(
      <FileTree>
        <FileTreeFile path="a.ts" name="a.ts" icon={<span data-testid="icon">*</span>} />
      </FileTree>,
    );
    expect(screen.getByTestId('icon')).toBeTruthy();
  });

  it('toggles expansion open/closed and selects folders', () => {
    const onSelect = vi.fn();
    const onExpandedChange = vi.fn();

    render(
      <FileTree onSelect={onSelect} onExpandedChange={onExpandedChange}>
        <FileTreeFolder path="lib" name="lib">
          <FileTreeFile path="lib/a.ts" name="a.ts" />
        </FileTreeFolder>
      </FileTree>,
    );

    // folder starts collapsed — open it
    fireEvent.click(screen.getByText('lib'));
    expect(onSelect).toHaveBeenCalledWith('lib');
    expect(onExpandedChange).toHaveBeenCalledWith(expect.any(Set));
    const opened = onExpandedChange.mock.calls.at(-1)?.[0] as Set<string>;
    expect(opened.has('lib')).toBe(true);

    // close it
    fireEvent.click(screen.getByText('lib'));
    const closed = onExpandedChange.mock.calls.at(-1)?.[0] as Set<string>;
    expect(closed.has('lib')).toBe(false);
  });

  it('highlights selected folder and ignores unrelated keydowns on files', () => {
    const onSelect = vi.fn();
    render(
      <FileTree selectedPath="docs" onSelect={onSelect} defaultExpanded={new Set(['docs'])}>
        <FileTreeFolder path="docs" name="docs">
          <FileTreeFile path="docs/readme.md" name="readme.md" />
        </FileTreeFolder>
      </FileTree>,
    );

    const file = screen.getByRole('treeitem');
    fireEvent.keyDown(file, { key: 'Escape' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('stops keyboard propagation on FileTreeActions toolbar', () => {
    const onSelect = vi.fn();
    render(
      <FileTree onSelect={onSelect}>
        <FileTreeFile path="x.ts" name="x.ts">
          <FileTreeActions>
            <button type="button">act</button>
          </FileTreeActions>
        </FileTreeFile>
      </FileTree>,
    );

    fireEvent.keyDown(screen.getByRole('toolbar'), { key: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
