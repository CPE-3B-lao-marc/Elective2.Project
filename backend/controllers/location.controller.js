import { Location } from "../models/location.model.js";

// save a new location
const saveLocation = async (req, res) => {
  try {
    const { name, address, latitude, longitude } = req.body;

    const location = new Location({
      name,
      address,
      latitude,
      longitude,
    });

    await location.save();

    res.status(201).json({
      message: "Location saved successfully",
      location,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// delete a location by ID
const deleteLocation = async (req, res) => {
  try {
    const { id } = req.params;

    const location = await Location.findByIdAndDelete(id);

    if (!location) {
      return res.status(404).json({ message: "Location not found" });
    }

    res.status(200).json({
      message: "Location deleted successfully",
      location,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// view all saved locations
const getLocations = async (req, res) => {
  try {
    const locations = await Location.find();
    res.status(200).json({ locations });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const ROUTE_COLORS = ["#2563eb", "#10b981", "#f59e0b"];

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

async function fetchWeather(latitude, longitude) {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current_weather: "true",
      hourly: "precipitation_probability",
      timezone: "auto",
    });

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
    );

    if (!response.ok) return null;

    const json = await response.json();
    const precipitationProbability = Array.isArray(json.hourly?.precipitation_probability)
      ? json.hourly.precipitation_probability[0]
      : 0;

    return {
      current: json.current_weather,
      precipitationProbability,
    };
  } catch {
    return null;
  }
}

function buildWeatherImpact(weather, mode) {
  if (!weather?.current) {
    return {
      icon: "☀️",
      text: "Clear conditions",
      delayMinutes: 0,
      score: 0,
    };
  }

  const code = weather.current.weathercode || 0;
  const chance = weather.precipitationProbability ?? 0;
  const isWet = chance >= 30 || [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code);
  let icon = "☀️";
  let text = "Clear conditions";
  let delayMinutes = 0;

  if (isWet) {
    icon = "⚠️";
    text = `Wet weather likely (${chance}% chance)`;
    delayMinutes = mode === "walking" || mode === "bicycling" ? 12 : 6;
  } else if (code >= 1 && code <= 3) {
    icon = "⛅";
    text = "Partly cloudy";
  } else if (code >= 45 && code <= 48) {
    icon = "🌫️";
    text = "Foggy conditions";
    delayMinutes = 3;
  }

  const safetyPenalty = (mode === "walking" || mode === "bicycling") ? 20 : 0;

  return {
    icon,
    text,
    delayMinutes,
    score: chance + safetyPenalty,
  };
}

function buildTrafficImpact(leg, mode) {
  const duration = leg.duration?.value || 0;
  const trafficDuration = leg.duration_in_traffic?.value || duration;
  const extraMinutes = Math.max(0, Math.round((trafficDuration - duration) / 60));
  const ratio = duration > 0 ? trafficDuration / duration : 1;
  let icon = "🚦";
  let text = "Light traffic";
  let severity = "Light";

  if (extraMinutes >= 15 || ratio >= 1.3) {
    icon = "🚨";
    text = `Heavy traffic — +${extraMinutes} min`;
    severity = "Heavy";
  } else if (extraMinutes >= 5 || ratio >= 1.15) {
    icon = "⚠️";
    text = `Moderate traffic — +${extraMinutes} min`;
    severity = "Moderate";
  }

  if (mode !== "driving" && mode !== "transit") {
    text = `Estimated travel time`;
    severity = "Normal";
  }

  return {
    icon,
    text,
    delayMinutes: extraMinutes,
    severity,
    score: extraMinutes + (severity === "Heavy" ? 20 : severity === "Moderate" ? 10 : 0),
  };
}

function formatCostEffort(route, mode) {
  const distanceValue = route.legs?.[0]?.distance?.value || 0;
  const distanceKm = (distanceValue / 1000).toFixed(1);

  if (mode === "transit") {
    const fareText = route.fare?.text;
    if (fareText) {
      return `Fare: ${fareText}`;
    }

    const transfers = route.legs?.[0]?.steps?.filter(
      (step) => step.travel_mode === "TRANSIT",
    )?.length;

    return transfers ? `${transfers} transfer${transfers > 1 ? "s" : ""}` : "Transit route";
  }

  if (mode === "walking") {
    return `≈${Math.round(distanceValue / 0.8)} steps`;
  }

  if (mode === "bicycling") {
    return `${distanceKm} km bike ride`;
  }

  return `Distance: ${distanceKm} km`;
}

function chooseRouteLabels(routeInfos) {
  const labels = new Map();
  const byDuration = [...routeInfos].sort((a, b) => a.durationValue - b.durationValue);
  const byDistance = [...routeInfos].sort((a, b) => a.distanceValue - b.distanceValue);
  const bySafety = [...routeInfos].sort((a, b) => a.weatherScore - b.weatherScore);
  const byTraffic = [...routeInfos].sort((a, b) => a.trafficScore - b.trafficScore);

  if (byDuration[0]) labels.set(byDuration[0].id, "Fastest");
  if (byDistance[0]) {
    if (!labels.has(byDistance[0].id)) {
      labels.set(byDistance[0].id, "Eco-friendly");
    } else if (byDistance[1]) {
      labels.set(byDistance[1].id, "Eco-friendly");
    }
  }
  if (bySafety[0]) {
    if (!labels.has(bySafety[0].id)) {
      labels.set(bySafety[0].id, "Weather-safe");
    } else if (bySafety[1]) {
      labels.set(bySafety[1].id, "Weather-safe");
    }
  }
  if (byTraffic[0]) {
    if (!labels.has(byTraffic[0].id)) {
      labels.set(byTraffic[0].id, "Traffic-safe");
    } else if (byTraffic[1]) {
      labels.set(byTraffic[1].id, "Traffic-safe");
    }
  }

  return labels;
}

// fetch directions from Google Maps API through the backend proxy
const getDirections = async (req, res) => {
  try {
    const { origin, destination, mode } = req.query;
    const includeTransit = req.query.includeTransit === "true";
    const includeBiking = req.query.includeBiking === "true";

    if (!origin || !destination || !mode) {
      return res.status(400).json({
        message: "origin, destination, and mode are required",
      });
    }

    const googleKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleKey) {
      return res
        .status(500)
        .json({ message: "Google Maps API key is not configured." });
    }

    const params = new URLSearchParams({
      origin,
      destination,
      mode,
      alternatives: "true",
      departure_time: "now",
      key: googleKey,
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`,
    );
    const data = await response.json();

    if (data.status !== "OK" || !data.routes?.length) {
      return res.status(502).json({
        message: data.error_message || "Unable to get directions from Google.",
        status: data.status,
        details: data,
      });
    }

    const endLocation = data.routes[0]?.legs?.[0]?.end_location;
    const weather = await fetchWeather(endLocation?.lat, endLocation?.lng);
    const weatherImpact = buildWeatherImpact(weather, mode);

    const routeInfos = data.routes.slice(0, 3).map((route, index) => {
      const leg = route.legs?.[0] || {};
      const durationValue = leg.duration_in_traffic?.value || leg.duration?.value || 0;
      const distanceValue = leg.distance?.value || 0;
      const durationText = leg.duration_in_traffic?.text || leg.duration?.text || "Unknown";
      const coordinates = decodePolyline(route.overview_polyline?.points || "").map(
        (point) => [point.lng, point.lat],
      );
      const trafficImpact = buildTrafficImpact(leg, mode);

      return {
        id: index,
        mode,
        label: route.summary || `${origin} → ${destination}`,
        summary: route.summary || `${origin} → ${destination}`,
        durationText,
        distanceText: leg.distance?.text || "Unknown",
        durationValue,
        distanceValue,
        weatherImpact,
        weatherScore: weatherImpact.score,
        trafficImpact,
        trafficScore: trafficImpact.score,
        costEffort: formatCostEffort(route, mode),
        color: ROUTE_COLORS[index % ROUTE_COLORS.length],
        coordinates,
        originLocation: leg.start_location,
        destinationLocation: leg.end_location,
        fare: route.fare,
      };
    });

    const labelMap = chooseRouteLabels(routeInfos);
    const routes = routeInfos.map((route) => ({
      ...route,
      label: labelMap.get(route.id) || route.label,
    }));

    res.json({
      status: data.status,
      routes,
      includeTransit,
      includeBiking,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message || "Internal server error",
      error: error.message,
    });
  }
};

export { saveLocation, deleteLocation, getLocations, getDirections };
