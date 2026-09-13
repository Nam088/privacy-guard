import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PII_PROMPT_ID,
  dismissPiiPrompt,
  insertTextIntoActiveElement,
  installPiiShieldHook,
  showPiiPrompt,
} from '@/observe/piiShield';
import { scanPii } from '@/observe/piiShieldUtil';

describe('piiShield hook', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    dismissPiiPrompt(document);
  });

  describe('insertTextIntoActiveElement', () => {
    it('inserts text into focused HTMLInputElement', () => {
      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);
      input.focus();

      insertTextIntoActiveElement(document, 'Test message');
      expect(input.value).toBe('Test message');
    });

    it('inserts text into contenteditable div', () => {
      const editor = document.createElement('div');
      editor.contentEditable = 'true';
      document.body.appendChild(editor);
      editor.focus();

      insertTextIntoActiveElement(document, 'Hello from contenteditable', editor);
      expect(editor.textContent).toContain('Hello from contenteditable');
    });
  });

  describe('showPiiPrompt and dismissPiiPrompt', () => {
    it('renders prompt with detected badges and action buttons', () => {
      const raw = 'CCCD: 001098012345';
      const scan = scanPii(raw);
      const onProceed = vi.fn();
      const onDismiss = vi.fn();

      const prompt = showPiiPrompt(document, scan, raw, onProceed, onDismiss);
      expect(prompt).toBeDefined();
      expect(document.getElementById(PII_PROMPT_ID)).toBe(prompt);
      expect(prompt.textContent).toContain('Phát hiện dữ liệu nhạy cảm');
      expect(prompt.textContent).toContain('001•••••••45');

      // Click mask button
      const btnMask = prompt.querySelector('#fb-sec-pii-mask') as HTMLButtonElement;
      btnMask.click();

      expect(onProceed).toHaveBeenCalledWith(scan.maskedText);
      expect(document.getElementById(PII_PROMPT_ID)).toBeNull();
    });

    it('allows user to choose paste raw', () => {
      const raw = 'Key: sk-proj-1234567890abcdef1234567890';
      const scan = scanPii(raw);
      const onProceed = vi.fn();
      const onDismiss = vi.fn();

      const prompt = showPiiPrompt(document, scan, raw, onProceed, onDismiss);
      const btnRaw = prompt.querySelector('#fb-sec-pii-raw') as HTMLButtonElement;
      btnRaw.click();

      expect(onProceed).toHaveBeenCalledWith(raw);
      expect(document.getElementById(PII_PROMPT_ID)).toBeNull();
    });

    it('allows user to cancel paste', () => {
      const raw = 'Key: sk-proj-1234567890abcdef1234567890';
      const scan = scanPii(raw);
      const onProceed = vi.fn();
      const onDismiss = vi.fn();

      const prompt = showPiiPrompt(document, scan, raw, onProceed, onDismiss);
      const btnCancel = prompt.querySelector('#fb-sec-pii-cancel') as HTMLButtonElement;
      btnCancel.click();

      expect(onDismiss).toHaveBeenCalled();
      expect(onProceed).not.toHaveBeenCalled();
      expect(document.getElementById(PII_PROMPT_ID)).toBeNull();
    });
  });

  describe('installPiiShieldHook', () => {
    it('intercepts paste with sensitive PII when active', () => {
      const active = true;
      const undo = installPiiShieldHook(window, () => active);

      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true }) as unknown as ClipboardEvent;
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          getData: (type: string) =>
            type === 'text/plain' ? 'So the visa 4532 0151 1283 0366 cua minh' : '',
        },
      });

      const preventDefaultSpy = vi.spyOn(pasteEvent, 'preventDefault');
      const stopImmediateSpy = vi.spyOn(pasteEvent, 'stopImmediatePropagation');

      window.dispatchEvent(pasteEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopImmediateSpy).toHaveBeenCalled();
      expect(document.getElementById(PII_PROMPT_ID)).not.toBeNull();

      undo();
    });

    it('ignores normal safe text paste', () => {
      const active = true;
      const undo = installPiiShieldHook(window, () => active);

      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true }) as unknown as ClipboardEvent;
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          getData: (type: string) => (type === 'text/plain' ? 'Xin chao cac ban' : ''),
        },
      });

      const preventDefaultSpy = vi.spyOn(pasteEvent, 'preventDefault');
      window.dispatchEvent(pasteEvent);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(document.getElementById(PII_PROMPT_ID)).toBeNull();

      undo();
    });

    it('does not intercept paste when feature is inactive', () => {
      const undo = installPiiShieldHook(window, () => false);

      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true }) as unknown as ClipboardEvent;
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          getData: (type: string) =>
            type === 'text/plain' ? 'The 4532 0151 1283 0366 cua minh' : '',
        },
      });

      const preventDefaultSpy = vi.spyOn(pasteEvent, 'preventDefault');
      window.dispatchEvent(pasteEvent);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(document.getElementById(PII_PROMPT_ID)).toBeNull();

      undo();
    });

    it('dismisses prompt on Escape key', () => {
      const active = true;
      const undo = installPiiShieldHook(window, () => active);

      // Trigger prompt
      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true }) as unknown as ClipboardEvent;
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          getData: (type: string) =>
            type === 'text/plain' ? 'Key: sk-proj-1234567890abcdef1234567890' : '',
        },
      });
      window.dispatchEvent(pasteEvent);
      expect(document.getElementById(PII_PROMPT_ID)).not.toBeNull();

      // Press Escape
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(document.getElementById(PII_PROMPT_ID)).toBeNull();

      undo();
    });
  });
});
