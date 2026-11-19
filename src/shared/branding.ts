/**
 * Configuración centralizada de identidad visual / branding visible al usuario.
 *
 * IMPORTANTE (decisión ratificada del equipo IFTS N.º 12):
 * - "RUMA" es la marca técnica, de trabajo y visible por defecto.
 * - Un eventual cambio futuro de nombre exhibido (p. ej. "RutaActiva") debe operarse
 *   únicamente modificando este objeto de presentación, sin renombrar archivos,
 *   endpoints (/api/*), variables internas ni esquemas de datos.
 */
export interface RumaBrandingConfig {
  visibleName: string;
  fullTitle: string;
  shortSubtitle: string;
  institutionLabel: string;
  welcomeHeading: string;
  welcomeDescription: string;
  documentTitle: string;
  aboutHeading: string;
}

export const RUMA_BRANDING: RumaBrandingConfig = {
  visibleName: 'RUMA',
  fullTitle: 'RUMA — Rutas para una Movilidad Urbana Adaptativa',
  shortSubtitle: 'Asistente de movilidad urbana en CABA · Transporte público y caminata',
  institutionLabel: 'Prototipo académico IFTS N.º 12 (CABA) · No es un sistema oficial de transporte ni navegación GPS',
  welcomeHeading: '¿Cómo querés moverte hoy por la Ciudad?',
  welcomeDescription:
    'Indicá tu origen, destino y tus necesidades (evitar escaleras, caminar poco, evitar un medio o reducir transbordos). En modo REAL consultamos rutas reales en CABA mediante Google Maps Platform y aplicamos tus restricciones antes de recomendarte opciones.',
  documentTitle: 'RUMA — Rutas para una Movilidad Urbana Adaptativa',
  aboutHeading: 'Sobre RUMA — Rutas para una Movilidad Urbana Adaptativa',
};

export const CONFIRMED_TEAM_MEMBERS = [
  'Ballesteros, Martín',
  'Coppa, Ariel',
  'Díaz Musso, Ianina',
  'Domínguez, Elizabeth',
  'Presti, Gisele',
  'Robles Gianotti, Agustina',
] as const;

export const TEAM_ROLES_STATUS_NOTE = 'Roles A/B/C y reparto de módulos pendientes de validación por el grupo.';
