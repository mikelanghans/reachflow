const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }

  const MAX_RETRIES = 3
  let lastError = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff: 1s, 2s, 4s
        await sleep(1000 * Math.pow(2, attempt - 1))
        console.log(`Retrying Claude API call, attempt ${attempt + 1}`)
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(req.body),
      })

      const data = await response.json()

      // Retry on 529 (overloaded) or 503 (service unavailable)
      if (response.status === 529 || response.status === 503) {
        console.warn(`Claude API returned ${response.status}, will retry...`)
        lastError = data
        continue
      }

      if (!response.ok) {
        return res.status(response.status).json(data)
      }

      return res.status(200).json(data)

    } catch (err) {
      console.error(`Claude proxy error on attempt ${attempt + 1}:`, err)
      lastError = { error: 'Claude API request failed', details: err.message }
    }
  }

  // All retries exhausted
  console.error('Claude API failed after all retries:', lastError)
  return res.status(529).json({ error: 'Claude API temporarily unavailable, please try again', details: lastError })
}
