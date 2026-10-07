require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Helper for HTTP Basic Auth header
const getAuthHeader = () => {
  const token = Buffer.from(
    `${process.env.YAPILY_APP_ID}:${process.env.YAPILY_APP_SECRET}`
  ).toString('base64');
  return { Authorization: `Basic ${token}` };
};

// 1. Fetch available institutions
app.get('/api/institutions', async (req, res) => {
  try {
    const response = await axios.get('https://api.yapily.com/institutions', {
      headers: { ...getAuthHeader(), Accept: 'application/json' }
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || error.message);
  }
});

// 2. Start AIS authorization request
app.post('/api/auth-request', async (req, res) => {
  const { institutionId } = req.body;
  try {
    const payload = {
      applicationUserId: 'dabi-lab3',
      institutionId: institutionId || 'modelo-sandbox',
      callback: process.env.CALLBACK_URL
    };
    
    console.log('Sending payload to Yapily:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
      'https://api.yapily.com/account-auth-requests',
      payload,
      {
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      }
    );

    console.log('Generated Authorisation URL:', response.data?.data?.authorisationUrl);
    res.json(response.data);
  } catch (error) {
    console.error('Yapily error response:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json(error.response?.data || error.message);
  }
});

// 3. Callback redirect handler: intercepts the browser return and bounces to the mobile scheme
// Catch if redirected to /callback
app.get('/callback', (req, res) => {
  const consent = req.query.consent || req.query.consentToken || '';
  if (consent) {
    return res.redirect(`dabi-lab3://callback?consent=${encodeURIComponent(consent)}`);
  }
  res.send('Callback received, but no consent token was provided.');
});

// Fallback: catch if Yapily redirects to the root domain /
app.get('/', (req, res) => {
  const consent = req.query.consent || req.query.consentToken || '';
  if (consent) {
    return res.redirect(`dabi-lab3://callback?consent=${encodeURIComponent(consent)}`);
  }
  res.send('Yapily AIS Proxy Server is Running');
});

// 4. Fetch accounts using the consent token
app.get('/api/accounts', async (req, res) => {
  const consentToken = req.headers['consent'];
  if (!consentToken) {
    return res.status(400).json({ error: 'Missing consent header' });
  }

  try {
    const response = await axios.get('https://api.yapily.com/accounts', {
      headers: {
        ...getAuthHeader(),
        consent: consentToken,
        Accept: 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || error.message);
  }
});

// 5. Fetch consent duration lease metadata
app.get('/api/consents/:id', async (req, res) => {
  try {
    const response = await axios.get(`https://api.yapily.com/consents/${req.params.id}`, {
      headers: { ...getAuthHeader(), Accept: 'application/json' }
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || error.message);
  }
});

// Fetch transactions for a specific account
app.get('/api/accounts/:accountId/transactions', async (req, res) => {
  const consentToken = req.headers['consent'];
  const { accountId } = req.params;

  if (!consentToken) {
    return res.status(400).json({ error: 'Missing consent header' });
  }

  try {
    const response = await axios.get(
      `https://api.yapily.com/accounts/${accountId}/transactions?limit=20&sort=-date`,
      {
        headers: {
          ...getAuthHeader(),
          consent: consentToken,
          Accept: 'application/json',
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});