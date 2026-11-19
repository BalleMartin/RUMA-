import { GoogleGenAI, Type } from '@google/genai';
import {
  getBuenosAiresTime,
  getSimulatedServiceStatuses,
  getStationAccessibilityData,
  planCabaRoutes,
} from './cabaTransitEngine.ts';
import {
  formatArgentineIntersectionForDisplay,
  getBuenosAiresDateString,
  isArgentineIntersection,
  normalizeArgentineStreetQuery,
  resolveBuenosAiresTripTime,
} from './providers/googleMapsProvider.ts';
import {
  EMOVA_ACCESSIBILITY_PHONE,
  EMOVA_ACCESSIBILITY_URL,
  enrichRouteAccessibilityMetadata,
  evaluateDeduplicateAndRankRoutes,
  getRealNetworkStatusRecords,
  planRealCabaRoutes,
} from './rumaRouting.ts';
import type {
  AvoidableTransitMode,
  CandidateRoute,
  PreferenceMode,
  RouteQueryError,
  RumaChatRequest,
  RumaChatResponse,
  ToolTraceEntry,
  TravelConstraints,
  TripState,
  TripTimeSpec,
} from '../src/shared/rumaTypes.ts';
import { RUMA_BRANDING } from '../src/shared/branding.ts';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const INTENT_EXTRACTION_PROMPT = `Sos el intérprete de estado de viaje de ${RUMA_BRANDING.visibleName} en CABA (Argentina).
Tu tarea es interpretar el último mensaje del usuario respecto del estado actual del viaje y devolver OPERACIONES explícitas (KEEP / SET / REMOVE / ASK).

REGLAS CRÍTICAS:
1. Un campo no mencionado en el último mensaje debe quedar en "KEEP" (NUNCA borrarlo ni asumir valores viejos como nuevos).
2. Si el usuario corrige o libera una restricción previa:
   - "ahora sí puedo tomar colectivo" / "podés incluir subte" -> removeAvoidModes: ["bus"] o ["subte"], NO lo dejes bloqueado.
   - "puedo caminar 600 m" / "subí el límite a 700 m" -> maxCaminataOp: "SET", maxCaminataMetros: 600 (reemplaza el anterior aunque antes fuera menor).
   - "sin límite de caminata" / "no importa caminar" -> maxCaminataOp: "REMOVE".
   - "voy en silla de ruedas" / "movilidad reducida" / "sin escaleras" -> evitarEscalerasOp: "SET_TRUE", requiereAscensorOp: "SET_TRUE".
   - "ya no necesito ascensor" / "puedo usar escaleras" -> evitarEscalerasOp: "SET_FALSE", requiereAscensorOp: "SET_FALSE".
   - Si pide quitar restricciones de forma ambigua ("sacá todo", "no importa eso") mientras evitarEscaleras o requiereAscensor están activos, usá "ASK" y redactá una pregunta breve en clarificationQuestion.
3. Horario:
   - "ahora" -> timeOp: "SET_NOW".
   - "mañana a las 8", "hoy a las 18", "salir a las 14:30" -> timeOp: "SET_CUSTOM", timeMode: "departure", timeRawText: frase exacta.
   - "llegar antes de las 14", "para llegar a las 9" -> timeOp: "SET_CUSTOM", timeMode: "arrival", timeRawText: frase exacta.
   - Si el horario es ambiguo (ej. "a las 8" sin aclarar am/pm ni hoy/mañana, o "mañana" sin hora), usá timeOp: "ASK" y redactá timeAmbiguityQuestion.
4. Origen y destino en CABA:
   - Conservá la referencia exacta (ej. "Anchorena al 1800", "Florida al 500"). Si no cambia, usá "KEEP".
   - Intersecciones: "Florida y Lavalle", "Florida esquina Lavalle", "cruce de Florida con Lavalle", "Florida & Lavalle", "esquina de Santa Fe y Pueyrredón". No dividas por la "y" cuando dos calles forman un cruce. En frases como "Salgo de Corrientes y Callao y voy al Obelisco", el origen es "Corrientes y Callao" y el destino es "Obelisco".
   - Si el usuario indica origen y destino ("Quiero ir desde Plaza Italia hasta Florida y Lavalle", "Salgo de Corrientes y Callao y voy al Obelisco", "Quiero llegar a Florida al 500 desde Anchorena al 1800", "Quiero ir de Palermo a Retiro"): intentType="plan_route", originOp="SET", destinationOp="SET".
   - Si indica solo destino ("Voy a la esquina de Santa Fe y Pueyrredón"): destinationOp="SET", destinationText="Santa Fe y Pueyrredón", originOp="KEEP", intentType="clarification_needed", clarificationQuestion="¿Desde qué punto de CABA salís para ir a Santa Fe y Pueyrredón?".
   - Si indica solo origen ("Salgo de Corrientes y Callao"): originOp="SET", originText="Corrientes y Callao", destinationOp="KEEP", intentType="clarification_needed", clarificationQuestion="¿Hacia qué destino en CABA querés viajar desde Corrientes y Callao?".
   - Si ingresa una intersección o lugar sin indicar si es punto de partida o destino ("Florida y Lavalle"): originOp="KEEP", destinationOp="KEEP", intentType="clarification_needed", clarificationQuestion='¿"Florida y Lavalle" es tu punto de partida o tu destino?'.
   - Si cambia solo la preferencia ("priorizando menos caminata"), usá intentType: "plan_route" manteniendo originOp="KEEP" y destinationOp="KEEP".
   - Si no hay origen/destino ni en el estado actual ni en el mensaje y pregunta un viaje, usá intentType: "clarification_needed".
   - Si consulta estado de red o accesibilidad general sin pedir viaje, usá "network_status" o "accessibility_info".`;

const EXPLANATION_SYSTEM_INSTRUCTION = `Sos ${RUMA_BRANDING.visibleName} — Rutas para una Movilidad Urbana Adaptativa (prototipo académico del IFTS N.º 12 en CABA).

REGLAS DE RESPUESTA:
1. Español rioplatense claro, cercano y breve ("podés", "tenés", "te recomiendo").
2. Basate EXCLUSIVAMENTE en los datos verificados del JSON recibido. Prohibido inventar rutas, paradas, horarios, distancias ni porcentajes.
3. LONGITUD ADAPTATIVA (MUY IMPORTANTE):
   - Para consultas normales con rutas viables sin incidentes especiales: respondé en **1 o 2 oraciones breves y prácticas**. Las tarjetas visuales ya muestran duración, caminata, transbordos y tramos, así que NO repitas esa lista ni uses plantillas de 7 secciones.
   - Ampliá solo si hace falta explicar: (a) ninguna ruta cumple las restricciones, (b) limitaciones de accesibilidad cuando la persona pidió silla de ruedas / evitar escaleras / ascensor, (c) ambigüedad o ubicación fuera de CABA, o (d) consulta de estado de red/accesibilidad.
4. ACCESIBILIDAD HONESTA: Si \`evitarEscaleras\` o \`requiereAscensorConfirmado\` están activos o una ruta tiene \`accessStatus !== "verified"\`, nunca digas que está "100% accesible"; aclará en una frase breve que el estado de ascensores/rampas no está confirmado y sugerí consultar EMOVA (${EMOVA_ACCESSIBILITY_URL}) o el ${EMOVA_ACCESSIBILITY_PHONE}. No asumas que las escaleras mecánicas sirven para silla de ruedas.
5. PROHIBIDO LENGUAJE TÉCNICO INTERNO: Nunca menciones puntajes numéricos (ej. 0.075), normalización min-max, HTTP, JSON, APIs ni nombres de funciones internas al viajero.
6. MODO DEMO vs REAL:
   - Si \`mode === "demo"\`: incluí arriba la línea \`*ESCENARIO SIMULADO — DATOS DE DEMOSTRACIÓN.*\`.
   - Si \`mode === "real"\`: NO incluyas esa línea. Podés cerrar con una nota discreta solo cuando no haya tarjetas o sea consulta de estado.`;

