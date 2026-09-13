/**
 * Local PII & Secret Leak Shield Hook.
 *
 * Intercepts clipboard paste on social media input boxes to prevent accidental
 * leakage of credit cards, citizen IDs, API keys, or private tokens.
 *
 * Provides instant user choices:
 * - Paste Masked: Redacted version with sensitive parts replaced by dots
 * - Paste Raw: Allows user to proceed if intentionally shared
 * - Cancel: Drops paste completely
 */

import {
  formatPiiCategoryLabel,
  scanPii,
  type PiiScanResult,
} from './piiShieldUtil';

export const PII_PROMPT_ID = 'fb-sec-pii-prompt';

export interface PiiShieldOptions {
  readonly isPiiShieldActive: () => boolean;
}

/**
 * Inserts text into whatever element currently has focus (input, textarea, or contenteditable).
 */
export function insertTextIntoActiveElement(doc: Document, text: string, targetEl?: HTMLElement): void {
  const active = targetEl ?? (doc.activeElement as HTMLElement | null);
  if (!active) return;

  // HTMLInputElement / HTMLTextAreaElement fallback
  if ('setRangeText' in active && typeof (active as HTMLInputElement).setRangeText === 'function') {
    const input = active as HTMLInputElement;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.setRangeText(text, start, end, 'end');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  // Try document.execCommand('insertText') for rich editors (Lexical / Draft.js)
  const prevContent = active.textContent;
  if (typeof doc.execCommand === 'function') {
    try {
      const handled = doc.execCommand('insertText', false, text);
      if (handled && active.textContent !== prevContent) {
        return;
      }
    } catch {
      // Fallback below
    }
  }

  // ContentEditable / General fallback
  const isEditable =
    active.isContentEditable ||
    active.getAttribute('contenteditable') === 'true' ||
    active.getAttribute('role') === 'textbox';

  if (isEditable) {
    const sel = doc.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const textNode = doc.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      active.appendChild(doc.createTextNode(text));
    }
    active.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  // Catch-all
  active.textContent = (active.textContent || '') + text;
  active.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Creates and displays the floating PII warning prompt.
 */
export function showPiiPrompt(
  doc: Document,
  result: PiiScanResult,
  rawText: string,
  onProceed: (text: string) => void,
  onDismiss: () => void,
): HTMLElement {
  // Remove any existing prompt first
  dismissPiiPrompt(doc);

  const container = doc.createElement('div');
  container.id = PII_PROMPT_ID;

  // Modern frosted dark UI
  container.style.cssText = `
    position: fixed !important;
    bottom: 24px !important;
    right: 24px !important;
    max-width: 440px !important;
    width: calc(100vw - 48px) !important;
    background: #0f172a !important;
    border: 1px solid rgba(239, 68, 68, 0.4) !important;
    border-radius: 14px !important;
    box-shadow: 0 20px 30px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05) !important;
    padding: 16px 18px !important;
    z-index: 2147483646 !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
    color: #f8fafc !important;
    backdrop-filter: blur(20px) !important;
    -webkit-backdrop-filter: blur(20px) !important;
    box-sizing: border-box !important;
    animation: fb-sec-fade-in 0.2s ease-out !important;
  `;

  const badgesHtml = result.matches
    .map(
      (m) =>
        `<span style="display:inline-flex;align-items:center;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;background:rgba(239,68,68,0.2);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);margin-right:6px;margin-bottom:6px;">⚠️ ${formatPiiCategoryLabel(m.category, 'vi')}</span>`,
    )
    .join('');

  const previewMasked =
    result.maskedText.length > 80
      ? result.maskedText.slice(0, 80) + '...'
      : result.maskedText;

  container.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
      <div style="width:34px;height:34px;border-radius:10px;background:rgba(239,68,68,0.2);display:flex;align-items:center;justify-content:center;color:#ef4444;shrink:0;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          <path d="M12 8v4"></path>
          <path d="M12 16h.01"></path>
        </svg>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:600;color:#f8fafc;line-height:1.3;margin-bottom:2px;">
          Phát hiện dữ liệu nhạy cảm
        </div>
        <div style="font-size:12px;color:#94a3b8;line-height:1.4;">
          Nội dung vừa dán có chứa thông tin riêng tư hoặc bảo mật:
        </div>
      </div>
    </div>

    <div style="margin-bottom:10px;display:flex;flex-wrap:wrap;">
      ${badgesHtml}
    </div>

    <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:8px 10px;font-family:monospace;font-size:12px;color:#cbd5e1;word-break:break-all;margin-bottom:14px;max-height:60px;overflow-y:auto;">
      ${previewMasked}
    </div>

    <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;">
      <button id="fb-sec-pii-cancel" style="padding:6px 12px;background:transparent;border:1px solid #475569;border-radius:6px;font-size:12px;font-weight:500;color:#94a3b8;cursor:pointer;transition:all 0.15s;">
        Hủy
      </button>
      <button id="fb-sec-pii-raw" style="padding:6px 12px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:6px;font-size:12px;font-weight:500;color:#fca5a5;cursor:pointer;transition:all 0.15s;">
        Vẫn dán gốc
      </button>
      <button id="fb-sec-pii-mask" style="padding:6px 14px;background:#6366f1;border:none;border-radius:6px;font-size:12px;font-weight:600;color:#ffffff;cursor:pointer;box-shadow:0 2px 8px rgba(99,102,241,0.3);transition:all 0.15s;">
        🛡️ Dán bản đã che
      </button>
    </div>
  `;

  const btnMask = container.querySelector('#fb-sec-pii-mask') as HTMLButtonElement | null;
  const btnRaw = container.querySelector('#fb-sec-pii-raw') as HTMLButtonElement | null;
  const btnCancel = container.querySelector('#fb-sec-pii-cancel') as HTMLButtonElement | null;

  btnMask?.addEventListener('click', () => {
    dismissPiiPrompt(doc);
    onProceed(result.maskedText);
  });

  btnRaw?.addEventListener('click', () => {
    dismissPiiPrompt(doc);
    onProceed(rawText);
  });

  btnCancel?.addEventListener('click', () => {
    dismissPiiPrompt(doc);
    onDismiss();
  });

  (doc.body ?? doc.documentElement).appendChild(container);
  return container;
}

/**
 * Removes the PII warning prompt if currently displayed.
 */
export function dismissPiiPrompt(doc: Document): void {
  const prompt = doc.getElementById(PII_PROMPT_ID);
  if (prompt && prompt.parentNode) {
    prompt.parentNode.removeChild(prompt);
  }
}

/**
 * Installs the PII Leak Shield hook on the target window.
 */
export function installPiiShieldHook(
  win: Window,
  optionsOrGetter: PiiShieldOptions | (() => boolean),
): () => void {
  const isPiiShieldActive =
    typeof optionsOrGetter === 'function'
      ? optionsOrGetter
      : optionsOrGetter.isPiiShieldActive;

  const doc = win.document;
  if (!doc) {
    return () => {};
  }

  function onPaste(event: ClipboardEvent): void {
    if (!isPiiShieldActive()) {
      return;
    }

    const clipboardData = event.clipboardData;
    if (!clipboardData) {
      return;
    }

    const pastedText = clipboardData.getData('text/plain');
    if (!pastedText || pastedText.length < 9) {
      return;
    }

    const scanResult = scanPii(pastedText);
    if (!scanResult.detected) {
      return;
    }

    // PII detected! Prevent accidental instant paste into chat/post
    event.preventDefault();
    event.stopImmediatePropagation();

    showPiiPrompt(
      doc,
      scanResult,
      pastedText,
      (textToInsert) => {
        insertTextIntoActiveElement(doc, textToInsert);
      },
      () => {
        // User cancelled paste
      },
    );
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      dismissPiiPrompt(doc);
    }
  }

  win.addEventListener('paste', onPaste, { capture: true });
  win.addEventListener('keydown', onKeyDown, { capture: true });

  return function undoPiiShieldHook(): void {
    win.removeEventListener('paste', onPaste, { capture: true });
    win.removeEventListener('keydown', onKeyDown, { capture: true });
    dismissPiiPrompt(doc);
  };
}
