module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(200).json({ status: 'ERROR', reason: 'No API key found in environment' }); return; }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Say OK' }]
      })
    });
    const data = await response.json();
    res.status(200).json({ httpStatus: response.status, response: data });
  } catch(e) {
    res.status(200).json({ status: 'FETCH_ERROR', error: e.message });
  }
}
