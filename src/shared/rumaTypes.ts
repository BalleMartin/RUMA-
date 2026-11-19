export type AppMode = 'real' | 'demo';

export type DataProvenance =
  | 'informacion_confirmada'
  | 'api_google_maps'
  | 'informacion_historica'
  | 'estimacion_viaje'
  | 'prediccion_estadistica'
  | 'dato_simulado'
  | 'informacion_no_disponible';

export type PreferenceMode =
  | 'balanceado'
  | 'menor_duracion'
  | 'menos_caminata'
  | 'menos_transbordos'
  | 'mayor_accesibilidad';

export type AvoidableTransitMode = 'bus' | 'subte' | 'tren';

export interface TravelConstraints {
  evitarEscaleras: boolean;
  requiereAscensorConfirmado: boolean;
  maxCaminataMetros: number | null;
  maxTransbordos: number | null;
  avoidModes?: AvoidableTransitMode[];
  soloCaminata?: boolean;
}

export interface ScenarioFlags {
  linea_d_obras: boolean;
  linea_b_demora: boolean;
  ascensor_peru_fuera: boolean;
  corte_9dejulio: boolean;
  lluvia_intensa: boolean;
}

export type ServiceStatusLevel =
  | 'normal'
  | 'demora'
  | 'interrumpido'
  | 'desvio'
  | 'desconocido';

export interface TransitServiceStatus {
  id: string;
  nombre: string;
  tipo: 'Subte' | 'Premetro' | 'Colectivo / Metrobús' | 'Tren Urbano';
  estado: ServiceStatusLevel;
  status: 'verified' | 'unverified' | 'simulated';
  estadoEtiqueta: string;
  detalle: string;
  afectaciones: string[];
  fuente: string;
  sourceName: string;
  sourceUrl?: string;
  proveniencia: DataProvenance;
  provenance: DataProvenance;
  queriedAt: string;
  sourceUpdatedAt?: string;
  actualizadoEn: string;
  isSynthetic: boolean;
  limitations: string;
}

export type ElevatorStatus =
  | 'operativo_confirmado'
  | 'fuera_de_servicio'
  | 'estado_desconocido'
  | 'sin_ascensor';

export interface StationAccessibilityRecord {
  id: string;
  estacion: string;
  linea: string;
  barrio: string;
  ascensor: ElevatorStatus;
  status: 'verified' | 'unverified' | 'not_accessible' | 'simulated';
  escaleraMecanica: 'disponible' | 'fuera_de_servicio' | 'no_posee' | 'desconocido';
  rampaAcceso: boolean | null;
  barrerasConocidas: string[];
  observaciones: string;
  fuente: string;
  sourceName: string;
  sourceUrl?: string;
  proveniencia: DataProvenance;
  provenance: DataProvenance;
  queriedAt: string;
  sourceUpdatedAt?: string;
  actualizadoEn: string;
  isSynthetic: boolean;
  limitations: string;
}

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface RoutePolylineSegment {
  encodedPolyline: string;
  modo: 'caminata' | 'subte' | 'colectivo' | 'tren';
  colorHex?: string;
  label?: string;
}

export interface RouteLeg {
  modo: 'caminata' | 'subte' | 'colectivo' | 'tren';
  linea?: string;
  lineaCorta?: string;
  agencia?: string;
  cabecera?: string;
  cantidadParadas?: number;
  vehicleType?: string;
  desde: string;
  hasta: string;
  horaSalida?: string;
  horaLlegada?: string;
  duracionMin: number;
  distanciaMetros?: number;
  requiereEscaleras: boolean;
  estadoAccesibilidad: 'accesible_confirmado' | 'accesible_con_reservas' | 'estado_desconocido' | 'no_accesible';
  notas: string;
  ramal?: string;
  busRampStatus?: 'verified_accessible' | 'verified_not_accessible' | 'unconfirmed';
  accessibilityUncertaintyReason?: string;
  encodedPolyline?: string;
  startLocation?: LatLngLiteral;
  endLocation?: LatLngLiteral;
}

export type RouteAccessStatus = 'verified' | 'unverified' | 'not_accessible';

export interface SubteStationCheckSummary {
  ingreso: string[];
  combinacion: string[];
  egreso: string[];
}

export type ItineraryAccessCategory =
  | 'accessible_verified'
  | 'unverified_possible'
  | 'barrier_confirmed'
  | 'filtered_out';

export interface GeocodedPlaceSummary {
  query: string;
  formattedAddress: string;
  displayName?: string;
  location: LatLngLiteral;
  placeId?: string;
  isInsideCaba: boolean;
  localitySummary?: string;
}

