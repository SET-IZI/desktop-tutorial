import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { DelayBadge } from '../components/DelayBadge';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, radius, spacing, typography } from '../theme';
import type { Barber, DelayStatus } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'BarberProfile'>;

type ApiProfile = {
  id: string;
  user: { firstName: string; lastName: string };
  avatarUrl?: string;
  bio?: string;
  yearsExperience: number;
  skillTags: string[];
  delayStatus: DelayStatus;
  galleryPhotos: { id: string; url: string }[];
};

type ApiStats = {
  totalClients: number;
  totalAppointments: number;
  averageRating: number | null;
  punctualityRate: number | null;
};

export function BarberProfileScreen({ route }: Props) {
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [stats, setStats] = useState<ApiStats | null>(null);

  useEffect(() => {
    api<ApiProfile>(`/barbers/${route.params.barberId}`).then(setProfile).catch(() => {});
    api<ApiStats>(`/barbers/${route.params.barberId}/stats`).then(setStats).catch(() => {});
  }, [route.params.barberId]);

  if (!profile) {
    return (
      <View style={styles.screen}>
        <Text style={typography.caption}>Chargement…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.md }}>
      <View style={styles.header}>
        <Image
          source={{ uri: profile.avatarUrl ?? 'https://placehold.co/120x120/2E2E2E/C9A227?text=💈' }}
          style={styles.avatar}
        />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={typography.title}>
            {profile.user.firstName} {profile.user.lastName}
          </Text>
          <Text style={typography.caption}>{profile.yearsExperience} ans d’expérience</Text>
          <DelayBadge status={profile.delayStatus} />
        </View>
      </View>

      {profile.bio && <Text style={[typography.body, styles.section]}>{profile.bio}</Text>}

      <View style={[styles.tags, styles.section]}>
        {profile.skillTags.map((tag) => (
          <Text key={tag} style={styles.tag}>
            {tag}
          </Text>
        ))}
      </View>

      {stats && (
        <View style={[styles.statsRow, styles.section]}>
          <Stat label="Clients" value={String(stats.totalClients)} />
          <Stat label="Prestations" value={String(stats.totalAppointments)} />
          <Stat label="Note" value={stats.averageRating ? `★ ${stats.averageRating.toFixed(1)}` : '—'} />
          <Stat label="Ponctualité" value={stats.punctualityRate != null ? `${stats.punctualityRate} %` : '—'} />
        </View>
      )}

      {profile.galleryPhotos.length > 0 && (
        <View style={styles.section}>
          <Text style={typography.subtitle}>Galerie</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
            {profile.galleryPhotos.map((photo) => (
              <Image key={photo.id} source={{ uri: photo.url }} style={styles.galleryPhoto} />
            ))}
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={typography.price}>{value}</Text>
      <Text style={typography.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  avatar: { width: 96, height: 96, borderRadius: radius.lg },
  section: { marginTop: spacing.lg },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    color: colors.gold,
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.anthracite,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  stat: { flex: 1, alignItems: 'center', gap: spacing.xs },
  galleryPhoto: { width: 120, height: 120, borderRadius: radius.md, marginRight: spacing.sm },
});
