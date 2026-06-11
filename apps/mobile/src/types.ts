export type DelayStatus =
  | 'ON_TIME'
  | 'DELAY_5'
  | 'DELAY_10'
  | 'DELAY_15'
  | 'DELAY_15_PLUS'
  | 'ABSENT';

export interface Barber {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  bio?: string;
  yearsExperience: number;
  skillTags: string[];
  delayStatus: DelayStatus;
  averageRating?: number;
  punctualityRate?: number;
  totalClients?: number;
  totalAppointments?: number;
}

export interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  basePriceCents: number;
}

export interface Slot {
  barberId: string;
  barberName: string;
  startsAt: string;
  endsAt: string;
  priceCents: number;
  appliedRules: string[];
}

export interface AppointmentPhoto {
  id: string;
  url: string;
  label?: string;
}

export interface Appointment {
  id: string;
  startsAt: string;
  totalPriceCents: number;
  barberName: string;
  serviceNames: string[];
  photos: AppointmentPhoto[];
}

export interface Product {
  id: string;
  name: string;
  category: 'CIRE' | 'POMMADE' | 'HUILE_BARBE' | 'SHAMPOING' | 'ACCESSOIRE';
  priceCents: number;
  stock: number;
  photoUrls: string[];
  description?: string;
}
