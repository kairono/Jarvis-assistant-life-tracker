import { useCallback, useEffect, useState } from 'react';
import { db } from '../lib/db';
import type { DomainMap, DomainName } from '../types';

/**
 * Runs `load()` once on mount and again whenever the store emits a change,
 * giving components live data without coupling them to Dexie. Pass a stable
 * `deps` array (the loader is re-created from it internally).
 */
export function useStoreData<T>(load: () => Promise<T>, fallback: T, deps: unknown[] = []): T {
  const [data, setData] = useState<T>(fallback);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loader = useCallback(load, deps);

  useEffect(() => {
    let active = true;
    const run = () => {
      loader().then((d) => {
        if (active) setData(d);
      });
    };
    run();
    const unsub = db.subscribe(run);
    return () => {
      active = false;
      unsub();
    };
  }, [loader]);

  return data;
}

/** Convenience: live full list of one domain, sorted optionally. */
export function useCollection<K extends DomainName>(
  name: K,
  sort?: (a: DomainMap[K], b: DomainMap[K]) => number,
): DomainMap[K][] {
  return useStoreData<DomainMap[K][]>(
    async () => {
      const rows = await db.collection(name).all();
      return sort ? [...rows].sort(sort) : rows;
    },
    [],
    [name, sort],
  );
}
