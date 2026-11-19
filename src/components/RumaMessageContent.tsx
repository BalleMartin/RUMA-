import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  HelpCircle,
  MapPin,
  XCircle,
} from 'lucide-react';
import type {
  CandidateRoute,
  RouteQueryError,
  ToolTraceEntry,
} from '../shared/rumaTypes';
import { RouteCardsList } from './RouteCardsList';

interface RumaMessageContentProps {
  content: string;
  routes?: CandidateRoute[];
  selectedRouteId?: string | null;
  onSelectRoute?: (routeId: string) => void;
  routeError?: RouteQueryError;
  toolTrace?: ToolTraceEntry[];
  isSimulatedData?: boolean;
  accessibilityRequested?: boolean;
  onSelectFollowUp?: (text: string) => void;
  onEnableDemoAndRetry?: () => void;
}

const KNOWN_HEADINGS = new Set([
  'ESCENARIO SIMULADO — DATOS DE DEMOSTRACIÓN.',
  'ESCENARIO SIMULADO — DATOS DE DEMOSTRACIÓN',
  'Tu viaje',
  'Estado de los servicios',
  'Estado de fuentes e incidencias',
  'Alternativa recomendada',
  'Limitación de restricciones',
  'Otras alternativas',
  'Información de accesibilidad',
  'Fuente y actualización',
  '¿Querés ajustar algo?',
  'Limitación de consulta',
]);

function renderInlineFormatting(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic text-slate-800">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={idx} className="font-mono text-[13px] bg-slate-100 px-1 py-0.5 rounded text-slate-800">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function getToolLabel(name: string): string {
  switch (name) {
    case 'obtener_hora_actual_caba':
      return 'Hora oficial CABA (sistema)';
    case 'google_maps_routes_and_geocoding':
      return 'Google Maps (Geocoding / Places / Routes)';
    case 'reordenar_rutas_en_sesion':
      return 'Reordenamiento local por preferencia (sin nueva consulta externa)';
    case 'consultar_fuentes_oficiales_caba':
      return 'Fuentes oficiales CABA';
    case 'planificar_rutas_caba_demo':
      return 'Motor sintético DEMO (14 nodos)';
    case 'consultar_escenario_demo':
      return 'Escenario simulado DEMO';
    default:
      return name;
  }
}

