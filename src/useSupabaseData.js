/**
 * useSupabaseData
 *
 * Fetches all app data from Supabase on mount, keeps it in React state,
 * and exposes helpers to write changes back. All components that previously
 * used useLocalStorage("rf_clients", ...) etc. call this hook from App.jsx
 * and receive the same shape of data they already expect.
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase, logActivity as dbLog } from './supabase'

export function useSupabaseData(agencyId) {
  const [clients,   setClientsState]   = useState([])
  const [campaigns, setCampaignsState] = useState([])
  const [leads,     setLeadsState]     = useState([])
  const [activity,  setActivityState]  = useState([])
  const [brand,     setBrandState]     = useState({ name: 'ReachFlow', tagline: 'Agency Console', color: '#2dce98', logoUrl: '' })
  const [loading,   setLoading]        = useState(true)
  const [error,     setError]          = useState(null)

  // ── Initial fetch ────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!agencyId) return
    setLoading(true)
    try {
      const [
        { data: agencyData },
        { data: clientData },
        { data: campaignData },
        { data: leadData },
        { data: messageData },
        { data: activityData },
      ] = await Promise.all([
        supabase.from('agencies').select('*').eq('id', agencyId).single(),
        supabase.from('clients').select('*').eq('agency_id', agencyId).order('created_at'),
        supabase.from('campaigns').select('*').eq('agency_id', agencyId).order('created_at'),
        supabase.from('leads').select('*').eq('agency_id', agencyId).order('created_at'),
        supabase.from('messages').select('*').eq('agency_id', agencyId).order('sent_at'),
        supabase.from('activity_log').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }).limit(50),
      ])

      // Transform DB rows into the shape the React app already uses
      if (agencyData) {
        setBrandState({
          name:     agencyData.brand_name   || 'ReachFlow',
          tagline:  agencyData.brand_tagline || 'Agency Console',
          color:    agencyData.brand_color   || '#2dce98',
          logoUrl:  agencyData.brand_logo_url || '',
        })
      }

      setClientsState((clientData || []).map(c => ({
        id: c.id, name: c.name, initials: c.initials, color: c.color,
        active: c.active, icp: c.icp, sequence: c.sequence,
        messages: c.messages_count, replies: c.replies_count,
        meetings: c.meetings_count, campaigns: 0,
        unipileAccountId: c.unipile_account_id,
        linkedinConnected: c.linkedin_connected,
      })))

      setCampaignsState((campaignData || []).map(c => ({
        id: c.id, name: c.name, client: clientMap[c.client_id] || c.client_id, client_id: c.client_id, status: c.status,
        channel: c.channel, flow: c.flow || [], reviewMode: c.review_mode,
        leads: c.leads_count, sent: c.sent_count,
        replies: c.replies_count, meetings: c.meetings_count,
      })))

      // Group messages by lead
      const messagesByLead = {}
      for (const m of (messageData || [])) {
        if (!messagesByLead[m.lead_id]) messagesByLead[m.lead_id] = []
        messagesByLead[m.lead_id].push({
          id: m.id, dir: m.direction, text: m.body,
          time: new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        })
      }

      const clientMap = {}
      for (const c of (clientData || [])) { clientMap[c.id] = c.name }

      setLeadsState((leadData || []).map(l => ({
        id: l.id, name: l.name, title: l.title, company: l.company,
        initials: l.initials, color: l.color || '#7d8590',
        clientColor: '#58a6ff', campaign: l.campaign_id, client_id: l.client_id, client: clientMap[l.client_id] || l.client_id,
        pipelineStage: l.pipeline_stage, days: l.days_in_stage,
        status: l.status, unread: l.unread, last: l.last_activity_at ? 'recently' : 'new',
        messages: messagesByLead[l.id] || [],
        triggerKeyword: l.trigger_keyword, triggerPost: l.trigger_post,
      })))

      setActivityState((activityData || []).map(a => ({
        id: a.id, type: a.type, message: a.message, meta: a.meta, time: a.created_at,
      })))

    } catch (err) {
      console.error('fetchAll error:', err)
      setError(err.message)
    }
    setLoading(false)
  }, [agencyId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Real-time subscription for new messages ──────────────────────────────────
  useEffect(() => {
    if (!agencyId) return
    const sub = supabase
      .channel('messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `agency_id=eq.${agencyId}` },
        (payload) => {
          const m = payload.new
          setLeadsState(ls => ls.map(l => l.id === m.lead_id
            ? { ...l, unread: m.direction === 'in', messages: [...l.messages, { id: m.id, dir: m.direction, text: m.body, time: new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }] }
            : l
          ))
        }
      )
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [agencyId])

  // ── Write helpers ─────────────────────────────────────────────────────────────
  const logActivity = useCallback(async (type, message, meta = {}) => {
    setActivityState(a => [{ id: Date.now(), type, message, meta, time: new Date().toISOString() }, ...a].slice(0, 50))
    await dbLog(agencyId, type, message, meta)
  }, [agencyId])

  // Clients
  const addClient = useCallback(async (client) => {
    const { data, error } = await supabase.from('clients').insert({
      agency_id: agencyId, name: client.name, initials: client.initials,
      color: client.color, active: true, icp: client.icp || {}, sequence: client.sequence || [],
    }).select().single()
    if (data) { setClientsState(cs => [...cs, { ...client, id: data.id }]); logActivity('client', `New client added: ${client.name}`) }
  }, [agencyId, logActivity])

  const updateClient = useCallback(async (client) => {
    await supabase.from('clients').update({
      name: client.name, initials: client.initials, color: client.color,
      active: client.active, icp: client.icp, sequence: client.sequence,
    }).eq('id', client.id)
    setClientsState(cs => cs.map(c => c.id === client.id ? client : c))
  }, [])

  const deleteClient = useCallback(async (id) => {
    await supabase.from('clients').delete().eq('id', id)
    setClientsState(cs => cs.filter(c => c.id !== id))
    setCampaignsState(cs => cs.filter(c => c.client !== id))
  }, [])

  // Campaigns
  const addCampaign = useCallback(async (campaign) => {
    const { data } = await supabase.from('campaigns').insert({
      agency_id: agencyId, client_id: campaign.clientId || null,
      name: campaign.name, status: 'active', channel: campaign.channel || 'linkedin',
      review_mode: false, flow: campaign.flow || [],
    }).select().single()
    if (data) { setCampaignsState(cs => [...cs, { ...campaign, id: data.id, status: 'active', leads: 0, sent: 0, replies: 0, meetings: 0 }]); logActivity('campaign', `Campaign created: ${campaign.name}`) }
  }, [agencyId, logActivity])

  const deleteCampaign = useCallback(async (id) => {
    await supabase.from('campaigns').delete().eq('id', id)
    setCampaignsState(cs => cs.filter(c => c.id !== id))
  }, [])

  const toggleCampaign = useCallback(async (id) => {
    const current = campaigns.find(c => c.id === id)
    const newStatus = current?.status === 'active' ? 'paused' : 'active'
    await supabase.from('campaigns').update({ status: newStatus }).eq('id', id)
    setCampaignsState(cs => cs.map(c => c.id === id ? { ...c, status: newStatus } : c))
  }, [campaigns])

  const toggleReviewMode = useCallback(async (id) => {
    const current = campaigns.find(c => c.id === id)
    const newMode = !current?.reviewMode
    await supabase.from('campaigns').update({ review_mode: newMode }).eq('id', id)
    setCampaignsState(cs => cs.map(c => c.id === id ? { ...c, reviewMode: newMode } : c))
  }, [campaigns])

  const saveFlow = useCallback(async (campaignId, flow) => {
    await supabase.from('campaigns').update({ flow }).eq('id', campaignId)
    setCampaignsState(cs => cs.map(c => c.id === campaignId ? { ...c, flow } : c))
    const camp = campaigns.find(c => c.id === campaignId)
    if (camp) logActivity('flow', `Sequence updated: ${camp.name}`)
  }, [campaigns, logActivity])

  // Leads
  const setLeads = useCallback(async (updaterOrArray) => {
    const next = typeof updaterOrArray === 'function' ? updaterOrArray(leads) : updaterOrArray
    // Only sync new leads (those without UUIDs are from import)
    const newLeads = next.filter(l => !leads.some(existing => existing.id === l.id) && typeof l.id === 'number')
    if (newLeads.length > 0) {
      const rows = newLeads.map(l => ({
        agency_id: agencyId, name: l.name, title: l.title, company: l.company,
        initials: l.initials, color: l.color, pipeline_stage: l.pipelineStage || 'prospecting',
        status: l.status || 'pending', campaign_id: null, client_id: null,
        trigger_keyword: l.triggerKeyword, trigger_post: l.triggerPost,
      }))
      await supabase.from('leads').insert(rows)
    }
    setLeadsState(next)
  }, [leads, agencyId])

  const updateLeadStage = useCallback(async (id, pipelineStage) => {
    await supabase.from('leads').update({ pipeline_stage: pipelineStage, days_in_stage: 0 }).eq('id', id)
    setLeadsState(ls => ls.map(l => l.id === id ? { ...l, pipelineStage, days: 0 } : l))
  }, [])

  const sendMessage = useCallback(async (leadId, body, channel = 'linkedin') => {
    const { data } = await supabase.from('messages').insert({
      agency_id: agencyId, lead_id: leadId, direction: 'out', body, channel,
    }).select().single()
    if (data) {
      setLeadsState(ls => ls.map(l => l.id === leadId ? {
        ...l, unread: false, last: 'Just now',
        messages: [...l.messages, { id: data.id, dir: 'out', text: body, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }],
      } : l))
    }
  }, [agencyId])

  const bookMeeting = useCallback(async (leadId) => {
    await supabase.from('leads').update({ status: 'meeting', pipeline_stage: 'converted', unread: false }).eq('id', leadId)
    setLeadsState(ls => ls.map(l => l.id === leadId ? { ...l, status: 'meeting', pipelineStage: 'converted', unread: false } : l))
    const lead = leads.find(l => l.id === leadId)
    if (lead) logActivity('meeting', `Meeting booked with ${lead.name} · ${lead.company}`)
  }, [leads, logActivity])

  // Brand
  const saveBrand = useCallback(async (newBrand) => {
    await supabase.from('agencies').update({
      brand_name: newBrand.name, brand_color: newBrand.color,
      brand_logo_url: newBrand.logoUrl, brand_tagline: newBrand.tagline,
    }).eq('id', agencyId)
    setBrandState(newBrand)
  }, [agencyId])

  return {
    // State
    clients, campaigns, leads, activity, brand, loading, error,
    // Helpers
    addClient, updateClient, deleteClient,
    addCampaign, deleteCampaign, toggleCampaign, toggleReviewMode, saveFlow,
    setLeads, updateLeadStage, sendMessage, bookMeeting,
    saveBrand, logActivity, refetch: fetchAll,
  }
}
