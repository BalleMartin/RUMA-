import { useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  RefreshCw,
  Send,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  AppMode,
  CandidateRoute,
  ChatMessage,
  GeocodedPlaceSummary,
  PreferenceMode,
  RecentPlaceEntry,
  RumaChatResponse,
  ScenarioFlags,
  StationAccessibilityRecord,
  TransitServiceStatus,
  TravelConstraints,
  TripState,
  TripTimeMode,
  TripTimeSpec,
} from './shared/rumaTypes';
import { RUMA_BRANDING } from './shared/branding';
import { RumaMessageContent } from './components/RumaMessageContent';
import { CriteriaSidebar } from './components/CriteriaSidebar';
import { NetworkStatusView } from './components/NetworkStatusView';
import { AccessibilityView } from './components/AccessibilityView';
import { AboutPrototypeView } from './components/AboutPrototypeView';
import { RumaMapPanel } from './components/RumaMapPanel';
import { PlaceAutocompleteInput } from './components/PlaceAutocompleteInput';
import { clearRecentPlaces, loadRecentPlaces, saveRecentPlace } from './utils/sessionRecents';

type ActiveTab = 'asistente' | 'red' | 'accesibilidad' | 'acerca';

const DEFAULT_CONSTRAINTS: TravelConstraints = {
  evitarEscaleras: false,
  requiereAscensorConfirmado: false,
  maxCaminataMetros: null,
  maxTransbordos: null,
  avoidModes: [],
  soloCaminata: false,
};

const DEFAULT_SCENARIO_FLAGS: ScenarioFlags = {
  linea_d_obras: false,
  linea_b_demora: false,
  ascensor_peru_fuera: false,
  corte_9dejulio: false,
  lluvia_intensa: false,
};

