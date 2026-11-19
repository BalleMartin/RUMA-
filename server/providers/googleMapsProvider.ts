import type {
  AvoidableTransitMode,
  GeocodedPlaceSummary,
  LatLngLiteral,
  PreferenceMode,
  RouteErrorCode,
  TripTimeMode,
  TripTimeSpec,
} from '../../src/shared/rumaTypes.ts';

const GMP_SOLUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

// Approximate bounding box covering Ciudad Autónoma de Buenos Aires (CABA)
export const CABA_BOUNDS = {
  low: { latitude: -34.706, longitude: -58.533 },
  high: { latitude: -34.526, longitude: -58.335 },
};

const GBA_PARTIDOS = [
  'vicente lopez',
  'san isidro',
  'tigre',
  'san fernando',
  'general san martin',
  'san martin',
  'tres de febrero',
  'hurlingham',
  'ituzaingo',
  'moron',
  'la matanza',
  'lomas de zamora',
  'lanus',
  'avellaneda',
  'quilmes',
  'berazategui',
  'florencio varela',
  'almirante brown',
  'esteban echeverria',
  'ezeiza',
  'merlo',
  'moreno',
  'san miguel',
  'malvinas argentinas',
  'jose c. paz',
  'pilar',
  'escobar',
  'la plata',
  'berisso',
  'ensenada',
];

const EXTERNAL_CITIES_AND_REGIONS = [
  'provincia de buenos aires',
  'gran buenos aires',
  'vicente lopez',
  'san isidro',
  'tigre',
  'avellaneda',
  'lanus',
  'lomas de zamora',
  'quilmes',
  'la matanza',
  'moron',
  'tres de febrero',
  'san martin',
  'la plata',
  'mar del plata',
  'cordoba',
  'rosario',
  'mendoza',
  'tucuman',
  'salta',
  'bariloche',
  'neuquen',
  'miami',
  'orlando',
  'estados unidos',
  'united states',
  'florida oeste',
  'florida, vicente lopez',
  'florida, ee',
  'florida, usa',
  'olivos',
  'martinez',
  'ramos mejia',
  'haedo',
  'caseros',
  'ciudadela',
  'wilde',
  'sarandi',
  'banfield',
  'temperley',
  'adrogué',
  'adrogue',
  'monte grande',
  'ezeiza',
];

export interface GoogleProviderError extends Error {
  code: RouteErrorCode;
  statusHttp?: number;
}

function makeProviderError(code: RouteErrorCode, message: string, statusHttp?: number): GoogleProviderError {
  const err = new Error(message) as GoogleProviderError;
  err.code = code;
  err.statusHttp = statusHttp;
  return err;
}

export function getGoogleMapsApiKey(): string | null {
  const key =
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_PLATFORM_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    '';
  return key.trim() ? key.trim() : null;
}

