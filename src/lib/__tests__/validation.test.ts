import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  signupSchema,
  companySearchSchema,
  analyzeAccountSchema,
} from '../validation';

describe('validation', () => {
  describe('loginSchema', () => {
    it('accepts valid email and password', () => {
      expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
    });
    it('rejects invalid email', () => {
      expect(loginSchema.safeParse({ email: 'not-email', password: 'x' }).success).toBe(false);
    });
    it('rejects empty password', () => {
      expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
    });
  });

  describe('signupSchema', () => {
    it('accepts valid signup', () => {
      expect(
        signupSchema.safeParse({
          email: 'u@example.com',
          password: 'password123',
          fullName: 'Jean Dupont',
        }).success
      ).toBe(true);
    });
    it('rejects short password', () => {
      expect(
        signupSchema.safeParse({
          email: 'u@example.com',
          password: 'short',
          fullName: 'Jean',
        }).success
      ).toBe(false);
    });
    it('rejects empty fullName', () => {
      expect(
        signupSchema.safeParse({
          email: 'u@example.com',
          password: 'password123',
          fullName: '',
        }).success
      ).toBe(false);
    });
  });

  describe('companySearchSchema', () => {
    it('accepts query length 2–100', () => {
      expect(companySearchSchema.safeParse({ query: 'ab' }).success).toBe(true);
      expect(companySearchSchema.safeParse({ query: 'a'.repeat(100) }).success).toBe(true);
    });
    it('rejects query shorter than 2', () => {
      expect(companySearchSchema.safeParse({ query: 'a' }).success).toBe(false);
      expect(companySearchSchema.safeParse({ query: '' }).success).toBe(false);
    });
    it('rejects query longer than 100', () => {
      expect(companySearchSchema.safeParse({ query: 'a'.repeat(101) }).success).toBe(false);
    });
  });

  describe('analyzeAccountSchema', () => {
    it('accepts valid companyName and optional userContext', () => {
      expect(
        analyzeAccountSchema.safeParse({ companyName: 'Acme Corp' }).success
      ).toBe(true);
      expect(
        analyzeAccountSchema.safeParse({
          companyName: 'Acme',
          userContext: 'Contexte optionnel',
        }).success
      ).toBe(true);
    });
    it('rejects empty companyName', () => {
      expect(
        analyzeAccountSchema.safeParse({ companyName: '' }).success
      ).toBe(false);
      expect(
        analyzeAccountSchema.safeParse({ companyName: '   ' }).success
      ).toBe(false);
    });
    it('rejects companyName longer than 200', () => {
      expect(
        analyzeAccountSchema.safeParse({ companyName: 'a'.repeat(201) }).success
      ).toBe(false);
    });
    it('rejects userContext longer than 2000', () => {
      expect(
        analyzeAccountSchema.safeParse({
          companyName: 'Acme',
          userContext: 'x'.repeat(2001),
        }).success
      ).toBe(false);
    });
  });
});
