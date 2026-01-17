import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Västtrafik API config
const VASTTRAFIK_AUTH_URL = 'https://ext-api.vasttrafik.se/token';
const VASTTRAFIK_API_BASE = 'https://ext-api.vasttrafik.se/pr/v4';

let accessToken = null;
let tokenExpiry = null;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173'
}));
app.use(express.json());

// Get access token from Västtrafik
async function getAccessToken() {
  // Return cached token if still valid
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const clientId = process.env.VASTTRAFIK_CLIENT_ID;
  const clientSecret = process.env.VASTTRAFIK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('VASTTRAFIK_CLIENT_ID and VASTTRAFIK_CLIENT_SECRET must be set in .env');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await fetch(VASTTRAFIK_AUTH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      throw new Error(`Auth failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    accessToken = data.access_token;
    // Set expiry to 5 minutes before actual expiry for safety
    tokenExpiry = Date.now() + ((data.expires_in - 300) * 1000);

    console.log('✅ Got new access token from Västtrafik');
    return accessToken;
  } catch (error) {
    console.error('❌ Failed to get access token:', error.message);
    throw error;
  }
}

// Search for stops/stations by name
app.get('/api/stops/search', async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter required' });
  }

  try {
    const token = await getAccessToken();
    const response = await fetch(
      `${VASTTRAFIK_API_BASE}/locations/by-text?q=${encodeURIComponent(query)}&limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error searching stops:', error);
    res.status(500).json({ error: 'Failed to search stops' });
  }
});

// Search for nearby stops by coordinates
app.get('/api/stops/nearby', async (req, res) => {
  const { latitude, longitude, limit = 10 } = req.query;

  // Validate required parameters
  if (!latitude || !longitude) {
    return res.status(400).json({
      error: 'Latitude and longitude parameters are required'
    });
  }

  // Validate coordinate values
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({
      error: 'Invalid latitude or longitude values'
    });
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({
      error: 'Latitude must be between -90 and 90, longitude between -180 and 180'
    });
  }

  try {
    const token = await getAccessToken();
    const response = await fetch(
      `${VASTTRAFIK_API_BASE}/locations/nearby?latitude=${lat}&longitude=${lon}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error searching nearby stops:', error);
    res.status(500).json({ error: 'Failed to search nearby stops' });
  }
});

// Get departures for a specific stop
app.get('/api/departures/:gid', async (req, res) => {
  const { gid } = req.params;
  const { limit = 20, timeSpan = 60 } = req.query;

  try {
    const token = await getAccessToken();
    const response = await fetch(
      `${VASTTRAFIK_API_BASE}/stop-areas/${gid}/departures?limit=${limit}&timeSpan=${timeSpan}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching departures:', error);
    res.status(500).json({ error: 'Failed to fetch departures' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚌 Busschema backend running on http://localhost:${PORT}`);
  console.log(`📍 Frontend URL: ${process.env.FRONTEND_URL}`);
});