export interface CandidateRoute {
  // Standardized contract fields (Section 7 of spec)
  routeId: string;
  mode: AppMode;
  provider: 'google_routes_api' | 'ruma_demo_engine';
  provenance: DataProvenance;
  sourceName: string;
  sourceUrl?: string;
  queriedAt: string;
  updatedAt?: string;
  validUntil?: string;
  isSynthetic: boolean;
  limitations: string[];
  origin: {
    label: string;
    location?: LatLngLiteral;
  };
  destination: {
    label: string;
    location?: LatLngLiteral;
  };
  departureTime: string;
  arrivalTime?: string;
  durationMin: number;
  walkMeters: number;
  transfers: number;
  legs: RouteLeg[];
  polylines: RoutePolylineSegment[];
  overallEncodedPolyline?: string;
  viewport?: {
    southwest: LatLngLiteral;
    northeast: LatLngLiteral;
  };
  warnings: string[];
  incidents: string[];
  accessStatus: RouteAccessStatus;
  accessibilityContextActive?: boolean;
  itineraryAccessCategory?: ItineraryAccessCategory;
  subteStationsToCheck?: SubteStationCheckSummary;
  constraintsSatisfied: boolean;
  disqualificationReasons: string[];
  rankingScore?: number;
  recommendationReasons: string[];
  travelModeUsed: 'TRANSIT' | 'WALK' | 'DEMO';

  // Compatible Spanish fields used by existing UI / tests
  id: string;
  titulo: string;
  resumen: string;
  duracionEstimadaMin: number;
  caminataTotalMetros: number;
  transbordos: number;
  tramos: RouteLeg[];
  cumpleRestricciones: boolean;
  motivosIncumplimiento: string[];
  incidenciasRelacionadas: string[];
  notasAccesibilidad: string[];
  datosDesconocidos: string[];
  puntajePonderado: number;
  esRecomendada: boolean;
  motivosRecomendacion: string[];
}

export type RouteErrorCode =
  | 'NO_API_KEY'
  | 'AUTH_ERROR'
  | 'QUOTA_EXCEEDED'
  | 'OUTSIDE_CABA'
  | 'GEOCODE_NOT_FOUND'
  | 'AMBIGUOUS_LOCATION'
  | 'NO_ROUTES'
  | 'UPSTREAM_ERROR';

export interface RouteQueryError {
  code: RouteErrorCode;
  message: string;
  canOfferDemo: boolean;
  statusHttp?: number;
  ambiguousCandidates?: Array<{
    target: 'origin' | 'destination';
    options: GeocodedPlaceSummary[];
  }>;
  resolvedOrigin?: GeocodedPlaceSummary;
  resolvedDestination?: GeocodedPlaceSummary;
}

export type TripTimeMode = 'ahora' | 'departure' | 'arrival';

export interface TripTimeSpec {
  mode: TripTimeMode;
  date?: string; // YYYY-MM-DD in America/Argentina/Buenos_Aires
  time?: string; // HH:mm in America/Argentina/Buenos_Aires
  rawText?: string;
  humanLabel?: string;
  clarificationNeeded?: boolean;
  clarificationQuestion?: string;
}

export interface TripState {
  originQuery: string;
  originConfirmed?: GeocodedPlaceSummary | null;
  destinationQuery: string;
  destinationConfirmed?: GeocodedPlaceSummary | null;
  timeSpec: TripTimeSpec;
  constraints: TravelConstraints;
  preference: PreferenceMode;
  pendingClarification?: string | null;
}

export interface RecentPlaceEntry {
  label: string;
  formattedAddress: string;
  displayName?: string;
  placeId?: string;
  location: LatLngLiteral;
  localitySummary?: string;
  savedAt: string;
}

export interface ToolTraceEntry {
  toolName: string;
  args: Record<string, unknown>;
  provenance: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mode?: AppMode;
  isSimulatedData?: boolean;
  toolTrace?: ToolTraceEntry[];
  routes?: CandidateRoute[];
  routeError?: RouteQueryError;
  accessibilityRequested?: boolean;
  error?: boolean;
}

export interface RumaChatRequest {
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  message: string;
  mode: AppMode;
  constraints: TravelConstraints;
  preference: PreferenceMode;
  scenarioFlags: ScenarioFlags;
  tripState?: TripState;
  cachedRoutes?: CandidateRoute[];
}

export interface RumaChatResponse {
  reply: string;
  mode: AppMode;
  isSimulatedData: boolean;
  toolTrace: ToolTraceEntry[];
  routes?: CandidateRoute[];
  routeError?: RouteQueryError;
  horaConsultaCABA: string;
  updatedTripState?: TripState;
  rerankedOnly?: boolean;
  clarificationQuestion?: string | null;
  accessibilityRequested?: boolean;
}

