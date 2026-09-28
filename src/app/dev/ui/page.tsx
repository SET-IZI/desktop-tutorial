import type { Metadata } from 'next';
import { UiShowcase } from './showcase';

export const metadata: Metadata = {
  title: 'Design system',
  robots: { index: false, follow: false },
};

export default function DevUiPage() {
  return <UiShowcase />;
}
