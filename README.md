# RUMA — Rutas para una Movilidad Urbana Adaptativa

Prototipo académico del **Grupo 6** (1.º año Tecnicatura en Ciencia de Datos e Inteligencia Artificial — **IFTS N.º 12, CABA**, materia *Aproximación al Campo Laboral*).

RUMA es un asistente conversacional de movilidad urbana en transporte público y caminata dentro de la Ciudad Autónoma de Buenos Aires (CABA), orientado a personas con restricciones de accesibilidad, preferencia por menos caminata o menos transbordos, y transparencia explícita sobre el origen de cada dato.

---

## 1. Integrantes confirmados y estado de roles

Integrantes del Grupo 6:
- Ballesteros, Martín
- Coppa, Ariel
- Díaz Musso, Ianina
- Domínguez, Elizabeth
- Presti, Gisele
- Robles Gianotti, Agustina

> **Nota documental:** *Roles A/B/C y reparto de módulos pendientes de validación por el grupo.*

---

## 2. Identidad y configuración centralizada de marca visible

Por decisión ratificada del equipo, **RUMA** se mantiene como nombre técnico, de trabajo y marca visible por defecto (`"RutaActiva"` **no** está aprobado).

Todos los textos visibles de marca (encabezado, bienvenida, subtítulo, título de documento y sección institucional) están centralizados en `src/shared/branding.ts` (`RUMA_BRANDING`). Si en el futuro el grupo aprobara un cambio de nombre exhibido al usuario, alcanza con editar ese único archivo de presentación **sin renombrar** archivos, endpoints (`/api/*`), variables internas ni esquemas de datos.

---

## 3. Arquitectura y compatibilidad documental

El prototipo compatibiliza la vista lógica de capas (`HLP — BLP — Determinística`) con los **3 niveles funcionales** implementados en el repositorio:

1. **Nivel 1 — Presentación y Mapa Interactivo (`src/`):**
   - React + TypeScript + Tailwind CSS (`@vis.gl/react-google-maps`).
   - Interfaz responsive mobile-first: el mapa se oculta durante conversación pura y aparece sincronizado al seleccionar tarjetas de ruta (`RouteCardsList` + `RumaMapPanel`).
   - Modo **REAL** activo por defecto; panel **DEMO** separado y cerrado por defecto.
2. **Nivel 2 — Orquestación Conversacional (`server/rumaAgent.ts` + `server.ts`):**
   - Express en puerto `3000` (con Vite en middleware en desarrollo).
   - Gemini (`@google/genai`, modelo `gemini-4-hydrogen`) cumple dos roles acotados: (a) extracción estructurada de intención (`intentType`, origen, destino, modo a pie, medios a evitar) sin debilitar restricciones de la UI, y (b) redacción clara en español rioplatense basada estrictamente en el JSON devuelto por el backend determinístico.
3. **Nivel 3 — Ruteo Real, Restricciones Duras y Ranking (`server/providers/googleMapsProvider.ts`, `server/rumaRouting.ts`, `server/cabaTransitEngine.ts`):**
   - Geocoding API v4 + Places API (New) con sesgo geográfico en CABA y validación estricta de límites dentro de CABA (rechazo explícito de localidades fuera de CABA como Provincia de Buenos Aires).
   - Routes API v2 (`TRANSIT` y `WALK`, con `computeAlternativeRoutes: true`, polilíneas codificadas por tramo y timestamp `America/Argentina/Buenos_Aires`).
   - Filtrado duro de restricciones (`evitarEscaleras`, `requiereAscensorConfirmado`, `maxCaminataMetros`, `maxTransbordos`, `avoidModes`, `soloCaminata`) y ranking con **normalización min-max** de métricas heterogéneas.
   - El motor sintético de 14 nodos (`server/cabaTransitEngine.ts`) se conserva aislado exclusivamente para modo **DEMO** optativo y nunca actúa como fallback silencioso en modo REAL.

---

## 4. Fuentes reales y honestidad operativa (CABA)

Durante las pruebas técnicas del prototipo se verificaron empíricamente los endpoints públicos disponibles:
- `https://apitransporte.buenosaires.gob.ar/subtes/serviceAlerts?json=1` devuelve **HTTP 401** sin credenciales privadas (`client_id` / `client_secret`).
- `https://emova.com.ar/index.php/accesibilidad/` no expone una API JSON abierta para consumo automatizado.

