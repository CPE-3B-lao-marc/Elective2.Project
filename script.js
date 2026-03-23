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

// Initialize map with OpenStreetMap (more reliable)
function initMap() {
    // Check if map already exists
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
    const defaultLocation = [14.5995, 120.9842]; // Manila coordinates
    
    // Create map instance
    map = L.map('map').setView(defaultLocation, 12);
    
    // Use OpenStreetMap tiles (no API key needed, very reliable)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        minZoom: 3,
        errorTileUrl: 'https://via.placeholder.com/256?text=Map+Tile+Error'
    }).addTo(map);
    
    // Add scale control
    L.control.scale({ metric: true, imperial: false }).addTo(map);
    
    // Add zoom control
    L.control.zoom({ position: 'topright' }).addTo(map);
    
    console.log('Map initialized successfully!');
}

// Simulate traffic data based on time of day
function getTrafficData(route, timeOfDay) {
    // Traffic congestion simulation based on time
    const trafficLevels = {
        morning: { light: 0.2, moderate: 0.5, heavy: 0.3 },
        midday: { light: 0.5, moderate: 0.3, heavy: 0.2 },
        evening: { light: 0.1, moderate: 0.4, heavy: 0.5 },
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
    
    // Calculate delay multiplier
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
    
    const originalDuration = route.duration;
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
    // Setup mode tabs
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentMode = tab.dataset.mode;
            
            // Re-route if there are existing locations
            const origin = document.getElementById('origin').value;
            const destination = document.getElementById('destination').value;
            if (origin && destination) planRoute();
        });
    });
    
    // Load saved data
    loadSavedData();
    
    // Initialize map (but don't show until needed)
    // Map will be initialized when first route is planned
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

// Use current location
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

// Reverse geocode
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

// Geocode location
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

// Get route based on mode
async function getRoute(originCoords, destCoords, mode) {
    const modeMap = {
        drive: 'driving',
        transit: 'driving',
        walk: 'walking',
        bike: 'cycling'
    };
    
    const profile = modeMap[mode] || 'driving';
    
    const response = await axios.get(
        `https://router.project-osrm.org/route/v1/${profile}/${originCoords.lon},${originCoords.lat};${destCoords.lon},${destCoords.lat}`,
        { params: { overview: 'full', geometries: 'geojson' } }
    );
    
    return response.data;
}

// Get weather with forecast
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

// Clear map markers and routes
function clearMap() {
    currentMarkers.forEach(marker => {
        if (marker.remove) marker.remove();
    });
    if (selectedRouteLayer) {
        map.removeLayer(selectedRouteLayer);
    }
    currentMarkers = [];
}

// Display route on map with traffic color
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
        
        // Fit map to route bounds
        const bounds = selectedRouteLayer.getBounds();
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }
}

