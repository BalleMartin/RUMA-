import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Footprints,
  Info,
  MapPin,
  Phone,
  Repeat,
  XCircle,
} from 'lucide-react';
import type { CandidateRoute, RouteLeg } from '../shared/rumaTypes';

const EMOVA_ACCESSIBILITY_URL = 'https://emova.com.ar/index.php/accesibilidad/';
const EMOVA_ACCESSIBILITY_PHONE = '0800-333-6682';

const GENERIC_PENDING_DISQUALIFICATION =
  'Accesibilidad de estaciones o unidades pendiente de confirmar en tiempo real.';

interface RouteCardsListProps {
  routes: CandidateRoute[];
  selectedRouteId: string | null;
  onSelectRoute: (routeId: string) => void;
  accessibilityRequested?: boolean;
}

function formatLegBadge(leg: RouteLeg) {
  if (leg.modo === 'caminata') return 'A pie';
  if (leg.modo === 'subte') return leg.linea || 'Subte';
  if (leg.modo === 'tren') return leg.linea || 'Tren';
  return leg.linea || 'Colectivo';
}

function hasSubteLegs(route: CandidateRoute): boolean {
  return route.legs.some((l) => l.modo === 'subte');
}

function hasColectivoLegs(route: CandidateRoute): boolean {
  return route.legs.some((l) => l.modo === 'colectivo');
}

