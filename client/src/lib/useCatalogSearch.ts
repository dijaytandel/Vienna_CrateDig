import { useEffect, useState } from 'react';
import { searchCatalog, type CatalogResult } from '../api/catalog';
import { errorText } from '../api/client';

/** Debounced catalog lookup used by Add record, Report and the broadcast composer. */
export function useCatalogSearch(query: string, delay = 300) {
  const [state, setState] = useState<{
    q: string;
    results: CatalogResult[];
    error: string | null;
  }>({ q: '', results: [], error: null });
  const term = query.trim();
  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchCatalog(term, controller.signal).then(
        ({ results }) => setState({ q: term, results, error: null }),
        (err: unknown) => {
          if (!controller.signal.aborted) setState({ q: term, results: [], error: errorText(err) });
        },
      );
    }, delay);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, delay]);
  const ready = term.length >= 2 && state.q === term;
  return {
    results: ready ? state.results : [],
    error: ready ? state.error : null,
    searching: term.length >= 2 && !ready,
  };
}
