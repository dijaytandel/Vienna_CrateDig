import { useCallback, useEffect, useState, type DependencyList } from 'react';
import { errorText } from '../api/client';

interface Result<T> {
  key: string;
  depsKey: string;
  data?: T;
  error: string | null;
  errorValue: unknown;
}

/**
 * Runs `load` whenever `deps` change (and on `reload`), aborting stale calls.
 * Data from a reload stays visible until the new result arrives.
 */
export function useAsync<T>(
  load: ((signal: AbortSignal) => Promise<T>) | null,
  deps: DependencyList,
) {
  const [attempt, setAttempt] = useState(0);
  const depsKey = JSON.stringify(deps);
  const key = `${depsKey}#${attempt}`;
  const [result, setResult] = useState<Result<T> | null>(null);

  useEffect(() => {
    if (!load) return;
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => setResult({ key, depsKey, data, error: null, errorValue: null }),
      (err: unknown) => {
        if (controller.signal.aborted) return;
        setResult((prev) => ({
          key,
          depsKey,
          data: prev?.depsKey === depsKey ? prev.data : undefined,
          error: errorText(err),
          errorValue: err,
        }));
      },
    );
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const setData = useCallback(
    (data: T | ((prev: T | undefined) => T)) =>
      setResult((prev) => {
        const next =
          typeof data === 'function' ? (data as (p: T | undefined) => T)(prev?.data) : data;
        return {
          key: prev?.key ?? key,
          depsKey: prev?.depsKey ?? depsKey,
          data: next,
          error: null,
          errorValue: null,
        };
      }),
    [key, depsKey],
  );

  const current = result?.depsKey === depsKey ? result : null;
  return {
    data: current?.data,
    error: current?.key === key ? current.error : null,
    errorValue: current?.key === key ? current.errorValue : null,
    loading: !!load && result?.key !== key,
    reload,
    setData,
  };
}
