import { useEffect, useState } from 'react';
import { FlatList, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, formatPrice } from '../api/client';
import { colors, radius, spacing, typography } from '../theme';
import type { Appointment } from '../types';

type ApiAppointment = {
  id: string;
  startsAt: string;
  totalPriceCents: number;
  barber: { user: { firstName: string; lastName: string } };
  services: { service: { name: string } }[];
  photos: { id: string; url: string; label?: string }[];
};

// PRD §7 — galerie "Mes Coupes" : historique visuel de toutes les prestations
export function MyCutsScreen() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    api<ApiAppointment[]>('/bookings/history')
      .then((data) =>
        setAppointments(
          data.map((a) => ({
            id: a.id,
            startsAt: a.startsAt,
            totalPriceCents: a.totalPriceCents,
            barberName: `${a.barber.user.firstName} ${a.barber.user.lastName}`,
            serviceNames: a.services.map((s) => s.service.name),
            photos: a.photos,
          })),
        ),
      )
      .catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={typography.title}>Mes Coupes</Text>
      <Text style={[typography.caption, { marginBottom: spacing.lg }]}>
        Retrouvez toutes vos anciennes coupes en photo.
      </Text>
      <FlatList
        data={appointments}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={typography.subtitle}>
              {item.serviceNames.join(' + ')} du{' '}
              {new Date(item.startsAt).toLocaleDateString('fr-FR')}
            </Text>
            <Text style={typography.caption}>
              {item.barberName} · {formatPrice(item.totalPriceCents)}
            </Text>
            {item.photos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
                {item.photos.map((photo) => (
                  <View key={photo.id} style={{ marginRight: spacing.sm }}>
                    <Image source={{ uri: photo.url }} style={styles.photo} />
                    {photo.label && <Text style={typography.caption}>{photo.label}</Text>}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}
        ListEmptyComponent={
          <Text style={typography.caption}>
            Vos photos de prestation apparaîtront ici après votre premier rendez-vous.
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black, padding: spacing.md },
  card: {
    backgroundColor: colors.anthracite,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  photo: { width: 110, height: 110, borderRadius: radius.sm },
});
