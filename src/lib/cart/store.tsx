'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Fulfillment, MenuCategory } from '@/lib/storefront/types';
import { MAX_QUANTITY, reconcileCart, type CartLine } from './lines';

export interface CartState {
  fulfillment: Fulfillment;
  /** Début du créneau choisi (ISO), null tant qu'il n'est pas choisi. */
  slot: string | null;
  lines: CartLine[];
  add: (line: CartLine) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setFulfillment: (fulfillment: Fulfillment) => void;
  setSlot: (slot: string | null) => void;
  replaceLines: (lines: CartLine[]) => void;
}

export function cartStorageKey(slug: string) {
  return `miaamm:cart:${slug}`;
}

export function createCartStore(slug: string, defaultFulfillment: Fulfillment) {
  return createStore<CartState>()(
    persist(
      (set) => ({
        fulfillment: defaultFulfillment,
        slot: null,
        lines: [],
        add: (line) =>
          set((s) => {
            const existing = s.lines.find((l) => l.key === line.key);
            if (!existing) return { lines: [...s.lines, line] };
            return {
              lines: s.lines.map((l) =>
                l.key === line.key
                  ? { ...l, quantity: Math.min(MAX_QUANTITY, l.quantity + line.quantity) }
                  : l,
              ),
            };
          }),
        setQuantity: (key, quantity) =>
          set((s) => ({
            lines:
              quantity <= 0
                ? s.lines.filter((l) => l.key !== key)
                : s.lines.map((l) =>
                    l.key === key ? { ...l, quantity: Math.min(MAX_QUANTITY, quantity) } : l,
                  ),
          })),
        remove: (key) => set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),
        clear: () => set({ lines: [], slot: null }),
        setFulfillment: (fulfillment) => set({ fulfillment, slot: null }),
        setSlot: (slot) => set({ slot }),
        replaceLines: (lines) => set({ lines }),
      }),
      {
        name: cartStorageKey(slug),
        version: 1,
        storage: createJSONStorage(() => localStorage),
        partialize: (s) => ({ fulfillment: s.fulfillment, slot: s.slot, lines: s.lines }),
        // Réhydratation manuelle après le montage : pas d'écart SSR/client.
        skipHydration: true,
      },
    ),
  );
}

type CartStore = ReturnType<typeof createCartStore>;

interface CartContextValue {
  store: CartStore;
  hydrated: boolean;
  /** Produits retirés à la réhydratation (rupture, disparus). */
  removed: string[];
}

const CartContext = createContext<CartContextValue | null>(null);

interface CartProviderProps {
  slug: string;
  categories: MenuCategory[];
  fulfillments: Fulfillment[];
  children: React.ReactNode;
}

export function CartProvider({ slug, categories, fulfillments, children }: CartProviderProps) {
  const storeRef = useRef<CartStore>();
  storeRef.current ??= createCartStore(slug, fulfillments[0] ?? 'pickup');
  const store = storeRef.current;
  const [hydrated, setHydrated] = useState(false);
  const [removed, setRemoved] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(store.persist.rehydrate())
      .catch(() => undefined) // stockage indisponible (navigation privée) : panier en mémoire
      .finally(() => {
        if (cancelled) return;
        const state = store.getState();
        const result = reconcileCart(state.lines, categories);
        if (result.removed.length > 0) state.replaceLines(result.lines);
        else if (JSON.stringify(result.lines) !== JSON.stringify(state.lines))
          state.replaceLines(result.lines);
        if (!fulfillments.includes(state.fulfillment) && fulfillments[0]) {
          state.setFulfillment(fulfillments[0]);
        }
        setRemoved(result.removed);
        setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [store, categories, fulfillments]);

  return (
    <CartContext.Provider value={{ store, hydrated, removed }}>{children}</CartContext.Provider>
  );
}

function useCartContext(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart doit être utilisé dans <CartProvider>.');
  return ctx;
}

export function useCart<T>(selector: (state: CartState) => T): T {
  return useStore(useCartContext().store as StoreApi<CartState>, selector);
}

export function useCartMeta() {
  const { hydrated, removed } = useCartContext();
  return { hydrated, removed };
}
