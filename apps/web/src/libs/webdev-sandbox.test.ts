import { describe, expect, it, vi } from 'vitest';
import { waitForPortReady } from './webdev-sandbox';

describe('waitForPortReady', () => {
  it('resolves when curl probe exits 0', async () => {
    const runCommand = vi.fn().mockResolvedValue({ exitCode: 0 });
    const sandbox = { runCommand } as unknown as Parameters<typeof waitForPortReady>[0];

    await expect(waitForPortReady(sandbox, 5173, 1000)).resolves.toBeUndefined();

    expect(runCommand).toHaveBeenCalledWith({
      cmd: 'bash',
      args: ['-c', expect.stringContaining('http://localhost:5173')],
    });
    const firstCall = runCommand.mock.calls[0]?.[0] as { args: string[] } | undefined;
    const loop = firstCall?.args[1];
    expect(loop).toContain('seq 1 2'); // 1000/500 = 2 attempts
  });

  it('throws when port is never ready', async () => {
    const runCommand = vi.fn().mockResolvedValue({ exitCode: 1 });
    const sandbox = { runCommand } as unknown as Parameters<typeof waitForPortReady>[0];

    await expect(waitForPortReady(sandbox, 3000, 500)).rejects.toThrow(
      'Dev server is not listening on port 3000 after 0.5s',
    );
  });

  it('uses at least 1 attempt for tiny timeouts', async () => {
    const runCommand = vi.fn().mockResolvedValue({ exitCode: 0 });
    const sandbox = { runCommand } as unknown as Parameters<typeof waitForPortReady>[0];

    await waitForPortReady(sandbox, 8080, 1);
    const firstCall = runCommand.mock.calls[0]?.[0] as { args: string[] } | undefined;
    const loop = firstCall?.args[1];
    expect(loop).toContain('seq 1 1');
  });
});
