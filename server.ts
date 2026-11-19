import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_SCENARIO_FLAGS,
  getBuenosAiresTime,
  getSimulatedServiceStatuses,
  getStationAccessibilityData,
} from './server/cabaTransitEngine.ts';
import { getGoogleMapsApiKey } from './server/providers/googleMapsProvider.ts';
import {
  evaluateDeduplicateAndRankRoutes,
  getRealNetworkStatusRecords,
} from './server/rumaRouting.ts';
import { runRumaConversation } from './server/rumaAgent.ts';
import type {
  AppMode,
  AvoidableTransitMode,
  CandidateRoute,
  PreferenceMode,
  ScenarioFlags,
  TravelConstraints,
  TripState,
} from './src/shared/rumaTypes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '4mb' }));

function parseScenarioFlags(input: unknown): ScenarioFlags {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_SCENARIO_FLAGS };
  }
  const obj = input as Record<string, unknown>;
  return {
    linea_d_obras: Boolean(obj.linea_d_obras),
    linea_b_demora: Boolean(obj.linea_b_demora),
    ascensor_peru_fuera: Boolean(obj.ascensor_peru_fuera),
    corte_9dejulio: Boolean(obj.corte_9dejulio),
    lluvia_intensa: Boolean(obj.lluvia_intensa),
  };
}

function parseAppMode(input: unknown): AppMode {
  return input === 'demo' ? 'demo' : 'real';
}

function parseConstraints(raw: unknown): TravelConstraints {
  const rawConstraints = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const avoidModesRaw = Array.isArray(rawConstraints.avoidModes) ? rawConstraints.avoidModes : [];
  const avoidModes = avoidModesRaw.filter(
    (m): m is AvoidableTransitMode => m === 'bus' || m === 'subte' || m === 'tren'
  );
  return {
    evitarEscaleras: Boolean(rawConstraints.evitarEscaleras),
    requiereAscensorConfirmado: Boolean(rawConstraints.requiereAscensorConfirmado),
    maxCaminataMetros:
      typeof rawConstraints.maxCaminataMetros === 'number' && rawConstraints.maxCaminataMetros > 0
        ? rawConstraints.maxCaminataMetros
        : null,
    maxTransbordos:
      typeof rawConstraints.maxTransbordos === 'number' && rawConstraints.maxTransbordos >= 0
        ? rawConstraints.maxTransbordos
        : null,
    avoidModes,
    soloCaminata: Boolean(rawConstraints.soloCaminata),
  };
}

const VALID_PREFS: PreferenceMode[] = [
  'balanceado',
  'menor_duracion',
  'menos_caminata',
  'menos_transbordos',
  'mayor_accesibilidad',
];

function parsePreference(raw: unknown): PreferenceMode {
  return VALID_PREFS.includes(raw as PreferenceMode) ? (raw as PreferenceMode) : 'balanceado';
}

