// Global Variables
let map;
let currentMarkers = [];
let currentRoutes = [];
let currentMode = 'drive';
let savedLocations = [];
let recentSearches = [];
let currentUser = null;
let selectedRouteLayer = null;
let routeControl = null;
let trafficLayer = null;

// Priority settings
let priorities = {
    jeepney: null,
    bus: null,
    train: null
};

// Load saved data from localStorage
function loadSavedData() {
    const saved = localStorage.getItem('savedLocations');
    if (saved) savedLocations = JSON.parse(saved);
    
    const recent = localStorage.getItem('recentSearches');
    if (recent) recentSearches = JSON.parse(recent);
    updateRecentSearches();
}

// Save data to localStorage
function saveData() {
    localStorage.setItem('savedLocations', JSON.stringify(savedLocations));
    localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
}

// Update recent searches display
function updateRecentSearches() {
    const container = document.getElementById('recent-list');
    if (!container) return;
    
    container.innerHTML = recentSearches.slice(-5).reverse().map(search => 
        `<span class="recent-item" onclick="fillSearch('${search.origin.replace(/'/g, "\\'")}', '${search.destination.replace(/'/g, "\\'")}')">
            ${search.origin.substring(0, 20)} → ${search.destination.substring(0, 20)}
        </span>`
    ).join('');
}

// Fill search from recent
function fillSearch(origin, destination) {
    document.getElementById('origin').value = origin;
    document.getElementById('destination').value = destination;
    planRoute();
}

// Add to recent searches
function addToRecent(origin, destination) {
    recentSearches = recentSearches.filter(s => !(s.origin === origin && s.destination === destination));
    recentSearches.unshift({ origin, destination });
    if (recentSearches.length > 10) recentSearches.pop();
    saveData();
    updateRecentSearches();
}

// Initialize map with OpenStreetMap
function initMap() {
    if (map) {
        map.invalidateSize();
        console.log('Map already exists, resizing...');
        return;
    }
    
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error('Map element not found!');
        return;
    }
    
    console.log('Initializing map...');
    const defaultLocation = [14.5995, 120.9842];
    
    map = L.map('map').setView(defaultLocation, 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        minZoom: 3,
        errorTileUrl: 'https://via.placeholder.com/256?text=Map+Tile+Error'
    }).addTo(map);
    
    L.control.scale({ metric: true, imperial: false }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    
    console.log('Map initialized successfully!');
}

// Calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Get realistic route based on mode
async function getRealisticRoute(originCoords, destCoords, mode) {
    const straightDistance = calculateDistance(
        originCoords.lat, originCoords.lon,
        destCoords.lat, destCoords.lon
    );
    
    let roadFactor = 1.3;
    let speed = 0;
    let transferTime = 0;
    
    switch(mode) {
        case 'drive':
            roadFactor = 1.25;
            speed = 35;
            break;
        case 'transit':
            roadFactor = 1.4;
            speed = 22;
            transferTime = 15;
            break;
        case 'walk':
            roadFactor = 1.1;
            speed = 5;
            break;
        case 'bike':
            roadFactor = 1.2;
            speed = 15;
            break;
        default:
            roadFactor = 1.3;
            speed = 30;
    }
    
    const actualDistance = straightDistance * roadFactor;
    let duration = Math.round((actualDistance / speed) * 60);
    duration += transferTime;
    
    if (mode === 'drive') {
        const hour = new Date().getHours();
        if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
            duration = Math.round(duration * 1.5);
        } else if ((hour >= 10 && hour <= 16) || (hour >= 20 && hour <= 22)) {
            duration = Math.round(duration * 1.2);
        }
    }
    
    const midLat = (originCoords.lat + destCoords.lat) / 2;
    const midLon = (originCoords.lon + destCoords.lon) / 2;
    const curveOffset = Math.min(0.05, straightDistance / 200);
    const curveLat = midLat + (Math.random() - 0.5) * curveOffset;
    const curveLon = midLon + (Math.random() - 0.5) * curveOffset;
    
    const routeGeometry = {
        type: "LineString",
        coordinates: [
            [originCoords.lon, originCoords.lat],
            [curveLon, curveLat],
            [destCoords.lon, destCoords.lat]
        ]
    };
    
    return {
        routes: [{
            distance: actualDistance * 1000,
            duration: duration * 60,
            geometry: routeGeometry
        }]
    };
}

