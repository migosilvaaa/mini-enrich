import { getBearerToken, hasCredentials } from './_lib/zoominfo-auth.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }

  if (req.method !== 'GET') {
    res.writeHead(405, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  // No credentials configured at all
  if (!hasCredentials()) {
    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'not_configured' }));
  }

  try {
    // Attempt to get a valid token (fetches JWT if needed)
    const token = await getBearerToken();

    // For username/password flow, getting the JWT is sufficient proof.
    // For a static bearer token, do a lightweight check against ZoomInfo.
    if (process.env.ZOOMINFO_BEARER_TOKEN) {
      const checkRes = await fetch('https://api.zoominfo.com/lookup/outputfields?includeAll=false', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (checkRes.status === 401) {
        res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          status: 'error',
          message: 'Bearer token is invalid or expired. Please generate a new one in the ZoomInfo Developer Portal.',
        }));
      }

      if (!checkRes.ok) {
        const body = await checkRes.text();
        res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          status: 'error',
          message: `ZoomInfo returned ${checkRes.status}: ${body}`,
        }));
      }
    }

    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'connected' }));
  } catch (err) {
    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'error', message: err.message }));
  }
}
