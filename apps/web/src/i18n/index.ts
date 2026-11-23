import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en/common';
import { fr } from './locales/fr/common';

export const defaultNS = 'common';
export const resources = { fr: { common: fr }, en: { common: en } } as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'fr',
  fallbackLng: 'fr',
  defaultNS,
  // React échappe déjà le texte affiché
  interpolation: { escapeValue: false },
});

export default i18n;
