/// <reference types="google.maps" />
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  APILoadingStatus,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useApiLoadingStatus,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { AlertTriangle, MapPin, Navigation } from 'lucide-react';
import type { AppMode, CandidateRoute, LatLngLiteral } from '../shared/rumaTypes';

interface RumaMapPanelProps {
  apiKey: string | null;
  mapsConfigured: boolean;
  route: CandidateRoute | null;
  mode: AppMode;
  onQuotaOrAuthError?: () => void;
}

interface MarkerPoint {
  id: string;
  position: LatLngLiteral;
  title: string;
  subtitle: string;
  kind: 'origin' | 'destination' | 'transfer';
  glyph: string;
}

function MapsApiStatusWatcher({
  onQuotaOrAuthError,
}: {
  onQuotaOrAuthError?: () => void;
}) {
  const status = useApiLoadingStatus();
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (
      (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) &&
      !notifiedRef.current
    ) {
      notifiedRef.current = true;
      window.dispatchEvent(
        new CustomEvent('gmp-quota-exceeded', {
          detail: { source: String(status) },
        })
      );
      onQuotaOrAuthError?.();
    }
  }, [status, onQuotaOrAuthError]);

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="p-4 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          No se pudo inicializar el mapa interactivo de Google Maps Platform en este momento (cuota o autorización). Las alternativas detalladas en tarjetas continúan disponibles.
        </div>
      </div>
    );
  }

  return null;
}

function RoutePolylinesOverlay({ route }: { route: CandidateRoute }) {
  const map = useMap();
  const geometryLib = useMapsLibrary('geometry');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    // Cleanup previous polylines cleanly
    for (const poly of polylinesRef.current) {
      poly.setMap(null);
    }
    polylinesRef.current = [];

    if (!map || !geometryLib) return;

    const bounds = new google.maps.LatLngBounds();
    let hasBoundsPoints = false;

    const segments =
      route.polylines && route.polylines.length > 0
        ? route.polylines
        : route.overallEncodedPolyline
        ? [
            {
              encodedPolyline: route.overallEncodedPolyline,
              modo: route.travelModeUsed === 'WALK' ? ('caminata' as const) : ('subte' as const),
              colorHex: '#0F5257',
              label: route.titulo,
            },
          ]
        : [];

    for (const seg of segments) {
      if (!seg.encodedPolyline) continue;
      let path: google.maps.LatLng[] = [];
      try {
        path = geometryLib.encoding.decodePath(seg.encodedPolyline);
      } catch {
        path = [];
      }
      if (path.length === 0) continue;

      for (const pt of path) {
        bounds.extend(pt);
        hasBoundsPoints = true;
      }

      const isWalk = seg.modo === 'caminata';
      const strokeColor =
        seg.colorHex ||
        (isWalk
          ? '#475569'
          : seg.modo === 'colectivo'
          ? '#1D4ED8'
          : seg.modo === 'tren'
          ? '#0F766E'
          : '#0F5257');

      const polyline = new google.maps.Polyline({
        path,
        map,
        geodesic: true,
        strokeColor,
        strokeOpacity: isWalk ? 0 : 0.92,
        strokeWeight: isWalk ? 4 : 6,
        zIndex: isWalk ? 2 : 3,
        icons: isWalk
          ? [
              {
                icon: {
                  path: 'M 0,-1 0,1',
                  strokeOpacity: 0.9,
                  strokeColor: '#475569',
                  scale: 3,
                },
                offset: '0',
                repeat: '12px',
              },
            ]
          : undefined,
      });

      polylinesRef.current.push(polyline);
    }

    if (route.origin.location) {
      bounds.extend(route.origin.location);
      hasBoundsPoints = true;
    }
    if (route.destination.location) {
      bounds.extend(route.destination.location);
      hasBoundsPoints = true;
    }

    if (hasBoundsPoints) {
      map.fitBounds(bounds, { top: 44, right: 44, bottom: 44, left: 44 });
    } else if (route.viewport) {
      const vpBounds = new google.maps.LatLngBounds(
        route.viewport.southwest,
        route.viewport.northeast
      );
      map.fitBounds(vpBounds, { top: 44, right: 44, bottom: 44, left: 44 });
    }

    return () => {
      for (const poly of polylinesRef.current) {
        poly.setMap(null);
      }
      polylinesRef.current = [];
    };
  }, [map, geometryLib, route]);

  return null;
}

