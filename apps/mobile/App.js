// BarberPro — application mobile (démo autonome, sans serveur)
// Design premium : noir profond, or champagne, serif élégante.
// La version connectée à l'API NestJS viendra remplacer les données embarquées.
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

/* ───────── Thème ───────── */
const C = {
  bg: '#0A0A0B',
  surface: '#131316',
  surface2: '#1B1B20',
  line: 'rgba(255,255,255,0.08)',
  lineGold: 'rgba(200,169,106,0.30)',
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

/* ───────── Données de démonstration ───────── */
const TEX = ['#211D15', '#181B20', '#1F1715', '#161B17'];

const DELAY = {
  ON_TIME: { dot: C.green, label: 'À l’heure' },
  DELAY_10: { dot: C.orange, label: '10 min de retard' },
};

const BARBERS = [
  {
    id: 'enzo', name: 'Enzo Moreau', ini: 'EM', tex: 0, years: 8, rating: '4,9',
    clients: '1 240', prestations: '3 680', ponct: 97, delay: 'ON_TIME',
    tags: ['Dégradé américain', 'Coupe afro', 'Barbe', 'Hair Design'],
    bio: 'Spécialiste du dégradé américain depuis huit ans. Précision du trait, finitions au rasoir, sens du détail.',
    reviews: [
      { who: 'Karim', note: 5, txt: 'Le meilleur dégradé de la ville. Je ne vais plus nulle part ailleurs.' },
      { who: 'Lucas', note: 5, txt: 'Toujours à l’heure, toujours impeccable.' },
      { who: 'Mehdi', note: 4, txt: 'Très beau travail sur la barbe, salon élégant.' },
    ],
  },
  {
    id: 'sofiane', name: 'Sofiane Kaci', ini: 'SK', tex: 1, years: 6, rating: '4,7',
    clients: '860', prestations: '2 210', ponct: 91, delay: 'DELAY_10',
    tags: ['Rasage traditionnel', 'Barbe', 'Coloration'],
    bio: 'Maître du rasage à l’ancienne : serviette chaude, coupe-chou et soins. Un rituel plus qu’une prestation.',
    reviews: [
      { who: 'Antoine', note: 5, txt: 'Le rasage serviette chaude est une expérience à part.' },
      { who: 'Yanis', note: 4, txt: 'Excellent, juste un peu d’attente parfois.' },
    ],
  },
  {
    id: 'marco', name: 'Marco Vitale', ini: 'MV', tex: 2, years: 5, rating: '4,8',
    clients: '540', prestations: '1 490', ponct: 95, delay: 'ON_TIME',
    tags: ['Hair Design', 'Dégradé américain', 'Coupe enfant'],
    bio: 'Hair design et motifs sur mesure. Chaque coupe est traitée comme une pièce unique.',
    reviews: [{ who: 'Sacha', note: 5, txt: 'Le motif était exactement celui que j’imaginais.' }],
  },
];

const SERVICES = [
  { id: 's1', name: 'Coupe Homme', price: 2500 },
  { id: 's2', name: 'Coupe + Barbe', price: 3500 },
  { id: 's3', name: 'Barbe seule', price: 1500 },
  { id: 's4', name: 'Coupe enfant', price: 1800 },
  { id: 's5', name: 'Hair Design', price: 4500 },
  { id: 's6', name: 'Premium Package', price: 7000 },
];

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
    date: '12 avril 2026', barber: 'Enzo Moreau', servs: 'Coupe + Barbe', price: 3500,
    photos: [['Face', 0], ['Profil gauche', 1], ['Profil droit', 2], ['Arrière', 3]],
  },
  {
    date: '2 mars 2026', barber: 'Marco Vitale', servs: 'Hair Design', price: 4500,
    photos: [['Face', 2], ['Arrière', 1]],
  },
];

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
const fmt = (c) =>
  (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €';

function genSlots(service, barberId) {
  const now = new Date();
  const out = [];
  for (let h = 9; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 22 && m === 30) continue;
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (d < now) continue;
      const list = barberId === 'any' ? BARBERS : BARBERS.filter((b) => b.id === barberId);
      const idx = h * 2 + m / 30;
      const b = list[idx % list.length];
      if ((idx + b.id.length) % 3 === 0) continue;
      const q = computePrice(service.price, d, now);
      out.push({
        time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        barber: b, price: q.price, rules: q.rules,
      });
    }
  }
  return out.slice(0, 12);
}

