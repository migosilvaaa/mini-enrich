import { getBearerToken, invalidateJwt } from './_lib/zoominfo-auth.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const OUTPUT_FIELDS = ['name', 'website', 'domainList'];

/**
 * Call ZoomInfo enrich/company API.
 */
async function callZoomInfoEnrich(companies, token) {
  return fetch('https://api.zoominfo.com/enrich/company', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      matchCompanyInput: companies.map((c) =>
        c.companyId
          ? { companyId: c.companyId }
          : { companyWebsite: `https://www.${c.domain}` }
      ),
      outputFields: OUTPUT_FIELDS,
    }),
  });
}

/**
 * Normalize a ZoomInfo company result.
 */
function normalizeCompany(input, ziData) {
  const key = input.companyId || input.domain || '';
  if (!ziData) {
    return { key, matched: false, name: null, website: null, domainList: [] };
  }
  return {
    key,
    matched: true,
    name: ziData.name || null,
    website: ziData.website || null,
    domainList: ziData.domainList || [],
  };
}

/**
 * Parse the request body.
 */
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  let body;
  try {
    body = await parseBody(req);
  } catch (err) {
    res.writeHead(400, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message }));
  }

  const { companies } = body;

  if (!Array.isArray(companies) || companies.length === 0) {
    res.writeHead(400, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: '`companies` must be a non-empty array' }));
  }

  if (companies.length > 25) {
    res.writeHead(400, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Maximum 25 companies per request' }));
  }

  let attempts = 0;
  while (attempts < 2) {
    attempts++;

    let token;
    try {
      token = await getBearerToken();
    } catch (err) {
      res.writeHead(500, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `Authentication failed: ${err.message}` }));
    }

    let ziRes;
    try {
      ziRes = await callZoomInfoEnrich(companies, token);
    } catch (err) {
      res.writeHead(502, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `ZoomInfo request failed: ${err.message}` }));
    }

    if (ziRes.status === 429) {
      res.writeHead(429, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'ZoomInfo rate limit exceeded. Retry shortly.' }));
    }

    if (ziRes.status === 401) {
      invalidateJwt();
      if (attempts < 2) continue;
      res.writeHead(401, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'ZoomInfo authentication failed. Check credentials.' }));
    }

    if (!ziRes.ok) {
      const errBody = await ziRes.text();
      res.writeHead(502, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `ZoomInfo error (${ziRes.status}): ${errBody}` }));
    }

    const ziData = await ziRes.json();
    const dataArray = ziData.data || [];

    // Normalize results — index-based match (ZoomInfo preserves input order)
    const results = companies.map((c, i) => normalizeCompany(c, dataArray[i] || null));

    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(results));
  }
}