interface ExtractedStateOps {
  intentType:
    | 'plan_route'
    | 'network_status'
    | 'accessibility_info'
    | 'clarification_needed'
    | 'out_of_scope'
    | 'general_help';
  originOp?: 'KEEP' | 'SET' | 'REMOVE';
  originText?: string;
  destinationOp?: 'KEEP' | 'SET' | 'REMOVE';
  destinationText?: string;
  timeOp?: 'KEEP' | 'SET_NOW' | 'SET_CUSTOM' | 'ASK';
  timeMode?: 'ahora' | 'departure' | 'arrival';
  timeRawText?: string;
  timeAmbiguityQuestion?: string;
  evitarEscalerasOp?: 'KEEP' | 'SET_TRUE' | 'SET_FALSE' | 'ASK';
  requiereAscensorOp?: 'KEEP' | 'SET_TRUE' | 'SET_FALSE' | 'ASK';
  soloCaminataOp?: 'KEEP' | 'SET_TRUE' | 'SET_FALSE';
  addAvoidModes?: AvoidableTransitMode[];
  removeAvoidModes?: AvoidableTransitMode[];
  maxCaminataOp?: 'KEEP' | 'SET' | 'REMOVE';
  maxCaminataMetros?: number;
  maxTransbordosOp?: 'KEEP' | 'SET' | 'REMOVE';
  maxTransbordos?: number;
  preferenceOp?: 'KEEP' | 'SET';
  preference?: PreferenceMode;
  clarificationQuestion?: string;
}

