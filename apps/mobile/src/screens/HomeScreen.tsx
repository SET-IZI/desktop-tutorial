import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { BarberCard } from '../components/BarberCard';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, spacing, typography } from '../theme';
import type { Barber } from '../types';

type ApiBarber = {
  id: string;
  user: { firstName: string; lastName: string };
  avatarUrl?: string;
  skillTags: string[];
  delayStatus: Barber['delayStatus'];
  yearsExperience: number;
  bio?: string;
};

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<ApiBarber[]>('/barbers')
      .then((data) =>
        setBarbers(
          data.map((b) => ({
            id: b.id,
            firstName: b.user.firstName,
            lastName: b.user.lastName,
            avatarUrl: b.avatarUrl,
            skillTags: b.skillTags,
            delayStatus: b.delayStatus,
            yearsExperience: b.yearsExperience,
            bio: b.bio,
          })),
        ),
      )
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={typography.title}>BarberPro</Text>
      <Text style={[typography.caption, { marginBottom: spacing.lg }]}>
        Réservez votre barber, suivez son statut en temps réel.
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={barbers}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => (
          <BarberCard
            barber={item}
            onPress={() => navigation.navigate('BarberProfile', { barberId: item.id })}
          />
        )}
        ListEmptyComponent={
          !error ? <Text style={typography.caption}>Chargement des barbiers…</Text> : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black, padding: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.md },
});