function getTodayBuenosAiresDate(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function getCurrentBuenosAiresClock(): string {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch {
    return '09:00';
  }
}

const STARTER_PROMPTS = [
  {
    title: 'Anchorena al 1800 a Florida al 500 (accesible)',
    text: 'Necesito ir desde Anchorena al 1800 hasta Florida al 500, con accesibilidad para silla de ruedas.',
  },
  {
    title: 'Palermo a Obelisco con poca caminata',
    text: 'Quiero ir ahora desde Palermo (Plaza Italia) hasta el Obelisco, priorizando caminar lo menos posible.',
  },
  {
    title: 'Constitución a Ciudad Universitaria (llegada)',
    text: 'Necesito ir desde Constitución hasta Ciudad Universitaria para llegar antes de las 14:00, evitando muchos transbordos.',
  },
  {
    title: 'Estado de red y accesibilidad en CABA',
    text: '¿Cómo se verifica hoy el estado de líneas de Subte, colectivos y ascensores en CABA?',
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('asistente');
  const [mode, setMode] = useState<AppMode>('real');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [constraints, setConstraints] = useState<TravelConstraints>(DEFAULT_CONSTRAINTS);
  const [preference, setPreference] = useState<PreferenceMode>('balanceado');
  const [scenarioFlags, setScenarioFlags] = useState<ScenarioFlags>(DEFAULT_SCENARIO_FLAGS);
  const [showMobileCriteria, setShowMobileCriteria] = useState(false);

  // Maps client configuration & quota defense
  const envMapsKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || null;
  const [mapsApiKey, setMapsApiKey] = useState<string | null>(envMapsKey);
  const [mapsConfigured, setMapsConfigured] = useState<boolean>(Boolean(envMapsKey));
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  // Selected route synchronized with map
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  // Manual form collapsed by default; NO prefilled Palermo / Obelisco values
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [quickOrigin, setQuickOrigin] = useState('');
  const [originConfirmed, setOriginConfirmed] = useState<GeocodedPlaceSummary | null>(null);
  const [quickDest, setQuickDest] = useState('');
  const [destinationConfirmed, setDestinationConfirmed] = useState<GeocodedPlaceSummary | null>(null);
  const [timeSpec, setTimeSpec] = useState<TripTimeSpec>({
    mode: 'ahora',
    date: getTodayBuenosAiresDate(),
    time: getCurrentBuenosAiresClock(),
    rawText: 'ahora',
  });

  // Session-only independent recents (max 3 origins, max 3 destinations)
  const [recentOrigins, setRecentOrigins] = useState<RecentPlaceEntry[]>(() =>
    loadRecentPlaces('origin')
  );
  const [recentDestinations, setRecentDestinations] = useState<RecentPlaceEntry[]>(() =>
    loadRecentPlaces('destination')
  );

  // Network & Accessibility state
  const [cabaClock, setCabaClock] = useState<string>('');
  const [services, setServices] = useState<TransitServiceStatus[]>([]);
  const [accessibilityRecords, setAccessibilityRecords] = useState<StationAccessibilityRecord[]>([]);
  const [loadingNetwork, setLoadingNetwork] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.title = RUMA_BRANDING.documentTitle;
  }, []);

  // Listen for Google Maps JS quota / auth failure events
  useEffect(() => {
    function onQuotaExceeded() {
      setMapsQuotaExceeded(true);
    }
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  // Load client Maps key safely from backend if not bundled via VITE_GOOGLE_MAPS_API_KEY
  useEffect(() => {
    if (envMapsKey) return;
    let cancelled = false;
    async function loadMapsConfig() {
      try {
        const res = await fetch('/api/maps-client-config');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setMapsConfigured(Boolean(data.configured));
          setMapsApiKey(typeof data.apiKey === 'string' && data.apiKey.trim() ? data.apiKey.trim() : null);
        }
      } catch {
        // Handled cleanly in UI
      }
    }
    loadMapsConfig();
    return () => {
      cancelled = true;
    };
  }, [envMapsKey]);

  // Refresh network & accessibility status whenever mode or demo scenario flags change
  useEffect(() => {
    let cancelled = false;
    async function fetchNetworkState() {
      setLoadingNetwork(true);
      try {
        const res = await fetch('/api/network-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, scenarioFlags }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setServices(data.services || []);
          setAccessibilityRecords(data.accessibility || []);
          if (data.time?.horaLocalCABA) {
            setCabaClock(data.time.horaLocalCABA);
          }
        }
      } catch {
        // Silent background refresh fallback
      } finally {
        if (!cancelled) setLoadingNetwork(false);
      }
    }
    fetchNetworkState();
    return () => {
      cancelled = true;
    };
  }, [mode, scenarioFlags]);

  useEffect(() => {
    if (messages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, isSending]);

  // Latest message that returned routes
  const latestRoutesPayload = useMemo<{
    routes: CandidateRoute[];
    mode: AppMode;
  } | null>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === 'assistant' && m.routes && m.routes.length > 0) {
        return {
          routes: m.routes,
          mode: m.mode || (m.isSimulatedData ? 'demo' : 'real'),
        };
      }
    }
    return null;
  }, [messages]);

  const activeMapRoute = useMemo<CandidateRoute | null>(() => {
    if (!latestRoutesPayload || latestRoutesPayload.routes.length === 0) return null;
    const found = latestRoutesPayload.routes.find(
      (r) => r.routeId === selectedRouteId || r.id === selectedRouteId
    );
    if (found) return found;
    return (
      latestRoutesPayload.routes.find((r) => r.esRecomendada) ||
      latestRoutesPayload.routes[0]
    );
  }, [latestRoutesPayload, selectedRouteId]);

  function buildCurrentTripState(): TripState {
    return {
      originQuery: quickOrigin.trim(),
      originConfirmed,
      destinationQuery: quickDest.trim(),
      destinationConfirmed,
      timeSpec,
      constraints,
      preference,
    };
  }

  function applyReturnedTripState(nextState?: TripState) {
    if (!nextState) return;
    if (typeof nextState.originQuery === 'string') {
      setQuickOrigin(nextState.originQuery);
    }
    if (nextState.originConfirmed !== undefined) {
      setOriginConfirmed(nextState.originConfirmed);
      if (nextState.originConfirmed?.isInsideCaba) {
        setRecentOrigins(saveRecentPlace('origin', nextState.originConfirmed));
      }
    }
    if (typeof nextState.destinationQuery === 'string') {
      setQuickDest(nextState.destinationQuery);
    }
    if (nextState.destinationConfirmed !== undefined) {
      setDestinationConfirmed(nextState.destinationConfirmed);
      if (nextState.destinationConfirmed?.isInsideCaba) {
        setRecentDestinations(saveRecentPlace('destination', nextState.destinationConfirmed));
      }
    }
    if (nextState.timeSpec) {
      setTimeSpec((prev) => ({
        ...prev,
        ...nextState.timeSpec,
        date: nextState.timeSpec.date || prev.date || getTodayBuenosAiresDate(),
        time: nextState.timeSpec.time || prev.time || getCurrentBuenosAiresClock(),
      }));
    }
    if (nextState.constraints) {
      setConstraints(nextState.constraints);
    }
    if (nextState.preference) {
      setPreference(nextState.preference);
    }
  }

  async function sendMessage(
    textToSend: string,
    options?: {
      overrideMode?: AppMode;
      overrideTripState?: TripState;
    }
  ) {
    const trimmed = textToSend.trim();
    if (!trimmed || isSending) return;
    const effectiveMode = options?.overrideMode || mode;
    const tripStatePayload = options?.overrideTripState || buildCurrentTripState();

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: cabaClock || '--:--',
    };

    const nextHistory = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsSending(true);
    setActiveTab('asistente');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: effectiveMode,
          history: nextHistory,
          message: trimmed,
          constraints: tripStatePayload.constraints,
          preference: tripStatePayload.preference,
          scenarioFlags,
          tripState: tripStatePayload,
          cachedRoutes: latestRoutesPayload?.routes,
        }),
      });

      const data = (await res.json()) as RumaChatResponse & { error?: string };

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo completar la consulta.');
      }

      if (data.horaConsultaCABA) {
        setCabaClock(data.horaConsultaCABA);
      }

      if (data.routeError?.code === 'QUOTA_EXCEEDED') {
        setMapsQuotaExceeded(true);
      }

      applyReturnedTripState(data.updatedTripState);

      const returnedRoutes = Array.isArray(data.routes) ? data.routes : undefined;
      if (returnedRoutes && returnedRoutes.length > 0) {
        const best = returnedRoutes.find((r) => r.esRecomendada) || returnedRoutes[0];
        setSelectedRouteId(best.routeId || best.id);
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: data.horaConsultaCABA || cabaClock || '--:--',
        mode: data.mode || effectiveMode,
        isSimulatedData: Boolean(data.isSimulatedData),
        toolTrace: data.toolTrace,
        routes: returnedRoutes,
        routeError: data.routeError,
        accessibilityRequested: Boolean(data.accessibilityRequested),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorText =
        err instanceof Error
          ? err.message
          : 'Ocurrió un inconveniente al consultar el servicio.';
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: errorText,
        timestamp: cabaClock || '--:--',
        mode: effectiveMode,
        error: true,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsSending(false);
    }
  }

  function handleResetConversation() {
    setMessages([]);
    setSelectedRouteId(null);
    setInputValue('');
    setQuickOrigin('');
    setOriginConfirmed(null);
    setQuickDest('');
    setDestinationConfirmed(null);
    setTimeSpec({
      mode: 'ahora',
      date: getTodayBuenosAiresDate(),
      time: getCurrentBuenosAiresClock(),
      rawText: 'ahora',
    });
    setActiveTab('asistente');
  }

  function handleResetAllCriteria() {
    setConstraints(DEFAULT_CONSTRAINTS);
    setPreference('balanceado');
    setScenarioFlags(DEFAULT_SCENARIO_FLAGS);
  }

  function formatTimeSummary(spec: TripTimeSpec): string {
    if (spec.mode === 'ahora') return 'ahora';
    const verb = spec.mode === 'arrival' ? 'llegar antes de las' : 'salir a las';
    const d = spec.date || getTodayBuenosAiresDate();
    const t = spec.time || getCurrentBuenosAiresClock();
    const today = getTodayBuenosAiresDate();
    return d === today ? `hoy (${verb} ${t})` : `${d} (${verb} ${t})`;
  }

  function handleQuickBuildSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quickOrigin.trim() || !quickDest.trim()) return;
    const momentSummary = formatTimeSummary(timeSpec);
    const prompt = `Quiero viajar desde ${quickOrigin.trim()} hasta ${quickDest.trim()} (${momentSummary}).`;
    void sendMessage(prompt, { overrideTripState: buildCurrentTripState() });
  }

  function handleReevaluate() {
    const activeFlagsList = Object.entries(scenarioFlags)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const avoidLabels = (constraints.avoidModes || []).join(', ');
    const prompt = `Reevaluá el viaje con mis criterios actuales (preferencia: ${preference}${
      constraints.evitarEscaleras ? ', evitar escaleras' : ''
    }${
      constraints.requiereAscensorConfirmado ? ', ascensor requerido' : ''
    }${
      constraints.soloCaminata ? ', solo caminata' : ''
    }${
      avoidLabels ? `, evitar: ${avoidLabels}` : ''
    }${
      constraints.maxCaminataMetros ? `, caminata máxima ${constraints.maxCaminataMetros} m` : ''
    }${
      constraints.maxTransbordos !== null ? `, máximo ${constraints.maxTransbordos} transbordo(s)` : ''
    }${
      mode === 'demo' && activeFlagsList.length > 0
        ? `, incidencias simuladas: ${activeFlagsList.join(', ')}`
        : ''
    }).`;
    void sendMessage(prompt, { overrideTripState: buildCurrentTripState() });
  }

  function handleEnableDemoAndRetry(userPromptText?: string) {
    setMode('demo');
    const fallbackPrompt =
      userPromptText ||
      [...messages].reverse().find((m) => m.role === 'user')?.content ||
      (quickOrigin.trim() && quickDest.trim()
        ? `Quiero ir desde ${quickOrigin.trim()} hasta ${quickDest.trim()}`
        : 'Necesito ayuda para planificar un viaje en CABA');
    void sendMessage(fallbackPrompt, { overrideMode: 'demo' });
  }

  const mapsProviderReady = Boolean(mapsConfigured && mapsApiKey);

  const mainShell = (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Quota / Auth Failure Banner */}
      {mapsQuotaExceeded && (
        <div
          role="alert"
          className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm"
        >
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4 sm:gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('asistente')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
          >
            <span>{RUMA_BRANDING.visibleName}</span>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                mode === 'real'
                  ? 'bg-[#0F5257]/10 text-[#0F5257]'
                  : 'bg-amber-100 text-amber-900'
              }`}
            >
              {mode === 'real' ? 'CABA Real' : 'DEMO'}
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium" aria-label="Navegación principal">
            {[
              { id: 'asistente', label: 'Asistente' },
              { id: 'red', label: 'Estado de red' },
              { id: 'accesibilidad', label: 'Accesibilidad' },
              { id: 'acerca', label: 'Sobre el prototipo' },
            ].map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id as ActiveTab)}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'border-[#0F5257] text-slate-900'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResetConversation}
              className="px-3.5 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#0F5257] hover:bg-[#0b3e42] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Nueva consulta
            </button>
          </div>
        </div>

        {/* Mobile sub-navigation */}
        <div className="md:hidden border-t border-slate-100 px-4 py-1.5 flex items-center gap-4 overflow-x-auto text-xs font-medium">
          {[
            { id: 'asistente', label: 'Asistente' },
            { id: 'red', label: 'Estado de red' },
            { id: 'accesibilidad', label: 'Accesibilidad' },
            { id: 'acerca', label: 'Prototipo' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id as ActiveTab)}
              className={`py-1.5 min-h-[34px] whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === item.id ? 'text-[#0F5257] font-semibold' : 'text-slate-600'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Mode & Academic Disclosure Bar */}
      <div
        className={
          mode === 'real'
            ? 'bg-emerald-950/[0.04] border-b border-slate-200'
            : 'bg-amber-50/80 border-b border-amber-200/80'
        }
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            {mode === 'real' ? (
              <MapPin className="w-3.5 h-3.5 text-[#0F5257] shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
            )}
            <span>
              {mode === 'real' ? (
                <>
                  <strong className="font-semibold text-[#0F5257]">MODO REAL — CABA</strong>
                  <span className="mx-1.5 text-slate-400" aria-hidden="true">·</span>
                  <span>{RUMA_BRANDING.institutionLabel}</span>
                </>
              ) : (
                <>
                  <strong className="font-semibold text-amber-950">MODO DEMO — ESCENARIO SIMULADO (14 NODOS)</strong>
                  <span className="mx-1.5 text-amber-700/60" aria-hidden="true">·</span>
                  <span className="text-amber-950">{RUMA_BRANDING.institutionLabel}</span>
                </>
              )}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {mode === 'demo' && (
              <button
                type="button"
                onClick={() => setMode('real')}
                className="text-[11px] font-semibold text-[#0F5257] underline cursor-pointer"
              >
                Volver a modo REAL
              </button>
            )}
            {cabaClock && (
              <div className="font-mono text-[11px] tabular-nums text-slate-600">
                Hora CABA: {cabaClock} ART
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {activeTab === 'asistente' && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_410px] gap-5 items-start">
            {/* Conversational Assistant + Collapsible Manual Trip Form (Column 1) */}
            <div className="space-y-4 min-w-0 lg:col-start-1 lg:row-start-1">
              <section className="bg-white border border-slate-200 rounded-xl flex flex-col min-h-[540px]">
                {/* Workspace top strip */}
                <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
                  <div>
                    <h1 className="text-base font-semibold text-slate-900">
                      {RUMA_BRANDING.shortSubtitle}
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {mode === 'real'
                        ? 'Contame a dónde vas en CABA y tus necesidades de movilidad'
                        : 'Ensayo sobre red simulada de demostración (14 nodos)'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setManualFormOpen((prev) => !prev)}
                      aria-expanded={manualFormOpen}
                      className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5257]"
                    >
                      <MapPin className="w-3.5 h-3.5 text-[#0F5257]" aria-hidden="true" />
                      <span>Ingresar origen y destino manualmente</span>
                      {manualFormOpen ? (
                        <ChevronUp className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowMobileCriteria((prev) => !prev)}
                      aria-expanded={showMobileCriteria}
                      className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{showMobileCriteria ? 'Ocultar criterios' : 'Criterios'}</span>
                    </button>
                  </div>
                </div>

                {/* Mobile Criteria Drawer */}
                {showMobileCriteria && (
                  <div className="lg:hidden p-3 sm:p-4 border-b border-slate-200 bg-slate-50">
                    <CriteriaSidebar
                      mode={mode}
                      onChangeMode={setMode}
                      constraints={constraints}
                      onChangeConstraints={setConstraints}
                      preference={preference}
                      onChangePreference={setPreference}
                      scenarioFlags={scenarioFlags}
                      onChangeScenarioFlags={setScenarioFlags}
                      canReevaluate={messages.length > 0}
                      isLoading={isSending}
                      onReevaluate={handleReevaluate}
                      onResetAll={handleResetAllCriteria}
                    />
                  </div>
                )}

                {/* Collapsible Manual Origin / Destination / Time Form (closed by default, retains values across toggle) */}
                {manualFormOpen && (
                  <form
                    onSubmit={handleQuickBuildSubmit}
                    className="px-4 sm:px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <PlaceAutocompleteInput
                        id="quick-origin"
                        label="Origen en CABA"
                        placeholder="Seleccioná o ingresá un origen"
                        value={quickOrigin}
                        confirmedPlace={originConfirmed}
                        recents={recentOrigins}
                        mapsSdkEnabled={mapsProviderReady}
                        onChangeText={(txt) => {
                          setQuickOrigin(txt);
                          setOriginConfirmed(null);
                        }}
                        onSelectPlace={(place) => {
                          const display = place.displayName
                            ? `${place.displayName}, ${place.formattedAddress}`
                            : place.formattedAddress;
                          setQuickOrigin(display);
                          setOriginConfirmed(place);
                          setRecentOrigins(saveRecentPlace('origin', place));
                        }}
                        onClearRecents={() => {
                          clearRecentPlaces('origin');
                          setRecentOrigins([]);
                        }}
                      />

                      <PlaceAutocompleteInput
                        id="quick-dest"
                        label="Destino en CABA"
                        placeholder="Seleccioná o ingresá un destino"
                        value={quickDest}
                        confirmedPlace={destinationConfirmed}
                        recents={recentDestinations}
                        mapsSdkEnabled={mapsProviderReady}
                        onChangeText={(txt) => {
                          setQuickDest(txt);
                          setDestinationConfirmed(null);
                        }}
                        onSelectPlace={(place) => {
                          const display = place.displayName
                            ? `${place.displayName}, ${place.formattedAddress}`
                            : place.formattedAddress;
                          setQuickDest(display);
                          setDestinationConfirmed(place);
                          setRecentDestinations(saveRecentPlace('destination', place));
                        }}
                        onClearRecents={() => {
                          clearRecentPlaces('destination');
                          setRecentDestinations([]);
                        }}
                      />
                    </div>

                    {/* Time & Date Selector */}
                    <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
                      <div className="flex flex-wrap items-end gap-2.5">
                        <div>
                          <label htmlFor="trip-time-mode" className="block text-[11px] font-medium text-slate-700 mb-1">
                            Horario (CABA)
                          </label>
                          <select
                            id="trip-time-mode"
                            value={timeSpec.mode}
                            onChange={(e) => {
                              const nextMode = e.target.value as TripTimeMode;
                              setTimeSpec((prev) => ({
                                ...prev,
                                mode: nextMode,
                                date: prev.date || getTodayBuenosAiresDate(),
                                time: prev.time || getCurrentBuenosAiresClock(),
                                rawText: nextMode === 'ahora' ? 'ahora' : undefined,
                              }));
                            }}
                            className="min-h-[42px] text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F5257]/30"
                          >
                            <option value="ahora">
                              Ahora {cabaClock ? `(${cabaClock} ART)` : ''}
                            </option>
                            <option value="departure">Salir a las...</option>
                            <option value="arrival">Llegar antes de las...</option>
                          </select>
                        </div>

                        {timeSpec.mode !== 'ahora' && (
                          <>
                            <div>
                              <label htmlFor="trip-date" className="block text-[11px] font-medium text-slate-700 mb-1">
                                Fecha
                              </label>
                              <input
                                id="trip-date"
                                type="date"
                                value={timeSpec.date || getTodayBuenosAiresDate()}
                                onChange={(e) =>
                                  setTimeSpec((prev) => ({
                                    ...prev,
                                    date: e.target.value,
                                    rawText: undefined,
                                  }))
                                }
                                className="min-h-[42px] text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F5257]/30"
                              />
                            </div>
                            <div>
                              <label htmlFor="trip-clock" className="block text-[11px] font-medium text-slate-700 mb-1">
                                Hora
                              </label>
                              <input
                                id="trip-clock"
                                type="time"
                                value={timeSpec.time || getCurrentBuenosAiresClock()}
                                onChange={(e) =>
                                  setTimeSpec((prev) => ({
                                    ...prev,
                                    time: e.target.value,
                                    rawText: undefined,
                                  }))
                                }
                                className="min-h-[42px] text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F5257]/30"
                              />
                            </div>
                          </>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={isSending || !quickOrigin.trim() || !quickDest.trim()}
                        className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F5257] hover:bg-[#0b3e42] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>Consultar viaje</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </form>
                )}

                {/* Unified Trip State Summary Strip (only visible once a trip is active) */}
                {(quickOrigin.trim() || quickDest.trim()) && (
                  <div className="px-4 sm:px-5 py-2 bg-[#0F5257]/[0.04] border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-700">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-[#0F5257]">Viaje activo:</span>
                      <span className="truncate max-w-[210px] font-medium">
                        {quickOrigin.trim() || 'Origen pendiente'}
                      </span>
                      <span aria-hidden="true">→</span>
                      <span className="truncate max-w-[210px] font-medium">
                        {quickDest.trim() || 'Destino pendiente'}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-slate-600 font-mono">
                      <Clock className="w-3 h-3 text-[#0F5257]" aria-hidden="true" />
                      {timeSpec.humanLabel || formatTimeSummary(timeSpec)}
                    </span>
                  </div>
                )}

                {/* Conversation Area */}
                <div className="flex-1 p-4 sm:p-5 space-y-6 overflow-y-auto max-h-[680px]">
                  {messages.length === 0 ? (
                    <div className="py-3 space-y-6">
                      <div className="max-w-2xl space-y-2">
                        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                          {RUMA_BRANDING.welcomeHeading}
                        </h2>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          {RUMA_BRANDING.welcomeDescription}
                        </p>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3">
                        {STARTER_PROMPTS.map((item) => (
                          <button
                            key={item.title}
                            type="button"
                            onClick={() => void sendMessage(item.text)}
                            className="text-left p-3.5 min-h-[72px] border border-slate-200 hover:border-[#0F5257]/50 hover:bg-slate-50/70 rounded-lg transition-colors space-y-1 cursor-pointer"
                          >
                            <div className="text-xs font-semibold text-slate-900">{item.title}</div>
                            <div className="text-xs text-slate-600 line-clamp-2">{item.text}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={
                          msg.role === 'user'
                            ? 'flex justify-end'
                            : 'border-t border-slate-100 first:border-t-0 pt-4 first:pt-0'
                        }
                      >
                        {msg.role === 'user' ? (
                          <div className="max-w-[85%] bg-slate-100 text-slate-900 rounded-xl px-4 py-3 text-sm leading-relaxed">
                            <div className="text-[11px] font-medium text-slate-500 mb-1">
                              Tu consulta · {msg.timestamp} ART
                            </div>
                            <p>{msg.content}</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span className="font-semibold text-[#0F5257]">
                                {RUMA_BRANDING.visibleName}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{msg.timestamp} ART</span>
                              {msg.mode && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-[11px] uppercase tracking-wide text-slate-500">
                                    {msg.mode === 'demo' ? 'DEMO' : 'REAL'}
                                  </span>
                                </>
                              )}
                            </div>
                            <RumaMessageContent
                              content={msg.content}
                              routes={msg.routes}
                              selectedRouteId={selectedRouteId}
                              onSelectRoute={(id) => setSelectedRouteId(id)}
                              routeError={msg.routeError}
                              toolTrace={msg.toolTrace}
                              isSimulatedData={msg.isSimulatedData}
                              accessibilityRequested={msg.accessibilityRequested}
                              onSelectFollowUp={(txt) => void sendMessage(txt)}
                              onEnableDemoAndRetry={() => handleEnableDemoAndRetry()}
                            />
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  {isSending && (
                    <div className="pt-4 border-t border-slate-100 flex items-center gap-2.5 text-xs text-slate-600">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0F5257]" aria-hidden="true" />
                      <span>
                        {mode === 'real'
                          ? 'Buscando opciones reales en CABA...'
                          : 'Evaluando escenario simulado en motor DEMO...'}
                      </span>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* Primary Chat Composer */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendMessage(inputValue);
                  }}
                  className="p-3 sm:p-4 border-t border-slate-200 bg-white rounded-b-xl flex items-end gap-2.5"
                >
                  <div className="flex-1">
                    <label htmlFor="chat-input" className="sr-only">
                      Escribí tu consulta de movilidad en CABA
                    </label>
                    <textarea
                      id="chat-input"
                      rows={2}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void sendMessage(inputValue);
                        }
                      }}
                      placeholder="Escribí tu viaje en lenguaje natural (ej. 'De Anchorena al 1800 a Florida al 500 en silla de ruedas' o 'Mañana a las 8 sin colectivo')..."
                      className="w-full resize-none text-sm bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0F5257]/30 focus:border-[#0F5257]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSending || !inputValue.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-[#0F5257] hover:bg-[#0b3e42] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Enviar</span>
                  </button>
                </form>
              </section>
            </div>

            {/* Single Responsive Right/Bottom Column: Single RumaMapPanel (under cards on mobile, sticky side on desktop) + Desktop CriteriaSidebar */}
            <div className="lg:col-start-2 lg:row-start-1 lg:sticky lg:top-20 space-y-5">
              {activeMapRoute && (
                <RumaMapPanel
                  apiKey={mapsApiKey}
                  mapsConfigured={mapsConfigured}
                  route={activeMapRoute}
                  mode={latestRoutesPayload?.mode || mode}
                  onQuotaOrAuthError={() => setMapsQuotaExceeded(true)}
                />
              )}

              <div className="hidden lg:block">
                <CriteriaSidebar
                  mode={mode}
                  onChangeMode={setMode}
                  constraints={constraints}
                  onChangeConstraints={setConstraints}
                  preference={preference}
                  onChangePreference={setPreference}
                  scenarioFlags={scenarioFlags}
                  onChangeScenarioFlags={setScenarioFlags}
                  canReevaluate={messages.length > 0}
                  isLoading={isSending}
                  onReevaluate={handleReevaluate}
                  onResetAll={handleResetAllCriteria}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'red' && (
          <NetworkStatusView
            mode={mode}
            services={services}
            loading={loadingNetwork}
            onSwitchMode={setMode}
            onConsultLine={(lineName) => {
              void sendMessage(`¿Qué información verificada hay hoy sobre ${lineName} y cómo planifico alternativas en CABA?`);
            }}
          />
        )}

        {activeTab === 'accesibilidad' && (
          <AccessibilityView
            mode={mode}
            records={accessibilityRecords}
            onSwitchMode={setMode}
            onConsultStation={(stationName) => {
              void sendMessage(`¿Qué información verificada de accesibilidad, ascensores o barreras tenés sobre ${stationName}?`);
            }}
          />
        )}

        {activeTab === 'acerca' && <AboutPrototypeView />}
      </main>
    </div>
  );

  // Mount ONE single APIProvider at the top when client Maps API key is configured
  if (mapsProviderReady && mapsApiKey) {
    return (
      <APIProvider
        apiKey={mapsApiKey}
        language="es"
        region="AR"
        libraries={['places', 'marker', 'geometry']}
      >
        {mainShell}
      </APIProvider>
    );
  }

  return mainShell;
}
