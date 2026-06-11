import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, formatPrice } from '../api/client';
import { colors, radius, spacing, typography } from '../theme';
import type { Service, Slot } from '../types';

// Flow de réservation (PRD §3) : prestation → barber (ou premier
// disponible) → créneau, avec le prix dynamique affiché par créneau.
export function BookingScreen() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    api<Service[]>('/services').then(setServices).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedService) return;
    setLoadingSlots(true);
    const today = new Date().toISOString().slice(0, 10);
    api<Slot[]>(`/bookings/availability?date=${today}&serviceId=${selectedService.id}`)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedService]);

  const book = (slot: Slot) => {
    if (!selectedService) return;
    api('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        barberId: slot.barberId,
        serviceIds: [selectedService.id],
        startsAt: slot.startsAt,
      }),
    })
      .then(() => Alert.alert('Réservation confirmée ✂️', `${slot.barberName} — ${formatPrice(slot.priceCents)}`))
      .catch((e: Error) => Alert.alert('Impossible de réserver', e.message));
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={typography.title}>Réserver</Text>

      <Text style={[typography.subtitle, styles.sectionTitle]}>1. Choisissez votre prestation</Text>
      <View style={styles.services}>
        {services.map((service) => (
          <Pressable
            key={service.id}
            style={[styles.serviceChip, selectedService?.id === service.id && styles.serviceChipActive]}
            onPress={() => setSelectedService(service)}
          >
            <Text
              style={[
                styles.serviceChipText,
                selectedService?.id === service.id && { color: colors.black },
              ]}
            >
              {service.name} · {formatPrice(service.basePriceCents)}
            </Text>
          </Pressable>
        ))}
      </View>

      {selectedService && (
        <>
          <Text style={[typography.subtitle, styles.sectionTitle]}>
            2. Choisissez un créneau aujourd’hui
          </Text>
          {loadingSlots && <Text style={typography.caption}>Recherche des disponibilités…</Text>}
          <FlatList
            data={slots}
            keyExtractor={(s) => `${s.barberId}-${s.startsAt}`}
            renderItem={({ item }) => (
              <Pressable style={styles.slot} onPress={() => book(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.body}>
                    {new Date(item.startsAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    — {item.barberName}
                  </Text>
                  {item.appliedRules.length > 0 && (
                    <Text style={typography.caption}>{item.appliedRules.join(' + ')}</Text>
                  )}
                </View>
                <Text style={typography.price}>{formatPrice(item.priceCents)}</Text>
              </Pressable>
            )}
            ListEmptyComponent={
              !loadingSlots ? (
                <Text style={typography.caption}>Aucun créneau disponible aujourd’hui.</Text>
              ) : null
            }
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black, padding: spacing.md },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.sm },
  services: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  serviceChip: {
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  serviceChipActive: { backgroundColor: colors.gold },
  serviceChipText: { color: colors.gold, fontSize: 13, fontWeight: '600' },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.anthracite,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
});
