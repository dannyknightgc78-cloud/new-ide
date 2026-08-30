export type IceCard = {
  name: string;
  phone: string;
  relation: string;
  conditions: string;
  allergies: string;
  meds: string;
  bloodType: string;
  notes: string;
};

export type EmergencyService = { kind: string; number: string };

export type EmergencyInfo = {
  ok: boolean;
  iso: string | null;
  country: string;
  primary: string;
  call?: string;
  services: EmergencyService[];
  gps: boolean;
  offline: boolean;
};

const BOXES: Array<[number, number, number, number, string, string]> = [
  [27.4, 29.5, -18.3, -13.3, 'ES', 'Spain (Canary Islands)'],
  [32.4, 33.2, -17.4, -16.2, 'PT', 'Portugal (Madeira)'],
  [36.7, 39.8, -31.4, -24.8, 'PT', 'Portugal (Azores)'],
  [35.8, 36.2, -5.4, -5.3, 'GI', 'Gibraltar'],
  [51.3, 55.5, -10.6, -5.9, 'IE', 'Ireland'],
  [49.8, 60.9, -8.7, 1.8, 'GB', 'United Kingdom'],
  [36.8, 42.3, -9.6, -6.1, 'PT', 'Portugal'],
  [27.6, 43.9, -18.3, 4.5, 'ES', 'Spain'],
  [41.3, 51.2, -5.2, 9.7, 'FR', 'France'],
  [47.2, 55.2, 5.8, 15.1, 'DE', 'Germany'],
  [36.6, 47.2, 6.5, 18.6, 'IT', 'Italy'],
  [50.7, 53.6, 3.3, 7.3, 'NL', 'Netherlands'],
  [49.4, 51.6, 2.5, 6.5, 'BE', 'Belgium'],
  [45.8, 47.9, 5.9, 10.6, 'CH', 'Switzerland'],
  [46.3, 49.1, 9.4, 17.3, 'AT', 'Austria'],
  [36.0, 41.8, 19.3, 29.8, 'GR', 'Greece'],
  [48.0, 54.9, 14.0, 24.2, 'PL', 'Poland'],
  [55.3, 69.1, 10.5, 24.3, 'SE', 'Sweden'],
  [57.9, 71.2, 4.5, 31.3, 'NO', 'Norway'],
  [54.5, 57.8, 8.0, 15.3, 'DK', 'Denmark'],
  [59.7, 70.2, 20.5, 31.6, 'FI', 'Finland'],
  [24.4, 49.4, -124.9, -66.9, 'US', 'United States'],
  [41.6, 83.2, -141.1, -52.6, 'CA', 'Canada'],
  [14.5, 32.8, -118.5, -86.7, 'MX', 'Mexico'],
  [-44.0, -10.0, 113.0, 154.0, 'AU', 'Australia'],
  [-47.4, -34.0, 166.0, 179.0, 'NZ', 'New Zealand'],
  [-34.0, 5.3, -74.1, -34.7, 'BR', 'Brazil'],
  [-55.1, -21.7, -73.6, -53.6, 'AR', 'Argentina'],
  [5.5, 32.8, 34.2, 35.9, 'IL', 'Israel'],
  [5.6, 20.5, 97.3, 105.7, 'TH', 'Thailand'],
  [24.0, 46.0, 123.0, 146.0, 'JP', 'Japan'],
  [33.0, 38.7, 124.5, 131.9, 'KR', 'South Korea'],
  [1.1, 1.5, 103.6, 104.1, 'SG', 'Singapore'],
  [22.1, 22.6, 113.8, 114.5, 'HK', 'Hong Kong'],
  [21.8, 25.4, 120.0, 122.1, 'TW', 'Taiwan'],
  [4.2, 21.3, 116.8, 126.7, 'PH', 'Philippines'],
  [22.6, 26.5, 51.5, 56.6, 'AE', 'United Arab Emirates'],
  [22.0, 31.8, 24.7, 36.9, 'EG', 'Egypt'],
  [27.6, 35.9, -13.3, -1.0, 'MA', 'Morocco'],
  [6.7, 37.1, 68.1, 97.4, 'IN', 'India'],
  [-35.0, -22.1, 16.3, 33.0, 'ZA', 'South Africa'],
  [35.8, 42.2, 26.0, 44.9, 'TR', 'Turkey'],
  [18.0, 18.6, -67.4, -65.2, 'US', 'Puerto Rico'],
];

