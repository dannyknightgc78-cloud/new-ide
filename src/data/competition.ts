export type Club = {
  id: string
  name: string
  short: string
  city: string
  country: string
  color: string
}

export type Match = {
  id: string
  round: string
  kickoff: string
  venue: string
  status: 'live' | 'upcoming' | 'ft'
  homeId: string
  awayId: string
  homeScore?: number
  awayScore?: number
  minute?: number
  events?: string[]
}

export type BracketTie = {
  id: string
  round: 'R16' | 'QF' | 'SF' | 'Final'
  homeId: string
  awayId: string
  homeAgg?: number
  awayAgg?: number
  winnerId?: string
}

export const clubs: Club[] = [
  { id: 'mad', name: 'Real Madrid', short: 'RMA', city: 'Madrid', country: 'ESP', color: '#FFFFFF' },
  { id: 'mun', name: 'Manchester City', short: 'MCI', city: 'Manchester', country: 'ENG', color: '#6CABDD' },
  { id: 'bay', name: 'Bayern München', short: 'BAY', city: 'Munich', country: 'GER', color: '#DC052D' },
  { id: 'psg', name: 'Paris Saint-Germain', short: 'PSG', city: 'Paris', country: 'FRA', color: '#004170' },
  { id: 'liv', name: 'Liverpool', short: 'LIV', city: 'Liverpool', country: 'ENG', color: '#C8102E' },
  { id: 'int', name: 'Inter Milano', short: 'INT', city: 'Milan', country: 'ITA', color: '#010E80' },
  { id: 'ars', name: 'Arsenal', short: 'ARS', city: 'London', country: 'ENG', color: '#EF0107' },
  { id: 'bar', name: 'FC Barcelona', short: 'BAR', city: 'Barcelona', country: 'ESP', color: '#A50044' },
  { id: 'atm', name: 'Atlético Madrid', short: 'ATM', city: 'Madrid', country: 'ESP', color: '#CB3524' },
  { id: 'dor', name: 'Borussia Dortmund', short: 'BVB', city: 'Dortmund', country: 'GER', color: '#FDE100' },
  { id: 'nap', name: 'Napoli', short: 'NAP', city: 'Naples', country: 'ITA', color: '#12A0D7' },
  { id: 'por', name: 'FC Porto', short: 'POR', city: 'Porto', country: 'POR', color: '#003893' },
  { id: 'aja', name: 'Ajax', short: 'AJA', city: 'Amsterdam', country: 'NED', color: '#D2122E' },
  { id: 'ben', name: 'Benfica', short: 'BEN', city: 'Lisbon', country: 'POR', color: '#E03C31' },
  { id: 'che', name: 'Chelsea', short: 'CHE', city: 'London', country: 'ENG', color: '#034694' },
  { id: 'juv', name: 'Juventus', short: 'JUV', city: 'Turin', country: 'ITA', color: '#000000' },
]

export const clubById = Object.fromEntries(clubs.map((c) => [c.id, c])) as Record<string, Club>

export const tonight: Match[] = [
  {
    id: 'm1',
    round: 'Quarter-final · Leg 1',
    kickoff: '20:00 CET',
    venue: 'Estádio da Luz, Lisbon',
    status: 'live',
    homeId: 'ben',
    awayId: 'bay',
    homeScore: 1,
    awayScore: 2,
    minute: 67,
    events: ['14′ Kane', '38′ Di María', '61′ Musiala'],
  },
  {
    id: 'm2',
    round: 'Quarter-final · Leg 1',
    kickoff: '20:00 CET',
    venue: 'Parc des Princes, Paris',
    status: 'live',
    homeId: 'psg',
    awayId: 'ars',
    homeScore: 0,
    awayScore: 0,
    minute: 54,
    events: ['Chance after chance — still locked'],
  },
  {
    id: 'm3',
    round: 'Quarter-final · Leg 1',
    kickoff: '21:00 CET',
    venue: 'Santiago Bernabéu, Madrid',
    status: 'upcoming',
    homeId: 'mad',
    awayId: 'mun',
    events: [],
  },
  {
    id: 'm4',
    round: 'Quarter-final · Leg 1',
    kickoff: '21:00 CET',
    venue: 'San Siro, Milan',
    status: 'upcoming',
    homeId: 'int',
    awayId: 'dor',
  },
]

