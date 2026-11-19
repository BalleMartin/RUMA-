import { getBuenosAiresTime } from './cabaTransitEngine.ts';
import {
  computeGoogleRoutes,
  geocodeCabaPlace,
  resolveBuenosAiresTripTime,
  type GoogleProviderError,
  type GoogleRouteRaw,
  type GoogleRouteStepRaw,
} from './providers/googleMapsProvider.ts';
import type {
  AvoidableTransitMode,
  CandidateRoute,
  GeocodedPlaceSummary,
  ItineraryAccessCategory,
  PreferenceMode,
  RouteAccessStatus,
  RouteErrorCode,
  RouteLeg,
  RoutePolylineSegment,
  RouteQueryError,
  StationAccessibilityRecord,
  SubteStationCheckSummary,
  TransitServiceStatus,
  TravelConstraints,
  TripTimeSpec,
} from '../src/shared/rumaTypes.ts';

export const EMOVA_ACCESSIBILITY_URL = 'https://emova.com.ar/index.php/accesibilidad/';
export const EMOVA_ACCESSIBILITY_PHONE = '0800-333-6682';

// Structural knowledge of stations historically known to lack elevators (never assumes live operational status)
const KNOWN_NO_ELEVATOR_STATIONS = [
  'pasco',
  'alberti',
  'acoyte',
  'piedras',
  'lima',
  'saenz pena',
  'lorea',
  'rio de janeiro',
  'castro barros',
  'loria',
  'carlos gardel',
  'malabia',
  'angel gallardo',
  'uruguay',
  'callao',
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDurationSeconds(durStr?: string): number {
  if (!durStr) return 0;
  const m = durStr.match(/^(\d+(?:\.\d+)?)s$/);
  return m ? Math.round(Number(m[1])) : 0;
}

function cleanInstructionText(raw?: string): string {
  if (!raw) return '';
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shortPlaceName(place: GeocodedPlaceSummary): string {
  if (place.displayName?.trim()) return place.displayName.trim();
  const firstPart = place.formattedAddress.split(',')[0]?.trim();
  return firstPart || place.query;
}

function mapTransitVehicleType(vehicleType?: string): 'subte' | 'colectivo' | 'tren' {
  const v = (vehicleType || '').toUpperCase();
  if (v === 'SUBWAY' || v === 'METRO_RAIL' || v === 'TRAM' || v === 'LIGHT_RAIL') {
    return 'subte';
  }
  if (
    v === 'RAIL' ||
    v === 'COMMUTER_TRAIN' ||
    v === 'HEAVY_RAIL' ||
    v === 'HIGH_SPEED_TRAIN' ||
    v === 'LONG_DISTANCE_TRAIN'
  ) {
    return 'tren';
  }
  return 'colectivo';
}

function mapModeToAvoidKey(modo: 'caminata' | 'subte' | 'colectivo' | 'tren'): AvoidableTransitMode | null {
  if (modo === 'colectivo') return 'bus';
  if (modo === 'subte') return 'subte';
  if (modo === 'tren') return 'tren';
  return null;
}

function formatShortTimeART(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

function summarizeStepsToLegs(
  rawRoute: GoogleRouteRaw,
  travelModeUsed: 'TRANSIT' | 'WALK',
  originShortLabel: string,
  destShortLabel: string
): {
  legs: RouteLeg[];
  polylines: RoutePolylineSegment[];
  walkMeters: number;
  transfers: number;
  usedModes: Set<AvoidableTransitMode>;
  hasKnownNoElevatorStation: boolean;
  knownNoElevatorStationNames: string[];
  departureTimeStr?: string;
  arrivalTimeStr?: string;
} {
  const legs: RouteLeg[] = [];
  const polylines: RoutePolylineSegment[] = [];
  let walkMeters = 0;
  let transitLegCount = 0;
  const usedModes = new Set<AvoidableTransitMode>();
  const knownNoElevatorStationNames: string[] = [];
  let firstDeparture: string | undefined;
  let lastArrival: string | undefined;

  const rawLegs = rawRoute.legs || [];

  let pendingWalkSteps: GoogleRouteStepRaw[] = [];

  const flushWalkSteps = () => {
    if (pendingWalkSteps.length === 0) return;
    let dist = 0;
    let durSec = 0;
    const first = pendingWalkSteps[0];
    const last = pendingWalkSteps[pendingWalkSteps.length - 1];
    const streetHints: string[] = [];

    for (const s of pendingWalkSteps) {
      dist += s.distanceMeters || 0;
      durSec += parseDurationSeconds(s.staticDuration);
      const inst = cleanInstructionText(s.navigationInstruction?.instructions);
      if (inst && streetHints.length < 2) {
        streetHints.push(inst);
      }
      if (s.polyline?.encodedPolyline) {
        polylines.push({
          encodedPolyline: s.polyline.encodedPolyline,
          modo: 'caminata',
          colorHex: '#475569',
          label: 'Tramo a pie',
        });
      }
    }

    walkMeters += dist;
    const durMin = Math.max(1, Math.round(durSec / 60));
    const walkHint = streetHints.length > 0 ? streetHints[0] : '';

    legs.push({
      modo: 'caminata',
      desde: '__PENDING_WALK_START__',
      hasta: '__PENDING_WALK_END__',
      duracionMin: durMin,
      distanciaMetros: dist,
      requiereEscaleras: false,
      estadoAccesibilidad: 'estado_desconocido',
      accessibilityUncertaintyReason: 'Veredas y rampas en esquina: sin confirmar.',
      notas: walkHint
        ? `${walkHint}. Verificá veredas y rampas en esquina.`
        : travelModeUsed === 'WALK'
          ? 'Recorrido peatonal calculado; verificá veredas y rampas en esquina.'
          : 'Tramo a pie de acceso o combinación; no verifica estado de veredas ni rampas.',
      encodedPolyline: pendingWalkSteps.length === 1 ? first.polyline?.encodedPolyline : undefined,
      startLocation:
        first.startLocation?.latLng?.latitude !== undefined &&
        first.startLocation?.latLng?.longitude !== undefined
          ? { lat: first.startLocation.latLng.latitude, lng: first.startLocation.latLng.longitude }
          : undefined,
      endLocation:
        last.endLocation?.latLng?.latitude !== undefined &&
        last.endLocation?.latLng?.longitude !== undefined
          ? { lat: last.endLocation.latLng.latitude, lng: last.endLocation.latLng.longitude }
          : undefined,
    });

    pendingWalkSteps = [];
  };

  for (const rLeg of rawLegs) {
    for (const step of rLeg.steps || []) {
      if (step.travelMode === 'TRANSIT' && step.transitDetails) {
        flushWalkSteps();

        const td = step.transitDetails;
        const vType = td.transitLine?.vehicle?.type;
        const modo = mapTransitVehicleType(vType);
        const avoidKey = mapModeToAvoidKey(modo);
        if (avoidKey) usedModes.add(avoidKey);

        transitLegCount += 1;

        const depStop = td.stopDetails?.departureStop?.name || 'Parada de subida';
        const arrStop = td.stopDetails?.arrivalStop?.name || 'Parada de bajada';
        const depTime =
          td.localizedValues?.departureTime?.time?.text || formatShortTimeART(td.stopDetails?.departureTime);
        const arrTime =
          td.localizedValues?.arrivalTime?.time?.text || formatShortTimeART(td.stopDetails?.arrivalTime);

        if (!firstDeparture && depTime) firstDeparture = depTime;
        if (arrTime) lastArrival = arrTime;

        const shortName = (td.transitLine?.nameShort || '').trim();
        const fullLineName = (td.transitLine?.name || '').trim();
        const agencyName = td.transitLine?.agencies?.[0]?.name;
        const primaryLineCode = shortName || fullLineName;
        const lineLabel =
          modo === 'subte'
            ? `Subte ${primaryLineCode}`.trim()
            : modo === 'tren'
              ? `Tren ${primaryLineCode}`.trim()
              : `Colectivo ${primaryLineCode}`.trim();

        const normShort = normalizeText(shortName);
        const normFull = normalizeText(fullLineName);
        const ramal =
          fullLineName &&
          normFull !== normShort &&
          normFull !== `linea ${normShort}` &&
          normFull !== `colectivo ${normShort}` &&
          normFull !== `subte ${normShort}`
            ? fullLineName
            : undefined;

        const durMin = Math.max(1, Math.round(parseDurationSeconds(step.staticDuration) / 60));

        let stepAcc: RouteLeg['estadoAccesibilidad'] = 'estado_desconocido';
        let reqStairs = false;
        let busRampStatus: RouteLeg['busRampStatus'];
        let uncertaintyReason =
          modo === 'colectivo'
            ? 'Rampa de la unidad: sin confirmar'
            : modo === 'subte'
              ? 'Accesibilidad de estaciones pendiente de confirmar'
              : 'Accesibilidad de estaciones ferroviarias pendiente de confirmar';
        let notes =
          modo === 'colectivo'
            ? 'Rampa de la unidad: sin confirmar. La disponibilidad de piso bajo o rampa operativa depende de cada unidad.'
            : 'Accesibilidad de estaciones pendiente de confirmar; consultar estado de ascensores en EMOVA.';

        if (modo === 'colectivo') {
          busRampStatus = 'unconfirmed';
        }

        if (modo === 'subte') {
          const normDep = normalizeText(depStop);
          const normArr = normalizeText(arrStop);
          const depNoElev = KNOWN_NO_ELEVATOR_STATIONS.find((s) => normDep.includes(s));
          const arrNoElev = KNOWN_NO_ELEVATOR_STATIONS.find((s) => normArr.includes(s));
          if (depNoElev || arrNoElev) {
            stepAcc = 'no_accesible';
            reqStairs = true;
            if (depNoElev) knownNoElevatorStationNames.push(depStop);
            if (arrNoElev) knownNoElevatorStationNames.push(arrStop);
            const missingStations = [depNoElev ? depStop : '', arrNoElev ? arrStop : ''].filter(Boolean).join(' / ');
            uncertaintyReason = `Estación sin ascensor registrado (${missingStations})`;
            notes = `Estación históricamente sin ascensor (${missingStations}); consultar en EMOVA.`;
          }
        }

        const depLoc = td.stopDetails?.departureStop?.location?.latLng || step.startLocation?.latLng;
        const arrLoc = td.stopDetails?.arrivalStop?.location?.latLng || step.endLocation?.latLng;

        if (step.polyline?.encodedPolyline) {
          polylines.push({
            encodedPolyline: step.polyline.encodedPolyline,
            modo,
            colorHex:
              td.transitLine?.color ||
              (modo === 'subte' ? '#0F5257' : modo === 'tren' ? '#1D4ED8' : '#0369A1'),
            label: lineLabel,
          });
        }

        legs.push({
          modo,
          linea: lineLabel,
          lineaCorta: shortName || undefined,
          ramal,
          agencia: agencyName,
          cabecera: td.headsign,
          cantidadParadas: td.stopCount,
          vehicleType: vType,
          desde: depStop,
          hasta: arrStop,
          horaSalida: depTime,
          horaLlegada: arrTime,
          duracionMin: durMin,
          distanciaMetros: step.distanceMeters,
          requiereEscaleras: reqStairs,
          estadoAccesibilidad: stepAcc,
          busRampStatus,
          accessibilityUncertaintyReason: uncertaintyReason,
          notas: notes,
          encodedPolyline: step.polyline?.encodedPolyline,
          startLocation:
            depLoc?.latitude !== undefined && depLoc?.longitude !== undefined
              ? { lat: depLoc.latitude, lng: depLoc.longitude }
              : undefined,
          endLocation:
            arrLoc?.latitude !== undefined && arrLoc?.longitude !== undefined
              ? { lat: arrLoc.latitude, lng: arrLoc.longitude }
              : undefined,
        });
      } else {
        pendingWalkSteps.push(step);
      }
    }
  }
  flushWalkSteps();

  // Resolve concrete, legible walking leg endpoints using surrounding stops + origin/destination labels
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    if (leg.modo !== 'caminata') continue;
    const prevLeg = i > 0 ? legs[i - 1] : null;
    const nextLeg = i < legs.length - 1 ? legs[i + 1] : null;

    leg.desde = prevLeg ? prevLeg.hasta : originShortLabel || 'Origen';
    leg.hasta = nextLeg ? nextLeg.desde : destShortLabel || 'Destino';
  }

  // Fallback polyline if only overall encodedPolyline was provided
  if (polylines.length === 0 && rawRoute.polyline?.encodedPolyline) {
    polylines.push({
      encodedPolyline: rawRoute.polyline.encodedPolyline,
      modo: 'caminata',
      colorHex: '#0F5257',
      label: travelModeUsed === 'WALK' ? 'Recorrido a pie' : 'Trayecto completo',
    });
  }

  return {
    legs,
    polylines,
    walkMeters,
    transfers: Math.max(0, transitLegCount - 1),
    usedModes,
    hasKnownNoElevatorStation: knownNoElevatorStationNames.length > 0,
    knownNoElevatorStationNames: Array.from(new Set(knownNoElevatorStationNames)),
    departureTimeStr: firstDeparture,
    arrivalTimeStr: lastArrival,
  };
}

function buildRouteTitle(legs: RouteLeg[], travelModeUsed: 'TRANSIT' | 'WALK'): string {
  if (travelModeUsed === 'WALK') {
    return 'Recorrido exclusivamente a pie';
  }
  const transitLabels = legs
    .filter((l) => l.modo !== 'caminata')
    .map((l) => l.linea || l.modo);
  if (transitLabels.length === 0) {
    return 'Tramo peatonal directo';
  }
  return transitLabels.join(' + ');
}

function buildRouteSummary(legs: RouteLeg[], durationMin: number, walkMeters: number, transfers: number): string {
  const transitParts = legs
    .filter((l) => l.modo !== 'caminata')
    .map((l) => `${l.linea} (${l.desde} → ${l.hasta})`);
  if (transitParts.length === 0) {
    return `Trayecto a pie de ${walkMeters} m (${durationMin} min estimados).`;
  }
  return `${transitParts.join(' · ')}. ${walkMeters} m a pie, ${transfers} transbordo(s).`;
}

function buildTransitSequenceSignature(route: CandidateRoute): string {
  const transitParts = route.legs
    .filter((l) => l.modo !== 'caminata')
    .map((l) => {
      const lineKey = normalizeText(l.lineaCorta || l.linea || l.modo);
      const fromKey = normalizeText(l.desde);
      const toKey = normalizeText(l.hasta);
      return `${l.modo}:${lineKey}:${fromKey}->${toKey}`;
    });
  return `${route.travelModeUsed}|${transitParts.join('||')}`;
}

function areRoutesMateriallyEquivalent(a: CandidateRoute, b: CandidateRoute): boolean {
  if (a.travelModeUsed !== b.travelModeUsed) return false;

  const sigA = buildTransitSequenceSignature(a);
  const sigB = buildTransitSequenceSignature(b);

  if (sigA !== sigB) return false;

  // For pure WALK routes, only merge if exact geometry matches OR walk distance and overall polyline match closely
  if (a.travelModeUsed === 'WALK' || a.legs.every((l) => l.modo === 'caminata')) {
    if (a.overallEncodedPolyline && b.overallEncodedPolyline) {
      return a.overallEncodedPolyline === b.overallEncodedPolyline;
    }
    return Math.abs(a.walkMeters - b.walkMeters) <= 40 && a.legs.length === b.legs.length;
  }

  // Same transit lines + exact same boarding & alighting stops + same transfer sequence:
  // check if walking distances are materially equivalent (<= 80m diff) and same walk leg count
  const walkLegsA = a.legs.filter((l) => l.modo === 'caminata').length;
  const walkLegsB = b.legs.filter((l) => l.modo === 'caminata').length;
  if (Math.abs(a.walkMeters - b.walkMeters) <= 80 && walkLegsA === walkLegsB) {
    return true;
  }

  // If overall encoded polyline is literally identical, they are the exact same physical path
  if (a.overallEncodedPolyline && b.overallEncodedPolyline && a.overallEncodedPolyline === b.overallEncodedPolyline) {
    return true;
  }

  return false;
}

function pickBetterEquivalentRoute(currentBest: CandidateRoute, candidate: CandidateRoute): CandidateRoute {
  // Prefer route that satisfies constraints
  if (candidate.constraintsSatisfied !== currentBest.constraintsSatisfied) {
    return candidate.constraintsSatisfied ? candidate : currentBest;
  }
  // Prefer shorter duration
  if (candidate.durationMin !== currentBest.durationMin) {
    return candidate.durationMin < currentBest.durationMin ? candidate : currentBest;
  }
  // Prefer shorter walking distance
  if (candidate.walkMeters !== currentBest.walkMeters) {
    return candidate.walkMeters < currentBest.walkMeters ? candidate : currentBest;
  }
  // Prefer richer polylines / instructions
  if (candidate.polylines.length !== currentBest.polylines.length) {
    return candidate.polylines.length > currentBest.polylines.length ? candidate : currentBest;
  }
  return currentBest;
}

export function deduplicateCandidateRoutes(routes: CandidateRoute[]): {
  uniqueRoutes: CandidateRoute[];
  removedCount: number;
} {
  const uniqueRoutes: CandidateRoute[] = [];
  for (const cand of routes) {
    const existingIdx = uniqueRoutes.findIndex((existing) => areRoutesMateriallyEquivalent(existing, cand));
    if (existingIdx === -1) {
      uniqueRoutes.push(cand);
    } else {
      uniqueRoutes[existingIdx] = pickBetterEquivalentRoute(uniqueRoutes[existingIdx], cand);
    }
  }
  return {
    uniqueRoutes,
    removedCount: Math.max(0, routes.length - uniqueRoutes.length),
  };
}

export function extractSubteStationsToCheck(legs: RouteLeg[]): SubteStationCheckSummary | undefined {
  const subteIndices: number[] = [];
  for (let i = 0; i < legs.length; i++) {
    if (legs[i].modo === 'subte') {
      subteIndices.push(i);
    }
  }
  if (subteIndices.length === 0) return undefined;

  const ingreso: string[] = [];
  const combinacion: string[] = [];
  const egreso: string[] = [];

  for (let k = 0; k < subteIndices.length; k++) {
    const idx = subteIndices[k];
    const curr = legs[idx];
    const prevIdx = k > 0 ? subteIndices[k - 1] : -1;
    const nextIdx = k < subteIndices.length - 1 ? subteIndices[k + 1] : -1;

    const isAdjacentSubte = (startIdx: number, endIdx: number): boolean => {
      if (startIdx < 0 || endIdx < 0) return false;
      for (let m = startIdx + 1; m < endIdx; m++) {
        if (legs[m].modo !== 'caminata') return false;
      }
      return true;
    };

    const continuedFromPrevSubte = isAdjacentSubte(prevIdx, idx);
    const continuesToNextSubte = isAdjacentSubte(idx, nextIdx);

    if (!continuedFromPrevSubte && curr.desde) {
      ingreso.push(curr.desde);
    }

    if (continuesToNextSubte) {
      const nextSubte = legs[nextIdx];
      if (normalizeText(curr.hasta) === normalizeText(nextSubte.desde)) {
        combinacion.push(curr.hasta);
      } else {
        combinacion.push(`${curr.hasta} / ${nextSubte.desde}`);
      }
    } else if (curr.hasta) {
      egreso.push(curr.hasta);
    }
  }

  return {
    ingreso: Array.from(new Set(ingreso)),
    combinacion: Array.from(new Set(combinacion)),
    egreso: Array.from(new Set(egreso)),
  };
}

export function enrichRouteAccessibilityMetadata(
  route: CandidateRoute,
  isAccessContext: boolean
): CandidateRoute {
  const subteStationsToCheck = extractSubteStationsToCheck(route.legs);
  const enrichedLegs = route.legs.map((leg) => {
    if (leg.modo === 'colectivo' && !leg.busRampStatus) {
      const inferredStatus: RouteLeg['busRampStatus'] =
        route.isSynthetic && leg.estadoAccesibilidad === 'accesible_confirmado'
          ? 'verified_accessible'
          : 'unconfirmed';
      return {
        ...leg,
        busRampStatus: inferredStatus,
        accessibilityUncertaintyReason:
          leg.accessibilityUncertaintyReason ||
          (inferredStatus === 'verified_accessible'
            ? undefined
            : 'Rampa de la unidad: sin confirmar'),
      };
    }
    if (leg.modo === 'subte' && !leg.accessibilityUncertaintyReason) {
      if (leg.estadoAccesibilidad === 'no_accesible') {
        return {
          ...leg,
          accessibilityUncertaintyReason: `Estación sin acceso nivelado confirmado (${leg.desde} / ${leg.hasta})`,
        };
      }
      if (leg.estadoAccesibilidad !== 'accesible_confirmado') {
        return {
          ...leg,
          accessibilityUncertaintyReason: 'Accesibilidad de estaciones pendiente de confirmar',
        };
      }
    }
    return leg;
  });

  const hasBarrier =
    route.accessStatus === 'not_accessible' ||
    enrichedLegs.some((l) => l.modo === 'subte' && l.estadoAccesibilidad === 'no_accesible');

  let itineraryAccessCategory: ItineraryAccessCategory = route.itineraryAccessCategory || 'unverified_possible';
  if (hasBarrier) {
    itineraryAccessCategory = 'barrier_confirmed';
  } else if (route.itineraryAccessCategory === 'filtered_out') {
    itineraryAccessCategory = 'filtered_out';
  } else if (route.accessStatus === 'verified' && route.constraintsSatisfied) {
    itineraryAccessCategory = 'accessible_verified';
  } else if (!route.constraintsSatisfied && route.disqualificationReasons.length > 0 && route.accessStatus === 'verified') {
    itineraryAccessCategory = 'filtered_out';
  } else {
    itineraryAccessCategory = route.accessStatus === 'verified' ? 'accessible_verified' : 'unverified_possible';
  }

  return {
    ...route,
    legs: enrichedLegs,
    tramos: enrichedLegs,
    accessibilityContextActive: isAccessContext,
    itineraryAccessCategory,
    subteStationsToCheck,
  };
}

function evaluateRouteConstraints(
  route: CandidateRoute,
  constraints: TravelConstraints,
  isAccessContext: boolean
): CandidateRoute {
  const usedModes = new Set<AvoidableTransitMode>();
  let hasKnownNoElevator = false;
  const knownNoElevatorNames: string[] = [];

  for (const leg of route.legs) {
    const avoidKey = mapModeToAvoidKey(leg.modo);
    if (avoidKey) usedModes.add(avoidKey);
    if (leg.modo === 'subte' && leg.estadoAccesibilidad === 'no_accesible') {
      hasKnownNoElevator = true;
      knownNoElevatorNames.push(`${leg.desde} / ${leg.hasta}`);
    }
  }

  const nonAccessReasons: string[] = [];
  const avoidModes = constraints.avoidModes || [];
  if (avoidModes.includes('bus') && usedModes.has('bus')) {
    nonAccessReasons.push('Incluye tramo en colectivo, pero activaste evitar colectivo.');
  }
  if (avoidModes.includes('subte') && usedModes.has('subte')) {
    nonAccessReasons.push('Incluye tramo en Subte, pero activaste evitar subte.');
  }
  if (avoidModes.includes('tren') && usedModes.has('tren')) {
    nonAccessReasons.push('Incluye tramo en tren, pero activaste evitar tren.');
  }

  if (constraints.soloCaminata && usedModes.size > 0) {
    nonAccessReasons.push('Incluye transporte público cuando activaste solo caminata.');
  }

  if (constraints.maxCaminataMetros !== null && route.walkMeters > constraints.maxCaminataMetros) {
    nonAccessReasons.push(
      `Supera la caminata máxima configurada (${route.walkMeters} m frente a ${constraints.maxCaminataMetros} m).`
    );
  }
  if (constraints.maxTransbordos !== null && route.transfers > constraints.maxTransbordos) {
    nonAccessReasons.push(
      `Requiere ${route.transfers} transbordo(s), por encima del tope de ${constraints.maxTransbordos}.`
    );
  }

  const accessReasons: string[] = [];
  let itineraryAccessCategory: ItineraryAccessCategory = 'unverified_possible';
  const hasBarrier = hasKnownNoElevator || route.accessStatus === 'not_accessible';

  if (hasBarrier) {
    itineraryAccessCategory = 'barrier_confirmed';
  } else if (nonAccessReasons.length > 0) {
    itineraryAccessCategory = 'filtered_out';
  } else if (route.accessStatus === 'verified') {
    itineraryAccessCategory = 'accessible_verified';
  } else {
    itineraryAccessCategory = 'unverified_possible';
  }

  // Las restricciones obligatorias de accesibilidad nunca aprueban una ruta sin verificación.
  if (constraints.requiereAscensorConfirmado || constraints.evitarEscaleras) {
    if (hasBarrier) {
      accessReasons.push(
        `Barrera de accesibilidad confirmada (${knownNoElevatorNames.join(', ') || 'tramo sin elevación accesible'}).`
      );
    } else if (route.accessStatus !== 'verified') {
      accessReasons.push(
        'Accesibilidad de estaciones o unidades pendiente de confirmar en tiempo real.'
      );
    }
  }

  const uniqueReasons = Array.from(new Set([...nonAccessReasons, ...accessReasons]));
  const ok = uniqueReasons.length === 0;
  const subteStationsToCheck = extractSubteStationsToCheck(route.legs);

  return enrichRouteAccessibilityMetadata(
    {
      ...route,
      constraintsSatisfied: ok,
      cumpleRestricciones: ok,
      disqualificationReasons: uniqueReasons,
      motivosIncumplimiento: uniqueReasons,
      esRecomendada: false,
      recommendationReasons: [],
      motivosRecomendacion: [],
      itineraryAccessCategory,
      subteStationsToCheck,
    },
    isAccessContext
  );
}

/**
 * Evaluates hard constraints, deduplicates equivalent itineraries,
 * normalizes min-max ONLY over viable routes, and selects up to 3 distinct routes.
 */
export function evaluateDeduplicateAndRankRoutes(
  rawCandidates: CandidateRoute[],
  constraints: TravelConstraints,
  preference: PreferenceMode,
  options?: { accessibilityRequested?: boolean }
): {
  presentedRoutes: CandidateRoute[];
  ningunaCumpleRestricciones: boolean;
  stats: {
    originalCount: number;
    dedupedCount: number;
    removedDuplicatesCount: number;
    viableCount: number;
    presentedCount: number;
  };
} {
  const originalCount = rawCandidates.length;
  const isAccessContext = Boolean(
    options?.accessibilityRequested ||
      constraints.evitarEscaleras ||
      constraints.requiereAscensorConfirmado ||
      preference === 'mayor_accesibilidad'
  );

  // Evaluate constraints before dedup so dedup prefers constraint-compliant representatives
  const evaluated = rawCandidates.map((r) => evaluateRouteConstraints(r, constraints, isAccessContext));
  const { uniqueRoutes, removedCount } = deduplicateCandidateRoutes(evaluated);

  const viableRoutes = uniqueRoutes.filter((r) => r.constraintsSatisfied);
  const nonViableRoutes = uniqueRoutes.filter((r) => !r.constraintsSatisfied);

  const WEIGHTS: Record<PreferenceMode, { dur: number; walk: number; trans: number; acc: number }> = {
    balanceado: { dur: 0.35, walk: 0.25, trans: 0.25, acc: 0.15 },
    menor_duracion: { dur: 0.65, walk: 0.1, trans: 0.15, acc: 0.1 },
    menos_caminata: { dur: 0.15, walk: 0.6, trans: 0.15, acc: 0.1 },
    menos_transbordos: { dur: 0.2, walk: 0.1, trans: 0.6, acc: 0.1 },
    mayor_accesibilidad: { dur: 0.15, walk: 0.25, trans: 0.15, acc: 0.45 },
  };
  const w = WEIGHTS[preference];
  const norm = (val: number, min: number, max: number) => (max === min ? 0 : (val - min) / (max - min));

  if (viableRoutes.length > 0) {
    // Min-Max normalization ONLY over viable routes
    const minDur = Math.min(...viableRoutes.map((r) => r.durationMin));
    const maxDur = Math.max(...viableRoutes.map((r) => r.durationMin));
    const minWalk = Math.min(...viableRoutes.map((r) => r.walkMeters));
    const maxWalk = Math.max(...viableRoutes.map((r) => r.walkMeters));
    const minTrans = Math.min(...viableRoutes.map((r) => r.transfers));
    const maxTrans = Math.max(...viableRoutes.map((r) => r.transfers));

    for (const r of viableRoutes) {
      const nDur = norm(r.durationMin, minDur, maxDur);
      const nWalk = norm(r.walkMeters, minWalk, maxWalk);
      const nTrans = norm(r.transfers, minTrans, maxTrans);
      const nAcc = r.accessStatus === 'verified' ? 0 : r.accessStatus === 'unverified' ? 0.5 : 1.0;
      const score = Number((nDur * w.dur + nWalk * w.walk + nTrans * w.trans + nAcc * w.acc).toFixed(4));
      r.rankingScore = score;
      r.puntajePonderado = score;
    }

    viableRoutes.sort((a, b) => {
      const diff = (a.rankingScore ?? 0) - (b.rankingScore ?? 0);
      if (Math.abs(diff) > 1e-6) return diff;
      if (a.durationMin !== b.durationMin) return a.durationMin - b.durationMin;
      return a.walkMeters - b.walkMeters;
    });

    // Concise 1-sentence natural justification (NO numeric score / NO normalization jargon)
    const best = viableRoutes[0];
    best.esRecomendada = true;
    let bestReason = 'Ofrece el mejor equilibrio general entre tiempo, caminata y transbordos.';
    if (viableRoutes.length === 1) {
      bestReason = 'Es la única alternativa disponible que respeta tus restricciones actuales.';
    } else if (preference === 'menor_duracion' && best.durationMin === minDur) {
      bestReason = `Es la alternativa más rápida disponible (${best.durationMin} min estimados).`;
    } else if (preference === 'menos_caminata' && best.walkMeters === minWalk) {
      bestReason = `Es la alternativa con menor caminata total (${best.walkMeters} m).`;
    } else if (preference === 'menos_transbordos' && best.transfers === minTrans) {
      bestReason =
        best.transfers === 0
          ? 'Permite hacer todo el trayecto en un único servicio directo.'
          : `Es la opción con menos transbordos (${best.transfers}).`;
    } else if (preference === 'mayor_accesibilidad') {
      bestReason =
        'Prioriza menor caminata y menos barreras conocidas; revisá los puntos a confirmar en el detalle.';
    }
    best.recommendationReasons = [bestReason];
    best.motivosRecomendacion = [bestReason];

    const presentedRoutes = viableRoutes.slice(0, 3);
    console.info(
      `[RUMA][Routing] original=${originalCount} deduped=${uniqueRoutes.length} removedDuplicates=${removedCount} viable=${viableRoutes.length} presented=${presentedRoutes.length}`
    );

    return {
      presentedRoutes,
      ningunaCumpleRestricciones: false,
      stats: {
        originalCount,
        dedupedCount: uniqueRoutes.length,
        removedDuplicatesCount: removedCount,
        viableCount: viableRoutes.length,
        presentedCount: presentedRoutes.length,
      },
    };
  }

  // Zero viable routes: prioritize possible routes pending accessibility confirmation
  // BEFORE routes failing other filters or routes with confirmed physical barriers.
  const categoryRank = (cat?: ItineraryAccessCategory): number => {
    switch (cat) {
      case 'unverified_possible':
        return 0;
      case 'filtered_out':
        return 1;
      case 'barrier_confirmed':
        return 2;
      default:
        return 3;
    }
  };

  nonViableRoutes.sort((a, b) => {
    const rankDiff = categoryRank(a.itineraryAccessCategory) - categoryRank(b.itineraryAccessCategory);
    if (rankDiff !== 0) return rankDiff;
    if (a.disqualificationReasons.length !== b.disqualificationReasons.length) {
      return a.disqualificationReasons.length - b.disqualificationReasons.length;
    }
    if (a.durationMin !== b.durationMin) return a.durationMin - b.durationMin;
    return a.walkMeters - b.walkMeters;
  });

  const presentedExcluded = nonViableRoutes.slice(0, 3);
  console.info(
    `[RUMA][Routing] original=${originalCount} deduped=${uniqueRoutes.length} removedDuplicates=${removedCount} viable=0 presentedExcluded=${presentedExcluded.length}`
  );

  return {
    presentedRoutes: presentedExcluded,
    ningunaCumpleRestricciones: true,
    stats: {
      originalCount,
      dedupedCount: uniqueRoutes.length,
      removedDuplicatesCount: removedCount,
      viableCount: 0,
      presentedCount: presentedExcluded.length,
    },
  };
}

export interface RealRoutePlanResult {
  ok: boolean;
  mode: 'real';
  resolvedOrigin?: GeocodedPlaceSummary;
  resolvedDestination?: GeocodedPlaceSummary;
  momentLabel?: string;
  departureRfc3339?: string;
  routes: CandidateRoute[];
  ningunaCumpleRestricciones: boolean;
  error?: RouteQueryError;
  queriedAt: string;
}

export async function planRealCabaRoutes(params: {
  origen: string;
  destino: string;
  originPlaceId?: string;
  destinationPlaceId?: string;
  timeSpec?: TripTimeSpec | string;
  momento?: string;
  constraints: TravelConstraints;
  preference: PreferenceMode;
  accessibilityRequested?: boolean;
}): Promise<RealRoutePlanResult> {
  const timeInfo = getBuenosAiresTime();
  const { origen, destino, originPlaceId, destinationPlaceId, timeSpec, momento, constraints, preference, accessibilityRequested } = params;

  try {
    // 1) Resolve time first so ambiguous natural phrases ask cleanly before billing Routes calls
    const resolvedTime = resolveBuenosAiresTripTime(timeSpec || momento || 'ahora');
    if (resolvedTime.clarificationNeeded) {
      return {
        ok: false,
        mode: 'real',
        routes: [],
        ningunaCumpleRestricciones: true,
        queriedAt: timeInfo.iso,
        error: {
          code: 'NO_ROUTES',
          message: resolvedTime.clarificationQuestion || 'Necesito confirmar el horario exacto de tu viaje.',
          canOfferDemo: false,
        },
      };
    }

    // 2) Geocode origin & destination inside CABA
    const [originGeo, destGeo] = await Promise.all([
      geocodeCabaPlace(origen, originPlaceId),
      geocodeCabaPlace(destino, destinationPlaceId),
    ]);

    if (!originGeo.ok || !destGeo.ok) {
      const ambiguousCandidates: RouteQueryError['ambiguousCandidates'] = [];
      if (originGeo.ambiguousOptions) {
        ambiguousCandidates.push({ target: 'origin', options: originGeo.ambiguousOptions });
      }
      if (destGeo.ambiguousOptions) {
        ambiguousCandidates.push({ target: 'destination', options: destGeo.ambiguousOptions });
      }

      const firstErr = !originGeo.ok ? originGeo : destGeo;
      return {
        ok: false,
        mode: 'real',
        resolvedOrigin: originGeo.place || originGeo.outsideCabaPlace,
        resolvedDestination: destGeo.place || destGeo.outsideCabaPlace,
        routes: [],
        ningunaCumpleRestricciones: true,
        queriedAt: timeInfo.iso,
        error: {
          code: firstErr.errorCode || 'GEOCODE_NOT_FOUND',
          message:
            [!originGeo.ok ? originGeo.errorMessage : '', !destGeo.ok ? destGeo.errorMessage : '']
              .filter(Boolean)
              .join(' ') || 'No se pudieron localizar el origen o destino dentro de CABA.',
          canOfferDemo: false,
          ambiguousCandidates: ambiguousCandidates.length > 0 ? ambiguousCandidates : undefined,
          resolvedOrigin: originGeo.place || originGeo.outsideCabaPlace,
          resolvedDestination: destGeo.place || destGeo.outsideCabaPlace,
        },
      };
    }

    const originPlace = originGeo.place!;
    const destPlace = destGeo.place!;
    const originShort = shortPlaceName(originPlace);
    const destShort = shortPlaceName(destPlace);
    const travelModeToUse: 'TRANSIT' | 'WALK' = constraints.soloCaminata ? 'WALK' : 'TRANSIT';

    // 3) Call Google Routes API (process ALL raw routes before deduplication and constraint selection)
    const rawRoutes = await computeGoogleRoutes({
      origin: originPlace.location,
      destination: destPlace.location,
      travelMode: travelModeToUse,
      timeMode: resolvedTime.mode,
      departureTimeRfc3339: resolvedTime.rfc3339,
      preference,
      avoidModes: constraints.avoidModes,
    });

    if (rawRoutes.length === 0) {
      return {
        ok: false,
        mode: 'real',
        resolvedOrigin: originPlace,
        resolvedDestination: destPlace,
        momentLabel: resolvedTime.humanLabel,
        departureRfc3339: resolvedTime.rfc3339,
        routes: [],
        ningunaCumpleRestricciones: true,
        queriedAt: timeInfo.iso,
        error: {
          code: 'NO_ROUTES',
          message:
            'No encontramos recorridos de transporte público para ese origen, destino, horario y filtros.',
          canOfferDemo: true,
          resolvedOrigin: originPlace,
          resolvedDestination: destPlace,
        },
      };
    }

    // 4) Map ALL raw routes to RUMA CandidateRoute (NO early slice(0, 3)!)
    const mapped: CandidateRoute[] = rawRoutes.map((raw, idx): CandidateRoute => {
      const summary = summarizeStepsToLegs(raw, travelModeToUse, originShort, destShort);
      const totalDurationMin = Math.max(1, Math.round(parseDurationSeconds(raw.duration) / 60));
      const totalWalkMeters =
        travelModeToUse === 'WALK' ? raw.distanceMeters || summary.walkMeters : summary.walkMeters;

      const warnings: string[] = [];
      const limitations: string[] = [
        'Tiempos y recorridos estimados según Google Maps; pueden variar por operación del servicio.',
      ];

      if (travelModeToUse === 'WALK') {
        warnings.push(
          'Los recorridos peatonales pueden no reflejar rampas en esquina, veredas angostas u obras puntuales.'
        );
      }

      if (raw.travelAdvisory?.routeRestrictionsPartiallyIgnored) {
        warnings.push('Algunas preferencias de medio de transporte no pudieron aplicarse por completo.');
      }

      const usesSubteOrTren = summary.usedModes.has('subte') || summary.usedModes.has('tren');
      let accessStatus: RouteAccessStatus = 'unverified';
      const datosDesconocidos: string[] = [];
      const notasAccesibilidad: string[] = [];

      if (summary.hasKnownNoElevatorStation) {
        accessStatus = 'not_accessible';
        notasAccesibilidad.push(
          `Estaciones sin ascensor conocido en el trayecto: ${summary.knownNoElevatorStationNames.join(', ')}.`
        );
      } else if (usesSubteOrTren) {
        accessStatus = 'unverified';
        datosDesconocidos.push(
          'Accesibilidad de estaciones pendiente de confirmar (consultar ascensores en EMOVA).'
        );
      } else if (summary.usedModes.has('bus')) {
        accessStatus = 'unverified';
        datosDesconocidos.push(
          'Rampa de la unidad: sin confirmar (sin dato verificado por unidad en tiempo real).'
        );
      } else {
        accessStatus = 'unverified';
        datosDesconocidos.push(
          'Estado de veredas y rampas en esquina sin confirmar.'
        );
      }

      const titulo = buildRouteTitle(summary.legs, travelModeToUse);
      const resumen = buildRouteSummary(
        summary.legs,
        totalDurationMin,
        totalWalkMeters,
        summary.transfers
      );

      return {
        routeId: `gmaps-route-${idx + 1}`,
        mode: 'real' as const,
        provider: 'google_routes_api' as const,
        provenance: 'api_google_maps' as const,
        sourceName: 'Google Maps',
        sourceUrl: 'https://maps.google.com/',
        queriedAt: timeInfo.iso,
        updatedAt: timeInfo.horaLocalCABA,
        isSynthetic: false,
        limitations,
        origin: {
          label: originPlace.displayName
            ? `${originPlace.displayName} (${originPlace.formattedAddress})`
            : originPlace.formattedAddress,
          location: originPlace.location,
        },
        destination: {
          label: destPlace.displayName
            ? `${destPlace.displayName} (${destPlace.formattedAddress})`
            : destPlace.formattedAddress,
          location: destPlace.location,
        },
        departureTime: summary.departureTimeStr || resolvedTime.humanLabel,
        arrivalTime: summary.arrivalTimeStr,
        durationMin: totalDurationMin,
        walkMeters: totalWalkMeters,
        transfers: summary.transfers,
        legs: summary.legs,
        polylines: summary.polylines,
        overallEncodedPolyline: raw.polyline?.encodedPolyline,
        viewport:
          raw.viewport?.low?.latitude !== undefined &&
          raw.viewport?.low?.longitude !== undefined &&
          raw.viewport?.high?.latitude !== undefined &&
          raw.viewport?.high?.longitude !== undefined
            ? {
                southwest: { lat: raw.viewport.low.latitude, lng: raw.viewport.low.longitude },
                northeast: { lat: raw.viewport.high.latitude, lng: raw.viewport.high.longitude },
              }
            : undefined,
        warnings,
        incidents: [],
        accessStatus,
        constraintsSatisfied: true,
        disqualificationReasons: [],
        rankingScore: 0,
        recommendationReasons: [],
        travelModeUsed: travelModeToUse,

        id: `gmaps-route-${idx + 1}`,
        titulo,
        resumen,
        duracionEstimadaMin: totalDurationMin,
        caminataTotalMetros: totalWalkMeters,
        transbordos: summary.transfers,
        tramos: summary.legs,
        cumpleRestricciones: true,
        motivosIncumplimiento: [],
        incidenciasRelacionadas: [],
        notasAccesibilidad,
        datosDesconocidos,
        puntajePonderado: 0,
        esRecomendada: false,
        motivosRecomendacion: [],
      };
    });

    // 5) Evaluate hard constraints, deduplicate equivalent routes, min-max score viable routes, and select up to 3
    const ranked = evaluateDeduplicateAndRankRoutes(mapped, constraints, preference, {
      accessibilityRequested,
    });

    return {
      ok: true,
      mode: 'real',
      resolvedOrigin: originPlace,
      resolvedDestination: destPlace,
      momentLabel: resolvedTime.humanLabel,
      departureRfc3339: resolvedTime.rfc3339,
      routes: ranked.presentedRoutes,
      ningunaCumpleRestricciones: ranked.ningunaCumpleRestricciones,
      queriedAt: timeInfo.iso,
    };
  } catch (err) {
    const provErr = err as GoogleProviderError;
    const code: RouteErrorCode = provErr.code || 'UPSTREAM_ERROR';
    return {
      ok: false,
      mode: 'real',
      routes: [],
      ningunaCumpleRestricciones: true,
      queriedAt: timeInfo.iso,
      error: {
        code,
        statusHttp: provErr.statusHttp,
        message: provErr.message || 'No se pudo consultar el servicio de rutas en este momento.',
        canOfferDemo: code === 'QUOTA_EXCEEDED' || code === 'AUTH_ERROR' || code === 'UPSTREAM_ERROR' || code === 'NO_API_KEY',
      },
    };
  }
}

export function getRealNetworkStatusRecords(): {
  services: TransitServiceStatus[];
  accessibility: StationAccessibilityRecord[];
  officialSourcesNotice: string;
} {
  const timeInfo = getBuenosAiresTime();
  const nowStr = timeInfo.horaLocalCABA;

  const services: TransitServiceStatus[] = [
    {
      id: 'real-subte-red',
      nombre: 'Subte Líneas A, B, C, D, E, H y Premetro',
      tipo: 'Subte',
      estado: 'desconocido',
      status: 'unverified',
      estadoEtiqueta: 'Estado no verificado (sin feed abierto)',
      detalle:
        'Sin conexión en tiempo real al parte de servicio de Emova / GCBA. Verificá el estado oficial en Emova antes de viajar.',
      afectaciones: [],
      fuente: 'EMOVA — Sitio oficial',
      sourceName: 'EMOVA — Sitio principal (Subte y Premetro)',
      sourceUrl: 'https://emova.com.ar/',
      proveniencia: 'informacion_no_disponible',
      provenance: 'informacion_no_disponible',
      queriedAt: timeInfo.iso,
      actualizadoEn: nowStr,
      isSynthetic: false,
      limitations: 'Sin conexión en tiempo real a Emova en este prototipo a costo cero.',
    },
    {
      id: 'real-colectivos-metrobus',
      nombre: 'Colectivos y corredores Metrobús CABA',
      tipo: 'Colectivo / Metrobús',
      estado: 'desconocido',
      status: 'unverified',
      estadoEtiqueta: 'Estado no verificado en tiempo real',
      detalle:
        'Los recorridos e itinerarios de transporte público se calculan con Google Maps, pero los desvíos espontáneos requieren consultar BA Cómo Llego.',
      afectaciones: [],
      fuente: 'BA Cómo Llego / GCBA Movilidad',
      sourceName: 'GCBA — BA Cómo Llego',
      sourceUrl: 'https://mapa.buenosaires.gob.ar/',
      proveniencia: 'informacion_no_disponible',
      provenance: 'informacion_no_disponible',
      queriedAt: timeInfo.iso,
      actualizadoEn: nowStr,
      isSynthetic: false,
      limitations: 'Google Maps no sustituye los partes de cortes municipales momentáneos.',
    },
    {
      id: 'real-trenes-caba',
      nombre: 'Trenes Metropolitanos en CABA (Mitre, Sarmiento, Roca, San Martín, Belgrano Norte/Sur)',
      tipo: 'Tren Urbano',
      estado: 'desconocido',
      status: 'unverified',
      estadoEtiqueta: 'Estado no verificado en tiempo real',
      detalle:
        'Horarios y combinaciones ferroviarias se consultan en Google Maps; demoras o cancelaciones puntuales deben confirmarse en Trenes Argentinos.',
      afectaciones: [],
      fuente: 'Trenes Argentinos',
      sourceName: 'Trenes Argentinos — Estado de líneas',
      sourceUrl: 'https://www.argentina.gob.ar/transporte/trenes-argentinos',
      proveniencia: 'informacion_no_disponible',
      provenance: 'informacion_no_disponible',
      queriedAt: timeInfo.iso,
      actualizadoEn: nowStr,
      isSynthetic: false,
      limitations: 'Sin telemetría ferroviaria en tiempo real en este prototipo.',
    },
  ];

  const accessibility: StationAccessibilityRecord[] = [
    {
      id: 'real-emova-elevators',
      estacion: 'Red de Subte (Ascensores y escaleras mecánicas)',
      linea: 'Líneas A, B, C, D, E, H',
      barrio: 'Toda CABA',
      ascensor: 'estado_desconocido',
      status: 'unverified',
      escaleraMecanica: 'desconocido',
      rampaAcceso: null,
      barrerasConocidas: [
        'Estaciones históricas (p. ej. Pasco, Alberti, Acoyte, Piedras, Lima, Uruguay, Callao) carecen de ascensor en uno o ambos andenes.',
        'Las escaleras mecánicas no garantizan acceso para personas en silla de ruedas.',
        'La disponibilidad operativa diaria de ascensores debe consultarse en EMOVA o al 0800-333-6682.',
      ],
      observaciones:
        'Accesibilidad operativa no verificada automáticamente. Ante movilidad reducida o prohibición estricta de escaleras, consultá el estado actualizado en EMOVA (0800-333-6682) antes de iniciar el viaje.',
      fuente: 'Emova — Accesibilidad en el Subte',
      sourceName: 'Emova — Accesibilidad',
      sourceUrl: EMOVA_ACCESSIBILITY_URL,
      proveniencia: 'informacion_no_disponible',
      provenance: 'informacion_no_disponible',
      queriedAt: timeInfo.iso,
      actualizadoEn: nowStr,
      isSynthetic: false,
      limitations: 'Google Maps no confirma si un ascensor de estación funciona hoy.',
    },
    {
      id: 'real-colectivos-rampas',
      estacion: 'Paradas y unidades de Colectivos / Metrobús en CABA',
      linea: 'Corredores y líneas urbanas',
      barrio: 'Toda CABA',
      ascensor: 'estado_desconocido',
      status: 'unverified',
      escaleraMecanica: 'no_posee',
      rampaAcceso: null,
      barrerasConocidas: [
        'Los paradores de Metrobús cuentan con acceso a nivel, pero la rampa de cada unidad de colectivo no está confirmada en vivo.',
      ],
      observaciones:
        'Rampa de la unidad: sin confirmar. Aunque el marco normativo exige flota adaptada, la disponibilidad efectiva de rampa operativa depende de cada unidad que arribe.',
      fuente: 'Buenos Aires Data / GCBA Movilidad',
      sourceName: 'Buenos Aires Data',
      sourceUrl: 'https://data.buenosaires.gob.ar/',
      proveniencia: 'informacion_no_disponible',
      provenance: 'informacion_no_disponible',
      queriedAt: timeInfo.iso,
      actualizadoEn: nowStr,
      isSynthetic: false,
      limitations: 'Sin telemetría en vivo ni GTFS actualizado sobre rampas por unidad de colectivo.',
    },
  ];

  return {
    services,
    accessibility,
    officialSourcesNotice:
      'Ningún servicio o ascensor se presenta como operativo confirmado sin fuente en vivo verificada; ante movilidad reducida consultá Emova o BA Cómo Llego antes de salir.',
  };
}
