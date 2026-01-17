// Vercel Serverless Function: Health Check
// Endpoint: GET /api/health

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Return health check response
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'busschema-app',
    environment: process.env.VERCEL_ENV || 'development'
  });
}