export const fixtures: Match[] = [
  ...tonight,
  {
    id: 'm5',
    round: 'Quarter-final · Leg 2',
    kickoff: 'Tue 15 Apr · 21:00',
    venue: 'Allianz Arena, Munich',
    status: 'upcoming',
    homeId: 'bay',
    awayId: 'ben',
  },
  {
    id: 'm6',
    round: 'Quarter-final · Leg 2',
    kickoff: 'Tue 15 Apr · 21:00',
    venue: 'Emirates Stadium, London',
    status: 'upcoming',
    homeId: 'ars',
    awayId: 'psg',
  },
  {
    id: 'm7',
    round: 'Quarter-final · Leg 2',
    kickoff: 'Wed 16 Apr · 21:00',
    venue: 'Etihad Stadium, Manchester',
    status: 'upcoming',
    homeId: 'mun',
    awayId: 'mad',
  },
  {
    id: 'm8',
    round: 'Quarter-final · Leg 2',
    kickoff: 'Wed 16 Apr · 21:00',
    venue: 'Signal Iduna Park, Dortmund',
    status: 'upcoming',
    homeId: 'dor',
    awayId: 'int',
  },
]

export const bracket: BracketTie[] = [
  { id: 'r16a', round: 'R16', homeId: 'mad', awayId: 'liv', homeAgg: 3, awayAgg: 1, winnerId: 'mad' },
  { id: 'r16b', round: 'R16', homeId: 'mun', awayId: 'cop' as string, homeAgg: 2, awayAgg: 0, winnerId: 'mun' },
  { id: 'r16c', round: 'R16', homeId: 'bay', awayId: 'laz' as string, homeAgg: 4, awayAgg: 1, winnerId: 'bay' },
  { id: 'r16d', round: 'R16', homeId: 'psg', awayId: 'soc' as string, homeAgg: 3, awayAgg: 0, winnerId: 'psg' },
  { id: 'r16e', round: 'R16', homeId: 'ars', awayId: 'por', homeAgg: 2, awayAgg: 1, winnerId: 'ars' },
  { id: 'r16f', round: 'R16', homeId: 'ben', awayId: 'aja', homeAgg: 3, awayAgg: 2, winnerId: 'ben' },
  { id: 'r16g', round: 'R16', homeId: 'int', awayId: 'atm', homeAgg: 2, awayAgg: 2, winnerId: 'int' },
  { id: 'r16h', round: 'R16', homeId: 'dor', awayId: 'nap', homeAgg: 3, awayAgg: 1, winnerId: 'dor' },
  { id: 'qf1', round: 'QF', homeId: 'ben', awayId: 'bay' },
  { id: 'qf2', round: 'QF', homeId: 'psg', awayId: 'ars' },
  { id: 'qf3', round: 'QF', homeId: 'mad', awayId: 'mun' },
  { id: 'qf4', round: 'QF', homeId: 'int', awayId: 'dor' },
  { id: 'sf1', round: 'SF', homeId: 'tba', awayId: 'tba' },
  { id: 'sf2', round: 'SF', homeId: 'tba', awayId: 'tba' },
  { id: 'final', round: 'Final', homeId: 'tba', awayId: 'tba' },
]

// Fix placeholder club IDs used above for eliminated sides
export const extraClubs: Club[] = [
  { id: 'cop', name: 'FC Copenhagen', short: 'COP', city: 'Copenhagen', country: 'DEN', color: '#FFFFFF' },
  { id: 'laz', name: 'Lazio', short: 'LAZ', city: 'Rome', country: 'ITA', color: '#87D8F7' },
  { id: 'soc', name: 'Real Sociedad', short: 'RSO', city: 'San Sebastián', country: 'ESP', color: '#0067B1' },
  { id: 'tba', name: 'TBD', short: 'TBD', city: '—', country: '—', color: '#9AA59A' },
]

export function resolveClub(id: string): Club {
  return clubById[id] ?? extraClubs.find((c) => c.id === id) ?? {
    id,
    name: id.toUpperCase(),
    short: id.slice(0, 3).toUpperCase(),
    city: '—',
    country: '—',
    color: '#9AA59A',
  }
}

export const standings = [
  { clubId: 'mad', played: 8, won: 6, drawn: 1, lost: 1, gd: 12, pts: 19 },
  { clubId: 'bay', played: 8, won: 6, drawn: 0, lost: 2, gd: 14, pts: 18 },
  { clubId: 'ars', played: 8, won: 5, drawn: 2, lost: 1, gd: 9, pts: 17 },
  { clubId: 'mun', played: 8, won: 5, drawn: 2, lost: 1, gd: 8, pts: 17 },
  { clubId: 'psg', played: 8, won: 5, drawn: 1, lost: 2, gd: 7, pts: 16 },
  { clubId: 'int', played: 8, won: 5, drawn: 1, lost: 2, gd: 6, pts: 16 },
  { clubId: 'dor', played: 8, won: 4, drawn: 3, lost: 1, gd: 5, pts: 15 },
  { clubId: 'ben', played: 8, won: 4, drawn: 2, lost: 2, gd: 4, pts: 14 },
]