// Get traffic data
function getTrafficData(route, timeOfDay) {
    const trafficLevels = {
        morning: { light: 0.1, moderate: 0.4, heavy: 0.5 },
        midday: { light: 0.5, moderate: 0.3, heavy: 0.2 },
        evening: { light: 0.05, moderate: 0.35, heavy: 0.6 },
        night: { light: 0.8, moderate: 0.15, heavy: 0.05 }
    };
    
    const now = new Date();
    const hour = now.getHours();
    let period = 'midday';
    
    if (hour >= 6 && hour < 10) period = 'morning';
    else if (hour >= 16 && hour < 20) period = 'evening';
    else if (hour >= 22 || hour < 5) period = 'night';
    
    const level = trafficLevels[period];
    const random = Math.random();
    
    let trafficStatus = 'light';
    if (random < level.heavy) trafficStatus = 'heavy';
    else if (random < level.heavy + level.moderate) trafficStatus = 'moderate';
    
    let delayMultiplier = 1;
    let trafficColor = '#28a745';
    let trafficIcon = 'fa-car';
    
    switch(trafficStatus) {
        case 'light':
            delayMultiplier = 1;
            trafficColor = '#28a745';
            trafficIcon = 'fa-car';
            break;
        case 'moderate':
            delayMultiplier = 1.3;
            trafficColor = '#ffc107';
            trafficIcon = 'fa-car-side';
            break;
        case 'heavy':
            delayMultiplier = 1.8;
            trafficColor = '#dc3545';
            trafficIcon = 'fa-traffic-light';
            break;
    }
    
    const originalDuration = route.duration / 60;
    const adjustedDuration = Math.round(originalDuration * delayMultiplier);
    
    return {
        status: trafficStatus,
        delayMultiplier: delayMultiplier,
        adjustedDuration: adjustedDuration,
        originalDuration: originalDuration,
        color: trafficColor,
        icon: trafficIcon,
        period: period
    };
}

// Mode selection
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentMode = tab.dataset.mode;
            
            const origin = document.getElementById('origin').value;
            const destination = document.getElementById('destination').value;
            if (origin && destination) planRoute();
        });
    });
    
    loadSavedData();
    loadPriorities();
    showAdvisories();
    
    // Make swap icon clickable
    const swapIcon = document.querySelector('.swap-icon');
    if (swapIcon) swapIcon.onclick = swapLocations;
    
    console.log('Page loaded, ready to search routes');
});

// Login modal
function showLoginModal() {
    document.getElementById('login-modal').style.display = 'flex';
}

function closeLoginModal() {
    document.getElementById('login-modal').style.display = 'none';
}

