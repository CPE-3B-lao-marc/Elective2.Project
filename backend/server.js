const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Sample route planning endpoint
app.post('/api/plan-route', async (req, res) => {
    const { origin, destination } = req.body;
    
    try {
        // This is sample data - will be replaced with actual API calls
        const routeData = {
            routes: [
                {
                    distance: '5.2 km',
                    duration: '15 mins',
                    traffic: 'Light'
                },
                {
                    distance: '6.1 km',
                    duration: '12 mins',
                    traffic: 'Moderate'
                },
                {
                    distance: '4.8 km',
                    duration: '18 mins',
                    traffic: 'Heavy'
                }
            ],
            weather: {
                alert: 'Light rain expected during your commute'
            }
        };
        
        res.json(routeData);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to plan route' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});