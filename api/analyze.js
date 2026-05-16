module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(500).json({ error: 'API key not configured' }); return; }

  const { entity, country, product, enduse, owners, biz, age, pay, qty, hist, sigs, ctx } = req.body;

  const systemPrompt = `You are RedFlag AI, an expert export compliance risk engine trained on BIS, OFAC, EAR, and ITAR frameworks. Analyze export transactions for behavioral red flags that name-match screening misses.

Based on your training knowledge, provide any known information about the company if it is a real well-known entity. For unknown companies, reason about existence based on the signals provided.

Output ONLY valid JSON, absolutely no markdown, no backticks, starting directly with {
{
  "overallRisk": "HIGH or MEDIUM or LOW",
  "riskScore": 0-100,
  "headline": "one sentence summary",
  "executiveSummary": "2-3 sentences",
  "companyMatches": [
    {
      "name": "company name as provided or variant",
      "address": "known address or null",
      "website": "known website or null",
      "owners": "known owners or null",
      "registrationInfo": "known registration info or null",
      "matchConfidence": "HIGH or MEDIUM or LOW",
      "notes": "any relevant notes about this entity"
    }
  ],
  "entityExists": "CONFIRMED or UNVERIFIED or LIKELY_SHELL or NOT_FOUND",
  "entityExistsReason": "brief explanation",
  "shellRisk": "HIGH or MEDIUM or LOW or CLEAR",
  "shellFindings": "specific findings",
  "companyViolations": "HIGH or MEDIUM or LOW or CLEAR",
  "companyViolationsDetail": "any known violations or enforcement actions",
  "ownerViolations": "HIGH or MEDIUM or LOW or CLEAR or UNKNOWN",
  "ownerViolationsDetail": "any known owner violations",
  "signals": [
    {"name": "signal name", "level": "HIGH or MEDIUM or LOW or CLEAR", "finding": "specific finding", "reasoning": "compliance significance"}
  ],
  "detailedReasoning": "4-5 sentences citing specific BIS red flag indicators and OFAC guidance",
  "recommendation": "specific analyst action",
  "regulatoryBasis": ["reg1", "reg2", "reg3"]
}
Include exactly 4 signals: Country Risk, Entity Verification, Transaction Behavior, End-Use Consistency.`;

  const userMsg = `Screen this export transaction:
COMPANY: ${entity}
OWNERS: ${owners || 'Not provided'}
COUNTRY: ${country}
PRODUCT: ${product}
END-USE: ${enduse}
BUSINESS TYPE: ${biz || 'Not provided'}
COMPANY AGE: ${age || 'Not provided'}
PAYMENT: ${pay || 'Not provided'}
QUANTITY: ${qty || 'Not provided'}
HISTORY: ${hist || 'Not provided'}
BEHAVIORAL FLAGS: ${sigs || 'None'}
CONTEXT: ${ctx || 'None'}`;

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
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error ? (data.error.message || JSON.stringify(data.error)) : JSON.stringify(data);
      res.status(response.status).json({ error: errMsg });
      return;
    }

    const textBlock = data.content.filter(function(b){ return b.type === 'text'; }).map(function(b){ return b.text; }).join('');
    const clean = textBlock.replace(/```json|```/g, '').trim();

    try {
      const parsed = JSON.parse(clean);
      res.status(200).json({ result: parsed });
    } catch(parseErr) {
      res.status(200).json({ error: 'Could not parse AI response. Raw: ' + clean.substring(0, 300) });
    }

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
