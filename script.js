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

// Fetch a real road route from the public OSRM demo server
async function fetchOSRMRoute(originCoords, destCoords, profile) {
    const url = `https://router.project-osrm.org/route/v1/${profile}/` +
                `${originCoords.lon},${originCoords.lat};${destCoords.lon},${destCoords.lat}` +
                `?overview=full&geometries=geojson&steps=false`;
    const res = await axios.get(url, { timeout: 10000 });
    if (!res.data || res.data.code !== 'Ok' || !res.data.routes.length) {
        throw new Error('OSRM returned no route');
    }
    return res.data.routes[0]; // { distance (m), duration (s), geometry }
}

async function getRealisticRoute(originCoords, destCoords, mode) {
    const profile = OSRM_PROFILES[mode] || 'driving';

    try {
        const osrmRoute = await fetchOSRMRoute(originCoords, destCoords, profile);

        let durationSec = osrmRoute.duration;   // OSRM gives seconds
        let distanceM   = osrmRoute.distance;   // OSRM gives metres

        if (mode === 'transit') {
            // Transit is slower than pure driving: waiting + transfers + slower vehicles
            // Use driving road geometry but apply realistic transit time
            const distKm = distanceM / 1000;
            const avgTransitSpeed = 20;          // km/h for mixed jeep/bus/LRT
            const transferBuffer  = distKm < 3 ? 5 : distKm < 8 ? 15 : 25; // minutes
            durationSec = Math.round((distKm / avgTransitSpeed) * 3600) + transferBuffer * 60;
        }

        // Apply traffic multiplier for driving based on departure hour
        if (mode === 'drive') {
            const h = getDepartureHour();
            if ((h >= 7 && h <= 9) || (h >= 17 && h <= 19))       durationSec = Math.round(durationSec * 1.7);
            else if ((h >= 10 && h <= 16) || (h >= 20 && h <= 22)) durationSec = Math.round(durationSec * 1.2);
        }

        return {
            routes: [{
                distance: distanceM,
                duration: durationSec,
                geometry: osrmRoute.geometry   // real GeoJSON LineString from OSRM
            }]
        };

    } catch (err) {
        // Graceful fallback: straight-line estimate if OSRM is unreachable
        console.warn(`OSRM failed for ${mode}, using fallback:`, err.message);
        return fallbackRoute(originCoords, destCoords, mode);
    }
}