function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    if (username && password) {
        currentUser = username;
        document.getElementById('user-nav').innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem;">
                <span><i class="fas fa-user-circle"></i> ${username}</span>
                <button class="btn-login" onclick="logout()">Logout</button>
            </div>
        `;
        closeLoginModal();
        loadUserLocations();
    } else {
        alert('Please enter username and password');
    }
}

function logout() {
    currentUser = null;
    document.getElementById('user-nav').innerHTML = `
        <button class="btn-login" onclick="showLoginModal()">
            <i class="fas fa-user-circle"></i> Login
        </button>
    `;
}

function loadUserLocations() {
    const userLocations = localStorage.getItem(`saved_${currentUser}`);
    if (userLocations) savedLocations = JSON.parse(userLocations);
}

function saveCurrentLocation() {
    const name = document.getElementById('save-name').value;
    const origin = document.getElementById('origin').value;
    if (name && origin) {
        savedLocations.push({ name, address: origin });
        localStorage.setItem(`saved_${currentUser}`, JSON.stringify(savedLocations));
        closeSaveModal();
        alert(`Location "${name}" saved!`);
    }
}

function showSavedLocations() {
    if (!currentUser) {
        alert('Please login first to save locations');
        showLoginModal();
        return;
    }
    
    if (savedLocations.length === 0) {
        alert('No saved locations yet. Enter a location and click save!');
        return;
    }
    
    const list = savedLocations.map((loc, i) => 
        `${i + 1}. ${loc.name} - ${loc.address.substring(0, 30)}...`
    ).join('\n');
    
    const choice = prompt(`Saved Locations:\n${list}\n\nEnter number to select, or cancel to close:`);
    if (choice && !isNaN(choice) && savedLocations[choice - 1]) {
        document.getElementById('origin').value = savedLocations[choice - 1].address;
    }
}

function closeSaveModal() {
    document.getElementById('save-modal').style.display = 'none';
}

function useCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async position => {
            const { latitude, longitude } = position.coords;
            const address = await reverseGeocode(latitude, longitude);
            document.getElementById('origin').value = address;
        }, () => alert('Unable to get location'));
    } else {
        alert('Geolocation not supported');
    }
}

async function reverseGeocode(lat, lon) {
    try {
        const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
            params: { lat, lon, format: 'json' },
            headers: { 'User-Agent': 'SmartCommutePlanner/1.0' }
        });
        return response.data.display_name;
    } catch {
        return `${lat}, ${lon}`;
    }
}

async function geocodeLocation(address) {
    try {
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: { q: address, format: 'json', limit: 1 },
            headers: { 'User-Agent': 'SmartCommutePlanner/1.0' }
        });
        
        if (response.data && response.data.length > 0) {
            return {
                lat: parseFloat(response.data[0].lat),
                lon: parseFloat(response.data[0].lon),
                displayName: response.data[0].display_name
            };
        }
        throw new Error('Location not found');
    } catch (error) {
        console.error('Geocoding error:', error);
        throw error;
    }
}

async function getWeather(lat, lon) {
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
        params: {
            latitude: lat,
            longitude: lon,
            current_weather: true,
            hourly: 'temperature_2m,precipitation_probability,weathercode',
            timezone: 'auto'
        }
    });
    return response.data;
}

function clearMap() {
    currentMarkers.forEach(marker => {
        if (marker.remove) marker.remove();
    });
    if (selectedRouteLayer) {
        map.removeLayer(selectedRouteLayer);
    }
    currentMarkers = [];
}

function displayRouteOnMap(routeData, trafficInfo = null) {
    if (selectedRouteLayer) {
        map.removeLayer(selectedRouteLayer);
    }
    
    if (routeData.routes && routeData.routes.length > 0) {
        const geometry = routeData.routes[0].geometry;
        const routeColor = trafficInfo ? trafficInfo.color : '#3b82f6';
        
        selectedRouteLayer = L.geoJSON(geometry, {
            style: { 
                color: routeColor, 
                weight: 5, 
                opacity: 0.8,
                dashArray: trafficInfo && trafficInfo.status === 'heavy' ? '10, 10' : null
            }
        }).addTo(map);
        
        const bounds = selectedRouteLayer.getBounds();
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }
}

function calculateETA(durationMinutes) {
    const now = new Date();
    const eta = new Date(now.getTime() + durationMinutes * 60000);
    const options = { hour: 'numeric', minute: '2-digit', hour12: true };
    return eta.toLocaleTimeString('en-US', options);
}

// Main route planning
async function planRoute() {
    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;
    
    if (!origin || !destination) {
        alert('Please enter both origin and destination');
        return;
    }
    
    addToRecent(origin, destination);
    
    const resultsContainer = document.getElementById('results-container');
    const routeList = document.getElementById('route-list');
    
    resultsContainer.style.display = 'block';
    routeList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Finding routes...</div>';
    
    try {
        if (!map) {
            initMap();
        } else {
            map.invalidateSize();
        }
        
        const originCoords = await geocodeLocation(origin);
        const destCoords = await geocodeLocation(destination);
        
        clearMap();
        
        const startMarker = L.marker([originCoords.lat, originCoords.lon])
            .addTo(map)
            .bindPopup(`<strong>📍 Start</strong><br>${origin.substring(0, 50)}`);
        const endMarker = L.marker([destCoords.lat, destCoords.lon])
            .addTo(map)
            .bindPopup(`<strong>🎯 Destination</strong><br>${destination.substring(0, 50)}`);
        currentMarkers.push(startMarker, endMarker);
        
        const bounds = L.latLngBounds(
            [originCoords.lat, originCoords.lon],
            [destCoords.lat, destCoords.lon]
        );
        map.fitBounds(bounds, { padding: [50, 50] });
        
        const weather = await getWeather(destCoords.lat, destCoords.lon);
        
        const modes = ['drive', 'transit', 'walk', 'bike'];
        const routes = [];
        
        for (const mode of modes) {
            try {
                const route = await getRealisticRoute(originCoords, destCoords, mode);
                if (route.routes && route.routes.length > 0) {
                    const distance = (route.routes[0].distance / 1000).toFixed(1);
                    const duration = Math.round(route.routes[0].duration / 60);
                    
                    let trafficInfo = null;
                    if (mode === 'drive') {
                        trafficInfo = getTrafficData(route.routes[0], null);
                    }
                    
                    const finalDuration = trafficInfo ? trafficInfo.adjustedDuration : duration;
                    const eta = calculateETA(finalDuration);
                    
                    routes.push({
                        mode: mode,
                        distance: distance,
                        duration: duration,
                        adjustedDuration: finalDuration,
                        eta: eta,
                        routeData: route,
                        trafficInfo: trafficInfo,
                        color: trafficInfo ? trafficInfo.color : getModeColor(mode)
                    });
                }
            } catch (e) {
                console.log(`${mode} route not available`);
            }
        }
        
        if (routes.length === 0) {
            routeList.innerHTML = '<div class="loading" style="color: red;">No routes found. Please try different locations.</div>';
            return;
        }
        
        routes.sort((a, b) => a.adjustedDuration - b.adjustedDuration);
        currentRoutes = routes;
        
        displayRoutes(routes, weather);
        
        if (routes.length > 0) {
            displayRouteOnMap(routes[0].routeData, routes[0].trafficInfo);
        }
        
        updateWeatherBadge(weather);
        
    } catch (error) {
        console.error('Error:', error);
        routeList.innerHTML = `<div class="loading" style="color: red;">❌ Error: ${error.message || 'Could not find routes. Please check locations and try again.'}</div>`;
    }
}

function getModeColor(mode) {
    const colors = { drive: '#3b82f6', transit: '#10b981', walk: '#f59e0b', bike: '#8b5cf6' };
    return colors[mode] || '#3b82f6';
}

function getModeIcon(mode) {
    const icons = { drive: 'fa-car', transit: 'fa-bus', walk: 'fa-person-walking', bike: 'fa-bicycle' };
    return icons[mode] || 'fa-route';
}

function getModeName(mode) {
    const names = { drive: '🚗 Driving', transit: '🚌 Transit', walk: '🚶 Walking', bike: '🚲 Cycling' };
    return names[mode] || mode;
}

function getTrafficText(status) {
    switch(status) {
        case 'light': return '🟢 Light Traffic';
        case 'moderate': return '🟡 Moderate Traffic';
        case 'heavy': return '🔴 Heavy Traffic';
        default: return 'No data';
    }
}

function updateWeatherBadge(weather) {
    const badge = document.getElementById('weather-badge');
    if (weather && weather.current_weather) {
        const temp = weather.current_weather.temperature;
        const weatherCode = weather.current_weather.weathercode;
        
        let icon = 'fa-sun';
        let condition = 'Sunny';
        
        if (weatherCode === 0) { condition = 'Clear sky'; icon = 'fa-sun'; }
        else if (weatherCode === 1) { condition = 'Mainly clear'; icon = 'fa-sun'; }
        else if (weatherCode === 2) { condition = 'Partly cloudy'; icon = 'fa-cloud-sun'; }
        else if (weatherCode === 3) { condition = 'Overcast'; icon = 'fa-cloud'; }
        else if (weatherCode >= 51 && weatherCode <= 67) { condition = 'Rain expected'; icon = 'fa-cloud-rain'; }
        
        badge.innerHTML = `<i class="fas ${icon}"></i> ${temp}°C | ${condition}`;
    } else {
        badge.innerHTML = '<i class="fas fa-cloud-sun"></i> Loading weather...';
    }
}

// Enhanced displayRoutes with fare and steps
function displayRoutes(routes, weather) {
    const container = document.getElementById('route-list');
    
    if (routes.length === 0) {
        container.innerHTML = '<div class="loading">No routes found for selected modes</div>';
        return;
    }
    
    container.innerHTML = routes.map((route, index) => {
        const fare = calculateFare(parseFloat(route.distance), route.mode);
        const steps = generateRouteSteps(route, parseFloat(route.distance));
        
        return `
            <div class="route-card" onclick="selectRoute(${index})" data-index="${index}" style="cursor: pointer;">
                <div class="route-icon ${route.mode}">
                    <i class="fas ${getModeIcon(route.mode)}"></i>
                </div>
                <div class="route-details">
                    <h4>${getModeName(route.mode)} <span class="route-fare">${fare}</span></h4>
                    <div class="route-stats">
                        <span><i class="fas fa-road"></i> ${route.distance} km</span>
                        <span><i class="fas fa-clock"></i> ${route.duration} mins</span>
                        ${route.adjustedDuration !== route.duration ? 
                            `<span style="color: ${route.trafficInfo?.color}">
                                <i class="fas ${route.trafficInfo?.icon}"></i> ${route.adjustedDuration} mins
                            </span>` : 
                            `<span><i class="fas fa-hourglass-half"></i> ${route.adjustedDuration} mins</span>`
                        }
                    </div>
                    <div class="route-stats" style="margin-top: 5px;">
                        <span><i class="fas fa-clock"></i> 🕐 ETA: ${route.eta}</span>
                    </div>
                    <div class="route-steps">
                        ${steps.map(step => `<div class="route-step"><i class="fas ${step.icon}"></i> ${step.text}</div>`).join('')}
                    </div>
                    <button class="feedback-btn" onclick="event.stopPropagation(); reportRouteIssue(${index})">
                        <i class="fas fa-flag"></i> Suggest correction
                    </button>
                </div>
                <div class="route-action">
                    <button onclick="event.stopPropagation(); saveRoute(${index})">
                        <i class="fas fa-bookmark"></i> Save
                    </button>
                    <button onclick="event.stopPropagation(); showRouteDetails(${index})">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    if (weather) updateWeatherBadge(weather);
}