function parseTripState(raw: unknown, constraints: TravelConstraints, preference: PreferenceMode): TripState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const rawTimeSpec = (obj.timeSpec && typeof obj.timeSpec === 'object' ? obj.timeSpec : {}) as Record<string, unknown>;
  const modeVal =
    rawTimeSpec.mode === 'departure' || rawTimeSpec.mode === 'arrival' ? rawTimeSpec.mode : 'ahora';
  return {
    originQuery: typeof obj.originQuery === 'string' ? obj.originQuery : '',
    originConfirmed:
      obj.originConfirmed && typeof obj.originConfirmed === 'object'
        ? (obj.originConfirmed as TripState['originConfirmed'])
        : null,
    destinationQuery: typeof obj.destinationQuery === 'string' ? obj.destinationQuery : '',
    destinationConfirmed:
      obj.destinationConfirmed && typeof obj.destinationConfirmed === 'object'
        ? (obj.destinationConfirmed as TripState['destinationConfirmed'])
        : null,
    timeSpec: {
      mode: modeVal,
      date: typeof rawTimeSpec.date === 'string' ? rawTimeSpec.date : undefined,
      time: typeof rawTimeSpec.time === 'string' ? rawTimeSpec.time : undefined,
      rawText: typeof rawTimeSpec.rawText === 'string' ? rawTimeSpec.rawText : undefined,
      humanLabel: typeof rawTimeSpec.humanLabel === 'string' ? rawTimeSpec.humanLabel : undefined,
    },
    constraints,
    preference,
    pendingClarification: typeof obj.pendingClarification === 'string' ? obj.pendingClarification : null,
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    time: getBuenosAiresTime(),
    mapsConfigured: Boolean(getGoogleMapsApiKey()),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Provides browser Maps JS API key from VITE_GOOGLE_MAPS_API_KEY when not bundled at build time
app.get('/api/maps-client-config', (_req, res) => {
  const browserKey = (process.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  res.json({
    configured: Boolean(browserKey),
    apiKey: browserKey || null,
  });
});

app.post('/api/network-state', (req, res) => {
  const mode = parseAppMode(req.body?.mode);
  const flags = parseScenarioFlags(req.body?.scenarioFlags);
  const time = getBuenosAiresTime();

  if (mode === 'demo') {
    res.json({
      mode: 'demo',
      escenarioSimulado: true,
      aviso: 'ESCENARIO SIMULADO — DATOS DE DEMOSTRACIÓN',
      time,
      services: getSimulatedServiceStatuses(flags),
      accessibility: getStationAccessibilityData(flags),
    });
    return;
  }

  const realStatus = getRealNetworkStatusRecords();
  res.json({
    mode: 'real',
    escenarioSimulado: false,
    aviso: realStatus.officialSourcesNotice,
    time,
    services: realStatus.services,
    accessibility: realStatus.accessibility,
  });
});

app.post('/api/rerank', (req, res) => {
  try {
    const body = req.body || {};
    const constraints = parseConstraints(body.constraints);
    const preference = parsePreference(body.preference);
    const cachedRoutes = Array.isArray(body.routes) ? (body.routes as CandidateRoute[]) : [];
    const ranked = evaluateDeduplicateAndRankRoutes(cachedRoutes, constraints, preference);
    res.json({
      routes: ranked.presentedRoutes,
      ningunaCumpleRestricciones: ranked.ningunaCumpleRestricciones,
    });
  } catch (err) {
    console.error('Error en /api/rerank:', err);
    res.status(400).json({ error: 'No se pudieron reordenar las rutas en sesión.' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const body = req.body || {};
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const mode = parseAppMode(body.mode);

    if (!message) {
      res.status(400).json({ error: 'Escribí una consulta para que el asistente pueda ayudarte.' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        error:
          'El servicio conversacional no está disponible en este momento.',
      });
      return;
    }

    const history = Array.isArray(body.history)
      ? body.history.filter(
          (item: unknown): item is { role: 'user' | 'assistant'; content: string } =>
            Boolean(item) &&
            typeof item === 'object' &&
            ((item as { role?: string }).role === 'user' ||
              (item as { role?: string }).role === 'assistant') &&
            typeof (item as { content?: unknown }).content === 'string'
        )
      : [];

    const constraints = parseConstraints(body.constraints);
    const preference = parsePreference(body.preference);
    const scenarioFlags = parseScenarioFlags(body.scenarioFlags);
    const tripState = parseTripState(body.tripState, constraints, preference);
    const cachedRoutes = Array.isArray(body.cachedRoutes)
      ? (body.cachedRoutes as CandidateRoute[])
      : undefined;

    const result = await runRumaConversation({
      history,
      message,
      mode,
      constraints,
      preference,
      scenarioFlags,
      tripState,
      cachedRoutes,
    });

    res.json(result);
  } catch (err) {
    console.error('Error en /api/chat:', err);
    res.status(500).json({
      error:
        'No se pudo procesar la consulta en este momento. Podés reintentar o consultar los canales oficiales de movilidad de CABA (BA Cómo Llego / Emova).',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RUMA server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
