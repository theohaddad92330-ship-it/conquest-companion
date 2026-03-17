/**
 * Copy personnalisée type "conseiller expert" : interpellation, orientation action,
 * référence au questionnaire (geo, taille, défi). Ton Jarvis : précis, pas startup.
 */

export type OnboardingSlice = {
  size?: string;
  geo?: string[];
  sectors?: string[];
  mainChallenge?: string;
  salesTeamSize?: string;
  offers?: string[];
  personas?: string[];
};

function safe(s: unknown): string {
  if (s == null) return "";
  return String(s).trim();
}

/** Prénom ou fallback neutre */
export function getFirstName(displayName: string | null | undefined): string {
  if (!displayName) return "";
  const parts = displayName.split(/\s+/);
  return parts[0] || "";
}

/** Intro tableau de bord : situation + ce qu'on va faire */
export function getDashboardIntro(firstName: string, onboarding: OnboardingSlice): string {
  const pre = firstName ? `Si j'étais à ta place, ${firstName}, ` : "Voici ta situation : ";
  const size = safe(onboarding.size);
  const challenge = safe(onboarding.mainChallenge);
  if (size && challenge) {
    return `${pre}avec une ESN ${size} et un défi prioritaire comme « ${challenge} », l'idée est de savoir où investir ton temps. En dessous : ton périmètre, tes priorités à attaquer, et les signaux à ne pas rater.`;
  }
  if (firstName) {
    return `${pre}l'objectif de ce cockpit est de te dire quoi faire maintenant : qui relancer, quels comptes attaquer en premier, quels signaux exploiter. Tout est dérivé de tes comptes et de ton profil.`;
  }
  return "Décidez quoi faire maintenant : qui relancer, où entrer, et quoi envoyer. Le cockpit s'appuie sur vos comptes et votre profil.";
}

/** Tip périmètre : focus géo / secteurs selon questionnaire */
export function getPerimeterTip(onboarding: OnboardingSlice): string {
  const geo = Array.isArray(onboarding.geo) ? onboarding.geo : [];
  const sectors = Array.isArray(onboarding.sectors) ? onboarding.sectors : [];
  const hasGeo = geo.length > 0 && geo.some((g) => safe(g) && safe(g) !== "—");
  const hasSectors = sectors.length > 0 && sectors.some((s) => safe(s) && safe(s) !== "—");
  if (hasGeo && hasSectors) {
    const geoLabel = geo.slice(0, 2).map((g) => safe(g)).filter(Boolean).join(", ");
    return `Vu tes réponses au questionnaire : on focus sur ${geoLabel} et les secteurs que tu cibles. Les comptes hors périmètre sont listés mais priorise ceux dans la barre.`;
  }
  if (hasGeo) {
    const geoLabel = geo.slice(0, 2).map((g) => safe(g)).filter(Boolean).join(", ");
    return `Tu as indiqué une zone prioritaire (${geoLabel}). Les recommandations de portes d'entrée et de comptes tiennent compte de ce focus.`;
  }
  if (hasSectors) {
    return "Complète ta zone géo dans le profil pour qu'on te recommande des portes d'entrée et des angles adaptés à ton territoire.";
  }
  return "Complétez le profil (zone géo, secteurs) pour des recommandations ultra ciblées — par ex. « oublie Paris, focus région Lille » si c'est ton périmètre.";
}

/** Astuce recherche : standards + où chercher */
export function getSearchTip(onboarding: OnboardingSlice): string {
  const geo = Array.isArray(onboarding.geo) ? onboarding.geo : [];
  const hasGeo = geo.length > 0 && geo.some((g) => safe(g) && safe(g) !== "—");
  if (hasGeo) {
    const g = geo.map((x) => safe(x)).filter(Boolean)[0];
    return `Standard à viser : au moins 1 compte prêt à lancer par mois. Ici, on te propose les comptes score 8–10 ou avec signaux utiles. Priorise ceux dans ta zone (${g}) si tu l'as renseignée.`;
  }
  return "Astuce : vise au moins un compte « prêt » par mois. Démarre par les comptes 8–10 ou ceux qui ont des signaux à citer en premier message.";
}

