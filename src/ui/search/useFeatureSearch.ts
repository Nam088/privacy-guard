import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { SupportedLocale } from '@/i18n/types';
import {
  buildSearchIndex,
  searchFeatures,
  type SearchableFeature,
  type SearchResultItem,
} from './featureSearch';

export interface UseFeatureSearchResult {
  /** The immediate input value bound to the text field */
  inputValue: string;
  /** The debounced/lazy query evaluated for search */
  debouncedQuery: string;
  /** Whether the user is actively searching */
  isSearching: boolean;
  /** Filtered and ranked search results */
  results: SearchResultItem[];
  /** Searchable items across the entire index */
  allFeatures: SearchableFeature[];
  /** Callback for when user types into the search input */
  setInputValue: (value: string) => void;
  /** Resets the search input and results */
  clearSearch: () => void;
  /** Ref to the search input element for shortcut focus */
  inputRef: { current: HTMLInputElement | null };
}

export function useFeatureSearch(
  activeLocale: SupportedLocale = 'en',
  scope?: string,
  debounceMs: number = 120,
): UseFeatureSearchResult {
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Lazy / memoized search index construction
  const allFeatures = useMemo(() => {
    return buildSearchIndex(activeLocale);
  }, [activeLocale]);

  // Debounce input value changes (lazy evaluation)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [inputValue, debounceMs]);

  // Lazy computation of search results
  const isSearching = debouncedQuery.trim().length > 0;
  const results = useMemo(() => {
    if (!isSearching) {
      return [];
    }
    return searchFeatures(allFeatures, debouncedQuery, {
      scope: scope === 'all' ? undefined : scope,
      activeLocale,
    });
  }, [allFeatures, debouncedQuery, isSearching, scope, activeLocale]);

  function clearSearch() {
    setInputValue('');
    setDebouncedQuery('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }

  // Keyboard shortcut listener ('/' to focus, 'Escape' to clear)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isSearching) {
        clearSearch();
      } else if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearching]);

  return {
    inputValue,
    debouncedQuery,
    isSearching,
    results,
    allFeatures,
    setInputValue,
    clearSearch,
    inputRef,
  };
}
