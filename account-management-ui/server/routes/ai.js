/**
 * AI Routes  –  POST /api/ai/summarize
 * Calls OpenAI Chat Completions to summarise a list of interaction entries.
 * The OpenAI API key is read from process.env.OPENAI_API_KEY.
 */

const express = require('express');
const https = require('https');
const router = express.Router();

function callOpenAI(apiKey, prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a concise HR/account management assistant. ' +
            'Summarise the provided resource interaction log entries into clear, structured bullet points. ' +
            'Focus on key themes, action items, and notable patterns. ' +
            'Keep each bullet brief (one line). Use professional language. ' +
            'Group bullets under short headers like: Key Themes, Action Items, Notable Events. ' +
            'Return plain text with markdown-style headers (##) and bullet points (-).',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 600,
      temperature: 0.4,
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message || 'OpenAI error'));
          const text = parsed.choices?.[0]?.message?.content || '';
          resolve(text.trim());
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// POST /api/ai/summarize
router.post('/summarize', async (req, res) => {
  const { entries, fromDate, toDate } = req.body;

  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ ok: false, error: 'entries array required' });
  }

  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    return res.status(503).json({
      ok: false,
      error: 'OpenAI API key not configured. Set OPENAI_API_KEY environment variable on the server.',
    });
  }

  const dateRange = fromDate && toDate ? ` (${fromDate} to ${toDate})` : '';
  const lines = entries.map((e, i) => {
    const parts = [`${i + 1}. [${e.tag || 'General'}] ${e.title || '(untitled)'}`];
    if (e.body) parts.push(`   Notes: ${e.body}`);
    if (e.author) parts.push(`   By: ${e.author}`);
    return parts.join('\n');
  });

  const prompt =
    `Here are ${entries.length} resource interaction log entries${dateRange}:\n\n` +
    lines.join('\n\n') +
    '\n\nPlease provide a concise summary with key insights, patterns and action items.';

  try {
    const summary = await callOpenAI(apiKey, prompt);
    res.json({ ok: true, summary });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
