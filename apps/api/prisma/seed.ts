import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Prestations (PRD §3)
  await prisma.service.createMany({
    data: [
      { name: 'Coupe Homme', durationMinutes: 30, basePriceCents: 2500 },
      { name: 'Coupe + Barbe', durationMinutes: 45, basePriceCents: 3500 },
      { name: 'Barbe seule', durationMinutes: 20, basePriceCents: 1500 },
      { name: 'Coupe enfant', durationMinutes: 25, basePriceCents: 1800 },
      { name: 'Hair Design', durationMinutes: 60, basePriceCents: 4500 },
      { name: 'Premium Package', durationMinutes: 90, basePriceCents: 7000 },
    ],
    skipDuplicates: true,
  });

  // Tarification dynamique (PRD §4)
  await prisma.pricingRule.createMany({
    data: [
      { type: 'EVENING', label: 'Tarif soirée (après 20h)', startHour: 20, fixedPriceCents: 3500 },
      { type: 'NIGHT', label: 'Tarif nuit (après 22h)', startHour: 22, fixedPriceCents: 5000 },
      { type: 'WEEKEND', label: 'Majoration week-end', surchargePercent: 15 },
      { type: 'HOLIDAY', label: 'Majoration jour férié', surchargePercent: 25 },
      { type: 'URGENCY', label: 'Réservation urgente (<2h)', surchargePercent: 20, urgencyWindowMinutes: 120 },
    ],
    skipDuplicates: true,
  });

  // Barber de démonstration
  const barberUser = await prisma.user.upsert({
    where: { email: 'enzo@barberpro.app' },
    update: {},
    create: {
      email: 'enzo@barberpro.app',
      firstName: 'Enzo',
      lastName: 'Moreau',
      role: 'BARBER',
      barberProfile: {
        create: {
          bio: 'Spécialiste du dégradé américain depuis 8 ans.',
          yearsExperience: 8,
          skillTags: ['Dégradé américain', 'Coupe afro', 'Barbe', 'Hair Design'],
          workingHours: {
            create: [1, 2, 3, 4, 5, 6].map((weekday) => ({
              weekday,
              startTime: '09:00',
              endTime: '23:00',
            })),
          },
        },
      },
    },
  });
  console.log(`Seed OK — barber: ${barberUser.email}`);

  // Produits (PRD §9)
  await prisma.product.createMany({
    data: [
      { name: 'Cire coiffante mate', category: 'CIRE', priceCents: 1490, stock: 40, photoUrls: [] },
      { name: 'Pommade brillante', category: 'POMMADE', priceCents: 1690, stock: 25, photoUrls: [] },
      { name: 'Huile à barbe cèdre', category: 'HUILE_BARBE', priceCents: 1990, stock: 30, photoUrls: [] },
      { name: 'Shampoing fortifiant', category: 'SHAMPOING', priceCents: 1290, stock: 50, photoUrls: [] },
      { name: 'Peigne en bois', category: 'ACCESSOIRE', priceCents: 990, stock: 60, photoUrls: [] },
    ],
    skipDuplicates: true,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
