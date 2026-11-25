import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Verify caller JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as { query?: unknown }
    const rawQuery = typeof body.query === 'string' ? body.query.trim() : ''
    if (rawQuery.length < 2 || rawQuery.length > 250) {
      return new Response(JSON.stringify({ error: 'Invalid query length' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const queryKey = rawQuery.toLowerCase()
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    const { data: cached } = await adminClient
      .from('geocode_cache')
      .select('latitude, longitude, created_at')
      .eq('query_key', queryKey)
      .maybeSingle()

    if (cached) {
      return new Response(
        JSON.stringify({
          latitude: Number(cached.latitude),
          longitude: Number(cached.longitude),
          cached: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const params = new URLSearchParams({
      q: rawQuery,
      format: 'jsonv2',
      limit: '1',
    })

    const nominatimRes = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'FoodRescueApp/1.0 (https://github.com/still-trying/food-rescue)',
        },
      }
    )

    if (!nominatimRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Upstream geocoder failed' }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const results = (await nominatimRes.json()) as Array<{
      lat: string
      lon: string
    }>

    if (!results[0]) {
      return new Response(JSON.stringify({ latitude: null, longitude: null }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const latitude = Number(results[0].lat)
    const longitude = Number(results[0].lon)

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return new Response(JSON.stringify({ error: 'Invalid coordinates' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await adminClient.from('geocode_cache').upsert({
      query_key: queryKey,
      latitude,
      longitude,
    })

    return new Response(JSON.stringify({ latitude, longitude, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

