// api/linkedin/connect.js
// Initiates LinkedIn OAuth via Unipile.
// Called when a user clicks "Connect LinkedIn" in the onboarding wizard.
// Returns a hosted_auth_url the frontend opens in a popup window.

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
    const response = await fetch('https://api.unipile.com:13465/api/v1/accounts', {
      method: 'POST',
      headers: {
        'X-API-KEY':    apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'LINKEDIN',
        // Redirect after successful OAuth — update to your real domain
        success_redirect_url: `${process.env.APP_URL}/onboarding/connected?client_id=${client_id || ''}`,
        failure_redirect_url: `${process.env.APP_URL}/onboarding/connect-failed`,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Unipile connect error:', data)
      return res.status(response.status).json({ error: 'Failed to create Unipile auth link', details: data })
    }

    // data.url is the hosted LinkedIn OAuth page Unipile generates
    return res.status(200).json({ auth_url: data.url, account_id: data.id })
  } catch (err) {
    console.error('LinkedIn connect error:', err)
    return res.status(500).json({ error: 'LinkedIn connect failed', details: err.message })
  }
}
