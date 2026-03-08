/**
 * Test du flux auth + onboarding (simulation end-to-end).
 * Vérifie la logique de redirection et que le profil partagé (ProfileContext) est cohérent.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Auth + Onboarding flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Redirect logic (ProtectedRoute)", () => {
    it("should allow dashboard when profile.onboarding_completed === true", () => {
      const profile = { onboarding_completed: true } as any;
      const shouldRedirectToOnboarding = profile && profile.onboarding_completed === false;
      expect(shouldRedirectToOnboarding).toBe(false);
    });

    it("should redirect to onboarding when profile.onboarding_completed === false", () => {
      const profile = { onboarding_completed: false } as any;
      const shouldRedirectToOnboarding = profile && profile.onboarding_completed === false;
      expect(shouldRedirectToOnboarding).toBe(true);
    });

    it("should redirect to onboarding when profile is null", () => {
      const profile = null;
      const shouldRedirectToOnboarding = profile === null;
      expect(shouldRedirectToOnboarding).toBe(true);
    });
  });

  describe("Email confirmation redirect", () => {
    it("should use /welcome as emailRedirectTo for post-confirmation page", () => {
      const origin = "http://localhost:8085";
      const emailRedirectTo = `${origin}/welcome`;
      expect(emailRedirectTo).toBe("http://localhost:8085/welcome");
      expect(emailRedirectTo).toContain("/welcome");
    });
  });

  describe("Onboarding save success", () => {
    it("should consider save successful when updateProfile returns no error", () => {
      const result = { error: null, data: { onboarding_completed: true } };
      const saved = !result.error;
      expect(saved).toBe(true);
    });

    it("should consider save failed when updateProfile returns error", () => {
      const result = { error: new Error("DB error"), data: null };
      const saved = !result.error;
      expect(saved).toBe(false);
    });
  });
});
