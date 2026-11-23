import 'i18next';
import type { defaultNS } from './index';
import type { fr } from './locales/fr/common';

// Les clés de traduction sont vérifiées par TypeScript : t('nav.typo') ne compile pas
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: { common: typeof fr };
  }
}