function selectRoute(index) {
    const route = currentRoutes[index];
    if (!route) return;
    
    document.querySelectorAll('.route-card').forEach(card => card.classList.remove('selected'));
    document.querySelector(`.route-card[data-index="${index}"]`).classList.add('selected');
    
    displayRouteOnMap(route.routeData, route.trafficInfo);
    
    document.getElementById('map').scrollIntoView({ behavior: 'smooth' });
}

function saveRoute(index) {
    if (!currentUser) {
        alert('Please login to save routes');
        showLoginModal();
        return;
    }
    
    const route = currentRoutes[index];
    if (route) {
        const savedRoutes = JSON.parse(localStorage.getItem(`saved_routes_${currentUser}`) || '[]');
        const origin = document.getElementById('origin').value;
        const destination = document.getElementById('destination').value;
        savedRoutes.push({
            id: Date.now(),
            origin, destination,
            mode: route.mode,
            distance: route.distance,
            duration: route.duration,
            adjustedDuration: route.adjustedDuration,
            eta: route.eta,
            date: new Date().toISOString()
        });
        localStorage.setItem(`saved_routes_${currentUser}`, JSON.stringify(savedRoutes));
        alert('✅ Route saved!');
    }
}

function showRouteDetails(index) {
    const route = currentRoutes[index];
    if (!route) return;
    
    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;
    const fare = calculateFare(parseFloat(route.distance), route.mode);
    
    alert(`🚗 ROUTE DETAILS\n━━━━━━━━━━━━━━━━━━━━━━━\n\n📍 From: ${origin.substring(0, 50)}\n📍 To: ${destination.substring(0, 50)}\n\n🚀 Mode: ${getModeName(route.mode)}\n💰 Fare: ₱${fare}\n📏 Distance: ${route.distance} km\n⏱️ Duration: ${route.adjustedDuration} minutes\n🕐 ETA: ${route.eta}`);
}