function normalizeStr(v: string): string {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function detectAccessibilityQuery(message: string): boolean {
  const norm = normalizeStr(message);
  return /\b(silla de ruedas|movilidad reducida|ascensor(?:es)?|escalera(?:s)?(?:\s+mecanica(?:s)?)?|rampa(?:s)?|accesibilidad|accesible|medios de elevacion|sin escaleras)\b/.test(
    norm
  );
}

let geminiCooldownUntil = 0;

async function callGeminiSafe(params: Parameters<typeof ai.models.generateContent>[0]) {
  if (Date.now() < geminiCooldownUntil) {
    throw new Error('Gemini API en periodo de espera tras error de cuota');
  }

  const preferredModel = 'gemini-3.1-flash-lite';
  const modelsToTry = [preferredModel, params.model || 'gemini-4-hydrogen'];
  const uniqueModels = Array.from(new Set(modelsToTry));

  for (const model of uniqueModels) {
    try {
      return await ai.models.generateContent({
        ...params,
        model,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        geminiCooldownUntil = Date.now() + 60_000;
        console.warn(`[RUMA] Gemini 429 quota exhausted on model ${model}. Cooldown activated for 60s.`);
        throw err;
      }
      if (msg.includes('404')) {
        continue;
      }
      if (msg.includes('503') || msg.includes('UNAVAILABLE')) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        try {
          return await ai.models.generateContent({ ...params, model });
        } catch {
          continue;
        }
      }
      throw err;
    }
  }
  throw new Error('Todos los modelos de Gemini no están disponibles');
}

function applyDeterministicNlpSafetyNet(
  message: string,
  currentState: TripState,
  extracted: ExtractedStateOps
): ExtractedStateOps {
  const ops: ExtractedStateOps = { ...extracted };
  const rawMsg = message.trim();
  const cleanMsg = rawMsg.replace(/^["'«“]+|["'»”]+$/g, '').trim();
  const norm = normalizeStr(cleanMsg);

  const cleanIntersectionLabel = (s: string) => formatArgentineIntersectionForDisplay(s);

  // 0) Clarification response handling: User answers whether a previously queried intersection/place was origin or destination
  if (currentState.pendingClarification && /punto de partida o tu destino/i.test(currentState.pendingClarification)) {
    const matchPrevPlace = currentState.pendingClarification.match(/["'«“](.+?)["'»”]/);
    const prevPlace = matchPrevPlace ? matchPrevPlace[1].trim() : '';

    if (prevPlace) {
      if (/\b(destino|llegada|llegar|para ir|hacia alla|voy alla|adonde voy)\b/i.test(norm)) {
        ops.intentType = 'clarification_needed';
        ops.destinationOp = 'SET';
        ops.destinationText = prevPlace;
        ops.clarificationQuestion = `¿Desde qué punto de CABA salís para ir a ${prevPlace}?`;
        return ops;
      }
      if (/\b(origen|partida|salida|salgo de|parto de|inicio|de donde salgo)\b/i.test(norm)) {
        ops.intentType = 'clarification_needed';
        ops.originOp = 'SET';
        ops.originText = prevPlace;
        ops.clarificationQuestion = `¿Hacia qué destino en CABA querés viajar desde ${prevPlace}?`;
        return ops;
      }
    }
  }

  // 1) Natural trip intent extraction with Argentine Spanish conjunction & intersection disambiguation:
  let foundTrip = false;

  // Pattern 1A: Destination first with "llegar a / ir a", Origin second with "desde / saliendo de / partiendo de"
  // Example: "Quiero llegar a Florida al 500 desde Anchorena al 1800"
  if (!foundTrip) {
    const matchDestFirst = cleanMsg.match(
      /(?:quiero\s+)?(?:llegar|ir)\s+(?:a|al)\s+(.+?)\s+(?:desde|saliendo\s+de|partiendo\s+de)\s+(.+?)(?:,\s*(?:con|sin|evitando|priorizando|para|hoy|mañana)|[?!.]|$)/i
    );
    if (matchDestFirst && matchDestFirst[1]?.trim() && matchDestFirst[2]?.trim()) {
      ops.intentType = 'plan_route';
      ops.destinationOp = 'SET';
      ops.destinationText = cleanIntersectionLabel(matchDestFirst[1].trim());
      ops.originOp = 'SET';
      ops.originText = cleanIntersectionLabel(matchDestFirst[2].trim());
      ops.clarificationQuestion = undefined;
      foundTrip = true;
    }
  }

  // Pattern 1B: Origin first with "salgo de", Destination second with "y voy a / para ir a / hacia / con destino a"
  // Example: "Salgo de Corrientes y Callao y voy al Obelisco"
  // Notice: The delimiter " y voy al " prevents splitting the "y" inside "Corrientes y Callao"!
  if (!foundTrip) {
    const matchOriginFirstWithVerb = cleanMsg.match(
      /(?:salgo\s+de|saliendo\s+de|parto\s+de|estoy\s+en)\s+(.+?)\s+(?:y\s+(?:voy|viajo)|para\s+ir|hacia|con\s+destino\s+a)\s+(?:a\s+|al\s+)?(.+?)(?:,\s*(?:con|sin|evitando|priorizando|para|hoy|mañana)|[?!.]|$)/i
    );
    if (matchOriginFirstWithVerb && matchOriginFirstWithVerb[1]?.trim() && matchOriginFirstWithVerb[2]?.trim()) {
      ops.intentType = 'plan_route';
      ops.originOp = 'SET';
      ops.originText = cleanIntersectionLabel(matchOriginFirstWithVerb[1].trim());
      ops.destinationOp = 'SET';
      ops.destinationText = cleanIntersectionLabel(matchOriginFirstWithVerb[2].trim());
      ops.clarificationQuestion = undefined;
      foundTrip = true;
    }
  }

  // Pattern 1C: "desde X hasta/hacia/a Y"
  // Example: "Quiero ir desde Plaza Italia hasta Florida y Lavalle"
  if (!foundTrip) {
    const matchDesdeHasta = cleanMsg.match(
      /(?:desde|partiendo\s+de)\s+(.+?)\s+(?:hasta|hacia|a|al)\s+(.+?)(?:,\s*(?:con|sin|evitando|priorizando|para|hoy|mañana)|[?!.]|$)/i
    );
    if (matchDesdeHasta && matchDesdeHasta[1]?.trim() && matchDesdeHasta[2]?.trim()) {
      ops.intentType = 'plan_route';
      ops.originOp = 'SET';
      ops.originText = cleanIntersectionLabel(matchDesdeHasta[1].trim());
      ops.destinationOp = 'SET';
      ops.destinationText = cleanIntersectionLabel(matchDesdeHasta[2].trim());
      ops.clarificationQuestion = undefined;
      foundTrip = true;
    }
  }

  // Pattern 1D: "de X a/al Y" / "ir de X a Y"
  // Example: "Quiero ir de Palermo a Retiro"
  if (!foundTrip) {
    const matchDeA = cleanMsg.match(
      /(?:quiero\s+)?(?:ir|viajar)?\s*\bde\s+(.+?)\s+(?:a|al|hasta)\s+(.+?)(?:,\s*(?:con|sin|evitando|priorizando|para|hoy|mañana)|[?!.]|$)/i
    );
    if (matchDeA && matchDeA[1]?.trim() && matchDeA[2]?.trim()) {
      ops.intentType = 'plan_route';
      ops.originOp = 'SET';
      ops.originText = cleanIntersectionLabel(matchDeA[1].trim());
      ops.destinationOp = 'SET';
      ops.destinationText = cleanIntersectionLabel(matchDeA[2].trim());
      ops.clarificationQuestion = undefined;
      foundTrip = true;
    }
  }

  // Pattern 2: Destination only ("Voy a la esquina de Santa Fe y Pueyrredón" / "Voy a Santa Fe y Pueyrredón" / "Quiero ir a Retiro")
  if (!foundTrip) {
    const matchDestOnly = cleanMsg.match(
      /(?:voy\s+a|voy\s+hacia|para\s+ir\s+a|quiero\s+(?:ir|llegar)\s+a)\s+(?:a\s+|al\s+)?(.+?)(?:,\s*(?:con|sin|evitando|priorizando|para|hoy|mañana)|[?!.]|$)/i
    );
    if (matchDestOnly && matchDestOnly[1]?.trim() && !/\b(?:desde|saliendo|partiendo)\b/i.test(cleanMsg)) {
      const destCandidate = cleanIntersectionLabel(matchDestOnly[1].trim());
      ops.destinationOp = 'SET';
      ops.destinationText = destCandidate;

      if (currentState.originQuery) {
        ops.intentType = 'plan_route';
        ops.originOp = 'KEEP';
      } else {
        ops.intentType = 'clarification_needed';
        ops.originOp = 'KEEP';
        ops.clarificationQuestion = `¿Desde qué punto de CABA salís para ir a ${destCandidate}?`;
      }
      foundTrip = true;
    }
  }

  // Pattern 3: Origin only ("Salgo de Corrientes y Callao" / "Saliendo de Palermo")
  if (!foundTrip) {
    const matchOriginOnly = cleanMsg.match(
      /(?:salgo\s+de|saliendo\s+de|estoy\s+en|parto\s+de)\s+(.+?)(?:,\s*(?:con|sin|evitando|priorizando|para|hoy|mañana)|[?!.]|$)/i
    );
    if (matchOriginOnly && matchOriginOnly[1]?.trim() && !/\b(?:hasta|hacia|voy\s+a|para\s+ir)\b/i.test(cleanMsg)) {
      const originCandidate = cleanIntersectionLabel(matchOriginOnly[1].trim());
      ops.originOp = 'SET';
      ops.originText = originCandidate;

      if (currentState.destinationQuery) {
        ops.intentType = 'plan_route';
        ops.destinationOp = 'KEEP';
      } else {
        ops.intentType = 'clarification_needed';
        ops.destinationOp = 'KEEP';
        ops.clarificationQuestion = `¿Hacia qué destino en CABA querés viajar desde ${originCandidate}?`;
      }
      foundTrip = true;
    }
  }

  // Pattern 4: Standalone intersection without trip verbs or informational questions
  // Example: "Florida y Lavalle", "Florida esquina Lavalle", "cruce de Florida con Lavalle", "Florida & Lavalle"
  if (!foundTrip) {
    const hasTripVerbs = /\b(quiero|voy|salgo|llegar|viajar|ir|parto|desde|hasta|saliendo|partiendo)\b/i.test(cleanMsg);
    const looksLikeQuestionOrInfo =
      /[¿?]/.test(cleanMsg) ||
      /\b(como|cuando|donde|cual|verifico|funciona|funcionan|estado|ascensor(?:es)?|escalera(?:s)?|rampa(?:s)?|accesibilidad|accesible|medios de elevacion|demora(?:s)?|servicio|colectivos?|subte|tren)\b/.test(
        norm
      ) ||
      cleanMsg.split(/\s+/).length > 8;
    if (!hasTripVerbs && !looksLikeQuestionOrInfo && isArgentineIntersection(cleanMsg)) {
      const formattedIntersection = cleanIntersectionLabel(cleanMsg);
      ops.intentType = 'clarification_needed';
      ops.originOp = 'KEEP';
      ops.destinationOp = 'KEEP';
      ops.clarificationQuestion = `¿"${formattedIntersection}" es tu punto de partida o tu destino?`;
      foundTrip = true;
    }
  }

  // Consultas informativas: seguir respondiendo con un aviso honesto aun cuando
  // Gemini agote su cuota; nunca deducir estados operativos a partir del texto.
  if (!foundTrip && (ops.intentType === 'general_help' || ops.intentType === 'clarification_needed')) {
    const asksAccess = /\b(ascensor(?:es)?|escalera(?:s)? mecanica(?:s)?|rampa(?:s)?|accesibilidad|medios de elevacion)\b/.test(norm);
    const asksStatus = /\b(estado|como esta|funciona|funcionan|demora(?:s)?|interrumpid[ao]s?|cortad[ao]s?|paros?|suspendid[ao]s?|frecuencia)\b/.test(norm);
    if (asksAccess) {
      ops.intentType = 'accessibility_info';
      ops.clarificationQuestion = undefined;
    } else if (asksStatus) {
      ops.intentType = 'network_status';
      ops.clarificationQuestion = undefined;
    }
  }

  // 2) Explicit mode unblocking: "ahora sí puedo tomar colectivo / subte / tren"
  const removeModes = new Set<AvoidableTransitMode>(ops.removeAvoidModes || []);
  const addModes = new Set<AvoidableTransitMode>(ops.addAvoidModes || []);

  if (/\b(ahora si|ya puedo|puedo tomar|inclui|habilita|acepto|sumar?)\b.*\b(colectivo|bondi|bus)\b/.test(norm)) {
    removeModes.add('bus');
    addModes.delete('bus');
  } else if (/\b(sin|evita(?:r|ndo)?|no\s+(?:quiero|puedo)\s+tomar)\b.*\b(colectivo|bondi|bus)\b/.test(norm)) {
    addModes.add('bus');
    removeModes.delete('bus');
  }

  if (/\b(ahora si|ya puedo|puedo tomar|inclui|habilita|acepto)\b.*\bsubte\b/.test(norm)) {
    removeModes.add('subte');
    addModes.delete('subte');
  } else if (/\b(sin|evita(?:r|ndo)?|no\s+(?:quiero|puedo)\s+tomar)\b.*\bsubte\b/.test(norm)) {
    addModes.add('subte');
    removeModes.delete('subte');
  }

  if (/\b(ahora si|ya puedo|puedo tomar|inclui|habilita|acepto)\b.*\btren\b/.test(norm)) {
    removeModes.add('tren');
    addModes.delete('tren');
  } else if (/\b(sin|evita(?:r|ndo)?|no\s+(?:quiero|puedo)\s+tomar)\b.*\btren\b/.test(norm)) {
    addModes.add('tren');
    removeModes.delete('tren');
  }

  ops.addAvoidModes = Array.from(addModes);
  ops.removeAvoidModes = Array.from(removeModes);

  // 3) Wheelchair / stairs accessibility constraints
  if (
    /\b(silla de ruedas|movilidad reducida|sin escaleras|evitar escaleras|necesito ascensor|requiero ascensor|con ascensor|con rampa)\b/.test(
      norm
    )
  ) {
    ops.evitarEscalerasOp = 'SET_TRUE';
    if (/\b(silla de ruedas|movilidad reducida|ascensor|con rampa)\b/.test(norm)) {
      ops.requiereAscensorOp = 'SET_TRUE';
      if (!ops.preference && currentState.preference === 'balanceado') {
        ops.preferenceOp = 'SET';
        ops.preference = 'mayor_accesibilidad';
      }
    }
  } else if (/\b(ya no necesito|puedo usar|no hace falta evitar)\b.*\b(escaleras|ascensor)\b/.test(norm)) {
    ops.evitarEscalerasOp = 'SET_FALSE';
    ops.requiereAscensorOp = 'SET_FALSE';
  } else if (
    /\b(saca(?:r|me)?|quita(?:r|me)?|borra(?:r)?|olvida(?:r)?)\s+(?:todas?\s+)?las\s+restricciones\b/.test(norm) &&
    (currentState.constraints.evitarEscaleras || currentState.constraints.requiereAscensorConfirmado)
  ) {
    ops.evitarEscalerasOp = 'ASK';
    ops.requiereAscensorOp = 'ASK';
    ops.clarificationQuestion =
      'Tenías activado evitar escaleras / requerir ascensor. ¿Querés quitar también esas condiciones de accesibilidad o mantenerlas?';
  }

  // 4) Walk limit override (supports raising e.g. 400m -> 600m)
  const walkMatch = norm.match(/\b(?:puedo caminar|caminata(?: maxima)?(?: de)?|hasta|maximo)\s+(\d{2,4})\s*(?:m|mts|metros)\b/);
  if (walkMatch) {
    const meters = Number(walkMatch[1]);
    if (meters >= 50 && meters <= 5000) {
      ops.maxCaminataOp = 'SET';
      ops.maxCaminataMetros = meters;
    }
  } else if (/\b(sin tope|sin limite|no importa cuanto)\b.*\b(?:caminar|caminata)\b/.test(norm)) {
    ops.maxCaminataOp = 'REMOVE';
  }

  // 4.5) Preference detection safety net
  if (/\b(menos caminata|caminar menos|poca caminata|menor caminata)\b/.test(norm)) {
    ops.preferenceOp = 'SET';
    ops.preference = 'menos_caminata';
  } else if (/\b(menor duracion|mas rapido|menor tiempo|lo antes posible)\b/.test(norm)) {
    ops.preferenceOp = 'SET';
    ops.preference = 'menor_duracion';
  } else if (/\b(menos transbordos?|sin combinaciones?|menos combinaciones?|directo)\b/.test(norm)) {
    ops.preferenceOp = 'SET';
    ops.preference = 'menos_transbordos';
  } else if (/\b(mayor accesibilidad|mas accesible|priorizando accesibilidad)\b/.test(norm)) {
    ops.preferenceOp = 'SET';
    ops.preference = 'mayor_accesibilidad';
  } else if (/\b(balancead[oa]|equilibrad[oa])\b/.test(norm)) {
    ops.preferenceOp = 'SET';
    ops.preference = 'balanceado';
  }

  // 5) Arrival / departure natural time expressions
  if (/\b(llegar\s+antes\s+de\s+las|antes\s+de\s+las\s+\d{1,2}|para\s+llegar\s+a\s+las)\b/.test(norm)) {
    const phrase = message.match(/(?:llegar\s+antes\s+de\s+las|antes\s+de\s+las|para\s+llegar\s+a\s+las)\s+\d{1,2}(?:[:h.]\d{2})?(?:\s*(?:am|pm|hs))?/i)?.[0];
    if (phrase) {
      ops.timeOp = 'SET_CUSTOM';
      ops.timeMode = 'arrival';
      ops.timeRawText = phrase;
    }
  } else if (/\b(manana|hoy|pasado manana)\s+(?:a\s+las\s+)?\d{1,2}(?:[:h.]\d{2})?/i.test(norm)) {
    const phrase = message.match(/(?:mañana|hoy|pasado mañana)\s+(?:a\s+las\s+)?\d{1,2}(?:[:h.]\d{2})?(?:\s*(?:am|pm|hs))?/i)?.[0];
    if (phrase) {
      ops.timeOp = 'SET_CUSTOM';
      ops.timeMode = 'departure';
      ops.timeRawText = phrase;
    }
  }

  // 6) If currentState already has origin & destination and message does NOT mention a new origin/destination/time, keep them unchanged so reranking stays local
  const mentionsNewPlace = /\b(desde|hasta|hacia|ir\s+a|viajar\s+a|saliendo\s+de)\b/i.test(message);
  if (currentState.originQuery && currentState.destinationQuery && !mentionsNewPlace && !foundTrip) {
    ops.originOp = 'KEEP';
    ops.destinationOp = 'KEEP';
  }
  const mentionsNewTime = /\b(ahora|hoy|manana|antes\s+de|llegar|salir|las\s+\d|\d{1,2}[:h.]\d{2})\b/.test(norm);
  if (!mentionsNewTime && ops.timeOp !== 'ASK') {
    ops.timeOp = 'KEEP';
  }

  // 7) If we already have origin & destination in currentState and user sent a constraint/time/preference tweak, plan/rerank!
  if (
    ops.intentType !== 'out_of_scope' &&
    ops.intentType !== 'network_status' &&
    ops.intentType !== 'accessibility_info' &&
    ops.intentType !== 'clarification_needed' &&
    (ops.originText || currentState.originQuery) &&
    (ops.destinationText || currentState.destinationQuery)
  ) {
    ops.intentType = 'plan_route';
  }

  return ops;
}

function reduceTripState(currentState: TripState, ops: ExtractedStateOps): {
  nextState: TripState;
  changedOriginOrDest: boolean;
  changedTime: boolean;
  changedTravelFiltersForApi: boolean;
  clarificationNeeded: string | null;
} {
  let nextOriginQuery = currentState.originQuery;
  let nextOriginConfirmed = currentState.originConfirmed || null;
  let changedOriginOrDest = false;

  if (ops.originOp === 'REMOVE') {
    nextOriginQuery = '';
    nextOriginConfirmed = null;
    changedOriginOrDest = true;
  } else if (ops.originOp === 'SET' && ops.originText?.trim()) {
    const incoming = ops.originText.trim();
    if (normalizeStr(normalizeArgentineStreetQuery(incoming)) !== normalizeStr(normalizeArgentineStreetQuery(nextOriginQuery))) {
      nextOriginConfirmed = null;
      changedOriginOrDest = true;
    }
    nextOriginQuery = incoming;
  }

  let nextDestQuery = currentState.destinationQuery;
  let nextDestConfirmed = currentState.destinationConfirmed || null;

  if (ops.destinationOp === 'REMOVE') {
    nextDestQuery = '';
    nextDestConfirmed = null;
    changedOriginOrDest = true;
  } else if (ops.destinationOp === 'SET' && ops.destinationText?.trim()) {
    const incoming = ops.destinationText.trim();
    if (normalizeStr(normalizeArgentineStreetQuery(incoming)) !== normalizeStr(normalizeArgentineStreetQuery(nextDestQuery))) {
      nextDestConfirmed = null;
      changedOriginOrDest = true;
    }
    nextDestQuery = incoming;
  }

  // Time state
  let nextTimeSpec: TripTimeSpec = { ...currentState.timeSpec };
  let changedTime = false;
  let timeClarification: string | null = null;

  if (ops.timeOp === 'ASK') {
    timeClarification = ops.timeAmbiguityQuestion || '¿Me confirmás el horario exacto del viaje?';
    nextTimeSpec = {
      ...nextTimeSpec,
      clarificationNeeded: true,
      clarificationQuestion: timeClarification,
    };
  } else if (ops.timeOp === 'SET_NOW') {
    nextTimeSpec = {
      mode: 'ahora',
      rawText: 'ahora',
      date: getBuenosAiresDateString(),
      clarificationNeeded: false,
      clarificationQuestion: undefined,
    };
    if (currentState.timeSpec.mode !== 'ahora') changedTime = true;
  } else if (ops.timeOp === 'SET_CUSTOM' && ops.timeRawText?.trim()) {
    const resolved = resolveBuenosAiresTripTime({
      mode: ops.timeMode || 'departure',
      rawText: ops.timeRawText.trim(),
    });
    if (resolved.clarificationNeeded) {
      timeClarification = resolved.clarificationQuestion || '¿A qué hora exacta querés viajar?';
      nextTimeSpec = {
        mode: resolved.mode,
        rawText: ops.timeRawText.trim(),
        clarificationNeeded: true,
        clarificationQuestion: timeClarification,
      };
    } else {
      nextTimeSpec = {
        mode: resolved.mode,
        date: resolved.resolvedDate,
        time: resolved.resolvedTime,
        rawText: ops.timeRawText.trim(),
        humanLabel: resolved.humanLabel,
        clarificationNeeded: false,
        clarificationQuestion: undefined,
      };
      changedTime = true;
    }
  }

  // Constraints state (SET / REMOVE / KEEP / ASK)
  const avoidSet = new Set<AvoidableTransitMode>(currentState.constraints.avoidModes || []);
  for (const m of ops.addAvoidModes || []) {
    if (m === 'bus' || m === 'subte' || m === 'tren') avoidSet.add(m);
  }
  for (const m of ops.removeAvoidModes || []) {
    avoidSet.delete(m);
  }
  const nextAvoidModes = Array.from(avoidSet);

  let nextEvitarEscaleras = currentState.constraints.evitarEscaleras;
  if (ops.evitarEscalerasOp === 'SET_TRUE') nextEvitarEscaleras = true;
  else if (ops.evitarEscalerasOp === 'SET_FALSE') nextEvitarEscaleras = false;

  let nextRequiereAscensor = currentState.constraints.requiereAscensorConfirmado;
  if (ops.requiereAscensorOp === 'SET_TRUE') nextRequiereAscensor = true;
  else if (ops.requiereAscensorOp === 'SET_FALSE') nextRequiereAscensor = false;

  let nextSoloCaminata = Boolean(currentState.constraints.soloCaminata);
  if (ops.soloCaminataOp === 'SET_TRUE') nextSoloCaminata = true;
  else if (ops.soloCaminataOp === 'SET_FALSE') nextSoloCaminata = false;

  let nextMaxWalk = currentState.constraints.maxCaminataMetros;
  if (ops.maxCaminataOp === 'REMOVE') nextMaxWalk = null;
  else if (ops.maxCaminataOp === 'SET' && typeof ops.maxCaminataMetros === 'number' && ops.maxCaminataMetros > 0) {
    nextMaxWalk = Math.round(ops.maxCaminataMetros);
  }

  let nextMaxTrans = currentState.constraints.maxTransbordos;
  if (ops.maxTransbordosOp === 'REMOVE') nextMaxTrans = null;
  else if (ops.maxTransbordosOp === 'SET' && typeof ops.maxTransbordos === 'number' && ops.maxTransbordos >= 0) {
    nextMaxTrans = Math.round(ops.maxTransbordos);
  }

  const nextConstraints: TravelConstraints = {
    evitarEscaleras: nextEvitarEscaleras,
    requiereAscensorConfirmado: nextRequiereAscensor,
    maxCaminataMetros: nextMaxWalk,
    maxTransbordos: nextMaxTrans,
    avoidModes: nextAvoidModes,
    soloCaminata: nextSoloCaminata,
  };

  const validPrefs: PreferenceMode[] = [
    'balanceado',
    'menor_duracion',
    'menos_caminata',
    'menos_transbordos',
    'mayor_accesibilidad',
  ];
  const nextPreference: PreferenceMode =
    ops.preference && validPrefs.includes(ops.preference) && ops.preferenceOp !== 'KEEP'
      ? ops.preference
      : ops.preference && validPrefs.includes(ops.preference) && ops.preference !== currentState.preference && !ops.preferenceOp
        ? ops.preference
        : currentState.preference;

  const prevAvoidKey = [...(currentState.constraints.avoidModes || [])].sort().join(',');
  const nextAvoidKey = [...nextAvoidModes].sort().join(',');

  const walkRelaxed =
    (currentState.constraints.maxCaminataMetros !== null && nextMaxWalk === null) ||
    (currentState.constraints.maxCaminataMetros !== null &&
      nextMaxWalk !== null &&
      nextMaxWalk > currentState.constraints.maxCaminataMetros);
  const transRelaxed =
    (currentState.constraints.maxTransbordos !== null && nextMaxTrans === null) ||
    (currentState.constraints.maxTransbordos !== null &&
      nextMaxTrans !== null &&
      nextMaxTrans > currentState.constraints.maxTransbordos);
  const accessRelaxed =
    (currentState.constraints.evitarEscaleras && !nextEvitarEscaleras) ||
    (currentState.constraints.requiereAscensorConfirmado && !nextRequiereAscensor);

  const changedTravelFiltersForApi =
    prevAvoidKey !== nextAvoidKey ||
    Boolean(currentState.constraints.soloCaminata) !== Boolean(nextSoloCaminata) ||
    walkRelaxed ||
    transRelaxed ||
    accessRelaxed;

  const constraintAsk =
    ops.evitarEscalerasOp === 'ASK' || ops.requiereAscensorOp === 'ASK'
      ? ops.clarificationQuestion || '¿Confirmás si querés quitar las restricciones de accesibilidad?'
      : null;

  const clarificationNeeded =
    ops.clarificationQuestion || constraintAsk || timeClarification || null;

  return {
    nextState: {
      originQuery: nextOriginQuery,
      originConfirmed: nextOriginConfirmed,
      destinationQuery: nextDestQuery,
      destinationConfirmed: nextDestConfirmed,
      timeSpec: nextTimeSpec,
      constraints: nextConstraints,
      preference: nextPreference,
      pendingClarification: clarificationNeeded,
    },
    changedOriginOrDest,
    changedTime,
    changedTravelFiltersForApi,
    clarificationNeeded,
  };
}

function buildGroundedFallbackReply(params: {
  mode: 'real' | 'demo';
  timeStr: string;
  routes?: CandidateRoute[];
  routeError?: RouteQueryError;
  clarification?: string | null;
  accessibilityRequested?: boolean;
}): string {
  const prefix = params.mode === 'demo' ? '*ESCENARIO SIMULADO — DATOS DE DEMOSTRACIÓN.*\n\n' : '';
  if (params.clarification) {
    return `${prefix}${params.clarification}`;
  }
  if (params.routeError) {
    return `${prefix}${params.routeError.message}`;
  }
  if (params.routes && params.routes.length > 0) {
    const rec = params.routes.find((r) => r.esRecomendada) || params.routes[0];
    if (!rec.constraintsSatisfied) {
      const hasUnverifiedPossible = params.routes.some(
        (r) => r.itineraryAccessCategory === 'unverified_possible'
      );
      if (params.accessibilityRequested && hasUnverifiedPossible) {
        return prefix.trim();
      }
      return `${prefix}Ninguna de las alternativas encontradas cumple todas tus restricciones activas (${rec.disqualificationReasons[0] || 'filtros obligatorios'}). Podés ajustar un criterio para ver opciones viables.`;
    }
    return `${prefix}Te recomiendo **${rec.titulo}**. ${rec.recommendationReasons[0] || ''}`.trim();
  }
  return `${prefix}Indicame origen y destino dentro de CABA para buscar opciones reales de viaje.`;
}

export async function runRumaConversation(req: RumaChatRequest): Promise<RumaChatResponse> {
  const timeInfo = getBuenosAiresTime();
  const toolTrace: ToolTraceEntry[] = [];

  const initialState: TripState = req.tripState
    ? {
        originQuery: req.tripState.originQuery || '',
        originConfirmed: req.tripState.originConfirmed || null,
        destinationQuery: req.tripState.destinationQuery || '',
        destinationConfirmed: req.tripState.destinationConfirmed || null,
        timeSpec: req.tripState.timeSpec || { mode: 'ahora', rawText: 'ahora' },
        constraints: req.constraints || req.tripState.constraints,
        preference: req.preference || req.tripState.preference,
        pendingClarification: req.tripState.pendingClarification || null,
      }
    : {
        originQuery: '',
        originConfirmed: null,
        destinationQuery: '',
        destinationConfirmed: null,
        timeSpec: { mode: 'ahora', rawText: 'ahora' },
        constraints: req.constraints,
        preference: req.preference,
        pendingClarification: null,
      };

  const historyTranscript = req.history
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'Usuario' : RUMA_BRANDING.visibleName}: ${m.content}`)
    .join('\n\n');

  const intentPrompt = [
    historyTranscript ? `Historial reciente:\n${historyTranscript}\n` : '',
    `Estado estructurado actual del viaje:\n${JSON.stringify({
      origen: initialState.originQuery || null,
      destino: initialState.destinationQuery || null,
      horario: initialState.timeSpec,
      constraints: initialState.constraints,
      preference: initialState.preference,
    })}`,
    `Último mensaje del usuario: "${req.message}"`,
  ]
    .filter(Boolean)
    .join('\n');

  let rawExtracted: ExtractedStateOps = { intentType: 'general_help' };
  try {
    const intentRes = await callGeminiSafe({
      model: 'gemini-3.1-flash-lite',
      contents: intentPrompt,
      config: {
        systemInstruction: INTENT_EXTRACTION_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intentType: {
              type: Type.STRING,
              enum: [
                'plan_route',
                'network_status',
                'accessibility_info',
                'clarification_needed',
                'out_of_scope',
                'general_help',
              ],
            },
            originOp: { type: Type.STRING, enum: ['KEEP', 'SET', 'REMOVE'] },
            originText: { type: Type.STRING },
            destinationOp: { type: Type.STRING, enum: ['KEEP', 'SET', 'REMOVE'] },
            destinationText: { type: Type.STRING },
            timeOp: { type: Type.STRING, enum: ['KEEP', 'SET_NOW', 'SET_CUSTOM', 'ASK'] },
            timeMode: { type: Type.STRING, enum: ['ahora', 'departure', 'arrival'] },
            timeRawText: { type: Type.STRING },
            timeAmbiguityQuestion: { type: Type.STRING },
            evitarEscalerasOp: { type: Type.STRING, enum: ['KEEP', 'SET_TRUE', 'SET_FALSE', 'ASK'] },
            requiereAscensorOp: { type: Type.STRING, enum: ['KEEP', 'SET_TRUE', 'SET_FALSE', 'ASK'] },
            soloCaminataOp: { type: Type.STRING, enum: ['KEEP', 'SET_TRUE', 'SET_FALSE'] },
            addAvoidModes: {
              type: Type.ARRAY,
              items: { type: Type.STRING, enum: ['bus', 'subte', 'tren'] },
            },
            removeAvoidModes: {
              type: Type.ARRAY,
              items: { type: Type.STRING, enum: ['bus', 'subte', 'tren'] },
            },
            maxCaminataOp: { type: Type.STRING, enum: ['KEEP', 'SET', 'REMOVE'] },
            maxCaminataMetros: { type: Type.NUMBER },
            maxTransbordosOp: { type: Type.STRING, enum: ['KEEP', 'SET', 'REMOVE'] },
            maxTransbordos: { type: Type.NUMBER },
            preferenceOp: { type: Type.STRING, enum: ['KEEP', 'SET'] },
            preference: {
              type: Type.STRING,
              enum: [
                'balanceado',
                'menor_duracion',
                'menos_caminata',
                'menos_transbordos',
                'mayor_accesibilidad',
              ],
            },
            clarificationQuestion: { type: Type.STRING },
          },
          required: ['intentType'],
        },
      },
    });

    const rawText = (intentRes.text || '{}')
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    rawExtracted = JSON.parse(rawText) as ExtractedStateOps;
  } catch (err) {
    console.error('[RUMA] Intent extraction fallback:', err instanceof Error ? err.message : String(err));
    // No bloquear el procesamiento determinístico por agotamiento de cuota Gemini.
    // La red de reglas local puede extraer ubicaciones/intersecciones y actualizar
    // restricciones sin generar texto ni consumir otra cuota de IA.
    rawExtracted = { intentType: 'general_help' };
  }

  const ops = applyDeterministicNlpSafetyNet(req.message, initialState, rawExtracted);
  const {
    nextState,
    changedOriginOrDest,
    changedTime,
    changedTravelFiltersForApi,
    clarificationNeeded,
  } = reduceTripState(initialState, ops);

  const accessibilityRequested = Boolean(
    nextState.constraints.evitarEscaleras ||
      nextState.constraints.requiereAscensorConfirmado ||
      nextState.preference === 'mayor_accesibilidad' ||
      detectAccessibilityQuery(req.message)
  );

  let backendFacts: Record<string, unknown> = {
    mode: req.mode,
    horaConsultaCABA: `${timeInfo.horaLocalCABA} ART`,
    intentType: ops.intentType,
    accessibilityRequested,
    constraints: nextState.constraints,
    preference: nextState.preference,
    timeSpec: nextState.timeSpec,
  };

  let capturedRoutes: CandidateRoute[] | undefined;
  let routeError: RouteQueryError | undefined;
  let rerankedOnly = false;

  if (clarificationNeeded) {
    backendFacts = {
      ...backendFacts,
      clarificationQuestion: clarificationNeeded,
    };
  } else if (
    ops.intentType === 'plan_route' &&
    nextState.originQuery.trim() &&
    nextState.destinationQuery.trim()
  ) {
    // Check if we can safely re-rank existing routes without burning an upstream Google Routes API call
    const canRerankCached =
      req.mode === 'real' &&
      !changedOriginOrDest &&
      !changedTime &&
      !changedTravelFiltersForApi &&
      Array.isArray(req.cachedRoutes) &&
      req.cachedRoutes.length > 0 &&
      req.cachedRoutes.every((r) => r.mode === 'real' && !r.isSynthetic);

    if (canRerankCached) {
      const reranked = evaluateDeduplicateAndRankRoutes(
        req.cachedRoutes!,
        nextState.constraints,
        nextState.preference,
        { accessibilityRequested }
      );
      capturedRoutes = reranked.presentedRoutes;
      rerankedOnly = true;

      toolTrace.push({
        toolName: 'reordenar_rutas_en_sesion',
        args: {
          preference: nextState.preference,
          maxCaminataMetros: nextState.constraints.maxCaminataMetros,
          maxTransbordos: nextState.constraints.maxTransbordos,
        },
        provenance: 'api_google_maps',
        timestamp: timeInfo.horaLocalCABA,
      });

      backendFacts = {
        ...backendFacts,
        rerankedWithoutNewUpstreamCall: true,
        ningunaCumpleRestricciones: reranked.ningunaCumpleRestricciones,
        routesSummary: capturedRoutes.map((r) => ({
          titulo: r.titulo,
          esRecomendada: r.esRecomendada,
          durationMin: r.durationMin,
          walkMeters: r.walkMeters,
          transfers: r.transfers,
          accessStatus: r.accessStatus,
          constraintsSatisfied: r.constraintsSatisfied,
          disqualificationReasons: r.disqualificationReasons,
          recommendationReasons: r.recommendationReasons,
          warnings: r.warnings,
        })),
      };
    } else if (req.mode === 'real') {
      const realPlan = await planRealCabaRoutes({
        origen: nextState.originQuery.trim(),
        destino: nextState.destinationQuery.trim(),
        originPlaceId: nextState.originConfirmed?.placeId,
        destinationPlaceId: nextState.destinationConfirmed?.placeId,
        timeSpec: nextState.timeSpec,
        constraints: nextState.constraints,
        preference: nextState.preference,
        accessibilityRequested,
      });

      if (realPlan.resolvedOrigin && realPlan.resolvedOrigin.isInsideCaba) {
        nextState.originConfirmed = realPlan.resolvedOrigin;
      }
      if (realPlan.resolvedDestination && realPlan.resolvedDestination.isInsideCaba) {
        nextState.destinationConfirmed = realPlan.resolvedDestination;
      }
      if (realPlan.momentLabel) {
        nextState.timeSpec = { ...nextState.timeSpec, humanLabel: realPlan.momentLabel };
      }

      toolTrace.push({
        toolName: 'google_maps_routes_and_geocoding',
        args: {
          origen: nextState.originQuery.trim(),
          destino: nextState.destinationQuery.trim(),
          horario: nextState.timeSpec.humanLabel || nextState.timeSpec.rawText || 'ahora',
          modo: nextState.constraints.soloCaminata ? 'WALK' : 'TRANSIT',
          preference: nextState.preference,
        },
        provenance: realPlan.ok ? 'api_google_maps' : 'informacion_no_disponible',
        timestamp: timeInfo.horaLocalCABA,
      });

      if (realPlan.ok) {
        capturedRoutes = realPlan.routes;
      } else {
        routeError = realPlan.error;
      }

      backendFacts = {
        ...backendFacts,
        resolvedOrigin: realPlan.resolvedOrigin?.formattedAddress,
        resolvedDestination: realPlan.resolvedDestination?.formattedAddress,
        momentLabel: realPlan.momentLabel,
        ningunaCumpleRestricciones: realPlan.ningunaCumpleRestricciones,
        emovaUrl: EMOVA_ACCESSIBILITY_URL,
        emovaPhone: EMOVA_ACCESSIBILITY_PHONE,
        routeError: realPlan.error ? { code: realPlan.error.code, message: realPlan.error.message } : undefined,
        // IMPORTANT: No rankingScore / no numeric formula leaked to Gemini
        routesSummary: realPlan.routes.map((r) => ({
          titulo: r.titulo,
          esRecomendada: r.esRecomendada,
          travelModeUsed: r.travelModeUsed,
          durationMin: r.durationMin,
          walkMeters: r.walkMeters,
          transfers: r.transfers,
          departureTime: r.departureTime,
          arrivalTime: r.arrivalTime,
          accessStatus: r.accessStatus,
          constraintsSatisfied: r.constraintsSatisfied,
          disqualificationReasons: r.disqualificationReasons,
          recommendationReasons: r.recommendationReasons,
          warnings: r.warnings,
          notasAccesibilidad: r.notasAccesibilidad,
          datosDesconocidos: r.datosDesconocidos,
        })),
      };
    } else {
      const demoPlan = planCabaRoutes({
        origen: nextState.originQuery.trim(),
        destino: nextState.destinationQuery.trim(),
        momento: nextState.timeSpec.rawText || 'ahora',
        constraints: nextState.constraints,
        preference: nextState.preference,
        flags: req.scenarioFlags,
      });

      toolTrace.push({
        toolName: 'planificar_rutas_caba_demo',
        args: {
          origen: nextState.originQuery.trim(),
          destino: nextState.destinationQuery.trim(),
          horario: nextState.timeSpec.rawText || 'ahora',
        },
        provenance: demoPlan.ok ? 'dato_simulado + estimacion_viaje' : 'informacion_no_disponible',
        timestamp: timeInfo.horaLocalCABA,
      });

      if ('alternativas' in demoPlan && Array.isArray(demoPlan.alternativas)) {
        capturedRoutes = demoPlan.alternativas
          .slice(0, 3)
          .map((r) => enrichRouteAccessibilityMetadata(r, accessibilityRequested));
      }

      backendFacts = {
        ...backendFacts,
        demoPlan: {
          ...demoPlan,
          alternativas: capturedRoutes,
        },
      };
    }
  } else if (ops.intentType === 'network_status' || ops.intentType === 'accessibility_info') {
    if (req.mode === 'real') {
      const realNet = getRealNetworkStatusRecords();
      toolTrace.push({
        toolName: 'consultar_fuentes_oficiales_caba',
        args: { scope: ops.intentType },
        provenance: 'informacion_no_disponible',
        timestamp: timeInfo.horaLocalCABA,
      });
      backendFacts = {
        ...backendFacts,
        networkServices: realNet.services,
        accessibilityRecords: realNet.accessibility,
        officialSourcesNotice: realNet.officialSourcesNotice,
      };
    } else {
      const simServices = getSimulatedServiceStatuses(req.scenarioFlags);
      const simAcc = getStationAccessibilityData(req.scenarioFlags);
      toolTrace.push({
        toolName: 'consultar_escenario_demo',
        args: { scope: ops.intentType },
        provenance: 'dato_simulado',
        timestamp: timeInfo.horaLocalCABA,
      });
      backendFacts = {
        ...backendFacts,
        networkServices: simServices,
        accessibilityRecords: simAcc,
      };
    }
  } else {
    backendFacts = {
      ...backendFacts,
      clarificationQuestion: ops.clarificationQuestion || 'Indicame desde dónde hasta dónde querés viajar dentro de CABA.',
      userMessage: req.message,
    };
  }

  let finalReply = '';
  if (clarificationNeeded) {
    finalReply = clarificationNeeded;
  } else if (capturedRoutes?.length || routeError) {
    // Una segunda llamada al LLM para explicar datos ya estructurados no aporta
    // precisión y consume cuota. Las tarjetas contienen la información operativa.
    finalReply = buildGroundedFallbackReply({
      mode: req.mode,
      timeStr: timeInfo.horaLocalCABA,
      routes: capturedRoutes,
      routeError,
      accessibilityRequested,
    });
  } else if (req.mode === 'real' && ops.intentType === 'network_status') {
    finalReply = 'No tengo un estado en vivo confirmado de esa línea o servicio. Consultá la fuente oficial antes de viajar; si me indicás origen y destino, puedo buscar opciones de viaje.';
  } else if (req.mode === 'real' && ops.intentType === 'accessibility_info') {
    finalReply = `No puedo confirmar en vivo el funcionamiento actual de ascensores ni las rampas de colectivos. Las escaleras mecánicas no reemplazan el ascensor para silla de ruedas. Podés consultar el estado oficial de ascensores en EMOVA (${EMOVA_ACCESSIBILITY_URL}) o llamar al ${EMOVA_ACCESSIBILITY_PHONE}.`;
  } else {
    const explainPrompt = [
      `Mensaje del usuario: "${req.message}"`,
      `Datos verificados (JSON):\n${JSON.stringify(backendFacts, null, 2)}`,
      `Redactá una respuesta breve, práctica y honesta siguiendo las reglas.`,
    ].join('\n\n');

    try {
      const explainRes = await callGeminiSafe({
        model: 'gemini-3.1-flash-lite',
        contents: explainPrompt,
        config: {
          systemInstruction: EXPLANATION_SYSTEM_INSTRUCTION,
        },
      });
      finalReply = explainRes.text?.trim() || '';
    } catch (err) {
      console.error('[RUMA] Explanation fallback:', err instanceof Error ? err.message : String(err));
    }
  }

  if (!finalReply) {
    finalReply = buildGroundedFallbackReply({
      mode: req.mode,
      timeStr: timeInfo.horaLocalCABA,
      routes: capturedRoutes,
      routeError,
      clarification: clarificationNeeded,
      accessibilityRequested,
    });
  }

  return {
    reply: finalReply,
    mode: req.mode,
    isSimulatedData: req.mode === 'demo',
    toolTrace,
    routes: capturedRoutes,
    routeError,
    horaConsultaCABA: timeInfo.horaLocalCABA,
    updatedTripState: nextState,
    rerankedOnly,
    clarificationQuestion: clarificationNeeded,
    accessibilityRequested,
  };
}
