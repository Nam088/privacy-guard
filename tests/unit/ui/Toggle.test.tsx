import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { Toggle } from '@/ui/components/Toggle';

function switchEl(): HTMLInputElement {
  return screen.getByRole('switch') as HTMLInputElement;
}

describe('Toggle', () => {
  it('shows the label', () => {
    render(<Toggle label="Hide read receipts" checked onChange={() => {}} />);
    expect(screen.getByText('Hide read receipts')).toBeTruthy();
  });

  it('shows the description when given one', () => {
    render(
      <Toggle
        label="Hide read receipts"
        description="Read messages quietly"
        checked
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('Read messages quietly')).toBeTruthy();
  });

  it('shows the badge when given one', () => {
    render(
      <Toggle label="Hide typing" badge="Soon" checked onChange={() => {}} />,
    );
    expect(screen.getByText('Soon')).toBeTruthy();
  });

  it('renders no badge element when none is given', () => {
    render(<Toggle label="Hide typing" checked onChange={() => {}} />);
    expect(screen.queryByText('Soon')).toBeNull();
  });

  it('reflects the on state', () => {
    render(<Toggle label="Hide typing" checked onChange={() => {}} />);
    expect(switchEl().checked).toBe(true);
  });

  it('reflects the off state', () => {
    render(<Toggle label="Hide typing" checked={false} onChange={() => {}} />);
    expect(switchEl().checked).toBe(false);
  });

  it('calls onChange with true when switched on', () => {
    const onChange = vi.fn();
    render(<Toggle label="Hide typing" checked={false} onChange={onChange} />);
    fireEvent.click(switchEl());
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange with false when switched off', () => {
    const onChange = vi.fn();
    render(<Toggle label="Hide typing" checked onChange={onChange} />);
    fireEvent.click(switchEl());
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn();
    render(
      <Toggle label="Hide typing" checked={false} disabled onChange={onChange} />,
    );
    fireEvent.click(switchEl());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('marks the control disabled so assistive technology knows', () => {
    render(
      <Toggle label="Hide typing" checked={false} disabled onChange={() => {}} />,
    );
    expect(switchEl().disabled).toBe(true);
  });
});
