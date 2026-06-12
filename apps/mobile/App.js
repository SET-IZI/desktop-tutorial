// BarberPro — application mobile (démo autonome, sans serveur)
// Deux interfaces reliées par un agenda partagé :
//  · Client : recherche par position & style, réservation dans les créneaux ouverts
//  · Barber : ouverture des créneaux, formules de rendez-vous, planning, statut, activité
// Design premium : noir profond, or champagne, serif élégante.
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';

/* ───────── Thème ───────── */
const C = {
  bg: '#0A0A0B',
  surface: '#131316',
  surface2: '#1B1B20',
  line: 'rgba(255,255,255,0.08)',
  lineGold: 'rgba(200,169,106,0.32)',
  gold: '#C8A96A',
  gold2: '#E6CFA0',
  ink: '#0E0D0B',
  text: '#F1EEE7',
  muted: '#908D86',
  soft: '#A5A29B',
  green: '#7FB98F',
  orange: '#D9A05B',
  red: '#C97B6E',
  gray: '#76736D',
};
const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });
const SCREEN_W = Dimensions.get('window').width;
const PAD = 20;
const PCARD_W = Math.floor((Math.min(SCREEN_W, 500) - PAD * 2 - 11) / 2);
const SLOT_W = Math.floor((Math.min(SCREEN_W, 500) - PAD * 2 - 16) / 3);
const SMALL = SCREEN_W < 370;

/* ───────── Données de démonstration ───────── */
const TEX = ['#211D15', '#181B20', '#1F1715', '#161B17'];
const COVER_COLORS = [
  '#211D15', '#181B20', '#1F1715', '#161B17',
  '#1A1520', '#151A18', '#0F1520', '#1A1810',
  '#1C1014', '#0E1518',
];

const DELAY = {
  ON_TIME: { dot: C.green, label: 'À l’heure' },
  DELAY_5: { dot: C.orange, label: '5 min de retard' },
  DELAY_10: { dot: C.orange, label: '10 min de retard' },
  DELAY_15: { dot: C.red, label: '15 min de retard' },
  DELAY_15_PLUS: { dot: C.red, label: 'Plus de 15 min' },
  ABSENT: { dot: C.gray, label: 'Absent' },
};

// Styles de coupe recherchables
const STYLES = [
  'Fade', 'Burst Fade', 'Taper', 'Transformation', 'Dégradé américain',
  'Coupe afro', 'Locks', 'Barbe', 'Rasage traditionnel', 'Hair Design', 'Coloration',
];

// Lieu d’exercice — affiché en badge sur les fiches
const VENUES = { salon: 'En salon', studio: 'Studio privé', domicile: 'À domicile' };

const BARBERS = [
  {
    id: 'enzo', name: 'Enzo Moreau', ini: 'EM', tex: 0, years: 8, rating: '4,9',
    salon: 'BarberPro — Le Salon', city: 'Lille Centre', dist: 0.8,
    venue: 'salon', address: '12 rue Nationale, 59000 Lille',
    clients: '1 240', prestations: '3 680', ponct: 97, delay: 'ON_TIME',
    shopEnabled: true, loyalty: true,
    tags: ['Burst Fade', 'Fade', 'Dégradé américain', 'Barbe'],
    bio: 'Spécialiste du burst fade et du dégradé américain depuis huit ans. Précision du trait, finitions au rasoir.',
    story: 'Tout a commencé à 16 ans, une tondeuse à la main, dans le garage familial. Après un CAP coiffure et cinq ans dans les salons du Vieux-Lille, j’ai rejoint BarberPro pour y imposer ma signature : des dégradés au millimètre, jamais pressés, toujours finis au rasoir. Chaque client repart avec des conseils d’entretien personnalisés.',
    photos: [
      { id: 'ph1', label: 'Burst Fade', tex: 0 },
      { id: 'ph2', label: 'Dégradé', tex: 1 },
      { id: 'ph3', label: 'Barbe', tex: 2 },
      { id: 'ph4', label: 'Finitions', tex: 3 },
    ],
    reviews: [
      { who: 'Karim', note: 5, txt: 'Le meilleur burst fade de la ville. Je ne vais plus nulle part ailleurs.' },
      { who: 'Lucas', note: 5, txt: 'Toujours à l’heure, toujours impeccable.' },
      { who: 'Mehdi', note: 4, txt: 'Très beau travail sur la barbe, salon élégant.' },
    ],
  },
  {
    id: 'sofiane', name: 'Sofiane Kaci', ini: 'SK', tex: 1, years: 6, rating: '4,7',
    salon: 'BarberPro — Le Salon', city: 'Lille Centre', dist: 0.8,
    venue: 'salon', address: '12 rue Nationale, 59000 Lille',
    clients: '860', prestations: '2 210', ponct: 91, delay: 'DELAY_10',
    tags: ['Rasage traditionnel', 'Barbe', 'Coloration'],
    bio: 'Maître du rasage à l’ancienne : serviette chaude, coupe-chou et soins. Un rituel plus qu’une prestation.',
    story: 'Formé à Istanbul auprès des maîtres barbiers du Grand Bazar, je perpétue un rituel qui se perd : serviette chaude, blaireau, coupe-chou et soin final. Trente minutes hors du temps. La barbe est un art de patience — la mienne et la vôtre.',
    reviews: [
      { who: 'Antoine', note: 5, txt: 'Le rasage serviette chaude est une expérience à part.' },
      { who: 'Yanis', note: 4, txt: 'Excellent, juste un peu d’attente parfois.' },
    ],
  },
  {
    id: 'marco', name: 'Marco Vitale', ini: 'MV', tex: 2, years: 5, rating: '4,8',
    salon: 'Se déplace chez vous', city: 'Lille & alentours', dist: 1.5,
    venue: 'domicile', address: 'Lille, La Madeleine, Lambersart',
    clients: '540', prestations: '1 490', ponct: 95, delay: 'ON_TIME',
    tags: ['Hair Design', 'Taper', 'Coupe enfant'],
    bio: 'Hair design et motifs sur mesure, directement chez vous. Chaque coupe est traitée comme une pièce unique.',
    story: 'J’ai choisi le domicile pour une raison simple : c’est chez vous que vous êtes le plus détendu. J’arrive avec tout mon matériel, une bâche, et trente minutes plus tard votre salon redevient un salon. Spécialiste des motifs et des coupes enfant — même les plus remuants.',
    reviews: [{ who: 'Sacha', note: 5, txt: 'Le motif était exactement celui que j’imaginais. Et sans bouger de chez moi.' }],
  },
  {
    id: 'ibra', name: 'Ibrahim Diallo', ini: 'ID', tex: 3, years: 7, rating: '4,9',
    salon: 'Kings Cut', city: 'Wazemmes', dist: 2.1,
    venue: 'studio', address: '4 rue des Sarrazins, 59000 Lille',
    clients: '980', prestations: '2 870', ponct: 94, delay: 'ON_TIME',
    tags: ['Coupe afro', 'Burst Fade', 'Locks', 'Transformation'],
    bio: 'Référence coupe afro et locks. Les transformations complètes sont sa signature — avant/après garantis.',
    story: 'Kings Cut, c’est mon studio privé : un fauteuil, un client à la fois, zéro attente. Dix ans à travailler le cheveu texturé m’ont appris une chose — il n’y a pas une coupe afro, il y en a mille. Les transformations sont mes préférées : on prend le temps, on photographie l’avant, et l’après parle tout seul.',
    reviews: [{ who: 'Moussa', note: 5, txt: 'Transformation totale, je ne me reconnaissais plus. Incroyable.' }],
  },
  {
    id: 'lucas', name: 'Lucas Brun', ini: 'LB', tex: 1, years: 4, rating: '4,6',
    salon: 'Le Comptoir du Barbier', city: 'Roubaix', dist: 3.4,
    venue: 'salon', address: '28 Grande Rue, 59100 Roubaix',
    clients: '410', prestations: '1 120', ponct: 92, delay: 'ON_TIME',
    tags: ['Taper', 'Fade', 'Barbe'],
    bio: 'Taper et fade au cordeau, dans un comptoir à l’ancienne. Simple, net, précis.',
    story: 'Le Comptoir, c’est carrelage d’époque, fauteuils en cuir et café offert. Pas de chichis : un taper net, un fade propre, une barbe dessinée. Je préfère faire trois choses parfaitement que dix à moitié.',
    reviews: [{ who: 'Hugo', note: 5, txt: 'Mon taper n’a jamais été aussi propre.' }],
  },
  {
    id: 'yanis', name: 'Yanis Cohen', ini: 'YC', tex: 2, years: 9, rating: '4,8',
    salon: 'Studio Y', city: 'Villeneuve-d’Ascq', dist: 5.2,
    venue: 'studio', address: '2 allée des Lilas, 59650 Villeneuve-d’Ascq',
    clients: '1 150', prestations: '3 240', ponct: 96, delay: 'ON_TIME',
    tags: ['Transformation', 'Coloration', 'Hair Design'],
    bio: 'Studio dédié aux métamorphoses : coloration, hair design et transformations complètes sur rendez-vous long.',
    story: 'Studio Y est pensé comme un atelier d’artiste : lumière contrôlée, miroirs sans concession, playlists choisies. On y vient pour changer — de couleur, de style, de tête. Apportez une photo d’inspiration, repartez avec mieux.',
    reviews: [{ who: 'Théo', note: 5, txt: 'Coloration + design parfaits, le résultat dépasse la photo d’inspiration.' }],
  },
];

const SERVICES = [
  { id: 's1', name: 'Coupe Homme', dur: 30, price: 2500 },
  { id: 's2', name: 'Coupe + Barbe', dur: 45, price: 3500 },
  { id: 's3', name: 'Barbe seule', dur: 20, price: 1500 },
  { id: 's4', name: 'Coupe enfant', dur: 25, price: 1800 },
  { id: 's5', name: 'Hair Design', dur: 60, price: 4500 },
  { id: 's6', name: 'Premium Package', dur: 90, price: 7000 },
];

/* Formules de rendez-vous — créées et activées par le barber */
const WINDOWS = { all: 'Libre', day: 'Journée', evening: 'Soirée', night: 'Nuit' };
function initFormulas() {
  return [
    {
      id: 'f1', name: 'Classique', icon: 'scissors', dur: 30, window: 'all',
      fixed: null, recur: false, active: true,
      desc: 'Prestation au choix, tarif dynamique selon l’horaire.',
    },
    {
      id: 'f2', name: 'Nocturne', icon: 'moon', dur: 45, window: 'night',
      fixed: null, recur: false, active: true,
      desc: 'Créneaux du soir uniquement — tarifs soirée et nuit appliqués.',
    },
    {
      id: 'f3', name: 'Transformation', icon: 'star', dur: 120, window: 'day',
      fixed: 9000, recur: false, active: true,
      desc: 'Refonte complète du style — 2 h, photos avant/après offertes.',
    },
    {
      id: 'f4', name: 'Hebdomadaire', icon: 'refresh-cw', dur: 30, window: 'all',
      fixed: null, recur: true, active: false,
      desc: 'Même créneau chaque semaine — fidélité récompensée : −15 %.',
    },
  ];
}

const CATS = [
  ['ALL', 'Tout'], ['CIRE', 'Cires'], ['POMMADE', 'Pommades'],
  ['HUILE', 'Huiles'], ['SHAMP', 'Shampoings'], ['ACC', 'Accessoires'],
];
const PRODUCTS = [
  { id: 'p1', name: 'Cire coiffante mate', cat: 'CIRE', price: 1490, stock: 40, ic: 'box', tex: 0 },
  { id: 'p2', name: 'Pommade brillante', cat: 'POMMADE', price: 1690, stock: 25, ic: 'droplet', tex: 1 },
  { id: 'p3', name: 'Huile à barbe — cèdre', cat: 'HUILE', price: 1990, stock: 30, ic: 'droplet', tex: 2 },
  { id: 'p4', name: 'Shampoing fortifiant', cat: 'SHAMP', price: 1290, stock: 50, ic: 'droplet', tex: 3 },
  { id: 'p5', name: 'Peigne en bois', cat: 'ACC', price: 990, stock: 60, ic: 'align-justify', tex: 0 },
  { id: 'p6', name: 'Tondeuse de finition', cat: 'ACC', price: 4990, stock: 8, ic: 'zap', tex: 1 },
];

const HISTORY = [
  {
    id: 'h1', date: '12 avril 2026', barber: 'Enzo Moreau', barberId: 'enzo',
    servs: 'Coupe + Barbe', price: 3500, rating: 5,
    photos: [
      { id: 'hp1', label: 'Face', tex: 0 }, { id: 'hp2', label: 'Profil gauche', tex: 1 },
      { id: 'hp3', label: 'Profil droit', tex: 2 }, { id: 'hp4', label: 'Arrière', tex: 3 },
    ],
  },
  {
    id: 'h2', date: '2 mars 2026', barber: 'Marco Vitale', barberId: 'marco',
    servs: 'Hair Design', price: 4500, rating: null,
    photos: [{ id: 'hp5', label: 'Face', tex: 2 }, { id: 'hp6', label: 'Arrière', tex: 1 }],
  },
];

/* ───────── Jours & créneaux ───────── */
const WD = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MO = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MO_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const HORIZON = 60; // jours réservables / ouvrables à l’avance
/* Grille horaire 9h → 23h, au pas choisi par le barber (15 à 60 min) */
function timesFor(step) {
  const out = [];
  for (let t = 9 * 60; t + step <= 23 * 60; t += step) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  }
  return out;
}
const TIMES = timesFor(30); // grille par défaut
function makeDays() {
  const out = [];
  for (let i = 0; i < HORIZON; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    const label = i === 0 ? 'Aujourd’hui' : i === 1 ? 'Demain'
      : `${WD[d.getDay()]} ${d.getDate()} ${MO_SHORT[d.getMonth()]}`;
    out.push({ key: d.toDateString(), label, date: d });
  }
  return out;
}
const DAYS = makeDays();
const DAY_INDEX = {};
DAYS.forEach((d, i) => { DAY_INDEX[d.key] = i; });
const timeToDate = (day, time) => {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(day.date);
  d.setHours(h, m, 0, 0);
  return d;
};
const inWindow = (time, window) => {
  const h = Number(time.slice(0, 2));
  if (window === 'day') return h < 20;
  if (window === 'evening') return h >= 18;
  if (window === 'night') return h >= 20;
  return true;
};

/* Agenda partagé : agenda[barberId][dayKey][time] =
   { status:'open' } ou { status:'booked', who, serv, price, done } — absent = fermé. */
function initAgenda() {
  const agenda = {};
  BARBERS.forEach((b, bi) => {
    agenda[b.id] = {};
    DAYS.forEach((day, di) => {
      const slots = {};
      TIMES.forEach((time, ti) => {
        if (b.id === 'enzo') {
          const h = Number(time.slice(0, 2));
          const openToday = (h >= 9 && h < 12) || (h >= 14 && h < 18) || (h >= 20 && h <= 22);
          const openOther = h >= 9 && h < 18 && (ti + di) % 4 !== 0;
          if (di === 0 ? openToday : openOther) slots[time] = { status: 'open' };
        } else if ((ti + bi * 2 + di) % 3 !== 0) {
          slots[time] = { status: 'open' };
          if ((ti * (di + 2) + bi) % 11 === 4) {
            slots[time] = { status: 'booked', who: 'Client', serv: 'Coupe Homme', price: 2500, done: false };
          }
        }
      });
      agenda[b.id][day.key] = slots;
    });
  });
  const today = agenda.enzo[DAYS[0].key];
  [
    ['09:30', 'Karim D.', 'Coupe Homme', 2500, true],
    ['10:30', 'Lucas B.', 'Coupe + Barbe', 3500, true],
    ['11:30', 'Mehdi A.', 'Barbe seule', 1500, false],
    ['14:00', 'Sacha L.', 'Transformation', 9000, false],
    ['16:00', 'Noah P.', 'Coupe enfant', 1800, false],
    ['20:30', 'Tom R.', 'Nocturne · Coupe Homme', 3500, false],
  ].forEach(([time, who, serv, price, done]) => {
    today[time] = { status: 'booked', who, serv, price, done };
  });
  return agenda;
}

