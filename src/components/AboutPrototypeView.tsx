import { ExternalLink } from 'lucide-react';
import {
  CONFIRMED_TEAM_MEMBERS,
  RUMA_BRANDING,
  TEAM_ROLES_STATUS_NOTE,
} from '../shared/branding';

export function AboutPrototypeView() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {RUMA_BRANDING.aboutHeading}
        </h1>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed max-w-2xl">
          Prototipo académico desarrollado por el Grupo 6 de primer año de la Tecnicatura en Ciencia de Datos e Inteligencia Artificial del IFTS N.º 12 (CABA), materia Aproximación al Campo Laboral. Su objetivo es asistir en decisiones de movilidad urbana en transporte público y caminata con foco en accesibilidad, transparencia de fuentes y criterios explícitos.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5">
          <h2 className="text-sm font-semibold text-slate-900">
            01. Alcance y límites explícitos
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {RUMA_BRANDING.visibleName} ayuda a planificar viajes dentro de la Ciudad Autónoma de Buenos Aires, comparar alternativas reales, aplicar restricciones obligatorias, ponderar preferencias y visualizar recorridos sobre el mapa.
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            No es un sistema oficial del GCBA ni de operadores de transporte, no realiza navegación GPS giro a giro, no gestiona flotas laborales, no cobra pasajes y nunca promete horarios exactos ni accesibilidad 100% garantizada.
          </p>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5">
          <h2 className="text-sm font-semibold text-slate-900">
            02. Modo REAL vs. Modo DEMO optativo
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            En modo <strong>REAL</strong> (activo por defecto), el backend resuelve geocodificación y rutas reales en CABA mediante Google Maps Platform (Geocoding API, Places API New y Routes API v2) y las dibuja en un mapa interactivo.
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            El modo <strong>DEMO</strong> queda separado y cerrado por defecto: utiliza únicamente un grafo sintético de 14 nodos para ensayos académicos y nunca se activa automáticamente ante un error real.
          </p>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5">
          <h2 className="text-sm font-semibold text-slate-900">
            03. Principio de accesibilidad verificable
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Que una estación figure con ascensor en un mapa no demuestra que esté funcionando hoy. Cuando no existe feed operativo abierto en vivo para medios de elevación, {RUMA_BRANDING.visibleName} marca la accesibilidad como <strong>sin verificar</strong> y ofrece enlaces directos a canales oficiales.
          </p>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5">
          <h2 className="text-sm font-semibold text-slate-900">
            04. Ciencia de Datos, EDA y QA
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            El componente de Machine Learning y EDA se mantiene en plano académico experimental: este prototipo no exhibe métricas predictivas no verificadas ni modelos entrenados sin respaldo reproducible. Los 50 casos sintéticos se utilizan exclusivamente como pruebas QA de regresión.
          </p>
        </section>
      </div>

      {/* Team members */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Equipo integrante (IFTS N.º 12 · Grupo 6)
          </h2>
          <span className="hidden text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
            {TEAM_ROLES_STATUS_NOTE}
          </span>
        </div>
        <ul className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-700">
          {CONFIRMED_TEAM_MEMBERS.map((member) => (
            <li
              key={member}
              className="px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-lg font-medium text-slate-800"
            >
              {member}
            </li>
          ))}
        </ul>
      </section>

      {/* Official links & Google Maps ToS */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Canales oficiales de referencia en CABA y términos de mapas
        </h2>
        <div className="flex flex-wrap gap-3 text-xs">
          <a
            href="https://emova.com.ar/index.php/accesibilidad/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[#0F5257] font-medium hover:underline"
          >
            <span>EMOVA Accesibilidad (Subte)</span>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
          <a
            href="https://emova.com.ar/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[#0F5257] font-medium hover:underline"
          >
            <span>EMOVA — Sitio principal (Subte y Premetro)</span>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
          <a
            href="https://mapa.buenosaires.gob.ar/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[#0F5257] font-medium hover:underline"
          >
            <span>BA Cómo Llego (GCBA)</span>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
          <a
            href="https://www.argentina.gob.ar/transporte/trenes-argentinos"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[#0F5257] font-medium hover:underline"
          >
            <span>Trenes Argentinos</span>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
          <a
            href="https://maps.google.com/help/terms_maps/?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-slate-600 hover:underline"
          >
            <span>Google Maps End User Terms</span>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        </div>
      </section>
    </div>
  );
}
