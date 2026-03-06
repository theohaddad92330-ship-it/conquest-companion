// Single source of truth for credits across the app
export const credits = {
  used: 12,
  total: 20,
  contactsUsed: 142,
  contactsTotal: 200,
  plan: "PRO" as const,
  pricePerMonth: 249,
  renewalDate: "1er avril 2026",
};

export function creditsRemaining() {
  return credits.total - credits.used;
}

export function creditsPercentage() {
  return Math.round((credits.used / credits.total) * 100);
}

export function contactsPercentage() {
  return Math.round((credits.contactsUsed / credits.contactsTotal) * 100);
}