export function RumaMessageContent({
  content,
  routes,
  selectedRouteId = null,
  onSelectRoute,
  routeError,
  toolTrace,
  isSimulatedData,
  accessibilityRequested = false,
  onSelectFollowUp,
  onEnableDemoAndRetry,
}: RumaMessageContentProps) {
  const [showRoutesTable, setShowRoutesTable] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  const lines = content.split('\n');

  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-slate-700">
      {/* Structured Route Cards rendered interactively right in the response */}
      {routes && routes.length > 0 && onSelectRoute && (
        <RouteCardsList
          routes={routes}
          selectedRouteId={selectedRouteId}
          onSelectRoute={onSelectRoute}
          accessibilityRequested={accessibilityRequested}
        />
      )}

      {/* Structured Route Error / Disambiguation / Opt-in DEMO offer */}
      {routeError && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3.5 space-y-2.5 text-xs text-amber-950">
          <div className="flex items-start gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{routeError.message}</span>
          </div>

          {routeError.ambiguousCandidates && routeError.ambiguousCandidates.length > 0 && onSelectFollowUp && (
            <div className="space-y-2 pt-1">
              {routeError.ambiguousCandidates.map((group) => (
                <div key={group.target} className="space-y-1.5">
                  <div className="font-medium text-slate-800">
                    Elegí el {group.target === 'origin' ? 'origen' : 'destino'} exacto:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.options.map((opt, oIdx) => (
                      <button
                        key={opt.placeId || oIdx}
                        type="button"
                        onClick={() =>
                          onSelectFollowUp(
                            group.target === 'origin'
                              ? `Usá como origen exacto "${opt.formattedAddress}"${
                                  routeError.resolvedDestination
                                    ? ` hacia "${routeError.resolvedDestination.formattedAddress}"`
                                    : ''
                                }`
                              : `Usá como destino exacto "${opt.formattedAddress}"${
                                  routeError.resolvedOrigin
                                    ? ` desde "${routeError.resolvedOrigin.formattedAddress}"`
                                    : ''
                                }`
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] bg-white border border-slate-300 hover:border-[#0F5257] rounded-lg text-slate-800 font-medium cursor-pointer"
                      >
                        <MapPin className="w-3 h-3 text-[#0F5257]" aria-hidden="true" />
                        <span>{opt.formattedAddress}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {routeError.canOfferDemo && onEnableDemoAndRetry && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onEnableDemoAndRetry}
                className="px-3 py-1.5 min-h-[38px] bg-white border border-amber-400 hover:bg-amber-100/70 text-amber-950 font-semibold rounded-lg cursor-pointer"
              >
                Activar modo DEMO simulado manualmente
              </button>
            </div>
          )}
        </div>
      )}

      {/* Grounded natural-language explanation */}
      {content.trim().length > 0 && (
        <div className="space-y-2">
          {lines.map((rawLine, index) => {
            const line = rawLine.trim();
            if (!line) {
              return <div key={index} className="h-1" />;
            }

            const strippedSingleAsterisk =
              line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')
                ? line.slice(1, -1).trim()
                : null;
            const strippedDoubleAsterisk =
              line.startsWith('**') && line.endsWith('**')
                ? line.slice(2, -2).trim()
                : null;
            const strippedHash = line.startsWith('### ')
              ? line.slice(4).trim()
              : line.startsWith('## ')
              ? line.slice(3).trim()
              : null;

            const candidateHeading = strippedSingleAsterisk || strippedDoubleAsterisk || strippedHash;

            if (candidateHeading && candidateHeading.toUpperCase().includes('ESCENARIO SIMULADO')) {
              return (
                <div
                  key={index}
                  className="flex items-center gap-2 py-1.5 px-3 bg-amber-50/80 border border-amber-200/80 rounded-md text-xs font-medium text-amber-900"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
                  <span>{candidateHeading}</span>
                </div>
              );
            }

            if (candidateHeading && (KNOWN_HEADINGS.has(candidateHeading) || candidateHeading.length < 48)) {
              return (
                <h4
                  key={index}
                  className="pt-2 first:pt-0 text-sm font-semibold text-slate-900 tracking-tight border-b border-slate-100 pb-1"
                >
                  {candidateHeading}
                </h4>
              );
            }

            if (line.startsWith('- ') || line.startsWith('* ')) {
              return (
                <div key={index} className="flex items-start gap-2.5 pl-1">
                  <span className="mt-2 w-1 h-1 rounded-full bg-slate-400 shrink-0" aria-hidden="true" />
                  <p className="flex-1">{renderInlineFormatting(line.slice(2))}</p>
                </div>
              );
            }

            return <p key={index}>{renderInlineFormatting(line)}</p>;
          })}
        </div>
      )}

      {(routes && routes.length > 0) || (toolTrace && toolTrace.length > 0) ? (
        <div className="pt-2.5 mt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
          {routes && routes.length > 0 && (
            <button
              type="button"
              onClick={() => setShowRoutesTable((prev) => !prev)}
              className="inline-flex items-center gap-1.5 font-medium text-[#0F5257] hover:text-[#0b3e42] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {showRoutesTable ? (
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>Comparar opciones ({routes.length})</span>
            </button>
          )}

          {toolTrace && toolTrace.length > 0 && (
            <button
              type="button"
              onClick={() => setShowTrace((prev) => !prev)}
              className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Fuentes consultadas ({toolTrace.length})</span>
              {showTrace ? (
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
          )}

          <span className="text-[11px] text-slate-500">
            {isSimulatedData
              ? 'Modo DEMO (red académica simulada)'
              : 'Datos referenciales · Google Maps'}
          </span>
        </div>
      ) : null}

      {showRoutesTable && routes && routes.length > 0 && (
        <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden bg-slate-50/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-medium">
                  <th className="py-2.5 px-3">Alternativa</th>
                  <th className="py-2.5 px-3 text-right">Duración est.</th>
                  <th className="py-2.5 px-3 text-right">Caminata</th>
                  <th className="py-2.5 px-3 text-right">Transbordos</th>
                  <th className="py-2.5 px-3">Restricciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 bg-white">
                {routes.map((r) => (
                  <tr key={r.routeId || r.id} className={r.esRecomendada ? 'bg-[#0F5257]/[0.03]' : ''}>
                    <td className="py-2.5 px-3 align-top">
                      <div className="font-medium text-slate-900">
                        {r.titulo}
                        {r.esRecomendada && (
                          <span className="ml-2 text-[11px] font-semibold text-[#0F5257]">
                            · Recomendada
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 mt-0.5">{r.resumen}</div>
                      {r.motivosIncumplimiento.filter(
                        (m) => m !== 'Accesibilidad de estaciones o unidades pendiente de confirmar en tiempo real.'
                      ).length > 0 && (
                        <div className="text-red-700 mt-1">
                          Incumple:{' '}
                          {r.motivosIncumplimiento
                            .filter(
                              (m) =>
                                m !==
                                'Accesibilidad de estaciones o unidades pendiente de confirmar en tiempo real.'
                            )
                            .join(' ')}
                        </div>
                      )}
                      {(accessibilityRequested || r.accessibilityContextActive) &&
                        r.datosDesconocidos.length > 0 && (
                          <div className="text-slate-600 mt-1 flex items-start gap-1">
                            <HelpCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#0F5257]" aria-hidden="true" />
                            <span>{r.datosDesconocidos.join(' ')}</span>
                          </div>
                        )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap align-top">
                      {r.duracionEstimadaMin} min
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap align-top">
                      {r.caminataTotalMetros} m
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap align-top">
                      {r.transbordos}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap align-top">
                      {r.cumpleRestricciones ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          Cumple
                        </span>
                      ) : r.itineraryAccessCategory === 'unverified_possible' ? (
                        <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                          <HelpCircle className="w-3.5 h-3.5 text-[#0F5257]" aria-hidden="true" />
                          Pendiente de comprobación
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                          <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          Excluida
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {onSelectFollowUp && (
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center gap-3 text-xs">
              <span className="text-slate-500">Reevaluar priorizando:</span>
              <button
                type="button"
                onClick={() => onSelectFollowUp('¿Podés reevaluar priorizando menos caminata?')}
                className="text-[#0F5257] hover:underline font-medium cursor-pointer"
              >
                Menos caminata
              </button>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => onSelectFollowUp('¿Podés reevaluar priorizando menos transbordos?')}
                className="text-[#0F5257] hover:underline font-medium cursor-pointer"
              >
                Menos transbordos
              </button>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => onSelectFollowUp('¿Podés reevaluar priorizando menor duración estimada?')}
                className="text-[#0F5257] hover:underline font-medium cursor-pointer"
              >
                Menor duración
              </button>
            </div>
          )}
        </div>
      )}

      {showTrace && toolTrace && toolTrace.length > 0 && (
        <div className="mt-2 border border-slate-200 rounded-lg bg-slate-50/70 p-3 space-y-2 text-xs">
          <div className="font-medium text-slate-700">
            Registro de herramientas consultadas por el asistente
          </div>
          <div className="divide-y divide-slate-200/80">
            {toolTrace.map((entry, idx) => (
              <div key={idx} className="py-1.5 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="font-medium text-slate-900">{getToolLabel(entry.toolName)}</span>
                  <span className="text-slate-400 mx-1.5">·</span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {Object.keys(entry.args).length > 0
                      ? JSON.stringify(entry.args)
                      : 'sin parámetros'}
                  </span>
                </div>
                <div className="text-slate-500 font-mono text-[11px] tabular-nums">
                  {entry.provenance} · {entry.timestamp} ART
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
