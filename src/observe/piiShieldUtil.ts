/**
 * Local PII (Personally Identifiable Information) & Secret Leak Shield Utility.
 *
 * Scans text on paste/input to prevent accidental leaks of:
 * - Bank / Credit / Debit Cards (with Luhn validation)
 * - Vietnamese Citizen IDs (CCCD 12-digit & CMND 9-digit)
 * - API Keys / Cloud Secrets / Tokens (OpenAI, Google, GitHub, AWS, Slack, JWT, Private Keys)
 * - Vietnamese Phone Numbers
 *
 * Runs 100% offline, client-side only, with zero external network requests.
 */

export type PiiCategory =
  | 'credit_card'
  | 'cccd_cmnd'
  | 'api_key'
  | 'jwt_token'
  | 'private_key'
  | 'phone_number';

export interface PiiMatch {
  readonly category: PiiCategory;
  readonly label: string;
  readonly raw: string;
  readonly masked: string;
  readonly startIndex: number;
  readonly endIndex: number;
}

export interface PiiScanResult {
  readonly detected: boolean;
  readonly matches: readonly PiiMatch[];
  readonly maskedText: string;
}

/**
 * Standard Luhn checksum algorithm for credit/debit card validation.
 */
export function luhnCheck(digits: string): boolean {
  const clean = digits.replace(/\D/g, '');
  if (clean.length < 13 || clean.length > 19) {
    return false;
  }
  let sum = 0;
  let isAlternate = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let n = parseInt(clean[i], 10);
    if (isAlternate) {
      n *= 2;
      if (n > 9) {
        n -= 9;
      }
    }
    sum += n;
    isAlternate = !isAlternate;
  }
  return sum % 10 === 0;
}

/**
 * Detects credit / debit card numbers with Luhn validation.
 */
export function detectCreditCards(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];
  // Matches candidate digit sequences with optional space or hyphen separators
  const regex = /\b(?:\d{4}[ -]?){3}\d{1,4}\b|\b\d{13,19}\b/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const cleanDigits = raw.replace(/\D/g, '');
    if (luhnCheck(cleanDigits)) {
      const last4 = cleanDigits.slice(-4);
      const masked = `•••• •••• •••• ${last4}`;
      matches.push({
        category: 'credit_card',
        label: 'Credit / Debit Card',
        raw,
        masked,
        startIndex: match.index,
        endIndex: match.index + raw.length,
      });
    }
  }
  return matches;
}

/**
 * Detects Vietnamese Citizen Identity (CCCD 12-digit) and CMND (9-digit).
 */
export function detectVietnameseCccd(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];
  // 12-digit CCCD: 0 + 3-digit province + 1-digit century/gender + 2-digit birth year + 6-digit order
  const cccdRegex = /\b0\d{2}[0-3]\d{2}\d{6}\b/g;
  let match: RegExpExecArray | null;

  while ((match = cccdRegex.exec(text)) !== null) {
    const raw = match[0];
    const prefix = raw.slice(0, 3);
    const suffix = raw.slice(-2);
    const masked = `${prefix}•••••••${suffix}`;
    matches.push({
      category: 'cccd_cmnd',
      label: 'CCCD / Citizen ID',
      raw,
      masked,
      startIndex: match.index,
      endIndex: match.index + raw.length,
    });
  }

  // 9-digit CMND (if not already captured as part of another number)
  const cmndRegex = /\b\d{9}\b/g;
  while ((match = cmndRegex.exec(text)) !== null) {
    const raw = match[0];
    // Avoid overlap with already found matches
    const overlaps = matches.some(
      (m) => match!.index >= m.startIndex && match!.index < m.endIndex,
    );
    if (!overlaps) {
      const prefix = raw.slice(0, 3);
      const suffix = raw.slice(-2);
      const masked = `${prefix}••••${suffix}`;
      matches.push({
        category: 'cccd_cmnd',
        label: 'CMND (9-digit ID)',
        raw,
        masked,
        startIndex: match.index,
        endIndex: match.index + raw.length,
      });
    }
  }

  return matches;
}

/**
 * Detects API keys, private keys, and cloud credentials.
 */
