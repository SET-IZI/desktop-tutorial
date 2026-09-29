import { getTranslations } from 'next-intl/server';

// Remplacé par l'éditeur de carte (phase 4b).
export default async function MenuPage() {
  const t = await getTranslations('admin.nav');
  return <h1 className="text-display-sm">{t('menu')}</h1>;
}