// Fallback straight-line estimator (used only if OSRM is unavailable)
function fallbackRoute(originCoords, destCoords, mode) {
    const straight = calculateDistance(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon);
    const cfg = {
        drive:   { factor: 1.3,  speed: 30 },
        transit: { factor: 1.45, speed: 20 },
        walk:    { factor: 1.15, speed: 5  },
        bike:    { factor: 1.2,  speed: 14 },
    }[mode] || { factor: 1.3, speed: 25 };
    const dist = straight * cfg.factor;
    const dur  = Math.round((dist / cfg.speed) * 60);
    const mid  = { lat: (originCoords.lat + destCoords.lat)/2, lon: (originCoords.lon + destCoords.lon)/2 };
    return {
        routes: [{
            distance: dist * 1000,
            duration: dur * 60,
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

async function reverseGeocode(lat, lon) {
    try {
        const r = await axios.get('https://nominatim.openstreetmap.org/reverse', {
            params: { lat, lon, format: 'json' },
            headers: { 'User-Agent': 'SmartCommutePH/2.0' }
        });
        return r.data.display_name;
    } catch { return `${lat.toFixed(5)}, ${lon.toFixed(5)}`; }
}

async function geocodeLocation(address) {
    const r = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q: address + ', Philippines', format: 'json', limit: 1 },
        headers: { 'User-Agent': 'SmartCommutePH/2.0' }
    });
    if (!r.data || r.data.length === 0) throw new Error(`Location not found: "${address}"`);
    return { lat: parseFloat(r.data[0].lat), lon: parseFloat(r.data[0].lon), displayName: r.data[0].display_name };
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

// ── Display Routes ──
function displayRoutes(routes, weather) {
    const container = document.getElementById('route-list');
    const badges = ['badge-best','badge-fast','badge-eco'];
    const badgeLabels = ['Best','Fast','Eco'];

    container.innerHTML = routes.map((route, i) => {
        const fare = calculateFare(parseFloat(route.distance), route.mode);
        const steps = generateRouteSteps(route, parseFloat(route.distance));
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
    const legs = [];
    if (route.mode === 'transit') {
        if (dist < 3) {
            legs.push({ icon:'fa-truck-pickup', color:'#f59e0b', name:'Jeepney', amount: Math.round(13 + Math.max(0, dist-2)*1) });
        } else if (dist < 8) {
            legs.push({ icon:'fa-truck-pickup', color:'#f59e0b', name:'Jeepney (feeder)', amount: 13 });
            legs.push({ icon:'fa-bus', color:'#10b981', name:'Bus', amount: Math.round(15 + dist*1.5) });
        } else {
            legs.push({ icon:'fa-truck-pickup', color:'#f59e0b', name:'Jeepney (to station)', amount: 13 });
            legs.push({ icon:'fa-train', color:'#2563eb', name:'LRT/MRT', amount: dist < 15 ? 30 : 42 });
            legs.push({ icon:'fa-truck-pickup', color:'#f59e0b', name:'Jeepney (last mile)', amount: 13 });
        }
    } else if (route.mode === 'drive') {
        legs.push({ icon:'fa-gas-pump', color:'#ef4444', name:'Fuel estimate', amount: Math.round(dist*8) });
        legs.push({ icon:'fa-parking', color:'#8b5cf6', name:'Parking (avg)', amount: 50 });
    }
    return legs;
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

// ── Route Steps ──
function generateRouteSteps(route, dist) {
    const steps = [];
    if (route.mode === 'transit') {
        const origin = document.getElementById('origin').value;
        const dest   = document.getElementById('destination').value;
        if (dist < 3) {
            steps.push({ icon:'fa-person-walking', text:'Walk to nearest jeepney stop' });
            steps.push({ icon:'fa-truck-pickup',   text:`Board jeepney towards ${dest.split(',')[0]}` });
        } else if (dist < 8) {
            steps.push({ icon:'fa-person-walking', text:'Walk to jeepney terminal' });
            steps.push({ icon:'fa-truck-pickup',   text:'Ride jeepney to main road' });
            steps.push({ icon:'fa-bus',            text:'Transfer to P2P Bus or EDSA bus' });
        } else {
            steps.push({ icon:'fa-person-walking',  text:`Walk to ${getNearestLRTStation(origin)}` });
            steps.push({ icon:'fa-train',           text:`Take ${getLRTLine(origin, dest)} to ${getNearestLRTStation(dest)}` });
            steps.push({ icon:'fa-truck-pickup',    text:`Board jeepney to ${dest.split(',')[0]}` });
        }
        steps.push({ icon:'fa-person-walking', text:'Short walk to final destination' });
    } else if (route.mode === 'drive') {
        const h = getDepartureHour();
        const rush = (h>=7&&h<=9)||(h>=17&&h<=19);
        steps.push({ icon:'fa-car', text:`Drive via ${dist > 10 ? 'EDSA / C5' : 'main roads'} (${route.adjustedDuration} min${rush?' — expect traffic':''})` });
    } else if (route.mode === 'walk') {
        steps.push({ icon:'fa-person-walking', text:`Walk directly — ${route.duration} minutes` });
    } else if (route.mode === 'bike') {
        steps.push({ icon:'fa-bicycle', text:`Cycle via bike-friendly roads — ${route.duration} min` });
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

// ── Philippine Commute Data ──
function getJeepneyRoute(from, to) {
    const routes = [
        'Quiapo – Cubao', 'Divisoria – España', 'Baclaran – Monumento',
        'Cubao – Fairview', 'Taft – Buendia', 'Caloocan – Monumento',
        'Malate – Pasay', 'Quezon Ave – Espana', 'Recto – Divisoria',
        'P. Tuazon – Cubao', 'Antipolo – Cubao', 'Marikina – SM Masinag',
        'Novaliches – Quezon Ave', 'Las Piñas – Alabang'
    ];
    return routes[Math.floor(Math.random() * routes.length)];
}

function getNearestJeepneyStop(location) {
    const loc = (location || '').toLowerCase();
    if (loc.includes('makati') || loc.includes('bgc') || loc.includes('taguig')) return 'Ayala Terminal, Makati';
    if (loc.includes('quezon') || loc.includes('cubao')) return 'Cubao Jeepney Terminal';
    if (loc.includes('manila') || loc.includes('taft') || loc.includes('baclaran')) return 'Baclaran Terminal';
    if (loc.includes('ortigas') || loc.includes('pasig')) return 'Crossing Terminal, Ortigas';
    if (loc.includes('caloocan') || loc.includes('monumento')) return 'Monumento Terminal';
    if (loc.includes('marikina')) return 'Marikina Market Terminal';
    if (loc.includes('paranaque') || loc.includes('las pinas')) return 'Alabang Terminal';
    if (loc.includes('valenzuela') || loc.includes('malabon')) return 'Malinta Jeepney Stop';
    const stops = [
        'Ayala Terminal, Makati', 'Quiapo Terminal', 'Cubao Jeepney Terminal',
        'Divisoria Terminal', 'Monumento Terminal', 'Baclaran Terminal',
        'Crossing Terminal, Ortigas', 'Fairview Terminal', 'SM North EDSA Terminal',
        'Kamuning Jeepney Stop', 'Espana Terminal', 'Recto Terminal'
    ];
    return stops[Math.floor(Math.random() * stops.length)];
}

function getNearestLRTStation(location) {
    const loc = (location || '').toLowerCase();
    if (loc.includes('manila') || loc.includes('divisoria') || loc.includes('recto')) return 'Doroteo Jose (LRT-1)';
    if (loc.includes('taft') || loc.includes('pasay') || loc.includes('baclaran')) return 'Baclaran (LRT-1)';
    if (loc.includes('makati') || loc.includes('ayala')) return 'Ayala (MRT-3)';
    if (loc.includes('bgc') || loc.includes('taguig')) return 'Guadalupe (MRT-3)';
    if (loc.includes('ortigas')) return 'Ortigas (MRT-3)';
    if (loc.includes('cubao')) return 'Cubao (MRT-3 / LRT-2)';
    if (loc.includes('quezon') || loc.includes('balintawak')) return 'North Ave (MRT-3)';
    if (loc.includes('caloocan') || loc.includes('monumento')) return 'Monumento (LRT-1)';
    if (loc.includes('quiapo') || loc.includes('sta. cruz')) return 'Central (LRT-1)';
    if (loc.includes('katipunan') || loc.includes('ateneo') || loc.includes('loyola')) return 'Katipunan (LRT-2)';
    if (loc.includes('antipolo') || loc.includes('marikina')) return 'Santolan (LRT-2)';
    if (loc.includes('espana') || loc.includes('sampaloc')) return 'Pureza (LRT-2)';
    const stations = [
        'North Ave (MRT-3)', 'Quezon Ave (MRT-3)', 'GMA-Kamuning (MRT-3)',
        'Cubao (MRT-3)', 'Ortigas (MRT-3)', 'Shaw Blvd (MRT-3)',
        'Boni (MRT-3)', 'Guadalupe (MRT-3)', 'Buendia (MRT-3)',
        'Ayala (MRT-3)', 'Magallanes (MRT-3)', 'Taft Ave (MRT-3)',
        'Baclaran (LRT-1)', 'EDSA (LRT-1)', 'Libertad (LRT-1)',
        'Gil Puyat (LRT-1)', 'Vito Cruz (LRT-1)', 'Quirino (LRT-1)',
        'Pedro Gil (LRT-1)', 'U.N. Ave (LRT-1)', 'Central (LRT-1)',
        'Carriedo (LRT-1)', 'Doroteo Jose (LRT-1)', 'Bambang (LRT-1)',
        'Tayuman (LRT-1)', 'Blumentritt (LRT-1)', 'Abad Santos (LRT-1)',
        'R. Papa (LRT-1)', '5th Ave (LRT-1)', 'Monumento (LRT-1)',
        'Balintawak (LRT-1)', 'Roosevelt (LRT-1)'
    ];
    return stations[Math.floor(Math.random() * stations.length)];
}

function getLRTLine(from, to) {
    const f = (from || '').toLowerCase(), t2 = (to || '').toLowerCase();
    if (f.includes('antipolo') || t2.includes('antipolo') || f.includes('marikina') || t2.includes('marikina') || f.includes('katipunan') || t2.includes('katipunan')) return 'LRT-2';
    if (f.includes('taft') || t2.includes('taft') || f.includes('baclaran') || t2.includes('baclaran') || f.includes('monumento') || t2.includes('monumento')) return 'LRT-1';
    return 'MRT-3';
}