export function detectApiKeys(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];

  // Private key block
  const privKeyRegex = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
  let match: RegExpExecArray | null;
  while ((match = privKeyRegex.exec(text)) !== null) {
    const raw = match[0];
    matches.push({
      category: 'private_key',
      label: 'Private Encryption Key',
      raw,
      masked: '[REDACTED_PRIVATE_KEY]',
      startIndex: match.index,
      endIndex: match.index + raw.length,
    });
  }

  // OpenAI API Key
  const openaiRegex = /\bsk-[a-zA-Z0-9_\-]{20,}\b/g;
  while ((match = openaiRegex.exec(text)) !== null) {
    const raw = match[0];
    const suffix = raw.slice(-4);
    matches.push({
      category: 'api_key',
      label: 'OpenAI API Key',
      raw,
      masked: `sk-••••••••${suffix}`,
      startIndex: match.index,
      endIndex: match.index + raw.length,
    });
  }

  // Google API Key
  const googleRegex = /\bAIza[0-9A-Za-z\-_]{35}\b/g;
  while ((match = googleRegex.exec(text)) !== null) {
    const raw = match[0];
    const suffix = raw.slice(-4);
    matches.push({
      category: 'api_key',
      label: 'Google API Key',
      raw,
      masked: `AIza••••••••${suffix}`,
      startIndex: match.index,
      endIndex: match.index + raw.length,
    });
  }

  // GitHub Personal Access Token
  const ghRegex = /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/g;
  while ((match = ghRegex.exec(text)) !== null) {
    const raw = match[0];
    const prefix = raw.slice(0, 4);
    const suffix = raw.slice(-4);
    matches.push({
      category: 'api_key',
      label: 'GitHub Token',
      raw,
      masked: `${prefix}••••••••${suffix}`,
      startIndex: match.index,
      endIndex: match.index + raw.length,
    });
  }

  // AWS Access Key ID
  const awsRegex = /\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g;
  while ((match = awsRegex.exec(text)) !== null) {
    const raw = match[0];
    const prefix = raw.slice(0, 4);
    const suffix = raw.slice(-4);
    matches.push({
      category: 'api_key',
      label: 'AWS Access Key',
      raw,
      masked: `${prefix}••••••••${suffix}`,
      startIndex: match.index,
      endIndex: match.index + raw.length,
    });
  }

  // Slack Token
  const slackRegex = /\bxox[baprs]-[0-9A-Za-z\-]{10,}\b/g;
  while ((match = slackRegex.exec(text)) !== null) {
    const raw = match[0];
    const prefix = raw.slice(0, 5);
    const suffix = raw.slice(-4);
    matches.push({
      category: 'api_key',
      label: 'Slack Token',
      raw,
      masked: `${prefix}••••••••${suffix}`,
      startIndex: match.index,
      endIndex: match.index + raw.length,
    });
  }

  // JWT Token
  const jwtRegex = /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_./+-]{10,}\b/g;
  while ((match = jwtRegex.exec(text)) !== null) {
    const raw = match[0];
    const suffix = raw.slice(-4);
    matches.push({
      category: 'jwt_token',
      label: 'JWT Session Token',
      raw,
      masked: `eyJ••••••••.${suffix}`,
      startIndex: match.index,
      endIndex: match.index + raw.length,
    });
  }

  return matches;
}

/**
 * Detects Vietnamese mobile phone numbers.
 */
export function detectPhoneNumbers(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];
  const phoneRegex = /(?:^|[^\d+])((?:\+84|0)(?:3[2-9]|5[689]|7[06-9]|8[1-9]|9\d)\d{7})\b/g;
  let match: RegExpExecArray | null;

  while ((match = phoneRegex.exec(text)) !== null) {
    const full = match[0];
    const raw = match[1];
    const offset = full.indexOf(raw);
    const startIndex = match.index + offset;
    const prefix = raw.slice(0, raw.startsWith('+84') ? 5 : 3);
    const suffix = raw.slice(-3);
    matches.push({
      category: 'phone_number',
      label: 'Phone Number',
      raw,
      masked: `${prefix}••••${suffix}`,
      startIndex,
      endIndex: startIndex + raw.length,
    });
  }
  return matches;
}

/**
 * Comprehensive scan of text for all supported PII categories.
 * Redacts all found matches into a clean masked string.
 */
export function scanPii(text: string): PiiScanResult {
  if (!text || typeof text !== 'string') {
    return { detected: false, matches: [], maskedText: text ?? '' };
  }

  const allMatches: PiiMatch[] = [
    ...detectApiKeys(text),
    ...detectCreditCards(text),
    ...detectVietnameseCccd(text),
    ...detectPhoneNumbers(text),
  ];

  if (allMatches.length === 0) {
    return { detected: false, matches: [], maskedText: text };
  }

  // Sort matches by startIndex ascending
  allMatches.sort((a, b) => a.startIndex - b.startIndex);

  // Filter out any overlapping matches (keep earliest)
  const nonOverlapping: PiiMatch[] = [];
  let lastEnd = -1;
  for (const m of allMatches) {
    if (m.startIndex >= lastEnd) {
      nonOverlapping.push(m);
      lastEnd = m.endIndex;
    }
  }

  // Build masked text
  let maskedText = '';
  let cursor = 0;
  for (const m of nonOverlapping) {
    maskedText += text.slice(cursor, m.startIndex);
    maskedText += m.masked;
    cursor = m.endIndex;
  }
  maskedText += text.slice(cursor);

  return {
    detected: nonOverlapping.length > 0,
    matches: nonOverlapping,
    maskedText,
  };
}

/**
 * Human-readable category label in EN or VI.
 */
export function formatPiiCategoryLabel(category: PiiCategory, lang: 'en' | 'vi' = 'vi'): string {
  const labels: Record<PiiCategory, { en: string; vi: string }> = {
    credit_card: { en: 'Bank / Credit Card', vi: 'Thẻ ngân hàng' },
    cccd_cmnd: { en: 'Citizen ID (CCCD/CMND)', vi: 'Mã số CCCD / CMND' },
    api_key: { en: 'API Key / Secret Token', vi: 'Khóa bảo mật API Key' },
    jwt_token: { en: 'JWT Session Token', vi: 'Token phiên đăng nhập (JWT)' },
    private_key: { en: 'Private Key', vi: 'Khóa riêng tư (Private Key)' },
    phone_number: { en: 'Phone Number', vi: 'Số điện thoại' },
  };
  return labels[category]?.[lang] ?? category;
}
