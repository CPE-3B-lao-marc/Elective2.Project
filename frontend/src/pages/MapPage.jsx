import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/useAuth";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useJsApiLoader, Autocomplete } from "@react-google-maps/api";

const MODE_OPTIONS = [
  { label: "Drive", value: "driving" },
  { label: "Transit", value: "transit" },
  { label: "Walk", value: "walking" },
  { label: "Bike", value: "bicycling" },
];

const DEFAULT_ORIGIN = "Manila, Philippines";
const DEFAULT_DESTINATION = "Makati, Philippines";

function MapPage() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const originAutocompleteRef = useRef(null);
  const destinationAutocompleteRef = useRef(null);
  const [origin, setOrigin] = useState(DEFAULT_ORIGIN);
  const [destination, setDestination] = useState(DEFAULT_DESTINATION);
  const [mode, setMode] = useState("driving");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [routeInfo, setRouteInfo] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const { user } = useAuth();

  const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "";

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: ["places"],
  });

  function handleOriginLoad(autocomplete) {
    originAutocompleteRef.current = autocomplete;
  }

  function handleDestinationLoad(autocomplete) {
    destinationAutocompleteRef.current = autocomplete;
  }

  function handleOriginPlaceChanged() {
    const place = originAutocompleteRef.current?.getPlace();
    if (!place) return;
    const address = place.formatted_address || place.name;
    if (address) setOrigin(address);
  }

  function handleDestinationPlaceChanged() {
    const place = destinationAutocompleteRef.current?.getPlace();
    if (!place) return;
    const address = place.formatted_address || place.name;
    if (address) setDestination(address);
  }

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    if (!mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [120.9842, 14.5995],
      zoom: 11,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      if (!map.getSource("route")) {
        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [],
            },
          },
        });

        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#2563eb",
            "line-width": 6,
          },
        });
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken]);

  function decodePolyline(encoded) {
    const coordinates = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let shift = 0;
      let result = 0;
      let byte;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += deltaLat;

      shift = 0;
      result = 0;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += deltaLng;

      coordinates.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }

    return coordinates;
  }

  function updateRouteOnMap(coordinates) {
    const map = mapRef.current;
    if (!map) return;

    if (!map.isStyleLoaded()) {
      map.once("load", () => updateRouteOnMap(coordinates));
      return;
    }

    const routeData = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates,
      },
    };

    const source = map.getSource("route");
    if (source) {
      source.setData(routeData);
    }

    if (coordinates.length) {
      const bounds = coordinates.reduce(
        (acc, coord) => acc.extend(coord),
        new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]),
      );
      map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 500 });
    }
  }

  async function handleSearch(event) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    setRouteInfo(null);

    try {
      const params = new URLSearchParams({
        origin,
        destination,
        mode,
      });
      const response = await fetch(
        `/api/locations/directions?${params.toString()}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No route could be found.");
      }

      if (data.status !== "OK" || !data.routes?.length) {
        const message = data.error_message || "No route could be found.";
        throw new Error(message);
      }

      const route = data.routes[0];
      const decoded = decodePolyline(route.overview_polyline.points);
      const coordinates = decoded.map((point) => [point.lng, point.lat]);
      updateRouteOnMap(coordinates);

      const leg = route.legs[0];
      setRouteInfo({
        distance: leg.distance.text,
        duration: leg.duration.text,
        startAddress: leg.start_address,
        endAddress: leg.end_address,
        summary: route.summary || `${origin} → ${destination}`,
      });
    } catch (fetchError) {
      setError(fetchError.message || "Unable to load directions.");
    } finally {
      setLoading(false);
    }
  }

  if (!isLoaded) {
    console.log("Google Maps API not loaded yet");
  }

  return (
    <main className="relative z-1 inset-0 min-h-svh bg-slate-950 text-slate-900">
      <div className="absolute inset-0">
        <div ref={mapContainer} className="w-full h-full" />
      </div>

      {/* Control panel */}

      {/* <div className="relative z-10">
        <section className="absolute left-4 right-4 top-4 rounded-4xl bg-white/95 p-5 shadow-2xl ring-1 ring-slate-200/80 backdrop-blur-sm sm:left-6 sm:right-auto sm:w-130 lg:left-8 lg:top-19">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-sky-600">
                Map Planner
              </p>
              <h1 className="text-3xl font-semibold text-slate-950">
                Plan your commute with Google Directions + Mapbox
              </h1>
              {user ? (
                <p className="mt-3 text-sm text-slate-600">
                  Welcome, {user.username}.
                </p>
              ) : null}
            </div>
          </div>

          <form
            onSubmit={handleSearch}
            className="grid gap-4 lg:grid-cols-[1.5fr_1fr]"
          >
            <div className="grid gap-4">
              <label className="block text-sm font-medium text-slate-700">
                Origin
                {isLoaded ? (
                  <Autocomplete
                    onLoad={handleOriginLoad}
                    onPlaceChanged={handleOriginPlaceChanged}
                  >
                    <input
                      type="text"
                      value={origin}
                      onChange={(event) => setOrigin(event.target.value)}
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      placeholder="Enter origin address"
                    />
                  </Autocomplete>
                ) : (
                  <input
                    type="text"
                    value={origin}
                    onChange={(event) => setOrigin(event.target.value)}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    placeholder="Enter origin address"
                  />
                )}
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Destination
                {isLoaded ? (
                  <Autocomplete
                    onLoad={handleDestinationLoad}
                    onPlaceChanged={handleDestinationPlaceChanged}
                  >
                    <input
                      type="text"
                      value={destination}
                      onChange={(event) => setDestination(event.target.value)}
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      placeholder="Enter destination address"
                    />
                  </Autocomplete>
                ) : (
                  <input
                    type="text"
                    value={destination}
                    onChange={(event) => setDestination(event.target.value)}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    placeholder="Enter destination address"
                  />
                )}
              </label>
            </div>

            <div className="grid gap-4">
              <fieldset className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <legend className="mb-3 text-sm font-semibold text-slate-800">
                  Transport Mode
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {MODE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-sky-400"
                    >
                      <input
                        type="radio"
                        name="travelMode"
                        value={option.value}
                        checked={mode === option.value}
                        onChange={() => setMode(option.value)}
                        className="h-4 w-4 accent-sky-500"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={loading}
                >
                  {loading ? "Searching…" : "Search route"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrigin(DEFAULT_ORIGIN);
                    setDestination(DEFAULT_DESTINATION);
                    setMode("driving");
                    setRouteInfo(null);
                    setError("");
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                >
                  Reset
                </button>
              </div>
            </div>
          </form>

          {error ? (
            <div className="mt-5 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </section>

        

        <div className="sm:hidden absolute inset-x-4 bottom-4 flex justify-center">
          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-xl ring-1 ring-white/20 transition hover:bg-slate-800"
          >
            {showDetails ? "Hide details" : "View details"}
          </button>
        </div>

        

        <div
          className={`absolute inset-x-4 bottom-4 transition-transform duration-300 ease-out sm:inset-x-auto sm:right-5 sm:w-90 lg:space-y-4 ${
            showDetails ? "translate-y-0" : "translate-y-full"
          } sm:translate-y-0`}
        >
          <section className="rounded-3xl bg-white/95 p-6 shadow-2xl ring-1 ring-slate-200/80 backdrop-blur-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Route summary
            </h2>
            {!routeInfo ? (
              <p className="mt-4 text-sm text-slate-600">
                Search for a route to see live results and directions.
              </p>
            ) : (
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Mode
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    {mode}
                  </p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Distance
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    {routeInfo.distance}
                  </p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Duration
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    {routeInfo.duration}
                  </p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    From
                  </p>
                  <p className="mt-2 text-sm text-slate-800">
                    {routeInfo.startAddress}
                  </p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    To
                  </p>
                  <p className="mt-2 text-sm text-slate-800">
                    {routeInfo.endAddress}
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div> */}

      {/* Control panel */}
    </main>
  );
}

export default MapPage;