// Calculate estimated time of arrival
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
        // Initialize map if not already done
        if (!map) {
            initMap();
        } else {
            map.invalidateSize();
        }
        
        // Get coordinates
        const originCoords = await geocodeLocation(origin);
        const destCoords = await geocodeLocation(destination);
        
        clearMap();
        
        // Add markers with popups
        const startMarker = L.marker([originCoords.lat, originCoords.lon])
            .addTo(map)
            .bindPopup(`
                <strong>📍 Start</strong><br>
                ${origin.substring(0, 50)}<br>
                <small>${originCoords.lat.toFixed(4)}, ${originCoords.lon.toFixed(4)}</small>
            `);
        const endMarker = L.marker([destCoords.lat, destCoords.lon])
            .addTo(map)
            .bindPopup(`
                <strong>🎯 Destination</strong><br>
                ${destination.substring(0, 50)}<br>
                <small>Finding best route...</small>
            `);
        currentMarkers.push(startMarker, endMarker);
        
        // Center map on the two points
        const bounds = L.latLngBounds(
            [originCoords.lat, originCoords.lon],
            [destCoords.lat, destCoords.lon]
        );
        map.fitBounds(bounds, { padding: [50, 50] });
        
        // Get weather for destination
        const weather = await getWeather(destCoords.lat, destCoords.lon);
        
        // Get routes for all modes
        const modes = ['drive', 'transit', 'walk', 'bike'];
        const routes = [];
        
        for (const mode of modes) {
            try {
                const route = await getRoute(originCoords, destCoords, mode);
                if (route.routes && route.routes.length > 0) {
                    const distance = (route.routes[0].distance / 1000).toFixed(1);
                    const duration = Math.round(route.routes[0].duration / 60);
                    
                    // Get traffic data for drive mode only
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
        
        // Sort by adjusted duration
        routes.sort((a, b) => a.adjustedDuration - b.adjustedDuration);
        currentRoutes = routes;
        
        // Display routes with full details
        displayRoutes(routes, weather);
        
        // Update destination popup with ETA of best route
        if (routes.length > 0) {
            endMarker.setPopupContent(`
                <strong>🎯 Destination</strong><br>
                ${destination.substring(0, 50)}<br>
                <strong>🕐 ETA:</strong> ${routes[0].eta}<br>
                <strong>🚗 Best route:</strong> ${getModeName(routes[0].mode)} (${routes[0].adjustedDuration} mins)
            `);
            endMarker.openPopup();
            
            // Display best route on map
            displayRouteOnMap(routes[0].routeData, routes[0].trafficInfo);
        }
        
        // Update weather badge
        updateWeatherBadge(weather);
        
    } catch (error) {
        console.error('Error:', error);
        routeList.innerHTML = `<div class="loading" style="color: red;">❌ Error: ${error.message || 'Could not find routes. Please check locations and try again.'}</div>`;
    }
}

function getModeColor(mode) {
    const colors = {
        drive: '#3b82f6',
        transit: '#10b981',
        walk: '#f59e0b',
        bike: '#8b5cf6'
    };
    return colors[mode] || '#3b82f6';
}

function getModeIcon(mode) {
    const icons = {
        drive: 'fa-car',
        transit: 'fa-bus',
        walk: 'fa-person-walking',
        bike: 'fa-bicycle'
    };
    return icons[mode] || 'fa-route';
}

function getModeName(mode) {
    const names = {
        drive: '🚗 Driving',
        transit: '🚌 Transit',
        walk: '🚶 Walking',
        bike: '🚲 Cycling'
    };
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
        let warning = '';
        
        // Weather code mapping (WMO codes)
        if (weatherCode === 0) { condition = 'Clear sky'; icon = 'fa-sun'; }
        else if (weatherCode === 1) { condition = 'Mainly clear'; icon = 'fa-sun'; }
        else if (weatherCode === 2) { condition = 'Partly cloudy'; icon = 'fa-cloud-sun'; }
        else if (weatherCode === 3) { condition = 'Overcast'; icon = 'fa-cloud'; }
        else if (weatherCode >= 51 && weatherCode <= 67) { 
            condition = 'Rain expected'; icon = 'fa-cloud-rain'; 
            warning = '⚠️ Bring umbrella!';
        }
        else if (weatherCode >= 71 && weatherCode <= 77) { 
            condition = 'Snow expected'; icon = 'fa-snowflake'; 
            warning = '⚠️ Drive carefully!';
        }
        else if (weatherCode >= 80 && weatherCode <= 99) { 
            condition = 'Thunderstorm'; icon = 'fa-cloud-bolt'; 
            warning = '⚠️ Severe weather alert!';
        }
        
        badge.innerHTML = `
            <i class="fas ${icon}"></i> 
            ${temp}°C | ${condition}
            ${warning ? `<span style="color: #f59e0b; margin-left: 5px;">${warning}</span>` : ''}
        `;
    } else {
        badge.innerHTML = '<i class="fas fa-cloud-sun"></i> Loading weather...';
    }
}

