// ── Global Variables ──
let map;
let currentMarkers = [];
let currentRoutes = [];
let currentMode = 'drive';
let savedLocations = [];
let recentSearches = [];
let currentUser = null;
let selectedRouteLayer = null;

let priorities = { jeepney: null, bus: null, train: null };

// ── Dark Mode ──
function toggleDarkMode() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('theme-icon').className = isDark ? 'fas fa-moon' : 'fas fa-sun';
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

function loadTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    document.getElementById('theme-icon').className = saved === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// ── Departure Time ──
function toggleCustomTime() {
    const type = document.getElementById('depart-type').value;
    const group = document.getElementById('custom-time-group');
    group.style.display = type === 'custom' ? 'flex' : 'none';
    if (type === 'custom') {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('depart-time').value = now.toISOString().slice(0, 16);
    }
}

function getDepartureHour() {
    const type = document.getElementById('depart-type').value;
    if (type === 'custom') {
        const val = document.getElementById('depart-time').value;
        if (val) return new Date(val).getHours();
    }
    return new Date().getHours();
}

// ── localStorage helpers ──
function loadSavedData() {
    try {
        const saved = localStorage.getItem('savedLocations');
        if (saved) savedLocations = JSON.parse(saved);
        const recent = localStorage.getItem('recentSearches');
        if (recent) recentSearches = JSON.parse(recent);
        updateRecentSearches();
    } catch (e) { console.warn('Load error', e); }
}

function saveData() {
    localStorage.setItem('savedLocations', JSON.stringify(savedLocations));
    localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
}

function updateRecentSearches() {
    const container = document.getElementById('recent-list');
    if (!container) return;
    container.innerHTML = recentSearches.slice(0, 5).map(s =>
        `<span class="recent-item" onclick="fillSearch('${s.origin.replace(/'/g,"\\'")}','${s.destination.replace(/'/g,"\\'")}')">
            ${s.origin.substring(0,18)} → ${s.destination.substring(0,18)}
        </span>`
    ).join('');
}

function fillSearch(origin, destination) {
    document.getElementById('origin').value = origin;
    document.getElementById('destination').value = destination;
    planRoute();
}

function addToRecent(origin, destination) {
    recentSearches = recentSearches.filter(s => !(s.origin === origin && s.destination === destination));
    recentSearches.unshift({ origin, destination });
    if (recentSearches.length > 10) recentSearches.pop();
    saveData();
    updateRecentSearches();
}

// ── Map ──
function initMap() {
    if (map) { map.invalidateSize(); return; }
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    map = L.map('map', { zoomControl: false }).setView([14.5995, 120.9842], 12);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const tileUrl = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    L.tileLayer(tileUrl, {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19, minZoom: 3
    }).addTo(map);

    L.control.scale({ metric: true, imperial: false }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── OSRM Profile mapping ──
const OSRM_PROFILES = {
    drive:   'driving',
    walk:    'foot',
    bike:    'cycling',
    transit: 'driving'   // transit uses driving roads as base; we adjust duration after
};

// Snap a coordinate to the nearest routable road via OSRM nearest endpoint
async function snapToRoad(coords, profile) {
    try {
        const url = `https://router.project-osrm.org/nearest/v1/${profile}/${coords.lon},${coords.lat}?number=1`;
        const res = await axios.get(url, { timeout: 5000 });
        if (res.data && res.data.code === 'Ok' && res.data.waypoints.length > 0) {
            const wp = res.data.waypoints[0].location; // [lon, lat]
            return { lat: wp[1], lon: wp[0] };
        }
    } catch {}
    return coords; // return original if snapping fails
}

// Fetch a real road route from OSRM with road snapping
async function fetchOSRMRoute(originCoords, destCoords, profile) {
    // Snap both endpoints to nearest roads first for accuracy
    const [snappedOrigin, snappedDest] = await Promise.all([
        snapToRoad(originCoords, profile),
        snapToRoad(destCoords, profile)
    ]);

    const url = `https://router.project-osrm.org/route/v1/${profile}/` +
                `${snappedOrigin.lon},${snappedOrigin.lat};${snappedDest.lon},${snappedDest.lat}` +
                `?overview=full&geometries=geojson&steps=false&annotations=false`;

    const res = await axios.get(url, { timeout: 15000 });
    if (!res.data || res.data.code !== 'Ok' || !res.data.routes.length) {
        throw new Error(`OSRM error: ${res.data?.code || 'No route found'}`);
    }
    return res.data.routes[0];
}

// Philippine regional traffic multipliers by hour
function getPHTrafficMultiplier(hour, distKm) {
    // Peak hours in PH: 7-9 AM and 5-8 PM are notoriously bad
    if (hour >= 7  && hour <= 9)  return distKm > 5 ? 2.0 : 1.6;  // morning rush
    if (hour >= 17 && hour <= 20) return distKm > 5 ? 2.2 : 1.8;  // evening rush (worse)
    if (hour >= 11 && hour <= 13) return 1.3;                       // lunch hour
    if (hour >= 21 || hour <= 5)  return 1.0;                       // off-peak / late night
    return 1.15;                                                      // normal daytime
}

// Physical speed limits — OSRM sometimes returns unrealistic times, these are hard floors
const MODE_SPEEDS = {
    walk:    { kmh: 4.5,  minKmh: 3.5  },  // walking: 4-5 km/h realistic
    bike:    { kmh: 14,   minKmh: 10   },  // cycling in PH traffic: 10-18 km/h
    drive:   { kmh: 35,   minKmh: 8    },  // driving in Metro Manila: highly variable
    transit: { kmh: 20,   minKmh: 10   },  // mixed jeep/bus/rail: 10-25 km/h avg
};

function sanitizeDuration(durationSec, distKm, mode) {
    const speeds = MODE_SPEEDS[mode] || MODE_SPEEDS.drive;
    // Min time = distance / max realistic speed
    const minSec = Math.round((distKm / speeds.kmh) * 3600);
    // Max sanity: distance / absolute minimum speed (e.g. severe traffic)
    const maxSec = Math.round((distKm / speeds.minKmh) * 3600);
    // Clamp OSRM result between physically possible bounds
    return Math.max(minSec, Math.min(durationSec, maxSec));
}

// ── OTP Transit Routing (new) ──
async function getOTPTransitRoute(originCoords, destCoords) {
    const from = `${originCoords.lon},${originCoords.lat}`;
    const to   = `${destCoords.lon},${destCoords.lat}`;
    const date = new Date().toISOString().slice(0,10);
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    const url = `http://localhost:8080/otp/routers/default/plan?fromPlace=${encodeURIComponent(from)}&toPlace=${encodeURIComponent(to)}&mode=TRANSIT,WALK&date=${date}&time=${time}&geojson=true`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`OTP error: ${response.status}`);
    const data = await response.json();

    if (!data.plan || !data.plan.itineraries.length) {
        throw new Error('No transit route found');
    }

    const itin = data.plan.itineraries[0];
    const totalDistance = (itin.walkDistance + (itin.transitDistance || 0)) / 1000; // km
    const totalDuration = itin.duration; // seconds

    // Build GeoJSON line from all legs
    const geometry = { type: "LineString", coordinates: [] };
    for (const leg of itin.legs) {
        if (leg.legGeometry && leg.legGeometry.points) {
            const points = decodePolyline(leg.legGeometry.points);
            for (const p of points) {
                geometry.coordinates.push([p.lng, p.lat]);
            }
        }
    }

    return {
        routes: [{
            distance: totalDistance * 1000,
            duration: totalDuration,
            geometry: geometry,
            legs: itin.legs,   // store for step generation
        }]
    };
}

// Decode Google polyline (used by OTP)
function decodePolyline(encoded) {
    let points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;
    while (index < len) {
        let b, shift = 0, result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;
        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;
        points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }
    return points;
}

// Modified getRealisticRoute to use OTP for transit
async function getRealisticRoute(originCoords, destCoords, mode) {
    // Transit → use OTP
    if (mode === 'transit') {
        try {
            const otpRoute = await getOTPTransitRoute(originCoords, destCoords);
            return otpRoute;
        } catch (err) {
            console.warn('OTP transit failed, falling back to OSRM estimate:', err.message);
            // fall through to OSRM (driving profile) as estimate
        }
    }

    // Non‑transit or fallback: use OSRM
    const profile = OSRM_PROFILES[mode] || 'driving';
    try {
        const osrmRoute = await fetchOSRMRoute(originCoords, destCoords, profile);
        const distanceM = osrmRoute.distance;
        const distKm    = distanceM / 1000;
        let durationSec = osrmRoute.duration;

        durationSec = sanitizeDuration(durationSec, distKm, mode);

        if (mode === 'walk') {
            durationSec = Math.round((distKm / 4.5) * 3600);
        }
        if (mode === 'bike') {
            durationSec = Math.round((distKm / 14) * 3600);
        }
        if (mode === 'drive') {
            const h = getDepartureHour();
            durationSec = Math.round(durationSec * getPHTrafficMultiplier(h, distKm));
            durationSec = sanitizeDuration(durationSec, distKm, 'drive');
        }
        if (mode === 'transit') {
            const avgSpeedKmh = distKm < 3 ? 15 : distKm < 8 ? 18 : distKm < 20 ? 22 : 25;
            const transferMins = distKm < 3 ? 8 : distKm < 8 ? 18 : distKm < 15 ? 28 : distKm < 30 ? 40 : 55;
            const h = getDepartureHour();
            const rushPenalty = (h >= 7 && h <= 9) || (h >= 17 && h <= 20) ? 1.3 : 1.0;
            durationSec = Math.round(((distKm / avgSpeedKmh) * 3600 + transferMins * 60) * rushPenalty);
        }

        return {
            routes: [{
                distance: distanceM,
                duration: durationSec,
                geometry: osrmRoute.geometry
            }]
        };
    } catch (err) {
        console.warn(`OSRM failed for ${mode}, using fallback:`, err.message);
        return fallbackRoute(originCoords, destCoords, mode);
    }
}

// Fallback straight-line estimator (used only if OSRM is unavailable)
function fallbackRoute(originCoords, destCoords, mode) {
    const straight = calculateDistance(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon);
    const cfg = {
        drive:   { factor: 1.35, speedKmh: 30  },
        transit: { factor: 1.45, speedKmh: 18  },
        walk:    { factor: 1.2,  speedKmh: 4.5 },
        bike:    { factor: 1.25, speedKmh: 14  },
    }[mode] || { factor: 1.35, speedKmh: 25 };
    const distKm = straight * cfg.factor;
    const durSec = Math.round((distKm / cfg.speedKmh) * 3600);
    const mid = { lat: (originCoords.lat + destCoords.lat)/2, lon: (originCoords.lon + destCoords.lon)/2 };
    return {
        routes: [{
            distance: distKm * 1000,
            duration: durSec,
            geometry: {
                type: 'LineString',
                coordinates: [
                    [originCoords.lon, originCoords.lat],
                    [mid.lon, mid.lat],
                    [destCoords.lon, destCoords.lat]
                ]
            }
        }]
    };
}

function getTrafficData(route) {
    const h = getDepartureHour();
    const baseMins = Math.round(route.duration / 60);
    const levels = h >= 6 && h < 10  ? { light:0.1, mod:0.35, heavy:0.55 }
                 : h >= 16 && h < 20 ? { light:0.05, mod:0.3,  heavy:0.65 }
                 : h >= 22 || h < 5  ? { light:0.85, mod:0.1,  heavy:0.05 }
                 :                     { light:0.55, mod:0.3,  heavy:0.15 };
    const r = Math.random();
    const status = r < levels.heavy ? 'heavy' : r < levels.heavy + levels.mod ? 'moderate' : 'light';
    const extraMult = status === 'heavy' ? 1.25 : status === 'moderate' ? 1.1 : 1.0;
    const colors = { light:'#10b981', moderate:'#f59e0b', heavy:'#ef4444' };
    const icons  = { light:'fa-car', moderate:'fa-car-side', heavy:'fa-traffic-light' };
    return {
        status, delayMultiplier: extraMult,
        adjustedDuration: Math.round(baseMins * extraMult),
        originalDuration: baseMins,
        color: colors[status], icon: icons[status]
    };
}

// ── Mode tabs ──
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentMode = tab.dataset.mode;
            const o = document.getElementById('origin').value;
            const d = document.getElementById('destination').value;
            if (o && d) planRoute();
        });
    });
    loadSavedData();
    loadPriorities();
    showAdvisories();
    checkSharedRoute();
});

