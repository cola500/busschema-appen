// Västtrafik OAuth2 Authentication Utility
// Used by Vercel Serverless Functions

const VASTTRAFIK_AUTH_URL = 'https://ext-api.vasttrafik.se/token';

/**
 * Get access token from Västtrafik API
 *
 * NOTE: This function does NOT cache tokens between requests.
 * Each serverless function invocation may get a new token.
 * This is acceptable for low-traffic applications.
 *
 * For high-traffic apps, consider using Vercel KV for caching.
 *
 * @returns {Promise<string>} Access token
 * @throws {Error} If authentication fails
 */
export async function getAccessToken() {
  const clientId = process.env.VASTTRAFIK_CLIENT_ID;
  const clientSecret = process.env.VASTTRAFIK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('VASTTRAFIK_CLIENT_ID and VASTTRAFIK_CLIENT_SECRET must be set in environment variables');
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
      const errorText = await response.text();
      throw new Error(`Auth failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.access_token) {
      throw new Error('No access token in response');
    }

    console.log('✅ Got new access token from Västtrafik');
    return data.access_token;
  } catch (error) {
    console.error('❌ Failed to get access token:', error.message);
    throw error;
  }
}
