import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { colors, radius, spacing, typography } from '../theme';

export function ProfileScreen() {
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => {
    api<{ points: number }>('/loyalty/balance')
      .then((b) => setPoints(b.points))
      .catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={typography.title}>Mon profil</Text>

      <View style={styles.card}>
        <Text style={typography.subtitle}>Programme fidélité</Text>
        <Text style={styles.points}>{points ?? '—'} points</Text>
        <Text style={typography.caption}>1 € dépensé = 1 point. Échangez vos points contre des réductions, des produits ou une coupe offerte.</Text>
      </View>

      <View style={styles.card}>
        <Text style={typography.subtitle}>Compte</Text>
        <Text style={typography.caption}>
          Connexion, informations personnelles et moyens de paiement — connectez-vous pour
          retrouver votre historique et vos réservations.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black, padding: spacing.md },
  card: {
    backgroundColor: colors.anthracite,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  points: { fontSize: 32, fontWeight: '700', color: colors.gold },
});