/** Section « À faire maintenant » */
export function getNextActionSectionTip(firstName: string, hasAnalyzing: boolean, hasErrored: boolean): string {
  if (hasAnalyzing) {
    return firstName
      ? `${firstName}, les analyses en cours apparaissent ici. Une fois terminées, passe sur la fiche pour les portes d'entrée et les messages.`
      : "Les analyses en cours apparaissent ici. Une fois terminées, ouvrez la fiche pour les portes d'entrée et les messages.";
  }
  if (hasErrored) {
    return firstName
      ? "Des comptes sont en erreur : relance l'analyse ou vérifie le nom. On peut aussi te proposer une autre cible dans ton périmètre."
      : "Des comptes sont en erreur. Relancez l'analyse ou vérifiez le nom du compte.";
  }
  return firstName
    ? "Aucune analyse en cours. Lance une nouvelle recherche pour alimenter le cockpit — on te guidera sur les portes d'entrée selon ton profil."
    : "Aucune analyse en cours. Lancez une nouvelle recherche pour alimenter le cockpit.";
}

/** Intro Scoring business (fiche compte) */
export function getScoringIntro(firstName: string, companyName: string, onboarding: OnboardingSlice): string {
  const pre = firstName ? `Si j'étais à ta place, ${firstName}, ` : "";
  const size = safe(onboarding.size);
  const challenge = safe(onboarding.mainChallenge);
  if (size) {
    return `${pre}pour ce compte (${companyName}), voici le score, les facteurs de décision et la stratégie pour l'ouvrir. Tout est calibré pour une ESN ${size}. ${challenge ? `Vu ton défi prioritaire (« ${challenge} »), les portes d'entrée et la recommandation en tiennent compte.` : "Utilise la recommandation GO/NO-GO et les portes d'entrée pour prioriser tes actions."}`;
  }
  return `${pre} cette vue consolide le score de ${companyName}, les facteurs de décision, la recommandation GO/NO-GO et la stratégie pour ouvrir le compte. Utilise-la pour prioriser tes actions et choisir les bonnes portes d'entrée.`;
}

/** Tip « Comment ouvrir ce compte » */
export function getOuvrirCompteTip(firstName: string, onboarding: OnboardingSlice): string {
  const geo = Array.isArray(onboarding.geo) ? onboarding.geo : [];
  const hasGeo = geo.length > 0 && geo.some((g) => safe(g) && safe(g) !== "—");
  if (firstName && hasGeo) {
    const g = geo.map((x) => safe(x)).filter(Boolean).join(", ");
    return `Stratégie d'entrée et portes d'entrée pour ce compte, alignées sur ton profil. ${firstName}, on a privilégié les angles cohérents avec ta zone (${g}) et tes personas.`;
  }
  return "Stratégie d'entrée et portes d'entrée recommandées pour ce compte, en cohérence avec le score et votre profil ESN.";
}

/** Queue d'actions vide */
export function getQueueEmptyTip(firstName: string): string {
  return firstName
    ? "Aucun compte prêt à être piloté pour l'instant. Lance une analyse : dès qu'un compte est prêt, il apparaîtra ici avec une prochaine action proposée."
    : "Aucun compte prêt à être piloté. Lancez une analyse pour alimenter ce cockpit.";
}

/** Signaux inbox vide */
export function getSignalsEmptyTip(firstName: string): string {
  return firstName
    ? "Aucun signal détecté pour l'instant. Dès que tu lanceras des analyses, les signaux (nominations, projets, budgets) remonteront ici — priorise ceux des comptes 8–10 pour relancer au bon moment."
    : "Aucun signal détecté pour l'instant. Lancez des analyses : les signaux (nominations, projets, budgets) apparaîtront ici.";
}

/** Idée bonus type Jarvis (event, pub, etc.) — à placer une seule fois pour ne pas surcharger */
export function getJarvisBonusTip(onboarding: OnboardingSlice): string | null {
  const size = safe(onboarding.size);
  const team = safe(onboarding.salesTeamSize);
  if (size && (size.includes("1-20") || size.includes("0-20") || size.includes("petite"))) {
    return "Tu as déjà pensé à organiser un événement (webinar, petit-déj) avec des consultants pour générer des leads qualifiés ? Ou à cibler une poignée de comptes en « account-based » pour maximiser l'impact ?";
  }
  if (team && parseInt(team, 10) <= 2) {
    return "Avec une petite équipe commerciale, prioriser 3–5 comptes « prêts » par mois et les traiter à fond donne souvent de meilleurs résultats qu'éparpiller les efforts.";
  }
  return null;
}
