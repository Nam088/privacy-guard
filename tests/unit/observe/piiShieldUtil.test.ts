import { describe, expect, it } from 'vitest';
import {
  detectApiKeys,
  detectCreditCards,
  detectPhoneNumbers,
  detectVietnameseCccd,
  formatPiiCategoryLabel,
  luhnCheck,
  scanPii,
} from '@/observe/piiShieldUtil';

describe('piiShieldUtil', () => {
  describe('luhnCheck', () => {
    it('validates genuine card numbers correctly', () => {
      expect(luhnCheck('4532015112830366')).toBe(true);
      expect(luhnCheck('4532 0151 1283 0366')).toBe(true);
    });

    it('rejects invalid card numbers', () => {
      expect(luhnCheck('4532015112830367')).toBe(false);
      expect(luhnCheck('123456')).toBe(false); // too short
    });
  });

  describe('detectCreditCards', () => {
    it('detects and masks valid credit cards', () => {
      const text = 'Số thẻ thanh toán của tôi là 4532 0151 1283 0366 bạn nhé';
      const matches = detectCreditCards(text);
      expect(matches.length).toBe(1);
      expect(matches[0]!.category).toBe('credit_card');
      expect(matches[0]!.masked).toBe('•••• •••• •••• 0366');
    });

    it('ignores non-card 16-digit random strings that fail Luhn', () => {
      const text = 'Id giao dịch là 1234567890123456 xin cảm ơn';
      const matches = detectCreditCards(text);
      expect(matches.length).toBe(0);
    });
  });

  describe('detectVietnameseCccd', () => {
    it('detects 12-digit CCCD with valid structure', () => {
      const text = 'CCCD của anh: 001098012345 nhe';
      const matches = detectVietnameseCccd(text);
      expect(matches.length).toBe(1);
      expect(matches[0]!.category).toBe('cccd_cmnd');
      expect(matches[0]!.masked).toBe('001•••••••45');
    });

    it('detects 9-digit CMND', () => {
      const text = 'So CMND cu: 123456789';
      const matches = detectVietnameseCccd(text);
      expect(matches.length).toBe(1);
      expect(matches[0]!.masked).toBe('123••••89');
    });
  });

  describe('detectApiKeys', () => {
    it('detects OpenAI API key', () => {
      const text = 'Key cua toi: sk-proj-1234567890abcdef1234567890';
      const matches = detectApiKeys(text);
      expect(matches.some((m) => m.category === 'api_key')).toBe(true);
      const openai = matches.find((m) => m.raw.startsWith('sk-'));
      expect(openai?.masked).toContain('sk-••••••••');
    });

    it('detects Google AIza API key', () => {
      const text = 'AIzaSyA1234567890abcdef1234567890abcdef';
      const matches = detectApiKeys(text);
      expect(matches.length).toBe(1);
      expect(matches[0]!.masked).toContain('AIza••••••••');
    });

    it('detects GitHub PAT', () => {
      const text = 'token: ghp_123456789012345678901234567890123456';
      const matches = detectApiKeys(text);
      expect(matches.length).toBe(1);
      expect(matches[0]!.masked).toContain('ghp_••••••••');
    });

    it('detects AWS Access Key', () => {
      const text = 'aws: AKIAIOSFODNN7EXAMPLE';
      const matches = detectApiKeys(text);
      expect(matches.length).toBe(1);
      expect(matches[0]!.category).toBe('api_key');
    });

    it('detects Private Key block', () => {
      const text = `-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----`;
      const matches = detectApiKeys(text);
      expect(matches.length).toBe(1);
      expect(matches[0]!.category).toBe('private_key');
      expect(matches[0]!.masked).toBe('[REDACTED_PRIVATE_KEY]');
    });

    it('detects JWT session token', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozG4m1e_pM7s5g_nO4s6X7k3v2u1y';
      const matches = detectApiKeys(jwt);
      expect(matches.length).toBe(1);
      expect(matches[0]!.category).toBe('jwt_token');
    });
  });

  describe('detectPhoneNumbers', () => {
    it('detects Vietnamese mobile phone number', () => {
      const text = 'Lien he so 0912345678 hoac +84987654321';
      const matches = detectPhoneNumbers(text);
      expect(matches.length).toBe(2);
      expect(matches[0]!.masked).toBe('091••••678');
    });
  });

  describe('scanPii', () => {
    it('returns detected: false for safe plain text', () => {
      const result = scanPii('Hom nay thoi tiet Ha Noi rat dep, di uong cafe khong ban oi?');
      expect(result.detected).toBe(false);
      expect(result.matches.length).toBe(0);
      expect(result.maskedText).toBe('Hom nay thoi tiet Ha Noi rat dep, di uong cafe khong ban oi?');
    });

    it('detects multiple items and safely masks them in-place', () => {
      const text = 'Chuyen khoan toi CCCD 001098012345 hoac the 4532 0151 1283 0366 nhe!';
      const result = scanPii(text);
      expect(result.detected).toBe(true);
      expect(result.matches.length).toBe(2);
      expect(result.maskedText).toContain('001•••••••45');
      expect(result.maskedText).toContain('•••• •••• •••• 0366');
      expect(result.maskedText).not.toContain('001098012345');
      expect(result.maskedText).not.toContain('4532 0151 1283 0366');
    });
  });

  describe('formatPiiCategoryLabel', () => {
    it('formats category names in VI and EN', () => {
      expect(formatPiiCategoryLabel('credit_card', 'vi')).toBe('Thẻ ngân hàng');
      expect(formatPiiCategoryLabel('credit_card', 'en')).toBe('Bank / Credit Card');
      expect(formatPiiCategoryLabel('cccd_cmnd', 'vi')).toBe('Mã số CCCD / CMND');
    });
  });
});
