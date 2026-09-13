import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { SearchBar } from '@/ui/components/SearchBar';

describe('SearchBar component', () => {
  it('renders input with placeholder and shortcut hint', () => {
    const onChange = vi.fn();
    const onClear = vi.fn();

    render(
      <SearchBar
        value=""
        onChange={onChange}
        onClear={onClear}
        placeholder="Search features..."
        shortcutHint="/"
      />,
    );

    const input = screen.getByRole('searchbox');
    expect(input).toBeDefined();
    expect(input.getAttribute('placeholder')).toBe('Search features...');
    expect(screen.getByText('/')).toBeDefined();
  });

  it('calls onChange when user types', () => {
    const onChange = vi.fn();
    const onClear = vi.fn();

    render(
      <SearchBar
        value=""
        onChange={onChange}
        onClear={onClear}
        placeholder="Search features..."
      />,
    );

    const input = screen.getByRole('searchbox');
    fireEvent.input(input, { target: { value: 'reels' } });

    expect(onChange).toHaveBeenCalledWith('reels');
  });

  it('shows clear button when input has text and calls onClear on click', () => {
    const onChange = vi.fn();
    const onClear = vi.fn();

    render(
      <SearchBar
        value="typing"
        onChange={onChange}
        onClear={onClear}
        placeholder="Search features..."
      />,
    );

    const clearBtn = screen.getByLabelText('Clear search');
    expect(clearBtn).toBeDefined();

    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalled();
  });
});