export function RouteCardsList({
  routes,
  selectedRouteId,
  onSelectRoute,
  accessibilityRequested = false,
}: RouteCardsListProps) {
  if (!routes || routes.length === 0) return null;

  const anyAccessContext =
    accessibilityRequested || routes.some((r) => Boolean(r.accessibilityContextActive));
  const noneSatisfied = routes.every((r) => !r.constraintsSatisfied);

  const unverifiedPossibleRoutes =
    anyAccessContext && noneSatisfied
      ? routes.filter((r) => r.itineraryAccessCategory === 'unverified_possible')
      : [];
  const remainingRoutes =
    anyAccessContext && noneSatisfied && unverifiedPossibleRoutes.length > 0
      ? routes.filter((r) => r.itineraryAccessCategory !== 'unverified_possible')
      : routes;

  const renderRouteCard = (route: CandidateRoute, idx: number, isPendingSection: boolean) => {
    const routeKey = route.routeId || route.id;
    const isSelected = selectedRouteId
      ? route.routeId === selectedRouteId || route.id === selectedRouteId
      : idx === 0;
    const isRecommended = route.esRecomendada && route.constraintsSatisfied;
    const shortReason = route.recommendationReasons[0];
    const showAccessibility = Boolean(accessibilityRequested || route.accessibilityContextActive);
    const usesSubte = hasSubteLegs(route);
    const usesColectivo = hasColectivoLegs(route);
    const isBarrierConfirmed =
      route.itineraryAccessCategory === 'barrier_confirmed' ||
      route.accessStatus === 'not_accessible';
    const isUnverifiedPending =
      !isBarrierConfirmed &&
      ((!route.constraintsSatisfied && route.itineraryAccessCategory === 'unverified_possible') ||
        (showAccessibility && route.accessStatus === 'unverified'));

    const statusBadgeText = isRecommended
      ? 'Opción recomendada'
      : isUnverifiedPending || isPendingSection
        ? 'Pendiente de comprobación'
        : !route.constraintsSatisfied
          ? isBarrierConfirmed
            ? 'Barrera confirmada'
            : 'No cumple filtros'
          : `Alternativa ${idx + 1}`;

    const statusBadgeClass = isRecommended
      ? 'bg-[#0F5257] text-white'
      : isUnverifiedPending || isPendingSection
        ? 'bg-slate-100 text-slate-700 border border-slate-200'
        : !route.constraintsSatisfied
          ? 'bg-red-100 text-red-900'
          : 'bg-slate-100 text-slate-800';

    const subteCheck = route.subteStationsToCheck;
    const unconfirmedBusLegs = route.legs.filter(
      (l) => l.modo === 'colectivo' && l.busRampStatus !== 'verified_accessible'
    );
    const visibleDisqualificationReasons = route.disqualificationReasons.filter(
      (reason) => !(isUnverifiedPending && reason === GENERIC_PENDING_DISQUALIFICATION)
    );

    return (
      <article
        key={routeKey}
        className={`rounded-xl border transition-colors overflow-hidden ${
          isSelected
            ? 'border-[#0F5257] bg-[#0F5257]/[0.04] ring-1 ring-[#0F5257]/30'
            : 'border-slate-200 bg-white hover:border-slate-300'
        }`}
      >
        <button
          type="button"
          onClick={() => onSelectRoute(routeKey)}
          aria-pressed={isSelected}
          className="w-full text-left p-3.5 sm:p-4 space-y-2.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0F5257]"
        >
          {/* Header row */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md ${statusBadgeClass}`}
                >
                  {(isUnverifiedPending || isPendingSection) && (
                    <Info className="w-3 h-3 text-[#0F5257] shrink-0" aria-hidden="true" />
                  )}
                  {isBarrierConfirmed && !route.constraintsSatisfied && (
                    <XCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
                  )}
                  <span>{statusBadgeText}</span>
                </span>
                {showAccessibility && route.accessStatus === 'verified' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span>Accesibilidad confirmada</span>
                  </span>
                )}
              </div>
              <div className="text-sm font-semibold text-slate-900">{route.titulo}</div>
            </div>

            {/* Key numeric metrics */}
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums text-slate-800 shrink-0">
              <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                <Clock className="w-3.5 h-3.5 text-[#0F5257]" aria-hidden="true" />
                {route.durationMin} min
              </span>
              <span className="inline-flex items-center gap-1">
                <Footprints className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                {route.walkMeters} m
              </span>
              <span className="inline-flex items-center gap-1">
                <Repeat className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                {route.transfers} transb.
              </span>
            </div>
          </div>

          {/* Legs summary */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            {route.legs.map((leg, lIdx) => (
              <div key={lIdx} className="space-y-0.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-slate-700">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] font-medium shrink-0 ${
                        leg.modo === 'caminata'
                          ? 'bg-slate-100 text-slate-700'
                          : leg.modo === 'subte'
                            ? 'bg-[#0F5257]/10 text-[#0F5257]'
                            : 'bg-blue-50 text-blue-800'
                      }`}
                    >
                      {formatLegBadge(leg)}
                    </span>
                    <span className="text-slate-800">
                      {leg.desde} → {leg.hasta}
                      {leg.ramal ? ` · ${leg.ramal}` : ''}
                      {leg.cabecera ? ` (hacia ${leg.cabecera})` : ''}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500 shrink-0">
                    {leg.duracionMin} min
                    {typeof leg.distanciaMetros === 'number' && leg.modo === 'caminata'
                      ? ` · ${leg.distanciaMetros} m`
                      : ''}
                    {leg.horaSalida ? ` · ${leg.horaSalida}` : ''}
                  </span>
                </div>

                {showAccessibility &&
                  leg.accessibilityUncertaintyReason &&
                  (leg.estadoAccesibilidad === 'no_accesible' ||
                    leg.modo === 'tren' ||
                    (!usesSubte && !usesColectivo && leg.modo === 'caminata')) && (
                    <div
                      className={`pl-1 text-[11px] ${
                        leg.estadoAccesibilidad === 'no_accesible'
                          ? 'text-red-700 font-medium'
                          : 'text-slate-600'
                      }`}
                    >
                      {leg.accessibilityUncertaintyReason}
                    </div>
                  )}
              </div>
            ))}
          </div>

          {/* Single concise natural justification */}
          {shortReason && (
            <div className="text-xs text-[#0F5257] font-medium">{shortReason}</div>
          )}

          {visibleDisqualificationReasons.length > 0 && (
            <div
              className={`text-xs rounded-lg px-2.5 py-1.5 border ${
                isUnverifiedPending
                  ? 'text-slate-700 bg-slate-50 border-slate-200'
                  : 'text-red-700 bg-red-50/70 border-red-200/80'
              }`}
            >
              {visibleDisqualificationReasons.join(' ')}
            </div>
          )}

          {route.warnings.length > 0 && (
            <div className="text-[11px] text-amber-900 bg-amber-50/80 border border-amber-200/80 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{route.warnings[0]}</span>
            </div>
          )}
        </button>

        {/* Contextual Secondary Accessibility Block (kept OUTSIDE route selection button so links are independent) */}
        {showAccessibility && (usesSubte || usesColectivo) && (
          <div className="mx-3.5 sm:mx-4 mb-2.5 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 space-y-2 text-xs text-slate-700">
            {usesSubte && (
              <div className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-[#0F5257] shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-1 leading-relaxed">
                    {subteCheck && (
                      <div className="text-[11px] text-slate-600 space-y-0.5">
                        {subteCheck.ingreso.length > 0 && (
                          <div>
                            <span className="font-medium text-slate-800">Ingreso:</span>{' '}
                            {subteCheck.ingreso.join(', ')}
                          </div>
                        )}
                        {subteCheck.combinacion.length > 0 && (
                          <div>
                            <span className="font-medium text-slate-800">Combinación:</span>{' '}
                            {subteCheck.combinacion.join(', ')}
                          </div>
                        )}
                        {subteCheck.egreso.length > 0 && (
                          <div>
                            <span className="font-medium text-slate-800">Egreso:</span>{' '}
                            {subteCheck.egreso.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-[11px] text-slate-600">
                      Las escaleras mecánicas no garantizan acceso en silla de ruedas; confirmá ascensores antes de salir.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-0.5 pl-5">
                  <a
                    href={EMOVA_ACCESSIBILITY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] rounded-md border border-[#0F5257]/30 bg-white text-[11px] font-semibold text-[#0F5257] hover:bg-[#0F5257]/5 transition-colors"
                  >
                    <span>Consultar estado de ascensores en EMOVA</span>
                    <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                  </a>
                  <a
                    href={`tel:${EMOVA_ACCESSIBILITY_PHONE.replace(/[^0-9]/g, '')}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] rounded-md border border-slate-300 bg-white text-[11px] font-medium text-slate-800 hover:bg-slate-100 transition-colors"
                  >
                    <Phone className="w-3 h-3 text-[#0F5257] shrink-0" aria-hidden="true" />
                    <span>{EMOVA_ACCESSIBILITY_PHONE}</span>
                  </a>
                </div>
              </div>
            )}

            {usesColectivo && unconfirmedBusLegs.length > 0 && (
              <div
                className={`flex items-start gap-2 ${
                  usesSubte ? 'pt-1.5 border-t border-slate-200/80' : ''
                }`}
              >
                <Info className="w-3.5 h-3.5 text-[#0F5257] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-[11px] text-slate-700 leading-relaxed">
                  <span className="font-medium text-slate-900">Rampa de la unidad: sin confirmar</span>
                  {' · '}
                  {unconfirmedBusLegs
                    .map((l) =>
                      [l.linea, l.ramal, l.cabecera ? `hacia ${l.cabecera}` : '']
                        .filter(Boolean)
                        .join(' · ')
                    )
                    .join(' / ')}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Discreet source & freshness footer */}
        <div className="px-3.5 sm:px-4 pb-3 pt-1.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" aria-hidden="true" />
            {route.isSynthetic ? 'Simulación académica (DEMO)' : 'Google Maps'}
          </span>
          <span className="font-mono tabular-nums">
            {route.arrivalTime
              ? `Llegada est. ${route.arrivalTime} · Datos referenciales`
              : `${route.departureTime} · Datos referenciales`}
          </span>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-3" role="region" aria-label="Opciones de ruta encontradas">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <span className="font-semibold text-slate-900">
          Opciones de viaje ({routes.length})
        </span>
        <span>Tocá una opción para ver su recorrido en el mapa</span>
      </div>

      {unverifiedPossibleRoutes.length > 0 ? (
        <div className="space-y-3">
          <div className="space-y-2.5">
            {unverifiedPossibleRoutes.map((route, idx) => renderRouteCard(route, idx, true))}
          </div>

          {remainingRoutes.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="text-xs font-medium text-slate-600">
                Con barrera confirmada o fuera de filtro ({remainingRoutes.length})
              </div>
              <div className="space-y-2.5">
                {remainingRoutes.map((route, idx) =>
                  renderRouteCard(route, unverifiedPossibleRoutes.length + idx, false)
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {routes.map((route, idx) => renderRouteCard(route, idx, false))}
        </div>
      )}
    </div>
  );
}


