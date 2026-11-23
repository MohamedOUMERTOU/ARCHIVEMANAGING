/** Sections du paramétrage et permission requise pour chacune. */
export const SETTINGS_TABS = [
  { to: 'plan', label: 'Plan de classement', permission: 'classification.manage' },
  { to: 'types', label: 'Types de document', permission: 'settings.manage' },
  { to: 'regles', label: 'Règles de conservation', permission: 'settings.manage' },
  { to: 'tags', label: 'Tags', permission: 'settings.manage' },
  { to: 'utilisateurs', label: 'Utilisateurs & rôles', permission: 'settings.manage' },
  { to: 'stockage', label: 'Stockage', permission: 'settings.manage' },
] as const;
