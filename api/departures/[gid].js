// Vercel Serverless Function: Get departures for a specific stop
// Endpoint: GET /api/departures/:gid?limit=X&timeSpan=Y

import { getAccessToken } from '../lib/vasttrafikAuth.js';

const VASTTRAFIK_API_BASE = 'https://ext-api.vasttrafik.se/pr/v4';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract GID from dynamic route parameter
  const { gid } = req.query;

  // Extract query parameters with defaults
  const limit = req.query.limit || '20';
  const timeSpan = req.query.timeSpan || '60';

  // Validate GID parameter
  if (!gid) {
    return res.status(400).json({ error: 'GID parameter required' });
  }

  try {
    // Get access token from Västtrafik
    const token = await getAccessToken();

    // Make request to Västtrafik API
    const response = await fetch(
      `${VASTTRAFIK_API_BASE}/stop-areas/${gid}/departures?limit=${limit}&timeSpan=${timeSpan}`,
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
    console.error('Error fetching departures:', error);
    return res.status(500).json({
      error: 'Failed to fetch departures',
      message: error.message
    });
  }
}
