/** « N° de facture » → « n_de_facture » : clé technique proposée à partir du libellé. */
export function slugKey(label: string): string {
  const base = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return /^[a-z]/.test(base) ? base : base ? `champ_${base}`.slice(0, 40) : '';
}
