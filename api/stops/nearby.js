// Vercel Serverless Function: Search for nearby stops by coordinates
// Endpoint: GET /api/stops/nearby?latitude=<lat>&longitude=<lon>&limit=<number>

import { getAccessToken } from '../lib/vasttrafikAuth.js';

const VASTTRAFIK_API_BASE = 'https://ext-api.vasttrafik.se/pr/v4';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    // Get access token from Västtrafik
    const token = await getAccessToken();

    // Search within 1km radius
    const radiusInMeters = 1000;

    // Make request to Västtrafik API
    const response = await fetch(
      `${VASTTRAFIK_API_BASE}/locations/by-coordinates?latitude=${lat}&longitude=${lon}&radiusInMeters=${radiusInMeters}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Västtrafik API error: ${response.status}`, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Return successful response
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error searching nearby stops:', error);
    return res.status(500).json({
      error: 'Failed to search nearby stops',
      message: error.message
    });
  }
}
