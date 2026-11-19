import { useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Footprints,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  AppMode,
  AvoidableTransitMode,
  PreferenceMode,
  ScenarioFlags,
  TravelConstraints,
} from '../shared/rumaTypes';

interface CriteriaSidebarProps {
  mode: AppMode;
  onChangeMode: (next: AppMode) => void;
  constraints: TravelConstraints;
  onChangeConstraints: (next: TravelConstraints) => void;
  preference: PreferenceMode;
  onChangePreference: (next: PreferenceMode) => void;
  scenarioFlags: ScenarioFlags;
  onChangeScenarioFlags: (next: ScenarioFlags) => void;
  canReevaluate: boolean;
  isLoading: boolean;
  onReevaluate: () => void;
  onResetAll: () => void;
}

const PREFERENCE_OPTIONS: Array<{ value: PreferenceMode; label: string; hint: string }> = [
  { value: 'balanceado', label: 'Balanceado', hint: 'Equilibra duración, caminata, transbordos y accesibilidad' },
  { value: 'menor_duracion', label: 'Menor duración', hint: 'Prioriza el menor tiempo total estimado' },
  { value: 'menos_caminata', label: 'Menos caminata', hint: 'Reduce los metros totales a pie' },
  { value: 'menos_transbordos', label: 'Menos transbordos', hint: 'Prioriza recorridos directos o con 1 cambio' },
  { value: 'mayor_accesibilidad', label: 'Mayor accesibilidad', hint: 'Prioriza tramos con menos barreras o verificación confirmada' },
];

const AVOIDABLE_MODES: Array<{ key: AvoidableTransitMode; label: string }> = [
  { key: 'bus', label: 'Evitar colectivo' },
  { key: 'subte', label: 'Evitar subte' },
  { key: 'tren', label: 'Evitar tren' },
];

const SCENARIO_TOGGLES: Array<{ key: keyof ScenarioFlags; label: string; detail: string }> = [
  {
    key: 'linea_d_obras',
    label: 'Línea D: obras en Pueyrredón',
    detail: 'Servicio limitado y demoras en tramo norte (solo DEMO)',
  },
  {
    key: 'linea_b_demora',
    label: 'Línea B: demoras técnicas',
    detail: '+12 min estimados entre Alem y Rosas (solo DEMO)',
  },
  {
    key: 'ascensor_peru_fuera',
    label: 'Ascensor Est. Perú fuera de servicio',
    detail: 'Bloquea accesibilidad sin escaleras en Perú (solo DEMO)',
  },
  {
    key: 'corte_9dejulio',
    label: 'Corte en Av. 9 de Julio y Corrientes',
    detail: 'Desvíos y demoras (+15 min) en Metrobús y colectivos (solo DEMO)',
  },
  {
    key: 'lluvia_intensa',
    label: 'Lluvia intensa en CABA',
    detail: 'Aumenta tiempo estimado en tramos peatonales (solo DEMO)',
  },
];

