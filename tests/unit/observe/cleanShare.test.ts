import { describe, expect, it, vi } from 'vitest';
import { installCleanShareHook } from '@/observe/cleanShare';

describe('cleanShare hook', () => {
  it('intercepts navigator.clipboard.writeText and strips tracking tokens when active', async () => {
    let capturedText = '';
    const mockWriteText = vi.fn(async (text: string) => {
      capturedText = text;
    });

    const mockWin = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      navigator: {
        clipboard: {
          writeText: mockWriteText,
        },
      },
    } as unknown as Window;

    let active = true;
    const undo = installCleanShareHook(mockWin, () => active);

    // Call writeText with tracking URL
    await mockWin.navigator.clipboard.writeText(
      'https://www.facebook.com/share/p/123/?mibextid=abc',
    );

    expect(capturedText).toBe('https://www.facebook.com/share/p/123/');

    // When inactive, passes through unmodified
    active = false;
    await mockWin.navigator.clipboard.writeText(
      'https://www.facebook.com/share/p/456/?mibextid=xyz',
    );
    expect(capturedText).toBe('https://www.facebook.com/share/p/456/?mibextid=xyz');

    undo();
  });

  it('handles copy event by modifying clipboardData', () => {
    const listeners: Record<string, (e: any) => void> = {};
    const mockWin = {
      addEventListener: vi.fn((event, handler) => {
        listeners[event] = handler;
      }),
      removeEventListener: vi.fn((event) => {
        delete listeners[event];
      }),
      getSelection: vi.fn(() => ({
        toString: () => 'https://www.instagram.com/reel/123/?igsh=token_xyz',
      })),
      navigator: {},
    } as unknown as Window;

    const undo = installCleanShareHook(mockWin, () => true);

    expect(listeners['copy']).toBeDefined();

    let clipboardDataContent = '';
    let defaultPrevented = false;
    const mockEvent = {
      clipboardData: {
        setData: vi.fn((format: string, data: string) => {
          if (format === 'text/plain') clipboardDataContent = data;
        }),
      },
      preventDefault: vi.fn(() => {
        defaultPrevented = true;
      }),
      stopImmediatePropagation: vi.fn(),
    };

    listeners['copy'](mockEvent);

    expect(defaultPrevented).toBe(true);
    expect(clipboardDataContent).toBe('https://www.instagram.com/reel/123/');

    undo();
    expect(listeners['copy']).toBeUndefined();
  });
});
