// api/stripe/webhook.js
// Handles Stripe subscription lifecycle events.
// Set this URL in Stripe Dashboard → Developers → Webhooks:
//   https://your-domain.com/api/stripe/webhook
//
// Events to enable:
//   customer.subscription.created
//   customer.subscription.updated
//   customer.subscription.deleted

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Map Stripe price IDs to plan names
const PLAN_BY_PRICE = {
  [process.env.STRIPE_PRICE_STARTER]:     'starter',
  [process.env.STRIPE_PRICE_PRO]:         'pro',
  [process.env.STRIPE_PRICE_AGENCY_PLUS]: 'agency_plus',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  const sig    = req.headers['stripe-signature']
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret)
  } catch (err) {
    console.error('Stripe signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook signature invalid: ${err.message}` })
  }

  const subscription = event.data.object
  const agencyId     = subscription.metadata?.agency_id

  if (!agencyId) {
    console.warn('No agency_id in subscription metadata')
    return res.status(200).json({ ok: true })
  }

  try {
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const priceId = subscription.items?.data?.[0]?.price?.id
      const plan    = PLAN_BY_PRICE[priceId] || 'starter'

      await supabase.from('agencies').update({
        plan,
        stripe_customer_id:     subscription.customer,
        stripe_subscription_id: subscription.id,
      }).eq('id', agencyId)

      console.log(`Agency ${agencyId} upgraded to ${plan}`)
    }

    if (event.type === 'customer.subscription.deleted') {
      await supabase.from('agencies').update({
        plan:                   'free',
        stripe_subscription_id: null,
      }).eq('id', agencyId)

      console.log(`Agency ${agencyId} subscription cancelled — downgraded to free`)
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Stripe webhook processing error:', err)
    return res.status(500).json({ error: err.message })
  }
}

// Vercel requires raw body for Stripe signature verification
export const config = { api: { bodyParser: false } }
