// api/linkedin/connect.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.UNIPILE_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'UNIPILE_API_KEY not configured' })
  }

  const { client_id } = req.body

  try {
    const response = await fetch('https://api49.unipile.com:17927/api/v1/hosted/accounts/link', {
      method: 'POST',
      headers: {
        'X-API-KEY':    apiKey,
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
      body: JSON.stringify({
        type: 'create',
        providers_filters: { include: ['LINKEDIN'] },
        api_url: 'https://api49.unipile.com:17927',
        expiresOn: new Date(Date.now() + 3600000).toISOString(),
        success_redirect_url: `${process.env.APP_URL}/onboarding/connected?client_id=${client_id || ''}`,
        failure_redirect_url: `${process.env.APP_URL}/onboarding/connect-failed`,
        notify_url: `${process.env.APP_URL}/api/unipile/webhook`,
      }),
    })

    const data = await response.json()
    console.log('Unipile hosted auth response:', JSON.stringify(data))

    if (!response.ok) {
      console.error('Unipile connect error:', data)
      return res.status(response.status).json({ error: 'Failed to create Unipile auth link', details: data })
    }

    const authUrl = data.url || data.object?.url
    return res.status(200).json({ auth_url: authUrl })
  } catch (err) {
    console.error('LinkedIn connect error:', err)
    return res.status(500).json({ error: 'LinkedIn connect failed', details: err.message })
  }
}