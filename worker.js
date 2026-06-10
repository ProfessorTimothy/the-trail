// The Trail. Optional AI write-up Worker.
//
// Deploy this as a Cloudflare Worker, add ANTHROPIC_API_KEY as a secret,
// then paste the worker's URL into window.TRAIL_WRITER_URL in index.html.
//
// The worker accepts a POST with { title, author, year, note, me, prompt }
// and returns { description, tags, awards } as JSON. The prompt is built
// client-side so the worker stays a thin proxy.

const ALLOWED_ORIGINS = [
  // Add your GitHub Pages domain here once the site is live, e.g.:
  // "https://your-username.github.io"
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? (origin || "*") : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders(origin) });
    }

    let body;
    try { body = await request.json(); }
    catch (e) {
      return json({ error: "invalid JSON" }, 400, origin);
    }

    if (!body.prompt || typeof body.prompt !== "string") {
      return json({ error: "missing prompt" }, 400, origin);
    }
    if (body.prompt.length > 8000) {
      return json({ error: "prompt too long" }, 400, origin);
    }

    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return json({ error: "ANTHROPIC_API_KEY not configured on the worker" }, 500, origin);
    }

    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: body.prompt }]
        })
      });

      if (!r.ok) {
        const detail = await r.text();
        return json({ error: "anthropic returned " + r.status, detail }, 502, origin);
      }

      const data = await r.json();
      const text = (data.content || [])
        .map((i) => i.text || "")
        .join("\n")
        .replace(/```json|```/g, "")
        .trim();

      let parsed;
      try { parsed = JSON.parse(text); }
      catch (e) {
        return json({ error: "model did not return JSON", raw: text }, 502, origin);
      }

      return json({
        description: typeof parsed.description === "string" ? parsed.description : "",
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        awards: Array.isArray(parsed.awards) ? parsed.awards : []
      }, 200, origin);
    } catch (e) {
      return json({ error: "worker fetch failed", detail: e.message }, 502, origin);
    }
  }
};

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin)
    }
  });
}
