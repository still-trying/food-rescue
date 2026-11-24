import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_CATEGORIES = new Set([
  'cooked_meals',
  'bakery',
  'groceries',
  'fruits_vegetables',
  'beverages',
  'other',
])

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])

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
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? ''

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

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

    const body = (await req.json()) as {
      imageBase64?: unknown
      mimeType?: unknown
    }

    const imageBase64 =
      typeof body.imageBase64 === 'string' ? body.imageBase64 : ''
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : ''

    if (!imageBase64 || imageBase64.length > 4_000_000 || !ALLOWED_MIMES.has(mimeType)) {
      return new Response(JSON.stringify({ error: 'Invalid image payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const prompt = `Analyze this surplus food image for a food-rescue donation listing.
Respond ONLY with valid JSON matching:
{
  "isFood": boolean,
  "title": string (concise food name, <= 60 chars),
  "category": "cooked_meals" | "bakery" | "groceries" | "fruits_vegetables" | "beverages" | "other",
  "quantity": string (estimated servings or weight, <= 40 chars),
  "description": string (short factual description + visible dietary/allergen cues, <= 200 chars),
  "safetyNotes": string (brief storage/allergen reminder, <= 120 chars)
}`

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: imageBase64 } },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
      }
    )

    if (!geminiRes.ok) {
      return new Response(JSON.stringify({ error: 'Vision analysis failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const geminiData = (await geminiRes.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
      }>
    }

    const rawText =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
    const parsed = JSON.parse(rawText) as Record<string, unknown>

    const safePayload = {
      isFood: typeof parsed.isFood === 'boolean' ? parsed.isFood : true,
      title: typeof parsed.title === 'string' ? parsed.title.slice(0, 100) : '',
      category:
        typeof parsed.category === 'string' && ALLOWED_CATEGORIES.has(parsed.category)
          ? parsed.category
          : 'other',
      quantity:
        typeof parsed.quantity === 'string' ? parsed.quantity.slice(0, 100) : '',
      description:
        typeof parsed.description === 'string'
          ? parsed.description.slice(0, 1000)
          : '',
      safetyNotes:
        typeof parsed.safetyNotes === 'string'
          ? parsed.safetyNotes.slice(0, 200)
          : '',
    }

    return new Response(JSON.stringify(safePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

