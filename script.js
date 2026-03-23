// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// Login function
function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (username && password) {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('planner-section').style.display = 'block';
        document.getElementById('user-info').innerHTML = `Welcome, ${username}!`;
    } else {
        alert('Please enter username and password');
    }
}

// Route planning function
async function planRoute() {
    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;
    
    if (!origin || !destination) {
        alert('Please enter both origin and destination');
        return;
    }
    
    try {
        // Fetch route from backend
        const response = await axios.post(`${API_BASE_URL}/plan-route`, {
            origin: origin,
            destination: destination
        });
        
        displayRoutes(response.data);
    } catch (error) {
        console.error('Error planning route:', error);
        alert('Error planning route. Please try again.');
    }
}

// Display route comparison
function displayRoutes(data) {
    const container = document.getElementById('route-comparison');
    container.innerHTML = '<h3>Route Comparison</h3>';
    
    data.routes.forEach((route, index) => {
        const routeCard = document.createElement('div');
        routeCard.className = 'route-card';
        routeCard.innerHTML = `
            <h4>Route ${index + 1}</h4>
            <p>🚗 Distance: ${route.distance}</p>
            <p>⏱️ Time: ${route.duration}</p>
            <p>📊 Traffic: ${route.traffic}</p>
            <button onclick="selectRoute(${index})">Select Route</button>
        `;
        container.appendChild(routeCard);
    });
    
    // Display weather warning
    if (data.weather.alert) {
        const weatherDiv = document.getElementById('weather-warning');
        weatherDiv.innerHTML = `
            <div class="weather-warning">
                ⚠️ Weather Alert: ${data.weather.alert}
            </div>
        `;
    }
}

// Select and display route on map
function selectRoute(routeIndex) {
    console.log(`Route ${routeIndex + 1} selected`);
    // TODO: Implement map display with Mapbox
    alert(`Route ${routeIndex + 1} selected! Map integration coming soon.`);
}