/* ───────── Tarification dynamique (PRD §4) ───────── */
function computePrice(base, slotDate, now) {
  let price = base;
  const rules = [];
  const h = slotDate.getHours();
  if (h >= 22) { price = base + 2500; rules.push('Tarif nuit · après 22h'); }
  else if (h >= 20) { price = base + 1000; rules.push('Tarif soirée · après 20h'); }
  const d = slotDate.getDay();
  if (d === 0 || d === 6) { price = Math.round(price * 1.15); rules.push('Week-end +15 %'); }
  if ((slotDate - now) / 60000 < 120 && slotDate > now) { price = Math.round(price * 1.2); rules.push('Urgence +20 %'); }
  return { price, rules };
}
function quoteFor(formula, service, slotDate, now) {
  if (formula.fixed != null) {
    return { price: formula.fixed, rules: [`Formule ${formula.name}`] };
  }
  const q = computePrice(service.price, slotDate, now);
  if (formula.recur) {
    q.price = Math.round(q.price * 0.85);
    q.rules = [...q.rules, 'Formule hebdomadaire −15 %'];
  } else if (formula.id !== 'f1') {
    q.rules = [`Formule ${formula.name}`, ...q.rules];
  }
  return q;
}
const fmt = (c) =>
  (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €';

/* ───────── Petits composants ───────── */
const Kicker = ({ children }) => <Text style={s.kicker}>{children}</Text>;
const Title = ({ children, em }) => (
  <Text style={s.title}>
    {children}
    {em ? <Text style={s.titleEm}>{em}</Text> : null}
  </Text>
);
const Lead = ({ children }) => <Text style={s.lead}>{children}</Text>;

const Section = ({ children, note }) => (
  <View style={s.secRow}>
    <Text style={s.secText}>{children}</Text>
    {note ? <Text style={s.secNote}>{note}</Text> : null}
    <View style={s.secLine} />
  </View>
);

const Ava = ({ b, lg }) => (
  <View style={[s.ava, lg && s.avaLg, { backgroundColor: TEX[b.tex] }]}>
    <Text style={[s.avaText, lg && { fontSize: 30 }]}>{b.ini}</Text>
  </View>
);

const Badge = ({ status }) => (
  <View style={s.badge}>
    <View style={[s.dot, { backgroundColor: DELAY[status].dot }]} />
    <Text style={s.badgeText}>{DELAY[status].label}</Text>
  </View>
);

const Tag = ({ label }) => (
  <View style={s.tag}>
    <Text style={s.tagText}>{label}</Text>
  </View>
);

const Chip = ({ label, price, on, onPress, mini }) => (
  <TouchableOpacity
    style={[s.chip, mini && s.chipMini, on && s.chipOn]}
    onPress={onPress}
    activeOpacity={0.8}
    disabled={!onPress}
  >
    <Text style={[s.chipText, on && s.chipTextOn]}>
      {label}
      {price ? <Text style={[s.chipPrice, on && s.chipTextOn]}>  {price}</Text> : null}
    </Text>
  </TouchableOpacity>
);

/* Calendrier mensuel — sélection d’une date sur 2 mois, points de statut par jour */
function Calendar({ sel, onSel, markFor }) {
  const now = new Date();
  const [mOff, setMOff] = useState(0);
  const base = new Date(now.getFullYear(), now.getMonth() + mOff, 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstDow = (base.getDay() + 6) % 7; // semaine qui démarre lundi
  const nDays = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= nDays; d++) cells.push(d);

  return (
    <View style={s.cal}>
      <View style={s.calHead}>
        <TouchableOpacity disabled={mOff === 0} onPress={() => setMOff(mOff - 1)}
          hitSlop={12} style={{ opacity: mOff === 0 ? 0.25 : 1 }}>
          <Feather name="chevron-left" size={19} color={C.gold} />
        </TouchableOpacity>
        <Text style={s.calMonth}>{MO[month]} {year}</Text>
        <TouchableOpacity disabled={mOff >= 2} onPress={() => setMOff(mOff + 1)}
          hitSlop={12} style={{ opacity: mOff >= 2 ? 0.25 : 1 }}>
          <Feather name="chevron-right" size={19} color={C.gold} />
        </TouchableOpacity>
      </View>
      <View style={s.calGrid}>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((w, i) => (
          <View key={'w' + i} style={s.calCell}>
            <Text style={s.calWd}>{w}</Text>
          </View>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <View key={'b' + i} style={s.calCell} />;
          const key = new Date(year, month, d).toDateString();
          const idx = DAY_INDEX[key];
          const enabled = idx != null;
          const on = enabled && sel === idx;
          const mark = enabled && markFor ? markFor(key) : null;
          return (
            <TouchableOpacity key={key} style={s.calCell} disabled={!enabled}
              onPress={() => onSel(idx)} activeOpacity={0.7}>
              <View style={[s.calNumWrap, on && s.calNumOn]}>
                <Text style={[s.calNum, !enabled && { color: '#3E3C38' }, on && { color: C.ink, fontWeight: '700' }]}>
                  {d}
                </Text>
              </View>
              <View style={[
                s.calDot,
                mark === 'open' && { backgroundColor: C.gold },
                mark === 'booked' && { backgroundColor: C.green },
              ]} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const Photo = ({ label, tex, uri }) => (
  <View style={[s.photo, { backgroundColor: TEX[tex] || '#1C1B18' }]}>
    {uri
      ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      : <Feather name="scissors" size={26} color="rgba(200,169,106,0.45)" />
    }
    {label ? <Text style={s.photoLabel}>{label}</Text> : null}
  </View>
);

/* Visionneuse plein écran — onDownload (facultatif) ajoute le bouton Télécharger */
function PhotoViewer({ photo, onClose, onDownload }) {
  if (!photo) return null;
  return (
    <View style={[s.modalOverlay, { justifyContent: 'center', padding: 26 }]}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      <View style={s.viewerBox}>
        {photo.uri ? (
          <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: TEX[photo.tex] || '#1C1B18', alignItems: 'center', justifyContent: 'center' }]}>
            <Feather name="scissors" size={52} color="rgba(200,169,106,0.45)" />
          </View>
        )}
      </View>
      {photo.label ? <Text style={s.viewerLabel}>{photo.label}</Text> : null}
      {onDownload && (
        <TouchableOpacity style={s.viewerDl} onPress={() => onDownload(photo)} activeOpacity={0.85}>
          <Feather name="download" size={15} color={C.ink} />
          <Text style={s.viewerDlText}>TÉLÉCHARGER</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={s.viewerClose} onPress={onClose} hitSlop={10}>
        <Feather name="x" size={20} color={C.text} />
      </TouchableOpacity>
    </View>
  );
}

/* Enregistre dans la galerie du téléphone les photos qui ont un vrai fichier */
async function savePhotos(photos, toast) {
  const real = photos.filter((p) => p.uri);
  if (real.length === 0) {
    toast('Photos de démonstration — rien à enregistrer.');
    return;
  }
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    toast('Permission refusée — autorisez l’accès aux photos.');
    return;
  }
  for (const p of real) await MediaLibrary.saveToLibraryAsync(p.uri);
  toast(`${real.length} photo${real.length > 1 ? 's' : ''} enregistrée${real.length > 1 ? 's' : ''} dans votre galerie.`);
}

const Stars = ({ n }) => (
  <Text style={s.rate}>
    {'★'.repeat(n)}
    <Text style={{ opacity: 0.25 }}>{'★'.repeat(5 - n)}</Text>
  </Text>
);

const Btn = ({ label, ghost, onPress, icon }) => (
  <TouchableOpacity style={[s.btn, ghost && s.btnGhost]} onPress={onPress} activeOpacity={0.85}>
    {icon ? <Feather name={icon} size={15} color={ghost ? C.gold : C.ink} style={{ marginRight: 8 }} /> : null}
    <Text style={[s.btnText, ghost && { color: C.gold }]}>{label}</Text>
  </TouchableOpacity>
);

const Toggle = ({ on, onPress }) => (
  <TouchableOpacity style={[s.sw, on && s.swOn]} onPress={onPress} activeOpacity={0.8} hitSlop={8}>
    <View style={[s.swKnob, on && s.swKnobOn]} />
  </TouchableOpacity>
);

/* ───────── Écran d’entrée ───────── */
function WelcomeScreen({ choose }) {
  return (
    <View style={s.welcome}>
      <View style={{ alignItems: 'center', marginBottom: 40 }}>
        <Text style={s.welcomeMark}>
          Barber<Text style={{ color: C.gold, fontStyle: 'italic' }}>Pro</Text>
        </Text>
        <View style={s.welcomeRule} />
        <Text style={s.welcomeTag}>L’art de la coupe, à l’heure juste.</Text>
      </View>
      {[
        ['client', 'user', 'Espace Client', 'Trouver un artiste près de vous,\nréserver, retrouver toutes vos coupes.'],
        ['barber', 'scissors', 'Espace Barber', 'Ouvrir vos créneaux, créer vos formules,\nsuivre votre planning et votre activité.'],
      ].map(([role, icon, title, sub]) => (
        <TouchableOpacity key={role} style={s.welcomeCard} onPress={() => choose(role)} activeOpacity={0.85}>
          <View style={s.welcomeIcon}>
            <Feather name={icon} size={21} color={C.gold2} />
          </View>
          <View style={s.grow}>
            <Text style={s.welcomeCardTitle}>{title}</Text>
            <Text style={s.welcomeCardSub}>{sub}</Text>
          </View>
          <Feather name="arrow-right" size={18} color={C.gold} />
        </TouchableOpacity>
      ))}
      <Text style={s.welcomeFoot}>Démo — comptes fictifs, aucune donnée envoyée</Text>
    </View>
  );
}

/* ───────── Authentification ───────── */
function Field({ label, ...props }) {
  return (
    <>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput style={s.input} placeholderTextColor="#5A5852" {...props} />
    </>
  );
}

function AuthScreen({ role, onSuccess, onBack }) {
  const [mode, setMode] = useState('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const signup = mode === 'signup';

  const submit = () => {
    if (!email.trim() || !password) {
      setError('Renseignez votre e-mail et votre mot de passe.');
      return;
    }
    if (signup && (!firstName.trim() || !lastName.trim())) {
      setError('Renseignez votre prénom et votre nom.');
      return;
    }
    if (signup && role === 'barber' && !phone.trim()) {
      setError('Le téléphone est requis — vos clients doivent pouvoir vous joindre.');
      return;
    }
    setError(null);
    onSuccess(
      {
        firstName: firstName.trim() || 'Mathéo',
        lastName: lastName.trim() || 'D.',
        email: email.trim(),
        role,
        plan: null,
      },
      { isNew: signup },
    );
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.screenPad, { paddingTop: 8 }]} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={[s.circleBtn, { marginBottom: 22 }]} onPress={onBack} hitSlop={8}>
        <Feather name="arrow-left" size={18} color={C.text} />
      </TouchableOpacity>
      <Kicker>{role === 'barber' ? 'ESPACE BARBER' : 'ESPACE CLIENT'}</Kicker>
      <Title em={signup ? 'compte' : null}>{signup ? 'Créer un ' : 'Connexion'}</Title>
      <Lead>
        {signup
          ? role === 'barber'
            ? 'Quelques informations, votre abonnement, et vos premiers clients arrivent.'
            : 'Une minute suffit — votre prochaine coupe vous attend.'
          : 'Heureux de vous revoir.'}
      </Lead>

      {signup && (
        <>
          <Field label="PRÉNOM" placeholder="Mathéo" value={firstName} onChangeText={setFirstName} />
          <Field label="NOM" placeholder="Dupont" value={lastName} onChangeText={setLastName} />
        </>
      )}
      <Field label="E-MAIL" placeholder="vous@exemple.fr" autoCapitalize="none"
        keyboardType="email-address" value={email} onChangeText={setEmail} />
      {signup && role === 'barber' && (
        <Field label="TÉLÉPHONE" placeholder="06 12 34 56 78" keyboardType="phone-pad"
          value={phone} onChangeText={setPhone} />
      )}
      <Field label="MOT DE PASSE" placeholder="••••••••" secureTextEntry
        value={password} onChangeText={setPassword} />

      {error && <Text style={s.authError}>{error}</Text>}

      <Btn label={signup ? (role === 'barber' ? 'CONTINUER — ABONNEMENT' : 'CRÉER MON COMPTE') : 'SE CONNECTER'} onPress={submit} />
      <TouchableOpacity onPress={() => { setMode(signup ? 'login' : 'signup'); setError(null); }}
        hitSlop={8} style={{ marginTop: 18, alignItems: 'center' }}>
        <Text style={s.authLink}>
          {signup ? 'Déjà inscrit ? Se connecter' : 'Pas encore de compte ? Créer un compte'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* Abonnement barber — l’app se rémunère sur l’outil, pas sur les coupes */
const PLANS = [
  {
    id: 'starter', name: 'Starter', price: 2900, badge: null,
    features: ['Agenda & créneaux en ligne', 'Jusqu’à 3 formules', 'Notifications clients', 'Statistiques de base'],
  },
  {
    id: 'pro', name: 'Pro', price: 5900, badge: 'POPULAIRE',
    features: ['Tout le Starter', 'Formules illimitées', 'Boutique intégrée', 'Statistiques avancées', 'Support prioritaire'],
  },
];

function PlanScreen({ onChoose, onBack }) {
  const [sel, setSel] = useState('pro');
  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.screenPad, { paddingTop: 8 }]}>
      <TouchableOpacity style={[s.circleBtn, { marginBottom: 22 }]} onPress={onBack} hitSlop={8}>
        <Feather name="arrow-left" size={18} color={C.text} />
      </TouchableOpacity>
      <Kicker>ESPACE BARBER · ABONNEMENT</Kicker>
      <Title em="formule">Votre </Title>
      <Lead>14 jours d’essai offerts, sans engagement. Annulable à tout moment.</Lead>

      {PLANS.map((p) => {
        const on = sel === p.id;
        return (
          <TouchableOpacity key={p.id} style={[s.planCard, on && s.planCardOn]}
            onPress={() => setSel(p.id)} activeOpacity={0.85}>
            <View style={s.row}>
              <Text style={[s.bname, { fontFamily: SERIF, fontSize: 19, fontWeight: '600' }, s.grow]}>{p.name}</Text>
              {p.badge && (
                <View style={s.planBadge}>
                  <Text style={s.planBadgeText}>{p.badge}</Text>
                </View>
              )}
            </View>
            <Text style={s.planPrice}>
              {fmt(p.price)}<Text style={{ fontSize: 13, color: C.muted }}> /mois</Text>
            </Text>
            <View style={{ marginTop: 10 }}>
              {p.features.map((f) => (
                <View key={f} style={s.planFeature}>
                  <Feather name="check" size={13} color={on ? C.gold : C.green} />
                  <Text style={[s.softText, { color: on ? C.text : C.soft }]}>{f}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        );
      })}

      <Btn label="CONTINUER — PAIEMENT" onPress={() => onChoose(sel)} />
      <Text style={s.footnote}>L’abonnement finance l’outil : aucune commission sur vos prestations.</Text>
    </ScrollView>
  );
}

function PayScreen({ user, plan, onConfirm, onBack }) {
  const p = PLANS.find((x) => x.id === plan);
  const [cardNum, setCardNum] = useState('');
  const [holder, setHolder] = useState(`${user.firstName} ${user.lastName}`);
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fmtCard = (t) => {
    const digits = t.replace(/\D/g, '').slice(0, 16);
    setCardNum(digits.replace(/(.{4})/g, '$1 ').trim());
  };
  const fmtExpiry = (t) => {
    const digits = t.replace(/\D/g, '').slice(0, 4);
    setExpiry(digits.length > 2 ? digits.slice(0, 2) + '/' + digits.slice(2) : digits);
  };

  const pay = () => {
    if (cardNum.replace(/\D/g, '').length < 16 || expiry.length < 5 || cvv.length < 3) {
      setError('Vérifiez les informations de votre carte.');
      return;
    }
    setError(null);
    setLoading(true);
    setTimeout(onConfirm, 1400);
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.screenPad, { paddingTop: 8 }]} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={[s.circleBtn, { marginBottom: 22 }]} onPress={onBack} hitSlop={8}>
        <Feather name="arrow-left" size={18} color={C.text} />
      </TouchableOpacity>
      <Kicker>PAIEMENT SÉCURISÉ</Kicker>
      <Title>Récapitulatif</Title>

      <View style={[s.card, { borderColor: C.lineGold }]}>
        <View style={s.row}>
          <View style={s.grow}>
            <Text style={[s.bname, { fontSize: 15 }]}>BarberPro {p.name}</Text>
            <Text style={[s.btags, { marginTop: 3 }]}>14 jours d’essai puis {fmt(p.price)}/mois · sans engagement</Text>
          </View>
          <Text style={[s.price, { fontSize: 20 }]}>{fmt(p.price)}</Text>
        </View>
      </View>

      <Section>Carte bancaire</Section>
      <Field label="NUMÉRO DE CARTE" placeholder="4242 4242 4242 4242" keyboardType="numeric"
        value={cardNum} onChangeText={fmtCard} />
      <Field label="TITULAIRE" placeholder="Prénom Nom" value={holder} onChangeText={setHolder} />
      <View style={[s.row, { gap: 11, alignItems: 'flex-start' }]}>
        <View style={s.grow}>
          <Field label="EXPIRATION" placeholder="MM/AA" keyboardType="numeric"
            value={expiry} onChangeText={fmtExpiry} />
        </View>
        <View style={s.grow}>
          <Field label="CVV" placeholder="123" keyboardType="numeric" secureTextEntry maxLength={4}
            value={cvv} onChangeText={setCvv} />
        </View>
      </View>

      {error && <Text style={s.authError}>{error}</Text>}

      {loading ? (
        <View style={[s.btn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.lineGold }]}>
          <ActivityIndicator size="small" color={C.gold} />
        </View>
      ) : (
        <Btn icon="lock" label={`S’ABONNER · ${fmt(p.price)}/MOIS`} onPress={pay} />
      )}
      <Text style={s.footnote}>Démo — aucun prélèvement réel. Paiement Stripe dans la version connectée.</Text>
    </ScrollView>
  );
}

/* ───────── Espace CLIENT ───────── */
const FADE_TAGS = ['Fade', 'Burst Fade', 'Taper'];

function BigCard({ b, onPress }) {
  return (
    <TouchableOpacity style={s.bigCard} onPress={onPress} activeOpacity={0.85}>
      <View style={[s.bigArt, { backgroundColor: TEX[b.tex] }]}>
        <Text style={s.bigIni}>{b.ini}</Text>
        <View style={s.bigVenue}>
          <Text style={s.bigVenueText}>{VENUES[b.venue]}</Text>
        </View>
        <View style={s.bigShade} />
        <View style={s.bigInfo}>
          <Text style={[s.bname, { fontSize: 14.5 }]} numberOfLines={1}>{b.name}</Text>
          <Text style={s.btags} numberOfLines={1}>{b.city} · {String(b.dist).replace('.', ',')} km</Text>
          <Text style={[s.rate, { marginTop: 3 }]}>★ {b.rating}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ExploreScreen({ barbers, user, openBarber, toast }) {
  const [query, setQuery] = useState('');
  const [style, setStyle] = useState(null);
  const [city, setCity] = useState('');
  const [locLoading, setLocLoading] = useState(true);
  const [editingLoc, setEditingLoc] = useState(false);
  const [locInput, setLocInput] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setCity('Localisation refusée');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        const label = [geo.city || geo.district || geo.subregion, geo.country]
          .filter(Boolean).join(', ');
        setCity(label || 'Position obtenue');
      } catch {
        setCity('Position indisponible');
      } finally {
        setLocLoading(false);
      }
    })();
  }, []);

  const confirmCity = () => {
    const v = locInput.trim();
    if (v) setCity(v);
    setEditingLoc(false);
    setLocInput('');
  };

  const q = query.trim().toLowerCase();
  const filtering = q !== '' || style != null;
  const sorted = [...barbers].sort((a, b) => a.dist - b.dist);
  const list = sorted.filter((b) => {
    const hay = `${b.name} ${b.salon} ${b.city} ${b.tags.join(' ')}`.toLowerCase();
    return (!q || hay.includes(q)) && (!style || b.tags.includes(style));
  });

  const Row = ({ title, note, data }) =>
    data.length === 0 ? null : (
      <>
        <Section note={note}>{title}</Section>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -PAD }} contentContainerStyle={{ paddingHorizontal: PAD }}>
          {data.map((b) => <BigCard key={b.id} b={b} onPress={() => openBarber(b)} />)}
        </ScrollView>
      </>
    );

  const hello = new Date().getHours() >= 18 ? 'BONSOIR' : 'BONJOUR';
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenPad} keyboardShouldPersistTaps="handled">
      <Kicker>{hello}</Kicker>
      <Title>{user ? user.firstName : 'Bienvenue'}</Title>
      {editingLoc ? (
        <View style={s.locEditBox}>
          <Feather name="map-pin" size={13} color={C.gold} />
          <TextInput
            style={s.locInput}
            value={locInput}
            onChangeText={setLocInput}
            placeholder="Ville, code postal…"
            placeholderTextColor="#5A5852"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={confirmCity}
          />
          <TouchableOpacity onPress={confirmCity} hitSlop={10}>
            <Text style={[s.locEdit, { color: C.green }]}>OK</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setEditingLoc(false)} hitSlop={10}>
            <Feather name="x" size={14} color={C.muted} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={s.locRow} onPress={() => { setLocInput(city); setEditingLoc(true); }} activeOpacity={0.7}>
          {locLoading
            ? <ActivityIndicator size={12} color={C.gold} />
            : <Feather name="map-pin" size={13} color={C.gold} />}
          <Text style={s.locText} numberOfLines={1}>{locLoading ? 'Localisation…' : (city || 'Définir ma position')}</Text>
          <Feather name="edit-2" size={11} color={C.gold} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      )}

      <View style={s.search}>
        <Feather name="search" size={16} color={C.muted} />
        <TextInput
          style={s.searchInput}
          placeholder="Un barber, un salon, un style…"
          placeholderTextColor="#5A5852"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        {query !== '' && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Feather name="x" size={15} color={C.muted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
        <View style={[s.wrap, { flexWrap: 'nowrap' }]}>
          {STYLES.map((st) => (
            <Chip key={st} mini label={st} on={style === st}
              onPress={() => setStyle(style === st ? null : st)} />
          ))}
        </View>
      </ScrollView>

      {filtering ? (
        <>
          <Section note={`${list.length} artiste${list.length > 1 ? 's' : ''} · du plus proche au plus loin`}>
            Résultats
          </Section>
          {list.length === 0 ? (
            <Text style={s.footnote}>Aucun artiste ne correspond.{'\n'}Essayez un autre style ou effacez la recherche.</Text>
          ) : (
            list.map((b) => (
              <TouchableOpacity key={b.id} style={s.card} onPress={() => openBarber(b)} activeOpacity={0.85}>
                <View style={s.row}>
                  <Ava b={b} />
                  <View style={s.grow}>
                    <Text style={s.bname}>{b.name}</Text>
                    <View style={[s.row, { gap: 5, marginTop: 2 }]}>
                      <Feather name="map-pin" size={10} color={C.gold} />
                      <Text style={s.btags}>{b.salon} · {String(b.dist).replace('.', ',')} km</Text>
                    </View>
                    <View style={[s.row, { gap: 12, marginTop: 6 }]}>
                      <Badge status={b.delay} />
                      <Text style={s.rate}>★ {b.rating}</Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={18} color="#56534E" />
                </View>
                <View style={[s.wrap, { marginTop: 11, gap: 6 }]}>
                  {b.tags.map((t) => <Tag key={t} label={t} />)}
                </View>
              </TouchableOpacity>
            ))
          )}
        </>
      ) : (
        <>
          <Row title="Autour de vous" note="du plus proche au plus loin" data={sorted} />
          <Row title="Studios privés" note="un client à la fois" data={sorted.filter((b) => b.venue === 'studio')} />
          <Row title="À domicile" note="ils se déplacent" data={sorted.filter((b) => b.venue === 'domicile')} />
          <Row title="Spécialistes fade" note="burst, taper, dégradés"
            data={sorted.filter((b) => b.tags.some((t) => FADE_TAGS.includes(t)))} />
        </>
      )}
    </ScrollView>
  );
}