Por ese motivo, en modo **REAL**:
- El estado operativo en vivo de líneas y corredores se informa honestamente como **"Estado no verificado (sin feed abierto)"** con enlaces directos a canales oficiales (`Emova`, `BA Cómo Llego`, `Trenes Argentinos`).
- La accesibilidad operativa de ascensores y salvascaleras se marca como **`unverified` ("Accesibilidad operativa no verificada")** cuando no existe confirmación en vivo, evitando prometer rutas "100% accesibles".
- Las rutas exclusivamente peatonales (`WALK`) muestran el aviso obligatorio de etapa Beta de Google Maps Routes API.

---

## 5. Matriz de estado de capacidades

| Capacidad | Estado | Observaciones |
| :--- | :--- | :--- |
| Modo REAL por defecto con Google Maps Routes API (`TRANSIT` y `WALK`), Geocoding y Places API New | **IMPLEMENTADO Y PROBADO** | Validado con consultas reales dentro de CABA, polilíneas, tramos y rechazo de localidades fuera de CABA. |
| Mapa interactivo `@vis.gl/react-google-maps` con `<AdvancedMarker>`, `<InfoWindow>`, polilíneas diferenciadas y defensa de cuota Demo Key | **IMPLEMENTADO Y PROBADO** | Sincronizado con selección de tarjetas; oculto en conversación pura. |
| Restricciones duras (`avoidModes`, `maxCaminataMetros`, `maxTransbordos`, `evitarEscaleras`, `soloCaminata`) y ranking normalizado min-max | **IMPLEMENTADO Y PROBADO** | Las preferencias ponderan opciones válidas sin omitir restricciones obligatorias. |
| Separación estricta Modo REAL vs. Modo DEMO optativo (14 nodos) | **IMPLEMENTADO Y PROBADO** | El panel DEMO inicia cerrado; nunca hace fallback automático ante errores reales. |
| Transparencia de estado de red y accesibilidad sin feed abierto + enlaces oficiales | **IMPLEMENTADO Y PROBADO** | En modo REAL informa `"no verificado"` y enlaza a Emova / GCBA / Trenes Argentinos. |
| Configuración centralizada de branding (`src/shared/branding.ts`) | **IMPLEMENTADO Y PROBADO** | Mantiene `RUMA` por defecto sin renombrar archivos ni endpoints. |
| Telemetría en vivo de Subte/colectivos (GCBA API Transporte) y ascensores Emova | **CONCEPTUAL O FUTURO** | Requiere credenciales institucionales (`client_id`/`client_secret`) o API pública inexistente. |
| Machine Learning predictivo y métricas de EDA/A* | **CONCEPTUAL O FUTURO** | Componente académico experimental sin entrenamiento, dataset operativo ni métricas verificadas en esta entrega. |
| Gestión de trabajadores itinerantes, navegación GPS giro a giro, alertas comunitarias y pagos/reservas | **CONCEPTUAL O FUTURO** | Fuera del alcance del MVP académico. |

> **Nota sobre los 50 casos sintéticos:** Los 50 casos sintéticos RUMA (150 alternativas) se utilizan **exclusivamente como matriz de QA/regresión**, jamás como fuente operativa de itinerarios reales ni como datos de entrenamiento del asistente generativo.

---

## 6. Ejecución local y verificación

Requisitos en el entorno (configurados vía Secrets/variables sin exponer claves en el código):
- **Credencial exclusiva de servidor:** `GEMINI_API_KEY` (nunca debe llevar prefijo `VITE_` ni exponerse al navegador).
- **Credencial de cliente (y reutilizada por el backend en AI Studio):** `VITE_GOOGLE_MAPS_API_KEY`, provista por la integración de Google Maps Platform para Maps JavaScript API en el navegador (o servida en desarrollo vía `/api/maps-client-config`) y reutilizada por el backend para Geocoding, Places y Routes API.
- **Respaldo opcional solo en servidor:** si se ejecuta fuera de AI Studio con una clave separada para backend, el servidor también admite `GOOGLE_MAPS_PLATFORM_KEY` o `GOOGLE_MAPS_API_KEY` (sin exponerlas al cliente).

Comandos:
```bash
npm install
npm run dev      # Inicia Express + Vite en http://localhost:3000
npm run lint     # Verificación TypeScript (tsc --noEmit)
npm run build    # Build de producción (Vite)
npm start        # Inicia servidor Express de producción
```
