import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  MessageSquare,
  XCircle,
} from 'lucide-react';
import type { AppMode, ServiceStatusLevel, TransitServiceStatus } from '../shared/rumaTypes';

interface NetworkStatusViewProps {
  mode: AppMode;
  services: TransitServiceStatus[];
  loading: boolean;
  onSwitchMode: (next: AppMode) => void;
  onConsultLine: (lineName: string) => void;
}

function renderStatusCell(estado: ServiceStatusLevel, label: string) {
  switch (estado) {
    case 'normal':
      return (
        <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
    case 'demora':
    case 'desvio':
      return (
        <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
    case 'interrumpido':
      return (
        <span className="inline-flex items-center gap-1.5 text-red-700 font-medium">
          <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
          <HelpCircle className="w-3.5 h-3.5 shrink-0 text-amber-700" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
  }
}

export function NetworkStatusView({
  mode,
  services,
  loading,
  onSwitchMode,
  onConsultLine,
}: NetworkStatusViewProps) {
  const [typeFilter, setTypeFilter] = useState<string>('todos');
  const [search, setSearch] = useState('');

  const filtered = services.filter((s) => {
    const matchesType = typeFilter === 'todos' || s.tipo === typeFilter;
    const matchesSearch =
      !search.trim() ||
      s.nombre.toLowerCase().includes(search.toLowerCase()) ||
      s.detalle.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Estado de la red en CABA
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            {mode === 'real'
              ? 'En modo REAL, RUMA no inventa telemetría en vivo cuando no existe un feed abierto sin credenciales. Consultá los canales oficiales verificados antes de viajar.'
              : 'Vista de demostración sujeta a las incidencias simuladas activadas manualmente en modo DEMO.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar línea o corredor..."
            aria-label="Filtrar línea o corredor"
            className="text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 w-full sm:w-56 min-h-[42px] focus:outline-none focus:ring-2 focus:ring-[#0F5257]/30 focus:border-[#0F5257]"
          />

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'Subte', label: 'Subte' },
              { id: 'Colectivo / Metrobús', label: 'Colectivos' },
              { id: 'Tren Urbano', label: 'Trenes' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  typeFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mode transparency banner */}
      {mode === 'real' ? (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
          <div className="space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
              <span>Estado operativo sin feed en vivo conectado (modo REAL)</span>
            </div>
            <p className="text-amber-900/90 leading-relaxed">
              El endpoint oficial de transporte GCBA requiere credenciales privadas de aplicación y Emova no expone API JSON pública. Por transparencia, no mostramos estados inventados como reales.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSwitchMode('demo')}
            className="px-3 py-2 min-h-[40px] bg-white border border-amber-300 hover:bg-amber-100/60 text-amber-950 font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            Probar panel en modo DEMO
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
          <div>
            <strong>MODO DEMO ACTIVO:</strong> los estados mostrados provienen del escenario sintético de pruebas, no de operadores reales.
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

      {/* Mobile card list (zero horizontal overflow) */}
      <div className="space-y-3 md:hidden">
        {loading && services.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
            Cargando estado de red...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
            No se encontraron servicios para ese filtro.
          </div>
        ) : (
          filtered.map((service) => (
            <article
              key={service.id}
              className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{service.nombre}</h2>
                  <p className="text-xs text-slate-500">
                    {service.tipo} · {service.sourceName}
                  </p>
                </div>
                <span className="font-mono text-[11px] tabular-nums text-slate-500">
                  {service.actualizadoEn} ART
                </span>
              </div>

              <div className="text-xs">{renderStatusCell(service.estado, service.estadoEtiqueta)}</div>
              <p className="text-xs text-slate-600 leading-relaxed">{service.detalle}</p>
              {service.afectaciones.length > 0 && (
                <p className="text-xs text-amber-800 font-medium">
                  Afectaciones: {service.afectaciones.join(' · ')}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                {service.sourceUrl ? (
                  <a
                    href={service.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#0F5257] hover:underline"
                  >
                    <span>Fuente oficial</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="text-[11px] text-slate-500">{service.limitations}</span>
                )}

                <button
                  type="button"
                  onClick={() => onConsultLine(service.nombre)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-medium text-[#0F5257] bg-[#0F5257]/5 hover:bg-[#0F5257]/10 rounded-lg cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Consultar</span>
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
                <th className="py-3 px-4">Servicio</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Estado reportado</th>
                <th className="py-3 px-4">Detalle y fuente</th>
                <th className="py-3 px-4 text-right">Consulta</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && services.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-4 text-center text-slate-500">
                    Cargando estado de red...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-4 text-center text-slate-500">
                    No se encontraron servicios para ese filtro.
                  </td>
                </tr>
              ) : (
                filtered.map((service) => (
                  <tr key={service.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-900 align-top">
                      {service.nombre}
                      <div className="text-xs font-normal text-slate-500 mt-0.5">
                        {service.isSynthetic ? 'Dato simulado · ' : ''}
                        {service.sourceName}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap align-top">
                      {service.tipo}
                    </td>
                    <td className="py-3.5 px-4 text-xs whitespace-nowrap align-top">
                      {renderStatusCell(service.estado, service.estadoEtiqueta)}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 max-w-md align-top space-y-1">
                      <p>{service.detalle}</p>
                      {service.afectaciones.length > 0 && (
                        <p className="text-amber-800 font-medium">
                          Afectaciones: {service.afectaciones.join(' · ')}
                        </p>
                      )}
                      {service.sourceUrl && (
                        <a
                          href={service.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#0F5257] hover:underline font-medium"
                        >
                          <span>Verificar en sitio oficial</span>
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-slate-500 whitespace-nowrap align-top">
                      {service.actualizadoEn} ART
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap align-top">
                      <button
                        type="button"
                        onClick={() => onConsultLine(service.nombre)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0F5257] hover:text-[#0b3e42] transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Consultar</span>
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