function RouteMarkerItem({
  point,
  isOpen,
  onOpen,
  onClose,
}: {
  point: MarkerPoint;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  const pinColors =
    point.kind === 'origin'
      ? { background: '#0F5257', borderColor: '#093438', glyphColor: '#FFFFFF' }
      : point.kind === 'destination'
      ? { background: '#B91C1C', borderColor: '#7F1D1D', glyphColor: '#FFFFFF' }
      : { background: '#FFFFFF', borderColor: '#0F5257', glyphColor: '#0F5257' };

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={point.position}
        title={point.title}
        onClick={onOpen}
      >
        <Pin
          background={pinColors.background}
          borderColor={pinColors.borderColor}
          glyphColor={pinColors.glyphColor}
          scale={point.kind === 'transfer' ? 0.85 : 1.05}
        >
          <span className="text-[11px] font-bold">{point.glyph}</span>
        </Pin>
      </AdvancedMarker>
      {isOpen && marker && (
        <InfoWindow anchor={marker} maxWidth={240} onCloseClick={onClose}>
          <div className="text-xs text-slate-800 space-y-1 pr-1">
            <div className="font-semibold text-slate-900">{point.title}</div>
            <div className="text-slate-600">{point.subtitle}</div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export function RumaMapPanel({
  apiKey,
  mapsConfigured,
  route,
  mode,
  onQuotaOrAuthError,
}: RumaMapPanelProps) {
  const [openMarkerId, setOpenMarkerId] = useState<string | null>(null);

  const markerPoints = useMemo<MarkerPoint[]>(() => {
    if (!route) return [];
    const items: MarkerPoint[] = [];
    if (route.origin.location) {
      items.push({
        id: 'origin',
        position: route.origin.location,
        title: 'Origen',
        subtitle: route.origin.label,
        kind: 'origin',
        glyph: 'O',
      });
    }

    let transferIdx = 1;
    for (let i = 0; i < route.legs.length; i++) {
      const leg = route.legs[i];
      if (leg.modo !== 'caminata' && leg.startLocation) {
        items.push({
          id: `board-${i}`,
          position: leg.startLocation,
          title: `${leg.linea || leg.modo} · Subida`,
          subtitle: `${leg.desde}${leg.horaSalida ? ` · ${leg.horaSalida} ART` : ''}`,
          kind: 'transfer',
          glyph: String(transferIdx++),
        });
      }
    }

    if (route.destination.location) {
      items.push({
        id: 'destination',
        position: route.destination.location,
        title: 'Destino',
        subtitle: route.destination.label,
        kind: 'destination',
        glyph: 'D',
      });
    }
    return items;
  }, [route]);

  if (!route) {
    return null;
  }

  if (mode === 'demo' || route.isSynthetic) {
    return (
      <section
        aria-label="Mapa de ruta en modo DEMO"
        className="bg-white border border-amber-200 rounded-xl p-4 space-y-2.5"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
          <MapPin className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
          <span>Visualización geográfica (Modo DEMO)</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Esta consulta se ejecutó en el simulador académico sobre red reducida (14 nodos). Para visualizar polilíneas, paradas reales y mapa interactivo de Google Maps Platform en CABA, cambiá al modo <strong>REAL</strong>.
        </p>
      </section>
    );
  }

  if (!mapsConfigured || !apiKey) {
    return (
      <section
        aria-label="Mapa no disponible"
        className="bg-white border border-slate-200 rounded-xl p-4 space-y-2"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
          <span>Mapa interactivo no configurado</span>
        </div>
        <p className="text-xs text-slate-600">
          Falta la clave cliente de Google Maps JavaScript API. Las rutas calculadas por el servidor siguen visibles en las tarjetas.
        </p>
      </section>
    );
  }

  const hasGeometry =
    (route.polylines && route.polylines.length > 0) ||
    Boolean(route.overallEncodedPolyline) ||
    Boolean(route.origin.location) ||
    Boolean(route.destination.location);

  return (
    <section
      aria-label="Mapa interactivo de la ruta seleccionada"
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Navigation className="w-4 h-4 text-[#0F5257] shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-xs font-semibold text-slate-900 truncate">
              {route.titulo}
            </h2>
            <p className="text-[11px] text-slate-500">
              {route.durationMin} min · {route.walkMeters} m a pie · Google Maps Platform
            </p>
          </div>
        </div>
        <span className="text-[11px] text-slate-500">La información puede cambiar</span>
      </div>

      {!hasGeometry ? (
        <div className="p-4 text-xs text-slate-600">
          El proveedor no devolvió geometría suficiente para dibujar esta ruta en el mapa.
        </div>
      ) : (
        <>
          <MapsApiStatusWatcher onQuotaOrAuthError={onQuotaOrAuthError} />
          <div className="h-[320px] lg:h-[440px] w-full bg-slate-100">
            <GoogleMap
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              defaultCenter={route.origin.location || { lat: -34.6037, lng: -58.3816 }}
              defaultZoom={13}
              gestureHandling="greedy"
              streetViewControl={false}
              mapTypeControl={false}
              fullscreenControl={true}
            >
              <RoutePolylinesOverlay route={route} />
              {markerPoints.map((pt) => (
                <RouteMarkerItem
                  key={pt.id}
                  point={pt}
                  isOpen={openMarkerId === pt.id}
                  onOpen={() => setOpenMarkerId(pt.id)}
                  onClose={() => setOpenMarkerId(null)}
                />
              ))}
            </GoogleMap>
          </div>
        </>
      )}

      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-4 h-1 rounded bg-[#0F5257]" aria-hidden="true" />
          Transporte público
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-4 border-t-2 border-dashed border-slate-600"
            aria-hidden="true"
          />
          Tramo a pie
        </span>
        <span className="text-slate-500 ml-auto">Tocá los marcadores para ver paradas</span>
      </div>
    </section>
  );
}
