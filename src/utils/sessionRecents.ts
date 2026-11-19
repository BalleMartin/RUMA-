import type { GeocodedPlaceSummary, RecentPlaceEntry } from '../shared/rumaTypes';

const STORAGE_KEYS = {
  origin: 'ruma_session_recent_origins_v1',
  destination: 'ruma_session_recent_destinations_v1',
} as const;

const MAX_RECENTS = 3;

function normAddr(v: string): string {
  return v.toLowerCase().trim();
}

export function loadRecentPlaces(kind: 'origin' | 'destination'): RecentPlaceEntry[] {
  if (typeof window === 'undefined' || !window.sessionStorage) return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEYS[kind]);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentPlaceEntry =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof item.label === 'string' &&
          typeof item.formattedAddress === 'string' &&
          item.location &&
          typeof item.location.lat === 'number' &&
          typeof item.location.lng === 'number'
      )
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function saveRecentPlace(
  kind: 'origin' | 'destination',
  place: GeocodedPlaceSummary
): RecentPlaceEntry[] {
  if (typeof window === 'undefined' || !window.sessionStorage) return [];
  if (!place.isInsideCaba || !place.formattedAddress) return loadRecentPlaces(kind);

  const label = place.displayName
    ? `${place.displayName} — ${place.formattedAddress}`
    : place.formattedAddress;

  const entry: RecentPlaceEntry = {
    label,
    formattedAddress: place.formattedAddress,
    displayName: place.displayName,
    placeId: place.placeId,
    location: place.location,
    localitySummary: place.localitySummary,
    savedAt: new Date().toISOString(),
  };

  const existing = loadRecentPlaces(kind);
  const filtered = existing.filter((item) => {
    if (entry.placeId && item.placeId) {
      return item.placeId !== entry.placeId;
    }
    return normAddr(item.formattedAddress) !== normAddr(entry.formattedAddress);
  });

  const updated = [entry, ...filtered].slice(0, MAX_RECENTS);
  try {
    window.sessionStorage.setItem(STORAGE_KEYS[kind], JSON.stringify(updated));
  } catch {
    // Ignore storage quota issues safely
  }
  return updated;
}

export function clearRecentPlaces(kind: 'origin' | 'destination' | 'all'): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    if (kind === 'all') {
      window.sessionStorage.removeItem(STORAGE_KEYS.origin);
      window.sessionStorage.removeItem(STORAGE_KEYS.destination);
    } else {
      window.sessionStorage.removeItem(STORAGE_KEYS[kind]);
    }
  } catch {
    // Ignore storage errors
  }
}
