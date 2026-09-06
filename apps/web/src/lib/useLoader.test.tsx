import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { useLoader } from './useLoader';

afterEach(() => cleanup());

function Harness({ loader }: { loader: (s: AbortSignal) => Promise<string> }) {
  const { status, data, reload } = useLoader(loader, []);
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="data">{data ?? ''}</span>
      <button onClick={reload}>reload</button>
    </div>
  );
}

describe('useLoader', () => {
  it('resolves to ready with data', async () => {
    render(<Harness loader={async () => 'hello'} />);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('data')).toHaveTextContent('hello');
  });

  it('moves to error when the loader throws', async () => {
    render(<Harness loader={async () => { throw new Error('boom'); }} />);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'));
  });

  it('reload() retries a previously failed load', async () => {
    let calls = 0;
    const loader = async () => {
      calls += 1;
      if (calls === 1) throw new Error('first fails');
      return 'recovered';
    };
    render(<Harness loader={loader} />);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'));
    fireEvent.click(screen.getByRole('button', { name: 'reload' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('data')).toHaveTextContent('recovered');
  });

  it('does not update state or warn after unmount (aborts cleanly)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let resolveLate!: (v: string) => void;
    const loader = () => new Promise<string>((resolve) => { resolveLate = resolve; });
    const { unmount } = render(<Harness loader={loader} />);
    unmount();
    resolveLate('too late'); // resolves after unmount
    await Promise.resolve();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