export function CriteriaSidebar({
  mode,
  onChangeMode,
  constraints,
  onChangeConstraints,
  preference,
  onChangePreference,
  scenarioFlags,
  onChangeScenarioFlags,
  canReevaluate,
  isLoading,
  onReevaluate,
  onResetAll,
}: CriteriaSidebarProps) {
  // Cerrado por defecto en modo REAL
  const [demoPanelOpen, setDemoPanelOpen] = useState(false);

  const activeDisruptionsCount = Object.values(scenarioFlags).filter(Boolean).length;
  const avoidModes = constraints.avoidModes || [];

  function toggleAvoidMode(target: AvoidableTransitMode) {
    const exists = avoidModes.includes(target);
    const next = exists
      ? avoidModes.filter((m) => m !== target)
      : [...avoidModes, target];
    onChangeConstraints({ ...constraints, avoidModes: next });
  }

  return (
    <aside className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
      <div className="p-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-[#0F5257]" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-900">Criterios de viaje</h2>
        </div>
        <button
          type="button"
          onClick={onResetAll}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 min-h-[36px] px-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5257] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" aria-hidden="true" />
          <span>Restablecer</span>
        </button>
      </div>

      {/* Restricciones obligatorias */}
      <div className="p-4 space-y-3.5">
        <div>
          <h3 className="text-xs font-semibold text-slate-900">Restricciones obligatorias</h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Filtran o marcan como excluidas las rutas que no cumplen estas condiciones.
          </p>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer py-1">
          <input
            type="checkbox"
            checked={constraints.evitarEscaleras}
            onChange={(e) =>
              onChangeConstraints({ ...constraints, evitarEscaleras: e.target.checked })
            }
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0F5257] focus:ring-[#0F5257]"
          />
          <span className="text-xs text-slate-700 leading-snug">
            <span className="font-medium text-slate-900 block">Evitar escaleras</span>
            Exige verificación de acceso sin escaleras fijas obligatorias.
          </span>
        </label>

        <label className="flex items-start gap-2.5 cursor-pointer py-1">
          <input
            type="checkbox"
            checked={constraints.requiereAscensorConfirmado}
            onChange={(e) =>
              onChangeConstraints({
                ...constraints,
                requiereAscensorConfirmado: e.target.checked,
              })
            }
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0F5257] focus:ring-[#0F5257]"
          />
          <span className="text-xs text-slate-700 leading-snug">
            <span className="font-medium text-slate-900 block">Ascensor operativo confirmado</span>
            Si un ascensor figura sin confirmar en vivo, no certifica la ruta.
          </span>
        </label>

        <label className="flex items-start gap-2.5 cursor-pointer py-1">
          <input
            type="checkbox"
            checked={Boolean(constraints.soloCaminata)}
            onChange={(e) =>
              onChangeConstraints({
                ...constraints,
                soloCaminata: e.target.checked,
              })
            }
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0F5257] focus:ring-[#0F5257]"
          />
          <span className="text-xs text-slate-700 leading-snug">
            <span className="font-medium text-slate-900 inline-flex items-center gap-1">
              <Footprints className="w-3.5 h-3.5 text-[#0F5257]" aria-hidden="true" />
              Solo caminata (a pie)
            </span>
            <span className="block">Calcula recorrido exclusivamente peatonal.</span>
          </span>
        </label>

        {/* Medios a evitar */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-800">Medios a evitar</div>
          <div className="grid grid-cols-3 gap-1.5">
            {AVOIDABLE_MODES.map((m) => {
              const active = avoidModes.includes(m.key);
              const disabled = Boolean(constraints.soloCaminata);
              return (
                <button
                  key={m.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleAvoidMode(m.key)}
                  aria-pressed={active}
                  className={`min-h-[40px] px-2 py-1.5 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5257] ${
                    active
                      ? 'bg-[#0F5257] text-white border-[#0F5257]'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {m.label.replace('Evitar ', 'Sin ')}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-800">Caminata máxima</span>
            {constraints.maxCaminataMetros !== null &&
              constraints.maxCaminataMetros !== 400 &&
              constraints.maxCaminataMetros !== 700 && (
                <span className="text-[11px] font-semibold text-[#0F5257] bg-[#0F5257]/10 px-2 py-0.5 rounded">
                  Activo: {constraints.maxCaminataMetros} m
                </span>
              )}
          </div>
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
            {[
              { label: 'Sin tope', value: null },
              { label: '400 m', value: 400 },
              { label: '700 m', value: 700 },
            ].map((opt) => {
              const active = constraints.maxCaminataMetros === opt.value;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() =>
                    onChangeConstraints({ ...constraints, maxCaminataMetros: opt.value })
                  }
                  className={`min-h-[38px] py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5257] ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-800">Transbordos máximos</div>
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
            {[
              { label: 'Sin tope', value: null },
              { label: 'Directo (0)', value: 0 },
              { label: 'Hasta 1', value: 1 },
            ].map((opt) => {
              const active = constraints.maxTransbordos === opt.value;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() =>
                    onChangeConstraints({ ...constraints, maxTransbordos: opt.value })
                  }
                  className={`min-h-[38px] py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5257] ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Preferencias */}
      <div className="p-4 space-y-2.5">
        <div>
          <h3 className="text-xs font-semibold text-slate-900">Preferencia de ordenamiento</h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Pondera las opciones válidas sin omitir restricciones obligatorias.
          </p>
        </div>
        <select
          aria-label="Preferencia de ordenamiento"
          value={preference}
          onChange={(e) => onChangePreference(e.target.value as PreferenceMode)}
          className="w-full min-h-[42px] text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0F5257]/30 focus:border-[#0F5257]"
        >
          {PREFERENCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-slate-600 leading-snug">
          {PREFERENCE_OPTIONS.find((o) => o.value === preference)?.hint}
        </p>

        {canReevaluate && (
          <button
            type="button"
            disabled={isLoading}
            onClick={onReevaluate}
            className="w-full mt-2 min-h-[44px] py-2 px-4 text-xs font-semibold text-white bg-[#0F5257] hover:bg-[#0b3e42] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5257]"
          >
            {isLoading ? 'Reevaluando...' : 'Reevaluar viaje con estos criterios'}
          </button>
        )}
      </div>

      {/* Pruebas en modo DEMO (cerrado por defecto) */}
      <div className="p-4 space-y-3">
        <button
          type="button"
          onClick={() => setDemoPanelOpen((prev) => !prev)}
          aria-expanded={demoPanelOpen}
          className="w-full min-h-[40px] flex items-center justify-between gap-2 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5257] rounded-md"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle
              className={`w-4 h-4 shrink-0 ${
                mode === 'demo' ? 'text-amber-700' : 'text-slate-400'
              }`}
              aria-hidden="true"
            />
            <div>
              <div className="text-xs font-semibold text-slate-900">
                Pruebas en modo DEMO {mode === 'demo' ? '(ACTIVO)' : '(opcional)'}
              </div>
              <div className="text-[11px] text-slate-500">
                {mode === 'demo'
                  ? `Red simulada · ${activeDisruptionsCount} incidencia(s)`
                  : 'Desactivado por defecto (usa rutas reales)'}
              </div>
            </div>
          </div>
          {demoPanelOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
          )}
        </button>

        {(demoPanelOpen || mode === 'demo') && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => onChangeMode('real')}
                className={`min-h-[38px] py-1.5 px-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  mode === 'real'
                    ? 'bg-[#0F5257] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Modo REAL
              </button>
              <button
                type="button"
                onClick={() => onChangeMode('demo')}
                className={`min-h-[38px] py-1.5 px-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  mode === 'demo'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Modo DEMO
              </button>
            </div>

            <p className="text-[11px] text-slate-600 leading-snug">
              El modo DEMO consulta únicamente el grafo sintético de 14 nodos para ensayar cortes simulados. Nunca reemplaza automáticamente al modo REAL.
            </p>

            {mode === 'demo' && (
              <div className="space-y-2.5 pt-1">
                {SCENARIO_TOGGLES.map((item) => (
                  <label key={item.key} className="flex items-start gap-2.5 cursor-pointer py-0.5">
                    <input
                      type="checkbox"
                      checked={scenarioFlags[item.key]}
                      onChange={(e) =>
                        onChangeScenarioFlags({
                          ...scenarioFlags,
                          [item.key]: e.target.checked,
                        })
                      }
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-700 focus:ring-amber-600"
                    />
                    <span className="text-xs leading-snug">
                      <span className="font-medium text-slate-800 block">{item.label}</span>
                      <span className="text-[11px] text-slate-500">{item.detail}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