// ── Auth ──
function showLoginModal() { document.getElementById('login-modal').style.display = 'flex'; }
function closeLoginModal() { document.getElementById('login-modal').style.display = 'none'; }

function login() {
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;
    if (!u || !p) { alert('Please enter username and password'); return; }
    currentUser = u;
    document.getElementById('user-nav').innerHTML = `
        <div style="display:flex;align-items:center;gap:0.75rem;">
            <span style="font-size:0.85rem;font-weight:600;"><i class="fas fa-user-circle"></i> ${u}</span>
            <button class="btn-login" onclick="logout()">Logout</button>
        </div>`;
    closeLoginModal();
    const ul = localStorage.getItem(`saved_${u}`);
    if (ul) savedLocations = JSON.parse(ul);
}

function logout() {
    currentUser = null;
    document.getElementById('user-nav').innerHTML = `
        <button class="btn-login" onclick="showLoginModal()">
            <i class="fas fa-user-circle"></i> <span class="btn-login-text">Login</span>
        </button>`;
}

function showSavedLocations() {
    if (!currentUser) { alert('Please login first to use saved locations'); showLoginModal(); return; }
    if (savedLocations.length === 0) { alert('No saved locations yet.'); return; }
    const list = savedLocations.map((l,i) => `${i+1}. ${l.name} — ${l.address.substring(0,40)}`).join('\n');
    const choice = prompt(`Saved Locations:\n${list}\n\nEnter number to use as origin:`);
    if (choice && !isNaN(choice) && savedLocations[+choice-1]) {
        document.getElementById('origin').value = savedLocations[+choice-1].address;
    }
}

function saveCurrentLocation() {
    const name = document.getElementById('save-name').value.trim();
    const addr = document.getElementById('origin').value.trim();
    if (!name || !addr) { alert('Please enter a name and have an origin set'); return; }
    savedLocations.push({ name, address: addr });
    localStorage.setItem(`saved_${currentUser}`, JSON.stringify(savedLocations));
    closeSaveModal();
    alert(`📍 "${name}" saved!`);
}

function closeSaveModal() { document.getElementById('save-modal').style.display = 'none'; }

// ── Geolocation ──
function useCurrentLocation() {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(async pos => {
        const addr = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        document.getElementById('origin').value = addr;
    }, () => alert('Unable to get current location. Please allow location access.'));
}

// Philippines bounding box
const PH_BOUNDS = { minLat: 4.5, maxLat: 21.5, minLon: 116.0, maxLon: 127.0 };

function isInPhilippines(lat, lon) {
    return lat >= PH_BOUNDS.minLat && lat <= PH_BOUNDS.maxLat &&
           lon >= PH_BOUNDS.minLon && lon <= PH_BOUNDS.maxLon;
}

async function reverseGeocode(lat, lon) {
    try {
        const r = await axios.get('https://nominatim.openstreetmap.org/reverse', {
            params: { lat, lon, format: 'json', 'accept-language': 'en' },
            headers: { 'User-Agent': 'SmartCommutePH/2.0' }
        });
        const a = r.data.address || {};
        const parts = [
            a.road || a.pedestrian || a.footway,
            a.suburb || a.village || a.town,
            a.city || a.municipality || a.county,
            a.province || a.state
        ].filter(Boolean);
        return parts.length ? parts.join(', ') : r.data.display_name;
    } catch { return `${lat.toFixed(5)}, ${lon.toFixed(5)}`; }
}

async function geocodeLocation(address) {
    const trimmed = address.trim();

    // Handle raw coordinates
    const coordMatch = trimmed.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
        const lat = parseFloat(coordMatch[1]), lon = parseFloat(coordMatch[2]);
        if (isInPhilippines(lat, lon)) return { lat, lon, displayName: trimmed };
        throw new Error('Coordinates are outside the Philippines.');
    }

    // Primary search: PH country code biased
    let results = [];
    try {
        const r = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: trimmed,
                format: 'json',
                limit: 5,
                countrycodes: 'ph',
                addressdetails: 1,
                'accept-language': 'en',
                viewbox: '116.0,4.5,127.0,21.5',
                bounded: 0
            },
            headers: { 'User-Agent': 'SmartCommutePH/2.0' }
        });
        results = (r.data || []).filter(r => isInPhilippines(parseFloat(r.lat), parseFloat(r.lon)));
    } catch (e) {
        throw new Error('Geocoding service unavailable. Check your internet connection.');
    }

    // Fallback: append Philippines and retry
    if (results.length === 0) {
        try {
            const r2 = await axios.get('https://nominatim.openstreetmap.org/search', {
                params: { q: trimmed + ', Philippines', format: 'json', limit: 5, addressdetails: 1, 'accept-language': 'en' },
                headers: { 'User-Agent': 'SmartCommutePH/2.0' }
            });
            results = (r2.data || []).filter(r => isInPhilippines(parseFloat(r.lat), parseFloat(r.lon)));
        } catch {}
    }

    if (results.length === 0) {
        throw new Error(`"${trimmed}" not found in the Philippines. Try adding a city or province (e.g. "Rizal, Laguna").`);
    }

    // Rank: prefer specific place types over generic ones
    const priority = ['road','suburb','village','town','city','municipality','province'];
    results.sort((a, b) => {
        const aS = priority.indexOf(a.type) === -1 ? -1 : priority.indexOf(a.type);
        const bS = priority.indexOf(b.type) === -1 ? -1 : priority.indexOf(b.type);
        return bS - aS;
    });

    const best = results[0];
    return { lat: parseFloat(best.lat), lon: parseFloat(best.lon), displayName: best.display_name, type: best.type };
}

async function getWeather(lat, lon) {
    const r = await axios.get('https://api.open-meteo.com/v1/forecast', {
        params: { latitude: lat, longitude: lon, current_weather: true, hourly: 'precipitation_probability', timezone: 'auto' }
    });
    return r.data;
}

// ── Map helpers ──
function clearMap() {
    currentMarkers.forEach(m => m.remove && m.remove());
    currentMarkers = [];
    if (selectedRouteLayer) { map.removeLayer(selectedRouteLayer); selectedRouteLayer = null; }
}

function displayRouteOnMap(routeData, trafficInfo) {
    if (selectedRouteLayer) { map.removeLayer(selectedRouteLayer); selectedRouteLayer = null; }
    if (!routeData?.routes?.length) return;
    const color = trafficInfo ? trafficInfo.color : '#2563eb';
    selectedRouteLayer = L.geoJSON(routeData.routes[0].geometry, {
        style: { color, weight: 5, opacity: 0.85, dashArray: trafficInfo?.status === 'heavy' ? '10,8' : null }
    }).addTo(map);
    const b = selectedRouteLayer.getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [50, 50] });
}

