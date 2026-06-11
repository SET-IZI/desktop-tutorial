// Tableau de bord administrateur (PRD §14) — CA global, prestations
// populaires, produits les plus vendus, barbiers les plus réservés.
// Les cartes seront branchées sur l'API (/api/v1/admin/stats) une fois
// les endpoints de statistiques agrégées en place.

const cards = [
  { label: 'CA global (mois)', value: '—' },
  { label: 'Réservations (mois)', value: '—' },
  { label: 'Prestation populaire', value: '—' },
  { label: 'Produit le plus vendu', value: '—' },
  { label: 'Barber le plus réservé', value: '—' },
  { label: 'Note moyenne salon', value: '—' },
];

export default function DashboardPage() {
  return (
    <>
      <h2>Tableau de bord</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 24 }}>
        {cards.map((card) => (
          <div key={card.label} style={{ background: '#2E2E2E', borderRadius: 14, padding: 20 }}>
            <div style={{ color: '#9A9A9A', fontSize: 13 }}>{card.label}</div>
            <div style={{ color: '#C9A227', fontSize: 28, fontWeight: 700, marginTop: 8 }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