const BY_ISO: Record<string, { primary: string; services: EmergencyService[] }> = {
  ES: { primary: '112', services: [{ kind: 'Emergency', number: '112' }, { kind: 'National Police', number: '091' }, { kind: 'Ambulance', number: '061' }, { kind: 'Fire', number: '080' }] },
  GB: { primary: '999', services: [{ kind: 'Emergency', number: '999' }, { kind: 'Emergency (EU)', number: '112' }, { kind: 'NHS non-emergency', number: '111' }] },
  IE: { primary: '112', services: [{ kind: 'Emergency', number: '112' }, { kind: 'Emergency', number: '999' }] },
  PT: { primary: '112', services: [{ kind: 'Emergency', number: '112' }] },
  FR: { primary: '112', services: [{ kind: 'Emergency', number: '112' }, { kind: 'Ambulance (SAMU)', number: '15' }, { kind: 'Police', number: '17' }, { kind: 'Fire', number: '18' }] },
  DE: { primary: '112', services: [{ kind: 'Emergency / Ambulance / Fire', number: '112' }, { kind: 'Police', number: '110' }] },
  IT: { primary: '112', services: [{ kind: 'Emergency', number: '112' }, { kind: 'Ambulance', number: '118' }, { kind: 'Fire', number: '115' }, { kind: 'Police', number: '113' }] },
  NL: { primary: '112', services: [{ kind: 'Emergency', number: '112' }] },
  BE: { primary: '112', services: [{ kind: 'Emergency', number: '112' }, { kind: 'Police', number: '101' }] },
  CH: { primary: '112', services: [{ kind: 'Emergency', number: '112' }, { kind: 'Police', number: '117' }, { kind: 'Fire', number: '118' }, { kind: 'Ambulance', number: '144' }] },
  AT: { primary: '112', services: [{ kind: 'Emergency', number: '112' }, { kind: 'Police', number: '133' }, { kind: 'Ambulance', number: '144' }, { kind: 'Fire', number: '122' }] },
  GR: { primary: '112', services: [{ kind: 'Emergency', number: '112' }, { kind: 'Police', number: '100' }, { kind: 'Ambulance', number: '166' }, { kind: 'Fire', number: '199' }] },
  PL: { primary: '112', services: [{ kind: 'Emergency', number: '112' }, { kind: 'Police', number: '997' }, { kind: 'Ambulance', number: '999' }, { kind: 'Fire', number: '998' }] },
  SE: { primary: '112', services: [{ kind: 'Emergency', number: '112' }] },
  NO: { primary: '112', services: [{ kind: 'Police', number: '112' }, { kind: 'Ambulance', number: '113' }, { kind: 'Fire', number: '110' }] },
  DK: { primary: '112', services: [{ kind: 'Emergency', number: '112' }] },
  FI: { primary: '112', services: [{ kind: 'Emergency', number: '112' }] },
  US: { primary: '911', services: [{ kind: 'Emergency', number: '911' }] },
  CA: { primary: '911', services: [{ kind: 'Emergency', number: '911' }] },
  MX: { primary: '911', services: [{ kind: 'Emergency', number: '911' }] },
  AU: { primary: '000', services: [{ kind: 'Emergency', number: '000' }, { kind: 'Emergency (mobile)', number: '112' }] },
  NZ: { primary: '111', services: [{ kind: 'Emergency', number: '111' }] },
  BR: { primary: '190', services: [{ kind: 'Police', number: '190' }, { kind: 'Ambulance', number: '192' }, { kind: 'Fire', number: '193' }] },
  AR: { primary: '911', services: [{ kind: 'Emergency', number: '911' }] },
  IL: { primary: '100', services: [{ kind: 'Police', number: '100' }, { kind: 'Ambulance', number: '101' }, { kind: 'Fire', number: '102' }] },
  TH: { primary: '191', services: [{ kind: 'Police', number: '191' }, { kind: 'Ambulance / Fire', number: '199' }, { kind: 'Tourist police', number: '1155' }] },
  JP: { primary: '110', services: [{ kind: 'Police', number: '110' }, { kind: 'Ambulance / Fire', number: '119' }] },
  KR: { primary: '112', services: [{ kind: 'Police', number: '112' }, { kind: 'Ambulance / Fire', number: '119' }] },
  SG: { primary: '999', services: [{ kind: 'Police', number: '999' }, { kind: 'Ambulance / Fire', number: '995' }] },
  HK: { primary: '999', services: [{ kind: 'Emergency', number: '999' }] },
  TW: { primary: '110', services: [{ kind: 'Police', number: '110' }, { kind: 'Ambulance / Fire', number: '119' }] },
  PH: { primary: '911', services: [{ kind: 'Emergency', number: '911' }] },
  AE: { primary: '999', services: [{ kind: 'Police', number: '999' }, { kind: 'Ambulance', number: '998' }, { kind: 'Fire', number: '997' }] },
  EG: { primary: '122', services: [{ kind: 'Police', number: '122' }, { kind: 'Ambulance', number: '123' }, { kind: 'Fire', number: '180' }] },
  MA: { primary: '19', services: [{ kind: 'Police', number: '19' }, { kind: 'Ambulance / Fire', number: '15' }, { kind: 'Gendarmerie', number: '177' }] },
  IN: { primary: '112', services: [{ kind: 'Emergency', number: '112' }] },
  ZA: { primary: '10111', services: [{ kind: 'Police', number: '10111' }, { kind: 'Ambulance', number: '10177' }] },
  TR: { primary: '112', services: [{ kind: 'Emergency', number: '112' }] },
  GI: { primary: '112', services: [{ kind: 'Emergency', number: '112' }, { kind: 'Emergency', number: '199' }] },
};