function calculateETA(mins) {
    const eta = new Date(Date.now() + mins * 60000);
    return eta.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getModeColor(m) { return {drive:'#2563eb',transit:'#10b981',walk:'#f59e0b',bike:'#8b5cf6'}[m]||'#2563eb'; }
function getModeIcon(m)  { return {drive:'fa-car',transit:'fa-bus',walk:'fa-person-walking',bike:'fa-bicycle'}[m]||'fa-route'; }
function getModeName(m)  { return {drive:'🚗 Driving',transit:'🚌 Transit',walk:'🚶 Walking',bike:'🚲 Cycling'}[m]||m; }

// ── Main Route Planning ──
async function planRoute() {
    const origin = document.getElementById('origin').value.trim();
    const destination = document.getElementById('destination').value.trim();
    if (!origin || !destination) { alert('Please enter both origin and destination'); return; }

    addToRecent(origin, destination);

    const resultsContainer = document.getElementById('results-container');
    const routeList = document.getElementById('route-list');
    resultsContainer.style.display = 'block';
    routeList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i>&nbsp; Finding best routes…</div>';

    try {
        if (!map) initMap(); else map.invalidateSize();

        const [originCoords, destCoords] = await Promise.all([
            geocodeLocation(origin), geocodeLocation(destination)
        ]);

        clearMap();

        const startIcon = L.divIcon({ html:'<div style="background:#10b981;width:14px;height:14px;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>', className:'', iconAnchor:[7,7] });
        const endIcon   = L.divIcon({ html:'<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>', className:'', iconAnchor:[7,7] });

        currentMarkers.push(
            L.marker([originCoords.lat, originCoords.lon], { icon: startIcon }).addTo(map).bindPopup(`<strong>📍 Start</strong><br>${origin}`),
            L.marker([destCoords.lat,   destCoords.lon],   { icon: endIcon   }).addTo(map).bindPopup(`<strong>🎯 End</strong><br>${destination}`)
        );

        map.fitBounds(L.latLngBounds([originCoords.lat, originCoords.lon],[destCoords.lat, destCoords.lon]), { padding:[50,50] });

        const weather = await getWeather(destCoords.lat, destCoords.lon).catch(() => null);

        const modes = ['drive','transit','walk','bike'];
        const routes = [];

        for (const mode of modes) {
            const route = await getRealisticRoute(originCoords, destCoords, mode);
            if (!route?.routes?.length) continue;
            const dist = (route.routes[0].distance / 1000).toFixed(1);
            const dur  = Math.round(route.routes[0].duration / 60);
            const trafficInfo = mode === 'drive' ? getTrafficData(route.routes[0]) : null;
            const finalDur = trafficInfo ? trafficInfo.adjustedDuration : dur;
            routes.push({
                mode, distance: dist, duration: dur,
                adjustedDuration: finalDur,
                eta: calculateETA(finalDur),
                routeData: route, trafficInfo,
                color: trafficInfo ? trafficInfo.color : getModeColor(mode)
            });
        }

        if (!routes.length) {
            routeList.innerHTML = '<div class="loading" style="color:var(--red)">No routes found. Try different locations.</div>';
            return;
        }

        routes.sort((a,b) => a.adjustedDuration - b.adjustedDuration);
        currentRoutes = routes;

        displayRoutes(routes, weather);
        displayRouteOnMap(routes[0].routeData, routes[0].trafficInfo);
        if (weather) updateWeatherBadge(weather);

        // Show map overlay label
        const overlay = document.getElementById('map-overlay');
        const label = document.getElementById('map-route-label');
        if (overlay && label) {
            label.textContent = `${origin.split(',')[0]} → ${destination.split(',')[0]}`;
            overlay.style.display = 'block';
        }

    } catch (err) {
        console.error(err);
        routeList.innerHTML = `<div class="loading" style="color:var(--red)">❌ ${err.message || 'Could not find routes. Please check the locations and try again.'}</div>`;
    }
}

// Generate steps from OTP legs
function generateStepsFromOTPLegs(legs) {
    const steps = [];
    for (const leg of legs) {
        if (leg.mode === 'WALK') {
            steps.push({ icon: 'fa-person-walking', text: `Walk ${Math.round(leg.distance)} m to ${leg.to.name}` });
        } else if (leg.mode === 'BUS') {
            let routeName = leg.route || leg.routeShortName || 'Bus';
            steps.push({ icon: 'fa-bus', text: `Take ${routeName} bus from ${leg.from.name} to ${leg.to.name}` });
        } else if (leg.mode === 'RAIL') {
            let routeName = leg.route || leg.routeShortName || 'Train';
            steps.push({ icon: 'fa-train', text: `Take ${routeName} train from ${leg.from.name} to ${leg.to.name}` });
        } else if (leg.mode === 'TRAM') {
            steps.push({ icon: 'fa-train', text: `Take tram from ${leg.from.name} to ${leg.to.name}` });
        } else if (leg.mode === 'SUBWAY') {
            steps.push({ icon: 'fa-subway', text: `Take subway from ${leg.from.name} to ${leg.to.name}` });
        } else if (leg.mode === 'FERRY') {
            steps.push({ icon: 'fa-ship', text: `Take ferry from ${leg.from.name} to ${leg.to.name}` });
        } else {
            steps.push({ icon: 'fa-route', text: `${leg.mode} from ${leg.from.name} to ${leg.to.name}` });
        }
    }
    return steps;
}

// ── Display Routes ──
function displayRoutes(routes, weather) {
    const container = document.getElementById('route-list');
    const badges = ['badge-best','badge-fast','badge-eco'];
    const badgeLabels = ['Best','Fast','Eco'];

    container.innerHTML = routes.map((route, i) => {
        const fare = calculateFare(parseFloat(route.distance), route.mode);
        // Use real OTP legs if available
        let steps;
        if (route.routeData.routes[0].legs) {
            steps = generateStepsFromOTPLegs(route.routeData.routes[0].legs);
        } else {
            steps = generateRouteSteps(route, parseFloat(route.distance));
        }
        const fareLegs = generateFareBreakdown(route, parseFloat(route.distance));
        const badge = i < 3 ? `<span class="route-badge ${badges[i]}">${badgeLabels[i]}</span>` : '';
        const trafficTag = route.trafficInfo
            ? `<span style="color:${route.trafficInfo.color};font-size:0.75rem;font-weight:600;">
                <i class="fas ${route.trafficInfo.icon}"></i> ${route.trafficInfo.status === 'light' ? 'Light' : route.trafficInfo.status === 'moderate' ? 'Moderate' : 'Heavy'} traffic
               </span>` : '';

        return `
        <div class="route-card" onclick="selectRoute(${i})" data-index="${i}">
            <div class="route-card-left">
                <div class="route-icon ${route.mode}"><i class="fas ${getModeIcon(route.mode)}"></i></div>
                ${badge}
            </div>
            <div class="route-details">
                <div class="route-title">
                    ${getModeName(route.mode)}
                    <span class="route-fare-inline">${fare}</span>
                </div>
                <div class="route-stats">
                    <span><i class="fas fa-road"></i> ${route.distance} km</span>
                    <span><i class="fas fa-clock"></i> ${route.adjustedDuration} min</span>
                    <span class="route-eta"><i class="fas fa-flag-checkered"></i> ETA ${route.eta}</span>
                </div>
                ${trafficTag}

                ${fareLegs.length > 1 ? `
                <div class="fare-breakdown">
                    <div class="fare-breakdown-title"><i class="fas fa-receipt"></i> Fare Breakdown</div>
                    ${fareLegs.map(fl => `
                        <div class="fare-leg">
                            <div class="fare-leg-icon"><i class="fas ${fl.icon}" style="color:${fl.color}"></i></div>
                            <span class="fare-leg-name">${fl.name}</span>
                            <span class="fare-leg-amount">${fl.amount}</span>
                        </div>
                    `).join('')}
                    <div class="fare-total-row"><span></span><strong>${fare}</strong></div>
                </div>` : ''}

                <div class="route-steps">
                    ${steps.map(s => `<div class="route-step"><i class="fas ${s.icon}"></i> ${s.text}</div>`).join('')}
                </div>

                <div class="route-card-actions">
                    <button class="route-action-btn" onclick="event.stopPropagation();saveRoute(${i})"><i class="fas fa-bookmark"></i> Save</button>
                    <button class="route-action-btn" onclick="event.stopPropagation();showRouteDetails(${i})"><i class="fas fa-info-circle"></i> Details</button>
                    <button class="feedback-btn" onclick="event.stopPropagation();reportRouteIssue(${i})"><i class="fas fa-flag"></i> Suggest fix</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ── Fare Breakdown ──
function generateFareBreakdown(route, dist) {
    if (route.mode === 'drive') {
        return [
            { icon:'fa-gas-pump', color:'#ef4444', name:'Fuel estimate', amount: Math.round(dist*8) },
            { icon:'fa-circle-parking', color:'#8b5cf6', name:'Parking (avg)', amount: 50 }
        ];
    }
    if (route.mode === 'transit') {
        const origin = document.getElementById('origin').value;
        const dest   = document.getElementById('destination').value;
        const plan = getTransitPlan(origin, dest, dist);
        const iconColor = { jeep:'#f59e0b', bus:'#10b981', lrt:'#2563eb', drive:'#2563eb', walk:'#8b5cf6', bike:'#8b5cf6' };
        return plan.legs
            .filter(l => l.fare > 0)
            .map(l => ({
                icon: l.icon,
                color: iconColor[l.type] || '#64748b',
                name: l.modeName,
                amount: l.fare
            }));
    }
    return [];
}

// ── Fare Calculation ──
function calculateFare(dist, mode) {
    if (mode === 'walk' || mode === 'bike') return 0;
    if (mode === 'transit') {
        if (dist < 3)  return Math.round(13 + Math.max(0, dist-2));
        if (dist < 8)  return Math.round(28 + dist*1.5);
        if (dist < 15) return Math.round(56 + (dist-8)*2);
        return Math.round(70 + (dist-15)*1.8);
    }
    if (mode === 'drive') return Math.round(dist*8 + 50);
    return Math.round(dist*6);
}

// ── Route Steps (fallback) ──
function generateRouteSteps(route, dist) {
    const steps = [];
    const origin = document.getElementById('origin').value;
    const dest   = document.getElementById('destination').value;
    const dur    = route.adjustedDuration || route.duration;
    const h      = getDepartureHour();
    const rush   = (h >= 7 && h <= 9) || (h >= 17 && h <= 20);

    if (route.mode === 'transit') {
        const plan = getTransitPlan(origin, dest, dist);
        plan.legs.forEach(leg => {
            let text = '';
            if (leg.type === 'walk' && leg.getOn === null && !leg.route) return;
            if (leg.type === 'walk') {
                text = leg.route || `Walk ${leg.duration ? '(~' + leg.duration + ' min)' : ''}`;
            } else if (leg.type === 'jeep') {
                const board = leg.getOn ? `at ${leg.getOn}` : '';
                const alight = leg.getOff ? `→ alight at ${leg.getOff}` : '';
                text = `Board ${leg.routeNumber || 'Jeepney'} ${board} ${alight}`.trim();
            } else if (leg.type === 'bus') {
                const board = leg.getOn ? `at ${leg.getOn}` : '';
                const alight = leg.getOff ? `→ alight at ${leg.getOff}` : '';
                text = `${leg.modeName} ${board} ${alight}`.trim();
                if (leg.route) text = leg.route;
            } else if (leg.type === 'lrt') {
                text = `Ride ${leg.modeName} from ${leg.getOn} → ${leg.getOff} (~${leg.duration} min)`;
            } else if (leg.type === 'drive') {
                text = leg.route || leg.modeName;
            } else {
                text = leg.route || leg.modeName;
            }
            if (text) steps.push({ icon: leg.icon, text: text.replace(/\s+/g,' ').trim() });
        });
    } else if (route.mode === 'drive') {
        const roads = dist > 25 ? 'NLEX / SLEX / expressways'
                    : dist > 12 ? 'EDSA / C5 / main roads'
                    : 'main roads';
        steps.push({ icon:'fa-car', text:`Drive via ${roads}` });
        if (rush) steps.push({ icon:'fa-traffic-light', text:`Expect heavy traffic — peak hour (add 20–40 min)` });
        steps.push({ icon:'fa-flag-checkered', text:`Arrive at destination in ~${dur} min` });
    } else if (route.mode === 'walk') {
        const hrs  = Math.floor(dur / 60);
        const mins = dur % 60;
        const timeStr = hrs > 0 ? `${hrs} hr ${mins} min` : `${dur} min`;
        steps.push({ icon:'fa-person-walking', text:`Walk at normal pace (~4.5 km/h) — ${dist} km` });
        steps.push({ icon:'fa-clock', text:`Estimated walking time: ${timeStr}` });
        if (dist > 5) steps.push({ icon:'fa-triangle-exclamation', text:`Note: This is a long walk — consider transit or cycling instead` });
    } else if (route.mode === 'bike') {
        const hrs  = Math.floor(dur / 60);
        const mins = dur % 60;
        const timeStr = hrs > 0 ? `${hrs} hr ${mins} min` : `${dur} min`;
        steps.push({ icon:'fa-bicycle', text:`Cycle via bike-friendly roads at ~14 km/h — ${dist} km` });
        steps.push({ icon:'fa-clock', text:`Estimated cycling time: ${timeStr}` });
        if (rush) steps.push({ icon:'fa-triangle-exclamation', text:`Peak hour — watch out for heavy traffic on main roads` });
    }
    return steps;
}

// ── Select Route ──
function selectRoute(index) {
    const route = currentRoutes[index];
    if (!route) return;
    document.querySelectorAll('.route-card').forEach(c => c.classList.remove('selected'));
    document.querySelector(`.route-card[data-index="${index}"]`)?.classList.add('selected');
    displayRouteOnMap(route.routeData, route.trafficInfo);
    document.getElementById('map').scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function saveRoute(index) {
    if (!currentUser) { alert('Please login to save routes'); showLoginModal(); return; }
    const route = currentRoutes[index];
    if (!route) return;
    const saved = JSON.parse(localStorage.getItem(`saved_routes_${currentUser}`) || '[]');
    saved.push({
        id: Date.now(),
        origin: document.getElementById('origin').value,
        destination: document.getElementById('destination').value,
        mode: route.mode, distance: route.distance,
        duration: route.adjustedDuration, eta: route.eta,
        date: new Date().toISOString()
    });
    localStorage.setItem(`saved_routes_${currentUser}`, JSON.stringify(saved));
    alert('✅ Route saved!');
}

function showRouteDetails(index) {
    const route = currentRoutes[index];
    if (!route) return;
    showRouteDetailModal(route, document.getElementById('origin').value, document.getElementById('destination').value);
}

// ── Weather ──
function updateWeatherBadge(weather) {
    const badge = document.getElementById('weather-badge');
    if (!weather?.current_weather) return;
    const wc = weather.current_weather.weathercode;
    const t  = weather.current_weather.temperature;
    const map2 = [[0,'fa-sun','Clear'],[1,'fa-sun','Mainly clear'],[2,'fa-cloud-sun','Partly cloudy'],[3,'fa-cloud','Overcast']];
    let icon = 'fa-cloud-sun', cond = 'Partly cloudy';
    for (const [code, ic, label] of map2) {
        if (wc === code) { icon = ic; cond = label; break; }
    }
    if (wc >= 51 && wc <= 67) { icon = 'fa-cloud-rain'; cond = 'Rain'; }
    if (wc >= 71 && wc <= 77) { icon = 'fa-cloud-bolt'; cond = 'Storm'; }
    badge.innerHTML = `<i class="fas ${icon}"></i> ${t}°C — ${cond}`;
}

// ── Priorities ──
function loadPriorities() {
    const s = localStorage.getItem('transportPriorities');
    if (s) { priorities = JSON.parse(s); updatePriorityButtons(); }
}

function savePriorities() { localStorage.setItem('transportPriorities', JSON.stringify(priorities)); }

function setPriority(mode, action) {
    priorities[mode] = priorities[mode] === action ? null : action;
    savePriorities();
    updatePriorityButtons();
    const o = document.getElementById('origin').value, d = document.getElementById('destination').value;
    if (o && d) planRoute();
}

function updatePriorityButtons() {
    document.querySelectorAll('.prefer-btn, .avoid-btn').forEach(btn => {
        const mode   = btn.dataset.mode;
        const action = btn.classList.contains('prefer-btn') ? 'prefer' : 'avoid';
        btn.classList.toggle('active', priorities[mode] === action);
    });
}

function togglePriorityPanel() {
    const panel = document.getElementById('priority-panel');
    const icon  = document.getElementById('priority-icon');
    const open  = panel.style.display === 'none';
    panel.style.display = open ? 'block' : 'none';
    icon.style.transform = open ? 'rotate(180deg)' : 'rotate(0)';
}

// ── Swap ──
function swapLocations() {
    const o = document.getElementById('origin');
    const d = document.getElementById('destination');
    [o.value, d.value] = [d.value, o.value];
    if (o.value && d.value) planRoute();
}

// ── Advisories ──
function showAdvisories() {
    const list = [
        "⚠️ LRT-1 maintenance every Sunday until 7 AM — expect delays.",
        "🚧 EDSA Busway schedule adjusted for the upcoming holiday.",
        "💡 New P2P route: SM Fairview → Ayala now available daily.",
        "🚌 Jeepney route 'Taft – Baclaran' temporarily rerouted via Roxas Blvd.",
        "🔔 MRT-3 resumes full operations starting this weekend.",
    ];
    const el = document.getElementById('advisory-text');
    if (el) {
        el.innerText = list[Math.floor(Math.random() * list.length)];
        document.getElementById('advisories').style.display = 'flex';
    }
}

function closeAdvisory() { document.getElementById('advisories').style.display = 'none'; }

// ── Offline ──
function toggleOfflineMode(enabled) {
    if (enabled && currentRoutes.length > 0) {
        localStorage.setItem('offlineRoutes', JSON.stringify({
            routes: currentRoutes,
            origin: document.getElementById('origin').value,
            destination: document.getElementById('destination').value,
            savedAt: new Date().toISOString()
        }));
        alert('✅ Routes saved for offline use!');
    } else if (enabled) {
        alert('⚠️ Search for a route first before saving offline.');
        document.getElementById('offlineMode').checked = false;
    } else {
        localStorage.removeItem('offlineRoutes');
    }
}

// ── Meetup ──
function showMeetupModal() { document.getElementById('meetup-modal').style.display = 'flex'; }
function closeMeetupModal() { document.getElementById('meetup-modal').style.display = 'none'; }

async function findMeetupPoint() {
    const l1 = document.getElementById('meet-location1').value;
    const l2 = document.getElementById('meet-location2').value;
    if (!l1 || !l2) { alert('Please enter both locations'); return; }
    const result = document.getElementById('meetup-result');
    result.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finding midpoint…';
    try {
        const [c1, c2] = await Promise.all([geocodeLocation(l1), geocodeLocation(l2)]);
        const midLat = (c1.lat + c2.lat) / 2, midLon = (c1.lon + c2.lon) / 2;
        const addr = await reverseGeocode(midLat, midLon);
        const d1 = calculateDistance(c1.lat, c1.lon, midLat, midLon).toFixed(1);
        const d2 = calculateDistance(c2.lat, c2.lon, midLat, midLon).toFixed(1);
        result.innerHTML = `
            <strong>📍 Meeting Point:</strong><br>
            ${addr.substring(0,80)}<br><br>
            From you: ${d1} km<br>
            From friend: ${d2} km<br>
            <button class="btn-primary" style="margin-top:0.75rem;" onclick="useMeetupPoint('${addr.replace(/'/g,"\\'").substring(0,80)}')">
                Use as destination
            </button>`;
    } catch (e) {
        result.innerHTML = `<span style="color:var(--red)">Error: ${e.message}</span>`;
    }
}

function useMeetupPoint(address) {
    document.getElementById('destination').value = address;
    closeMeetupModal();
    planRoute();
}

// ── Share Route ──
function shareCurrentRoute() {
    if (!currentRoutes.length) { alert('Search for a route first'); return; }
    const origin = document.getElementById('origin').value;
    const dest   = document.getElementById('destination').value;
    const params = new URLSearchParams({ o: origin, d: dest, m: currentRoutes[0]?.mode || 'transit' });
    const url = `${location.origin}${location.pathname}?${params.toString()}`;
    document.getElementById('share-url').value = url;
    document.getElementById('share-modal').style.display = 'flex';
    document.getElementById('copy-confirm').style.display = 'none';
}

function closeShareModal() { document.getElementById('share-modal').style.display = 'none'; }

function copyShareLink() {
    const url = document.getElementById('share-url').value;
    navigator.clipboard.writeText(url).then(() => {
        document.getElementById('copy-confirm').style.display = 'block';
        setTimeout(() => { document.getElementById('copy-confirm').style.display = 'none'; }, 2500);
    }).catch(() => {
        const input = document.getElementById('share-url');
        input.select();
        document.execCommand('copy');
        alert('Link copied!');
    });
}

function shareViaMessenger() {
    const url = encodeURIComponent(document.getElementById('share-url').value);
    window.open(`https://www.facebook.com/dialog/send?link=${url}&app_id=966242223397198`, '_blank');
}

function shareViaViber() {
    const url = encodeURIComponent(document.getElementById('share-url').value);
    window.open(`viber://forward?text=${url}`, '_blank');
}

function checkSharedRoute() {
    const params = new URLSearchParams(location.search);
    const o = params.get('o'), d = params.get('d'), m = params.get('m');
    if (o && d) {
        document.getElementById('origin').value = o;
        document.getElementById('destination').value = d;
        if (m) {
            currentMode = m;
            document.querySelectorAll('.mode-tab').forEach(t => {
                t.classList.toggle('active', t.dataset.mode === m);
            });
        }
        setTimeout(planRoute, 600);
    }
}

// ── Feedback ──
function reportRouteIssue(index) {
    const issue = prompt('Describe the issue with this route:');
    if (issue) {
        const fb = JSON.parse(localStorage.getItem('routeFeedback') || '[]');
        fb.push({ route: currentRoutes[index], issue, reportedAt: new Date().toISOString() });
        localStorage.setItem('routeFeedback', JSON.stringify(fb));
        alert('✅ Thank you for your feedback!');
    }
}

// ── Detailed Route Modal ──
function showRouteDetailModal(route, origin, destination) {
    const modal   = document.getElementById('route-detail-modal');
    const content = document.getElementById('route-detail-content');
    const journey = generateDetailedJourney(route, origin, destination);

    content.innerHTML = `
        <div class="route-journey-detail">
            <div class="journey-summary">
                <div><span class="summary-label">Total Fare</span><span class="summary-value fare">${journey.totalFare}</span></div>
                <div><span class="summary-label">Travel Time</span><span class="summary-value">${journey.totalTime} min</span></div>
                <div><span class="summary-label">Distance</span><span class="summary-value">${route.distance} km</span></div>
            </div>
            ${journey.legs.map(leg => `
                <div class="journey-leg ${leg.type}-leg">
                    <div class="leg-header">
                        <div class="leg-icon ${leg.type}"><i class="fas ${leg.icon}"></i></div>
                        <div class="leg-info">
                            <div class="leg-mode">${leg.modeName}</div>
                            ${leg.routeNumber ? `<div class="leg-route">${leg.routeNumber}</div>` : ''}
                        </div>
                        ${leg.fare > 0 ? `<div class="leg-fare">${leg.fare}</div>` : '<div style="font-size:0.75rem;color:var(--green);">Free</div>'}
                    </div>
                    <div class="leg-details">
                        ${leg.getOn  ? `<div class="leg-detail-item"><i class="fas fa-sign-in-alt"></i><strong>Board:</strong><span>${leg.getOn}</span></div>` : ''}
                        ${leg.route  ? `<div class="leg-detail-item"><i class="fas fa-route"></i><strong>Route:</strong><span>${leg.route}</span></div>` : ''}
                        ${leg.getOff ? `<div class="leg-detail-item"><i class="fas fa-sign-out-alt"></i><strong>Alight:</strong><span>${leg.getOff}</span></div>` : ''}
                        ${leg.duration ? `<div class="leg-detail-item"><i class="fas fa-clock"></i><strong>Time:</strong><span>~${leg.duration} min</span></div>` : ''}
                    </div>
                </div>`).join('')}
            <button class="close-detail-btn" onclick="closeRouteDetailModal()"><i class="fas fa-check-circle"></i> Got it</button>
        </div>`;

    modal.style.display = 'flex';
}

function closeRouteDetailModal() { document.getElementById('route-detail-modal').style.display = 'none'; }

// ── Detailed Journey Generator ──
function generateDetailedJourney(route, origin, destination) {
    const dist = parseFloat(route.distance);
    const legs = [];
    let totalFare = 0;

    if (route.mode === 'transit') {
        // Use real OTP legs if available
        if (route.routeData.routes[0].legs) {
            // Convert OTP legs to the same structure used elsewhere
            const otpLegs = route.routeData.routes[0].legs;
            for (const leg of otpLegs) {
                let type, icon, modeName, fare = 0, routeNumber = '';
                if (leg.mode === 'WALK') {
                    type = 'walk'; icon = 'fa-person-walking'; modeName = 'Walk';
                    legs.push({ type, icon, modeName, fare, getOn: leg.from.name, route: `Walk ${leg.distance} m`, getOff: leg.to.name, duration: Math.round(leg.duration / 60) });
                } else if (leg.mode === 'BUS') {
                    type = 'bus'; icon = 'fa-bus'; modeName = 'Bus'; routeNumber = leg.route || leg.routeShortName || '';
                    fare = leg.fare ? leg.fare.value : 0; // approximate if available
                    legs.push({ type, icon, modeName, fare, routeNumber, getOn: leg.from.name, route: leg.route || 'Bus route', getOff: leg.to.name, duration: Math.round(leg.duration / 60) });
                } else if (leg.mode === 'RAIL') {
                    type = 'lrt'; icon = 'fa-train'; modeName = 'Train'; routeNumber = leg.route || '';
                    fare = leg.fare ? leg.fare.value : 0;
                    legs.push({ type, icon, modeName, fare, routeNumber, getOn: leg.from.name, route: leg.route || 'Train line', getOff: leg.to.name, duration: Math.round(leg.duration / 60) });
                } else {
                    // fallback generic
                    type = 'other'; icon = 'fa-route'; modeName = leg.mode;
                    legs.push({ type, icon, modeName, fare: 0, getOn: leg.from.name, route: leg.mode, getOff: leg.to.name, duration: Math.round(leg.duration / 60) });
                }
                totalFare += fare;
            }
        } else {
            // Fallback to mock plan
            if (dist < 3) {
                const fare = calculateFare(dist, 'transit');
                totalFare += fare;
                legs.push({ type:'jeep', icon:'fa-truck-pickup', modeName:'Jeepney', routeNumber:getJeepneyRoute(origin, destination), fare,
                    getOn: getNearestJeepneyStop(origin), route:`${getJeepneyRoute(origin, destination)} route`, getOff: getNearestJeepneyStop(destination), duration: Math.round(route.duration*0.8) });
            } else if (dist < 8) {
                const jf = 13, bf = Math.round(15 + dist*1.5);
                totalFare += jf + bf;
                legs.push({ type:'jeep', icon:'fa-truck-pickup', modeName:'Jeepney (feeder)', routeNumber:getJeepneyRoute(origin,'terminal'), fare:jf,
                    getOn: getNearestJeepneyStop(origin), route:'To main bus stop', getOff:'Main road bus stop', duration: Math.round(route.duration*0.25) });
                legs.push({ type:'walk', icon:'fa-person-walking', modeName:'Walk to bus stop', fare:0, getOn:null, route:'', getOff:null, duration:5 });
                legs.push({ type:'bus', icon:'fa-bus', modeName:'P2P Bus / EDSA Bus', routeNumber:'', fare:bf,
                    getOn:'EDSA Bus Stop', route:'EDSA Busway towards destination', getOff: getNearestJeepneyStop(destination), duration: Math.round(route.duration*0.55) });
            } else {
                const jf1 = 13, lrtF = dist < 15 ? 30 : 42, jf2 = 13;
                totalFare += jf1 + lrtF + jf2;
                legs.push({ type:'jeep', icon:'fa-truck-pickup', modeName:'Jeepney (to station)', routeNumber:getJeepneyRoute(origin,'station'), fare:jf1,
                    getOn: getNearestJeepneyStop(origin), route:'To LRT/MRT station', getOff: getNearestLRTStation(origin), duration: Math.round(route.duration*0.2) });
                legs.push({ type:'walk', icon:'fa-person-walking', modeName:'Walk to platform', fare:0, getOn:null, route:'Enter station, tap beep card', getOff:null, duration:5 });
                legs.push({ type:'lrt', icon:'fa-train', modeName: getLRTLine(origin, destination), routeNumber:getLRTLine(origin, destination), fare:lrtF,
                    getOn: getNearestLRTStation(origin), route:`${getLRTLine(origin, destination)} Line towards ${destination.split(',')[0]}`, getOff: getNearestLRTStation(destination), duration: Math.round(route.duration*0.4) });
                legs.push({ type:'walk', icon:'fa-person-walking', modeName:'Exit station', fare:0, getOn:null, route:'Walk to jeepney terminal', getOff:null, duration:4 });
                legs.push({ type:'jeep', icon:'fa-truck-pickup', modeName:'Jeepney (last mile)', routeNumber:getJeepneyRoute('terminal', destination), fare:jf2,
                    getOn: getNearestJeepneyStop('terminal'), route:`Towards ${destination.split(',')[0]}`, getOff: getNearestJeepneyStop(destination), duration: Math.round(route.duration*0.25) });
            }
            legs.push({ type:'walk', icon:'fa-person-walking', modeName:'Walk to destination', fare:0, getOn:null, route:'', getOff: destination.substring(0,50), duration: Math.max(2, Math.round(dist*1.5)) });
        }
    } else if (route.mode === 'drive') {
        const fare = calculateFare(dist, 'drive');
        totalFare = fare;
        legs.push({ type:'drive', icon:'fa-car', modeName:'Private Vehicle / Grab / Taxi', fare, getOn: origin.substring(0,50), route:'Via main roads (EDSA / C5 / Skyway)', getOff: destination.substring(0,50), duration: route.adjustedDuration });
    } else if (route.mode === 'walk') {
        legs.push({ type:'walk', icon:'fa-person-walking', modeName:'Walking', fare:0, getOn: origin.substring(0,50), route:'Pedestrian path', getOff: destination.substring(0,50), duration: route.duration });
    } else if (route.mode === 'bike') {
        legs.push({ type:'bike', icon:'fa-bicycle', modeName:'Cycling', fare:0, getOn: origin.substring(0,50), route:'Bike-friendly roads', getOff: destination.substring(0,50), duration: route.duration });
    }

    return { legs, totalFare, totalTime: route.adjustedDuration };
}

// ── Philippine Geographic Data ──
// Maps keywords in location names to regions/areas for transit logic

const PH_AREA_MAP = [
    // Metro Manila - NCR
    { keys: ['manila','ermita','malate','paco','pandacan','santa ana','port area','intramuros','binondo','quiapo','sampaloc','sta. mesa','tondo','sta. cruz'], area: 'manila', region: 'ncr' },
    { keys: ['makati','salcedo','legaspi','bel-air','rockwell','poblacion makati','san antonio makati'], area: 'makati', region: 'ncr' },
    { keys: ['bgc','bonifacio','fort bonifacio','global city','taguig','western bicutan','south signal'], area: 'taguig', region: 'ncr' },
    { keys: ['quezon city','quezon','cubao','diliman','commonwealth','fairview','novaliches','tandang sora','batasan','project','east ave','mindanao ave','visayas ave','congressional'], area: 'quezon', region: 'ncr' },
    { keys: ['pasig','ortigas','kapitolyo','ugong','manggahan','rosario pasig','cainta'], area: 'pasig', region: 'ncr' },
    { keys: ['mandaluyong','shaw','wack wack','pleasant hills','mauway'], area: 'mandaluyong', region: 'ncr' },
    { keys: ['san juan','little baguio','addition hills','greenhills'], area: 'san juan', region: 'ncr' },
    { keys: ['pasay','baclaran','libertad','mia road','mall of asia','sm mall of asia'], area: 'pasay', region: 'ncr' },
    { keys: ['paranaque','sucat','bf homes','san dionisio','don galo','ninoy aquino','naia','airport'], area: 'paranaque', region: 'ncr' },
    { keys: ['las pinas','almanza','pamplona','pulang lupa','zapote'], area: 'las pinas', region: 'ncr' },
    { keys: ['muntinlupa','alabang','filinvest','ayala alabang','bf alabang','cupang'], area: 'muntinlupa', region: 'ncr' },
    { keys: ['caloocan','monumento','grace park','sangandaan','camarin','bagumbong'], area: 'caloocan', region: 'ncr' },
    { keys: ['malabon','tinajeros','longos','catmon malabon'], area: 'malabon', region: 'ncr' },
    { keys: ['navotas','daanghari','bangculasi'], area: 'navotas', region: 'ncr' },
    { keys: ['valenzuela','malinta','ugong valenzuela','punturin','parada'], area: 'valenzuela', region: 'ncr' },
    { keys: ['marikina','concepcion','nangka','parang marikina','sta. elena'], area: 'marikina', region: 'ncr' },
    { keys: ['pateros'], area: 'pateros', region: 'ncr' },
    // Nearby provinces
    { keys: ['antipolo','sumulong','tikling','san roque antipolo'], area: 'antipolo', region: 'rizal' },
    { keys: ['san mateo','guitnang bayan'], area: 'san mateo', region: 'rizal' },
    { keys: ['angono','taytay','binangonan'], area: 'east rizal', region: 'rizal' },
    { keys: ['bacoor','molino','habay','zapote bacoor'], area: 'bacoor', region: 'cavite' },
    { keys: ['imus','anabu','buhay na tubig'], area: 'imus', region: 'cavite' },
    { keys: ['dasmariñas','dasmarinas','salawag','salitran'], area: 'dasmarinas', region: 'cavite' },
    { keys: ['cavite city','san roque cavite'], area: 'cavite city', region: 'cavite' },
    { keys: ['tagaytay','magallanes cavite'], area: 'tagaytay', region: 'cavite' },
    { keys: ['san pedro','laguna','laguna lake','calamba','sta. rosa','binan','cabuyao'], area: 'laguna', region: 'laguna' },
    { keys: ['meycauayan','marilao','bocaue','balagtas','guiguinto','malolos','bulacan'], area: 'bulacan', region: 'bulacan' },
    // Visayas
    { keys: ['cebu','mandaue','lapu-lapu','mactan','talisay cebu','danao'], area: 'cebu', region: 'visayas' },
    { keys: ['iloilo','jaro','molo','mandurriao'], area: 'iloilo', region: 'visayas' },
    { keys: ['bacolod','talisay bacolod'], area: 'bacolod', region: 'visayas' },
    { keys: ['tacloban','palo leyte'], area: 'tacloban', region: 'visayas' },
    { keys: ['dumaguete'], area: 'dumaguete', region: 'visayas' },
    // Mindanao
    { keys: ['davao','toril','buhangin','agdao'], area: 'davao', region: 'mindanao' },
    { keys: ['cagayan de oro','cdo','carmen cagayan'], area: 'cdo', region: 'mindanao' },
    { keys: ['zamboanga'], area: 'zamboanga', region: 'mindanao' },
    { keys: ['general santos','gensan'], area: 'gensan', region: 'mindanao' },
    { keys: ['iligan'], area: 'iligan', region: 'mindanao' },
    // North Luzon
    { keys: ['baguio','burnham','session road','camp john hay'], area: 'baguio', region: 'north luzon' },
    { keys: ['san fernando pampanga','angeles','clark'], area: 'pampanga', region: 'north luzon' },
    { keys: ['dagupan','san carlos pangasinan'], area: 'pangasinan', region: 'north luzon' },
    { keys: ['laoag','vigan'], area: 'ilocos', region: 'north luzon' },
];

function detectArea(locationStr) {
    const loc = (locationStr || '').toLowerCase();
    for (const entry of PH_AREA_MAP) {
        if (entry.keys.some(k => loc.includes(k))) return entry;
    }
    return null;
}

// ── Rail Knowledge (Real LRT/MRT routes) ──
const RAIL_LINES = {
    'LRT-1': {
        stations: [
            'Baclaran', 'EDSA', 'Vito Cruz', 'Gil Puyat', 'Quirino', 'Pedro Gil',
            'U.N. Ave', 'Central', 'Carriedo', 'Doroteo Jose', 'Bambang', 'Tayuman',
            'Blumentritt', 'Abad Santos', 'R. Papa', '5th Ave', 'Monumento', 'Balintawak',
            'Roosevelt'
        ]
    },
    'LRT-2': {
        stations: [
            'Recto', 'Legarda', 'Pureza', 'V. Mapa', 'J. Ruiz', 'Gilmore',
            'Betty Go-Belmonte', 'Cubao', 'Anonas', 'Katipunan', 'Santolan', 'Marikina', 'Antipolo'
        ]
    },
    'MRT-3': {
        stations: [
            'North Ave', 'Quezon Ave', 'GMA-Kamuning', 'Cubao', 'Santolan-Annapolis', 'Ortigas',
            'Shaw Blvd', 'Boni', 'Guadalupe', 'Buendia', 'Ayala', 'Magallanes', 'Taft Ave'
        ]
    }
};

function findRailRoute(origin, destination) {
    const loc = (origin + ' ' + destination).toLowerCase();
    for (const [line, data] of Object.entries(RAIL_LINES)) {
        const stations = data.stations;
        // Find a station in the origin and one in the destination
        let originStation = null, destStation = null;
        for (const station of stations) {
            const stationLower = station.toLowerCase();
            if (origin.toLowerCase().includes(stationLower) || stationLower.includes(origin.toLowerCase())) {
                originStation = station;
            }
            if (destination.toLowerCase().includes(stationLower) || stationLower.includes(destination.toLowerCase())) {
                destStation = station;
            }
        }
        if (originStation && destStation) {
            return { line, from: originStation, to: destStation };
        }
    }
    return null;
}

// ── Transit mode decision logic ──
function getTransitPlan(origin, destination, distKm) {
    // 1. Try direct rail
    const rail = findRailRoute(origin, destination);
    if (rail) {
        const { line, from, to } = rail;
        const stations = RAIL_LINES[line].stations;
        const fromIdx = stations.indexOf(from);
        const toIdx = stations.indexOf(to);
        const stopsDiff = Math.abs(toIdx - fromIdx);
        const duration = stopsDiff * 2 + 5; // ~2 min per station + 5 min walk
        const fare = line === 'LRT-1' ? 25 : (line === 'MRT-3' ? 28 : 20);
        return {
            type: 'rail',
            legs: [
                { type:'walk', icon:'fa-person-walking', modeName:'Walk to station', fare:0,
                  getOn: origin, route:'', getOff: `${from} Station`, duration: 5 },
                { type:'lrt', icon:'fa-train', modeName: line, fare, routeNumber: line,
                  getOn: `${from} Station`, route: `Ride ${line} ${fromIdx < RAIL_LINES[line].stations.indexOf('Doroteo Jose') ? 'northbound' : 'southbound'} towards ${to}`, getOff: `${to} Station`, duration },
                { type:'walk', icon:'fa-person-walking', modeName:'Walk to destination', fare:0,
                  getOn: `${to} Station`, route:'', getOff: destination, duration: 5 }
            ],
            totalFare: fare
        };
    }

    // 2. If no direct rail, use the existing NCR/regional planners
    const oArea = detectArea(origin);
    const dArea = detectArea(destination);
    const oRegion = oArea?.region || 'unknown';
    const dRegion = dArea?.region || 'unknown';
    const oName   = oArea?.area   || origin.split(',')[0];
    const dName   = dArea?.area   || destination.split(',')[0];

    // Inter-regional
    if (oRegion !== dRegion && oRegion !== 'unknown' && dRegion !== 'unknown') {
        if ((oRegion === 'ncr' || oRegion === 'north luzon') && (dRegion === 'visayas' || dRegion === 'mindanao')) {
            return {
                type: 'interregional',
                legs: [
                    { type:'drive', icon:'fa-car', modeName:'Drive / Grab to Airport', fare: 250, getOn: origin.substring(0,40), route:'NAIA Terminal 1, 2, or 3', getOff:'Ninoy Aquino Intl Airport', duration: 45 },
                    { type:'bus', icon:'fa-plane', modeName:'Domestic Flight', fare: 2500, getOn:'NAIA', route:`${oName} → ${dName} (check airline for exact schedule)`, getOff:'Destination Airport', duration: 90 },
                    { type:'drive', icon:'fa-car', modeName:'Taxi / Grab from Airport', fare: 200, getOn:'Arrival Airport', route:'To final destination', getOff: destination.substring(0,40), duration: 30 },
                ],
                totalFare: 2950
            };
        }
        if (oRegion !== dRegion) {
            return buildProvincialBusPlan(origin, destination, oName, dName, distKm);
        }
    }

    // NCR
    if (oRegion === 'ncr' && dRegion === 'ncr') {
        return buildNCRTransitPlan(origin, destination, oArea, dArea, distKm);
    }

    // NCR ↔ nearby provinces
    if ((oRegion === 'ncr' && ['rizal','cavite','laguna','bulacan'].includes(dRegion)) ||
        (dRegion === 'ncr' && ['rizal','cavite','laguna','bulacan'].includes(oRegion))) {
        return buildProvincialBusPlan(origin, destination, oName, dName, distKm);
    }

    // Visayas / Mindanao local
    if (oRegion === dRegion && oRegion !== 'ncr') {
        return buildProvincialLocalPlan(origin, destination, oName, dName, oRegion, distKm);
    }

    // Fallback generic
    return buildGenericPlan(origin, destination, distKm);
}

// ============================================================
// ========== NCR TRANSIT PLAN (with full logic) =============
// ============================================================

function buildNCRTransitPlan(origin, destination, oArea, dArea, distKm) {
    const oName = oArea?.area || origin.split(',')[0];
    const dName = dArea?.area || destination.split(',')[0];

    // Get the nearest rail station for BOTH endpoints independently
    const oStation = getNearestLRTStation(origin);
    const dStation = getNearestLRTStation(destination);

    // Determine which LINE each station belongs to
    function stationLine(station) {
        if (!station) return null;
        if (station.includes('LRT-1')) return 'LRT-1';
        if (station.includes('LRT-2')) return 'LRT-2';
        if (station.includes('MRT-3')) return 'MRT-3';
        return null;
    }

    const oLine = stationLine(oStation);
    const dLine = stationLine(dStation);

    // Rail is viable if both endpoints have a nearby station
    const hasRail = oLine !== null && dLine !== null;
    const needsTransfer = hasRail && oLine !== dLine;

    // Transfer point map between lines (physical interchange stations)
    const TRANSFER_MAP = {
        'LRT-1|LRT-2': { fromStation: 'Doroteo Jose (LRT-1)', toStation: 'Recto (LRT-2)',   walkMin: 8  },
        'LRT-2|LRT-1': { fromStation: 'Recto (LRT-2)',         toStation: 'Doroteo Jose (LRT-1)', walkMin: 8 },
        'LRT-1|MRT-3': { fromStation: 'EDSA (LRT-1)',          toStation: 'Taft Ave (MRT-3)', walkMin: 5  },
        'MRT-3|LRT-1': { fromStation: 'Taft Ave (MRT-3)',      toStation: 'EDSA (LRT-1)',    walkMin: 5  },
        'LRT-2|MRT-3': { fromStation: 'Cubao (LRT-2)',         toStation: 'Cubao (MRT-3)',   walkMin: 5  },
        'MRT-3|LRT-2': { fromStation: 'Cubao (MRT-3)',         toStation: 'Cubao (LRT-2)',   walkMin: 5  },
    };
    const xferKey = `${oLine}|${dLine}`;
    const xfer = TRANSFER_MAP[xferKey];

    // ── SHORT: < 3km → Jeepney only ──
    if (distKm < 3) {
        const jRoute = getJeepneyRoute(oName, dName);
        return {
            type: 'jeep-only',
            legs: [
                { type:'jeep', icon:'fa-truck-pickup', modeName:'Jeepney', fare:13, routeNumber: jRoute,
                  getOn: getNearestJeepneyStop(origin), route: jRoute, getOff: getNearestJeepneyStop(destination), duration: Math.round(distKm * 5) }
            ],
            totalFare: 13
        };
    }

    // ── MEDIUM: 3–7km, no rail needed → Jeepney/Bus ──
    if (distKm < 7 && !hasRail) {
        const edsa = ['makati','mandaluyong','quezon','pasay','caloocan','san juan'];
        const bothEdsa = edsa.includes(oArea?.area) && edsa.includes(dArea?.area);
        const busFare = Math.round(15 + distKm * 1.5);
        if (bothEdsa) {
            return {
                type: 'jeep-bus',
                legs: [
                    { type:'jeep', icon:'fa-truck-pickup', modeName:'Jeepney (to EDSA)', fare:13,
                      getOn: getNearestJeepneyStop(origin), route:`Ride jeepney to nearest EDSA bus stop`, getOff:'EDSA Bus Stop', duration: 10 },
                    { type:'bus', icon:'fa-bus', modeName:'EDSA Carousel / P2P Bus', fare: busFare,
                      getOn:'EDSA Bus Stop', route:`EDSA Carousel — ride towards ${dName}`, getOff: getNearestBusStop(destination), duration: Math.round(distKm * 3.5) },
                    { type:'walk', icon:'fa-person-walking', modeName:'Walk to destination', fare:0,
                      getOn:null, route:'Short walk to final destination', getOff: destination.substring(0,40), duration: 7 }
                ],
                totalFare: 13 + busFare
            };
        }
        const jRoute1 = getJeepneyRoute(oName, 'main road');
        const jRoute2 = getJeepneyRoute('main road', dName);
        return {
            type: 'jeep-jeep',
            legs: [
                { type:'jeep', icon:'fa-truck-pickup', modeName:'Jeepney', fare:13, routeNumber: jRoute1,
                  getOn: getNearestJeepneyStop(origin), route: jRoute1, getOff:'Main road transfer point', duration: Math.round(distKm * 2.5) },
                { type:'walk', icon:'fa-person-walking', modeName:'Short transfer walk', fare:0, getOn:null, route:'Walk to connecting jeepney stop (~3 min)', getOff:null, duration:3 },
                { type:'jeep', icon:'fa-truck-pickup', modeName:'Jeepney', fare:13, routeNumber: jRoute2,
                  getOn:'Transfer point', route: jRoute2, getOff: getNearestJeepneyStop(destination), duration: Math.round(distKm * 2.5) },
                { type:'walk', icon:'fa-person-walking', modeName:'Walk to destination', fare:0, getOn:null, route:'Short walk', getOff: destination.substring(0,40), duration:5 }
            ],
            totalFare: 26
        };
    }

    // ── RAIL: both endpoints have a station ──
    if (hasRail && distKm < 35) {
        // Fare per line segment (based on number of stations, approximate)
        const fare1 = oLine === 'LRT-1' ? (distKm < 10 ? 20 : 30) : (distKm < 10 ? 20 : 30);
        const fare2 = needsTransfer ? 20 : 0;
        const railTime1 = Math.round(distKm * (needsTransfer ? 0.7 : 1.4)); // min
        const railTime2 = needsTransfer ? Math.round(distKm * 0.7) : 0;

        const legs = [];

        // 1. Jeepney to origin station
        legs.push({
            type:'jeep', icon:'fa-truck-pickup', modeName:'Jeepney (to station)', fare:13,
            getOn: getNearestJeepneyStop(origin),
            route: `Board jeepney → ride towards ${oStation}`,
            getOff: oStation, duration: 10
        });

        // 2. Walk into station
        legs.push({
            type:'walk', icon:'fa-person-walking', modeName:'Enter station', fare:0,
            getOn:null, route:`Enter ${oStation} — load/tap beep card at gate`, getOff:null, duration:5
        });

        // 3. First rail leg
        const firstRailDest = needsTransfer ? xfer.fromStation : dStation;
        legs.push({
            type:'lrt', icon:'fa-train', modeName: oLine, fare: fare1, routeNumber: oLine,
            getOn: oStation,
            route: `Ride ${oLine} → ${needsTransfer ? 'alight at ' + xfer.fromStation + ' (transfer station)' : 'alight at ' + dStation}`,
            getOff: firstRailDest, duration: railTime1
        });

        // 4. Transfer between lines (if needed)
        if (needsTransfer && xfer) {
            legs.push({
                type:'walk', icon:'fa-person-walking', modeName:`Transfer: ${oLine} → ${dLine}`, fare:0,
                getOn:null,
                route:`Exit ${xfer.fromStation} → walk to ${xfer.toStation} platform (~${xfer.walkMin} min)`,
                getOff:null, duration: xfer.walkMin
            });

            // 5. Second rail leg
            legs.push({
                type:'lrt', icon:'fa-train', modeName: dLine, fare: fare2, routeNumber: dLine,
                getOn: xfer.toStation,
                route: `Ride ${dLine} → alight at ${dStation}`,
                getOff: dStation, duration: railTime2
            });
        }

        // 6. Exit station
        legs.push({
            type:'walk', icon:'fa-person-walking', modeName:'Exit station', fare:0,
            getOn:null, route:`Exit ${dStation} → walk to jeepney/tricycle stop`, getOff:null, duration:5
        });

        // 7. Last mile jeepney/tricycle
        legs.push({
            type:'jeep', icon:'fa-truck-pickup', modeName:'Jeepney / Tricycle (last mile)', fare:13,
            getOn: dStation,
            route: `Board jeepney/tricycle → ride towards ${dName}`,
            getOff: getNearestJeepneyStop(destination), duration: 10
        });

        // 8. Final walk
        legs.push({
            type:'walk', icon:'fa-person-walking', modeName:'Walk to destination', fare:0,
            getOn:null, route:'Short walk to final destination', getOff: destination.substring(0,40), duration:5
        });

        return { type: 'rail', legs, totalFare: 26 + fare1 + fare2 };
    }

    // ── LONG / NO RAIL: P2P Bus ──
    const busFare = Math.round(20 + distKm * 2);
    return {
        type: 'bus',
        legs: [
            { type:'jeep', icon:'fa-truck-pickup', modeName:'Jeepney (to bus stop)', fare:13,
              getOn: getNearestJeepneyStop(origin), route:`Ride jeepney to nearest bus stop`, getOff: getNearestBusStop(origin), duration: 12 },
            { type:'bus', icon:'fa-bus', modeName:'P2P Bus / EDSA Carousel', fare: busFare,
              getOn: getNearestBusStop(origin), route:`Board bus → direct service towards ${dName}`, getOff: getNearestBusStop(destination), duration: Math.round(distKm * 2.5) },
            { type:'jeep', icon:'fa-truck-pickup', modeName:'Jeepney (last mile)', fare:13,
              getOn: getNearestBusStop(destination), route: getJeepneyRoute('bus stop', dName), getOff: getNearestJeepneyStop(destination), duration: 10 },
            { type:'walk', icon:'fa-person-walking', modeName:'Walk to destination', fare:0, getOn:null, route:'Short walk to final destination', getOff: destination.substring(0,40), duration:5 }
        ],
        totalFare: 26 + busFare
    };
}

function buildProvincialBusPlan(origin, destination, oName, dName, distKm) {
    const terminal = getProvincialTerminal(origin);
    const busFare  = Math.round(Math.min(50 + distKm * 2.5, 800)); // provincial bus fare
    const busTime  = Math.round(distKm / 55 * 60); // ~55 km/h highway
    return {
        type: 'provincial-bus',
        legs: [
            { type:'jeep', icon:'fa-truck-pickup', modeName:'Jeepney / UV Express to terminal', fare:15,
              getOn: getNearestJeepneyStop(origin), route:`To ${terminal}`, getOff: terminal, duration: 20 },
            { type:'bus', icon:'fa-bus', modeName:'Provincial / Ordinary Bus', fare: busFare, routeNumber:`${oName} → ${dName}`,
              getOn: terminal, route:`Direct bus to ${dName} (check schedules at terminal)`, getOff:`${dName} Bus Terminal`, duration: busTime },
            { type:'jeep', icon:'fa-truck-pickup', modeName:'Jeepney / Tricycle (last mile)', fare:15,
              getOn:`${dName} Terminal`, route:'To final destination', getOff: destination.substring(0,40), duration: 15 }
        ],
        totalFare: 30 + busFare
    };
}

function buildProvincialLocalPlan(origin, destination, oName, dName, region, distKm) {
    // Local transit for Cebu, Davao, etc.
    const mode = region === 'visayas' || region === 'mindanao' ? 'Jeepney / Habal-habal' : 'Jeepney';
    const icon = 'fa-truck-pickup';
    const fare = Math.round(13 + distKm * 1.5);
    return {
        type: 'local',
        legs: [
            { type:'jeep', icon, modeName: mode, fare,
              getOn: origin.substring(0,40), route:`${oName} → ${dName}`, getOff: destination.substring(0,40), duration: Math.round(distKm * 3) }
        ],
        totalFare: fare
    };
}

function buildGenericPlan(origin, destination, distKm) {
    const fare = Math.round(13 + distKm * 2);
    return {
        type: 'generic',
        legs: [
            { type:'jeep', icon:'fa-truck-pickup', modeName:'Jeepney', fare: 13,
              getOn: origin.substring(0,40), route:'To main road', getOff:'Transfer point', duration: Math.round(distKm * 2) },
            { type:'bus', icon:'fa-bus', modeName:'Bus', fare: Math.round(fare - 13),
              getOn:'Transfer point', route:'Towards destination', getOff: destination.substring(0,40), duration: Math.round(distKm * 2.5) }
        ],
        totalFare: fare
    };
}

// ============================================================
// ========== LOOKUP HELPERS (real data) =====================
// ============================================================

function getJeepneyRoute(from, to) {
    const from_l = (from || '').toLowerCase();
    const to_l   = (to   || '').toLowerCase();
    const routes = [
        { from:['quiapo','manila','recto'],     to:['cubao','quezon'],     label:'Quiapo – Cubao' },
        { from:['divisoria','tondo','binondo'], to:['espana','sampaloc'],  label:'Divisoria – España' },
        { from:['baclaran','pasay'],            to:['monumento','caloocan'],label:'Baclaran – Monumento' },
        { from:['cubao'],                        to:['fairview','novaliches'],label:'Cubao – Fairview' },
        { from:['taft','pasay'],                to:['buendia','makati'],   label:'Taft – Buendia' },
        { from:['monumento','caloocan'],        to:['manila','recto'],     label:'Monumento – Divisoria' },
        { from:['malate','ermita'],             to:['pasay','moa'],        label:'Malate – Pasay' },
        { from:['quezon','commonwealth'],       to:['espana','manila'],    label:'Quezon Ave – España' },
        { from:['recto','quiapo'],              to:['divisoria','tondo'],  label:'Recto – Divisoria' },
        { from:['marikina'],                    to:['cubao','quezon'],     label:'Marikina – Cubao' },
        { from:['antipolo'],                    to:['cubao','ortigas'],    label:'Antipolo – Cubao' },
        { from:['las pinas'],                   to:['alabang','muntinlupa'],label:'Las Piñas – Alabang' },
        { from:['fairview','novaliches'],       to:['quezon','commonwealth'],label:'Fairview – Quezon Ave' },
        { from:['ortigas','pasig'],             to:['makati','ayala'],     label:'Ortigas – Ayala' },
        { from:['valenzuela','malabon'],        to:['caloocan','monumento'],label:'Valenzuela – Monumento' },
    ];
    for (const r of routes) {
        const fMatch = r.from.some(f => from_l.includes(f));
        const tMatch = r.to.some(t => to_l.includes(t));
        if (fMatch && tMatch) return r.label;
        // reverse
        const fMatchR = r.to.some(f => from_l.includes(f));
        const tMatchR = r.from.some(t => to_l.includes(t));
        if (fMatchR && tMatchR) return r.label + ' (reverse)';
    }
    return `${(from||'').split(' ')[0]} – ${(to||'').split(' ')[0]} route`;
}

function getNearestJeepneyStop(location) {
    const loc = (location || '').toLowerCase();
    const stops = [
        { keys:['makati','ayala','salcedo','legaspi'],    stop:'Ayala Terminal, Makati' },
        { keys:['bgc','taguig','bonifacio','fort'],       stop:'BGC Bus Stop (McKinley)' },
        { keys:['cubao','araneta'],                       stop:'Cubao Jeepney Terminal (ARANETA)' },
        { keys:['ortigas','shaw','mandaluyong'],          stop:'Crossing Terminal, Ortigas' },
        { keys:['quiapo','hidalgo'],                      stop:'Quiapo Terminal' },
        { keys:['manila','ermita','malate','taft'],       stop:'Taft Ave / Baclaran Terminal' },
        { keys:['baclaran','pasay'],                      stop:'Baclaran Terminal' },
        { keys:['monumento','caloocan','grace park'],     stop:'Monumento Terminal' },
        { keys:['fairview','novaliches'],                 stop:'Fairview Terminal' },
        { keys:['sm north','north ave','quezon ave'],     stop:'SM North EDSA Terminal' },
        { keys:['antipolo'],                              stop:'Antipolo Jeepney Terminal' },
        { keys:['marikina','sto. nino'],                 stop:'Marikina Market Terminal' },
        { keys:['alabang','muntinlupa'],                  stop:'Alabang Bus Terminal' },
        { keys:['las pinas','zapote'],                   stop:'Zapote Terminal, Las Piñas' },
        { keys:['paranaque','sucat'],                    stop:'Sucat Terminal, Parañaque' },
        { keys:['valenzuela','malinta'],                 stop:'Malinta Jeepney Stop, Valenzuela' },
        { keys:['malabon','navotas'],                    stop:'Malabon Jeepney Stop' },
        { keys:['divisoria','recto'],                    stop:'Divisoria Terminal' },
        { keys:['espana','sampaloc'],                    stop:'España / UST Stop' },
        { keys:['pasig','kapitolyo'],                    stop:'Pasig Market Terminal' },
        // Provincial
        { keys:['cebu','mandaue','lapu-lapu'],           stop:'South Bus Terminal, Cebu City' },
        { keys:['davao'],                                 stop:'Davao Overland Terminal' },
        { keys:['iloilo'],                                stop:'Iloilo Integrated Bus Terminal' },
        { keys:['baguio'],                                stop:'Baguio Bus Terminal (Dangwa)' },
        { keys:['angeles','pampanga','clark'],           stop:'Angeles/Clark Bus Terminal' },
        { keys:['dagupan','pangasinan'],                 stop:'Dagupan Bus Terminal' },
        { keys:['bacoor','cavite'],                      stop:'Bacoor Jeepney Terminal' },
        { keys:['dasmarinas','imus'],                    stop:'Dasmariñas / Imus Terminal' },
        { keys:['antipolo','cainta','taytay'],           stop:'Cogeo / Antipolo Terminal' },
        { keys:['laguna','calamba','sta. rosa'],         stop:'Calamba Bus Terminal' },
        { keys:['bulacan','malolos','meycauayan'],       stop:'Bulacan Bus Terminal (NLEX)' },
    ];
    for (const s of stops) {
        if (s.keys.some(k => loc.includes(k))) return s.stop;
    }
    return location.split(',')[0].trim() + ' Jeepney Stop';
}

function getNearestBusStop(location) {
    const loc = (location || '').toLowerCase();
    const stops = [
        { keys:['makati','ayala','buendia','edsa'],   stop:'Ayala EDSA Bus Stop' },
        { keys:['bgc','taguig','bonifacio'],           stop:'BGC Bus Stop (Lawton Ave)' },
        { keys:['ortigas','shaw','mandaluyong'],       stop:'Ortigas EDSA Bus Stop' },
        { keys:['cubao','araneta','quezon'],           stop:'Cubao EDSA Bus Stop' },
        { keys:['sm north','north ave','fairview'],   stop:'North Ave EDSA Bus Stop' },
        { keys:['monumento','caloocan'],               stop:'Monumento Bus Stop' },
        { keys:['baclaran','pasay','moa'],             stop:'Baclaran / Rotonda Bus Stop' },
        { keys:['alabang','muntinlupa'],               stop:'Alabang Bus Terminal' },
        { keys:['paranaque','sucat'],                  stop:'Sucat EDSA Bus Stop' },
        { keys:['manila','taft','ermita'],             stop:'Taft Ave / UN Ave Bus Stop' },
        { keys:['espana','sampaloc'],                  stop:'España Bus Stop' },
        { keys:['valenzuela'],                         stop:'Valenzuela Bus Stop (McArthur Hwy)' },
        { keys:['marikina','antipolo'],                stop:'Marikina/Antipolo Bus Stop' },
    ];
    for (const s of stops) {
        if (s.keys.some(k => loc.includes(k))) return s.stop;
    }
    return 'Nearest Bus Stop';
}

function getProvincialTerminal(location) {
    const loc = (location || '').toLowerCase();
    if (loc.includes('manila') || loc.includes('ermita') || loc.includes('malate')) return 'LRT Buendia / Lawton Terminal';
    if (loc.includes('cubao') || loc.includes('quezon')) return 'Cubao Bus Terminal (Araneta)';
    if (loc.includes('pasay') || loc.includes('baclaran')) return 'PITX / Pasay Bus Terminal';
    if (loc.includes('alabang') || loc.includes('muntinlupa')) return 'Alabang Bus Terminal';
    if (loc.includes('fairview') || loc.includes('novaliches')) return 'Fairview Bus Terminal';
    if (loc.includes('caloocan') || loc.includes('monumento')) return 'Monumento Terminal';
    if (loc.includes('cebu')) return 'South / North Bus Terminal, Cebu';
    if (loc.includes('davao')) return 'Davao Overland Terminal';
    return 'Nearest Bus Terminal';
}

function getNearestLRTStation(location) {
    const loc = (location || '').toLowerCase();
    // LRT-1 stations
    if (loc.includes('baclaran') || loc.includes('mia road')) return 'Baclaran (LRT-1)';
    if (loc.includes('edsa pasay') || loc.includes('libertad')) return 'EDSA (LRT-1)';
    if (loc.includes('buendia') || loc.includes('gil puyat')) return 'Gil Puyat (LRT-1)';
    if (loc.includes('vito cruz') || loc.includes('pablo ocampo')) return 'Vito Cruz (LRT-1)';
    if (loc.includes('quirino') || loc.includes('new market')) return 'Quirino (LRT-1)';
    if (loc.includes('pedro gil') || loc.includes('sta. mesa')) return 'Pedro Gil (LRT-1)';
    if (loc.includes('un ave') || loc.includes('united nations')) return 'U.N. Ave (LRT-1)';
    if (loc.includes('central') || loc.includes('carriedo')) return 'Carriedo (LRT-1)';
    if (loc.includes('doroteo') || loc.includes('recto') || loc.includes('quiapo')) return 'Doroteo Jose (LRT-1)';
    if (loc.includes('bambang') || loc.includes('tayuman')) return 'Bambang (LRT-1)';
    if (loc.includes('blumentritt')) return 'Blumentritt (LRT-1)';
    if (loc.includes('abad santos')) return 'Abad Santos (LRT-1)';
    if (loc.includes('r. papa') || loc.includes('tondo')) return 'R. Papa (LRT-1)';
    if (loc.includes('5th ave') || loc.includes('grace park')) return '5th Ave (LRT-1)';
    if (loc.includes('monumento') || loc.includes('caloocan')) return 'Monumento (LRT-1)';
    if (loc.includes('balintawak')) return 'Balintawak (LRT-1)';
    if (loc.includes('roosevelt')) return 'Roosevelt (LRT-1)';
    // MRT-3 stations
    if (loc.includes('north ave') || loc.includes('sm north')) return 'North Ave (MRT-3)';
    if (loc.includes('quezon ave') || loc.includes('quezon blvd')) return 'Quezon Ave (MRT-3)';
    if (loc.includes('gma') || loc.includes('kamuning')) return 'GMA-Kamuning (MRT-3)';
    if (loc.includes('cubao') || loc.includes('araneta')) return 'Cubao (MRT-3)';
    if (loc.includes('santolan mrt') || loc.includes('annapolis')) return 'Santolan-Annapolis (MRT-3)';
    if (loc.includes('ortigas') || loc.includes('wack wack')) return 'Ortigas (MRT-3)';
    if (loc.includes('shaw') || loc.includes('mandaluyong')) return 'Shaw Blvd (MRT-3)';
    if (loc.includes('boni') || loc.includes('highway hills')) return 'Boni (MRT-3)';
    if (loc.includes('guadalupe') || loc.includes('guadalupe makati')) return 'Guadalupe (MRT-3)';
    if (loc.includes('buendia mrt') || loc.includes('edsa makati')) return 'Buendia (MRT-3)';
    if (loc.includes('ayala') || loc.includes('makati ave')) return 'Ayala (MRT-3)';
    if (loc.includes('magallanes') || loc.includes('south cemetery')) return 'Magallanes (MRT-3)';
    if (loc.includes('taft mrt') || loc.includes('pasay mrt')) return 'Taft Ave (MRT-3)';
    // LRT-2 stations
    if (loc.includes('recto lrt2') || loc.includes('c. palanca')) return 'Recto (LRT-2)';
    if (loc.includes('legarda') || loc.includes('espana')) return 'Legarda (LRT-2)';
    if (loc.includes('pureza') || loc.includes('sampaloc')) return 'Pureza (LRT-2)';
    if (loc.includes('v. mapa') || loc.includes('sta. mesa lrt')) return 'V. Mapa (LRT-2)';
    if (loc.includes('j. ruiz') || loc.includes('san juan lrt')) return 'J. Ruiz (LRT-2)';
    if (loc.includes('gilmore') || loc.includes('new manila')) return 'Gilmore (LRT-2)';
    if (loc.includes('betty go') || loc.includes('cubao lrt2')) return 'Betty Go-Belmonte (LRT-2)';
    if (loc.includes('katipunan') || loc.includes('ateneo') || loc.includes('loyola')) return 'Katipunan (LRT-2)';
    if (loc.includes('santolan lrt2') || loc.includes('marikina')) return 'Santolan (LRT-2)';
    if (loc.includes('cainta') || loc.includes('antipolo lrt')) return 'Antipolo (LRT-2)';
    // Fallback: nearest by area keyword
    if (loc.includes('makati') || loc.includes('ayala')) return 'Ayala (MRT-3)';
    if (loc.includes('bgc') || loc.includes('taguig')) return 'Guadalupe (MRT-3)';
    if (loc.includes('quezon') || loc.includes('commonwealth')) return 'North Ave (MRT-3)';
    if (loc.includes('manila') || loc.includes('malate') || loc.includes('ermita')) return 'U.N. Ave (LRT-1)';
    if (loc.includes('pasay') || loc.includes('baclaran')) return 'Baclaran (LRT-1)';
    if (loc.includes('marikina') || loc.includes('antipolo')) return 'Santolan (LRT-2)';
    return null; // no rail nearby
}

function getLRTLine(origin, destination) {
    // This function returns the PRIMARY line for the ORIGIN.
    const o = (origin || '').toLowerCase();
    const d = (destination || '').toLowerCase();

    const lrt1Keys = ['baclaran','libertad','edsa pasay','pasay lrt','gil puyat','buendia lrt','vito cruz','quirino','pedro gil','un ave','central lrt','carriedo','doroteo','recto lrt1','bambang','tayuman','blumentritt','abad santos','r. papa','5th ave','caloocan','monumento','balintawak','roosevelt','tondo','quiapo','ermita','malate'];
    const lrt2Keys = ['recto lrt2','legarda','pureza','v. mapa','j. ruiz','gilmore','betty go','katipunan','ateneo','santolan lrt2','antipolo lrt','marikina','espana lrt','sampaloc lrt'];
    const mrtKeys  = ['north ave','quezon ave mrt','gma','kamuning','cubao mrt','santolan mrt','ortigas mrt','shaw','boni','guadalupe','buendia mrt','ayala mrt','magallanes','taft mrt','mandaluyong','makati','bgc','taguig','sm north'];

    if (lrt1Keys.some(k => o.includes(k))) return 'LRT-1';
    if (lrt2Keys.some(k => o.includes(k))) return 'LRT-2';
    if (mrtKeys.some(k => o.includes(k)))  return 'MRT-3';

    // Fallback
    if (lrt2Keys.some(k => d.includes(k))) return 'MRT-3';
    if (lrt1Keys.some(k => d.includes(k))) return 'MRT-3';
    return 'MRT-3';
}