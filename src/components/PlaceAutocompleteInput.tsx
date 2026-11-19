/// <reference types="google.maps" />
import { useEffect, useId, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Clock, MapPin, Trash2, X } from 'lucide-react';
import type { GeocodedPlaceSummary, RecentPlaceEntry } from '../shared/rumaTypes';

const CABA_RESTRICTION_BOUNDS: google.maps.LatLngBoundsLiteral = {
  south: -34.706,
  west: -58.533,
  north: -34.526,
  east: -58.335,
};

interface PlaceAutocompleteInputProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  confirmedPlace?: GeocodedPlaceSummary | null;
  recents: RecentPlaceEntry[];
  mapsSdkEnabled: boolean;
  onChangeText: (text: string) => void;
  onSelectPlace: (place: GeocodedPlaceSummary) => void;
  onClearRecents: () => void;
}

interface InternalSuggestion {
  key: string;
  mainText: string;
  secondaryText: string;
  prediction: google.maps.places.PlacePrediction;
}

function dispatchIfQuotaError(err: unknown) {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null
      ? JSON.stringify(err)
      : String(err);
  const upper = msg.toUpperCase();
  if (
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('OVER_QUERY_LIMIT') ||
    upper.includes('QUOTA') ||
    upper.includes('429')
  ) {
    window.dispatchEvent(
      new CustomEvent('gmp-quota-exceeded', {
        detail: { source: 'places_sdk' },
      })
    );
  }
}

function formatPlaceDisplayText(place: GeocodedPlaceSummary): string {
  if (place.displayName && !place.formattedAddress.toLowerCase().includes(place.displayName.toLowerCase())) {
    return `${place.displayName}, ${place.formattedAddress}`;
  }
  return place.formattedAddress;
}

