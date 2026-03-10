import { getBearerToken, invalidateJwt } from './_lib/zoominfo-auth.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const OUTPUT_FIELDS = [
  'firstName',
  'lastName',
  'jobTitle',
  'mobilePhone',
  'phone',
  'contactAccuracyScore',
  'companyName',
  'zoominfoCompanyId',
];

/**
 * Call ZoomInfo enrich/contact API with the given bearer token.
 * Returns the raw response.
 */
async function callZoomInfoEnrich(contacts, token) {
  return fetch('https://api.zoominfo.com/enrich/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      matchPersonInput: contacts.map((c) => ({ emailAddress: c.email })),
      outputFields: OUTPUT_FIELDS,
    }),
  });
}

/**
 * Normalize a ZoomInfo contact result into a consistent shape.
 */
function normalizeContact(email, ziData) {
  if (!ziData) {
    return {
      email,
      matched: false,
      jobTitle: null,
      mobilePhone: null,
      phone: null,
      companyName: null,
      zoominfoCompanyId: null,
      contactAccuracyScore: null,
    };
  }

  return {
    email,
    matched: true,
    jobTitle: ziData.jobTitle || null,
    mobilePhone: ziData.mobilePhone || null,
    phone: ziData.phone || null,
    companyName: ziData.companyName || null,
    zoominfoCompanyId: ziData.zoominfoCompanyId || null,
    contactAccuracyScore: ziData.contactAccuracyScore || null,
  };
}

/**
 * Parse the request body (supports both Buffer and string).
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
  // Handle preflight
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

  const { contacts } = body;

  if (!Array.isArray(contacts) || contacts.length === 0) {
    res.writeHead(400, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: '`contacts` must be a non-empty array' }));
  }

  if (contacts.length > 25) {
    res.writeHead(400, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Maximum 25 contacts per request' }));
  }

  // Attempt with retry on 401
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
      ziRes = await callZoomInfoEnrich(contacts, token);
    } catch (err) {
      res.writeHead(502, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `ZoomInfo request failed: ${err.message}` }));
    }

    // Pass through 429 so the frontend can retry with backoff
    if (ziRes.status === 429) {
      res.writeHead(429, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'ZoomInfo rate limit exceeded. Retry shortly.' }));
    }

    // On 401, invalidate cache and retry once
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

    // Build a map: email (lowercase) → ZoomInfo result
    const resultMap = {};
    const dataArray = ziData.data || [];
    for (const item of dataArray) {
      // ZoomInfo returns results in the same order as the input, but
      // match by email to be safe
      const emailKey = (item.email || item.emailAddress || '').toLowerCase();
      if (emailKey) resultMap[emailKey] = item;
    }

    // If ZoomInfo doesn't echo the email in output, fall back to index-based matching
    if (Object.keys(resultMap).length === 0 && dataArray.length > 0) {
      contacts.forEach((c, i) => {
        if (dataArray[i]) resultMap[c.email.toLowerCase()] = dataArray[i];
      });
    }

    // Normalize all contacts (including unmatched ones)
    const results = contacts.map((c) => {
      const key = c.email.toLowerCase();
      const ziContact = resultMap[key] || null;
      return normalizeContact(c.email, ziContact);
    });

    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(results));
  }
}
