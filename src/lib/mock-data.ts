import type { AccountAnalysis } from "@/types/account";

const MOCK_USER_ID = "00000000-0000-0000-0000-000000000000";

function buildAccount(partial: Partial<AccountAnalysis> & Pick<AccountAnalysis, "company_name">): AccountAnalysis {
  const now = new Date().toISOString();
  return {
    id: partial.id || crypto.randomUUID(),
    user_id: partial.user_id || MOCK_USER_ID,
    company_name: partial.company_name,
    sector: partial.sector ?? null,
    employees: partial.employees ?? null,
    revenue: partial.revenue ?? null,
    headquarters: partial.headquarters ?? null,
    website: partial.website ?? null,
    subsidiaries: partial.subsidiaries ?? [],
    it_challenges: partial.it_challenges ?? [],
    recent_signals: partial.recent_signals ?? [],
    priority_score: partial.priority_score ?? 0,
    priority_justification: partial.priority_justification ?? null,
    raw_analysis: partial.raw_analysis ?? null,
    status: partial.status ?? "completed",
    error_message: partial.error_message ?? null,
    user_context: partial.user_context ?? null,
    api_cost_euros: partial.api_cost_euros ?? 0,
    created_at: partial.created_at || now,
    updated_at: partial.updated_at || now,
  };
}

export function generateMockAnalysis(companyName: string): AccountAnalysis {
  const key = companyName.toLowerCase();

  const presets: Record<string, Partial<AccountAnalysis>> = {
    default: {
      sector: "Technologie & Services",
      employees: "~5 000 collaborateurs",
      revenue: "~800 M€",
      headquarters: "Paris, France",
      website: "https://example.com",
      subsidiaries: ["Filiale Consulting", "Filiale Cloud Services", "Filiale Data"],
      it_challenges: [
        "Modernisation du SI legacy",
        "Migration cloud multi-provider",
        "Programme data & IA à l'échelle",
        "Cybersécurité et conformité réglementaire",
      ],
      recent_signals: [
        "Recrutement massif en ingénieurs cloud (Q1 2026)",
        "Nomination d'un nouveau CTO",
        "Partenariat stratégique avec AWS annoncé",
        "Budget IT en hausse de 15% sur 2026",
      ],
      priority_score: 7,
      priority_justification:
        "Forte activité IT avec des besoins récurrents en prestations. Multiples portes d'entrée identifiées via les filiales.",
    },
    "société générale": {
      sector: "Banque & Services Financiers",
      employees: "~117 000 collaborateurs",
      revenue: "~26 Md€",
      headquarters: "Paris La Défense",
      website: "https://societegenerale.com",
      subsidiaries: ["SG CIB", "Boursorama", "ALD Automotive", "Société Générale Factoring"],
      it_challenges: [
        'Migration cloud — programme "Move to Cloud"',
        "Modernisation SI core banking",
        "Programme data/IA à l'échelle",
        "Cybersécurité réglementaire (DORA)",
        "Transformation DevOps & agilité",
      ],
      recent_signals: [
        "Recrutement massif en data engineering (janv. 2026)",
        "Nouveau CDO nommé",
        'Programme "Move to Cloud" Phase 2 annoncé',
        "Budget cybersécurité doublé suite à DORA",
        "Hackathon IA interne — signal d'ouverture à l'innovation",
      ],
      priority_score: 9,
      priority_justification:
        "Compte majeur avec forte activité IT, besoins récurrents en prestation, multiples portes d'entrée via les filiales et les programmes transverses.",
    },
    "bnp paribas": {
      sector: "Banque & Services Financiers",
      employees: "~185 000 collaborateurs",
      revenue: "~46 Md€",
      headquarters: "Paris 9ème",
      website: "https://group.bnpparibas",
      subsidiaries: ["BNP Paribas CIB", "BNP Paribas Cardif", "BNP Paribas Personal Finance", "Arval"],
      it_challenges: [
        "Programme cloud hybride multi-cloud",
        "IA générative pour le front-office",
        "Modernisation des plateformes de trading",
        "Conformité ESG & reporting automatisé",
      ],
      recent_signals: [
        "Création d'un lab IA générative (Q4 2025)",
        "Migration SAP S/4HANA en cours",
        "Recrutement de 500 profils IT en 2026",
        "Partenariat Google Cloud annoncé",
      ],
      priority_score: 8,
      priority_justification:
        "Très gros compte avec budget IT massif. Programme cloud et IA généralisé, nombreux besoins en consulting et staffing.",
    },
  };

  const preset = presets[key] || presets.default;
  return buildAccount({ company_name: companyName, ...preset });
}

export const savedAccounts: AccountAnalysis[] = [
  buildAccount({
    id: "1",
    company_name: "Société Générale",
    sector: "Banque & Services Financiers",
    employees: "~117 000",
    revenue: "~26 Md€",
    headquarters: "Paris La Défense",
    website: "https://societegenerale.com",
    subsidiaries: ["SG CIB", "Boursorama"],
    it_challenges: ["Migration cloud", "Data/IA"],
    recent_signals: ["Nouveau CDO nommé"],
    priority_score: 9,
    priority_justification: "Forte activité IT",
    status: "completed",
    created_at: "2026-03-02T10:30:00Z",
    updated_at: "2026-03-02T10:35:00Z",
  }),
  buildAccount({
    id: "2",
    company_name: "BNP Paribas",
    sector: "Banque & Services Financiers",
    employees: "~185 000",
    revenue: "~46 Md€",
    headquarters: "Paris 9ème",
    website: "https://group.bnpparibas",
    subsidiaries: ["BNP Paribas CIB", "Cardif"],
    it_challenges: ["Cloud hybride", "IA générative"],
    recent_signals: ["Lab IA créé"],
    priority_score: 8,
    priority_justification: "Budget IT massif",
    status: "completed",
    created_at: "2026-03-01T14:00:00Z",
    updated_at: "2026-03-01T14:05:00Z",
  }),
];
