import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Reasoning, ReasoningContent, ReasoningTrigger } from './reasoning';

describe('Reasoning', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders children inside the collapsible shell', () => {
    render(
      <Reasoning>
        <div data-testid="child">content</div>
      </Reasoning>,
    );
    expect(screen.getByTestId('child')).toHaveTextContent('content');
  });

  it('shows default thought message when not streaming', () => {
    render(
      <Reasoning isStreaming={false}>
        <ReasoningTrigger />
      </Reasoning>,
    );
    expect(screen.getByText('Thought for a few seconds')).toBeInTheDocument();
  });

  it('shows thinking shimmer while streaming', () => {
    render(
      <Reasoning isStreaming>
        <ReasoningTrigger />
      </Reasoning>,
    );
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
  });

  it('allows custom trigger children', () => {
    render(
      <Reasoning>
        <ReasoningTrigger>
          <span>Custom trigger</span>
        </ReasoningTrigger>
      </Reasoning>,
    );
    expect(screen.getByText('Custom trigger')).toBeInTheDocument();
    expect(screen.queryByText('Thought for a few seconds')).not.toBeInTheDocument();
  });

  it('renders reasoning content body', () => {
    render(
      <Reasoning>
        <ReasoningContent>
          <p>chain of thought</p>
        </ReasoningContent>
      </Reasoning>,
    );
    expect(screen.getByText('chain of thought')).toBeInTheDocument();
    expect(screen.getByTestId('collapsible-content')).toBeInTheDocument();
  });

  it('throws when trigger is used outside Reasoning', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ReasoningTrigger />)).toThrow(
      'Reasoning components must be used within Reasoning',
    );
    spy.mockRestore();
  });

  it('accepts className and open props without crashing', () => {
    render(
      <Reasoning className="extra" open defaultOpen isStreaming={false} duration={3}>
        <ReasoningTrigger className="trigger-class" />
        <ReasoningContent className="content-class">body</ReasoningContent>
      </Reasoning>,
    );
    expect(screen.getByText('body')).toBeInTheDocument();
  });
});
