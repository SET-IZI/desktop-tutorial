import { emptySchedule, scheduleFromRows, validateSchedule } from '@/lib/admin/schedule';

describe('horaires', () => {
  it('convertit les lignes Postgres et trie les plages', () => {
    const s = scheduleFromRows([
      { weekday: 2, opens_at: '18:30:00', closes_at: '22:30:00' },
      { weekday: 2, opens_at: '11:30:00', closes_at: '14:30:00' },
    ]);
    expect(s[2]).toEqual([
      { opensAt: '11:30', closesAt: '14:30' },
      { opensAt: '18:30', closesAt: '22:30' },
    ]);
    expect(s[1]).toEqual([]);
  });

  it('accepte un planning cohérent, y compris des plages contiguës', () => {
    const s = emptySchedule();
    s[1] = [
      { opensAt: '11:00', closesAt: '14:00' },
      { opensAt: '14:00', closesAt: '15:00' },
    ];
    expect(validateSchedule(s)).toEqual([]);
  });

  it('refuse une fin avant le début, un chevauchement, trop de plages, un format invalide', () => {
    const s = emptySchedule();
    s[1] = [{ opensAt: '14:00', closesAt: '11:00' }];
    s[2] = [
      { opensAt: '11:00', closesAt: '15:00' },
      { opensAt: '14:00', closesAt: '16:00' },
    ];
    s[3] = Array.from({ length: 5 }, (_, i) => ({ opensAt: `0${i}:00`, closesAt: `0${i}:30` }));
    s[4] = [{ opensAt: '25:00', closesAt: '26:00' }];
    expect(validateSchedule(s)).toEqual([
      { weekday: 1, code: 'range_order' },
      { weekday: 2, code: 'overlap' },
      { weekday: 3, code: 'too_many' },
      { weekday: 4, code: 'format' },
    ]);
  });
});
