import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import type { Barber } from '../types';
import { DelayBadge } from './DelayBadge';

export function BarberCard({ barber, onPress }: { barber: Barber; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={onPress}>
      <Image
        source={{ uri: barber.avatarUrl ?? 'https://placehold.co/96x96/2E2E2E/C9A227?text=💈' }}
        style={styles.avatar}
      />
      <View style={styles.info}>
        <Text style={typography.subtitle}>
          {barber.firstName} {barber.lastName}
        </Text>
        <Text style={typography.caption} numberOfLines={1}>
          {barber.skillTags.join(' · ')}
        </Text>
        <View style={styles.row}>
          <DelayBadge status={barber.delayStatus} />
          {barber.averageRating != null && (
            <Text style={styles.rating}>★ {barber.averageRating.toFixed(1)}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.anthracite,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  avatar: { width: 64, height: 64, borderRadius: radius.md, marginRight: spacing.md },
  info: { flex: 1, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rating: { color: colors.gold, fontWeight: '600' },
});