function PlaceAutocompleteCore({
  id,
  label,
  placeholder,
  value,
  confirmedPlace,
  recents,
  placesLib,
  onChangeText,
  onSelectPlace,
  onClearRecents,
}: PlaceAutocompleteInputProps & {
  placesLib: ReturnType<typeof useMapsLibrary<'places'>> | null;
}) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const skipNextFetchRef = useRef(false);

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<InternalSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  // Close dropdown on outside pointer click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Debounced Google Places Autocomplete (New) fetch with session token
  useEffect(() => {
    const trimmed = value.trim();

    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }

    if (!placesLib || trimmed.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    // Do not refetch when input already equals confirmed place text
    if (confirmedPlace && formatPlaceDisplayText(confirmedPlace) === trimmed) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        setIsLoading(true);
        const request: google.maps.places.AutocompleteRequest = {
          input: trimmed,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ['ar'],
          locationRestriction: CABA_RESTRICTION_BOUNDS,
          language: 'es',
          region: 'ar',
          internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
        };

        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        const items: InternalSuggestion[] = (res.suggestions || [])
          .filter((s) => Boolean(s.placePrediction))
          .slice(0, 5)
          .map((s, idx) => {
            const pred = s.placePrediction!;
            const mainText = pred.mainText?.text || pred.text.text;
            const secondaryText = pred.secondaryText?.text || '';
            return {
              key: pred.placeId || `sug-${idx}`,
              mainText,
              secondaryText,
              prediction: pred,
            };
          });
        setSuggestions(items);
        setActiveIndex(-1);
      } catch (err) {
        dispatchIfQuotaError(err);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [value, placesLib, confirmedPlace]);

  async function handlePickSuggestion(item: InternalSuggestion) {
    if (!placesLib) return;
    try {
      const place = item.prediction.toPlace();
      await place.fetchFields({
        fields: ['id', 'displayName', 'formattedAddress', 'location'],
      });
      const lat = place.location?.lat();
      const lng = place.location?.lng();
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        skipNextFetchRef.current = true;
        onChangeText(item.mainText + (item.secondaryText ? `, ${item.secondaryText}` : ''));
        setIsOpen(false);
        return;
      }

      const formattedAddress =
        place.formattedAddress || `${item.mainText}${item.secondaryText ? `, ${item.secondaryText}` : ''}`;
      const summary: GeocodedPlaceSummary = {
        query: formattedAddress,
        displayName: place.displayName || undefined,
        formattedAddress,
        location: { lat, lng },
        placeId: place.id || item.prediction.placeId,
        isInsideCaba: true,
        localitySummary: item.secondaryText || undefined,
      };

      skipNextFetchRef.current = true;
      setSuggestions([]);
      setIsOpen(false);
      setActiveIndex(-1);
      sessionTokenRef.current = null; // Consume & reset session token after fetchFields
      onSelectPlace(summary);
    } catch (err) {
      dispatchIfQuotaError(err);
      skipNextFetchRef.current = true;
      onChangeText(`${item.mainText}${item.secondaryText ? `, ${item.secondaryText}` : ''}`);
      setIsOpen(false);
    }
  }

  function handlePickRecent(recent: RecentPlaceEntry) {
    const summary: GeocodedPlaceSummary = {
      query: recent.formattedAddress,
      displayName: recent.displayName,
      formattedAddress: recent.formattedAddress,
      location: recent.location,
      placeId: recent.placeId,
      isInsideCaba: true,
      localitySummary: recent.localitySummary,
    };
    skipNextFetchRef.current = true;
    setSuggestions([]);
    setIsOpen(false);
    setActiveIndex(-1);
    sessionTokenRef.current = null;
    onSelectPlace(summary);
  }

  const showingRecents = isOpen && value.trim().length < 2 && recents.length > 0;
  const showingGoogle = isOpen && value.trim().length >= 2 && (suggestions.length > 0 || isLoading);
  const dropdownVisible = showingRecents || showingGoogle;

  const optionCount = showingRecents ? recents.length : showingGoogle ? suggestions.length : 0;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!dropdownVisible || optionCount === 0) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setActiveIndex(-1);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % optionCount);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? optionCount - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      // Explicit selection only: NEVER auto-select first item if activeIndex === -1
      if (activeIndex >= 0 && activeIndex < optionCount) {
        e.preventDefault();
        if (showingRecents) {
          handlePickRecent(recents[activeIndex]);
        } else if (showingGoogle && suggestions[activeIndex]) {
          void handlePickSuggestion(suggestions[activeIndex]);
        }
      } else {
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className="block text-[11px] font-medium text-slate-700 mb-1">
        {label}
      </label>

      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={dropdownVisible}
          aria-controls={dropdownVisible ? listboxId : undefined}
          aria-activedescendant={
            dropdownVisible && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
          }
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => {
            setIsOpen(true);
            window.setTimeout(() => {
              inputRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }, 120);
          }}
          onChange={(e) => {
            onChangeText(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          className="w-full min-h-[44px] text-xs bg-white border border-slate-300 rounded-lg pl-3 pr-8 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F5257]/30 focus:border-[#0F5257]"
        />
        {value.length > 0 && (
          <button
            type="button"
            aria-label={`Limpiar ${label.toLowerCase()}`}
            onClick={() => {
              sessionTokenRef.current = null;
              setSuggestions([]);
              onChangeText('');
              setIsOpen(true);
              inputRef.current?.focus();
            }}
            className="absolute right-1.5 p-1.5 rounded-md text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5257] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {dropdownVisible && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={showingRecents ? 'Ubicaciones recientes de esta sesión' : 'Sugerencias de direcciones en CABA'}
          className="absolute left-0 right-0 z-40 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-[280px] overflow-y-auto"
        >
          {showingRecents && (
            <>
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-slate-700">Recientes en esta sesión</span>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onClearRecents();
                    setIsOpen(false);
                  }}
                  className="inline-flex items-center gap-1 text-slate-600 hover:text-red-700 font-medium cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                  <span>Borrar recientes</span>
                </button>
              </div>
              {recents.map((item, idx) => (
                <button
                  key={item.placeId || item.formattedAddress}
                  id={`${listboxId}-opt-${idx}`}
                  role="option"
                  type="button"
                  aria-selected={activeIndex === idx}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePickRecent(item)}
                  className={`w-full min-h-[44px] px-3 py-2 text-left flex items-start gap-2.5 border-b last:border-b-0 border-slate-100 cursor-pointer transition-colors ${
                    activeIndex === idx ? 'bg-[#0F5257]/10' : 'hover:bg-slate-50'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-900 truncate">
                      {item.displayName || item.formattedAddress}
                    </div>
                    {item.displayName && (
                      <div className="text-[11px] text-slate-500 truncate">{item.formattedAddress}</div>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}

          {showingGoogle && (
            <>
              <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] font-medium text-slate-600">
                {isLoading ? 'Buscando direcciones en CABA...' : 'Sugerencias en CABA (Google Maps)'}
              </div>
              {suggestions.map((sug, idx) => (
                <button
                  key={sug.key}
                  id={`${listboxId}-opt-${idx}`}
                  role="option"
                  type="button"
                  aria-selected={activeIndex === idx}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void handlePickSuggestion(sug)}
                  className={`w-full min-h-[44px] px-3 py-2 text-left flex items-start gap-2.5 border-b last:border-b-0 border-slate-100 cursor-pointer transition-colors ${
                    activeIndex === idx ? 'bg-[#0F5257]/10' : 'hover:bg-slate-50'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 text-[#0F5257] shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-900 truncate">{sug.mainText}</div>
                    {sug.secondaryText && (
                      <div className="text-[11px] text-slate-500 truncate">{sug.secondaryText}</div>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PlacesAutocompleteWithSdk(props: PlaceAutocompleteInputProps) {
  const placesLib = useMapsLibrary('places');
  return <PlaceAutocompleteCore {...props} placesLib={placesLib} />;
}

export function PlaceAutocompleteInput(props: PlaceAutocompleteInputProps) {
  if (props.mapsSdkEnabled) {
    return <PlacesAutocompleteWithSdk {...props} />;
  }
  return <PlaceAutocompleteCore {...props} placesLib={null} />;
}
