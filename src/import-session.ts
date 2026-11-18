export type ImportState<T> =
  | { readonly status: 'empty' }
  | { readonly status: 'loading'; readonly phase: string }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly value: T };

/** One active pipeline and one latest pending selection, including across cancel. */
export function createImportSession<I, T>(
  run: (input: I, isCurrent: () => boolean, phase: (text: string) => void) => Promise<T | undefined>,
  publish: (state: ImportState<T>) => void,
) {
  let generation = 0;
  let disposed = false;
  let running = false;
  let pending: { input: I; generation: number } | undefined;

  async function drain() {
    if (running || disposed) return;
    running = true;
    try {
      while (pending && !disposed) {
        const job = pending;
        pending = undefined;
        const isCurrent = () => !disposed && job.generation === generation;
        try {
          const value = await run(job.input, isCurrent, phase => {
            if (isCurrent()) publish({ status: 'loading', phase });
          });
          if (isCurrent() && value !== undefined) publish({ status: 'ready', value });
        } catch (error) {
          if (isCurrent()) publish({ status: 'error', message: error instanceof Error
            ? error.message : 'Could not import this recording. Try another WAV.' });
        }
      }
    } finally { running = false; }
  }

  return {
    select(input: I) {
      if (disposed) return;
      pending = { input, generation: ++generation };
      publish({ status: 'loading', phase: running ? 'Waiting for previous import…' : 'Reading WAV…' });
      void drain();
    },
    cancel() {
      if (disposed) return;
      generation++;
      pending = undefined;
      publish({ status: 'empty' });
    },
    dispose() {
      disposed = true;
      generation++;
      pending = undefined;
    },
  };
}
