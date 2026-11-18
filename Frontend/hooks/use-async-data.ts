import { useCallback, useEffect, useState } from 'react';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: T };

export function useAsyncData<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    load()
      .then((data) => {
        if (active) setState({ status: 'ready', data });
      })
      .catch(() => {
        if (active) setState({ status: 'error' });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  return { state, reload };
}