function normalizeStr(v: string): string {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Normalización lingüística de intersecciones porteñas, sin inventar geometrías.
 * Conserva nombres compuestos (por ej. "Av. de Mayo") y exige dos calles.
 */
function intersectionStreets(raw: string): [string, string] | null {
  let query = raw.trim().replace(/^["'«“]+|["'»”]+$/g, '').trim();
  const explicitCorner = /\b(?:esquina|cruce|intersecci[óo]n)\b/i.test(query);
  query = query.replace(/^(?:(?:en|hacia|a|al|la|el)\s+)*(?:esquina|cruce|intersecci[óo]n)\s+de\s+/i, '').trim();
  query = query.replace(/\s+esquina(?:\s+de)?\s+/i, ' & ');
  query = query.replace(/\s*&\s*/g, ' & ');
  if (explicitCorner) query = query.replace(/\s+con\s+/i, ' & ');

  const pair = query.includes(' & ')
    ? query.split(/\s+&\s+/)
    : query.split(/\s+[ye]\s+/i);
  if (pair.length !== 2) return null;
  const left = pair[0].trim();
  const right = pair[1].trim();
  if (left.length < 2 || right.length < 2) return null;
  // No dividir frases con verbos de viaje: "salgo de X y voy a Y".
  const tripWords = /\b(?:quiero|voy|salgo|llegar|viajar|desde|hasta|parto|saliendo|hacia|destino)\b/i;
  if (tripWords.test(left) || tripWords.test(right)) return null;
  return [left, right];
}

export function formatArgentineIntersectionForDisplay(raw: string): string {
  const pair = intersectionStreets(raw);
  return pair ? `${pair[0]} y ${pair[1]}` : raw.trim().replace(/\s+/g, ' ');
}

export function isArgentineIntersection(raw: string): boolean {
  return intersectionStreets(raw) !== null;
}

export function normalizeArgentineStreetQuery(rawQuery: string): string {
  const query = rawQuery.trim().replace(/^["'«“]+|["'»”]+$/g, '').trim();
  const intersection = intersectionStreets(query);
  if (intersection) return `${intersection[0]} & ${intersection[1]}`;

  // "Florida al 500" y "Anchorena al 1800" son direcciones con altura.
  return query
    .replace(/\b(?:al|altura|nro\.?|n[úu]mero)\s+(\d{1,5})\b/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasExplicitExternalJurisdiction(rawQuery: string): boolean {
  const norm = normalizeStr(rawQuery);
  return EXTERNAL_CITIES_AND_REGIONS.some((ext) => {
    const escaped = ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[,\\s])${escaped}($|[,\\s])`, 'i').test(norm);
  });
}

function isInsideCabaBounds(lat: number, lng: number): boolean {
  return (
    lat >= CABA_BOUNDS.low.latitude &&
    lat <= CABA_BOUNDS.high.latitude &&
    lng >= CABA_BOUNDS.low.longitude &&
    lng <= CABA_BOUNDS.high.longitude
  );
}

interface AddressComponentLike {
  longText?: string;
  shortText?: string;
  long_name?: string;
  short_name?: string;
  types?: string[];
}

function evaluateCabaMembership(
  lat: number,
  lng: number,
  formattedAddress: string,
  components: AddressComponentLike[] = []
): { isInsideCaba: boolean; localitySummary: string } {
  const normFormatted = normalizeStr(formattedAddress);

  const compText = (typesToFind: string[]) => {
    const match = components.find((c) => c.types?.some((t) => typesToFind.includes(t)));
    return match ? match.longText || match.long_name || match.shortText || match.short_name || '' : '';
  };

  const country = normalizeStr(compText(['country']));
  const admin1 = normalizeStr(compText(['administrative_area_level_1']));
  const admin2 = normalizeStr(compText(['administrative_area_level_2']));
  const locality = normalizeStr(compText(['locality']));
  const postal = normalizeStr(compText(['postal_code']));

  // Reject any non-Argentina result immediately (e.g., Florida, USA)
  if (
    country &&
    country !== 'ar' &&
    country !== 'argentina' &&
    !normFormatted.includes('argentina')
  ) {
    return {
      isInsideCaba: false,
      localitySummary: compText(['locality', 'administrative_area_level_1', 'country']) || formattedAddress,
    };
  }

  const hasGbaPartido = GBA_PARTIDOS.some(
    (p) => admin2.includes(p) || locality.includes(p) || normFormatted.includes(p)
  );

  const isProvinceBA =
    admin1.includes('provincia de buenos aires') ||
    admin1.includes('buenos aires province') ||
    normFormatted.includes('provincia de buenos aires') ||
    hasGbaPartido;

  if (isProvinceBA) {
    return {
      isInsideCaba: false,
      localitySummary: compText(['locality', 'administrative_area_level_2', 'administrative_area_level_1']) || formattedAddress,
    };
  }

  const explicitCaba =
    admin1.includes('ciudad autonoma de buenos aires') ||
    admin1.includes('autonomous city of buenos aires') ||
    admin1 === 'caba' ||
    locality.includes('ciudad autonoma de buenos aires') ||
    normFormatted.includes('ciudad autonoma de buenos aires') ||
    normFormatted.includes('cdad. autonoma de buenos aires') ||
    normFormatted.includes(', caba') ||
    (postal.startsWith('c1') && !isProvinceBA);

  const inBounds = isInsideCabaBounds(lat, lng);

  // Inside CABA if explicitly CABA OR (in CABA bounds and admin1/locality is Buenos Aires without Province/Partido)
  const genericBA =
    (admin1 === 'buenos aires' || locality === 'buenos aires' || normFormatted.includes('buenos aires')) &&
    inBounds &&
    !admin2 &&
    !hasGbaPartido;

  return {
    isInsideCaba: explicitCaba || genericBA,
    localitySummary:
      compText(['sublocality_level_1', 'locality', 'administrative_area_level_1']) || formattedAddress,
  };
}

function classifyHttpError(status: number, bodyText: string, serviceLabel: string): GoogleProviderError {
  const lower = bodyText.toLowerCase();
  if (status === 429 || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return makeProviderError(
      'QUOTA_EXCEEDED',
      `Se alcanzó el límite temporal de consultas de Google Maps Platform (${serviceLabel}).`,
      429
    );
  }
  if (status === 401 || status === 403 || lower.includes('permission_denied') || lower.includes('api_key_invalid')) {
    return makeProviderError(
      'AUTH_ERROR',
      `No hay autorización válida para consultar ${serviceLabel} en Google Maps Platform.`,
      status
    );
  }
  return makeProviderError(
    'UPSTREAM_ERROR',
    `El servicio de ubicación o rutas (${serviceLabel}) no respondió correctamente en este momento.`,
    status
  );
}

function haversineMeters(a: LatLngLiteral, b: LatLngLiteral): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export interface GeocodeResultOutcome {
  ok: boolean;
  place?: GeocodedPlaceSummary;
  ambiguousOptions?: GeocodedPlaceSummary[];
  outsideCabaPlace?: GeocodedPlaceSummary;
  errorCode?: RouteErrorCode;
  errorMessage?: string;
}

interface InternalGeoCandidate extends GeocodedPlaceSummary {
  granularity?: string;
  types?: string[];
}

async function queryGeocodingV4(
  addressText: string,
  originalQuery: string,
  apiKey: string
): Promise<InternalGeoCandidate[]> {
  const encodedAddr = encodeURIComponent(addressText);
  const geocodeUrl =
    `https://geocode.googleapis.com/v4/geocode/address/${encodedAddr}` +
    `?regionCode=ar&languageCode=es` +
    `&locationBias.rectangle.low.latitude=${CABA_BOUNDS.low.latitude}` +
    `&locationBias.rectangle.low.longitude=${CABA_BOUNDS.low.longitude}` +
    `&locationBias.rectangle.high.latitude=${CABA_BOUNDS.high.latitude}` +
    `&locationBias.rectangle.high.longitude=${CABA_BOUNDS.high.longitude}`;

  const geoRes = await fetch(geocodeUrl, {
    method: 'GET',
    signal: AbortSignal.timeout(12000),
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-Maps-Solution-ID': GMP_SOLUTION_ID,
      'X-Goog-FieldMask':
        'results.placeId,results.location,results.formattedAddress,results.addressComponents,results.types,results.granularity',
    },
  });

  const geoText = await geoRes.text();
  if (!geoRes.ok) {
    throw classifyHttpError(geoRes.status, geoText, 'Geocoding API');
  }

  const geoJson = JSON.parse(geoText) as {
    results?: Array<{
      placeId?: string;
      location?: { latitude?: number; longitude?: number };
      formattedAddress?: string;
      addressComponents?: AddressComponentLike[];
      types?: string[];
      granularity?: string;
    }>;
  };

  return (geoJson.results || [])
    .filter((r) => typeof r.location?.latitude === 'number' && typeof r.location?.longitude === 'number')
    .map((r) => {
      const lat = r.location!.latitude!;
      const lng = r.location!.longitude!;
      const formattedAddress = r.formattedAddress || originalQuery;
      const cabaEval = evaluateCabaMembership(lat, lng, formattedAddress, r.addressComponents || []);
      return {
        query: originalQuery,
        formattedAddress,
        location: { lat, lng },
        placeId: r.placeId,
        isInsideCaba: cabaEval.isInsideCaba,
        localitySummary: cabaEval.localitySummary,
        granularity: r.granularity,
        types: r.types,
      };
    });
}

async function queryPlacesTextSearch(
  textQuery: string,
  originalQuery: string,
  apiKey: string,
  restrictToCaba: boolean
): Promise<InternalGeoCandidate[]> {
  const payload: Record<string, unknown> = {
    textQuery,
    regionCode: 'AR',
    languageCode: 'es',
    maxResultCount: 5,
  };
  if (restrictToCaba) {
    payload.locationRestriction = { rectangle: CABA_BOUNDS };
  } else {
    payload.locationBias = { rectangle: CABA_BOUNDS };
  }

  const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    signal: AbortSignal.timeout(12000),
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-Maps-Solution-ID': GMP_SOLUTION_ID,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents,places.types',
    },
    body: JSON.stringify(payload),
  });

  const placesText = await placesRes.text();
  if (!placesRes.ok) {
    throw classifyHttpError(placesRes.status, placesText, 'Places API');
  }

  const placesJson = JSON.parse(placesText) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      addressComponents?: AddressComponentLike[];
      types?: string[];
    }>;
  };

  return (placesJson.places || [])
    .filter((p) => typeof p.location?.latitude === 'number' && typeof p.location?.longitude === 'number')
    .map((p) => {
      const lat = p.location!.latitude!;
      const lng = p.location!.longitude!;
      const formattedAddress = p.formattedAddress || p.displayName?.text || originalQuery;
      const cabaEval = evaluateCabaMembership(lat, lng, formattedAddress, p.addressComponents || []);
      return {
        query: originalQuery,
        displayName: p.displayName?.text,
        formattedAddress,
        location: { lat, lng },
        placeId: p.id,
        isInsideCaba: cabaEval.isInsideCaba,
        localitySummary: cabaEval.localitySummary,
        types: p.types,
      };
    });
}

async function lookupPlaceById(
  placeId: string,
  originalQuery: string,
  apiKey: string
): Promise<GeocodedPlaceSummary | null> {
  const cleanId = placeId.replace(/^places\//, '').trim();
  if (!cleanId) return null;

  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(cleanId)}?languageCode=es&regionCode=AR`,
    {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-Maps-Solution-ID': GMP_SOLUTION_ID,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents',
      },
    }
  );
  if (!res.ok) return null;

  const p = (await res.json()) as {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    addressComponents?: AddressComponentLike[];
  };

  if (typeof p.location?.latitude !== 'number' || typeof p.location?.longitude !== 'number') {
    return null;
  }
  const lat = p.location.latitude;
  const lng = p.location.longitude;
  const formattedAddress = p.formattedAddress || p.displayName?.text || originalQuery;
  const cabaEval = evaluateCabaMembership(lat, lng, formattedAddress, p.addressComponents || []);
  return {
    query: originalQuery,
    displayName: p.displayName?.text,
    formattedAddress,
    location: { lat, lng },
    placeId: p.id || cleanId,
    isInsideCaba: cabaEval.isInsideCaba,
    localitySummary: cabaEval.localitySummary,
  };
}

function isCoarseCityFallback(candidate: InternalGeoCandidate | undefined): boolean {
  if (!candidate) return true;
  const isLocalityOnly =
    candidate.types?.includes('locality') || candidate.types?.includes('administrative_area_level_1');
  return candidate.granularity === 'APPROXIMATE' && Boolean(isLocalityOnly);
}

export async function geocodeCabaPlace(
  rawQuery: string,
  confirmedPlaceId?: string
): Promise<GeocodeResultOutcome> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return {
      ok: false,
      errorCode: 'NO_API_KEY',
      errorMessage: 'Falta configurar la clave de Google Maps Platform en el entorno del servidor.',
    };
  }

  const query = rawQuery.trim();
  if (!query) {
    return {
      ok: false,
      errorCode: 'GEOCODE_NOT_FOUND',
      errorMessage: 'La ubicación está vacía.',
    };
  }

  // 0) If user confirmed an exact Place from Autocomplete, verify it directly by Place ID
  if (confirmedPlaceId) {
    try {
      const placeFromId = await lookupPlaceById(confirmedPlaceId, query, apiKey);
      if (placeFromId) {
        if (!placeFromId.isInsideCaba) {
          return {
            ok: false,
            outsideCabaPlace: placeFromId,
            errorCode: 'OUTSIDE_CABA',
            errorMessage: `"${query}" se ubicó fuera de CABA (${placeFromId.formattedAddress}). RUMA cubre únicamente viajes dentro de la Ciudad Autónoma de Buenos Aires.`,
          };
        }
        return { ok: true, place: placeFromId };
      }
    } catch {
      // Fall through to text/address geocoding if Place Details lookup transiently fails
    }
  }

  const normalizedQuery = normalizeArgentineStreetQuery(query);
  const explicitExternal = hasExplicitExternalJurisdiction(normalizedQuery);
  const alreadyMentionsCaba = /\b(caba|ciudad autonoma|capital federal|cdad\.?\s*autonoma)\b/i.test(
    normalizeStr(normalizedQuery)
  );

  let candidates: InternalGeoCandidate[] = [];

  if (!explicitExternal) {
    // 1) Try contextualized CABA address first so "Florida al 500" or "Anchorena al 1800" always prioritize CABA porteña
    const cabaScopedQuery = alreadyMentionsCaba
      ? normalizedQuery
      : `${normalizedQuery}, Ciudad Autónoma de Buenos Aires, Argentina`;

    const geoCaba = await queryGeocodingV4(cabaScopedQuery, query, apiKey);
    const usableGeoCaba = geoCaba.filter((c) => c.isInsideCaba && !isCoarseCityFallback(c));

    if (usableGeoCaba.length > 0) {
      candidates = usableGeoCaba;
    } else {
      // 2) Try Places Text Search strictly restricted to CABA bounds
      try {
        const placesCaba = await queryPlacesTextSearch(normalizedQuery, query, apiKey, true);
        const insidePlaces = placesCaba.filter((c) => c.isInsideCaba);
        if (insidePlaces.length > 0) {
          candidates = insidePlaces;
        }
      } catch (err) {
        if (geoCaba.length === 0) throw err;
      }
    }

    // 3) If still nothing usable in CABA (e.g., user typed an address/city outside CABA), check unrestricted query to report OUTSIDE_CABA accurately
    if (candidates.length === 0) {
      const rawGeo = await queryGeocodingV4(normalizedQuery, query, apiKey);
      if (rawGeo.length > 0) {
        candidates = rawGeo;
      } else {
        try {
          candidates = await queryPlacesTextSearch(normalizedQuery, query, apiKey, false);
        } catch {
          candidates = geoCaba;
        }
      }
    }
  } else {
    // User explicitly mentioned an external city/region (e.g. La Plata, Vicente López, Miami): resolve raw query directly
    const rawGeo = await queryGeocodingV4(normalizedQuery, query, apiKey);
    candidates = rawGeo;
    if (candidates.length === 0 || isCoarseCityFallback(candidates[0])) {
      try {
        const placeHits = await queryPlacesTextSearch(normalizedQuery, query, apiKey, false);
        if (placeHits.length > 0) {
          candidates = placeHits;
        }
      } catch (err) {
        if (candidates.length === 0) throw err;
      }
    }
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      errorCode: 'GEOCODE_NOT_FOUND',
      errorMessage: `No pude localizar "${query}" en CABA. Probá sumar la altura o la esquina (por ejemplo, "Anchorena 1800" o "Florida 500").`,
    };
  }

  const primary = candidates[0];

  if (!primary.isInsideCaba) {
    const insideCandidate = !explicitExternal ? candidates.find((c) => c.isInsideCaba) : undefined;
    if (!insideCandidate) {
      return {
        ok: false,
        outsideCabaPlace: primary,
        errorCode: 'OUTSIDE_CABA',
        errorMessage: `"${query}" se ubicó fuera de CABA (${primary.formattedAddress}). RUMA cubre únicamente viajes dentro de la Ciudad Autónoma de Buenos Aires.`,
      };
    }
    return { ok: true, place: insideCandidate };
  }

  // Disambiguate if there are multiple very different CABA results (>1.5 km apart) and query had no street number
  const insideCandidates = candidates.filter((c) => c.isInsideCaba);
  if (
    insideCandidates.length >= 2 &&
    normalizedQuery.split(/\s+/).length <= 2 &&
    !/\d/.test(normalizedQuery) &&
    haversineMeters(insideCandidates[0].location, insideCandidates[1].location) > 1500 &&
    !insideCandidates[0].displayName?.toLowerCase().includes(normalizeStr(normalizedQuery))
  ) {
    return {
      ok: false,
      ambiguousOptions: insideCandidates.slice(0, 3),
      errorCode: 'AMBIGUOUS_LOCATION',
      errorMessage: `La referencia "${query}" tiene más de una ubicación posible en CABA. Elegí la que corresponda.`,
    };
  }

  return { ok: true, place: primary };
}

export function getBuenosAiresDateString(dateObj: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateObj);
}

/**
 * Resolves either a structured TripTimeSpec or natural Spanish time phrase in America/Argentina/Buenos_Aires (UTC-3)
 * into a valid RFC3339 timestamp for Google Routes API (departureTime or arrivalTime) plus ambiguity detection.
 */
export function resolveBuenosAiresTripTime(input?: TripTimeSpec | string): {
  mode: TripTimeMode;
  rfc3339: string;
  humanLabel: string;
  wasAdjustedToFuture: boolean;
  clarificationNeeded: boolean;
  clarificationQuestion?: string;
  resolvedDate: string;
  resolvedTime: string;
} {
  const now = new Date();
  const futureSafeNow = new Date(now.getTime() + 60_000);
  const todayBa = getBuenosAiresDateString(now);

  const fmtFull = (d: Date) =>
    new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);

  const fmtClock = (d: Date) =>
    new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);

  // Case 1: Structured spec from UI / state
  if (input && typeof input === 'object') {
    if (input.clarificationNeeded && input.clarificationQuestion) {
      return {
        mode: input.mode || 'departure',
        rfc3339: futureSafeNow.toISOString(),
        humanLabel: input.humanLabel || 'Horario por confirmar',
        wasAdjustedToFuture: false,
        clarificationNeeded: true,
        clarificationQuestion: input.clarificationQuestion,
        resolvedDate: input.date || todayBa,
        resolvedTime: input.time || fmtClock(now),
      };
    }

    if (input.mode === 'ahora' && !input.rawText) {
      return {
        mode: 'ahora',
        rfc3339: futureSafeNow.toISOString(),
        humanLabel: `Ahora (${fmtFull(now)} ART)`,
        wasAdjustedToFuture: false,
        clarificationNeeded: false,
        resolvedDate: todayBa,
        resolvedTime: fmtClock(now),
      };
    }

    if ((input.mode === 'departure' || input.mode === 'arrival') && input.time && /^\d{1,2}:\d{2}$/.test(input.time)) {
      const [hStr, mStr] = input.time.split(':');
      const hh = String(Math.min(23, Number(hStr))).padStart(2, '0');
      const mm = String(Math.min(59, Number(mStr))).padStart(2, '0');
      const targetDate = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : todayBa;
      let candidate = new Date(`${targetDate}T${hh}:${mm}:00-03:00`);
      let adjusted = false;
      if (Number.isNaN(candidate.getTime())) {
        candidate = futureSafeNow;
      } else if (candidate.getTime() < now.getTime()) {
        candidate = new Date(candidate.getTime() + 86_400_000);
        adjusted = true;
      }
      const prefix = input.mode === 'arrival' ? 'Llegar antes de las ' : 'Salir ';
      return {
        mode: input.mode,
        rfc3339: candidate.toISOString(),
        humanLabel: adjusted
          ? `${prefix}${fmtFull(candidate)} ART (el horario indicado hoy ya pasó; evaluado para mañana)`
          : `${prefix}${fmtFull(candidate)} ART`,
        wasAdjustedToFuture: adjusted,
        clarificationNeeded: false,
        resolvedDate: getBuenosAiresDateString(candidate),
        resolvedTime: `${hh}:${mm}`,
      };
    }
  }

  // Case 2: String / rawText parsing
  const rawText = typeof input === 'string' ? input : input?.rawText || 'ahora';
  const norm = normalizeStr(rawText);

  if (!norm || norm === 'ahora') {
    return {
      mode: 'ahora',
      rfc3339: futureSafeNow.toISOString(),
      humanLabel: `Ahora (${fmtFull(now)} ART)`,
      wasAdjustedToFuture: false,
      clarificationNeeded: false,
      resolvedDate: todayBa,
      resolvedTime: fmtClock(now),
    };
  }

  const isArrival =
    /\b(llegar\s+antes|antes\s+de\s+las|para\s+llegar|llegada)\b/.test(norm) ||
    (typeof input === 'object' && input.mode === 'arrival');
  const timeMode: TripTimeMode = isArrival ? 'arrival' : 'departure';

  // Detect "mañana" (tomorrow) vs "la mañana" (in the morning)
  const hasPasadoManana = /\bpasado\s+manana\b/.test(norm);
  const hasTomorrow =
    /\bmanana\b/.test(norm) && !/\b(?:de|por|a)\s+la\s+manana\b/.test(norm);

  // Extract time like "18:30", "18h", "las 8", "8 am", "8 pm", "14 hs"
  const fullClockMatch = norm.match(/(\d{1,2})\s*[:h.]\s*(\d{2})/);
  const shortHourMatch = norm.match(/(?:a\s+las|antes\s+de\s+las|las|salir\s+a\s+las)\s*(\d{1,2})(?!\d)(?:\s*(am|pm|hs?|horas?|de la manana|de la tarde|de la noche))?/i)
    || norm.match(/\b(\d{1,2})\s*(am|pm|hs)\b/i);

  let hour: number | null = null;
  let minute = 0;

  if (fullClockMatch) {
    hour = Number(fullClockMatch[1]);
    minute = Number(fullClockMatch[2]);
  } else if (shortHourMatch) {
    hour = Number(shortHourMatch[1]);
    const suffix = normalizeStr(shortHourMatch[2] || '');
    const hasPm = /\b(pm|de la tarde|de la noche)\b/.test(norm) || suffix === 'pm' || suffix.includes('tarde') || suffix.includes('noche');
    const hasAm = /\b(am|de la manana)\b/.test(norm) || suffix === 'am' || suffix.includes('manana');

    if (hasPm && hour >= 1 && hour <= 11) {
      hour += 12;
    } else if (hasAm && hour === 12) {
      hour = 0;
    } else if (!hasAm && !hasPm && hour >= 1 && hour <= 12 && !hasTomorrow && !/\bhoy\b/.test(norm)) {
      // Bare ambiguous hour like "a las 8" without hoy/mañana/am/pm -> ask user cleanly
      return {
        mode: timeMode,
        rfc3339: futureSafeNow.toISOString(),
        humanLabel: rawText,
        wasAdjustedToFuture: false,
        clarificationNeeded: true,
        clarificationQuestion: `¿Te referís a las ${String(hour).padStart(2, '0')}:00 o a las ${String((hour % 12) + 12).padStart(2, '0')}:00, y para hoy o mañana?`,
        resolvedDate: todayBa,
        resolvedTime: fmtClock(now),
      };
    }
  }

  // If user wrote "mañana" or "hoy" without any hour -> ask!
  if (hour === null) {
    if (hasTomorrow || hasPasadoManana || /\bhoy\b/.test(norm)) {
      return {
        mode: timeMode,
        rfc3339: futureSafeNow.toISOString(),
        humanLabel: rawText,
        wasAdjustedToFuture: false,
        clarificationNeeded: true,
        clarificationQuestion: `¿A qué hora exacta querés ${isArrival ? 'llegar' : 'salir'} ${hasTomorrow ? 'mañana' : hasPasadoManana ? 'pasado mañana' : 'hoy'}?`,
        resolvedDate: todayBa,
        resolvedTime: fmtClock(now),
      };
    }
    return {
      mode: 'ahora',
      rfc3339: futureSafeNow.toISOString(),
      humanLabel: `Ahora (${fmtFull(now)} ART)`,
      wasAdjustedToFuture: false,
      clarificationNeeded: false,
      resolvedDate: todayBa,
      resolvedTime: fmtClock(now),
    };
  }

  if (hour > 23 || minute > 59) {
    return {
      mode: timeMode,
      rfc3339: futureSafeNow.toISOString(),
      humanLabel: rawText,
      wasAdjustedToFuture: false,
      clarificationNeeded: true,
      clarificationQuestion: 'No pude interpretar ese horario. ¿Me indicás la hora en formato HH:MM (por ejemplo, 08:30 o 18:00)?',
      resolvedDate: todayBa,
      resolvedTime: fmtClock(now),
    };
  }

  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  let baseDate = new Date(`${todayBa}T${hh}:${mm}:00-03:00`);
  if (hasTomorrow) {
    baseDate = new Date(baseDate.getTime() + 86_400_000);
  } else if (hasPasadoManana) {
    baseDate = new Date(baseDate.getTime() + 2 * 86_400_000);
  }

  let adjusted = false;
  if (baseDate.getTime() < now.getTime()) {
    baseDate = new Date(baseDate.getTime() + 86_400_000);
    adjusted = true;
  }

  const prefix = isArrival ? 'Llegar antes de las ' : 'Salir ';
  return {
    mode: timeMode,
    rfc3339: baseDate.toISOString(),
    humanLabel: adjusted
      ? `${prefix}${fmtFull(baseDate)} ART (el horario indicado hoy ya pasó; evaluado para mañana)`
      : `${prefix}${fmtFull(baseDate)} ART`,
    wasAdjustedToFuture: adjusted,
    clarificationNeeded: false,
    resolvedDate: getBuenosAiresDateString(baseDate),
    resolvedTime: `${hh}:${mm}`,
  };
}

// Keep backward-compatible alias if any caller uses it
export function resolveBuenosAiresDepartureRfc3339(momento?: string) {
  return resolveBuenosAiresTripTime(momento);
}

export interface GoogleRouteStepRaw {
  travelMode?: string;
  distanceMeters?: number;
  staticDuration?: string;
  polyline?: { encodedPolyline?: string };
  startLocation?: { latLng?: { latitude?: number; longitude?: number } };
  endLocation?: { latLng?: { latitude?: number; longitude?: number } };
  navigationInstruction?: { maneuver?: string; instructions?: string };
  transitDetails?: {
    stopDetails?: {
      arrivalStop?: { name?: string; location?: { latLng?: { latitude?: number; longitude?: number } } };
      departureStop?: { name?: string; location?: { latLng?: { latitude?: number; longitude?: number } } };
      arrivalTime?: string;
      departureTime?: string;
    };
    localizedValues?: {
      arrivalTime?: { time?: { text?: string } };
      departureTime?: { time?: { text?: string } };
    };
    headsign?: string;
    stopCount?: number;
    transitLine?: {
      name?: string;
      nameShort?: string;
      color?: string;
      textColor?: string;
      agencies?: Array<{ name?: string; uri?: string }>;
      vehicle?: { name?: { text?: string }; type?: string };
    };
  };
}

export interface GoogleRouteRaw {
  duration?: string;
  distanceMeters?: number;
  polyline?: { encodedPolyline?: string };
  viewport?: {
    low?: { latitude?: number; longitude?: number };
    high?: { latitude?: number; longitude?: number };
  };
  routeLabels?: string[];
  travelAdvisory?: {
    transitFare?: unknown;
    fuelConsumptionMicroliters?: string;
    routeRestrictionsPartiallyIgnored?: boolean;
  };
  localizedValues?: {
    distance?: { text?: string };
    duration?: { text?: string };
    staticDuration?: { text?: string };
  };
  legs?: Array<{
    duration?: string;
    distanceMeters?: number;
    polyline?: { encodedPolyline?: string };
    startLocation?: { latLng?: { latitude?: number; longitude?: number } };
    endLocation?: { latLng?: { latitude?: number; longitude?: number } };
    steps?: GoogleRouteStepRaw[];
  }>;
}

export async function computeGoogleRoutes(params: {
  origin: LatLngLiteral;
  destination: LatLngLiteral;
  travelMode: 'TRANSIT' | 'WALK';
  timeMode?: TripTimeMode;
  departureTimeRfc3339: string;
  preference: PreferenceMode;
  avoidModes?: AvoidableTransitMode[];
}): Promise<GoogleRouteRaw[]> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    throw makeProviderError(
      'NO_API_KEY',
      'Falta configurar la clave de Google Maps Platform en el entorno del servidor.'
    );
  }

  const body: Record<string, unknown> = {
    origin: {
      location: {
        latLng: {
          latitude: params.origin.lat,
          longitude: params.origin.lng,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: params.destination.lat,
          longitude: params.destination.lng,
        },
      },
    },
    travelMode: params.travelMode,
    computeAlternativeRoutes: true,
    languageCode: 'es-419',
    units: 'METRIC',
  };

  if (params.travelMode === 'TRANSIT') {
    if (params.timeMode === 'arrival') {
      body.arrivalTime = params.departureTimeRfc3339;
    } else {
      body.departureTime = params.departureTimeRfc3339;
    }

    const transitPreferences: Record<string, unknown> = {};
    if (params.preference === 'menos_caminata') {
      transitPreferences.routingPreference = 'LESS_WALKING';
    } else if (params.preference === 'menos_transbordos') {
      transitPreferences.routingPreference = 'FEWER_TRANSFERS';
    }

    if (params.avoidModes && params.avoidModes.length > 0) {
      const allowed: string[] = [];
      if (!params.avoidModes.includes('bus')) allowed.push('BUS');
      if (!params.avoidModes.includes('subte')) allowed.push('SUBWAY');
      if (!params.avoidModes.includes('tren')) allowed.push('TRAIN', 'RAIL', 'LIGHT_RAIL');
      if (allowed.length > 0) {
        transitPreferences.allowedTravelModes = allowed;
      }
    }

    if (Object.keys(transitPreferences).length > 0) {
      body.transitPreferences = transitPreferences;
    }
  }

  const fieldMask = [
    'routes.duration',
    'routes.distanceMeters',
    'routes.polyline.encodedPolyline',
    'routes.viewport',
    'routes.routeLabels',
    'routes.travelAdvisory',
    'routes.localizedValues',
    'routes.legs.duration',
    'routes.legs.distanceMeters',
    'routes.legs.polyline.encodedPolyline',
    'routes.legs.startLocation',
    'routes.legs.endLocation',
    'routes.legs.steps.travelMode',
    'routes.legs.steps.distanceMeters',
    'routes.legs.steps.staticDuration',
    'routes.legs.steps.polyline.encodedPolyline',
    'routes.legs.steps.startLocation',
    'routes.legs.steps.endLocation',
    'routes.legs.steps.navigationInstruction',
    'routes.legs.steps.transitDetails',
  ].join(',');

  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    signal: AbortSignal.timeout(12000),
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-Maps-Solution-ID': GMP_SOLUTION_ID,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw classifyHttpError(res.status, text, 'Routes API');
  }

  const json = JSON.parse(text) as { routes?: GoogleRouteRaw[] };
  return json.routes || [];
}
