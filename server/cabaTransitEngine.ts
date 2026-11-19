import type {
  CandidateRoute,
  PreferenceMode,
  ScenarioFlags,
  StationAccessibilityRecord,
  TransitServiceStatus,
  TravelConstraints,
} from '../src/shared/rumaTypes.ts';

export const DEFAULT_SCENARIO_FLAGS: ScenarioFlags = {
  linea_d_obras: false,
  linea_b_demora: false,
  ascensor_peru_fuera: false,
  corte_9dejulio: false,
  lluvia_intensa: false,
};

export function getBuenosAiresTime() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const timeOnly = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return {
    iso: now.toISOString(),
    horaLocalCABA: timeOnly.format(now),
    fechaHoraLegible: formatter.format(now),
    zonaHoraria: 'America/Argentina/Buenos_Aires (ART, UTC-3)',
    proveniencia: 'informacion_confirmada',
    fuente: 'Reloj del sistema del servidor',
  };
}

export function getSimulatedServiceStatuses(flags: ScenarioFlags): TransitServiceStatus[] {
  const timeInfo = getBuenosAiresTime();
  const nowStr = timeInfo.horaLocalCABA;

  const rawItems: Array<Omit<TransitServiceStatus, 'status' | 'sourceName' | 'provenance' | 'queriedAt' | 'isSynthetic' | 'limitations'>> = [
    {
      id: 'subte-a',
      nombre: 'Subte Línea A',
      tipo: 'Subte',
      estado: flags.ascensor_peru_fuera ? 'demora' : 'normal',
      estadoEtiqueta: flags.ascensor_peru_fuera ? 'Operativa con restricción de accesibilidad' : 'Servicio habitual',
      detalle: flags.ascensor_peru_fuera
        ? 'Circulación normal entre Plaza de Mayo y San Pedrito, pero el ascensor de estación Perú se encuentra fuera de servicio en este escenario simulado.'
        : 'Circulación habitual entre Plaza de Mayo y San Pedrito (frecuencia estimada 4-6 min en hora pico).',
      afectaciones: flags.ascensor_peru_fuera ? ['Ascensor de estación Perú fuera de servicio'] : [],
      fuente: 'Base de demostración RUMA (IFTS N.º 12)',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'subte-b',
      nombre: 'Subte Línea B',
      tipo: 'Subte',
      estado: flags.linea_b_demora ? 'demora' : 'normal',
      estadoEtiqueta: flags.linea_b_demora ? 'Con demoras' : 'Servicio habitual',
      detalle: flags.linea_b_demora
        ? 'Demoras simuladas por falla técnica en zona Pueyrredón – Medrano. Intervalos estimados de 10 a 14 minutos.'
        : 'Circulación habitual entre Leandro N. Alem y Juan Manuel de Rosas.',
      afectaciones: flags.linea_b_demora ? ['Demoras de +12 min estimados entre Alem y Rosas'] : [],
      fuente: 'Base de demostración RUMA (IFTS N.º 12)',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'subte-c',
      nombre: 'Subte Línea C',
      tipo: 'Subte',
      estado: 'normal',
      estadoEtiqueta: 'Servicio habitual',
      detalle: 'Circulación entre Constitución y Retiro. Estaciones centrales con alto flujo de transbordos.',
      afectaciones: [],
      fuente: 'Base de demostración RUMA (IFTS N.º 12)',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'subte-d',
      nombre: 'Subte Línea D',
      tipo: 'Subte',
      estado: flags.linea_d_obras ? 'interrumpido' : 'normal',
      estadoEtiqueta: flags.linea_d_obras ? 'Servicio limitado por obras' : 'Servicio habitual',
      detalle: flags.linea_d_obras
        ? 'Escenario simulado: estación Pueyrredón cerrada por obras y servicio limitado entre Catedral y Callao, con demoras hacia Congreso de Tucumán.'
        : 'Circulación habitual entre Catedral y Congreso de Tucumán.',
      afectaciones: flags.linea_d_obras ? ['Estación Pueyrredón cerrada', 'Servicio limitado / demoras en tramo norte'] : [],
      fuente: 'Base de demostración RUMA (IFTS N.º 12)',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'subte-e',
      nombre: 'Subte Línea E',
      tipo: 'Subte',
      estado: 'normal',
      estadoEtiqueta: 'Servicio habitual',
      detalle: 'Circulación entre Retiro y Plaza de los Virreyes.',
      afectaciones: [],
      fuente: 'Base de demostración RUMA (IFTS N.º 12)',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'subte-h',
      nombre: 'Subte Línea H',
      tipo: 'Subte',
      estado: 'normal',
      estadoEtiqueta: 'Servicio habitual',
      detalle: 'Circulación entre Facultad de Derecho y Hospitales. Línea con mayor cobertura de ascensores modernos en su traza.',
      afectaciones: [],
      fuente: 'Base de demostración RUMA (IFTS N.º 12)',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'premetro',
      nombre: 'Premetro',
      tipo: 'Premetro',
      estado: 'desconocido',
      estadoEtiqueta: 'Estado en vivo no confirmado',
      detalle: 'No se dispone de telemetría en tiempo real para el Premetro en este prototipo.',
      afectaciones: ['Estado operativo actual no verificable automáticamente'],
      fuente: 'Registro de cobertura RUMA',
      proveniencia: 'informacion_no_disponible',
      actualizadoEn: nowStr,
    },
    {
      id: 'metrobus-9julio',
      nombre: 'Metrobús 9 de Julio (Líneas 9, 10, 17, 45, 59, 67, 70, 100)',
      tipo: 'Colectivo / Metrobús',
      estado: flags.corte_9dejulio ? 'desvio' : 'normal',
      estadoEtiqueta: flags.corte_9dejulio ? 'Desvíos por corte' : 'Circulación habitual',
      detalle: flags.corte_9dejulio
        ? 'Corte simulado por movilización en Av. 9 de Julio y Av. Corrientes. Colectivos realizan desvíos por calles paralelas con demoras de 15 a 20 min.'
        : 'Circulación por carriles exclusivos entre Constitución y Retiro.',
      afectaciones: flags.corte_9dejulio ? ['Corte total en Obelisco / Av. Corrientes', 'Desvíos con demora estimada +15 min'] : [],
      fuente: 'Base de demostración RUMA (IFTS N.º 12)',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'metrobus-bajo-santafe',
      nombre: 'Corredor Santa Fe / Bajo (Líneas 12, 39, 60, 152)',
      tipo: 'Colectivo / Metrobús',
      estado: flags.corte_9dejulio ? 'demora' : 'normal',
      estadoEtiqueta: flags.corte_9dejulio ? 'Demoras por congestión' : 'Circulación habitual',
      detalle: flags.corte_9dejulio
        ? 'Demoras indirectas en el entorno del Microcentro y Av. Callao por desvío de tránsito desde Av. 9 de Julio.'
        : 'Frecuencia estimada de 5 a 9 minutos en corredor principal.',
      afectaciones: flags.corte_9dejulio ? ['Congestión en cruces hacia Microcentro'] : [],
      fuente: 'Base de demostración RUMA (IFTS N.º 12)',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'ciudad-univ-colectivos',
      nombre: 'Colectivos a Ciudad Universitaria (Líneas 33, 37, 42, 45, 107, 160)',
      tipo: 'Colectivo / Metrobús',
      estado: 'normal',
      estadoEtiqueta: 'Servicio habitual (frecuencia estimada)',
      detalle: 'Acceso directo a Pabellones I, II y III de Ciudad Universitaria. Unidades de piso bajo mayoritarias, sujeto a disponibilidad de unidad.',
      afectaciones: [],
      fuente: 'Base de demostración RUMA (IFTS N.º 12)',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'ffcc-belgrano-norte',
      nombre: 'Tren Belgrano Norte (Retiro – Ciudad Universitaria)',
      tipo: 'Tren Urbano',
      estado: 'normal',
      estadoEtiqueta: 'Servicio habitual (horarios programados)',
      detalle: 'Conecta Retiro con estación Ciudad Universitaria en ~16 min de viaje. Andenes elevados modernos con acceso por rampa.',
      afectaciones: [],
      fuente: 'Base de demostración RUMA (IFTS N.º 12)',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'ffcc-sarmiento',
      nombre: 'Tren Sarmiento (Once – Caballito – Flores)',
      tipo: 'Tren Urbano',
      estado: 'normal',
      estadoEtiqueta: 'Servicio habitual',
      detalle: 'Conexión rápida oeste-centro entre Once, Caballito y Flores. Pasos peatonales y rampas según estación.',
      afectaciones: [],
      fuente: 'Base de demostración RUMA (IFTS N.º 12)',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
  ];

  return rawItems.map((item) => ({
    ...item,
    status: item.proveniencia === 'informacion_no_disponible' ? 'unverified' : 'simulated',
    sourceName: item.fuente,
    provenance: item.proveniencia,
    queriedAt: timeInfo.iso,
    sourceUpdatedAt: nowStr,
    isSynthetic: true,
    limitations:
      'Datos simulados del escenario de demostración académico; no representan estado operativo real en vivo.',
  }));
}

export function getStationAccessibilityData(flags: ScenarioFlags): StationAccessibilityRecord[] {
  const timeInfo = getBuenosAiresTime();
  const nowStr = timeInfo.horaLocalCABA;
  const rawRecords: Array<Omit<StationAccessibilityRecord, 'status' | 'sourceName' | 'provenance' | 'queriedAt' | 'isSynthetic' | 'limitations'>> = [
    {
      id: 'ifts-12-balvanera',
      estacion: 'Sede IFTS N.º 12 / Zona Balvanera (Av. Rivadavia / Pasco)',
      linea: 'Entorno peatonal / Subte A (Pasco / Alberti)',
      barrio: 'Balvanera',
      ascensor: 'sin_ascensor',
      escaleraMecanica: 'no_posee',
      rampaAcceso: false,
      barrerasConocidas: ['Estación Pasco (Línea A) solo sentido a San Pedrito y sin ascensor', 'Estación Alberti (Línea A) sin ascensor'],
      observaciones: 'Las estaciones Pasco y Alberti poseen acceso únicamente por escalera fija. Para viaje sin escaleras se recomienda caminar a parada de colectivo sobre Av. Rivadavia o desplazarse a Once / Congreso.',
      fuente: 'Relevamiento base prototipo IFTS N.º 12',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'once-h-a',
      estacion: 'Once - 30 de Diciembre / Plaza Miserere',
      linea: 'Subte Línea H / Línea A',
      barrio: 'Balvanera',
      ascensor: 'operativo_confirmado',
      escaleraMecanica: 'disponible',
      rampaAcceso: true,
      barrerasConocidas: ['Combinación subterránea entre H y A extensa (~180 m)', 'Alto flujo peatonal en hora pico'],
      observaciones: 'Línea H cuenta con ascensor desde vía pública hasta andén confirmado operativo en escenario demo. El transbordo hacia Línea A requiere pasillo largo.',
      fuente: 'Base de demostración RUMA',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'corrientes-h',
      estacion: 'Corrientes / Pueyrredón',
      linea: 'Subte Línea H / Línea B',
      barrio: 'Balvanera',
      ascensor: 'operativo_confirmado',
      escaleraMecanica: 'disponible',
      rampaAcceso: true,
      barrerasConocidas: ['Paso de combinación entre Línea H y Línea B con desniveles intermedios en sector antiguo de Línea B'],
      observaciones: 'Estación Corrientes (Línea H) posee ascensores confirmados. En sector Línea B (Pueyrredón), el estado de medios de elevación hacia todos los andenes presenta restricciones en sentido Alem.',
      fuente: 'Base de demostración RUMA',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'peru-a',
      estacion: 'Perú / Catedral / Bolívar',
      linea: 'Subte Línea A (nodo Microcentro)',
      barrio: 'San Nicolás',
      ascensor: flags.ascensor_peru_fuera ? 'fuera_de_servicio' : 'operativo_confirmado',
      escaleraMecanica: flags.ascensor_peru_fuera ? 'fuera_de_servicio' : 'disponible',
      rampaAcceso: true,
      barrerasConocidas: flags.ascensor_peru_fuera
        ? ['Ascensor principal de Perú fuera de servicio en escenario simulado', 'Escaleras fijas obligatorias en acceso norte']
        : ['Pasillo de combinación A-D-E con pendientes suaves y tramos concurridos'],
      observaciones: flags.ascensor_peru_fuera
        ? 'ALERTA DEMO: El ascensor de estación Perú figura fuera de servicio; no cumple criterio de accesibilidad sin escaleras.'
        : 'Ascensor operativo confirmado en escenario demo entre superficie, boletería y andenes.',
      fuente: 'Base de demostración RUMA',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'carlos-pellegrini-9julio',
      estacion: 'Nodo Obelisco (9 de Julio / Diagonal Norte / C. Pellegrini)',
      linea: 'Subte Líneas B, C, D',
      barrio: 'San Nicolás',
      ascensor: 'estado_desconocido',
      escaleraMecanica: 'desconocido',
      rampaAcceso: null,
      barrerasConocidas: ['Múltiples pasillos de combinación subterránea con escaleras cortas entre niveles', 'Estado operativo de ascensores de vinculación no confirmado en tiempo real'],
      observaciones: 'Aunque existen ascensores registrados en el nodo, su estado operativo simultáneo en los tres niveles es DESCONOCIDO en la fuente actual. RUMA no certifica este transbordo como accesible confirmado.',
      fuente: 'Base de demostración RUMA',
      proveniencia: 'informacion_no_disponible',
      actualizadoEn: nowStr,
    },
    {
      id: 'palermo-d',
      estacion: 'Palermo',
      linea: 'Subte Línea D / Metrobús Juan B. Justo / FFCC San Martín',
      barrio: 'Palermo',
      ascensor: 'estado_desconocido',
      escaleraMecanica: 'disponible',
      rampaAcceso: true,
      barrerasConocidas: ['Acceso desde vereda con escaleras mecánicas; estado actual del ascensor a andén sin confirmación en vivo'],
      observaciones: 'Paradores de Metrobús sobre Av. Santa Fe y Av. Juan B. Justo cuentan con rampas a nivel de vereda.',
      fuente: 'Base de demostración RUMA',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'plaza-italia-d',
      estacion: 'Plaza Italia',
      linea: 'Subte Línea D / Nodo de colectivos',
      barrio: 'Palermo',
      ascensor: 'operativo_confirmado',
      escaleraMecanica: 'disponible',
      rampaAcceso: true,
      barrerasConocidas: ['Cruce peatonal amplio alrededor de la rotonda en hora pico'],
      observaciones: 'Paradores de colectivos sobre Av. Santa Fe accesibles mediante rampas peatonales.',
      fuente: 'Base de demostración RUMA',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'juramento-d',
      estacion: 'Juramento',
      linea: 'Subte Línea D / Metrobús Cabildo',
      barrio: 'Belgrano',
      ascensor: 'operativo_confirmado',
      escaleraMecanica: 'disponible',
      rampaAcceso: true,
      barrerasConocidas: [],
      observaciones: 'Estación con ascensor operativo confirmado y conexión directa a nivel con paradores del Metrobús Norte (Av. Cabildo).',
      fuente: 'Base de demostración RUMA',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'acoyte-a',
      estacion: 'Acoyte',
      linea: 'Subte Línea A / Colectivos Av. Rivadavia',
      barrio: 'Caballito',
      ascensor: 'sin_ascensor',
      escaleraMecanica: 'no_posee',
      rampaAcceso: false,
      barrerasConocidas: ['Acceso únicamente por escaleras fijas en ambos andenes'],
      observaciones: 'Estación histórica sin ascensor. Alternativa accesible cercana: estación San José de Flores o líneas de colectivo de piso bajo sobre Av. Rivadavia.',
      fuente: 'Base de demostración RUMA',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'constitucion-c',
      estacion: 'Constitución',
      linea: 'Subte Línea C / FFCC Roca / Metrobús Sur',
      barrio: 'Constitución',
      ascensor: 'operativo_confirmado',
      escaleraMecanica: 'disponible',
      rampaAcceso: true,
      barrerasConocidas: ['Alta densidad peatonal en hall central y vinculación con trenes'],
      observaciones: 'Hall ferroviario y acceso principal a Línea C con ascensores confirmados operativos en escenario demo.',
      fuente: 'Base de demostración RUMA',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'retiro-c-e',
      estacion: 'Retiro',
      linea: 'Subte Líneas C y E / FFCC Mitre, Belgrano Norte, San Martín',
      barrio: 'Retiro',
      ascensor: 'operativo_confirmado',
      escaleraMecanica: 'disponible',
      rampaAcceso: true,
      barrerasConocidas: ['Distancia peatonal considerable (~250 m) entre estación Subte E y andenes de FFCC Belgrano Norte'],
      observaciones: 'Estación Retiro de Línea E y terminal Belgrano Norte poseen accesos a nivel o por ascensor confirmado en este escenario.',
      fuente: 'Base de demostración RUMA',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'parque-patricios-h',
      estacion: 'Parque Patricios / Hospitales',
      linea: 'Subte Línea H',
      barrio: 'Parque Patricios',
      ascensor: 'operativo_confirmado',
      escaleraMecanica: 'disponible',
      rampaAcceso: true,
      barrerasConocidas: [],
      observaciones: 'Estaciones modernas de Línea H con ascensores directos calle-boletería-andén.',
      fuente: 'Base de demostración RUMA',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'ciudad-universitaria',
      estacion: 'Ciudad Universitaria (Pabellones y Estación FFCC)',
      linea: 'FFCC Belgrano Norte / Colectivos 33, 37, 42, 45, 107, 160',
      barrio: 'Belgrano / Núñez',
      ascensor: 'operativo_confirmado',
      escaleraMecanica: 'no_posee',
      rampaAcceso: true,
      barrerasConocidas: ['Desde el puente peatonal de estación FFCC hasta Pabellón II hay ~380 m de caminata descubierta'],
      observaciones: 'Paradas de colectivo ingresan al circuito interno de Ciudad Universitaria con menor caminata final hasta los pabellones.',
      fuente: 'Base de demostración RUMA',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
    {
      id: 'hospital-italiano',
      estacion: 'Hospital Italiano / Zona Medrano (Almagro)',
      linea: 'Subte Línea B (Medrano / Ángel Gallardo) / Colectivos 24, 26, 92, 109, 128, 160',
      barrio: 'Almagro',
      ascensor: 'estado_desconocido',
      escaleraMecanica: 'disponible',
      rampaAcceso: true,
      barrerasConocidas: ['Estación Medrano (Línea B) sin ascensor confirmado en ambos sentidos'],
      observaciones: 'Para acceso sin escaleras hacia Hospital Italiano (Potosí / Tte. Gral. Perón), los colectivos de piso bajo por Av. Díaz Vélez / Corrientes resultan más predecibles que el Subte B.',
      fuente: 'Base de demostración RUMA',
      proveniencia: 'dato_simulado',
      actualizadoEn: nowStr,
    },
  ];

  return rawRecords.map((rec) => ({
    ...rec,
    status:
      rec.ascensor === 'estado_desconocido'
        ? 'unverified'
        : rec.ascensor === 'sin_ascensor' || rec.ascensor === 'fuera_de_servicio'
          ? 'not_accessible'
          : 'simulated',
    sourceName: rec.fuente,
    provenance: rec.proveniencia,
    queriedAt: timeInfo.iso,
    sourceUpdatedAt: nowStr,
    isSynthetic: true,
    limitations:
      'Registro de demostración del prototipo académico; verificar accesibilidad real en canales oficiales (Emova / GCBA).',
  }));
}

interface CabaNode {
  id: string;
  nombre: string;
  barrio: string;
  aliases: string[];
}

const CABA_NODES: CabaNode[] = [
  {
    id: 'ifts12',
    nombre: 'IFTS N.º 12 (Balvanera / Av. Rivadavia y Pasco)',
    barrio: 'Balvanera',
    aliases: ['ifts 12', 'ifts nº 12', 'ifts', 'balvanera', 'pasco', 'alberti', 'rivadavia y pasco', 'congreso'],
  },
  {
    id: 'once',
    nombre: 'Once / Plaza Miserere',
    barrio: 'Balvanera',
    aliases: ['once', 'plaza miserere', 'miserere', 'pueyrredon y rivadavia'],
  },
  {
    id: 'obelisco',
    nombre: 'Obelisco / Microcentro (Av. 9 de Julio y Corrientes)',
    barrio: 'San Nicolás',
    aliases: ['obelisco', 'microcentro', 'centro', '9 de julio', 'carlos pellegrini', 'diagonal norte', 'tribunales', 'corrientes y 9 de julio'],
  },
  {
    id: 'plaza_de_mayo',
    nombre: 'Plaza de Mayo / Perú',
    barrio: 'Monserrat / San Nicolás',
    aliases: ['plaza de mayo', 'casa rosada', 'catedral', 'peru', 'bolivar', 'san telmo norte'],
  },
  {
    id: 'palermo',
    nombre: 'Palermo (Plaza Italia / Pacífico)',
    barrio: 'Palermo',
    aliases: ['palermo', 'plaza italia', 'pacifico', 'santa fe y juan b justo', 'alto palermo', 'scabrini ortiz'],
  },
  {
    id: 'belgrano',
    nombre: 'Belgrano (Av. Cabildo y Juramento)',
    barrio: 'Belgrano',
    aliases: ['belgrano', 'cabildo y juramento', 'juramento', 'barrancas de belgrano', 'congreso de tucuman'],
  },
  {
    id: 'ciudad_universitaria',
    nombre: 'Ciudad Universitaria (UBA)',
    barrio: 'Núñez / Belgrano',
    aliases: ['ciudad universitaria', 'fadu', 'exactas', 'pabellon 2', 'pabellon 3', 'uba nuñez'],
  },
  {
    id: 'caballito',
    nombre: 'Caballito (Av. Rivadavia y Acoyte)',
    barrio: 'Caballito',
    aliases: ['caballito', 'acoyte', 'primera junta', 'parque rivadavia', 'pedro goyena'],
  },
  {
    id: 'constitucion',
    nombre: 'Constitución (Estación Terminal)',
    barrio: 'Constitución',
    aliases: ['constitucion', 'plaza constitucion', 'terminal constitucion'],
  },
  {
    id: 'retiro',
    nombre: 'Retiro (Centro de Transbordo)',
    barrio: 'Retiro',
    aliases: ['retiro', 'terminal retiro', 'estacion retiro', 'catalinas'],
  },
  {
    id: 'parque_patricios',
    nombre: 'Parque Patricios / Distrito Tecnológico',
    barrio: 'Parque Patricios',
    aliases: ['parque patricios', 'hospitales', 'caseros', 'distrito tecnologico'],
  },
  {
    id: 'hospital_italiano',
    nombre: 'Hospital Italiano / Almagro (Medrano)',
    barrio: 'Almagro',
    aliases: ['hospital italiano', 'almagro', 'medrano', 'angel gallardo', 'potossi'],
  },
  {
    id: 'san_telmo',
    nombre: 'San Telmo (Av. Independencia / Defensa)',
    barrio: 'San Telmo',
    aliases: ['san telmo', 'plaza dorrego', 'independencia', 'san juan'],
  },
  {
    id: 'flores',
    nombre: 'Flores (Plaza Flores / San Pedrito)',
    barrio: 'Flores',
    aliases: ['flores', 'plaza flores', 'san pedrito', 'san jose de flores'],
  },
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveCabaNode(query: string): CabaNode | null {
  const norm = normalizeText(query);
  if (!norm) return null;

  for (const node of CABA_NODES) {
    if (normalizeText(node.nombre) === norm || node.id === norm) {
      return node;
    }
    for (const alias of node.aliases) {
      const normAlias = normalizeText(alias);
      if (norm === normAlias || norm.includes(normAlias) || normAlias.includes(norm)) {
        return node;
      }
    }
  }
  return null;
}

interface RawOption {
  id: string;
  titulo: string;
  resumen: string;
  tramos: RouteLegTemplate[];
  datosDesconocidos?: string[];
  notasAccesibilidad?: string[];
}

interface RouteLegTemplate {
  modo: 'caminata' | 'subte' | 'colectivo' | 'tren';
  linea?: string;
  serviceId?: string;
  stationIds?: string[];
  desde: string;
  hasta: string;
  baseDuracionMin: number;
  distanciaMetros?: number;
  requiereEscaleras: boolean;
  estadoAccesibilidad: 'accesible_confirmado' | 'accesible_con_reservas' | 'estado_desconocido' | 'no_accesible';
  notas: string;
}

function getPairTemplates(originId: string, destId: string): RawOption[] {
  const key = `${originId}->${destId}`;

  const library: Record<string, RawOption[]> = {
    'ifts12->ciudad_universitaria': [
      {
        id: 'ifts12-cu-subte-d-bus',
        titulo: 'Subte A/H + Línea D + Colectivo 37/160',
        resumen: 'Caminata a Once/Corrientes, Subte D hasta Plaza Italia y colectivo directo a Ciudad Universitaria.',
        tramos: [
          {
            modo: 'caminata',
            desde: 'IFTS N.º 12 (Av. Rivadavia y Pasco)',
            hasta: 'Estación Once - 30 de Diciembre (Línea H)',
            baseDuracionMin: 8,
            distanciaMetros: 620,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Veredas amplias sobre Av. Rivadavia / Pueyrredón.',
          },
          {
            modo: 'subte',
            linea: 'Subte Línea H',
            serviceId: 'subte-h',
            stationIds: ['once-h-a', 'corrientes-h'],
            desde: 'Once - 30 de Diciembre',
            hasta: 'Santa Fe - Carlos Jáuregui',
            baseDuracionMin: 9,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Estaciones de Línea H con ascensor operativo confirmado en demo.',
          },
          {
            modo: 'subte',
            linea: 'Subte Línea D',
            serviceId: 'subte-d',
            stationIds: ['plaza-italia-d'],
            desde: 'Pueyrredón (Línea D)',
            hasta: 'Plaza Italia',
            baseDuracionMin: 8,
            requiereEscaleras: true,
            estadoAccesibilidad: 'accesible_con_reservas',
            notas: 'Combinación H-D implica pasillo extenso y escaleras intermedias en Pueyrredón.',
          },
          {
            modo: 'colectivo',
            linea: 'Colectivo 37 / 160',
            serviceId: 'ciudad-univ-colectivos',
            desde: 'Plaza Italia (Av. Santa Fe)',
            hasta: 'Ciudad Universitaria (Pabellones)',
            baseDuracionMin: 22,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_con_reservas',
            notas: 'Unidades mayoritariamente de piso bajo; confirmar rampa al arribo de la unidad.',
          },
          {
            modo: 'caminata',
            desde: 'Parada Ciudad Universitaria',
            hasta: 'Pabellones centrales',
            baseDuracionMin: 3,
            distanciaMetros: 180,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Sendero interno llano.',
          },
        ],
        datosDesconocidos: ['Disponibilidad efectiva de rampa operativa en la unidad puntual del colectivo 37/160.'],
      },
      {
        id: 'ifts12-cu-bus-109-160',
        titulo: 'Colectivo 160 directo / combinación en Av. Córdoba (sin Subte)',
        resumen: 'Caminata corta a Av. Rivadavia/Corrientes y combinación de colectivos piso bajo hasta Ciudad Universitaria, evitando escaleras de Subte.',
        tramos: [
          {
            modo: 'caminata',
            desde: 'IFTS N.º 12 (Balvanera)',
            hasta: 'Parada Av. Rivadavia y Callao (Colectivo 12 / 150)',
            baseDuracionMin: 5,
            distanciaMetros: 340,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Tramo breve sobre vereda comercial.',
          },
          {
            modo: 'colectivo',
            linea: 'Colectivo 12',
            serviceId: 'metrobus-bajo-santafe',
            desde: 'Av. Callao y Rivadavia',
            hasta: 'Plaza Italia (Av. Santa Fe)',
            baseDuracionMin: 23,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Corredor con unidades de piso bajo y paradores a nivel.',
          },
          {
            modo: 'colectivo',
            linea: 'Colectivo 160 / 37',
            serviceId: 'ciudad-univ-colectivos',
            desde: 'Plaza Italia',
            hasta: 'Ciudad Universitaria (Pabellones)',
            baseDuracionMin: 22,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_con_reservas',
            notas: 'Ingreso interno hasta los pabellones, sin uso de escaleras.',
          },
          {
            modo: 'caminata',
            desde: 'Parada interna Ciudad Universitaria',
            hasta: 'Pabellones',
            baseDuracionMin: 2,
            distanciaMetros: 150,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Recorrido corto sin desniveles.',
          },
        ],
        notasAccesibilidad: ['Alternativa sin escaleras ni ascensores de Subte.'],
        datosDesconocidos: ['Frecuencia puntual y funcionamiento de rampa en cada coche en tiempo real.'],
      },
      {
        id: 'ifts12-cu-subte-a-tren',
        titulo: 'Subte A hasta Perú + Subte E/C a Retiro + Tren Belgrano Norte',
        resumen: 'Trayecto ferroviario hasta estación Ciudad Universitaria con caminata final sobre puente peatonal.',
        tramos: [
          {
            modo: 'caminata',
            desde: 'IFTS N.º 12',
            hasta: 'Estación Pasco (Línea A)',
            baseDuracionMin: 2,
            distanciaMetros: 150,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Acceso cercano sobre Av. Rivadavia.',
          },
          {
            modo: 'subte',
            linea: 'Subte Línea A',
            serviceId: 'subte-a',
            stationIds: ['ifts-12-balvanera', 'peru-a'],
            desde: 'Pasco',
            hasta: 'Perú',
            baseDuracionMin: 9,
            requiereEscaleras: true,
            estadoAccesibilidad: 'no_accesible',
            notas: 'Estación Pasco posee únicamente escaleras fijas.',
          },
          {
            modo: 'subte',
            linea: 'Subte Línea E / C',
            serviceId: 'subte-e',
            stationIds: ['retiro-c-e'],
            desde: 'Bolívar / Catedral',
            hasta: 'Retiro',
            baseDuracionMin: 10,
            requiereEscaleras: true,
            estadoAccesibilidad: 'estado_desconocido',
            notas: 'Combinación en nodo Catedral/Bolívar/Perú con tramos de escalera.',
          },
          {
            modo: 'tren',
            linea: 'Tren Belgrano Norte',
            serviceId: 'ffcc-belgrano-norte',
            stationIds: ['retiro-c-e', 'ciudad-universitaria'],
            desde: 'Retiro (Belgrano Norte)',
            hasta: 'Estación Ciudad Universitaria',
            baseDuracionMin: 16,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Andenes elevados con rampa.',
          },
          {
            modo: 'caminata',
            desde: 'Estación Ciudad Universitaria',
            hasta: 'Pabellones',
            baseDuracionMin: 7,
            distanciaMetros: 480,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Cruce por puente peatonal con rampa.',
          },
        ],
      },
    ],

    'palermo->obelisco': [
      {
        id: 'palermo-obelisco-d',
        titulo: 'Subte Línea D directo (Plaza Italia / Palermo a 9 de Julio)',
        resumen: 'Opción subterránea directa sin transbordos hasta el Obelisco.',
        tramos: [
          {
            modo: 'caminata',
            desde: 'Zona Palermo / Plaza Italia',
            hasta: 'Estación Plaza Italia (Línea D)',
            baseDuracionMin: 4,
            distanciaMetros: 280,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Acceso cercano por Av. Santa Fe.',
          },
          {
            modo: 'subte',
            linea: 'Subte Línea D',
            serviceId: 'subte-d',
            stationIds: ['plaza-italia-d', 'carlos-pellegrini-9julio'],
            desde: 'Plaza Italia',
            hasta: '9 de Julio',
            baseDuracionMin: 14,
            requiereEscaleras: false,
            estadoAccesibilidad: 'estado_desconocido',
            notas: 'El nodo 9 de Julio / Obelisco tiene ascensor registrado pero su estado simultáneo es desconocido en la fuente actual.',
          },
          {
            modo: 'caminata',
            desde: 'Estación 9 de Julio',
            hasta: 'Obelisco / Av. Corrientes',
            baseDuracionMin: 3,
            distanciaMetros: 180,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Vereda de Av. 9 de Julio.',
          },
        ],
        datosDesconocidos: ['Estado operativo confirmado en tiempo real del ascensor de salida en estación 9 de Julio.'],
      },
      {
        id: 'palermo-obelisco-152',
        titulo: 'Colectivo Línea 152 o Línea 39 (corredor Santa Fe / Callao)',
        resumen: 'Viaje en superficie sin transbordos evitando escaleras de Subte y el nodo subterráneo de Obelisco.',
        tramos: [
          {
            modo: 'caminata',
            desde: 'Palermo (Av. Santa Fe)',
            hasta: 'Parador Av. Santa Fe y Scalabrini Ortiz / Plaza Italia',
            baseDuracionMin: 3,
            distanciaMetros: 210,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Parador accesible a nivel de vereda.',
          },
          {
            modo: 'colectivo',
            linea: 'Colectivo 39 / 152',
            serviceId: 'metrobus-bajo-santafe',
            desde: 'Plaza Italia',
            hasta: 'Av. Corrientes y 9 de Julio (entorno Obelisco)',
            baseDuracionMin: 27,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Unidades piso bajo; sujeto a tránsito sobre Av. Santa Fe y Callao.',
          },
          {
            modo: 'caminata',
            desde: 'Parada zona Obelisco',
            hasta: 'Destino Obelisco',
            baseDuracionMin: 3,
            distanciaMetros: 190,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Cruce semaforizado a nivel.',
          },
        ],
        notasAccesibilidad: ['No requiere ascensores ni escaleras subterráneas.'],
      },
      {
        id: 'palermo-obelisco-12',
        titulo: 'Colectivo Línea 12 / 60 por Av. Santa Fe y Metrobús 9 de Julio',
        resumen: 'Alternativa de superficie que ingresa al corredor de Av. 9 de Julio.',
        tramos: [
          {
            modo: 'caminata',
            desde: 'Palermo',
            hasta: 'Parada Av. Santa Fe',
            baseDuracionMin: 3,
            distanciaMetros: 220,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Vereda llana.',
          },
          {
            modo: 'colectivo',
            linea: 'Colectivo 12 / 60',
            serviceId: 'metrobus-9julio',
            desde: 'Plaza Italia',
            hasta: 'Obelisco (Metrobús 9 de Julio)',
            baseDuracionMin: 25,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Paradores del Metrobús con rampa a nivel.',
          },
          {
            modo: 'caminata',
            desde: 'Parador Metrobús Obelisco',
            hasta: 'Obelisco',
            baseDuracionMin: 2,
            distanciaMetros: 120,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Cruce peatonal directo.',
          },
        ],
      },
    ],

    'constitucion->caballito': [
      {
        id: 'constitucion-caballito-c-a',
        titulo: 'Subte Línea C + Subte Línea A (combinación Av. de Mayo / Lima)',
        resumen: 'Trayecto rápido en Subte con 1 transbordo en el área céntrica.',
        tramos: [
          {
            modo: 'caminata',
            desde: 'Estación Constitución',
            hasta: 'Andén Subte Línea C',
            baseDuracionMin: 4,
            distanciaMetros: 260,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Ascensor operativo confirmado en Constitución (demo).',
          },
          {
            modo: 'subte',
            linea: 'Subte Línea C',
            serviceId: 'subte-c',
            stationIds: ['constitucion-c'],
            desde: 'Constitución',
            hasta: 'Av. de Mayo',
            baseDuracionMin: 7,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Tramo breve hasta nodo Lima / Av. de Mayo.',
          },
          {
            modo: 'subte',
            linea: 'Subte Línea A',
            serviceId: 'subte-a',
            stationIds: ['acoyte-a'],
            desde: 'Lima',
            hasta: 'Acoyte',
            baseDuracionMin: 16,
            requiereEscaleras: true,
            estadoAccesibilidad: 'no_accesible',
            notas: 'Estación Acoyte no posee ascensor ni escalera mecánica; salida únicamente por escaleras fijas.',
          },
          {
            modo: 'caminata',
            desde: 'Estación Acoyte',
            hasta: 'Av. Rivadavia y Acoyte (Caballito)',
            baseDuracionMin: 2,
            distanciaMetros: 120,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Salida directa sobre Av. Rivadavia.',
          },
        ],
      },
      {
        id: 'constitucion-caballito-h-a',
        titulo: 'Subte H (desde Caseros/Constitución vía bus) o Colectivo 96 / 53 / 84 directo',
        resumen: 'Colectivo directo por Av. San Juan / Boedo / Av. La Plata sin transbordos ni escaleras.',
        tramos: [
          {
            modo: 'caminata',
            desde: 'Plaza Constitución',
            hasta: 'Parada Colectivo 84 / 53 (Av. Brasil / Lima)',
            baseDuracionMin: 4,
            distanciaMetros: 290,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Parador de superficie accesible.',
          },
          {
            modo: 'colectivo',
            linea: 'Colectivo 84',
            serviceId: 'metrobus-bajo-santafe',
            desde: 'Constitución',
            hasta: 'Av. Rivadavia y Acoyte (Caballito)',
            baseDuracionMin: 34,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_con_reservas',
            notas: 'Sin transbordos ni escaleras de estación; duración variable según tránsito.',
          },
          {
            modo: 'caminata',
            desde: 'Parada Acoyte y Rivadavia',
            hasta: 'Destino Caballito',
            baseDuracionMin: 2,
            distanciaMetros: 140,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Vereda llana.',
          },
        ],
        datosDesconocidos: ['Estado de rampa hidráulica de la unidad asignada en Línea 84.'],
      },
    ],

    'ifts12->obelisco': [
      {
        id: 'ifts12-obelisco-caminata-b',
        titulo: 'Subte Línea B (desde Callao / Pasteur) hasta Carlos Pellegrini',
        resumen: 'Caminata hacia Av. Corrientes y viaje directo en Subte B hasta Obelisco.',
        tramos: [
          {
            modo: 'caminata',
            desde: 'IFTS N.º 12 (Balvanera)',
            hasta: 'Estación Pasteur - AMIA (Línea B)',
            baseDuracionMin: 6,
            distanciaMetros: 460,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Trayecto recto por calle Pasteur.',
          },
          {
            modo: 'subte',
            linea: 'Subte Línea B',
            serviceId: 'subte-b',
            stationIds: ['carlos-pellegrini-9julio'],
            desde: 'Pasteur - AMIA',
            hasta: 'Carlos Pellegrini',
            baseDuracionMin: 6,
            requiereEscaleras: true,
            estadoAccesibilidad: 'estado_desconocido',
            notas: 'Pasteur requiere escalera en acceso sur; estado de ascensor en Carlos Pellegrini no confirmado.',
          },
          {
            modo: 'caminata',
            desde: 'Carlos Pellegrini',
            hasta: 'Obelisco',
            baseDuracionMin: 2,
            distanciaMetros: 120,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Salida inmediata a Av. Corrientes y 9 de Julio.',
          },
        ],
      },
      {
        id: 'ifts12-obelisco-a-peru',
        titulo: 'Subte Línea A hasta Perú / Lima y caminata corta',
        resumen: 'Subte A desde Pasco/Congreso hasta Lima o Perú.',
        tramos: [
          {
            modo: 'caminata',
            desde: 'IFTS N.º 12',
            hasta: 'Estación Pasco / Congreso (Línea A)',
            baseDuracionMin: 3,
            distanciaMetros: 200,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Acceso sobre Av. Rivadavia.',
          },
          {
            modo: 'subte',
            linea: 'Subte Línea A',
            serviceId: 'subte-a',
            stationIds: ['ifts-12-balvanera', 'peru-a'],
            desde: 'Pasco',
            hasta: 'Perú',
            baseDuracionMin: 7,
            requiereEscaleras: true,
            estadoAccesibilidad: 'no_accesible',
            notas: 'Pasco sin ascensor; Perú depende de estado del ascensor en el escenario actual.',
          },
          {
            modo: 'caminata',
            desde: 'Estación Perú / Lima',
            hasta: 'Obelisco',
            baseDuracionMin: 8,
            distanciaMetros: 580,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Caminata por Diagonal Norte o Av. 9 de Julio.',
          },
        ],
      },
      {
        id: 'ifts12-obelisco-bus-12-109',
        titulo: 'Colectivo 109 / 24 por Av. Corrientes o Colectivo 6 / 12 por Av. Callao',
        resumen: 'Viaje directo en superficie sin transbordos ni escaleras.',
        tramos: [
          {
            modo: 'caminata',
            desde: 'IFTS N.º 12',
            hasta: 'Parada Av. Corrientes y Pasteur (Línea 109 / 24)',
            baseDuracionMin: 6,
            distanciaMetros: 440,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Vereda llana hasta Av. Corrientes.',
          },
          {
            modo: 'colectivo',
            linea: 'Colectivo 109 / 24',
            serviceId: 'metrobus-9julio',
            desde: 'Av. Corrientes y Pasteur',
            hasta: 'Obelisco (Av. Corrientes y Cerrito)',
            baseDuracionMin: 11,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Sin escaleras ni ascensores; sujeto a corte en Obelisco.',
          },
          {
            modo: 'caminata',
            desde: 'Parada Av. Corrientes y Cerrito',
            hasta: 'Obelisco',
            baseDuracionMin: 2,
            distanciaMetros: 110,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Cruce peatonal a nivel.',
          },
        ],
      },
    ],
  };

  if (library[key]) {
    return library[key];
  }

  // Also check reverse pair or generate dynamic multi-modal CABA fallback within covered nodes
  const revKey = `${destId}->${originId}`;
  if (library[revKey]) {
    return library[revKey].map((opt) => ({
      ...opt,
      id: `${opt.id}-rev`,
      tramos: [...opt.tramos]
        .reverse()
        .map((leg) => ({
          ...leg,
          desde: leg.hasta,
          hasta: leg.desde,
        })),
    }));
  }

  // Dynamic CABA corridor synthesis for any other pair among the 14 mapped CABA nodes
  const originNode = CABA_NODES.find((n) => n.id === originId)!;
  const destNode = CABA_NODES.find((n) => n.id === destId)!;

  return buildCorridorOptions(originNode, destNode);
}

function buildCorridorOptions(origin: CabaNode, dest: CabaNode): RawOption[] {
  const sameNeighborhood = origin.id === dest.id;
  if (sameNeighborhood) {
    return [
      {
        id: `walk-${origin.id}`,
        titulo: `Caminata local en ${origin.barrio}`,
        resumen: `Desplazamiento a pie dentro de ${origin.barrio}.`,
        tramos: [
          {
            modo: 'caminata',
            desde: origin.nombre,
            hasta: dest.nombre,
            baseDuracionMin: 8,
            distanciaMetros: 550,
            requiereEscaleras: false,
            estadoAccesibilidad: 'accesible_confirmado',
            notas: 'Recorrido peatonal estimado en el mismo barrio.',
          },
        ],
      },
    ];
  }

  // Determine main corridors
  const options: RawOption[] = [];

  // Option 1: Subte corridor (often faster, may use Línea H / D / B / C / A depending on zone)
  const usesLineH =
    origin.id === 'parque_patricios' ||
    dest.id === 'parque_patricios' ||
    origin.id === 'once' ||
    dest.id === 'once' ||
    origin.id === 'ifts12' ||
    dest.id === 'ifts12';

  const usesLineD =
    origin.id === 'palermo' ||
    dest.id === 'palermo' ||
    origin.id === 'belgrano' ||
    dest.id === 'belgrano' ||
    origin.id === 'ciudad_universitaria' ||
    dest.id === 'ciudad_universitaria';

  const usesLineB =
    origin.id === 'hospital_italiano' ||
    dest.id === 'hospital_italiano';

  const usesLineA =
    origin.id === 'caballito' ||
    dest.id === 'caballito' ||
    origin.id === 'flores' ||
    dest.id === 'flores' ||
    origin.id === 'plaza_de_mayo' ||
    dest.id === 'plaza_de_mayo';

  const primaryLine = usesLineH
    ? { name: 'Subte Línea H', id: 'subte-h', accessible: true }
    : usesLineD
    ? { name: 'Subte Línea D', id: 'subte-d', accessible: false }
    : usesLineB
    ? { name: 'Subte Línea B', id: 'subte-b', accessible: false }
    : usesLineA
    ? { name: 'Subte Línea A', id: 'subte-a', accessible: false }
    : { name: 'Subte Línea C', id: 'subte-c', accessible: true };

  options.push({
    id: `subte-${origin.id}-${dest.id}`,
    titulo: `Red Subte (${primaryLine.name} + combinación céntrica)`,
    resumen: `Alternativa ferroviaria subterránea conectando ${origin.barrio} y ${dest.barrio} con 1 transbordo.`,
    tramos: [
      {
        modo: 'caminata',
        desde: origin.nombre,
        hasta: `Estación de ${primaryLine.name} cercana a ${origin.barrio}`,
        baseDuracionMin: 5,
        distanciaMetros: 380,
        requiereEscaleras: false,
        estadoAccesibilidad: 'accesible_confirmado',
        notas: 'Aproximación peatonal estimada.',
      },
      {
        modo: 'subte',
        linea: primaryLine.name,
        serviceId: primaryLine.id,
        desde: `Zona ${origin.barrio}`,
        hasta: 'Nodo de combinación central',
        baseDuracionMin: 12,
        requiereEscaleras: !primaryLine.accessible,
        estadoAccesibilidad: primaryLine.accessible ? 'accesible_confirmado' : 'estado_desconocido',
        notas: primaryLine.accessible
          ? 'Línea H con ascensores en la mayoría de estaciones; verificar destino final.'
          : 'Algunas estaciones de esta línea presentan escaleras o estado de ascensor no verificado.',
      },
      {
        modo: 'subte',
        linea: 'Subte combinación Red CABA',
        serviceId: dest.id === 'constitucion' || dest.id === 'retiro' ? 'subte-c' : 'subte-a',
        desde: 'Nodo de combinación central',
        hasta: `Estación cercana a ${dest.barrio}`,
        baseDuracionMin: 10,
        requiereEscaleras: true,
        estadoAccesibilidad: 'estado_desconocido',
        notas: 'Transbordo subterráneo; no se confirma ausencia total de escaleras en el nodo de combinación.',
      },
      {
        modo: 'caminata',
        desde: `Estación destino (${dest.barrio})`,
        hasta: dest.nombre,
        baseDuracionMin: 5,
        distanciaMetros: 360,
        requiereEscaleras: false,
        estadoAccesibilidad: 'accesible_confirmado',
        notas: 'Tramo final a pie.',
      },
    ],
    datosDesconocidos: [
      'Estado operativo simultáneo de ascensores y escaleras mecánicas en el nodo de transbordo subterráneo.',
    ],
  });

  // Option 2: Surface direct or 1-transfer accessible bus corridor
  options.push({
    id: `bus-${origin.id}-${dest.id}`,
    titulo: `Corredor de Colectivo en superficie (${origin.barrio} – ${dest.barrio})`,
    resumen: `Alternativa por Metrobús / avenidas principales sin necesidad de ingresar a túneles ni usar ascensores de Subte.`,
    tramos: [
      {
        modo: 'caminata',
        desde: origin.nombre,
        hasta: `Parada avenida principal (${origin.barrio})`,
        baseDuracionMin: 4,
        distanciaMetros: 280,
        requiereEscaleras: false,
        estadoAccesibilidad: 'accesible_confirmado',
        notas: 'Acceso a nivel de vereda.',
      },
      {
        modo: 'colectivo',
        linea:
          origin.id === 'constitucion' || dest.id === 'obelisco' || origin.id === 'obelisco'
            ? 'Colectivo corredor Metrobús 9 de Julio / 12 / 39'
            : 'Colectivo corredor CABA (Líneas 132 / 152 / 60 según traza)',
        serviceId:
          origin.id === 'obelisco' || dest.id === 'obelisco'
            ? 'metrobus-9julio'
            : 'metrobus-bajo-santafe',
        desde: origin.barrio,
        hasta: dest.barrio,
        baseDuracionMin: 32,
        requiereEscaleras: false,
        estadoAccesibilidad: 'accesible_con_reservas',
        notas: 'Evita escaleras de Subte; la accesibilidad final depende de que la unidad asignada cuente con rampa operativa.',
      },
      {
        modo: 'caminata',
        desde: `Parada ${dest.barrio}`,
        hasta: dest.nombre,
        baseDuracionMin: 4,
        distanciaMetros: 260,
        requiereEscaleras: false,
        estadoAccesibilidad: 'accesible_confirmado',
        notas: 'Caminata final breve.',
      },
    ],
    notasAccesibilidad: ['Sin escaleras fijas ni dependencia de ascensores de estación.'],
    datosDesconocidos: ['Confirmación en tiempo real de rampa operativa en el coche que arribe a la parada.'],
  });

  return options;
}

export interface PlanRoutesParams {
  origen: string;
  destino: string;
  momento?: string;
  constraints: TravelConstraints;
  preference: PreferenceMode;
  flags: ScenarioFlags;
}

export function planCabaRoutes(params: PlanRoutesParams) {
  const { origen, destino, momento, constraints, preference, flags } = params;
  const timeInfo = getBuenosAiresTime();
  const originNode = resolveCabaNode(origen);
  const destNode = resolveCabaNode(destino);

  if (!originNode || !destNode) {
    return {
      ok: false,
      errorTipo: 'cobertura_prototipo',
      mensaje: `No se pudo resolver exactamente ${!originNode ? `el origen ("${origen}")` : ''}${!originNode && !destNode ? ' ni ' : ''}${!destNode ? `el destino ("${destino}")` : ''} dentro de la red de nodos modelados en este prototipo académico de CABA.`,
      nodosDisponibles: CABA_NODES.map((n) => n.nombre),
      momentoConsultado: momento || timeInfo.horaLocalCABA,
      proveniencia: 'informacion_no_disponible',
      escenarioSimulado: true,
    };
  }

  const statuses = getSimulatedServiceStatuses(flags);
  const stationAcc = getStationAccessibilityData(flags);
  const rawOptions = getPairTemplates(originNode.id, destNode.id);

  const evaluated: CandidateRoute[] = rawOptions.map((opt) => {
    let totalDuration = 0;
    let totalWalkMeters = 0;
    let transitLegs = 0;
    const incidenciasRelacionadas: string[] = [];
    const notasAccesibilidad: string[] = [...(opt.notasAccesibilidad || [])];
    const datosDesconocidos: string[] = [...(opt.datosDesconocidos || [])];
    const motivosIncumplimiento: string[] = [];

    const computedTramos = opt.tramos.map((t) => {
      let dur = t.baseDuracionMin;
      let notas = t.notas;
      let accState = t.estadoAccesibilidad;
      let reqStairs = t.requiereEscaleras;

      if (t.modo !== 'caminata') {
        transitLegs += 1;
      } else if (t.distanciaMetros) {
        totalWalkMeters += t.distanciaMetros;
        if (flags.lluvia_intensa) {
          dur += Math.max(2, Math.round(t.distanciaMetros / 250));
          notas += ' (Demora estimada por lluvia intensa en escenario simulado).';
        }
      }

      if (t.serviceId) {
        const srv = statuses.find((s) => s.id === t.serviceId);
        if (srv && srv.estado !== 'normal') {
          if (srv.estado === 'demora') {
            dur += 12;
            incidenciasRelacionadas.push(`${srv.nombre}: ${srv.estadoEtiqueta}`);
          } else if (srv.estado === 'desvio') {
            dur += 15;
            incidenciasRelacionadas.push(`${srv.nombre}: ${srv.estadoEtiqueta}`);
          } else if (srv.estado === 'interrumpido') {
            dur += 18;
            incidenciasRelacionadas.push(`${srv.nombre}: ${srv.estadoEtiqueta}`);
            motivosIncumplimiento.push(`${srv.nombre} se encuentra con servicio limitado o interrumpido en este escenario.`);
          }
        }
      }

      if (t.stationIds) {
        for (const stId of t.stationIds) {
          const st = stationAcc.find((s) => s.id === stId);
          if (st) {
            if (st.ascensor === 'fuera_de_servicio') {
              accState = 'no_accesible';
              reqStairs = true;
              incidenciasRelacionadas.push(`Ascensor fuera de servicio en ${st.estacion}`);
              notasAccesibilidad.push(`${st.estacion}: ascensor fuera de servicio en escenario simulado.`);
            } else if (st.ascensor === 'sin_ascensor') {
              accState = 'no_accesible';
              reqStairs = true;
              notasAccesibilidad.push(`${st.estacion}: no cuenta con ascensor (solo escaleras).`);
            } else if (st.ascensor === 'estado_desconocido') {
              if (accState === 'accesible_confirmado') {
                accState = 'estado_desconocido';
              }
              datosDesconocidos.push(`Estado del ascensor en ${st.estacion} no confirmado en tiempo real.`);
            } else if (st.ascensor === 'operativo_confirmado') {
              notasAccesibilidad.push(`${st.estacion}: ascensor operativo confirmado (dato simulado).`);
            }
          }
        }
      }

      totalDuration += dur;

      return {
        modo: t.modo,
        linea: t.linea,
        desde: t.desde,
        hasta: t.hasta,
        duracionMin: dur,
        distanciaMetros: t.distanciaMetros,
        requiereEscaleras: reqStairs,
        estadoAccesibilidad: accState,
        notas,
      };
    });

    const transbordos = Math.max(0, transitLegs - 1);

    // Mandatory constraints enforcement
    if (constraints.evitarEscaleras) {
      const hasStairs = computedTramos.some((leg) => leg.requiereEscaleras);
      if (hasStairs) {
        motivosIncumplimiento.push('Incluye tramos o estaciones con escaleras obligatorias.');
      }
    }

    if (constraints.requiereAscensorConfirmado) {
      const hasUnconfirmedOrNoAccess = computedTramos.some(
        (leg) =>
          leg.modo === 'subte' &&
          (leg.estadoAccesibilidad === 'no_accesible' || leg.estadoAccesibilidad === 'estado_desconocido')
      );
      if (hasUnconfirmedOrNoAccess) {
        motivosIncumplimiento.push(
          'No tiene accesibilidad por ascensor confirmada en todas las estaciones de Subte del recorrido.'
        );
      }
    }

    if (constraints.maxCaminataMetros !== null && totalWalkMeters > constraints.maxCaminataMetros) {
      motivosIncumplimiento.push(
        `Supera la caminata máxima permitida (${totalWalkMeters} m frente a un tope de ${constraints.maxCaminataMetros} m).`
      );
    }

    if (constraints.maxTransbordos !== null && transbordos > constraints.maxTransbordos) {
      motivosIncumplimiento.push(
        `Requiere ${transbordos} transbordo(s), por encima del máximo de ${constraints.maxTransbordos}.`
      );
    }

    // Weighted scoring according to user preference (never altering weights silently)
    const weights: Record<PreferenceMode, { dur: number; walk: number; trans: number; acc: number }> = {
      balanceado: { dur: 1.0, walk: 0.04, trans: 6.0, acc: 8.0 },
      menor_duracion: { dur: 1.6, walk: 0.015, trans: 3.0, acc: 4.0 },
      menos_caminata: { dur: 0.7, walk: 0.09, trans: 4.0, acc: 6.0 },
      menos_transbordos: { dur: 0.8, walk: 0.025, trans: 16.0, acc: 6.0 },
      mayor_accesibilidad: { dur: 0.6, walk: 0.05, trans: 6.0, acc: 22.0 },
    };

    const w = weights[preference];
    const hasUnverifiedAcc = computedTramos.some(
      (l) => l.estadoAccesibilidad === 'no_accesible' || l.estadoAccesibilidad === 'estado_desconocido'
    );
    const accPenalty = hasUnverifiedAcc ? 1.5 : 0;
    const score = Number(
      (
        totalDuration * w.dur +
        totalWalkMeters * w.walk +
        transbordos * w.trans +
        accPenalty * w.acc
      ).toFixed(2)
    );

    const cumpleRestricciones = motivosIncumplimiento.length === 0;
    const hasNoAccess = computedTramos.some((l) => l.estadoAccesibilidad === 'no_accesible');
    const accessStatus = hasNoAccess
      ? 'not_accessible'
      : hasUnverifiedAcc
        ? 'unverified'
        : 'verified';

    return {
      routeId: opt.id,
      mode: 'demo',
      provider: 'ruma_demo_engine',
      provenance: 'dato_simulado',
      sourceName: 'Motor de demostración RUMA (IFTS N.º 12 — escenario sintético)',
      queriedAt: timeInfo.iso,
      updatedAt: timeInfo.horaLocalCABA,
      isSynthetic: true,
      limitations: [
        'Escenario sintético de demostración académica; no utiliza rutas ni geometrías reales de Google Maps.',
        'Las duraciones y estados de ascensores en modo DEMO son simulados.',
      ],
      origin: { label: originNode.nombre },
      destination: { label: destNode.nombre },
      departureTime: momento || timeInfo.horaLocalCABA,
      durationMin: totalDuration,
      walkMeters: totalWalkMeters,
      transfers: transbordos,
      legs: computedTramos,
      polylines: [],
      warnings: ['Modo DEMO opt-in activo: itinerario ilustrativo del prototipo sin polilínea real.'],
      incidents: Array.from(new Set(incidenciasRelacionadas)),
      accessStatus,
      constraintsSatisfied: cumpleRestricciones,
      disqualificationReasons: Array.from(new Set(motivosIncumplimiento)),
      rankingScore: score,
      recommendationReasons: [],
      travelModeUsed: 'DEMO',

      id: opt.id,
      titulo: opt.titulo,
      resumen: opt.resumen,
      duracionEstimadaMin: totalDuration,
      caminataTotalMetros: totalWalkMeters,
      transbordos,
      tramos: computedTramos,
      cumpleRestricciones,
      motivosIncumplimiento: Array.from(new Set(motivosIncumplimiento)),
      incidenciasRelacionadas: Array.from(new Set(incidenciasRelacionadas)),
      notasAccesibilidad: Array.from(new Set(notasAccesibilidad)),
      datosDesconocidos: Array.from(new Set(datosDesconocidos)),
      puntajePonderado: score,
      esRecomendada: false,
      motivosRecomendacion: [],
    };
  });

  // Sort valid options first by lowest weighted cost score, then invalid ones
  evaluated.sort((a, b) => {
    if (a.cumpleRestricciones !== b.cumpleRestricciones) {
      return a.cumpleRestricciones ? -1 : 1;
    }
    return a.puntajePonderado - b.puntajePonderado;
  });

  const bestValid = evaluated.find((r) => r.cumpleRestricciones);
  if (bestValid) {
    bestValid.esRecomendada = true;
    const reasons: string[] = ['Cumple con todas las restricciones obligatorias indicadas (en escenario DEMO).'];
    if (preference === 'menor_duracion') {
      reasons.push(`Ofrece la menor duración estimada válida (${bestValid.duracionEstimadaMin} min).`);
    } else if (preference === 'menos_caminata') {
      reasons.push(`Minimiza la caminata total dentro de las opciones válidas (${bestValid.caminataTotalMetros} m).`);
    } else if (preference === 'menos_transbordos') {
      reasons.push(`Reduce la cantidad de transbordos (${bestValid.transbordos}).`);
    } else if (preference === 'mayor_accesibilidad') {
      reasons.push('Evita barreras confirmadas o prioriza recorridos a nivel / ascensores confirmados en DEMO.');
    } else {
      reasons.push('Presenta el mejor equilibrio entre duración, caminata, transbordos y accesibilidad.');
    }
    bestValid.motivosRecomendacion = reasons;
    bestValid.recommendationReasons = reasons;
  }

  return {
    ok: true,
    escenarioSimulado: true,
    avisoObligatorio: 'ESCENARIO SIMULADO — DATOS DE DEMOSTRACIÓN',
    origenResuelto: originNode.nombre,
    destinoResuelto: destNode.nombre,
    momentoConsiderado: momento || `Ahora (${timeInfo.horaLocalCABA} ART)`,
    criterioOrdenamiento: preference,
    restriccionesAplicadas: constraints,
    ningunaCumpleRestricciones: !bestValid,
    alternativas: evaluated,
    fuente: 'Motor de decisión RUMA (Prototipo IFTS N.º 12 CABA — Escenario simulado)',
    actualizadoEn: timeInfo.horaLocalCABA,
  };
}
