// Gestion des tarifs dynamiques (PRD §4) — liste les règles depuis l'API.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

interface PricingRule {
  id: string;
  type: string;
  label: string;
  active: boolean;
  fixedPriceCents: number | null;
  surchargePercent: number | null;
  startHour: number | null;
}

async function getRules(): Promise<PricingRule[]> {
  try {
    const res = await fetch(`${API_URL}/admin/pricing-rules`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function PricingPage() {
  const rules = await getRules();
  return (
    <>
      <h2>Tarifs dynamiques</h2>
      <p style={{ color: '#9A9A9A' }}>
        Tarifs soirée, nuit, week-end, jours fériés, urgence et prix personnalisés.
      </p>
      <table style={{ width: '100%', marginTop: 24, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#C9A227' }}>
            <th style={{ padding: 8 }}>Règle</th>
            <th style={{ padding: 8 }}>Type</th>
            <th style={{ padding: 8 }}>Effet</th>
            <th style={{ padding: 8 }}>Statut</th>
          </tr>
        </thead>
        <tbody>
          {rules.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: 16, color: '#9A9A9A' }}>
                Aucune règle chargée — vérifiez que l’API est démarrée et seedée.
              </td>
            </tr>
          )}
          {rules.map((rule) => (
            <tr key={rule.id} style={{ borderTop: '1px solid #2E2E2E' }}>
              <td style={{ padding: 8 }}>{rule.label}</td>
              <td style={{ padding: 8 }}>{rule.type}</td>
              <td style={{ padding: 8 }}>
                {rule.fixedPriceCents != null
                  ? `${(rule.fixedPriceCents / 100).toFixed(2)} € fixe`
                  : rule.surchargePercent != null
                    ? `+${rule.surchargePercent} %`
                    : '—'}
              </td>
              <td style={{ padding: 8 }}>{rule.active ? '🟢 Active' : '⚪ Inactive'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
