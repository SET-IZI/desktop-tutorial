#!/usr/bin/env node
/**
 * Aperçu statique de la boutique : un seul fichier HTML autonome (JS + CSS inline),
 * publiable comme Artifact ou ouvrable sans serveur.
 *
 *   pnpm preview:build [slug]   → .preview/<slug>.html
 *
 * Prérequis : base de démo (`pnpm db:reset`) et `pnpm supabase:lite` en route.
 * Les mêmes composants React que l'app ; seuls next/link, next/image et next-intl
 * sont remplacés, et les créneaux sont calculés dans le navigateur.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, '.preview');
const slug = process.argv[2] ?? 'chez-mimi';
mkdirSync(OUT, { recursive: true });

// 1. Données de la boutique, lues via la vraie requête Supabase.
const data = execFileSync(
  'pnpm',
  ['exec', 'tsx', '--env-file=.env.local', 'scripts/preview/dump-data.ts', slug],
  { cwd: ROOT, encoding: 'utf8' },
);
const storefront = JSON.parse(data);

// 2. CSS : les tokens et utilitaires de l'app, polices via Google Fonts (CSP de l'Artifact).
const globals = readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8').replace(
  /^@import '@fontsource.*$/gm,
  '',
);
writeFileSync(
  path.join(OUT, 'styles.css'),
  `${globals}
@layer base {
  :root { --font-sans: 'Figtree'; }
  .font-rounded { font-family: 'Nunito', ui-rounded, system-ui, sans-serif; }
}
`,
);
execFileSync(
  'pnpm',
  [
    'exec',
    'tailwindcss',
    '-i',
    '.preview/styles.css',
    '-o',
    '.preview/app.css',
    '--minify',
    '--content',
    './src/**/*.{ts,tsx},./scripts/preview/**/*.tsx',
  ],
  {
    cwd: ROOT,
    stdio: 'inherit',
  },
);
const css = readFileSync(path.join(OUT, 'app.css'), 'utf8');

// 3. JS : les composants de la boutique, sans Next.js.
const require = createRequire(import.meta.url);
const useIntl = require.resolve('use-intl', {
  paths: [path.join(realpathSync(path.join(ROOT, 'node_modules/next-intl')), '..')],
});
const result = await build({
  entryPoints: [path.join(ROOT, 'scripts/preview/entry.tsx')],
  bundle: true,
  minify: true,
  write: false,
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic',
  define: {
    'process.env.NODE_ENV': '"production"',
    __STOREFRONT__: JSON.stringify(storefront),
  },
  plugins: [
    {
      name: 'preview-shims',
      setup(b) {
        b.onResolve({ filter: /^next-intl$/ }, () => ({ path: useIntl }));
        b.onResolve({ filter: /^next\/link$/ }, () => ({
          path: path.join(ROOT, 'scripts/preview/shims.tsx'),
        }));
        b.onResolve({ filter: /^next\/image$/ }, () => ({
          path: path.join(ROOT, 'scripts/preview/image-shim.tsx'),
        }));
      },
    },
  ],
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

// 4. Page (le squelette <html>/<head>/<body> est ajouté par l'hébergeur d'Artifact).
const { restaurant } = storefront;
const html = `<title>${restaurant.name} sur Miaamm</title>
<meta name="description" content="Aperçu de la boutique ${restaurant.name} sur Miaamm">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400..800&family=Nunito:wght@800&display=swap">
<style>${css}</style>
<div id="miaamm-root"></div>
<script>${js}</script>
`;
const file = path.join(OUT, `${slug}.html`);
writeFileSync(file, html);
console.log(`✓ ${path.relative(ROOT, file)} (${Math.round(html.length / 1024)} Ko)`);
