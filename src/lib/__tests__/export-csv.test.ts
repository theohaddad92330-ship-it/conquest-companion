import { describe, it, expect } from "vitest";
import { generateCSV } from "../export-csv";

describe("export-csv", () => {
  describe("generateCSV", () => {
    it("returns BOM + header + rows with correct CSV escaping", () => {
      const contacts = [
        {
          full_name: "Jean Dupont",
          title: "DSI",
          entity: "Siège",
          decision_role: "sponsor",
          priority: 1,
          email: "jean@example.com",
          phone: null,
          linkedin_url: "",
          profile_summary: "Résumé",
          why_contact: "Décideur",
          email_message: { subject: "Objet", body: "Corps" },
          linkedin_message: "Msg",
          followup_message: null,
          user_status: "new",
        },
      ];
      const csv = generateCSV(contacts, "Acme Corp");
      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toContain("Nom,");
      expect(csv).toContain("Jean Dupont");
      expect(csv).toContain("DSI");
      expect(csv).toContain("jean@example.com");
    });

    it("escapes double quotes and commas in fields", () => {
      const contacts = [
        {
          full_name: 'Dupont, "Jean"',
          title: "DSI",
          entity: "Siège",
          decision_role: "sponsor",
          priority: 1,
          email: null,
          phone: null,
          linkedin_url: null,
          profile_summary: null,
          why_contact: null,
          email_message: null,
          linkedin_message: null,
          followup_message: null,
          user_status: "new",
        },
      ];
      const csv = generateCSV(contacts, "Acme");
      expect(csv).toContain('"Dupont, ""Jean"""');
    });

    it("handles empty contacts array", () => {
      const csv = generateCSV([], "Acme");
      expect(csv.startsWith("\uFEFF")).toBe(true);
      const lines = csv.split("\n");
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain("Nom,");
    });
  });
});
