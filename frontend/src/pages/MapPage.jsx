import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/useAuth";
import { apiUrl } from "../context/authConfig";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useJsApiLoader, Autocomplete } from "@react-google-maps/api";
import { FiSearch, FiMapPin } from "react-icons/fi";
import { FaCar, FaBus, FaBicycle, FaWalking } from "react-icons/fa";
import BottomDrawer from "../components/BottomDrawer";

const MODE_OPTIONS = [
  { label: "Drive", value: "driving", icon: FaCar },
  { label: "Transit", value: "transit", icon: FaBus },
  { label: "Walk", value: "walking", icon: FaWalking },
  { label: "Bike", value: "bicycling", icon: FaBicycle },
];

const ROUTE_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#f97316"];

const DEFAULT_ORIGIN = "Manila, Philippines";
const DEFAULT_DESTINATION = "Makati, Philippines";

function MapPage() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const originMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const originAutocompleteRef = useRef(null);
  const destinationAutocompleteRef = useRef(null);
  const [origin, setOrigin] = useState(DEFAULT_ORIGIN);
  const [originCoords, setOriginCoords] = useState(null);
  const [destination, setDestination] = useState(DEFAULT_DESTINATION);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [mode, setMode] = useState("driving");
  const [includeTransit, setIncludeTransit] = useState(true);
  const [includeBiking, setIncludeBiking] = useState(true);
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [routeInfo, setRouteInfo] = useState(null);
  const [savedLocations, setSavedLocations] = useState([]);
  const [loadingSavedLocations, setLoadingSavedLocations] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const { user } = useAuth();

  const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "";

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: ["places"],
  });

  const sharedInputClass =
    "mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100";

  const originInput = isLoaded ? (
    <Autocomplete
      onLoad={handleOriginLoad}
      onPlaceChanged={handleOriginPlaceChanged}
    >
      <input
        type="text"
        value={origin}
        onChange={(event) => setOrigin(event.target.value)}
        className={sharedInputClass}
        placeholder="Enter origin address"
      />
    </Autocomplete>
  ) : (
    <input
      type="text"
      value={origin}
      onChange={(event) => setOrigin(event.target.value)}
      className={sharedInputClass}
      placeholder="Enter origin address"
    />
  );

  const destinationInput = isLoaded ? (
    <Autocomplete
      onLoad={handleDestinationLoad}
      onPlaceChanged={handleDestinationPlaceChanged}
    >
      <input
        type="text"
        value={destination}
        onChange={(event) => setDestination(event.target.value)}
        className={sharedInputClass}
        placeholder="Enter destination address"
      />
    </Autocomplete>
  ) : (
    <input
      type="text"
      value={destination}
      onChange={(event) => setDestination(event.target.value)}
      className={sharedInputClass}
      placeholder="Enter destination address"
    />
  );

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
    const location = place.geometry?.location;
    if (address) setOrigin(address);
    if (location) {
      setOriginCoords({ lat: location.lat(), lng: location.lng() });
    }
  }

  function handleDestinationPlaceChanged() {
    const place = destinationAutocompleteRef.current?.getPlace();
    if (!place) return;
    const address = place.formatted_address || place.name;
    const location = place.geometry?.location;
    if (address) setDestination(address);
    if (location) {
      setDestinationCoords({ lat: location.lat(), lng: location.lng() });
    }
  }

  const loadSavedLocations = useCallback(async () => {
    if (!user) {
      setSavedLocations([]);
      return;
    }

    setLoadingSavedLocations(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const response = await fetch(`${apiUrl}/api/locations`, {
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load saved locations.");
      }

      setSavedLocations(data.locations || []);
    } catch (err) {
      setSaveError(err.message || "Could not load saved locations.");
    } finally {
      setLoadingSavedLocations(false);
    }
  }, [user]);

  useEffect(() => {
    loadSavedLocations();
  }, [loadSavedLocations]);

  const saveLocation = async (type) => {
    if (!user) {
      setSaveError("Please sign in to save locations.");
      return;
    }

    const selectedRoute = routes[selectedRouteIndex];
    if (!selectedRoute) {
      setSaveError("Search a route first to save a location.");
      return;
    }

    const selectedPlaceCoords =
      type === "origin" ? originCoords : destinationCoords;
    const routeCoords =
      type === "origin"
        ? selectedRoute.originLocation
        : selectedRoute.destinationLocation;
    const locationPoint = selectedPlaceCoords || routeCoords;

    if (!locationPoint?.lat || !locationPoint?.lng) {
      setSaveError("Route coordinates are required to save this location.");
      return;
    }

    const address = type === "origin" ? origin : destination;
    const name = `${type === "origin" ? "Origin" : "Destination"} - ${address}`;

    const alreadySaved = savedLocations.some((location) => {
      const sameCoords =
        Math.abs(location.latitude - locationPoint.lat) < 1e-6 &&
        Math.abs(location.longitude - locationPoint.lng) < 1e-6;
      const sameAddress =
        location.address?.trim().toLowerCase() === address.trim().toLowerCase();
      return sameCoords || sameAddress;
    });

    if (alreadySaved) {
      setSaveError("This location is already saved.");
      console.log("Location already saved:", { name, address, locationPoint });
      return;
    }

    setSavingLocation(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const response = await fetch(`${apiUrl}/api/locations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          address,
          latitude: locationPoint.lat,
          longitude: locationPoint.lng,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to save location.");
      }

      setSaveSuccess("Location saved successfully.");
      await loadSavedLocations();
    } catch (err) {
      setSaveError(err.message || "Could not save location.");
    } finally {
      setSavingLocation(false);
    }
  };

  const deleteSavedLocation = async (id) => {
    if (!user) return;

    setSaveError("");
    setSaveSuccess("");

    try {
      const response = await fetch(`${apiUrl}/api/locations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete location.");
      }

      setSaveSuccess("Location deleted successfully.");
      await loadSavedLocations();
    } catch (err) {
      setSaveError(err.message || "Could not delete saved location.");
    }
  };

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

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    map.on("load", () => {
      if (!map.getSource("routes")) {
        map.addSource("routes", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });

        map.addLayer({
          id: "route-lines",
          type: "line",
          source: "routes",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": [
              "coalesce",
              [
                "match",
                ["get", "trafficSeverity"],
                "Heavy",
                "#ef4444",
                "Moderate",
                "#f97316",
                "Normal",
                "#22c55e",
                "Light",
                "#10b981",
                "#2563eb",
              ],
              ["get", "color"],
            ],
            "line-width": 4,
            "line-opacity": 0.85,
          },
        });

        map.addLayer({
          id: "selected-route-line",
          type: "line",
          source: "routes",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": [
              "coalesce",
              [
                "match",
                ["get", "trafficSeverity"],
                "Heavy",
                "#ef4444",
                "Moderate",
                "#f97316",
                "Normal",
                "#22c55e",
                "Light",
                "#10b981",
                "#2563eb",
              ],
              ["get", "color"],
            ],
            "line-width": 10,
          },
          filter: ["==", ["get", "routeId"], 0],
        });
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      if (originMarkerRef.current) {
        originMarkerRef.current.remove();
        originMarkerRef.current = null;
      }
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
        destinationMarkerRef.current = null;
      }
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

  const getRouteCoordinates = useCallback((route) => {
    if (route.coordinates?.length) return route.coordinates;
    const encoded = route.polyline || route.overview_polyline?.points;
    if (!encoded) return [];
    return decodePolyline(encoded).map((point) => [point.lng, point.lat]);
  }, []);

  const buildMarkerPopupHtml = (type, route) => {
    const title = type === "start" ? "Start" : "End";
    const badgeColor = type === "start" ? "#10b981" : "#ef4444";
    return `
      <div style="font-family: system-ui, sans-serif; min-width: 200px;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px;">
          <div>
            <div style="font-size:14px; font-weight:700; line-height:1.2;">${title}</div>
            <div style="font-size:12px; color:#64748b;">${route.label || "Route detail"}</div>
          </div>
          <span style="width:10px; height:10px; border-radius:9999px; background:${badgeColor}; display:inline-block;"></span>
        </div>
        <div style="border-top:1px solid #e2e8f0; margin-top:6px; padding-top:8px;">
          <div style="font-size:12px; color:#334155; margin-bottom:6px;"><strong>Travel time:</strong> ${route.durationText || "N/A"}</div>
          <div style="font-size:12px; color:#334155; margin-bottom:6px;"><strong>Distance:</strong> ${route.distanceText || "N/A"}</div>
          <div style="font-size:12px; color:#334155; margin-bottom:6px;"><strong>Traffic:</strong> ${route.trafficImpact?.icon || "🚦"} ${route.trafficImpact?.text || "Unknown"}</div>
          <div style="font-size:12px; color:#334155;"><strong>Weather:</strong> ${route.weatherImpact?.icon || "☀️"} ${route.weatherImpact?.text || "Unknown"}</div>
        </div>
      </div>
    `;
  };

  const updateRouteOnMap = useCallback(
    (routeList, selectedIndex) => {
      const map = mapRef.current;
      if (!map) return;

      if (!map.isStyleLoaded()) {
        map.once("load", () => updateRouteOnMap(routeList, selectedIndex));
        return;
      }

      const features = routeList.map((route, index) => ({
        type: "Feature",
        properties: {
          routeId: index,
          color: route.color || ROUTE_COLORS[index % ROUTE_COLORS.length],
          trafficSeverity: route.trafficImpact?.severity || "Light",
        },
        geometry: {
          type: "LineString",
          coordinates: getRouteCoordinates(route),
        },
      }));

      const source = map.getSource("routes");
      if (source) {
        source.setData({
          type: "FeatureCollection",
          features,
        });
      }

      if (features.length) {
        const allCoordinates = features.flatMap(
          (feature) => feature.geometry.coordinates,
        );
        const bounds = allCoordinates.reduce(
          (acc, coord) => acc.extend(coord),
          new mapboxgl.LngLatBounds(allCoordinates[0], allCoordinates[0]),
        );
        map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 500 });
      }

      if (map.getLayer("selected-route-line")) {
        map.setFilter("selected-route-line", [
          "==",
          ["get", "routeId"],
          selectedIndex,
        ]);
      }

      const selectedRoute = routeList[selectedIndex];
      const originLocation =
        selectedRoute?.originLocation ||
        (selectedRoute?.coordinates?.[0]
          ? {
              lat: selectedRoute.coordinates[0][1],
              lng: selectedRoute.coordinates[0][0],
            }
          : undefined);
      const destinationLocation =
        selectedRoute?.destinationLocation ||
        (selectedRoute?.coordinates?.length
          ? {
              lat: selectedRoute.coordinates[
                selectedRoute.coordinates.length - 1
              ][1],
              lng: selectedRoute.coordinates[
                selectedRoute.coordinates.length - 1
              ][0],
            }
          : undefined);

      console.log("selectedRoute", selectedRoute);
      console.log("originLocation", originLocation);
      console.log("destinationLocation", destinationLocation);

      if (originLocation) {
        if (originMarkerRef.current) {
          originMarkerRef.current.remove();
          originMarkerRef.current = null;
        }

        const originEl = document.createElement("div");
        originEl.style.backgroundColor = "#10b981";
        originEl.style.color = "#fff";
        originEl.style.width = "34px";
        originEl.style.height = "34px";
        originEl.style.display = "flex";
        originEl.style.alignItems = "center";
        originEl.style.justifyContent = "center";
        originEl.style.borderRadius = "50%";
        originEl.style.fontWeight = "700";
        originEl.style.fontSize = "16px";
        originEl.style.boxShadow = "0 0 8px rgba(0,0,0,0.25)";
        originEl.style.border = "2px solid #fff";
        originEl.style.zIndex = "2";
        originEl.textContent = "S";

        const originMarker = new mapboxgl.Marker({
          element: originEl,
          anchor: "bottom",
        })
          .setLngLat([originLocation.lng, originLocation.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              buildMarkerPopupHtml("start", selectedRoute),
            ),
          )
          .addTo(map);

        originEl.style.cursor = "pointer";
        originEl.addEventListener("click", () => {
          map.flyTo({
            center: [originLocation.lng, originLocation.lat],
            zoom: 14,
            essential: true,
          });
          originMarker.togglePopup();
        });

        originMarkerRef.current = originMarker;
      }

      if (destinationLocation) {
        if (destinationMarkerRef.current) {
          destinationMarkerRef.current.remove();
          destinationMarkerRef.current = null;
        }

        const destinationEl = document.createElement("div");
        destinationEl.style.backgroundColor = "#ef4444";
        destinationEl.style.color = "#fff";
        destinationEl.style.width = "34px";
        destinationEl.style.height = "34px";
        destinationEl.style.display = "flex";
        destinationEl.style.alignItems = "center";
        destinationEl.style.justifyContent = "center";
        destinationEl.style.borderRadius = "50%";
        destinationEl.style.fontWeight = "700";
        destinationEl.style.fontSize = "16px";
        destinationEl.style.boxShadow = "0 0 8px rgba(0,0,0,0.25)";
        destinationEl.style.border = "2px solid #fff";
        destinationEl.style.zIndex = "2";
        destinationEl.textContent = "E";

        const destinationMarker = new mapboxgl.Marker({
          element: destinationEl,
          anchor: "bottom",
        })
          .setLngLat([destinationLocation.lng, destinationLocation.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              buildMarkerPopupHtml("end", selectedRoute),
            ),
          )
          .addTo(map);

        destinationEl.style.cursor = "pointer";
        destinationEl.addEventListener("click", () => {
          map.flyTo({
            center: [destinationLocation.lng, destinationLocation.lat],
            zoom: 14,
            essential: true,
          });
          destinationMarker.togglePopup();
        });

        destinationMarkerRef.current = destinationMarker;
      }
    },
    [getRouteCoordinates],
  );

  async function handleSearch(event) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    setRouteInfo(null);
    setRoutes([]);

    try {
      const params = new URLSearchParams({
        origin,
        destination,
        mode,
        includeTransit: includeTransit ? "true" : "false",
        includeBiking: includeBiking ? "true" : "false",
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

      const routeObjects = data.routes.map((route, index) => ({
        ...route,
        id: index,
        color: ROUTE_COLORS[index % ROUTE_COLORS.length],
        modeLabel:
          MODE_OPTIONS.find((option) => option.value === route.mode)?.label ||
          MODE_OPTIONS.find((option) => option.value === mode)?.label ||
          mode,
        summary: route.summary || `${origin} → ${destination}`,
      }));

      setRoutes(routeObjects);
      setSelectedRouteIndex(0);
      setRouteInfo(routeObjects[0] || null);
    } catch (fetchError) {
      setError(fetchError.message || "Unable to load directions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!routes.length) return;
    updateRouteOnMap(routes, selectedRouteIndex);
    setRouteInfo(routes[selectedRouteIndex] || null);
  }, [routes, selectedRouteIndex, updateRouteOnMap]);

  if (!isLoaded) {
    console.log("Google Maps API not loaded yet");
  }

  return (
    <main className="relative inset-0 min-h-svh bg-slate-950 text-slate-900">
      <div className="absolute inset-0 md:right-105">
        <div ref={mapContainer} className="w-full h-full" />
      </div>

      <div className="relative z-10">
        <BottomDrawer>
          <div className="space-y-6 px-4 max-w-3xl justify-center mx-auto mb-15">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-sky-600">
                Route builder
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Plan your trip
              </h2>
              {user ? (
                <p className="mt-2 text-sm text-slate-600">
                  Welcome back, {user.username}.
                </p>
              ) : null}
            </div>

            <form onSubmit={handleSearch} className="space-y-6 mb-6">
              <div className="relative grid gap-4 pl-7">
                <div className="absolute left-3 top-8 bottom-8 w-px border-l-2 border-dashed border-slate-300" />

                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                    <span className="h-3 w-3 rounded-full bg-emerald-100" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                      Start
                    </p>
                    {originInput}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm">
                    <FiMapPin className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                      Destination
                    </p>
                    {destinationInput}
                  </div>
                </div>
              </div>

              <fieldset className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <legend className="mb-3 text-sm font-semibold text-slate-800">
                  Transport mode
                </legend>
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
                    <div className="grid grid-cols-4">
                      {MODE_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setMode(option.value)}
                            className={`inline-flex flex-col items-center justify-center gap-2 px-3 py-3 text-sm font-semibold transition ${
                              mode === option.value
                                ? "bg-white text-slate-950 shadow-sm"
                                : "text-slate-500 hover:bg-slate-200"
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                            <span>{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Include Public Transit
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          View transit weather impact preferences.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={includeTransit}
                        onChange={(event) =>
                          setIncludeTransit(event.target.checked)
                        }
                        className="h-5 w-5 accent-sky-500"
                      />
                    </label>
                    <label className="flex cursor-pointer items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Include Biking
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          View bike weather impact preferences.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={includeBiking}
                        onChange={(event) =>
                          setIncludeBiking(event.target.checked)
                        }
                        className="h-5 w-5 accent-sky-500"
                      />
                    </label>
                  </div>
                </div>
              </fieldset>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={loading}
                >
                  <FiSearch className="h-4 w-4" />
                  {loading ? "Searching…" : "Search route"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrigin(DEFAULT_ORIGIN);
                    setDestination(DEFAULT_DESTINATION);
                    setMode("driving");
                    setIncludeTransit(true);
                    setIncludeBiking(true);
                    setRouteInfo(null);
                    setError("");
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                >
                  Reset
                </button>
              </div>
              {user && routes.length ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => saveLocation("origin")}
                    disabled={savingLocation}
                    className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    Save origin
                  </button>
                  <button
                    type="button"
                    onClick={() => saveLocation("destination")}
                    disabled={savingLocation}
                    className="inline-flex items-center justify-center rounded-full bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    Save destination
                  </button>
                </div>
              ) : null}
            </form>

            {error ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {user ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Saved locations
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Keep favorite addresses ready for your next route.
                    </p>
                  </div>
                  {loadingSavedLocations ? (
                    <p className="text-xs text-slate-500">Loading…</p>
                  ) : null}
                </div>

                {saveError ? (
                  <div className="mt-4 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {saveError}
                  </div>
                ) : null}

                {saveSuccess ? (
                  <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {saveSuccess}
                  </div>
                ) : null}

                {savedLocations.length ? (
                  <div className="mt-4 space-y-3">
                    {savedLocations.map((location) => (
                      <div
                        key={location._id}
                        className="rounded-3xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {location.name}
                            </p>
                            <p className="text-sm text-slate-600">
                              {location.address}
                            </p>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => setOrigin(location.address)}
                              className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                            >
                              Use as origin
                            </button>
                            <button
                              type="button"
                              onClick={() => setDestination(location.address)}
                              className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                            >
                              Use as destination
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSavedLocation(location._id)}
                              className="rounded-full border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    No saved locations yet. Search a route and save one.
                  </p>
                )}
              </section>
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                Sign in to save favorite locations and reuse them later.
              </div>
            )}

            {routes.length ? (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Route comparisons
                  </h3>
                  <p className="text-sm text-slate-500">
                    Tap a card to highlight a route.
                  </p>
                </div>
                <div className="grid gap-4">
                  {routes.map((route, index) => (
                    <button
                      key={route.id}
                      type="button"
                      onClick={() => setSelectedRouteIndex(index)}
                      className={`w-full text-left rounded-3xl border p-4 transition ${
                        selectedRouteIndex === index
                          ? "border-sky-500 bg-slate-100"
                          : "border-slate-200 bg-white hover:border-slate-400"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                            {route.label || `Route ${index + 1}`}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">
                            {route.durationText} · {route.distanceText}
                          </p>
                        </div>
                        <div className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                          {route.modeLabel}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-4 text-sm text-slate-700">
                        <div className="rounded-3xl bg-slate-50 p-3">
                          <p className="text-[0.65rem] uppercase tracking-[0.24em] text-slate-500">
                            ETA
                          </p>
                          <p className="mt-2 font-semibold text-slate-900">
                            {route.durationText}
                          </p>
                        </div>
                        <div className="rounded-3xl bg-slate-50 p-3">
                          <p className="text-[0.65rem] uppercase tracking-[0.24em] text-slate-500">
                            Weather
                          </p>
                          <p className="mt-2 font-semibold text-slate-900">
                            {route.weatherImpact?.icon || "☀️"}{" "}
                            {route.weatherImpact?.text || "No issues"}
                          </p>
                        </div>
                        <div className="rounded-3xl bg-slate-50 p-3">
                          <p className="text-[0.65rem] uppercase tracking-[0.24em] text-slate-500">
                            Traffic
                          </p>
                          <p className="mt-2 font-semibold text-slate-900">
                            {route.trafficImpact?.icon || "🚦"}{" "}
                            {route.trafficImpact?.text || "Light traffic"}
                          </p>
                        </div>
                        <div className="rounded-3xl bg-slate-50 p-3">
                          <p className="text-[0.65rem] uppercase tracking-[0.24em] text-slate-500">
                            Cost / Effort
                          </p>
                          <p className="mt-2 font-semibold text-slate-900">
                            {route.costEffort || "Standard route"}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <section className="rounded-3xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Traffic severity legend
                  </h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-4 text-sm text-slate-700">
                    <div className="flex items-center gap-2 rounded-3xl bg-slate-50 px-3 py-3">
                      <span className="h-3 w-3 rounded-full bg-emerald-500" />
                      <span>Light traffic</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-3xl bg-slate-50 px-3 py-3">
                      <span className="h-3 w-3 rounded-full bg-cyan-500" />
                      <span>Normal</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-3xl bg-slate-50 px-3 py-3">
                      <span className="h-3 w-3 rounded-full bg-orange-500" />
                      <span>Moderate</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-3xl bg-slate-50 px-3 py-3">
                      <span className="h-3 w-3 rounded-full bg-red-500" />
                      <span>Heavy</span>
                    </div>
                  </div>
                </section>
              </section>
            ) : null}

            {routeInfo ? (
              <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Route summary
                </h3>
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  <div className="rounded-3xl bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Mode
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                      {MODE_OPTIONS.find((option) => option.value === mode)
                        ?.label || mode}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Weather modes
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                      {includeTransit ? "Transit included" : "Transit excluded"}
                      {" · "}
                      {includeBiking ? "Biking included" : "Biking excluded"}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Traffic
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                      {routeInfo?.trafficImpact?.icon || "🚦"}{" "}
                      {routeInfo?.trafficImpact?.text || "Light traffic"}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Distance
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                      {routeInfo.distance}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Duration
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                      {routeInfo.duration}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </BottomDrawer>
      </div>
    </main>
  );
}

export default MapPage;
