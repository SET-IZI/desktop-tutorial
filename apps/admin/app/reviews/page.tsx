// Paramètres de visibilité des avis (PRD §8) : afficher les avis,
// la note et les photos — Oui / Non.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

interface ReviewSettings {
  showReviews: boolean;
  showRating: boolean;
  showPhotos: boolean;
}

async function getSettings(): Promise<ReviewSettings | null> {
  try {
    const res = await fetch(`${API_URL}/reviews/settings`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function ReviewsPage() {
  const settings = await getSettings();
  const rows = [
    { label: 'Afficher les avis', value: settings?.showReviews },
    { label: 'Afficher la note', value: settings?.showRating },
    { label: 'Afficher les photos', value: settings?.showPhotos },
  ];
  return (
    <>
      <h2>Avis clients</h2>
      <p style={{ color: '#9A9A9A' }}>Visibilité des avis dans l’application mobile.</p>
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
        {rows.map((row) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              background: '#2E2E2E',
              borderRadius: 14,
              padding: '14px 20px',
            }}
          >
            <span>{row.label}</span>
            <span style={{ color: '#C9A227', fontWeight: 700 }}>
              {row.value == null ? '—' : row.value ? 'Oui' : 'Non'}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
