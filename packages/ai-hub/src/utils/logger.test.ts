import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger, LogLevel, logger } from './logger';

function firstWriterArg(writer: ReturnType<typeof vi.fn>): string {
  const arg = writer.mock.calls[0]?.[0];
  expect(arg).toBeDefined();
  return String(arg);
}

describe('Logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('respects log level filtering', () => {
    const writer = vi.fn();
    const log = new Logger({ level: LogLevel.WARN, writer, colors: false, timestamp: false });

    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');

    expect(writer).toHaveBeenCalledTimes(2);
    expect(String(writer.mock.calls[0]?.[0])).toContain('w');
    expect(String(writer.mock.calls[1]?.[0])).toContain('e');
  });

  it('formats with timestamp, prefix, and object data', () => {
    const writer = vi.fn();
    const log = new Logger({
      level: LogLevel.DEBUG,
      prefix: 'test',
      timestamp: true,
      colors: false,
      writer,
    });

    log.info('hello', { a: 1 });
    const message = firstWriterArg(writer);
    expect(message).toMatch(/\[\d{4}-/);
    expect(message).toContain('[test]');
    expect(message).toContain('[INFO]');
    expect(message).toContain('hello');
    expect(message).toContain('"a": 1');
  });

  it('formats non-object data as string', () => {
    const writer = vi.fn();
    const log = new Logger({ level: LogLevel.DEBUG, writer, colors: false, timestamp: false });
    log.debug('n', 42);
    expect(firstWriterArg(writer)).toContain('42');
  });

  it('uses console methods when writer is not provided', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const log = new Logger({ level: LogLevel.DEBUG, colors: false, timestamp: false });
    log.error('e');
    log.warn('w');
    log.debug('d');
    log.info('i');

    expect(errorSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });

  it('setLevel and getLevel work', () => {
    const log = new Logger({ level: LogLevel.INFO });
    expect(log.getLevel()).toBe(LogLevel.INFO);
    log.setLevel(LogLevel.ERROR);
    expect(log.getLevel()).toBe(LogLevel.ERROR);
  });

  it('child inherits options and nests prefix', () => {
    const writer = vi.fn();
    const parent = new Logger({
      level: LogLevel.INFO,
      prefix: 'parent',
      writer,
      colors: false,
      timestamp: false,
    });
    const child = parent.child('child');
    child.info('msg');
    expect(firstWriterArg(writer)).toContain('[parent:child]');
  });

  it('child without parent prefix uses only child prefix', () => {
    const writer = vi.fn();
    const parent = new Logger({ level: LogLevel.INFO, writer, colors: false, timestamp: false });
    parent.child('only').info('msg');
    expect(firstWriterArg(writer)).toContain('[only]');
  });

  it('exports global logger instance', () => {
    expect(logger).toBeInstanceOf(Logger);
    expect(logger.getLevel()).toBe(LogLevel.INFO);
  });

  it('colorizes when colors enabled and stdout is TTY', () => {
    const writer = vi.fn();
    const original = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

    const log = new Logger({
      level: LogLevel.DEBUG,
      writer,
      colors: true,
      timestamp: false,
    });
    log.warn('colored');
    expect(firstWriterArg(writer)).toContain('\x1b[');

    Object.defineProperty(process.stdout, 'isTTY', { value: original, configurable: true });
  });
});
