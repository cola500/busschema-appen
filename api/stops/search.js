// Vercel Serverless Function: Search for stops/stations by name
// Endpoint: GET /api/stops/search?query=<search-term>

import { getAccessToken } from '../lib/vasttrafikAuth.js';

const VASTTRAFIK_API_BASE = 'https://ext-api.vasttrafik.se/pr/v4';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.query;

  // Validate query parameter
  if (!query) {
    return res.status(400).json({ error: 'Query parameter required' });
  }

  try {
    // Get access token from Västtrafik
    const token = await getAccessToken();

    // Make request to Västtrafik API
    const response = await fetch(
      `${VASTTRAFIK_API_BASE}/locations/by-text?q=${encodeURIComponent(query)}&limit=10`,
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
    console.error('Error searching stops:', error);
    return res.status(500).json({
      error: 'Failed to search stops',
      message: error.message
    });
  }
}