/* ───────── Petits composants ───────── */
const Kicker = ({ children }) => <Text style={s.kicker}>{children}</Text>;
const Title = ({ children, em }) => (
  <Text style={s.title}>
    {children}
    {em ? <Text style={s.titleEm}>{em}</Text> : null}
  </Text>
);
const Lead = ({ children }) => <Text style={s.lead}>{children}</Text>;

const Section = ({ children }) => (
  <View style={s.secRow}>
    <Text style={s.secText}>{children}</Text>
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

const Chip = ({ label, price, on, onPress, mini }) => (
  <TouchableOpacity
    style={[s.chip, mini && s.chipMini, on && s.chipOn]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Text style={[s.chipText, on && s.chipTextOn]}>
      {label}
      {price ? <Text style={[s.chipPrice, on && s.chipTextOn]}>  {price}</Text> : null}
    </Text>
  </TouchableOpacity>
);

const Photo = ({ label, tex }) => (
  <View style={[s.photo, { backgroundColor: TEX[tex] }]}>
    <Feather name="scissors" size={26} color="rgba(200,169,106,0.45)" />
    {label ? <Text style={s.photoLabel}>{label}</Text> : null}
  </View>
);

const Stars = ({ n }) => (
  <Text style={s.rate}>
    {'★'.repeat(n)}
    <Text style={{ opacity: 0.25 }}>{'★'.repeat(5 - n)}</Text>
  </Text>
);

/* ───────── Écrans ───────── */
function HomeScreen({ openBarber }) {
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenPad}>
      <Kicker>LE SALON</Kicker>
      <Title em="coupe">L’art de la </Title>
      <Lead>Réservez votre artiste, suivez son statut en temps réel.</Lead>
      <View style={s.hero}>
        <Text style={s.heroQuote}>« Une coupe n’est pas un service, c’est une signature. »</Text>
        <Text style={s.heroSub}>Ouvert aujourd’hui · 9h — 23h</Text>
      </View>
      <Section>Nos artistes</Section>
      {BARBERS.map((b) => (
        <TouchableOpacity key={b.id} style={[s.card, s.row]} onPress={() => openBarber(b)} activeOpacity={0.85}>
          <Ava b={b} />
          <View style={s.grow}>
            <Text style={s.bname}>{b.name}</Text>
            <Text style={s.btags} numberOfLines={1}>{b.tags.slice(0, 3).join(' · ')}</Text>
            <View style={[s.row, { gap: 12, marginTop: 7 }]}>
              <Badge status={b.delay} />
              <Text style={s.rate}>★ {b.rating}</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={18} color="#56534E" />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function BarberScreen({ barber, onBack, onBook }) {
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenPad}>
      <TouchableOpacity onPress={onBack} style={{ marginBottom: 18 }}>
        <Text style={s.back}>‹  LE SALON</Text>
      </TouchableOpacity>
      <View style={[s.row, { gap: 18, marginBottom: 16 }]}>
        <Ava b={barber} lg />
        <View style={s.grow}>
          <Text style={[s.title, { fontSize: 26, marginBottom: 3 }]}>{barber.name}</Text>
          <Text style={[s.btags, { marginBottom: 9 }]}>{barber.years} ans d’expérience</Text>
          <Badge status={barber.delay} />
        </View>
      </View>
      <Text style={s.bio}>{barber.bio}</Text>
      <View style={[s.wrap, { marginBottom: 18 }]}>
        {barber.tags.map((t) => (
          <View key={t} style={[s.chip, s.chipMini]}>
            <Text style={s.chipText}>{t}</Text>
          </View>
        ))}
      </View>
      <View style={s.stats}>
        {[
          [barber.clients, 'CLIENTS'],
          [barber.prestations, 'PRESTATIONS'],
          ['★ ' + barber.rating, 'NOTE'],
          [barber.ponct + ' %', 'PONCTUALITÉ'],
        ].map(([v, l], i) => (
          <View key={l} style={[s.stat, i > 0 && { borderLeftWidth: 1, borderLeftColor: C.line }]}>
            <Text style={s.statV}>{v}</Text>
            <Text style={s.statL}>{l}</Text>
          </View>
        ))}
      </View>
      <Section>Galerie</Section>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {[0, 1, 2, 3].map((i) => <Photo key={i} tex={i} />)}
      </ScrollView>
      <Section>Avis</Section>
      <View style={s.card}>
        {barber.reviews.map((r, i) => (
          <View key={r.who} style={[s.review, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
            <View style={s.row}>
              <Text style={[s.bname, s.grow, { fontSize: 13 }]}>{r.who}</Text>
              <Stars n={r.note} />
            </View>
            <Text style={s.reviewTxt}>« {r.txt} »</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity style={s.btn} onPress={() => onBook(barber.id)} activeOpacity={0.85}>
        <Text style={s.btnText}>RÉSERVER AVEC {barber.name.split(' ')[0].toUpperCase()}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function BookScreen({ booking, setBooking, onConfirm }) {
  if (booking.done) {
    const d = booking.done;
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.screenPad}>
        <Kicker>CONFIRMATION</Kicker>
        <Title em="réservé">C’est </Title>
        <Lead>Nous vous attendons. Un rappel sera envoyé la veille et une heure avant.</Lead>
        <View style={s.card}>
          <Text style={[s.bname, { fontSize: 17 }]}>{d.serv}</Text>
          <Text style={[s.btags, { marginVertical: 6 }]}>Aujourd’hui à {d.time} · avec {d.barber}</Text>
          {d.rules.length > 0 && <Text style={s.ruleText}>{d.rules.join('  +  ')}</Text>}
          <Text style={[s.price, { fontSize: 24, marginTop: 8 }]}>{fmt(d.price)}</Text>
        </View>
        {[
          ['bell', 'Rappels automatiques : la veille puis 1 h avant le rendez-vous.'],
          ['gift', `+${Math.floor(d.price / 100)} points fidélité crédités — 1 € dépensé = 1 point.`],
        ].map(([ic, txt]) => (
          <View key={ic} style={[s.card, s.row]}>
            <Feather name={ic} size={19} color={C.gold} />
            <Text style={[s.softText, s.grow]}>{txt}</Text>
          </View>
        ))}
        <TouchableOpacity
          style={[s.btn, s.btnGhost]}
          onPress={() => setBooking({ service: null, barber: 'any', done: null })}
        >
          <Text style={[s.btnText, { color: C.gold }]}>NOUVELLE RÉSERVATION</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const service = SERVICES.find((x) => x.id === booking.service);
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenPad}>
      <Kicker>RENDEZ-VOUS</Kicker>
      <Title>Réserver</Title>
      <Lead>La prestation, l’artiste, puis le créneau — au prix juste, affiché en direct.</Lead>
      <Section>La prestation</Section>
      <View style={s.wrap}>
        {SERVICES.map((sv) => (
          <Chip
            key={sv.id} label={sv.name} price={fmt(sv.price)} on={booking.service === sv.id}
            onPress={() => setBooking({ ...booking, service: sv.id })}
          />
        ))}
      </View>
      {service && (
        <>
          <Section>Avec qui</Section>
          <View style={s.wrap}>
            <Chip label="Premier disponible" on={booking.barber === 'any'}
              onPress={() => setBooking({ ...booking, barber: 'any' })} />
            {BARBERS.map((b) => (
              <Chip key={b.id} label={b.name.split(' ')[0]} on={booking.barber === b.id}
                onPress={() => setBooking({ ...booking, barber: b.id })} />
            ))}
          </View>
          <Section>Le créneau — aujourd’hui</Section>
          {genSlots(service, booking.barber).map((sl, i) => (
            <TouchableOpacity key={i} style={[s.card, s.row]} onPress={() => onConfirm(service, sl)} activeOpacity={0.8}>
              <Text style={s.slotTime}>{sl.time}</Text>
              <View style={s.grow}>
                <Text style={s.softText}>{sl.barber.name}</Text>
                {sl.rules.length > 0 && <Text style={s.ruleText}>{sl.rules.join('  +  ')}</Text>}
              </View>
              <Text style={s.price}>{fmt(sl.price)}</Text>
            </TouchableOpacity>
          ))}
          <Text style={s.footnote}>
            Les prix évoluent selon l’heure — soirée après 20 h, nuit après 22 h, week-end, urgence.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

function CutsScreen({ toast }) {
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenPad}>
      <Kicker>GALERIE PERSONNELLE</Kicker>
      <Title em="coupes">Mes </Title>
      <Lead>Après chaque prestation, votre barber photographie le résultat. Tout reste ici.</Lead>
      {HISTORY.map((h) => (
        <View key={h.date} style={s.card}>
          <Text style={[s.bname, { fontSize: 15 }]}>{h.servs}</Text>
          <Text style={[s.btags, { marginTop: 3, marginBottom: 12 }]}>
            {h.date} · {h.barber} · <Text style={{ color: C.gold }}>{fmt(h.price)}</Text>
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {h.photos.map(([label, tex]) => <Photo key={label} label={label} tex={tex} />)}
          </ScrollView>
          <View style={[s.wrap, { marginTop: 13 }]}>
            <Chip mini label="Télécharger" onPress={() => toast('Photos téléchargées.')} />
            <Chip mini label="Partager" onPress={() => toast('Lien de partage copié.')} />
            <Chip mini label="Montrer" onPress={() => toast('À montrer à votre prochain barber.')} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function ShopScreen({ cat, setCat, cart, addCart, toast }) {
  const list = PRODUCTS.filter((p) => cat === 'ALL' || p.cat === cat);
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
            <Text style={s.pname}>{p.name}</Text>
            <Text style={s.pprice}>{fmt(p.price)}</Text>
            <Text style={s.pstock}>{p.stock > 0 ? `${p.stock} en stock` : 'Épuisé'}</Text>
            <TouchableOpacity style={s.add} onPress={() => addCart(p)} activeOpacity={0.8}>
              <Text style={s.addText}>AJOUTER</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
      {cart > 0 && (
        <TouchableOpacity style={s.btn} onPress={() => toast('Paiement Stripe — CB, Apple Pay, Google Pay.')}>
          <Text style={s.btnText}>COMMANDER · {cart} ARTICLE{cart > 1 ? 'S' : ''}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function MeScreen({ points, upcoming }) {
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenPad}>
      <Kicker>ESPACE PERSONNEL</Kicker>
      <Title>Mathéo</Title>
      <Lead>Membre depuis mars 2026</Lead>
      <View style={[s.card, { borderColor: C.lineGold }]}>
        <View style={s.row}>
          <View style={s.grow}>
            <Text style={s.statL}>FIDÉLITÉ</Text>
            <Text style={s.points}>
              {points} <Text style={{ fontSize: 16 }}>points</Text>
            </Text>
          </View>
          <Feather name="gift" size={22} color={C.gold} />
        </View>
        <View style={s.divider} />
        <Text style={s.footnoteLeft}>
          1 € dépensé = 1 point. Vos points s’échangent contre une réduction, un produit ou une coupe offerte.
        </Text>
      </View>
      <Section>À venir</Section>
      {upcoming.length === 0 ? (
        <Text style={s.footnote}>
          Aucun rendez-vous à venir.{'\n'}Réservez votre prochaine coupe dans l’onglet Réserver.
        </Text>
      ) : (
        upcoming.map((u, i) => (
          <View key={i} style={[s.card, s.row]}>
            <Feather name="calendar" size={18} color={C.gold} />
            <View style={s.grow}>
              <Text style={[s.bname, { fontSize: 13.5 }]}>{u.serv} · {u.time}</Text>
              <Text style={[s.btags, { marginTop: 2 }]}>avec {u.barber}</Text>
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
    </ScrollView>
  );
}

/* ───────── Racine ───────── */
const TABS = [
  ['home', 'home', 'Salon'],
  ['book', 'calendar', 'Réserver'],
  ['cuts', 'image', 'Mes coupes'],
  ['shop', 'shopping-bag', 'Boutique'],
  ['me', 'user', 'Profil'],
];

export default function App() {
  const [tab, setTab] = useState('home');
  const [barber, setBarber] = useState(null);
  const [booking, setBooking] = useState({ service: null, barber: 'any', done: null });
  const [cat, setCat] = useState('ALL');
  const [cart, setCart] = useState(0);
  const [points, setPoints] = useState(86);
  const [upcoming, setUpcoming] = useState([]);
  const [toastMsg, setToastMsg] = useState(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  const toast = (msg) => {
    setToastMsg(msg);
    Animated.timing(toastAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    clearTimeout(toast._h);
    toast._h = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }, 3200);
  };

  const confirmBooking = (service, slot) => {
    setBooking({ ...booking, done: { serv: service.name, time: slot.time, barber: slot.barber.name, price: slot.price, rules: slot.rules } });
    setPoints((p) => p + Math.floor(slot.price / 100));
    setUpcoming((u) => [...u, { serv: service.name, time: slot.time, barber: slot.barber.name, price: slot.price }]);
    toast(`Réservation confirmée — ${slot.time} avec ${slot.barber.name.split(' ')[0]} · ${fmt(slot.price)}`);
  };

  const addCart = (p) => {
    setCart((n) => {
      toast(`${p.name} — ajouté au panier (${n + 1})`);
      return n + 1;
    });
  };

  let content;
  if (barber) {
    content = (
      <BarberScreen
        barber={barber}
        onBack={() => setBarber(null)}
        onBook={(id) => { setBooking({ service: null, barber: id, done: null }); setBarber(null); setTab('book'); }}
      />
    );
  } else if (tab === 'home') content = <HomeScreen openBarber={setBarber} />;
  else if (tab === 'book') content = <BookScreen booking={booking} setBooking={setBooking} onConfirm={confirmBooking} />;
  else if (tab === 'cuts') content = <CutsScreen toast={toast} />;
  else if (tab === 'shop') content = <ShopScreen cat={cat} setCat={setCat} cart={cart} addCart={addCart} toast={toast} />;
  else content = <MeScreen points={points} upcoming={upcoming} />;

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={s.header}>
        <Text style={s.wordmark}>
          Barber<Text style={{ color: C.gold, fontStyle: 'italic' }}>Pro</Text>
        </Text>
      </View>
      {content}
      <View style={s.tabbar}>
        {TABS.map(([k, ic, l]) => (
          <TouchableOpacity key={k} style={s.tabBtn} onPress={() => { setTab(k); setBarber(null); }} activeOpacity={0.7}>
            <Feather name={ic} size={20} color={tab === k && !barber ? C.gold2 : '#6E6B65'} />
            <Text style={[s.tabLabel, tab === k && !barber && { color: C.gold2 }]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {toastMsg && (
        <Animated.View style={[s.toast, { opacity: toastAnim }]} pointerEvents="none">
          <Text style={s.toastText}>{toastMsg}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

/* ───────── Styles ───────── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { alignItems: 'center', paddingTop: Platform.OS === 'android' ? 14 : 6, paddingBottom: 4 },
  wordmark: { fontFamily: SERIF, fontSize: 24, fontWeight: '600', color: C.text, letterSpacing: 1 },

  screen: { flex: 1 },
  screenPad: { padding: 20, paddingBottom: 36 },

  kicker: { color: C.gold, fontSize: 10, letterSpacing: 4, marginBottom: 8, fontWeight: '500' },
  title: { fontFamily: SERIF, fontSize: 32, fontWeight: '600', color: C.text, marginBottom: 6, lineHeight: 36 },
  titleEm: { fontStyle: 'italic', color: C.gold2, fontWeight: '500' },
  lead: { color: C.muted, fontSize: 13, lineHeight: 20, marginBottom: 20 },

  secRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 12 },
  secText: { fontFamily: SERIF, fontSize: 19, fontWeight: '600', color: C.text },
  secLine: { flex: 1, height: 1, backgroundColor: C.line },

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
  badgeText: { color: '#CFCCC4', fontSize: 11 },
  rate: { color: C.gold, fontSize: 12, letterSpacing: 0.5 },

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

  btn: {
    backgroundColor: C.gold, borderRadius: 16, padding: 15, alignItems: 'center', marginTop: 14,
  },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.lineGold },
  btnText: { color: C.ink, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  back: { color: C.muted, fontSize: 12, letterSpacing: 2 },

  photo: {
    width: 104, height: 126, borderRadius: 14, marginRight: 9,
    borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center',
  },
  photoLabel: {
    position: 'absolute', bottom: 7, color: '#D8D5CE', fontSize: 9, letterSpacing: 1.5,
  },

  stats: {
    flexDirection: 'row', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
    borderRadius: 20, paddingVertical: 16,
  },
  stat: { flex: 1, alignItems: 'center' },
  statV: { fontFamily: SERIF, color: C.gold2, fontWeight: '700', fontSize: 17 },
  statL: { color: C.muted, fontSize: 8.5, letterSpacing: 1.6, marginTop: 5 },

  review: { paddingVertical: 12 },
  reviewTxt: { fontFamily: SERIF, fontStyle: 'italic', color: '#A5A29B', fontSize: 14, lineHeight: 21, marginTop: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  pcard: {
    width: '47.5%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
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

  tabbar: {
    flexDirection: 'row', backgroundColor: '#0E0E10', borderTopWidth: 1, borderTopColor: C.line,
    paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 4 : 10,
  },
  tabBtn: { flex: 1, alignItems: 'center', gap: 4 },
  tabLabel: { color: '#6E6B65', fontSize: 9, letterSpacing: 0.5 },

  toast: {
    position: 'absolute', bottom: 86, left: 20, right: 20,
    backgroundColor: '#17161A', borderWidth: 1, borderColor: C.lineGold,
    borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18,
  },
  toastText: { color: C.text, fontSize: 12.5, textAlign: 'center' },
});
