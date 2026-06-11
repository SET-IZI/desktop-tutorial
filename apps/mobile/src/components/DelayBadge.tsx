import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import type { DelayStatus } from '../types';

// PRD §5 — indicateur de retard visible directement sur l'application
const STATUS: Record<DelayStatus, { label: string; color: string }> = {
  ON_TIME: { label: 'À l’heure', color: colors.success },
  DELAY_5: { label: '5 min de retard', color: colors.warning },
  DELAY_10: { label: '10 min de retard', color: colors.warning },
  DELAY_15: { label: '15 min de retard', color: colors.danger },
  DELAY_15_PLUS: { label: '+15 min de retard', color: colors.danger },
  ABSENT: { label: 'Absent', color: colors.muted },
};

export function DelayBadge({ status }: { status: DelayStatus }) {
  const { label, color } = STATUS[status];
  return (
    <View style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.black,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs },
  label: { color: colors.white, fontSize: 12 },
});
