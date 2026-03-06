export function generateCSV(contacts: any[], companyName: string): string {
  const headers = [
    'Nom',
    'Poste',
    'Entité',
    'Rôle décisionnel',
    'Priorité',
    'Email',
    'Téléphone',
    'LinkedIn',
    'Résumé profil',
    'Pourquoi le contacter',
    'Message email (objet)',
    'Message email (corps)',
    'Message LinkedIn',
    'Message relance (objet)',
    'Message relance (corps)',
    'Statut',
  ];

  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = contacts.map(c => [
    c.full_name,
    c.title,
    c.entity,
    c.decision_role,
    c.priority,
    c.email,
    c.phone,
    c.linkedin_url,
    c.profile_summary,
    c.why_contact,
    c.email_message?.subject,
    c.email_message?.body,
    c.linkedin_message,
    c.followup_message?.subject,
    c.followup_message?.body,
    c.user_status,
  ].map(escapeCSV).join(','));

  // BOM UTF-8 pour que Excel ouvre correctement les accents français
  return '\uFEFF' + [headers.join(','), ...rows].join('\n');
}

export function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
