import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, formatPrice } from '../api/client';
import { colors, radius, spacing, typography } from '../theme';
import type { Product } from '../types';

const CATEGORIES: { key: Product['category'] | null; label: string }[] = [
  { key: null, label: 'Tous' },
  { key: 'CIRE', label: 'Cires' },
  { key: 'POMMADE', label: 'Pommades' },
  { key: 'HUILE_BARBE', label: 'Huiles à barbe' },
  { key: 'SHAMPOING', label: 'Shampoings' },
  { key: 'ACCESSOIRE', label: 'Accessoires' },
];

// PRD §9 — vitrine e-commerce intégrée
export function ShopScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<Product['category'] | null>(null);

  useEffect(() => {
    api<Product[]>(`/products${category ? `?category=${category}` : ''}`)
      .then(setProducts)
      .catch(() => {});
  }, [category]);

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={typography.title}>Boutique</Text>
      <View style={styles.filters}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.label}
            style={[styles.filter, category === c.key && styles.filterActive]}
            onPress={() => setCategory(c.key)}
          >
            <Text style={[styles.filterText, category === c.key && { color: colors.black }]}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image
              source={{ uri: item.photoUrls[0] ?? 'https://placehold.co/200x200/2E2E2E/C9A227?text=🛍️' }}
              style={styles.photo}
            />
            <Text style={typography.body} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={typography.price}>{formatPrice(item.priceCents)}</Text>
            <Text style={typography.caption}>
              {item.stock > 0 ? `${item.stock} en stock` : 'Rupture de stock'}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={typography.caption}>Aucun produit dans cette catégorie.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black, padding: spacing.md },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.md },
  filter: {
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  filterActive: { backgroundColor: colors.gold },
  filterText: { color: colors.gold, fontSize: 12, fontWeight: '600' },
  card: {
    flex: 1,
    backgroundColor: colors.anthracite,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  photo: { width: '100%', aspectRatio: 1, borderRadius: radius.sm },
});
