import { describe, expect, it } from 'vitest';
import { buildFileTree, getAllFolderPaths, getLanguageFromPath } from './file-tree-utils';

describe('file-tree-utils', () => {
  it('builds a sorted nested tree without duplicating shared folders', () => {
    expect(buildFileTree(['z.txt', 'src/utils/b.ts', 'src/App.tsx', 'src/utils/a.ts'])).toEqual([
      {
        name: 'src',
        path: 'src',
        type: 'folder',
        children: [
          {
            name: 'utils',
            path: 'src/utils',
            type: 'folder',
            children: [
              { name: 'a.ts', path: 'src/utils/a.ts', type: 'file' },
              { name: 'b.ts', path: 'src/utils/b.ts', type: 'file' },
            ],
          },
          { name: 'App.tsx', path: 'src/App.tsx', type: 'file' },
        ],
      },
      { name: 'z.txt', path: 'z.txt', type: 'file' },
    ]);
  });

  it('returns every parent folder path once', () => {
    expect(getAllFolderPaths(['src/components/App.tsx', 'src/index.ts', 'README.md'])).toEqual(
      new Set(['src', 'src/components']),
    );
  });

  it.each([
    ['index.TS', 'typescript'],
    ['component.tsx', 'tsx'],
    ['script.js', 'javascript'],
    ['component.jsx', 'jsx'],
    ['package.json', 'json'],
    ['styles.css', 'css'],
    ['index.html', 'html'],
    ['README.md', 'markdown'],
    ['config.yaml', 'yaml'],
    ['config.yml', 'yaml'],
    ['icon.svg', 'xml'],
    ['document.xml', 'xml'],
    ['setup.sh', 'bash'],
    ['setup.bash', 'bash'],
    ['main.py', 'python'],
    ['lib.rs', 'rust'],
    ['main.go', 'go'],
    ['query.sql', 'sql'],
    ['Cargo.toml', 'toml'],
    ['Dockerfile', 'text'],
    ['unknown.xyz', 'text'],
  ])('maps %s to %s syntax highlighting', (path, language) => {
    expect(getLanguageFromPath(path)).toBe(language);
  });
});