function BarberDetailScreen({ barber, services, onBack, onBook, toast }) {
  const [dtab, setDtab] = useState('about');
  const [more, setMore] = useState(false);
  const [viewer, setViewer] = useState(null);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero */}
        <View style={[s.heroArt, { backgroundColor: barber.coverColor || TEX[barber.tex] }]}>
          {barber.coverImage
            ? <Image source={{ uri: barber.coverImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : null}
          <Text style={[s.heroIni, barber.coverImage && { opacity: 0 }]}>{barber.ini}</Text>
          <View style={s.heroTop}>
            <TouchableOpacity style={s.circleBtn} onPress={onBack} hitSlop={8}>
              <Feather name="chevron-left" size={19} color={C.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            {[['instagram', 'Instagram'], ['music', 'TikTok'], ['share-2', 'Partage du profil']].map(([ic, label]) => (
              <TouchableOpacity key={ic} style={s.circleBtn} hitSlop={6}
                onPress={() => toast(`${label} de ${barber.name.split(' ')[0]} — relié dans la version connectée.`)}>
                <Feather name={ic} size={16} color={C.text} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Identité */}
        <View style={{ paddingHorizontal: PAD, paddingTop: 16 }}>
          <View style={[s.row, { gap: 10, alignItems: 'flex-start' }]}>
            <Text style={[s.title, { fontSize: 26, lineHeight: 30, marginBottom: 0, flex: 1 }]}>{barber.name}</Text>
            <View style={[s.tag, { marginTop: 6 }]}>
              <Text style={s.tagText}>{VENUES[barber.venue]}</Text>
            </View>
          </View>
          <View style={[s.row, { gap: 12, marginTop: 8 }]}>
            <Text style={s.rate}>★ {barber.rating}</Text>
            <Badge status={barber.delay} />
          </View>
          <View style={[s.row, { gap: 6, marginTop: 7 }]}>
            <Feather name="map-pin" size={11} color={C.gold} />
            <Text style={s.btags}>{barber.address} · {String(barber.dist).replace('.', ',')} km</Text>
          </View>
        </View>

        {/* Onglets */}
        <View style={s.dtabs}>
          {[['about', 'À propos'], ['prest', 'Prestations'], ['avis', 'Avis']].map(([k, l]) => (
            <TouchableOpacity key={k} style={[s.dtab, dtab === k && s.dtabOn]} onPress={() => setDtab(k)}>
              <Text style={[s.dtabText, dtab === k && { color: C.gold2 }]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ paddingHorizontal: PAD }}>
          {dtab === 'about' && (
            <>
              <Section>Son histoire</Section>
              <Text style={s.bio}>
                {barber.bio}{more ? '\n\n' + barber.story : ''}
              </Text>
              <TouchableOpacity onPress={() => setMore(!more)} hitSlop={8} style={{ marginTop: -8, marginBottom: 4 }}>
                <Text style={s.moreLink}>{more ? 'Voir moins' : 'Voir plus'}</Text>
              </TouchableOpacity>

              <Section note="appuyez pour agrandir">Réalisations</Section>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {(barber.photos || [{tex:0},{tex:1},{tex:2},{tex:3}]).map((ph, i) => (
                  <TouchableOpacity key={ph.id || i} activeOpacity={0.85} onPress={() => setViewer(ph)}>
                    <Photo label={ph.label} tex={ph.tex} uri={ph.uri} />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Section>Lieu de coupe</Section>
              <View style={[s.place, { backgroundColor: barber.coverColor || TEX[(barber.tex + 1) % 4] }]}>
                <Feather name={barber.venue === 'domicile' ? 'home' : barber.venue === 'studio' ? 'star' : 'scissors'} size={26} color="rgba(200,169,106,0.45)" />
                <Text style={s.placeLabel}>
                  {barber.venue === 'domicile'
                    ? `Chez vous — ${barber.address}`
                    : `${VENUES[barber.venue] || 'En salon'} · ${barber.salon}`}
                </Text>
                {barber.address && barber.venue !== 'domicile' && (
                  <Text style={[s.placeLabel, { opacity: 0.7 }]}>{barber.address}</Text>
                )}
              </View>
              {(barber.salonPhotos || []).length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                  {barber.salonPhotos.map((ph) => (
                    <TouchableOpacity key={ph.id} activeOpacity={0.85} onPress={() => setViewer(ph)}>
                      <Photo label={ph.label} tex={ph.tex} uri={ph.uri} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <Section>Compétences</Section>
              <View style={[s.wrap, { gap: 6 }]}>
                {barber.tags.map((t) => <Tag key={t} label={t} />)}
              </View>

              <Section>En chiffres</Section>
              <View style={s.stats}>
                {[
                  [barber.clients, 'CLIENTS'],
                  [barber.prestations, 'COUPES'],
                  [barber.years + ' ans', 'MÉTIER'],
                  [barber.ponct + ' %', 'PONCTUEL'],
                ].map(([v, l], i) => (
                  <View key={l} style={[s.stat, i > 0 && { borderLeftWidth: 1, borderLeftColor: C.line }]}>
                    <Text style={s.statV}>{v}</Text>
                    <Text style={s.statL}>{l}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {dtab === 'prest' && (
            <>
              <Section note="tarif de base — varie selon l’horaire">Prestations</Section>
              {services.map((sv) => (
                <View key={sv.id} style={[s.card, s.row]}>
                  <View style={s.grow}>
                    <Text style={[s.bname, { fontSize: 14 }]}>{sv.name}</Text>
                    <Text style={[s.btags, { marginTop: 2 }]}>{sv.dur} min</Text>
                  </View>
                  <Text style={s.price}>{fmt(sv.price)}</Text>
                </View>
              ))}
              <Text style={s.footnote}>
                Soirée après 20 h, nuit après 22 h, week-end et urgence : le prix exact s’affiche sur chaque créneau au moment de réserver.
              </Text>
            </>
          )}

          {dtab === 'avis' && (
            <>
              <Section note={`note moyenne ★ ${barber.rating}`}>Avis</Section>
              <View style={s.card}>
                {barber.reviews.map((r, i) => (
                  <View key={r.who + '-' + i} style={[s.review, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
                    <View style={s.row}>
                      <Text style={[s.bname, s.grow, { fontSize: 13 }]}>{r.who}</Text>
                      <Stars n={r.note} />
                    </View>
                    {r.txt ? <Text style={s.reviewTxt}>« {r.txt} »</Text> : null}
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Réservation — toujours visible */}
      <View style={s.cta}>
        <Btn label="RÉSERVER L’ARTISTE" onPress={() => onBook(barber.id)} />
      </View>

      <PhotoViewer photo={viewer} onClose={() => setViewer(null)} />
    </View>
  );
}

/* Créneaux ouverts, filtrés par fenêtre horaire de la formule.
   On lit directement l’agenda : chaque barber peut avoir sa propre grille. */
function openSlotsFor(agenda, dayIdx, barberId, window) {
  const day = DAYS[dayIdx];
  const now = new Date();
  const list = barberId === 'any' ? BARBERS : BARBERS.filter((b) => b.id === barberId);
  const seen = {};
  const out = [];
  for (const b of list) {
    const slots = agenda[b.id]?.[day.key] || {};
    for (const [time, sl] of Object.entries(slots)) {
      if (sl.status !== 'open' || !inWindow(time, window) || seen[time]) continue;
      const date = timeToDate(day, time);
      if (date < now) continue;
      seen[time] = true;
      out.push({ time, date, barber: b });
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

function BookScreen({ agenda, formulas, services, booking, setBooking, dayIdx, setDayIdx, onConfirm }) {
  if (booking.done) {
    const d = booking.done;
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.screenPad}>
        <Kicker>CONFIRMATION</Kicker>
        <Title em="réservé">C’est </Title>
        <Lead>Nous vous attendons. Un rappel sera envoyé la veille et une heure avant.</Lead>
        <View style={[s.card, { borderColor: C.lineGold }]}>
          <Text style={[s.bname, { fontSize: 17 }]}>{d.serv}</Text>
          <Text style={[s.btags, { marginVertical: 6 }]}>{d.day} à {d.time} · avec {d.barber}</Text>
          {d.rules.length > 0 && <Text style={s.ruleText}>{d.rules.join('  +  ')}</Text>}
          <Text style={[s.price, { fontSize: 24, marginTop: 8 }]}>{fmt(d.price)}</Text>
        </View>
        {d.recur && (
          <View style={[s.card, s.row]}>
            <Feather name="refresh-cw" size={19} color={C.gold} />
            <Text style={[s.softText, s.grow]}>
              Rendez-vous hebdomadaire : ce créneau est reconduit chaque semaine, annulable à tout moment.
            </Text>
          </View>
        )}
        {[
          ['bell', 'Rappels automatiques : la veille puis 1 h avant le rendez-vous.'],
          ...(d.loyalty ? [['gift', `+${Math.floor(d.price / 100)} points fidélité crédités chez ${d.barber} — 1 € dépensé = 1 point.`]] : []),
        ].map(([ic, txt]) => (
          <View key={ic} style={[s.card, s.row]}>
            <Feather name={ic} size={19} color={C.gold} />
            <Text style={[s.softText, s.grow]}>{txt}</Text>
          </View>
        ))}
        <Btn ghost label="NOUVELLE RÉSERVATION"
          onPress={() => setBooking({ barber: 'any', formula: null, service: null, done: null })} />
      </ScrollView>
    );
  }

  // Formules proposées : celles du barber choisi (toutes actives), génériques sinon
  const available = booking.barber === 'enzo'
    ? formulas.filter((f) => f.active)
    : booking.barber === 'any'
      ? formulas.filter((f) => f.active && (f.id === 'f1' || f.id === 'f2'))
      : initFormulas().filter((f) => f.active);
  const formula = available.find((f) => f.id === booking.formula) || null;
  const needService = formula && formula.fixed == null;
  const service = services.find((x) => x.id === booking.service);
  const ready = formula && (!needService || service);
  const slots = ready ? openSlotsFor(agenda, dayIdx, booking.barber, formula.window) : [];
  const now = new Date();

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenPad}>
      <Kicker>RENDEZ-VOUS</Kicker>
      <Title>Réserver</Title>
      <Lead>L’artiste, la formule, puis le créneau — parmi ceux que vos barbers ont ouverts.</Lead>

      <Section>L’artiste</Section>
      <View style={s.wrap}>
        <Chip label="Premier disponible" on={booking.barber === 'any'}
          onPress={() => setBooking({ ...booking, barber: 'any', formula: null })} />
        {BARBERS.map((b) => (
          <Chip key={b.id} label={b.name.split(' ')[0]} on={booking.barber === b.id}
            onPress={() => setBooking({ ...booking, barber: b.id, formula: null })} />
        ))}
      </View>

      <Section>La formule</Section>
      {available.map((f) => {
        const on = booking.formula === f.id;
        return (
          <TouchableOpacity key={f.id} style={[s.opt, on && s.optOn]} activeOpacity={0.8}
            onPress={() => setBooking({ ...booking, formula: f.id })}>
            <Feather name={f.icon} size={17} color={on ? C.gold : C.muted} />
            <View style={s.grow}>
              <View style={s.row}>
                <Text style={[s.optText, s.grow]}>{f.name}</Text>
                <Text style={s.formulaMeta}>
                  {f.dur} min · {WINDOWS[f.window]}{f.fixed != null ? ` · ${fmt(f.fixed)}` : ''}{f.recur ? ' · −15 %' : ''}
                </Text>
              </View>
              <Text style={[s.btags, { marginTop: 3 }]}>{f.desc}</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {needService && (
        <>
          <Section>La prestation</Section>
          <View style={s.wrap}>
            {services.map((sv) => (
              <Chip key={sv.id} label={sv.name} price={fmt(sv.price)} on={booking.service === sv.id}
                onPress={() => setBooking({ ...booking, service: sv.id })} />
            ))}
          </View>
        </>
      )}

      {ready && (
        <>
          <Section note="point doré = disponibilités">Le jour</Section>
          <Calendar sel={dayIdx} onSel={setDayIdx} markFor={(key) => {
            const list = booking.barber === 'any' ? BARBERS : BARBERS.filter((b) => b.id === booking.barber);
            for (const b of list) {
              const d = agenda[b.id]?.[key] || {};
              for (const [time, sl] of Object.entries(d)) {
                if (sl.status === 'open' && inWindow(time, formula.window)) return 'open';
              }
            }
            return null;
          }} />
          <Section note={`${DAYS[dayIdx].label} · ${slots.length} créneau${slots.length > 1 ? 'x' : ''} ouvert${slots.length > 1 ? 's' : ''}`}>
            Le créneau
          </Section>
          {slots.length === 0 ? (
            <Text style={s.footnote}>
              Aucun créneau ouvert ce jour pour cette formule.{'\n'}
              {formula.window === 'night'
                ? 'La formule Nocturne ne propose que les créneaux après 20 h.'
                : 'Essayez un autre jour ou un autre artiste.'}
            </Text>
          ) : (
            <>
              {slots.map((sl) => {
                const q = quoteFor(formula, service, sl.date, now);
                return (
                  <TouchableOpacity key={sl.barber.id + sl.time} style={[s.card, s.row]}
                    onPress={() => onConfirm(formula, service, sl, q)} activeOpacity={0.8}>
                    <Text style={s.slotTime}>{sl.time}</Text>
                    <View style={s.grow}>
                      <Text style={s.softText}>{sl.barber.name}</Text>
                      {q.rules.length > 0 && <Text style={s.ruleText}>{q.rules.join('  +  ')}</Text>}
                    </View>
                    <Text style={s.price}>{fmt(q.price)}</Text>
                  </TouchableOpacity>
                );
              })}
              <Text style={s.footnote}>
                Les prix évoluent selon l’horaire — soirée après 20 h, nuit après 22 h, week-end, urgence.
              </Text>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function CutsScreen({ history, setHistory, setBarbers, user, toast }) {
  const [pendingRate, setPendingRate] = useState(null); // { id, n }
  const [comment, setComment] = useState('');
  const [viewer, setViewer] = useState(null);

  const publishReview = (h) => {
    const n = pendingRate.n;
    setHistory((hs) => hs.map((x) => (x.id === h.id ? { ...x, rating: n } : x)));
    if (h.barberId) {
      const txt = comment.trim();
      setBarbers((bs) => bs.map((b) =>
        b.id === h.barberId
          ? { ...b, reviews: [{ who: user?.firstName || 'Client', note: n, txt }, ...b.reviews] }
          : b
      ));
    }
    setPendingRate(null);
    setComment('');
    toast(`Merci pour votre avis — ${'★'.repeat(n)} pour ${h.barber}.`);
  };

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={s.screen} contentContainerStyle={s.screenPad} keyboardShouldPersistTaps="handled">
      <Kicker>GALERIE PERSONNELLE</Kicker>
      <Title em="coupes">Mes </Title>
      <Lead>Après chaque prestation, votre barber photographie le résultat. Tout reste ici.</Lead>
      {history.length === 0 && (
        <Text style={s.footnote}>Aucune coupe pour l’instant — votre première apparaîtra ici.</Text>
      )}
      {history.map((h) => (
        <View key={h.id} style={s.card}>
          <Text style={[s.bname, { fontSize: 15 }]}>{h.servs}</Text>
          <Text style={[s.btags, { marginTop: 3, marginBottom: 12 }]}>
            {h.date} · {h.barber} · <Text style={{ color: C.gold }}>{fmt(h.price)}</Text>
          </Text>
          {h.photos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {h.photos.map((ph) => (
                <TouchableOpacity key={ph.id} activeOpacity={0.85} onPress={() => setViewer(ph)}>
                  <Photo label={ph.label} tex={ph.tex} uri={ph.uri} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={s.footnote}>Pas de photo pour cette prestation.</Text>
          )}

          {/* ── Avis 5 étoiles ── */}
          {h.rating != null ? (
            <View style={[s.row, { gap: 8, marginTop: 13 }]}>
              <Stars n={h.rating} />
              <Text style={s.btags}>Votre avis</Text>
            </View>
          ) : (
            <View style={s.rateBox}>
              <Text style={[s.btags, { marginBottom: 8 }]}>Comment s’est passée cette coupe ?</Text>
              <View style={[s.row, { gap: 6, marginBottom: 4 }]}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const on = pendingRate?.id === h.id && pendingRate.n >= n;
                  return (
                    <TouchableOpacity key={n} hitSlop={6}
                      onPress={() => setPendingRate({ id: h.id, n })}>
                      <Text style={[s.rateStarBig, on && { color: C.gold, opacity: 1 }]}>★</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {pendingRate?.id === h.id && (
                <>
                  <TextInput style={[s.input, { marginTop: 8 }]} value={comment} onChangeText={setComment}
                    placeholder="Un mot sur la prestation ? (facultatif)" placeholderTextColor="#5A5852" />
                  <Btn label={`PUBLIER MON AVIS ${'★'.repeat(pendingRate.n)}`} onPress={() => publishReview(h)} />
                </>
              )}
            </View>
          )}

          <View style={[s.wrap, { marginTop: 13 }]}>
            <Chip mini label="Télécharger" onPress={() => savePhotos(h.photos, toast)} />
            <Chip mini label="Partager" onPress={() => toast('Lien de partage copié.')} />
            <Chip mini label="Montrer" onPress={() => toast('À montrer à votre prochain barber.')} />
          </View>
        </View>
      ))}
    </ScrollView>
    <PhotoViewer photo={viewer} onClose={() => setViewer(null)}
      onDownload={(ph) => savePhotos([ph], toast)} />
    </View>
  );
}

function ShopScreen({ products, cat, setCat, cart, addCart, toast }) {
  const list = products.filter((p) => cat === 'ALL' || p.cat === cat);
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenPad}>
      <Kicker>BOUTIQUE</Kicker>
      <Title em="essentiels">Les </Title>
      <Lead>Les produits utilisés au salon, livrés chez vous ou à retirer sur place.</Lead>
      <View style={[s.wrap, { marginBottom: 16 }]}>
        {CATS.map(([k, l]) => (
          <Chip key={k} mini label={l} on={cat === k} onPress={() => setCat(k)} />
        ))}
      </View>
      <View style={s.grid}>
        {list.map((p) => (
          <View key={p.id} style={s.pcard}>
            <View style={[s.pimg, { backgroundColor: TEX[p.tex] }]}>
              <Feather name={p.ic} size={26} color="rgba(200,169,106,0.5)" />
            </View>
            <Text style={s.pname} numberOfLines={2}>{p.name}</Text>
            <Text style={s.pprice}>{fmt(p.price)}</Text>
            <Text style={s.pstock}>{p.stock > 0 ? `${p.stock} en stock` : 'Épuisé'}</Text>
            <TouchableOpacity style={s.add} onPress={() => addCart(p)} activeOpacity={0.8}>
              <Text style={s.addText}>AJOUTER</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
      {cart > 0 && (
        <Btn label={`COMMANDER · ${cart} ARTICLE${cart > 1 ? 'S' : ''}`}
          onPress={() => toast('Paiement Stripe — CB, Apple Pay, Google Pay.')} />
      )}
    </ScrollView>
  );
}

function MeScreen({ user, points, barbers, upcoming, onLogout }) {
  // points uniquement chez les barbers qui ont activé la fidélité
  const progs = barbers.filter((b) => b.loyalty && (points[b.id] || 0) > 0);
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenPad}>
      <Kicker>ESPACE PERSONNEL</Kicker>
      <Title>{user ? user.firstName : 'Profil'}</Title>
      <Lead>{user ? user.email : 'Membre depuis mars 2026'}</Lead>
      {progs.length === 0 ? (
        <View style={[s.card, s.row]}>
          <Feather name="gift" size={19} color={C.gold} />
          <Text style={[s.softText, s.grow]}>
            Pas encore de points — vous en cumulez à chaque réservation chez les barbers qui ont activé la fidélité.
          </Text>
        </View>
      ) : (
        progs.map((b) => (
          <View key={b.id} style={[s.card, { borderColor: C.lineGold }]}>
            <View style={s.row}>
              <View style={s.grow}>
                <Text style={s.statL}>FIDÉLITÉ · CHEZ {b.name.split(' ')[0].toUpperCase()}</Text>
                <Text style={s.points}>
                  {points[b.id]} <Text style={{ fontSize: 16 }}>points</Text>
                </Text>
              </View>
              <Feather name="gift" size={22} color={C.gold} />
            </View>
            <View style={s.divider} />
            <Text style={s.footnoteLeft}>
              1 € dépensé = 1 point, valable uniquement chez {b.name}. À échanger contre une réduction, un produit ou une coupe offerte.
            </Text>
          </View>
        ))
      )}
      <Section>À venir</Section>
      {upcoming.length === 0 ? (
        <Text style={s.footnote}>
          Aucun rendez-vous à venir.{'\n'}Réservez votre prochaine coupe dans l’onglet Réserver.
        </Text>
      ) : (
        upcoming.map((u, i) => (
          <View key={i} style={[s.card, s.row]}>
            <Feather name={u.recur ? 'refresh-cw' : 'calendar'} size={18} color={C.gold} />
            <View style={s.grow}>
              <Text style={[s.bname, { fontSize: 13.5 }]}>{u.serv} · {u.day} {u.time}</Text>
              <Text style={[s.btags, { marginTop: 2 }]}>
                avec {u.barber}{u.recur ? ' · chaque semaine' : ''}
              </Text>
            </View>
            <Text style={[s.price, { fontSize: 15 }]}>{fmt(u.price)}</Text>
          </View>
        ))
      )}
      <Section>Paiement</Section>
      <View style={[s.card, s.row]}>
        <Feather name="credit-card" size={18} color={C.gold} />
        <Text style={[s.softText, s.grow]}>
          Carte bancaire, Apple Pay, Google Pay ou sur place. Acompte selon la prestation.
        </Text>
      </View>
      <Btn ghost icon="log-out" label="SE DÉCONNECTER" onPress={onLogout} />
    </ScrollView>
  );
}

/* ───────── Espace BARBER (connecté : Enzo Moreau) ───────── */
const STEP_CHOICES = [15, 20, 30, 45, 60];

// Base clients de démonstration — dans la version connectée, ce serait une vraie BDD
const INIT_CLIENTS = [
  { id: 'c1', firstName: 'Karim', lastName: 'Doukali', phone: '06 11 22 33 44', notes: 'Burst fade court sur les côtés' },
  { id: 'c2', firstName: 'Lucas', lastName: 'Bernard', phone: '06 55 66 77 88', notes: 'Coupe classique, pas trop court' },
  { id: 'c3', firstName: 'Mehdi', lastName: 'Ait', phone: '06 99 00 11 22', notes: 'Barbe uniquement' },
  { id: 'c4', firstName: 'Sacha', lastName: 'Laurent', phone: '07 12 34 56 78', notes: 'Transformation — avant/après photos' },
  { id: 'c5', firstName: 'Noah', lastName: 'Petit', phone: '07 98 76 54 32', notes: 'Coupe enfant' },
];

function SlotsScreen({ agenda, setAgenda, daycfg, setDaycfg, clients, setClients, services, dayIdx, setDayIdx, toast }) {
  const day = DAYS[dayIdx];
  const step = daycfg[day.key] || 30;
  const slots = agenda.enzo[day.key] || {};
  const gridTimes = timesFor(step);
  // Les réservations prises sur une ancienne grille restent visibles
  const offGrid = Object.keys(slots).filter((t) => slots[t].status === 'booked' && !gridTimes.includes(t));
  const allTimes = [...gridTimes, ...offGrid].sort();
  const nOpen = Object.values(slots).filter((x) => x.status === 'open').length;
  const nPause = Object.values(slots).filter((x) => x.status === 'pause').length;
  const nBooked = Object.values(slots).filter((x) => x.status === 'booked').length;

  const update = (fn) => {
    setAgenda((a) => {
      const copy = { ...(a.enzo[day.key] || {}) };
      fn(copy);
      return { ...a, enzo: { ...a.enzo, [day.key]: copy } };
    });
  };

  // Touchez : fermé → ouvert → pause → fermé. Les réservations sont verrouillées.
  const cycle = (time) => {
    const cur = slots[time];
    if (cur && cur.status === 'booked') {
      toast(`${time} — déjà réservé par ${cur.who}.`);
      return;
    }
    update((d) => {
      if (!d[time]) d[time] = { status: 'open' };
      else if (d[time].status === 'open') d[time] = { status: 'pause' };
      else delete d[time];
    });
  };

  // ── Réservation manuelle par le barber ──
  const [bookModal, setBookModal] = useState(null); // { time } | null
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [addingClient, setAddingClient] = useState(false);
  const [newCFn, setNewCFn] = useState('');
  const [newCLn, setNewCLn] = useState('');
  const [newCPh, setNewCPh] = useState('');

  const openBookModal = (time) => {
    if (slots[time]?.status === 'booked') { toast(`${time} — déjà réservé.`); return; }
    if (!slots[time] || slots[time].status === 'closed') {
      toast('Ouvrez d\'abord ce créneau.'); return;
    }
    setBookModal({ time });
    setClientSearch('');
    setSelectedClient(null);
    setSelectedService(null);
    setAddingClient(false);
  };

  const confirmManualBook = () => {
    if (!selectedClient || !selectedService) { toast('Choisissez un client et une prestation.'); return; }
    const who = `${selectedClient.firstName} ${selectedClient.lastName[0]}.`;
    update((d) => {
      d[bookModal.time] = { status: 'booked', who, serv: selectedService.name, price: selectedService.price, done: false };
    });
    toast(`${who} · ${selectedService.name} · ${bookModal.time} — réservation posée.`);
    setBookModal(null);
  };

  const saveNewClient = () => {
    if (!newCFn.trim() || !newCLn.trim()) { toast('Prénom et nom requis.'); return; }
    const c = { id: 'c' + Date.now(), firstName: newCFn.trim(), lastName: newCLn.trim(), phone: newCPh.trim(), notes: '' };
    setClients((cs) => [...cs, c]);
    setSelectedClient(c);
    setAddingClient(false);
    setNewCFn(''); setNewCLn(''); setNewCPh('');
    toast(`${c.firstName} ${c.lastName} ajouté à la base clients.`);
  };

  const filteredClients = clientSearch.trim()
    ? clients.filter((c) => `${c.firstName} ${c.lastName} ${c.phone}`.toLowerCase().includes(clientSearch.toLowerCase()))
    : clients;

  // Changement de durée : les réservations sont conservées, les créneaux
  // ouverts/pauses alignés sur la nouvelle grille aussi.
  const changeStep = (v) => {
    setDaycfg((c) => ({ ...c, [day.key]: v }));
    setAgenda((a) => {
      const old = a.enzo[day.key] || {};
      const next = {};
      Object.entries(old).forEach(([time, sl]) => {
        const [h, m] = time.split(':').map(Number);
        const mins = h * 60 + m;
        if (sl.status === 'booked' || ((mins - 540) % v === 0 && mins + v <= 23 * 60)) next[time] = sl;
      });
      return { ...a, enzo: { ...a.enzo, [day.key]: next } };
    });
    toast(`Créneaux de ${v} min — ${day.label.toLowerCase()}.`);
  };

  const bulk = (label, predicate, mode) => {
    update((d) => {
      gridTimes.forEach((time) => {
        if (!predicate(Number(time.slice(0, 2)))) return;
        if (d[time] && d[time].status === 'booked') return;
        if (mode) d[time] = { status: mode };
        else delete d[time];
      });
    });
    toast(label);
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenPad}>
      <Kicker>ESPACE BARBER · ENZO MOREAU</Kicker>
      <Title em="créneaux">Mes </Title>
      <Lead>
        Votre agenda, vos règles : choisissez une date sur le calendrier — jusqu’à deux mois à l’avance —
        puis ouvrez, fermez ou posez des pauses. Touchez une case : fermé → ouvert → pause.
      </Lead>
      <Calendar sel={dayIdx} onSel={setDayIdx} markFor={(key) => {
        const vals = Object.values(agenda.enzo[key] || {});
        if (vals.some((v) => v.status === 'booked')) return 'booked';
        if (vals.some((v) => v.status === 'open')) return 'open';
        return null;
      }} />
      <Text style={[s.btags, { marginTop: 10 }]}>{DAYS[dayIdx].label}</Text>

      <Text style={s.fieldLabel}>DURÉE PAR CRÉNEAU — SELON VOTRE RYTHME</Text>
      <View style={s.wrap}>
        {STEP_CHOICES.map((v) => (
          <Chip key={v} mini label={`${v} min`} on={step === v} onPress={() => changeStep(v)} />
        ))}
      </View>

      <View style={[s.row, { marginTop: 16, marginBottom: 12, gap: 13, flexWrap: 'wrap' }]}>
        <View style={s.row}><View style={[s.dot, { backgroundColor: '#3A3A40' }]} /><Text style={s.legend}>Fermé</Text></View>
        <View style={s.row}><View style={[s.dot, { backgroundColor: C.gold }]} /><Text style={s.legend}>Ouvert</Text></View>
        <View style={s.row}><View style={[s.dot, { backgroundColor: C.orange }]} /><Text style={s.legend}>Pause</Text></View>
        <View style={s.row}><View style={[s.dot, { backgroundColor: C.green }]} /><Text style={s.legend}>Réservé</Text></View>
      </View>
      <Text style={[s.btags, { marginBottom: 12 }]}>
        {nOpen} ouvert{nOpen > 1 ? 's' : ''} · {nPause} pause{nPause > 1 ? 's' : ''} · {nBooked} réservé{nBooked > 1 ? 's' : ''}
      </Text>

      <View style={s.slotGrid}>
        {allTimes.map((time) => {
          const sl = slots[time];
          const st = sl ? sl.status : 'closed';
          return (
            <TouchableOpacity
              key={time}
              style={[
                s.slotCell,
                st === 'open' && s.slotOpen,
                st === 'pause' && s.slotPause,
                st === 'booked' && s.slotBooked,
              ]}
              onPress={() => cycle(time)}
              onLongPress={() => st === 'open' && openBookModal(time)}
              activeOpacity={0.75}
            >
              <Text style={[s.slotCellTime, st === 'closed' && { color: '#5A5852' }, st === 'booked' && { color: C.ink }]}>
                {time}
              </Text>
              {st === 'booked' ? (
                <Text style={s.slotCellWho} numberOfLines={1}>{sl.who}</Text>
              ) : (
                <Text style={[
                  s.slotCellState,
                  st === 'open' && { color: C.gold },
                  st === 'pause' && { color: C.orange },
                ]}>
                  {st === 'open' ? 'ouvert' : st === 'pause' ? 'pause' : 'fermé'}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[s.footnote, { marginTop: 4 }]}>
        Appui long sur un créneau ouvert pour réserver directement pour un client.
      </Text>

      <Section>Actions rapides</Section>
      <View style={s.wrap}>
        <Chip mini label="Ouvrir la journée (9h–18h)" onPress={() => bulk('Journée ouverte — 9h à 18h.', (h) => h >= 9 && h < 18, 'open')} />
        <Chip mini label="Ouvrir la soirée (20h–23h)" onPress={() => bulk('Soirée ouverte — tarifs soirée/nuit appliqués.', (h) => h >= 20, 'open')} />
        <Chip mini label="Pause déjeuner (12h–14h)" onPress={() => bulk('Pause déjeuner posée — 12h à 14h.', (h) => h >= 12 && h < 14, 'pause')} />
        <Chip mini label="Tout fermer" onPress={() => bulk('Tous les créneaux libres ont été fermés.', () => true, null)} />
      </View>
      <Text style={s.footnote}>
        La durée se règle jour par jour — 20 min pour les coupes rapides, 60 min pour les transformations.
        Les pauses et les créneaux fermés sont invisibles côté client ; les réservations existantes sont toujours conservées.
      </Text>

      {/* ── Modale réservation manuelle ── */}
      {bookModal && (
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <View style={[s.row, { marginBottom: 16 }]}>
              <Text style={[s.bname, { fontFamily: SERIF, fontSize: 17, flex: 1 }]}>
                Réserver · {bookModal.time}
              </Text>
              <TouchableOpacity onPress={() => setBookModal(null)} hitSlop={10}>
                <Feather name="x" size={20} color={C.muted} />
              </TouchableOpacity>
            </View>

            {/* Sélection prestation */}
            <Text style={s.fieldLabel}>PRESTATION</Text>
            <View style={[s.wrap, { marginBottom: 12 }]}>
              {services.map((sv) => (
                <Chip key={sv.id} mini label={sv.name} price={fmt(sv.price)}
                  on={selectedService?.id === sv.id}
                  onPress={() => setSelectedService(sv)} />
              ))}
            </View>

            {/* Recherche client */}
            <Text style={s.fieldLabel}>CLIENT</Text>
            {!addingClient ? (
              <>
                <View style={[s.search, { marginBottom: 8 }]}>
                  <Feather name="search" size={14} color={C.muted} />
                  <TextInput style={s.searchInput} placeholder="Chercher par nom ou téléphone…"
                    placeholderTextColor="#5A5852" value={clientSearch} onChangeText={setClientSearch} />
                </View>
                <View style={{ maxHeight: 180 }}>
                  <ScrollView nestedScrollEnabled>
                    {filteredClients.map((c) => (
                      <TouchableOpacity key={c.id}
                        style={[s.clientRow, selectedClient?.id === c.id && s.clientRowOn]}
                        onPress={() => setSelectedClient(c)} activeOpacity={0.8}>
                        <View style={s.grow}>
                          <Text style={[s.bname, { fontSize: 13.5 }]}>{c.firstName} {c.lastName}</Text>
                          {c.phone ? <Text style={s.btags}>{c.phone}</Text> : null}
                          {c.notes ? <Text style={[s.btags, { fontStyle: 'italic' }]} numberOfLines={1}>{c.notes}</Text> : null}
                        </View>
                        {selectedClient?.id === c.id && <Feather name="check-circle" size={16} color={C.gold} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <TouchableOpacity onPress={() => setAddingClient(true)} style={{ marginTop: 8 }} hitSlop={6}>
                  <Text style={s.authLink}>+ Nouveau client</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={[s.card, { borderColor: C.lineGold, marginBottom: 0 }]}>
                <Field label="PRÉNOM" placeholder="Prénom" value={newCFn} onChangeText={setNewCFn} />
                <Field label="NOM" placeholder="Nom" value={newCLn} onChangeText={setNewCLn} />
                <Field label="TÉLÉPHONE" placeholder="06 …" keyboardType="phone-pad" value={newCPh} onChangeText={setNewCPh} />
                <Btn label="ENREGISTRER" onPress={saveNewClient} />
                <Btn ghost label="ANNULER" onPress={() => setAddingClient(false)} />
              </View>
            )}

            {!addingClient && (
              <Btn label="CONFIRMER LA RÉSERVATION" onPress={confirmManualBook} />
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const DUR_CHOICES = [30, 45, 60, 90, 120];
const ICON_FOR_WINDOW = { all: 'tag', day: 'sun', evening: 'sunset', night: 'moon' };

/* Champ prix en euros, libre */
function PriceField({ cents, onChange }) {
  const [txt, setTxt] = useState(String(cents / 100).replace('.', ','));
  return (
    <View style={s.priceField}>
      <TextInput
        style={s.priceInput}
        keyboardType="numeric"
        value={txt}
        onChangeText={(t) => {
          setTxt(t);
          const v = parseFloat(t.replace(',', '.'));
          if (!isNaN(v) && v > 0) onChange(Math.round(v * 100));
        }}
      />
      <Text style={{ color: C.gold, fontFamily: SERIF, fontSize: 15, fontWeight: '700' }}>€</Text>
    </View>
  );
}

function FormulasScreen({ formulas, setFormulas, services, setServices, toast }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [dur, setDur] = useState(45);
  const [windowSel, setWindowSel] = useState('all');
  const [priceMode, setPriceMode] = useState('dyn');
  const [priceTxt, setPriceTxt] = useState('');
  const [recur, setRecur] = useState(false);
  const [addingServ, setAddingServ] = useState(false);
  const [svName, setSvName] = useState('');
  const [svDur, setSvDur] = useState(30);
  const [svPrice, setSvPrice] = useState('');

  const createService = () => {
    const label = svName.trim();
    const v = parseFloat(svPrice.replace(',', '.'));
    if (!label) { toast('Donnez un nom à votre prestation.'); return; }
    if (isNaN(v) || v <= 0) { toast('Indiquez un prix valide.'); return; }
    setServices((ss) => [...ss, { id: 'sv' + Date.now(), name: label, dur: svDur, price: Math.round(v * 100) }]);
    setAddingServ(false); setSvName(''); setSvPrice(''); setSvDur(30);
    toast(`Prestation « ${label} » créée — vos clients peuvent la réserver.`);
  };

  const removeService = (sv) => {
    setServices((ss) => ss.filter((x) => x.id !== sv.id));
    toast(`Prestation « ${sv.name} » supprimée.`);
  };

  const toggleActive = (id) => {
    setFormulas((fs) => fs.map((f) => {
      if (f.id !== id) return f;
      toast(f.active ? `Formule « ${f.name} » désactivée.` : `Formule « ${f.name} » visible par vos clients.`);
      return { ...f, active: !f.active };
    }));
  };

  const create = () => {
    const label = name.trim();
    if (!label) {
      toast('Donnez un nom à votre formule.');
      return;
    }
    let fixed = null;
    if (priceMode === 'fixed') {
      const v = parseFloat(priceTxt.replace(',', '.'));
      if (isNaN(v) || v <= 0) {
        toast('Indiquez un prix valide pour votre formule.');
        return;
      }
      fixed = Math.round(v * 100);
    }
    setFormulas((fs) => [
      ...fs,
      {
        id: 'f' + (fs.length + 1) + Date.now(),
        name: label,
        icon: recur ? 'refresh-cw' : ICON_FOR_WINDOW[windowSel],
        dur,
        window: windowSel,
        fixed,
        recur,
        active: true,
        desc: `${dur} min · ${WINDOWS[windowSel]}${recur ? ' · chaque semaine' : ''}${fixed == null ? ' · tarif dynamique' : ''}`,
      },
    ]);
    setCreating(false);
    setName('');
    setDur(45);
    setWindowSel('all');
    setPriceMode('dyn');
    setPriceTxt('');
    setRecur(false);
    toast(`Formule « ${label} » créée — vos clients peuvent la réserver.`);
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenPad} keyboardShouldPersistTaps="handled">
      <Kicker>ESPACE BARBER · ENZO MOREAU</Kicker>
      <Title em="formules">Mes </Title>
      <Lead>
        Créez vos types de rendez-vous — nocturne, transformation, hebdomadaire… Vos clients réservent dans le cadre que vous fixez.
      </Lead>

      <Section note="créez vos types de coupe, au prix que vous voulez">Mes tarifs</Section>
      {services.map((sv) => (
        <View key={sv.id} style={[s.card, s.row, { gap: 12 }]}>
          <View style={s.grow}>
            <Text style={[s.bname, { fontSize: 14 }]}>{sv.name}</Text>
            <Text style={[s.btags, { marginTop: 2 }]}>{sv.dur} min</Text>
          </View>
          <PriceField cents={sv.price} onChange={(v) =>
            setServices((ss) => ss.map((x) => x.id === sv.id ? { ...x, price: v } : x))
          } />
          <TouchableOpacity onPress={() => removeService(sv)} hitSlop={8}>
            <Feather name="trash-2" size={16} color={C.red} />
          </TouchableOpacity>
        </View>
      ))}

      {addingServ ? (
        <View style={[s.card, { borderColor: C.lineGold }]}>
          <Text style={[s.bname, { marginBottom: 10 }]}>Nouvelle prestation</Text>
          <Field label="NOM" placeholder="Ex. Dégradé américain, Locks, Défrisage…"
            value={svName} onChangeText={setSvName} />
          <Text style={s.fieldLabel}>DURÉE</Text>
          <View style={[s.wrap, { marginBottom: 4 }]}>
            {[20, 25, ...DUR_CHOICES].map((d) => (
              <Chip key={d} mini label={`${d} min`} on={svDur === d} onPress={() => setSvDur(d)} />
            ))}
          </View>
          <Field label="PRIX (€)" placeholder="35" keyboardType="numeric"
            value={svPrice} onChangeText={setSvPrice} />
          <Btn label="CRÉER LA PRESTATION" onPress={createService} />
          <Btn ghost label="ANNULER" onPress={() => setAddingServ(false)} />
        </View>
      ) : (
        <Btn ghost icon="plus" label="NOUVELLE PRESTATION" onPress={() => setAddingServ(true)} />
      )}

      <Section>Mes formules</Section>
      {formulas.map((f) => (
        <View key={f.id} style={[s.card, !f.active && { opacity: 0.55 }]}>
          <View style={s.row}>
            <Feather name={f.icon} size={17} color={C.gold} />
            <View style={s.grow}>
              <View style={s.row}>
                <Text style={[s.bname, s.grow, { fontSize: 14.5 }]}>{f.name}</Text>
                <Text style={s.formulaMeta}>
                  {f.dur} min · {WINDOWS[f.window]}{f.fixed != null ? ` · ${fmt(f.fixed)}` : ''}{f.recur ? ' · hebdo' : ''}
                </Text>
              </View>
              <Text style={[s.btags, { marginTop: 3 }]}>{f.desc}</Text>
            </View>
            <Toggle on={f.active} onPress={() => toggleActive(f.id)} />
          </View>
        </View>
      ))}

      {creating ? (
        <View style={[s.card, { borderColor: C.lineGold }]}>
          <Text style={[s.bname, { marginBottom: 12 }]}>Nouvelle formule</Text>
          <Text style={s.fieldLabel}>NOM</Text>
          <TextInput
            style={s.input}
            placeholder="Ex. Rendez-vous domicile, Express midi…"
            placeholderTextColor="#5A5852"
            value={name}
            onChangeText={setName}
          />
          <Text style={s.fieldLabel}>DURÉE</Text>
          <View style={s.wrap}>
            {DUR_CHOICES.map((d) => (
              <Chip key={d} mini label={`${d} min`} on={dur === d} onPress={() => setDur(d)} />
            ))}
          </View>
          <Text style={s.fieldLabel}>FENÊTRE HORAIRE</Text>
          <View style={s.wrap}>
            {Object.entries(WINDOWS).map(([k, l]) => (
              <Chip key={k} mini label={l} on={windowSel === k} onPress={() => setWindowSel(k)} />
            ))}
          </View>
          <Text style={s.fieldLabel}>TARIF</Text>
          <View style={s.wrap}>
            <Chip mini label="Tarif dynamique" on={priceMode === 'dyn'} onPress={() => setPriceMode('dyn')} />
            <Chip mini label="Prix fixe" on={priceMode === 'fixed'} onPress={() => setPriceMode('fixed')} />
          </View>
          {priceMode === 'fixed' && (
            <View style={[s.row, { marginTop: 10 }]}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                keyboardType="numeric"
                placeholder="Votre prix, ex. 50"
                placeholderTextColor="#5A5852"
                value={priceTxt}
                onChangeText={setPriceTxt}
              />
              <Text style={{ color: C.gold, fontFamily: SERIF, fontSize: 17, fontWeight: '700' }}>€</Text>
            </View>
          )}
          <Text style={s.fieldLabel}>RÉCURRENCE</Text>
          <View style={s.wrap}>
            <Chip mini label="Ponctuel" on={!recur} onPress={() => setRecur(false)} />
            <Chip mini label="Hebdomadaire (−15 %)" on={recur} onPress={() => setRecur(true)} />
          </View>
          <Btn label="CRÉER LA FORMULE" onPress={create} />
          <Btn ghost label="ANNULER" onPress={() => setCreating(false)} />
        </View>
      ) : (
        <Btn ghost icon="plus" label="NOUVELLE FORMULE" onPress={() => setCreating(true)} />
      )}
      <Text style={s.footnote}>
        Une formule désactivée disparaît immédiatement du parcours de réservation client.
      </Text>
    </ScrollView>
  );
}

function PlanningScreen({ agenda, setAgenda, dayIdx, setDayIdx, delay, setHistory, toast }) {
  const day = DAYS[dayIdx];
  const slots = agenda.enzo[day.key] || {};
  const rdv = Object.entries(slots)
    .filter(([, v]) => v.status === 'booked')
    .map(([time, v]) => ({ time, ...v }))
    .sort((a, b) => a.time.localeCompare(b.time));
  const ca = rdv.filter((r) => r.done).reduce((sum, r) => sum + r.price, 0);
  const todo = rdv.filter((r) => !r.done).length;

  const [finModal, setFinModal] = useState(null); // rdv en cours de clôture
  const [finPhotos, setFinPhotos] = useState([]);

  const cancel = (time, who) => {
    setAgenda((a) => ({
      ...a,
      enzo: {
        ...a.enzo,
        [day.key]: { ...a.enzo[day.key], [time]: { status: 'open' } },
      },
    }));
    toast(`Réservation de ${who} annulée — créneau ${time} réouvert.`);
  };

  const addFinPhoto = async (fromCamera) => {
    if (finPhotos.length >= 10) { toast('Maximum 10 photos par prestation.'); return; }
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') { toast('Permission refusée.'); return; }
    const opts = { mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [3, 4], quality: 0.85 };
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled) return;
    const labels = ['Face', 'Profil gauche', 'Profil droit', 'Arrière'];
    setFinPhotos((ps) => [...ps, {
      id: 'fp' + Date.now(),
      label: labels[ps.length] || `Photo ${ps.length + 1}`,
      tex: ps.length % 4,
      uri: result.assets[0].uri,
    }]);
  };

  const confirmFinish = () => {
    const r = finModal;
    setAgenda((a) => ({
      ...a,
      enzo: {
        ...a.enzo,
        [day.key]: { ...a.enzo[day.key], [r.time]: { ...a.enzo[day.key][r.time], done: true } },
      },
    }));
    const d = day.date;
    setHistory((hs) => [{
      id: 'h' + Date.now(),
      date: `${d.getDate()} ${MO[d.getMonth()]} ${d.getFullYear()}`,
      barber: 'Enzo Moreau', barberId: 'enzo',
      servs: r.serv, price: r.price,
      photos: finPhotos, rating: null,
    }, ...hs]);
    setFinModal(null);
    setFinPhotos([]);
    toast(finPhotos.length > 0
      ? `Coupe terminée — ${finPhotos.length} photo${finPhotos.length > 1 ? 's' : ''} envoyée${finPhotos.length > 1 ? 's' : ''} dans l’historique du client.`
      : 'Coupe terminée — le client peut maintenant laisser un avis.');
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={s.screen} contentContainerStyle={s.screenPad}>
        <Kicker>ESPACE BARBER · ENZO MOREAU</Kicker>
        <Title>Planning</Title>
        <View style={[s.row, { gap: 14, marginBottom: 16 }]}>
          <Badge status={delay} />
          <Text style={s.btags}>{todo} à venir{ca > 0 ? ` · ${fmt(ca)} encaissés` : ''}</Text>
        </View>
        <Calendar sel={dayIdx} onSel={setDayIdx} markFor={(key) => {
          const vals = Object.values(agenda.enzo[key] || {});
          return vals.some((v) => v.status === 'booked') ? 'booked' : null;
        }} />
        <Text style={[s.btags, { marginVertical: 12 }]}>{DAYS[dayIdx].label}</Text>
        {rdv.length === 0 ? (
          <Text style={s.footnote}>
            Aucune réservation ce jour.{'\n'}Ouvrez des créneaux dans l’onglet Créneaux pour recevoir des clients.
          </Text>
        ) : (
          rdv.map((r) => (
            <View key={r.time} style={[s.card, s.row, r.done && { opacity: 0.45 }]}>
              <Text style={s.slotTime}>{r.time}</Text>
              <View style={s.grow}>
                <Text style={[s.bname, { fontSize: 14 }]}>{r.who}</Text>
                <Text style={[s.btags, { marginTop: 2 }]}>{r.serv}</Text>
              </View>
              {r.done ? (
                <Feather name="check" size={17} color={C.green} />
              ) : (
                <View style={[s.row, { gap: 12 }]}>
                  <Text style={[s.price, { fontSize: 15 }]}>{fmt(r.price)}</Text>
                  <TouchableOpacity onPress={() => { setFinModal(r); setFinPhotos([]); }} hitSlop={10}>
                    <Feather name="check-circle" size={20} color={C.green} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => cancel(r.time, r.who)} hitSlop={10}>
                    <Feather name="x-circle" size={20} color={C.red} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
        <Text style={s.footnote}>
          ✓ pour terminer une coupe (avec ou sans photos du résultat) — ✕ pour annuler la réservation.
        </Text>
      </ScrollView>

      {/* ── Fin de coupe : photos du résultat ── */}
      {finModal && (
        <View style={s.modalOverlay}>
          <TouchableOpacity style={s.grow} activeOpacity={1} onPress={() => setFinModal(null)} />
          <View style={s.modal}>
            <Text style={[s.bname, { fontSize: 16 }]}>Terminer la coupe</Text>
            <Text style={[s.btags, { marginTop: 3, marginBottom: 14 }]}>
              {finModal.time} · {finModal.who} · {finModal.serv} · {fmt(finModal.price)}
            </Text>
            <Text style={[s.fieldLabel]}>PHOTOS DU RÉSULTAT (FACULTATIF — VISIBLES PAR LE CLIENT)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={{ overflow: 'visible' }}
              contentContainerStyle={{ paddingTop: 10, paddingBottom: 6 }}>
              {finPhotos.map((ph) => (
                <View key={ph.id} style={{ position: 'relative', marginRight: 12 }}>
                  <Photo label={ph.label} tex={ph.tex} uri={ph.uri} />
                  <TouchableOpacity style={s.photoRemove}
                    onPress={() => setFinPhotos((ps) => ps.filter((p) => p.id !== ph.id))} hitSlop={8}>
                    <Feather name="x" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={[s.photoAdd, { marginRight: 9 }]} onPress={() => addFinPhoto(true)} activeOpacity={0.8}>
                <Feather name="camera" size={22} color={C.gold} />
                <Text style={[s.btags, { marginTop: 6, textAlign: 'center' }]}>Appareil{'\n'}photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.photoAdd} onPress={() => addFinPhoto(false)} activeOpacity={0.8}>
                <Feather name="image" size={22} color={C.gold} />
                <Text style={[s.btags, { marginTop: 6, textAlign: 'center' }]}>Galerie</Text>
              </TouchableOpacity>
            </ScrollView>
            <Btn label={finPhotos.length > 0
              ? `TERMINER — ENVOYER ${finPhotos.length} PHOTO${finPhotos.length > 1 ? 'S' : ''}`
              : 'TERMINER SANS PHOTO'} onPress={confirmFinish} />
            <Btn ghost label="ANNULER" onPress={() => setFinModal(null)} />
          </View>
        </View>
      )}
    </View>
  );
}

function StatusScreen({ agenda, delay, setDelay, toast }) {
  const todayBooked = Object.values(agenda.enzo[DAYS[0].key] || {})
    .filter((v) => v.status === 'booked' && !v.done).length;
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenPad}>
      <Kicker>ESPACE BARBER</Kicker>
      <Title em="statut">Mon </Title>
      <Lead>Vos clients du jour sont prévenus automatiquement à chaque changement.</Lead>
      {Object.entries(DELAY).map(([k, v]) => {
        const on = delay === k;
        return (
          <TouchableOpacity
            key={k}
            style={[s.opt, on && s.optOn]}
            activeOpacity={0.8}
            onPress={() => {
              setDelay(k);
              toast(`${todayBooked} client${todayBooked > 1 ? 's' : ''} notifié${todayBooked > 1 ? 's' : ''} — « Enzo · ${v.label} »`);
            }}
          >
            <View style={[s.dotLg, { backgroundColor: v.dot }]} />
            <Text style={[s.optText, s.grow]}>{v.label}</Text>
            {on && <Text style={s.optActive}>ACTIF</Text>}
          </TouchableOpacity>
        );
      })}
      <Text style={s.footnote}>
        Votre statut est visible en direct sur le profil que voient les clients.
      </Text>
    </ScrollView>
  );
}

function ActivityScreen({ agenda }) {
  const todaySlots = Object.values(agenda.enzo[DAYS[0].key] || {});
  const booked = todaySlots.filter((v) => v.status === 'booked');
  const open = todaySlots.filter((v) => v.status === 'open').length;
  const ca = booked.filter((r) => r.done).reduce((sum, r) => sum + r.price, 0);
  const fill = booked.length + open > 0 ? Math.round((booked.length / (booked.length + open)) * 100) : 0;
  const top = [['Burst Fade', 38], ['Coupe + Barbe', 27], ['Transformation', 21], ['Barbe seule', 14]];
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenPad}>
      <Kicker>ESPACE BARBER</Kicker>
      <Title>Activité</Title>
      <Lead>Vos chiffres, en un coup d’œil.</Lead>
      <View style={s.kpis}>
        {[
          [fmt(ca), 'CA DU JOUR'], ['1 240 €', 'CA SEMAINE'], ['4 980 €', 'CA MOIS'],
          [fill + ' %', 'REMPLISSAGE'], [String(booked.length), 'RDV AUJOURD’HUI'], ['★ 4,9', 'NOTE MOYENNE'],
        ].map(([v, l]) => (
          <View key={l} style={s.kpi}>
            <Text style={s.kpiV}>{v}</Text>
            <Text style={s.kpiL}>{l}</Text>
          </View>
        ))}
      </View>
      <Section>Prestations demandées</Section>
      <View style={s.card}>
        {top.map(([name, pct]) => (
          <View key={name} style={{ paddingVertical: 8 }}>
            <View style={[s.row, { marginBottom: 7 }]}>
              <Text style={[s.softText, s.grow, { color: C.text }]}>{name}</Text>
              <Text style={s.rate}>{pct} %</Text>
            </View>
            <View style={s.barBg}>
              <View style={[s.barFill, { width: `${pct}%` }]} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/* ───────── Gestion de la fiche barber ───────── */
function FicheScreen({ barbers, setBarbers, products, setProducts, onPreview, toast }) {
  const enzo = barbers.find((b) => b.id === 'enzo');

  const [bio, setBio] = useState(enzo.bio);
  const [address, setAddress] = useState(enzo.address);
  const [salon, setSalon] = useState(enzo.salon);
  const [ini, setIni] = useState(enzo.ini);
  const [zone, setZone] = useState(enzo.address);
  const [tagInput, setTagInput] = useState('');
  const [stClients, setStClients] = useState(String(enzo.clients));
  const [stCuts, setStCuts] = useState(String(enzo.prestations));
  const [stYears, setStYears] = useState(String(enzo.years));
  const [stPonct, setStPonct] = useState(String(enzo.ponct));
  const [addingProduct, setAddingProduct] = useState(false);
  const [pName, setPName] = useState('');
  const [pCat, setPCat] = useState('CIRE');
  const [pPrice, setPPrice] = useState('');
  const [pStock, setPStock] = useState('');

  const updateEnzo = (fn) =>
    setBarbers((bs) => bs.map((b) => (b.id === 'enzo' ? { ...b, ...fn(b) } : b)));

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || enzo.tags.includes(t)) return;
    updateEnzo((b) => ({ tags: [...b.tags, t] }));
    setTagInput('');
    toast(`Spécialité « ${t} » ajoutée.`);
  };

  const pickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { toast('Permission refusée — accès à la galerie requis.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [16, 9], quality: 0.85,
    });
    if (result.canceled) return;
    updateEnzo(() => ({ coverImage: result.assets[0].uri }));
    toast('Image de couverture mise à jour.');
  };

  const addPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { toast('Permission refusée — accès à la galerie requis.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [3, 4], quality: 0.85,
    });
    if (result.canceled) return;
    const id = 'ph' + Date.now();
    const count = (enzo.photos || []).length;
    updateEnzo((b) => ({
      photos: [...(b.photos || []), { id, label: 'Prestation ' + (count + 1), tex: count % 4, uri: result.assets[0].uri }],
    }));
    toast('Photo ajoutée.');
  };

  const addSalonPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { toast('Permission refusée — accès à la galerie requis.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [3, 4], quality: 0.85,
    });
    if (result.canceled) return;
    const id = 'sp' + Date.now();
    const count = (enzo.salonPhotos || []).length;
    updateEnzo((b) => ({
      salonPhotos: [...(b.salonPhotos || []), { id, label: 'Salon ' + (count + 1), tex: (count + 2) % 4, uri: result.assets[0].uri }],
    }));
    toast('Photo du salon ajoutée.');
  };

  const renamePhoto = (key, pid, label) =>
    updateEnzo((b) => ({ [key]: (b[key] || []).map((p) => (p.id === pid ? { ...p, label } : p)) }));

  const saveStats = () => {
    const years = parseInt(stYears, 10);
    const ponct = parseInt(stPonct, 10);
    updateEnzo(() => ({
      clients: stClients.trim() || '0',
      prestations: stCuts.trim() || '0',
      years: isNaN(years) ? enzo.years : years,
      ponct: isNaN(ponct) ? enzo.ponct : Math.min(100, Math.max(0, ponct)),
    }));
    toast('Chiffres mis à jour.');
  };

  const updateProductLocal = (pid, changes) =>
    setProducts((ps) => ps.map((p) => (p.id === pid ? { ...p, ...changes } : p)));

  const saveProduct = () => {
    const price = Math.round(parseFloat(pPrice.replace(',', '.')) * 100);
    const stock = parseInt(pStock, 10);
    if (!pName.trim() || isNaN(price) || price <= 0 || isNaN(stock) || stock < 0) {
      toast('Renseignez tous les champs — prix et stock requis.');
      return;
    }
    setProducts((ps) => [
      ...ps,
      { id: 'p' + Date.now(), name: pName.trim(), cat: pCat, price, stock, ic: 'box', tex: ps.length % 4 },
    ]);
    setPName(''); setPPrice(''); setPStock('');
    setAddingProduct(false);
    toast(`« ${pName.trim()} » ajouté à la boutique.`);
  };

  const curCover = enzo.coverColor || TEX[enzo.tex];

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenPad} keyboardShouldPersistTaps="handled">
      <Kicker>ESPACE BARBER · ENZO MOREAU</Kicker>
      <Title em="fiche">Ma </Title>
      <Lead>Modifiez votre fiche — les clients voient les changements en temps réel.</Lead>

      <Btn icon="eye" label="APERÇU — VUE CLIENT" onPress={onPreview} />

      {/* ── Photo de couverture ── */}
      <Section>Photo de couverture</Section>
      {/* mini-hero preview */}
      <View style={[s.coverPreview, { backgroundColor: curCover }]}>
        {enzo.coverImage
          ? <Image source={{ uri: enzo.coverImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : null}
        <Text style={[s.coverPreviewIni, enzo.coverImage && { opacity: 0 }]}>{enzo.ini}</Text>
        <View style={s.coverPreviewBadge}>
          <Text style={s.bigVenueText}>{VENUES[enzo.venue] || 'En salon'}</Text>
        </View>
      </View>
      <Btn icon="image" label="CHOISIR UNE PHOTO DE COUVERTURE" onPress={pickCover} />
      {enzo.coverImage && (
        <Btn ghost icon="trash-2" label="SUPPRIMER L’IMAGE DE COUVERTURE" onPress={() => { updateEnzo(() => ({ coverImage: null })); toast('Image de couverture supprimée.'); }} />
      )}
      <Text style={s.fieldLabel}>COULEUR DE FOND</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={[s.row, { gap: 9 }]}>
          {COVER_COLORS.map((col) => (
            <TouchableOpacity key={col}
              style={[s.swatch, { backgroundColor: col }, curCover === col && s.swatchOn]}
              onPress={() => { updateEnzo(() => ({ coverColor: col })); toast('Couleur de couverture mise à jour.'); }}>
              {curCover === col && <Feather name="check" size={14} color={C.gold} />}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <Field label="INITIALES (2-3 lettres)" placeholder="EM" value={ini} onChangeText={(t) => setIni(t.toUpperCase().slice(0, 3))} />
      <Btn ghost label="ENREGISTRER LES INITIALES" onPress={() => {
        if (!ini.trim()) return;
        updateEnzo(() => ({ ini: ini.trim() }));
        toast('Initiales mises à jour.');
      }} />

      {/* ── Lieu de coupe ── */}
      <Section>Lieu de coupe</Section>
      <View style={s.wrap}>
        {[['salon', 'En salon', 'scissors'], ['studio', 'Studio privé', 'star'], ['domicile', 'À domicile', 'home']].map(([key, label, icon]) => (
          <TouchableOpacity key={key}
            style={[s.opt, enzo.venue === key && s.optOn, { flexDirection: 'row', gap: 8, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 }]}
            onPress={() => { updateEnzo(() => ({ venue: key })); toast(`Lieu : ${label}.`); }}
            activeOpacity={0.8}>
            <Feather name={icon} size={16} color={enzo.venue === key ? C.gold : C.muted} />
            <Text style={[s.optText, { fontSize: 13 }]}>{label}</Text>
            {enzo.venue === key && <Text style={[s.optActive, s.grow, { textAlign: 'right' }]}>ACTIF</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Nom du salon / Zone ── */}
      {enzo.venue !== 'domicile' ? (
        <>
          <Section>Nom du {enzo.venue === 'studio' ? 'studio' : 'salon'}</Section>
          <TextInput style={s.input} value={salon} onChangeText={setSalon}
            placeholder="Nom du lieu" placeholderTextColor="#5A5852" />
          <Btn ghost label="ENREGISTRER LE NOM" onPress={() => { updateEnzo(() => ({ salon: salon.trim() })); toast('Nom mis à jour.'); }} />
          <Section>Adresse</Section>
          <TextInput style={s.input} value={address} onChangeText={setAddress}
            placeholder="Adresse complète" placeholderTextColor="#5A5852" />
          <Btn ghost label="ENREGISTRER L’ADRESSE" onPress={() => { updateEnzo(() => ({ address: address.trim() })); toast('Adresse mise à jour.'); }} />
        </>
      ) : (
        <>
          <Section>Zone de déplacement</Section>
          <TextInput style={s.input} value={zone} onChangeText={setZone}
            placeholder="Ex. Lille, La Madeleine, Lambersart…" placeholderTextColor="#5A5852" />
          <Btn ghost label="ENREGISTRER LA ZONE" onPress={() => { updateEnzo(() => ({ address: zone.trim() })); toast('Zone de déplacement mise à jour.'); }} />
        </>
      )}

      {/* ── Description ── */}
      <Section>Description</Section>
      <TextInput style={[s.input, { height: 90, textAlignVertical: 'top', paddingTop: 10 }]}
        multiline value={bio} onChangeText={setBio}
        placeholder="Votre bio courte…" placeholderTextColor="#5A5852" />
      <Btn ghost label="ENREGISTRER LA BIO" onPress={() => { updateEnzo(() => ({ bio: bio.trim() })); toast('Bio mise à jour.'); }} />

      {/* ── Spécialités ── */}
      <Section>Spécialités</Section>
      <View style={[s.wrap, { gap: 6, marginBottom: 10 }]}>
        {enzo.tags.map((t) => (
          <TouchableOpacity key={t} style={[s.tag, s.row, { gap: 5 }]}
            onPress={() => { updateEnzo((b) => ({ tags: b.tags.filter((x) => x !== t) })); toast(`« ${t} » retiré.`); }}
            activeOpacity={0.7}>
            <Text style={s.tagText}>{t}</Text>
            <Feather name="x" size={10} color={C.gold} />
          </TouchableOpacity>
        ))}
      </View>
      <View style={[s.row, { gap: 9 }]}>
        <TextInput style={[s.input, { flex: 1 }]} placeholder="Ex. Taper, Coloration…"
          placeholderTextColor="#5A5852" value={tagInput} onChangeText={setTagInput}
          onSubmitEditing={addTag} returnKeyType="done" />
        <TouchableOpacity style={s.iconBtn} onPress={addTag} hitSlop={6}>
          <Feather name="plus" size={18} color={C.gold} />
        </TouchableOpacity>
      </View>

      {/* ── Photos de prestations ── */}
      <Section note="résultats de coupes — titre modifiable sous chaque photo">Photos de prestations</Section>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 6, overflow: 'visible' }}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 4 }}>
        {(enzo.photos || []).map((ph) => (
          <View key={ph.id} style={{ position: 'relative', marginRight: 12 }}>
            <Photo tex={ph.tex} uri={ph.uri} />
            <TextInput style={s.photoTitleInput} value={ph.label} placeholder="Titre"
              placeholderTextColor="#5A5852"
              onChangeText={(t) => renamePhoto('photos', ph.id, t)} />
            <TouchableOpacity style={s.photoRemove}
              onPress={() => { updateEnzo((b) => ({ photos: b.photos.filter((p) => p.id !== ph.id) })); toast('Photo supprimée.'); }}
              hitSlop={8}>
              <Feather name="x" size={12} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={s.photoAdd} onPress={addPhoto} activeOpacity={0.8}>
          <Feather name="plus" size={22} color={C.gold} />
          <Text style={[s.btags, { marginTop: 6, textAlign: 'center' }]}>Ajouter</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Photos du salon ── */}
      <Section note="votre lieu de coupe vu par les clients">Photos du salon</Section>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 6, overflow: 'visible' }}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 4 }}>
        {(enzo.salonPhotos || []).map((ph) => (
          <View key={ph.id} style={{ position: 'relative', marginRight: 12 }}>
            <Photo tex={ph.tex} uri={ph.uri} />
            <TextInput style={s.photoTitleInput} value={ph.label} placeholder="Titre"
              placeholderTextColor="#5A5852"
              onChangeText={(t) => renamePhoto('salonPhotos', ph.id, t)} />
            <TouchableOpacity style={s.photoRemove}
              onPress={() => { updateEnzo((b) => ({ salonPhotos: b.salonPhotos.filter((p) => p.id !== ph.id) })); toast('Photo du salon supprimée.'); }}
              hitSlop={8}>
              <Feather name="x" size={12} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={s.photoAdd} onPress={addSalonPhoto} activeOpacity={0.8}>
          <Feather name="plus" size={22} color={C.gold} />
          <Text style={[s.btags, { marginTop: 6, textAlign: 'center' }]}>Ajouter</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── En chiffres ── */}
      <Section note="affichés en bas de votre fiche client">En chiffres</Section>
      <View style={[s.row, { gap: 10 }]}>
        <View style={s.grow}>
          <Field label="CLIENTS" value={stClients} onChangeText={setStClients} keyboardType="numeric" placeholder="1 240" />
        </View>
        <View style={s.grow}>
          <Field label="COUPES" value={stCuts} onChangeText={setStCuts} keyboardType="numeric" placeholder="3 680" />
        </View>
      </View>
      <View style={[s.row, { gap: 10 }]}>
        <View style={s.grow}>
          <Field label="ANNÉES DE MÉTIER" value={stYears} onChangeText={setStYears} keyboardType="numeric" placeholder="8" />
        </View>
        <View style={s.grow}>
          <Field label="PONCTUALITÉ (%)" value={stPonct} onChangeText={setStPonct} keyboardType="numeric" placeholder="97" />
        </View>
      </View>
      <Btn ghost label="ENREGISTRER LES CHIFFRES" onPress={saveStats} />

      {/* ── Fidélité ── */}
      <Section note="1 € dépensé = 1 point, cumulé uniquement chez vous">Fidélité</Section>
      <View style={[s.card, s.row, { gap: 10 }]}>
        <View style={s.grow}>
          <Text style={[s.bname, { fontSize: 13.5 }]}>Points de fidélité</Text>
          <Text style={[s.btags, { marginTop: 2 }]}>
            {enzo.loyalty
              ? 'Vos clients cumulent des points à chaque prestation chez vous.'
              : 'Programme désactivé — vos clients ne cumulent pas de points.'}
          </Text>
        </View>
        <Toggle on={!!enzo.loyalty} onPress={() => {
          updateEnzo((b) => ({ loyalty: !b.loyalty }));
          toast(enzo.loyalty ? 'Programme de fidélité désactivé.' : 'Programme de fidélité activé.');
        }} />
      </View>

      {/* ── Boutique ── */}
      <Section note="désactivez-la si vous ne vendez pas de produits">Boutique — mes produits</Section>
      <View style={[s.card, s.row, { gap: 10 }]}>
        <View style={s.grow}>
          <Text style={[s.bname, { fontSize: 13.5 }]}>Boutique activée</Text>
          <Text style={[s.btags, { marginTop: 2 }]}>
            {enzo.shopEnabled !== false
              ? 'Vos produits sont visibles dans l’onglet Boutique des clients.'
              : 'L’onglet Boutique est masqué pour vos clients.'}
          </Text>
        </View>
        <Toggle on={enzo.shopEnabled !== false} onPress={() => {
          const next = !(enzo.shopEnabled !== false);
          updateEnzo(() => ({ shopEnabled: next }));
          toast(next ? 'Boutique activée — visible par vos clients.' : 'Boutique désactivée.');
        }} />
      </View>
      {enzo.shopEnabled !== false && (
      <>
      {products.map((p) => (
        <View key={p.id} style={[s.card, s.row, { gap: 10 }]}>
          <View style={[s.pimg, { width: 44, height: 44, borderRadius: 10, flexShrink: 0 }]}>
            <Feather name={p.ic} size={17} color="rgba(200,169,106,0.5)" />
          </View>
          <View style={s.grow}>
            <Text style={[s.bname, { fontSize: 12.5 }]} numberOfLines={1}>{p.name}</Text>
            <Text style={s.btags}>{CATS.find(([k]) => k === p.cat)?.[1] || p.cat} · {p.stock} en stock</Text>
          </View>
          <PriceField cents={p.price} onChange={(v) => { updateProductLocal(p.id, { price: v }); toast(`Prix de « ${p.name} » mis à jour.`); }} />
          <TouchableOpacity onPress={() => { setProducts((ps) => ps.filter((x) => x.id !== p.id)); toast(`« ${p.name} » retiré de la boutique.`); }} hitSlop={8}>
            <Feather name="trash-2" size={16} color={C.red} />
          </TouchableOpacity>
        </View>
      ))}

      {addingProduct ? (
        <View style={[s.card, { borderColor: C.lineGold }]}>
          <Text style={[s.bname, { marginBottom: 10 }]}>Nouveau produit</Text>
          <Field label="NOM" placeholder="Ex. Baume après-rasage" value={pName} onChangeText={setPName} />
          <Text style={s.fieldLabel}>CATÉGORIE</Text>
          <View style={s.wrap}>
            {CATS.filter(([k]) => k !== 'ALL').map(([k, l]) => (
              <Chip key={k} mini label={l} on={pCat === k} onPress={() => setPCat(k)} />
            ))}
          </View>
          <View style={[s.row, { gap: 11, alignItems: 'flex-start' }]}>
            <View style={s.grow}>
              <Field label="PRIX (€)" placeholder="19,90" keyboardType="numeric" value={pPrice} onChangeText={setPPrice} />
            </View>
            <View style={s.grow}>
              <Field label="STOCK" placeholder="25" keyboardType="numeric" value={pStock} onChangeText={setPStock} />
            </View>
          </View>
          <Btn label="AJOUTER À LA BOUTIQUE" onPress={saveProduct} />
          <Btn ghost label="ANNULER" onPress={() => { setAddingProduct(false); setPName(''); setPPrice(''); setPStock(''); }} />
        </View>
      ) : (
        <Btn ghost icon="plus" label="NOUVEAU PRODUIT" onPress={() => setAddingProduct(true)} />
      )}
      </>
      )}

      <Text style={s.footnote}>Modifications visibles immédiatement côté client.</Text>
    </ScrollView>
  );
}

/* ───────── Racine ───────── */
const CLIENT_TABS = [
  ['explore', 'search', 'Explorer'],
  ['book', 'calendar', 'Réserver'],
  ['cuts', 'image', 'Mes coupes'],
  ['shop', 'shopping-bag', 'Boutique'],
  ['me', 'user', 'Profil'],
];
const BARBER_TABS = [
  ['slots', 'unlock', 'Créneaux'],
  ['formulas', 'layers', 'Formules'],
  ['planning', 'calendar', 'Planning'],
  ['status', 'clock', 'Statut'],
  ['activity', 'bar-chart-2', 'Activité'],
  ['fiche', 'edit-3', 'Ma fiche'],
];

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState(null); // null | 'client' | 'barber'
  const [user, setUser] = useState(null); // { firstName, lastName, email, role, plan }
  const [authStep, setAuthStep] = useState(null); // null | { role } — flow connexion/inscription
  const [authSubStep, setAuthSubStep] = useState(null); // null | 'plan' | 'pay' — abonnement barber
  const [tab, setTab] = useState('explore');
  const [barberDetail, setBarberDetail] = useState(null);
  const [agenda, setAgenda] = useState(initAgenda);
  const [daycfg, setDaycfg] = useState({}); // durée des créneaux par jour (Enzo)
  const [formulas, setFormulas] = useState(initFormulas);
  const [services, setServices] = useState(() => [...SERVICES]);
  const [booking, setBooking] = useState({ barber: 'any', formula: null, service: null, done: null });
  const [clientDay, setClientDay] = useState(0);
  const [barberDay, setBarberDay] = useState(0);
  const [cat, setCat] = useState('ALL');
  const [cart, setCart] = useState(0);
  const [points, setPoints] = useState({ enzo: 86 }); // points fidélité par barber
  const [upcoming, setUpcoming] = useState([]);
  const [enzoDelay, setEnzoDelay] = useState('ON_TIME');
  const [toastMsg, setToastMsg] = useState(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef(null);

  const [barbers, setBarbers] = useState(() => [...BARBERS]);
  const [products, setProducts] = useState(() => [...PRODUCTS]);
  const [barberPreview, setBarberPreview] = useState(false);
  const [clients, setClients] = useState(() => [...INIT_CLIENTS]);
  const [history, setHistory] = useState(() => [...HISTORY]);

  const barbersLive = barbers.map((b) => (b.id === 'enzo' ? { ...b, delay: enzoDelay } : b));

  const toast = (msg) => {
    setToastMsg(msg);
    Animated.timing(toastAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }, 3200);
  };

  const choose = (r) => setAuthStep({ role: r });

  const finalizeLogin = (u) => {
    setUser(u);
    setRole(u.role);
    setTab(u.role === 'client' ? 'explore' : 'slots');
    setAuthStep(null);
    setAuthSubStep(null);
    setBarberDetail(null);
    toast(u.role === 'barber'
      ? `Bienvenue ${u.firstName} — votre espace barber est prêt.`
      : `Bienvenue ${u.firstName} !`);
  };

  const onAuthSuccess = (u, { isNew }) => {
    if (u.role === 'barber' && isNew) {
      setUser(u); // en attente du choix d’abonnement
      setAuthSubStep('plan');
    } else {
      finalizeLogin(u);
    }
  };

  const logout = () => {
    setRole(null);
    setUser(null);
    setAuthStep(null);
    setAuthSubStep(null);
    setBarberDetail(null);
  };

  const confirmBooking = (formula, service, slot, quote) => {
    const day = DAYS[clientDay];
    const servLabel = formula.fixed != null
      ? formula.name
      : formula.id === 'f1' ? service.name : `${formula.name} · ${service.name}`;
    setAgenda((a) => ({
      ...a,
      [slot.barber.id]: {
        ...a[slot.barber.id],
        [day.key]: {
          ...a[slot.barber.id][day.key],
          [slot.time]: { status: 'booked', who: user ? `${user.firstName} ${user.lastName[0]}.` : 'Client', serv: servLabel, price: quote.price, done: false },
        },
      },
    }));
    const hasLoyalty = !!barbers.find((b) => b.id === slot.barber.id)?.loyalty;
    setBooking({
      ...booking,
      done: {
        serv: servLabel, time: slot.time, day: day.label, barber: slot.barber.name,
        price: quote.price, rules: quote.rules, recur: formula.recur, loyalty: hasLoyalty,
      },
    });
    if (hasLoyalty) {
      setPoints((p) => ({ ...p, [slot.barber.id]: (p[slot.barber.id] || 0) + Math.floor(quote.price / 100) }));
    }
    setUpcoming((u) => [...u, {
      serv: servLabel, time: slot.time, day: day.label, barber: slot.barber.name,
      price: quote.price, recur: formula.recur,
    }]);
    toast(`Réservation confirmée — ${day.label} ${slot.time} avec ${slot.barber.name.split(' ')[0]} · ${fmt(quote.price)}`);
  };

  const addCart = (p) => {
    setCart((n) => {
      toast(`${p.name} — ajouté au panier (${n + 1})`);
      return n + 1;
    });
  };

  // La boutique du salon n’apparaît côté client que si le barber l’a activée
  const shopOn = barbers.find((b) => b.id === 'enzo')?.shopEnabled !== false;

  let content = null;
  if (role === 'client') {
    if (barberDetail) {
      content = (
        <BarberDetailScreen
          barber={barbersLive.find((b) => b.id === barberDetail.id)}
          services={services}
          toast={toast}
          onBack={() => setBarberDetail(null)}
          onBook={(id) => {
            setBooking({ barber: id, formula: null, service: null, done: null });
            setBarberDetail(null);
            setTab('book');
          }}
        />
      );
    } else if (tab === 'explore') content = <ExploreScreen barbers={barbersLive} user={user} openBarber={setBarberDetail} toast={toast} />;
    else if (tab === 'book') content = (
      <BookScreen agenda={agenda} formulas={formulas} services={services} booking={booking} setBooking={setBooking}
        dayIdx={clientDay} setDayIdx={setClientDay} onConfirm={confirmBooking} />
    );
    else if (tab === 'cuts') content = <CutsScreen history={history} setHistory={setHistory} setBarbers={setBarbers} user={user} toast={toast} />;
    else if (tab === 'shop' && shopOn) content = <ShopScreen products={products} cat={cat} setCat={setCat} cart={cart} addCart={addCart} toast={toast} />;
    else content = <MeScreen user={user} points={points} barbers={barbers} upcoming={upcoming} onLogout={logout} />;
  } else if (role === 'barber') {
    if (tab === 'slots') content = (
      <SlotsScreen agenda={agenda} setAgenda={setAgenda} daycfg={daycfg} setDaycfg={setDaycfg}
        clients={clients} setClients={setClients}
        services={services}
        dayIdx={barberDay} setDayIdx={setBarberDay} toast={toast} />
    );
    else if (tab === 'formulas') content = (
      <FormulasScreen formulas={formulas} setFormulas={setFormulas} services={services} setServices={setServices} toast={toast} />
    );
    else if (tab === 'planning') content = (
      <PlanningScreen agenda={agenda} setAgenda={setAgenda} dayIdx={barberDay} setDayIdx={setBarberDay} delay={enzoDelay} setHistory={setHistory} toast={toast} />
    );
    else if (tab === 'status') content = (
      <StatusScreen agenda={agenda} delay={enzoDelay} setDelay={setEnzoDelay} toast={toast} />
    );
    else if (tab === 'fiche') content = (
      <FicheScreen barbers={barbers} setBarbers={setBarbers} products={products} setProducts={setProducts}
        onPreview={() => setBarberPreview(true)} toast={toast} />
    );
    else content = <ActivityScreen agenda={agenda} />;
    // Preview de la fiche : s’affiche par-dessus n’importe quel onglet barber
    if (barberPreview) content = (
      <BarberDetailScreen
        barber={barbersLive.find((b) => b.id === 'enzo')}
        services={services}
        toast={toast}
        onBack={() => setBarberPreview(false)}
        onBook={() => { setBarberPreview(false); toast('Aperçu — réservation désactivée.'); }}
      />
    );
  }

  const tabs = role === 'client'
    ? CLIENT_TABS.filter(([k]) => k !== 'shop' || shopOn)
    : BARBER_TABS;

  return (
    <View style={[s.root, { paddingTop: insets.top || (Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0) }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      {role === null && authStep === null ? (
        <WelcomeScreen choose={choose} />
      ) : authStep !== null ? (
        authSubStep === 'plan' ? (
          <PlanScreen
            onChoose={(plan) => { setUser((u) => ({ ...u, plan })); setAuthSubStep('pay'); }}
            onBack={() => setAuthSubStep(null)}
          />
        ) : authSubStep === 'pay' ? (
          <PayScreen user={user} plan={user.plan}
            onConfirm={() => finalizeLogin(user)}
            onBack={() => setAuthSubStep('plan')}
          />
        ) : (
          <AuthScreen role={authStep.role} onSuccess={onAuthSuccess}
            onBack={() => setAuthStep(null)} />
        )
      ) : (
        <>
          <View style={s.header}>
            <View style={{ width: 34 }} />
            <Text style={s.wordmark}>
              Barber<Text style={{ color: C.gold, fontStyle: 'italic' }}>Pro</Text>
            </Text>
            <TouchableOpacity style={s.switchBtn} onPress={logout} hitSlop={10}>
              <Feather name="repeat" size={15} color={C.muted} />
            </TouchableOpacity>
          </View>
          {content}
          <View style={[s.tabbar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            {tabs.map(([k, ic, l]) => {
              const on = tab === k && !barberDetail;
              return (
                <TouchableOpacity key={k} style={s.tabBtn}
                  onPress={() => { setTab(k); setBarberDetail(null); }} activeOpacity={0.7}>
                  <Feather name={ic} size={17} color={on ? C.gold2 : '#6E6B65'} />
                  <Text style={[s.tabLabel, on && { color: C.gold2 }]} numberOfLines={1}>{l}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
      {toastMsg && (
        <Animated.View style={[s.toast, { opacity: toastAnim }]} pointerEvents="none">
          <Text style={s.toastText}>{toastMsg}</Text>
        </Animated.View>
      )}
    </View>
  );
}

/* ───────── Styles ───────── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: PAD, paddingTop: 8, paddingBottom: 6,
  },
  wordmark: { fontFamily: SERIF, fontSize: 22, fontWeight: '600', color: C.text, letterSpacing: 1 },
  switchBtn: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },

  welcome: { flex: 1, justifyContent: 'center', padding: 26 },
  welcomeMark: { fontFamily: SERIF, fontSize: SMALL ? 38 : 44, fontWeight: '600', color: C.text, letterSpacing: 1 },
  welcomeRule: { width: 54, height: 1, backgroundColor: C.gold, marginVertical: 16, opacity: 0.7 },
  welcomeTag: { fontFamily: SERIF, fontStyle: 'italic', color: C.soft, fontSize: 15 },
  welcomeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
    borderRadius: 22, padding: 20, marginBottom: 14,
  },
  welcomeIcon: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: C.surface2,
    borderWidth: 1, borderColor: C.lineGold, alignItems: 'center', justifyContent: 'center',
  },
  welcomeCardTitle: { fontFamily: SERIF, fontSize: 19, fontWeight: '600', color: C.text, marginBottom: 4 },
  welcomeCardSub: { color: C.muted, fontSize: 11.5, lineHeight: 17 },
  welcomeFoot: { color: '#56534E', fontSize: 10, letterSpacing: 2, textAlign: 'center', marginTop: 22 },

  screen: { flex: 1 },
  screenPad: { padding: PAD, paddingBottom: 40 },

  kicker: { color: C.gold, fontSize: 10, letterSpacing: 3, marginBottom: 8, fontWeight: '500' },
  title: { fontFamily: SERIF, fontSize: SMALL ? 28 : 32, fontWeight: '600', color: C.text, marginBottom: 6, lineHeight: SMALL ? 32 : 36 },
  titleEm: { fontStyle: 'italic', color: C.gold2, fontWeight: '500' },
  lead: { color: C.muted, fontSize: 13, lineHeight: 20, marginBottom: 20 },

  secRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 12 },
  secText: { fontFamily: SERIF, fontSize: 19, fontWeight: '600', color: C.text },
  secNote: { color: C.muted, fontSize: 11 },
  secLine: { flex: 1, height: 1, backgroundColor: C.line },

  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
    borderRadius: 16, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 13 : 4,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 13.5, padding: 0 },

  locRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -2, marginBottom: 18 },
  locEditBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -2, marginBottom: 18,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.lineGold,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 9 : 5,
  },
  locText: { color: C.soft, fontSize: 12.5, flex: 1 },
  locEdit: { color: C.gold, fontSize: 11.5, fontWeight: '600' },
  locInput: { flex: 1, color: C.text, fontSize: 12.5, padding: 0 },

  /* Cartes carrousel (Explorer) */
  bigCard: { width: Math.floor(Math.min(SCREEN_W, 500) * 0.58), marginRight: 12 },
  bigArt: {
    height: 190, borderRadius: 20, borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  bigIni: { fontFamily: SERIF, fontSize: 52, fontWeight: '600', color: 'rgba(230,207,160,0.5)', marginTop: -44 },
  bigVenue: {
    position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(10,10,11,0.75)',
    borderWidth: 1, borderColor: C.lineGold, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
  },
  bigVenueText: { color: C.gold2, fontSize: 9, letterSpacing: 0.8 },
  bigShade: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 90,
    backgroundColor: 'rgba(8,8,9,0.62)',
  },
  bigInfo: { position: 'absolute', left: 12, right: 12, bottom: 11 },

  /* Fiche barber */
  heroArt: { height: 210, alignItems: 'center', justifyContent: 'center' },
  heroIni: { fontFamily: SERIF, fontSize: 84, fontWeight: '600', color: 'rgba(230,207,160,0.4)' },
  heroTop: {
    position: 'absolute', top: 12, left: PAD - 6, right: PAD - 6,
    flexDirection: 'row', alignItems: 'center', gap: 9,
  },
  circleBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(10,10,11,0.7)',
    borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center',
  },
  dtabs: {
    flexDirection: 'row', marginTop: 20, marginHorizontal: PAD,
    borderBottomWidth: 1, borderBottomColor: C.line,
  },
  dtab: { flex: 1, alignItems: 'center', paddingBottom: 11 },
  dtabOn: { borderBottomWidth: 2, borderBottomColor: C.gold, marginBottom: -1 },
  dtabText: { color: C.muted, fontSize: 13, letterSpacing: 0.3 },
  moreLink: { color: C.gold, fontSize: 12, fontStyle: 'italic', fontFamily: SERIF },
  place: {
    height: 140, borderRadius: 18, borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10, gap: 8,
  },
  placeLabel: { color: C.soft, fontSize: 11, letterSpacing: 1 },
  cta: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: PAD, paddingBottom: 12, paddingTop: 24,
    backgroundColor: 'rgba(10,10,11,0.0)',
  },

  card: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
    borderRadius: 20, padding: 16, marginBottom: 11,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  grow: { flex: 1, minWidth: 0 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  ava: {
    width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.lineGold,
  },
  avaLg: { width: 84, height: 84, borderRadius: 42 },
  avaText: { fontFamily: SERIF, fontSize: 20, fontWeight: '600', color: C.gold2 },

  bname: { color: C.text, fontSize: 15, fontWeight: '500' },
  btags: { color: C.muted, fontSize: 11.5 },
  bio: { fontFamily: SERIF, fontStyle: 'italic', fontSize: 15.5, lineHeight: 23, color: '#B9B5AC', marginBottom: 16 },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotLg: { width: 9, height: 9, borderRadius: 4.5 },
  badgeText: { color: '#CFCCC4', fontSize: 11 },
  rate: { color: C.gold, fontSize: 12, letterSpacing: 0.5 },
  legend: { color: C.soft, fontSize: 11 },

  tag: {
    borderWidth: 1, borderColor: C.lineGold, borderRadius: 999,
    paddingHorizontal: 9, paddingVertical: 3.5,
  },
  tagText: { color: C.gold, fontSize: 10, letterSpacing: 0.4 },

  chip: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
    borderRadius: 999, paddingHorizontal: 15, paddingVertical: 9,
  },
  chipMini: { paddingHorizontal: 13, paddingVertical: 7 },
  chipOn: { backgroundColor: C.gold, borderColor: C.gold },
  chipText: { color: '#CFCCC4', fontSize: 12 },
  chipTextOn: { color: C.ink, fontWeight: '600' },
  chipPrice: { color: C.gold },

  slotTime: { fontFamily: SERIF, fontSize: 19, fontWeight: '600', color: C.gold2, width: 56 },
  price: { fontFamily: SERIF, fontSize: 17, fontWeight: '700', color: C.gold },
  ruleText: { color: C.orange, fontSize: 10.5, marginTop: 2 },
  softText: { color: C.soft, fontSize: 12.5, lineHeight: 18 },
  footnote: { color: C.muted, fontSize: 12, textAlign: 'center', paddingVertical: 18, lineHeight: 19 },
  footnoteLeft: { color: C.muted, fontSize: 11.5, lineHeight: 18 },
  formulaMeta: { color: C.gold, fontSize: 10.5, letterSpacing: 0.3 },

  fieldLabel: { color: C.muted, fontSize: 9, letterSpacing: 1.8, marginTop: 14, marginBottom: 8 },
  input: {
    backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line, borderRadius: 12,
    color: C.text, fontSize: 13.5, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 9,
  },

  sw: {
    width: 44, height: 25, borderRadius: 999, backgroundColor: '#2A2A2E',
    borderWidth: 1, borderColor: C.line, justifyContent: 'center', paddingHorizontal: 3,
  },
  swOn: { backgroundColor: 'rgba(200,169,106,0.25)', borderColor: C.lineGold },
  swKnob: { width: 17, height: 17, borderRadius: 9, backgroundColor: '#8E8B86' },
  swKnobOn: { alignSelf: 'flex-end', backgroundColor: C.gold },

  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotCell: {
    width: SLOT_W, borderRadius: 13, paddingVertical: 10, alignItems: 'center',
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
  },
  slotOpen: { borderColor: C.gold, backgroundColor: 'rgba(200,169,106,0.07)' },
  slotPause: { borderColor: 'rgba(217,160,91,0.45)', backgroundColor: 'rgba(217,160,91,0.07)' },
  slotBooked: { backgroundColor: C.gold, borderColor: C.gold },
  slotCellTime: { fontFamily: SERIF, fontSize: 15, fontWeight: '600', color: C.text },
  slotCellState: { fontSize: 9, letterSpacing: 1, color: '#5A5852', marginTop: 3, textTransform: 'uppercase' },
  slotCellWho: { fontSize: 9, color: C.ink, marginTop: 3, fontWeight: '600', maxWidth: SLOT_W - 12 },

  btn: {
    flexDirection: 'row', backgroundColor: C.gold, borderRadius: 16, padding: 15,
    alignItems: 'center', justifyContent: 'center', marginTop: 14,
  },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.lineGold },
  btnText: { color: C.ink, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  back: { color: C.muted, fontSize: 12, letterSpacing: 2 },

  photo: {
    width: 104, height: 126, borderRadius: 14, marginRight: 9,
    borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  photoLabel: { position: 'absolute', bottom: 7, color: '#D8D5CE', fontSize: 9, letterSpacing: 1.5 },
  photoTitleInput: {
    width: 104, marginTop: 6, paddingVertical: 5, paddingHorizontal: 8,
    backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line, borderRadius: 8,
    color: C.text, fontSize: 10.5, textAlign: 'center',
  },

  stats: {
    flexDirection: 'row', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
    borderRadius: 20, paddingVertical: 16,
  },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  statV: { fontFamily: SERIF, color: C.gold2, fontWeight: '700', fontSize: SMALL ? 15 : 17 },
  statL: { color: C.muted, fontSize: 8, letterSpacing: 1.4, marginTop: 5 },

  review: { paddingVertical: 12 },
  reviewTxt: { fontFamily: SERIF, fontStyle: 'italic', color: '#A5A29B', fontSize: 14, lineHeight: 21, marginTop: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  pcard: {
    width: PCARD_W, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
    borderRadius: 18, padding: 11,
  },
  pimg: {
    height: 100, borderRadius: 12, marginBottom: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.line,
  },
  pname: { color: C.text, fontSize: 12.5, fontWeight: '500', marginBottom: 3, minHeight: 32 },
  pprice: { fontFamily: SERIF, fontSize: 16, fontWeight: '700', color: C.gold },
  pstock: { color: C.muted, fontSize: 10.5, marginTop: 2 },
  add: {
    marginTop: 10, borderWidth: 1, borderColor: C.lineGold, borderRadius: 10,
    paddingVertical: 8, alignItems: 'center',
  },
  addText: { color: C.gold, fontSize: 10, fontWeight: '600', letterSpacing: 1.5 },

  points: { fontFamily: SERIF, fontSize: 32, fontWeight: '700', color: C.gold2, marginTop: 4 },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 13 },

  opt: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
    borderRadius: 16, paddingVertical: 15, paddingHorizontal: 17, marginBottom: 9,
  },
  optOn: { borderColor: C.lineGold, backgroundColor: C.surface2 },
  optText: { color: C.text, fontSize: 14 },
  optActive: { color: C.gold, fontSize: 10, letterSpacing: 2, fontWeight: '600' },

  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  kpi: {
    width: PCARD_W, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
    borderRadius: 18, padding: 15,
  },
  kpiV: { fontFamily: SERIF, color: C.gold2, fontSize: 21, fontWeight: '700' },
  kpiL: { color: C.muted, fontSize: 8.5, letterSpacing: 1.5, marginTop: 6 },

  barBg: { height: 3, backgroundColor: C.surface2, borderRadius: 2 },
  barFill: { height: 3, backgroundColor: C.gold, borderRadius: 2 },

  tabbar: {
    flexDirection: 'row', backgroundColor: '#0E0E10', borderTopWidth: 1, borderTopColor: C.line,
    paddingTop: 9,
  },
  tabBtn: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  tabLabel: { color: '#6E6B65', fontSize: 8, letterSpacing: 0 },

  toast: {
    position: 'absolute', bottom: 92, left: PAD, right: PAD,
    backgroundColor: '#17161A', borderWidth: 1, borderColor: C.lineGold,
    borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18,
  },
  toastText: { color: C.text, fontSize: 12.5, textAlign: 'center' },

  /* Calendrier mensuel */
  cal: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
    borderRadius: 20, padding: 16, marginBottom: 16,
  },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calMonth: { fontFamily: SERIF, fontSize: 15, fontWeight: '600', color: C.text, letterSpacing: 0.5 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.2857%', alignItems: 'center', paddingVertical: 3 },
  calNumWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  calNumOn: { backgroundColor: C.gold },
  calNum: { fontSize: 12.5, color: C.text },
  calWd: { fontSize: 10, color: C.muted, fontWeight: '500' },
  calDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent', marginTop: 2 },

  /* Champ prix libre */
  priceField: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.surface2, borderWidth: 1, borderColor: C.lineGold,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 7,
    minWidth: 90,
  },
  priceInput: { color: C.text, fontSize: 14, padding: 0, minWidth: 50, textAlign: 'right' },

  /* Authentification & abonnement */
  authError: { color: C.red, fontSize: 12, marginTop: 12, lineHeight: 17 },
  authLink: { color: C.gold, fontSize: 12.5, textDecorationLine: 'underline' },
  planCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
    borderRadius: 20, padding: 18, marginBottom: 12,
  },
  planCardOn: { borderColor: C.gold, backgroundColor: 'rgba(200,169,106,0.06)' },
  planBadge: {
    backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3.5,
  },
  planBadgeText: { color: C.ink, fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
  planPrice: { fontFamily: SERIF, fontSize: 26, fontWeight: '700', color: C.gold, marginTop: 6 },
  planFeature: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 4 },

  /* Gestion fiche barber */
  iconBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: C.surface2, borderWidth: 1, borderColor: C.lineGold,
    alignItems: 'center', justifyContent: 'center',
  },
  photoRemove: {
    position: 'absolute', top: -6, right: 3,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.red, alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  photoAdd: {
    width: 104, height: 126, borderRadius: 14,
    borderWidth: 1, borderColor: C.lineGold,
    alignItems: 'center', justifyContent: 'center',
  },

  /* Cover picker */
  coverPreview: {
    height: 120, borderRadius: 18, borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14, overflow: 'hidden',
  },
  coverPreviewIni: { fontFamily: SERIF, fontSize: 52, fontWeight: '600', color: 'rgba(230,207,160,0.4)' },
  coverPreviewBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: 'rgba(10,10,11,0.75)', borderWidth: 1, borderColor: C.lineGold,
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
  },
  swatch: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  swatchOn: { borderColor: C.gold },

  /* Modal réservation manuelle (Créneaux) */
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.72)', zIndex: 100,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36, maxHeight: '80%',
  },
  clientRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 12, borderWidth: 1, borderColor: C.line,
    marginBottom: 6,
  },
  clientRowOn: { borderColor: C.gold, backgroundColor: 'rgba(200,169,106,0.07)' },

  /* Avis 5 étoiles (fin de coupe) */
  rateBox: {
    marginTop: 13, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: C.line,
  },
  rateStarBig: { fontSize: 28, color: C.muted, opacity: 0.45 },

  /* Visionneuse photo plein écran */
  viewerBox: {
    width: '100%', aspectRatio: 3 / 4, maxHeight: '68%',
    borderRadius: 22, overflow: 'hidden',
    borderWidth: 1, borderColor: C.lineGold,
  },
  viewerLabel: {
    fontFamily: SERIF, color: C.text, fontSize: 16, textAlign: 'center',
    marginTop: 16, letterSpacing: 0.5,
  },
  viewerDl: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    alignSelf: 'center', marginTop: 14,
    backgroundColor: C.gold, borderRadius: 999,
    paddingHorizontal: 20, paddingVertical: 11,
  },
  viewerDlText: { color: C.ink, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  viewerClose: {
    position: 'absolute', top: 56, right: 24,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(20,20,22,0.85)', borderWidth: 1, borderColor: C.lineGold,
    alignItems: 'center', justifyContent: 'center',
  },
});