// Sakay.ph Features
function loadPriorities() {
    const saved = localStorage.getItem('transportPriorities');
    if (saved) {
        priorities = JSON.parse(saved);
        updatePriorityButtons();
    }
}

function savePriorities() {
    localStorage.setItem('transportPriorities', JSON.stringify(priorities));
}

function setPriority(mode, action) {
    if (priorities[mode] === action) {
        priorities[mode] = null;
    } else {
        priorities[mode] = action;
    }
    savePriorities();
    updatePriorityButtons();
    
    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;
    if (origin && destination) planRoute();
}

function updatePriorityButtons() {
    document.querySelectorAll('.prefer-btn, .avoid-btn').forEach(btn => {
        const mode = btn.dataset.mode;
        const action = btn.classList.contains('prefer-btn') ? 'prefer' : 'avoid';
        if (priorities[mode] === action) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function togglePriorityPanel() {
    const panel = document.getElementById('priority-panel');
    const icon = document.getElementById('priority-icon');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        icon.style.transform = 'rotate(180deg)';
    } else {
        panel.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
}

function swapLocations() {
    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;
    document.getElementById('origin').value = destination;
    document.getElementById('destination').value = origin;
    if (destination && origin) planRoute();
}

function showAdvisories() {
    const advisories = [
        "⚠️ LRT1 maintenance on Sundays until 7 AM. Expect delays.",
        "🚧 EDSA busway schedule adjusted for holidays.",
        "💡 New P2P route: Alabang to NAIA Terminal 3 now available.",
        "🚌 Jeepney route 'Taft - Baclaran' temporarily rerouted."
    ];
    const advisory = advisories[Math.floor(Math.random() * advisories.length)];
    const advisoryElement = document.getElementById('advisory-text');
    if (advisoryElement) {
        advisoryElement.innerText = advisory;
        document.getElementById('advisories').style.display = 'flex';
    }
}

function closeAdvisory() {
    document.getElementById('advisories').style.display = 'none';
}

function toggleOfflineMode(enabled) {
    if (enabled && currentRoutes.length > 0) {
        localStorage.setItem('offlineRoutes', JSON.stringify({
            routes: currentRoutes,
            origin: document.getElementById('origin').value,
            destination: document.getElementById('destination').value,
            savedAt: new Date().toISOString()
        }));
        alert("✅ Routes saved for offline use!");
    } else if (enabled) {
        alert("⚠️ Search for a route first.");
        document.getElementById('offlineMode').checked = false;
    } else {
        localStorage.removeItem('offlineRoutes');
    }
}

function showMeetupModal() {
    document.getElementById('meetup-modal').style.display = 'flex';
}

function closeMeetupModal() {
    document.getElementById('meetup-modal').style.display = 'none';
}

async function findMeetupPoint() {
    const loc1 = document.getElementById('meet-location1').value;
    const loc2 = document.getElementById('meet-location2').value;
    
    if (!loc1 || !loc2) {
        alert('Please enter both locations');
        return;
    }
    
    try {
        const coords1 = await geocodeLocation(loc1);
        const coords2 = await geocodeLocation(loc2);
        const midLat = (coords1.lat + coords2.lat) / 2;
        const midLon = (coords1.lon + coords2.lon) / 2;
        const address = await reverseGeocode(midLat, midLon);
        const distance1 = calculateDistance(coords1.lat, coords1.lon, midLat, midLon);
        const distance2 = calculateDistance(coords2.lat, coords2.lon, midLat, midLon);
        
        document.getElementById('meetup-result').innerHTML = `
            <strong>📍 Meeting Point:</strong><br>
            ${address.substring(0, 80)}<br><br>
            From you: ${distance1.toFixed(1)} km<br>
            From friend: ${distance2.toFixed(1)} km<br>
            <button class="btn-primary" style="margin-top: 10px;" onclick="useMeetupPoint('${address.replace(/'/g, "\\'")}')">
                Use as destination
            </button>
        `;
    } catch (error) {
        document.getElementById('meetup-result').innerHTML = `<span style="color: red;">Error: ${error.message}</span>`;
    }
}

function useMeetupPoint(address) {
    document.getElementById('destination').value = address;
    closeMeetupModal();
    planRoute();
}

function calculateFare(distanceKm, mode) {
    if (mode === 'walk' || mode === 'bike') return 0;
    if (mode === 'transit') {
        if (distanceKm < 3) return Math.round(13 + Math.max(0, distanceKm - 4) * 1);
        if (distanceKm < 8) return Math.round(20 + Math.max(0, distanceKm - 5) * 2);
        return Math.round(20 + (distanceKm - 8) * 1.5);
    }
    if (mode === 'drive') return Math.round(50 + distanceKm * 12);
    return Math.round(distanceKm * 8);
}

function generateRouteSteps(route, distanceKm) {
    const steps = [];
    if (route.mode === 'transit') {
        if (distanceKm < 3) {
            steps.push({ icon: 'fa-person-walking', text: 'Walk to jeepney terminal' });
            steps.push({ icon: 'fa-truck-pickup', text: 'Take jeepney to destination' });
        } else if (distanceKm < 8) {
            steps.push({ icon: 'fa-person-walking', text: 'Walk to bus stop' });
            steps.push({ icon: 'fa-bus', text: 'Take bus to main terminal' });
        } else {
            steps.push({ icon: 'fa-person-walking', text: 'Walk to LRT/MRT station' });
            steps.push({ icon: 'fa-train', text: 'Take train to nearest station' });
            steps.push({ icon: 'fa-truck-pickup', text: 'Take jeepney to destination' });
        }
        steps.push({ icon: 'fa-person-walking', text: 'Walk to final destination' });
    } else if (route.mode === 'drive') {
        steps.push({ icon: 'fa-car', text: `Drive via main roads (${route.duration} min)` });
    } else if (route.mode === 'walk') {
        steps.push({ icon: 'fa-person-walking', text: `Walk directly (${route.duration} min)` });
    } else if (route.mode === 'bike') {
        steps.push({ icon: 'fa-bicycle', text: `Cycle to destination (${route.duration} min)` });
    }
    return steps;
}

function reportRouteIssue(index) {
    const issue = prompt("Describe the issue with this route (wrong route, incorrect fare, etc.):");
    if (issue) {
        const feedbacks = JSON.parse(localStorage.getItem('routeFeedback') || '[]');
        feedbacks.push({ route: currentRoutes[index], issue, reportedAt: new Date().toISOString() });
        localStorage.setItem('routeFeedback', JSON.stringify(feedbacks));
        alert("✅ Thank you for your feedback!");
    }
}
// Detailed Route Modal Functions
function showRouteDetailModal(route, origin, destination) {
    const modal = document.getElementById('route-detail-modal');
    const content = document.getElementById('route-detail-content');
    
    // Generate detailed journey breakdown
    const journeyDetails = generateDetailedJourney(route, origin, destination);
    
    content.innerHTML = `
        <div class="route-journey-detail">
            <div class="journey-summary">
                <div>
                    <div style="font-size: 0.8rem; opacity: 0.9;">Total Fare</div>
                    <div class="total-fare">${journeyDetails.totalFare}</div>
                </div>
                <div>
                    <div style="font-size: 0.8rem; opacity: 0.9;">Total Time</div>
                    <div class="total-time">${journeyDetails.totalTime} mins</div>
                </div>
                <div>
                    <div style="font-size: 0.8rem; opacity: 0.9;">Distance</div>
                    <div>${route.distance} km</div>
                </div>
            </div>
            ${journeyDetails.legs.map(leg => `
                <div class="journey-leg">
                    <div class="leg-header">
                        <div class="leg-icon ${leg.type}">
                            <i class="fas ${leg.icon}"></i>
                        </div>
                        <div class="leg-info">
                            <div class="leg-mode">${leg.modeName}</div>
                            ${leg.routeNumber ? `<div class="leg-route">${leg.routeNumber}</div>` : ''}
                        </div>
                        <div class="leg-fare">${leg.fare}</div>
                    </div>
                    <div class="leg-details">
                        ${leg.getOn ? `
                            <div class="leg-detail-item">
                                <i class="fas fa-sign-in-alt"></i>
                                <strong>Get on:</strong>
                                <span>${leg.getOn}</span>
                            </div>
                        ` : ''}
                        ${leg.route ? `
                            <div class="leg-detail-item">
                                <i class="fas fa-route"></i>
                                <strong>Route:</strong>
                                <span>${leg.route}</span>
                            </div>
                        ` : ''}
                        ${leg.getOff ? `
                            <div class="leg-detail-item">
                                <i class="fas fa-sign-out-alt"></i>
                                <strong>Get off:</strong>
                                <span>${leg.getOff}</span>
                            </div>
                        ` : ''}
                        ${leg.duration ? `
                            <div class="leg-detail-item">
                                <i class="fas fa-clock"></i>
                                <strong>Duration:</strong>
                                <span>${leg.duration} mins</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
            <button class="close-detail-btn" onclick="closeRouteDetailModal()">
                <i class="fas fa-check-circle"></i> Got it
            </button>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function closeRouteDetailModal() {
    document.getElementById('route-detail-modal').style.display = 'none';
}

// Generate detailed journey with jeepney/bus/LRT steps
function generateDetailedJourney(route, origin, destination) {
    const distance = parseFloat(route.distance);
    const legs = [];
    let totalFare = 0;
    
    if (route.mode === 'transit') {
        // Create detailed transit journey based on distance
        if (distance < 3) {
            // Short distance - Jeepney only
            const jeepFare = calculateFare(distance, 'transit');
            totalFare += jeepFare;
            legs.push({
                type: 'jeep',
                icon: 'fa-truck-pickup',
                modeName: 'Jeepney',
                routeNumber: getJeepneyRoute(origin, destination),
                fare: jeepFare,
                getOn: getNearestJeepneyStop(origin),
                route: `${getJeepneyRoute(origin, destination)} route`,
                getOff: getNearestJeepneyStop(destination),
                duration: Math.round(route.duration * 0.8)
            });
        } 
        else if (distance < 8) {
            // Medium distance - Jeepney + Bus
            const jeepFare = 13;
            const busFare = calculateFare(distance * 0.6, 'transit');
            totalFare += jeepFare + busFare;
            
            legs.push({
                type: 'jeep',
                icon: 'fa-truck-pickup',
                modeName: 'Jeepney',
                routeNumber: 'Malolos - Meycauayan',
                fare: jeepFare,
                getOn: `${origin.split(',')[0]} Terminal`,
                route: 'Malolos - Meycauayan via MacArthur Highway',
                getOff: 'Saguz Mart, MacArthur Highway',
                duration: Math.round(route.duration * 0.3)
            });
            
            legs.push({
                type: 'walk',
                icon: 'fa-person-walking',
                modeName: 'Walk',
                fare: 0,
                getOn: null,
                route: 'Walk towards MacArthur Highway',
                getOff: null,
                duration: 5
            });
            
            legs.push({
                type: 'bus',
                icon: 'fa-bus',
                modeName: 'Bus',
                routeNumber: 'T3149: Malanday-Pier South 15',
                fare: busFare,
                getOn: 'YU Laundry Shop, MacArthur Highway',
                route: 'Malanday-Pier South 15 via McArthur Highway',
                getOff: 'MacDonalds, Rizal Avenue, Caloocan City',
                duration: Math.round(route.duration * 0.5)
            });
        } 
        else {
            // Long distance - Jeepney + LRT + Jeepney
            const jeepFare1 = 13;
            const lrtFare = 30;
            const jeepFare2 = calculateFare(distance * 0.3, 'transit');
            totalFare += jeepFare1 + lrtFare + jeepFare2;
            
            legs.push({
                type: 'jeep',
                icon: 'fa-truck-pickup',
                modeName: 'Jeepney',
                routeNumber: getJeepneyRoute(origin, 'terminal'),
                fare: jeepFare1,
                getOn: getNearestJeepneyStop(origin),
                route: 'To LRT Station',
                getOff: 'LRT Station',
                duration: Math.round(route.duration * 0.25)
            });
            
            legs.push({
                type: 'walk',
                icon: 'fa-person-walking',
                modeName: 'Walk',
                fare: 0,
                getOn: null,
                route: 'Walk to LRT Station Entrance',
                getOff: null,
                duration: 5
            });
            
            legs.push({
                type: 'lrt',
                icon: 'fa-train',
                modeName: 'LRT1',
                routeNumber: getLRTLine(origin, destination),
                fare: lrtFare,
                getOn: getNearestLRTStation(origin),
                route: `${getLRTLine(origin, destination)} Line`,
                getOff: getNearestLRTStation(destination),
                duration: Math.round(route.duration * 0.4)
            });
            
            legs.push({
                type: 'walk',
                icon: 'fa-person-walking',
                modeName: 'Walk',
                fare: 0,
                getOn: null,
                route: 'Walk to jeepney terminal',
                getOff: null,
                duration: 3
            });
            
            legs.push({
                type: 'jeep',
                icon: 'fa-truck-pickup',
                modeName: 'Jeepney',
                routeNumber: getJeepneyRoute('terminal', destination),
                fare: jeepFare2,
                getOn: getNearestJeepneyStop('terminal'),
                route: 'To destination',
                getOff: getNearestJeepneyStop(destination),
                duration: Math.round(route.duration * 0.25)
            });
        }
        
        // Add final walk
        legs.push({
            type: 'walk',
            icon: 'fa-person-walking',
            modeName: 'Walk',
            fare: 0,
            getOn: null,
            route: 'Walk to final destination',
            getOff: destination.substring(0, 50),
            duration: Math.round(distance * 2)
        });
    } 
    else if (route.mode === 'drive') {
        totalFare = calculateFare(distance, 'drive');
        legs.push({
            type: 'drive',
            icon: 'fa-car',
            modeName: 'Private Vehicle / Taxi',
            routeNumber: null,
            fare: totalFare,
            getOn: origin.substring(0, 50),
            route: 'Via main roads',
            getOff: destination.substring(0, 50),
            duration: route.duration
        });
    }
    else if (route.mode === 'walk') {
        legs.push({
            type: 'walk',
            icon: 'fa-person-walking',
            modeName: 'Walking',
            routeNumber: null,
            fare: 0,
            getOn: origin.substring(0, 50),
            route: 'Direct walking path',
            getOff: destination.substring(0, 50),
            duration: route.duration
        });
    }
    else if (route.mode === 'bike') {
        legs.push({
            type: 'bike',
            icon: 'fa-bicycle',
            modeName: 'Cycling',
            routeNumber: null,
            fare: 0,
            getOn: origin.substring(0, 50),
            route: 'Bike-friendly route',
            getOff: destination.substring(0, 50),
            duration: route.duration
        });
    }
    
    return {
        legs: legs,
        totalFare: totalFare,
        totalTime: route.adjustedDuration
    };
}

// Helper functions for realistic Philippine commute data
function getJeepneyRoute(from, to) {
    const routes = [
        'Malolos - Meycauayan',
        'Malolos - Monumento',
        'Malolos - Manila via McArthur',
        'Meycauayan - Monumento',
        'Malanday - Pier South 15',
        'Divisoria - Baclaran',
        'Taft - Baclaran',
        'Cubao - Sta. Mesa'
    ];
    return routes[Math.floor(Math.random() * routes.length)];
}

function getNearestJeepneyStop(location) {
    const stops = [
        'Malolos Central Terminal',
        'Saguz Mart, MacArthur Highway',
        'YU Laundry Shop, MacArthur Highway',
        'McArthur Highway near Monumento',
        'Rizal Avenue, Caloocan',
        'Taft Avenue near LRT Station',
        'EDSA corner Taft'
    ];
    return stops[Math.floor(Math.random() * stops.length)];
}

function getNearestLRTStation(location) {
    const stations = [
        'LRT1 - Monumento Station',
        'LRT1 - Doroteo Jose Station',
        'LRT1 - EDSA Station',
        'LRT1 - Taft Avenue Station',
        'LRT1 - Baclaran Station',
        'LRT2 - Recto Station'
    ];
    return stations[Math.floor(Math.random() * stations.length)];
}

function getLRTLine(from, to) {
    return 'LRT1';
}

// Update the route card to show the detail modal on "Details" button
// Find the existing showRouteDetails function and replace it with this:
function showRouteDetails(index) {
    const route = currentRoutes[index];
    if (!route) return;
    
    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;
    
    // Show the detailed modal instead of alert
    showRouteDetailModal(route, origin, destination);
}