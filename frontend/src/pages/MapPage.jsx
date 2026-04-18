import { useCallback, useEffect, useRef, useState } from "react";
import { notifyError, notifySuccess } from "../utils/toast";
import { useAuth } from "../context/useAuth";
import { apiUrl } from "../context/authConfig";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useJsApiLoader, Autocomplete } from "@react-google-maps/api";
import {
  FiSearch,
  FiMapPin,
  FiArrowUpRight,
  FiArrowDownLeft,
  FiTrash2,
  FiX,
} from "react-icons/fi";
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
const CURRENT_LOCATION_ORIGIN_LABEL = "Current location";

function MapPage() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const originMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const originAutocompleteRef = useRef(null);
  const destinationAutocompleteRef = useRef(null);
  const [origin, setOrigin] = useState(DEFAULT_ORIGIN);
  const [originName, setOriginName] = useState(undefined);
  const [originCoords, setOriginCoords] = useState(null);
  const [destination, setDestination] = useState(DEFAULT_DESTINATION);
  const [destinationName, setDestinationName] = useState(undefined);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [mode, setMode] = useState("driving");
  const [transitModes, setTransitModes] = useState([]);
  const [transitRoutingPreference, setTransitRoutingPreference] = useState("");
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidHighways, setAvoidHighways] = useState(false);
  const [avoidFerries, setAvoidFerries] = useState(false);
  const [avoidIndoor, setAvoidIndoor] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [, setAvailableTravelModes] = useState([]);
  const [savedLocations, setSavedLocations] = useState([]);

  const [loadingSavedLocations, setLoadingSavedLocations] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [isSavedLocationsOpen, setIsSavedLocationsOpen] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [locationError, setLocationError] = useState("");
  const [isOriginCurrentLocation, setIsOriginCurrentLocation] = useState(false);
  const userLocationMarkerRef = useRef(null);
  const { user } = useAuth();

  const showSaveError = (message) => {
    notifyError(message);
  };

  const showSaveSuccess = (message) => {
    notifySuccess(message);
  };

  const showError = (message) => {
    notifyError(message);
  };

  const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "";

  const updateCurrentLocationMarker = useCallback((location) => {
    const map = mapRef.current;
    if (!map || !location) return;

    if (userLocationMarkerRef.current) {
      userLocationMarkerRef.current.remove();
      userLocationMarkerRef.current = null;
    }

    const locationEl = document.createElement("div");
    locationEl.style.backgroundColor = "#2563eb";
    locationEl.style.border = "2px solid #fff";
    locationEl.style.borderRadius = "50%";
    locationEl.style.boxShadow = "0 0 10px rgba(37, 99, 235, 0.35)";
    locationEl.style.width = "28px";
    locationEl.style.height = "28px";
    locationEl.style.display = "flex";
    locationEl.style.alignItems = "center";
    locationEl.style.justifyContent = "center";
    locationEl.style.color = "#fff";
    locationEl.style.fontSize = "12px";
    locationEl.textContent = "You";

    const marker = new mapboxgl.Marker({
      element: locationEl,
      anchor: "center",
    })
      .setLngLat([location.lng, location.lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div style="font-family: system-ui, sans-serif; font-size:14px;">Your current location</div>`,
        ),
      )
      .addTo(map);

    userLocationMarkerRef.current = marker;
  }, []);

  const requestCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported in this browser.");
      setLocationStatus("error");
      return;
    }

    setLocationStatus("requesting");
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(coords);
        setLocationStatus("success");
        setLocationError("");

        if (mapRef.current) {
          mapRef.current.flyTo({
            center: [coords.lng, coords.lat],
            zoom: 13,
            essential: true,
          });
          updateCurrentLocationMarker(coords);
        }
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Location permission denied. You can still enter origin manually."
            : "Unable to retrieve your location.";
        setLocationError(message);
        setLocationStatus("error");
        notifyError(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }, [updateCurrentLocationMarker]);

  const useCurrentLocationAsOrigin = () => {
    if (!userLocation) {
      requestCurrentLocation();
      return;
    }

    setOrigin(CURRENT_LOCATION_ORIGIN_LABEL);
    setOriginName(CURRENT_LOCATION_ORIGIN_LABEL);
    setOriginCoords(userLocation);
    setIsOriginCurrentLocation(true);
  };

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: ["places"],
  });

  const PREVIEW_LOCATION_COUNT = 2;
  const previewSavedLocations = savedLocations.slice(0, PREVIEW_LOCATION_COUNT);

  const sharedInputClass =
    "mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100";
  const clearableInputClass = `${sharedInputClass} pr-11`;
  const clearButtonClass =
    "absolute right-3 top-[57%] -translate-y-1/2 rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800";

  const renderClearButton = (value, onClear, label) =>
    value ? (
      <button
        type="button"
        onClick={onClear}
        className={clearButtonClass}
        aria-label={`Clear ${label}`}
        title={`Clear ${label}`}
      >
        <FiX className="h-4 w-4" />
      </button>
    ) : null;

  const renderLocationInput = ({
    value,
    onChange,
    placeholder,
    onClear,
    label,
    onLoad,
    onPlaceChanged,
  }) => (
    <div className="relative">
      {isLoaded ? (
        <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged}>
          <input
            id={`${label}-input`}
            type="text"
            value={value}
            onChange={onChange}
            className={clearableInputClass}
            placeholder={placeholder}
          />
        </Autocomplete>
      ) : (
        <input
          id={`${label}-input`}
          type="text"
          value={value}
          onChange={onChange}
          className={clearableInputClass}
          placeholder={placeholder}
        />
      )}
      {renderClearButton(value, onClear, label)}
    </div>
  );

  const originInput = renderLocationInput({
    value: origin,
    onChange: (event) => {
      setOrigin(event.target.value);
      if (isOriginCurrentLocation) {
        setIsOriginCurrentLocation(false);
      }
    },
    placeholder: "Enter origin address",
    onClear: () => {
      setOrigin("");
      setIsOriginCurrentLocation(false);
      // focus the input after clearing to allow for immediate typing
      setTimeout(() => {
        const input = document.getElementById("origin-input");
        if (input) input.focus();
      }, 0);
    },
    label: "origin",
    onLoad: handleOriginLoad,
    onPlaceChanged: handleOriginPlaceChanged,
  });

  const destinationInput = renderLocationInput({
    value: destination,
    onChange: (event) => setDestination(event.target.value),
    placeholder: "Enter destination address",
    onClear: () => {
      setDestination("");
      // focus the input after clearing to allow for immediate typing
      setTimeout(() => {
        const input = document.getElementById("destination-input");
        if (input) input.focus();
      }, 0);
    },
    label: "destination",
    onLoad: handleDestinationLoad,
    onPlaceChanged: handleDestinationPlaceChanged,
  });

  function handleOriginLoad(autocomplete) {
    originAutocompleteRef.current = autocomplete;
  }

  function handleDestinationLoad(autocomplete) {
    destinationAutocompleteRef.current = autocomplete;
  }

  function handleOriginPlaceChanged() {
    const place = originAutocompleteRef.current?.getPlace();
    console.log("Origin place changed:", place);

    if (!place) return;
    setOriginName(place.name || place.formatted_address || "");

    const address = place.formatted_address || place.name;
    const location = place.geometry?.location;
    if (address) setOrigin(address);
    if (location) {
      setOriginCoords({ lat: location.lat(), lng: location.lng() });
    }
  }

  function handleDestinationPlaceChanged() {
    const place = destinationAutocompleteRef.current?.getPlace();
    console.log("Selected destination place:", place);

    if (!place) return;
    setDestinationName(place.name || place.formatted_address || "");

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
      showSaveError(err.message || "Could not load saved locations.");
    } finally {
      setLoadingSavedLocations(false);
    }
  }, [user]);

  useEffect(() => {
    loadSavedLocations();
  }, [loadSavedLocations]);

  const saveLocation = async (type) => {
    if (!user) {
      showSaveError("Please sign in to save locations.");
      return;
    }

    const selectedRoute = routes[selectedRouteIndex];
    if (!selectedRoute) {
      showSaveError("Search a route first to save a location.");
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
      showSaveError("Route coordinates are required to save this location.");
      return;
    }

    const address = type === "origin" ? origin : destination;
    const name = `${type === "origin" ? originName : destinationName}`;

    const alreadySaved = savedLocations.some((location) => {
      const sameCoords =
        Math.abs(location.latitude - locationPoint.lat) < 1e-6 &&
        Math.abs(location.longitude - locationPoint.lng) < 1e-6;
      const sameAddress =
        location.address?.trim().toLowerCase() === address.trim().toLowerCase();
      return sameCoords || sameAddress;
    });

    if (alreadySaved) {
      showSaveError("This location is already saved.");
      console.log("Location already saved:", { name, address, locationPoint });
      return;
    }

    setSavingLocation(true);

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

      showSaveSuccess("Location saved successfully.");
      await loadSavedLocations();
    } catch (err) {
      showSaveError(err.message || "Could not save location.");
    } finally {
      setSavingLocation(false);
    }
  };

  const deleteSavedLocation = async (id) => {
    if (!user) return;

    try {
      const response = await fetch(`${apiUrl}/api/locations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete location.");
      }

      showSaveSuccess("Location deleted successfully.");
      await loadSavedLocations();
    } catch (err) {
      showSaveError(err.message || "Could not delete saved location.");
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

      requestCurrentLocation();
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
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove();
        userLocationMarkerRef.current = null;
      }
    };
  }, [mapboxToken, requestCurrentLocation]);

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
    setWarnings([]);
    setRoutes([]);
    setAvailableTravelModes([]);

    try {
      const avoidOptions = [];
      if (avoidTolls) avoidOptions.push("tolls");
      if (avoidHighways) avoidOptions.push("highways");
      if (avoidFerries) avoidOptions.push("ferries");
      if (avoidIndoor && (mode === "walking" || mode === "transit")) {
        avoidOptions.push("indoor");
      }

      const originParam =
        isOriginCurrentLocation && userLocation
          ? `${userLocation.lat},${userLocation.lng}`
          : origin;

      const params = new URLSearchParams({
        origin: originParam,
        destination,
        mode,
      });
      if (avoidOptions.length) {
        params.set("avoid", avoidOptions.join("|"));
      }

      if (mode === "transit") {
        const transitOptions = transitModes.filter((value) =>
          ["bus", "subway", "train", "tram", "rail"].includes(value),
        );
        if (transitOptions.length) {
          params.set("transit_mode", transitOptions.join("|"));
        }
        if (transitRoutingPreference) {
          params.set("transit_routing_preference", transitRoutingPreference);
        }
      }

      const response = await fetch(
        `/api/locations/directions?${params.toString()}`,
      );
      const data = await response.json();
      const warningsFromResponse = Array.isArray(data.warnings)
        ? data.warnings
        : [];
      const availableModes =
        Array.isArray(data.available_travel_modes) &&
        data.available_travel_modes.length
          ? data.available_travel_modes
          : [];

      if (warningsFromResponse.length) {
        setWarnings(warningsFromResponse);
      }

      if (!response.ok) {
        if (availableModes.length) {
          setAvailableTravelModes(availableModes);
        }
        throw new Error(data.message || "No route could be found.");
      }

      if (data.status !== "OK" || !data.routes?.length) {
        if (availableModes.length) {
          setAvailableTravelModes(availableModes);
        }
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
    } catch (fetchError) {
      showError(fetchError.message || "Unable to load directions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!routes.length) return;
    updateRouteOnMap(routes, selectedRouteIndex);
  }, [routes, selectedRouteIndex, updateRouteOnMap]);

  if (!isLoaded) {
    console.log("Google Maps API not loaded yet");
  }

  return (
    <main className="relative inset-0 min-h-svh bg-slate-950 text-slate-900">
      {/* // Map container */}
      <div className="absolute inset-0 md:right-105">
        <div ref={mapContainer} className="w-full h-full" />
      </div>

      {/* // UI overlay */}
      <div className="relative z-50">
        {/* // Route builder drawer */}
        <BottomDrawer>
          <div className="space-y-6 px-4 max-w-3xl justify-center mx-auto mb-15">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-sky-600">
                Route builder
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Plan your Trip
              </h2>
              {user ? (
                <p className="mt-2 text-sm text-slate-600">
                  Welcome,{" "}
                  <span className="font-bold text-sky-600">
                    {user.username}
                  </span>
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-700">
                {locationStatus === "success" ? (
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900">
                      Current location detected
                    </p>
                    <p>
                      Latitude: {userLocation?.lat?.toFixed(4)}, Longitude:{" "}
                      {userLocation?.lng?.toFixed(4)}
                    </p>
                  </div>
                ) : locationStatus === "requesting" ? (
                  <p>Finding your current location…</p>
                ) : locationStatus === "error" ? (
                  <p>{locationError || "Unable to detect current location."}</p>
                ) : (
                  <p>
                    Allow location access to center the map on your current
                    position.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={requestCurrentLocation}
                className="inline-flex h-12 items-center justify-center rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
              >
                Locate me
              </button>
            </div>

            <form onSubmit={handleSearch} className="space-y-6 mb-6">
              <div className="relative grid gap-4 pl-7">
                <div className="absolute left-3 top-8 bottom-8 w-px border-l-4 border-dashed border-slate-300" />

                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                    <span className="h-3 w-3 rounded-full bg-emerald-100" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                      Start
                    </p>
                    {originInput}
                    {userLocation ? (
                      <button
                        type="button"
                        onClick={useCurrentLocationAsOrigin}
                        disabled={isOriginCurrentLocation}
                        className={`mt-3 inline-flex h-11 items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          isOriginCurrentLocation
                            ? "border-slate-200 bg-slate-100 text-slate-500"
                            : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                        }`}
                      >
                        {isOriginCurrentLocation
                          ? "Current location selected"
                          : "Use current location"}
                      </button>
                    ) : null}
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
                </div>
              </fieldset>

              <fieldset className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <legend className="mb-3 text-sm font-semibold text-slate-800">
                  Avoid route features
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Avoid tolls
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Prefer routes without toll roads or bridges.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={avoidTolls}
                      onChange={(event) => setAvoidTolls(event.target.checked)}
                      className="h-5 w-5 accent-sky-500"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Avoid highways
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Prefer surface streets and local roads.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={avoidHighways}
                      onChange={(event) =>
                        setAvoidHighways(event.target.checked)
                      }
                      className="h-5 w-5 accent-sky-500"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Avoid ferries
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Prefer routes without ferry crossings.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={avoidFerries}
                      onChange={(event) =>
                        setAvoidFerries(event.target.checked)
                      }
                      className="h-5 w-5 accent-sky-500"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Avoid indoor
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Applies only for walking and transit routes.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={avoidIndoor}
                      onChange={(event) => setAvoidIndoor(event.target.checked)}
                      disabled={mode !== "walking" && mode !== "transit"}
                      className="h-5 w-5 accent-sky-500"
                    />
                  </label>
                </div>
              </fieldset>

              {mode === "transit" ? (
                <fieldset className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <legend className="mb-3 text-sm font-semibold text-slate-800">
                    Transit preferences
                  </legend>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Preferred transit modes
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Choose one or more transit modes to prefer on the route.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {[
                          { value: "bus", label: "Bus" },
                          { value: "subway", label: "Subway" },
                          { value: "train", label: "Train" },
                          { value: "tram", label: "Tram" },
                          { value: "rail", label: "Rail" },
                        ].map((option) => {
                          const active = transitModes.includes(option.value);
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setTransitModes((current) =>
                                  current.includes(option.value)
                                    ? current.filter(
                                        (value) => value !== option.value,
                                      )
                                    : [...current, option.value],
                                );
                              }}
                              className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                                active
                                  ? "border-sky-600 bg-sky-600 text-white"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Transit routing preference
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Bias the route toward less walking or fewer transfers.
                      </p>
                      <div className="mt-3 grid gap-2">
                        {[
                          {
                            value: "",
                            label: "Default",
                            description:
                              "Use Google's default transit recommendation.",
                          },
                          {
                            value: "less_walking",
                            label: "Less walking",
                            description: "Prefer routes with limited walking.",
                          },
                          {
                            value: "fewer_transfers",
                            label: "Fewer transfers",
                            description: "Prefer routes with fewer transfers.",
                          },
                        ].map((option) => (
                          <label
                            key={option.value || "default"}
                            className="flex cursor-pointer items-start gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3"
                          >
                            <input
                              type="radio"
                              name="transitRoutingPreference"
                              value={option.value}
                              checked={
                                transitRoutingPreference === option.value
                              }
                              onChange={() =>
                                setTransitRoutingPreference(option.value)
                              }
                              className="mt-1 h-4 w-4 accent-sky-500"
                            />
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {option.label}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {option.description}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </fieldset>
              ) : null}

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
                    setTransitModes([]);
                    setTransitRoutingPreference("");
                    setWarnings([]);
                    setAvailableTravelModes([]);
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
                    title="Save origin location"
                    className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    Save origin
                  </button>
                  <button
                    type="button"
                    onClick={() => saveLocation("destination")}
                    disabled={savingLocation}
                    title="Save destination location"
                    className="inline-flex items-center justify-center rounded-full bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    Save destination
                  </button>
                </div>
              ) : null}
            </form>

            {warnings.length ? (
              <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">Route warnings</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* // Show saved locations and management options only if user is logged in */}
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

                {savedLocations.length ? (
                  <>
                    <div className="mt-4 space-y-3">
                      {previewSavedLocations.map((location) => (
                        <div
                          key={location._id}
                          className="rounded-3xl border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p
                                className="truncate text-sm font-semibold text-slate-900"
                                title={location.name}
                              >
                                {location.name}
                              </p>
                              <p
                                className="truncate text-sm text-slate-600"
                                title={location.address}
                              >
                                {location.address}
                              </p>
                            </div>
                            <div className="grid gap-2 min-w-27">
                              <button
                                type="button"
                                onClick={() => setOrigin(location.address)}
                                className="w-full min-w-0 inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                                title="Use as origin"
                                aria-label="Set as origin"
                              >
                                <FiArrowUpRight className="h-4 w-4" />
                                Origin
                              </button>
                              <button
                                type="button"
                                onClick={() => setDestination(location.address)}
                                className="min-w-0 inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                                title="Use as destination"
                                aria-label="Set as destination"
                              >
                                <FiArrowDownLeft className="h-4 w-4" />
                                Destination
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  deleteSavedLocation(location._id)
                                }
                                className="min-w-0 inline-flex items-center justify-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                                title="Delete saved location"
                                aria-label="Delete saved location"
                              >
                                <FiTrash2 className="h-4 w-4" />
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {savedLocations.length > PREVIEW_LOCATION_COUNT ? (
                      <button
                        type="button"
                        onClick={() => setIsSavedLocationsOpen(true)}
                        className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        View all {savedLocations.length} saved locations
                      </button>
                    ) : null}

                    {isSavedLocationsOpen ? (
                      <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 px-4 py-6">
                        <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
                          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                            <div>
                              <h3 className="text-lg font-semibold text-slate-900">
                                All saved locations
                              </h3>
                              <p className="text-sm text-slate-500">
                                {savedLocations.length} saved locations
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsSavedLocationsOpen(false)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                              aria-label="Close saved locations list"
                            >
                              <FiX className="h-5 w-5" />
                            </button>
                          </div>
                          <div className="max-h-[60vh] overflow-y-auto px-4 py-4">
                            <div className="space-y-3">
                              {savedLocations.map((location) => (
                                <div
                                  key={location._id}
                                  className="rounded-3xl border border-slate-200 bg-slate-50 p-3"
                                >
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                      <p
                                        className="truncate text-sm font-semibold text-slate-900"
                                        title={location.name}
                                      >
                                        {location.name}
                                      </p>
                                      <p
                                        className="truncate text-sm text-slate-600"
                                        title={location.address}
                                      >
                                        {location.address}
                                      </p>
                                    </div>
                                    <div className="grid gap-2 min-w-27">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOrigin(location.address);
                                          setIsSavedLocationsOpen(false);
                                        }}
                                        className="w-full min-w-0 inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                                        title="Use as origin"
                                        aria-label="Set as origin"
                                      >
                                        <FiArrowUpRight className="h-4 w-4" />
                                        Origin
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDestination(location.address);
                                          setIsSavedLocationsOpen(false);
                                        }}
                                        className="min-w-0 inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                                        title="Use as destination"
                                        aria-label="Set as destination"
                                      >
                                        <FiArrowDownLeft className="h-4 w-4" />
                                        Destination
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          deleteSavedLocation(location._id)
                                        }
                                        className="min-w-0 inline-flex items-center justify-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                                        title="Delete saved location"
                                        aria-label="Delete saved location"
                                      >
                                        <FiTrash2 className="h-4 w-4" />
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </>
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

            {/* // Show route comparisons only if there are routes to compare */}
            {routes.length ? (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Route comparisons
                  </h3>
                  <p className="text-sm text-slate-500">
                    Tap a card to highlight a route on the map.
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

                      {/* // Show key route details in a grid below the main info */}
                      <div className="mt-4 grid gap-3 grid-cols-2 text-sm text-slate-700">
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
                            {route.fareText ||
                              route.costEffort ||
                              "Standard route"}
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
                  <div className="mt-4 grid gap-3 grid-cols-2 text-sm text-slate-700">
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
          </div>
        </BottomDrawer>
      </div>
    </main>
  );
}

export default MapPage;
