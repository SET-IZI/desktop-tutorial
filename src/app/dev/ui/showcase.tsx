'use client';

import { motion } from 'framer-motion';
import { Bike, ChefHat, Moon, ShoppingBag, Sun, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { GlassBar } from '@/components/ui/glass-bar';
import { MeshGradient } from '@/components/ui/mesh-gradient';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Wordmark } from '@/components/ui/wordmark';
import { fadeUp } from '@/lib/motion';

const SWATCHES = [
  ['blue', 'bg-blue'],
  ['violet', 'bg-violet'],
  ['pink', 'bg-pink'],
  ['orange', 'bg-orange'],
  ['green', 'bg-green'],
] as const;

/** Vitrine interne des composants de base (phase 0). Non indexée. */
export function UiShowcase() {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);

  const toggleTheme = () => {
    const isDark =
      theme === 'dark' ||
      (theme === null && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const next = isDark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setTheme(next);
  };

  return (
    <div className="relative min-h-dvh pb-40">
      <GlassBar as="header" position="top" className="justify-between">
        <Wordmark className="px-2 text-[22px]" />
        <Button size="icon" variant="ghost" onClick={toggleTheme} aria-label="Changer de thème">
          {theme === 'dark' ? (
            <Sun className="size-5" aria-hidden />
          ) : (
            <Moon className="size-5" aria-hidden />
          )}
        </Button>
      </GlassBar>

      <main className="mx-auto max-w-5xl space-y-16 px-4 pt-12 sm:px-6">
        <section className="relative overflow-hidden rounded-bento-lg bg-surface px-6 py-16 shadow-soft sm:px-12">
          <MeshGradient />
          <div className="relative">
            <h1 className="text-display-sm sm:text-display-lg">Design system</h1>
            <p className="mt-3 max-w-lg text-fg">
              Tokens, composants de base et Liquid Glass. Un seul focus par écran, beaucoup
              d&apos;air.
            </p>
          </div>
        </section>

        <section aria-labelledby="buttons" className="space-y-4">
          <h2 id="buttons" className="text-display-sm">
            Boutons
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Commander</Button>
            <Button variant="secondary">Secondaire</Button>
            <Button variant="ghost">Discret</Button>
            <Button variant="destructive">Annuler la commande</Button>
            <Button loading>Paiement…</Button>
            <Button size="sm">Petit</Button>
            <Button size="lg">Grand</Button>
            <Button size="icon" variant="secondary" aria-label="Panier">
              <ShoppingBag className="size-5" aria-hidden />
            </Button>
          </div>
        </section>

        <section aria-labelledby="palette" className="space-y-4">
          <h2 id="palette" className="text-display-sm">
            Palette
          </h2>
          <div className="flex flex-wrap gap-3">
            {SWATCHES.map(([name, cls]) => (
              <div key={name} className="flex flex-col items-center gap-2">
                <span className={`size-16 rounded-bento-sm shadow-soft ${cls}`} />
                <span className="text-[13px] text-fg-muted">{name}</span>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="bento" className="space-y-4">
          <h2 id="bento" className="text-display-sm">
            Bento
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <motion.div {...fadeUp} className="sm:col-span-2">
              <Card tone="blue" className="h-full">
                <TrendingUp className="size-7 text-blue" aria-hidden />
                <p className="mt-6 text-display-sm">1 284 €</p>
                <CardDescription>Chiffre d&apos;affaires aujourd&apos;hui</CardDescription>
              </Card>
            </motion.div>
            <motion.div {...fadeUp}>
              <Card tone="orange" className="h-full">
                <ChefHat className="size-7 text-orange" aria-hidden />
                <p className="mt-6 text-display-sm">12</p>
                <CardDescription>En préparation</CardDescription>
              </Card>
            </motion.div>
            <motion.div {...fadeUp}>
              <Card interactive>
                <CardTitle>Carte surface</CardTitle>
                <CardDescription>Ombre diffuse, sans bordure.</CardDescription>
              </Card>
            </motion.div>
            <motion.div {...fadeUp} className="sm:col-span-2">
              <Card tone="green" className="h-full">
                <Bike className="size-7 text-green" aria-hidden />
                <CardTitle className="mt-6">Livraison en 24 min en moyenne</CardTitle>
                <CardDescription>Sur les 7 derniers jours.</CardDescription>
              </Card>
            </motion.div>
          </div>
        </section>

        <section aria-labelledby="sheet" className="space-y-4">
          <h2 id="sheet" className="text-display-sm">
            Bottom-sheet
          </h2>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary">Ouvrir la fiche produit</Button>
            </SheetTrigger>
            <SheetContent
              title="Burger du chef"
              description="Bœuf maturé, cheddar affiné, oignons confits."
            >
              <div className="space-y-4 pb-2 pt-4">
                <div className="aspect-[4/3] rounded-bento-sm bg-gradient-to-br from-orange/40 to-pink/40" />
                <p className="text-fg-muted">Les options et suppléments arrivent en phase 2.</p>
                <Button block>Ajouter · 14,50 €</Button>
              </div>
            </SheetContent>
          </Sheet>
        </section>
      </main>

      <GlassBar position="bottom" className="justify-between pl-5">
        <span className="font-semibold">Ton panier a l&apos;air délicieux</span>
        <Button size="sm">Voir le panier</Button>
      </GlassBar>
    </div>
  );
}
