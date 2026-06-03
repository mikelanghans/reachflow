// api/stripe/create-checkout.js
// Creates a Stripe Checkout session and returns the URL.
// Frontend redirects the user to session.url to enter payment details.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  const PRICE_IDS = {
    starter:     process.env.STRIPE_PRICE_STARTER,
    pro:         process.env.STRIPE_PRICE_PRO,
    agency_plus: process.env.STRIPE_PRICE_AGENCY_PLUS,
  }

  const { plan, email, agency_id } = req.body
  const priceId = PRICE_IDS[plan]

  if (!priceId) {
    return res.status(400).json({ error: `Unknown plan: ${plan}` })
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode:               'subscription',
      payment_method_types: ['card'],
      customer_email:     email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url:        `${process.env.APP_URL}/settings?upgraded=true&plan=${plan}`,
      cancel_url:         `${process.env.APP_URL}/settings?cancelled=true`,
      metadata:           { agency_id, plan },
      subscription_data:  { metadata: { agency_id, plan } },
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return res.status(500).json({ error: err.message })
  }
}
