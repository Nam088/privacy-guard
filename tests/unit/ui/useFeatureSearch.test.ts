import { act, renderHook } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureSearch } from '@/ui/search/useFeatureSearch';

describe('useFeatureSearch debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates inputValue immediately but debounces debouncedQuery by 120ms', () => {
    const { result } = renderHook(() => useFeatureSearch('vi', undefined, 120));

    expect(result.current.inputValue).toBe('');
    expect(result.current.debouncedQuery).toBe('');
    expect(result.current.isSearching).toBe(false);

    // User types 'typing'
    act(() => {
      result.current.setInputValue('typing');
    });

    // inputValue is updated immediately for snappy typing
    expect(result.current.inputValue).toBe('typing');
    // But debouncedQuery is still empty before debounce timer fires
    expect(result.current.debouncedQuery).toBe('');
    expect(result.current.isSearching).toBe(false);

    // Advance by 60ms (less than 120ms)
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(result.current.debouncedQuery).toBe('');

    // Advance the remaining 60ms (total 120ms)
    act(() => {
      vi.advanceTimersByTime(60);
    });

    // Now debouncedQuery is updated and search results are evaluated
    expect(result.current.debouncedQuery).toBe('typing');
    expect(result.current.isSearching).toBe(true);
    expect(result.current.results.length).toBeGreaterThan(0);
  });

  it('cancels previous debounce timer on rapid keystrokes', () => {
    const { result } = renderHook(() => useFeatureSearch('vi', undefined, 120));

    act(() => {
      result.current.setInputValue('t');
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    act(() => {
      result.current.setInputValue('ty');
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    act(() => {
      result.current.setInputValue('typ');
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    // Still not fired because user kept typing within 120ms window
    expect(result.current.debouncedQuery).toBe('');

    // User stops typing for 120ms
    act(() => {
      vi.advanceTimersByTime(120);
    });

    // Only the final value is evaluated
    expect(result.current.debouncedQuery).toBe('typ');
    expect(result.current.isSearching).toBe(true);
  });

  it('clears immediately without delay when clearSearch is called', () => {
    const { result } = renderHook(() => useFeatureSearch('vi', undefined, 120));

    act(() => {
      result.current.setInputValue('reels');
    });
    act(() => {
      vi.advanceTimersByTime(120);
    });
    expect(result.current.debouncedQuery).toBe('reels');

    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.inputValue).toBe('');
    expect(result.current.debouncedQuery).toBe('');
    expect(result.current.isSearching).toBe(false);
  });
});
