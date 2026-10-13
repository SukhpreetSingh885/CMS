import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

export interface FilterOption {
  key: string;
  label: string;
  value: string;
  displayValue?: string;
}

export function useSmartFilters<T extends Record<string, any>>(defaultFilters: Partial<T> = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse current active filters from URL search params
  const filters = useMemo(() => {
    const current: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      if (val !== undefined && val !== null && val !== '') {
        current[key] = val;
      }
    });

    return {
      ...defaultFilters,
      ...current,
    } as T;
  }, [searchParams, defaultFilters]);

  // Set single or multiple filters and reset page to 1
  const setFilter = useCallback(
    (key: string, value: string | number | boolean | null | undefined) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === undefined || value === null || value === '' || value === 'ALL') {
            next.delete(key);
          } else {
            next.set(key, String(value));
          }
          // Reset page when any filter criteria changes
          if (key !== 'page') {
            next.set('page', '1');
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setFilters = useCallback(
    (newFilters: Record<string, string | number | boolean | null | undefined>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(newFilters).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '' || value === 'ALL') {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          });
          next.set('page', '1');
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // Clear single filter
  const clearFilter = useCallback(
    (key: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete(key);
          next.set('page', '1');
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // Clear all filters except page size
  const clearAllFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams();
        const pageSize = prev.get('pageSize');
        if (pageSize) {
          next.set('pageSize', pageSize);
        }
        next.set('page', '1');
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  // Count active filters (ignoring page and pageSize)
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    searchParams.forEach((val, key) => {
      if (key !== 'page' && key !== 'pageSize' && val !== '' && val !== 'ALL') {
        count++;
      }
    });
    return count;
  }, [searchParams]);

  return {
    filters,
    setFilter,
    setFilters,
    clearFilter,
    clearAllFilters,
    activeFiltersCount,
    searchParams,
  };
}

