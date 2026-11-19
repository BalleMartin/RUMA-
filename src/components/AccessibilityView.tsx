import { useState } from 'react';
import {
  Ban,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  MessageSquare,
  Phone,
  XCircle,
} from 'lucide-react';
import type { AppMode, ElevatorStatus, StationAccessibilityRecord } from '../shared/rumaTypes';

interface AccessibilityViewProps {
  mode: AppMode;
  records: StationAccessibilityRecord[];
  onSwitchMode: (next: AppMode) => void;
  onConsultStation: (stationName: string) => void;
}

function renderElevatorState(status: ElevatorStatus, isSynthetic: boolean) {
  switch (status) {
    case 'operativo_confirmado':
      return (
        <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{isSynthetic ? 'Operativo confirmado (demo)' : 'Operativo confirmado'}</span>
        </span>
      );
    case 'fuera_de_servicio':
      return (
        <span className="inline-flex items-center gap-1.5 text-red-700 font-medium">
          <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Fuera de servicio</span>
        </span>
      );
    case 'sin_ascensor':
      return (
        <span className="inline-flex items-center gap-1.5 text-red-700 font-medium">
          <Ban className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Sin ascensor (solo escaleras)</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-amber-800 font-medium">
          <HelpCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Accesibilidad operativa no verificada</span>
        </span>
      );
  }
}

export function AccessibilityView({
  mode,
  records,
  onSwitchMode,
  onConsultStation,
}: AccessibilityViewProps) {
  const [filter, setFilter] = useState<'todos' | ElevatorStatus>('todos');
  const [search, setSearch] = useState('');

  const filtered = records.filter((rec) => {
    const matchesState = filter === 'todos' || rec.ascensor === filter;
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      rec.estacion.toLowerCase().includes(q) ||
      rec.barrio.toLowerCase().includes(q) ||
      rec.linea.toLowerCase().includes(q);
    return matchesState && matchesSearch;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Registro de accesibilidad y medios de elevación
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            RUMA nunca asume que una estación es accesible por el solo hecho de figurar en un plano. Cuando no existe confirmación operativa en vivo de ascensores y escaleras mecánicas, lo informamos explícitamente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar estación o barrio..."
            aria-label="Buscar estación o barrio"
            className="text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 w-full sm:w-56 min-h-[42px] focus:outline-none focus:ring-2 focus:ring-[#0F5257]/30 focus:border-[#0F5257]"
          />

          <select
            aria-label="Filtrar por estado de ascensor"
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'todos' | ElevatorStatus)}
            className="text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-2 min-h-[42px] focus:outline-none focus:ring-2 focus:ring-[#0F5257]/30"
          >
            <option value="todos">Todos los estados</option>
            <option value="operativo_confirmado">Ascensor confirmado</option>
            <option value="estado_desconocido">Sin verificar</option>
            <option value="fuera_de_servicio">Fuera de servicio</option>
            <option value="sin_ascensor">Sin ascensor</option>
          </select>
        </div>
      </div>

      {/* Real vs Demo notice */}
      {mode === 'real' ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-800">
          <div className="space-y-1.5">
            <div className="font-semibold flex items-center gap-1.5 text-slate-900">
              <HelpCircle className="w-4 h-4 text-[#0F5257] shrink-0" aria-hidden="true" />
              <span>Accesibilidad operativa pendiente de confirmar (modo REAL)</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Las escaleras mecánicas no garantizan acceso en silla de ruedas y en colectivos el estado de la rampa de cada unidad figura sin confirmar en tiempo real. Verificá los ascensores antes de salir:
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <a
                href="https://emova.com.ar/index.php/accesibilidad/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] rounded-md border border-[#0F5257]/30 bg-white font-semibold text-[#0F5257] hover:bg-[#0F5257]/5 transition-colors"
              >
                <span>Consultar estado de ascensores en EMOVA</span>
                <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
              </a>
              <a
                href="tel:08003336682"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] rounded-md border border-slate-300 bg-white font-medium text-slate-800 hover:bg-slate-100 transition-colors"
              >
                <Phone className="w-3 h-3 text-[#0F5257] shrink-0" aria-hidden="true" />
                <span>0800-333-6682</span>
              </a>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSwitchMode('demo')}
            className="px-3 py-2 min-h-[40px] bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            Ver registro simulado (DEMO)
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
          <div>
            <strong>MODO DEMO ACTIVO:</strong> los estados mostrados corresponden a la red simulada de 14 nodos.
          </div>
          <button
            type="button"
            onClick={() => onSwitchMode('real')}
            className="px-3 py-2 min-h-[40px] bg-[#0F5257] text-white font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            Volver a modo REAL
          </button>
        </div>
      )}

      {/* Mobile card list */}
      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
            No hay registros que coincidan con la búsqueda.
          </div>
        ) : (
          filtered.map((rec) => (
            <article
              key={rec.id}
              className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{rec.estacion}</h2>
                  <p className="text-xs text-slate-500">
                    {rec.linea} · {rec.barrio}
                  </p>
                </div>
              </div>

              <div className="text-xs">{renderElevatorState(rec.ascensor, rec.isSynthetic)}</div>
              <p className="text-xs text-slate-600 leading-relaxed">{rec.observaciones}</p>
              {rec.barrerasConocidas.length > 0 && (
                <p className="text-xs text-slate-800">
                  Barreras registradas: {rec.barrerasConocidas.join(' · ')}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                {rec.sourceUrl ? (
                  <a
                    href={rec.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#0F5257] hover:underline"
                  >
                    <span>Consultar en EMOVA</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="text-[11px] text-slate-500">{rec.sourceName}</span>
                )}

                <button
                  type="button"
                  onClick={() => onConsultStation(rec.estacion)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-medium text-[#0F5257] bg-[#0F5257]/5 hover:bg-[#0F5257]/10 rounded-lg cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Evaluar acceso</span>
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Estación o nodo</th>
                <th className="py-3 px-4">Barrio</th>
                <th className="py-3 px-4">Estado de ascensor</th>
                <th className="py-3 px-4">Barreras y observaciones</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 px-4 text-center text-slate-500">
                    No hay registros que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filtered.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 align-top">
                      <div className="font-medium text-slate-900">{rec.estacion}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{rec.linea}</div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap align-top">
                      {rec.barrio}
                    </td>
                    <td className="py-3.5 px-4 text-xs whitespace-nowrap align-top">
                      {renderElevatorState(rec.ascensor, rec.isSynthetic)}
                      <div className="text-[11px] text-slate-500 mt-1">
                        Rampa: {rec.rampaAcceso === true ? 'Sí' : rec.rampaAcceso === false ? 'No' : 'Sin confirmar'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 max-w-md align-top space-y-1">
                      <p>{rec.observaciones}</p>
                      {rec.barrerasConocidas.length > 0 && (
                        <p className="text-slate-800">
                          Barreras registradas: {rec.barrerasConocidas.join(' · ')}
                        </p>
                      )}
                      {rec.sourceUrl && (
                        <a
                          href={rec.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#0F5257] hover:underline font-medium"
                        >
                          <span>Consultar estado en EMOVA</span>
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap align-top">
                      <button
                        type="button"
                        onClick={() => onConsultStation(rec.estacion)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0F5257] hover:text-[#0b3e42] transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Evaluar acceso</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