function displayRoutes(routes, weather) {
    const container = document.getElementById('route-list');
    
    if (routes.length === 0) {
        container.innerHTML = '<div class="loading">No routes found for selected modes</div>';
        return;
    }
    
    container.innerHTML = routes.map((route, index) => `
        <div class="route-card" onclick="selectRoute(${index})" data-index="${index}" style="cursor: pointer;">
            <div class="route-icon ${route.mode}">
                <i class="fas ${getModeIcon(route.mode)}"></i>
            </div>
            <div class="route-details">
                <h4>${getModeName(route.mode)}</h4>
                <div class="route-stats">
                    <span><i class="fas fa-road"></i> ${route.distance} km</span>
                    <span><i class="fas fa-clock"></i> ${route.duration} mins</span>
                    ${route.adjustedDuration !== route.duration ? 
                        `<span style="color: ${route.trafficInfo?.color}">
                            <i class="fas ${route.trafficInfo?.icon}"></i> ${route.adjustedDuration} mins (with traffic)
                        </span>` : 
                        `<span><i class="fas fa-hourglass-half"></i> ${route.adjustedDuration} mins</span>`
                    }
                </div>
                <div class="route-stats" style="margin-top: 5px;">
                    <span><i class="fas fa-clock"></i> 🕐 ETA: ${route.eta}</span>
                    ${route.trafficInfo ? 
                        `<span><i class="fas fa-traffic-light"></i> ${getTrafficText(route.trafficInfo.status)} (${route.trafficInfo.period})</span>` : 
                        ''
                    }
                </div>
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
    `).join('');
}

function selectRoute(index) {
    const route = currentRoutes[index];
    if (!route) return;
    
    // Update selected style
    document.querySelectorAll('.route-card').forEach(card => card.classList.remove('selected'));
    document.querySelector(`.route-card[data-index="${index}"]`).classList.add('selected');
    
    // Display on map with traffic info
    displayRouteOnMap(route.routeData, route.trafficInfo);
    
    // Update destination popup with new ETA
    const destination = document.getElementById('destination').value;
    const endMarker = currentMarkers.find(m => m.getPopup && m.getPopup() && m.getPopup().getContent().includes('Destination'));
    if (endMarker) {
        endMarker.setPopupContent(`
            <strong>🎯 Destination</strong><br>
            ${destination.substring(0, 50)}<br>
            <strong>🕐 ETA:</strong> ${route.eta}<br>
            <strong>🚗 Selected:</strong> ${getModeName(route.mode)} (${route.adjustedDuration} mins)
        `);
        endMarker.openPopup();
    }
    
    // Scroll to map
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
            origin,
            destination,
            mode: route.mode,
            distance: route.distance,
            duration: route.duration,
            adjustedDuration: route.adjustedDuration,
            eta: route.eta,
            trafficStatus: route.trafficInfo?.status || 'unknown',
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
    
    let trafficMessage = '';
    if (route.trafficInfo) {
        trafficMessage = `
📊 TRAFFIC INFO:
   • Status: ${route.trafficInfo.status.toUpperCase()}
   • Time of day: ${route.trafficInfo.period}
   • Original time: ${route.duration} mins
   • With traffic: ${route.adjustedDuration} mins
   • Delay: +${route.adjustedDuration - route.duration} mins
`;
    }
    
    alert(`🚗 ROUTE DETAILS
━━━━━━━━━━━━━━━━━━━━━━━

📍 From: ${origin.substring(0, 50)}
📍 To: ${destination.substring(0, 50)}

🚀 Mode: ${getModeName(route.mode)}
📏 Distance: ${route.distance} km
⏱️ Duration: ${route.adjustedDuration} minutes
🕐 Estimated Arrival: ${route.eta}
${trafficMessage}
━━━━━━━━━━━━━━━━━━━━━━━
💡 Tip: Click on map routes to see more details`);
}