const CALL_VERB: Record<string, string> = {
  ES: 'Llamar',
  FR: 'Appeler',
  DE: 'Anrufen',
  IT: 'Chiama',
  PT: 'Ligar',
  NL: 'Bel',
  BE: 'Appelez',
  MX: 'Llamar',
  AR: 'Llamar',
  BR: 'Ligar',
};

const EU: EmergencyInfo = {
  ok: true,
  iso: null,
  country: 'Unknown — enable GPS for local numbers',
  primary: '112',
  call: 'Call',
  services: [{ kind: 'Emergency (EU default)', number: '112' }],
  gps: false,
  offline: true,
};

export function blankIce(): IceCard {
  return { name: '', phone: '', relation: '', conditions: '', allergies: '', meds: '', bloodType: '', notes: '' };
}

export function normalizeIce(raw?: Partial<IceCard> | null): IceCard {
  const base = blankIce();
  if (!raw) return base;
  return {
    name: raw.name || '',
    phone: raw.phone || '',
    relation: raw.relation || '',
    conditions: raw.conditions || '',
    allergies: raw.allergies || '',
    meds: raw.meds || '',
    bloodType: raw.bloodType || '',
    notes: raw.notes || '',
  };
}

export function iceSummary(ice: IceCard): string {
  const parts: string[] = [];
  if (ice.name || ice.phone) {
    parts.push(`ICE: ${ice.name} ${ice.phone}${ice.relation ? ` (${ice.relation})` : ''}`.trim());
  }
  if (ice.conditions) parts.push(`Conditions: ${ice.conditions}`);
  if (ice.allergies) parts.push(`Allergies: ${ice.allergies}`);
  if (ice.meds) parts.push(`Meds: ${ice.meds}`);
  if (ice.bloodType) parts.push(`Blood: ${ice.bloodType}`);
  if (ice.notes) parts.push(ice.notes);
  return parts.join(' | ');
}

export function iceFilled(ice: IceCard): boolean {
  return Boolean(ice.name || ice.phone || ice.conditions || ice.allergies || ice.meds || ice.bloodType || ice.notes);
}

export function emergencyFor(lat?: number, lng?: number): EmergencyInfo {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return EU;
  for (const [latMin, latMax, lngMin, lngMax, iso, label] of BOXES) {
    if (lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax) {
      const pack = BY_ISO[iso] || { primary: '112', services: [{ kind: 'Emergency', number: '112' }] };
      return { ok: true, iso, country: label, primary: pack.primary, call: CALL_VERB[iso] || 'Call', services: pack.services, gps: true, offline: true };
    }
  }
  return { ...EU, gps: true, country: 'Unknown region — 112 as fallback' };
}

export const ICE_KEY = 'queendar_ice';

export function loadLocalIce(): IceCard {
  try {
    return normalizeIce(JSON.parse(localStorage.getItem(ICE_KEY) || 'null'));
  } catch {
    return blankIce();
  }
}

export function saveLocalIce(ice: IceCard) {
  localStorage.setItem(ICE_KEY, JSON.stringify(ice));
}
