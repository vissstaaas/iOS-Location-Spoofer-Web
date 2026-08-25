import { getUserAuth, jsonResponse, errorResponse, corsHeaders } from '../_utils.js';

export async function onRequestDelete(context) {
  const { request, env, params } = context;

  const auth = await getUserAuth(request, env);
  if (!auth.ok) {
    return errorResponse(auth.error || 'unauthorized', 401);
  }

  const id = params.id;
  const favKey = auth.token === 'master' ? 'favorites' : `fav:${auth.token}`;
  
  if (env.SPOOFER_DATA) {
    let favs = await env.SPOOFER_DATA.get(favKey, { type: 'json' }) || [];
    favs = favs.filter(f => f.id !== id);
    await env.SPOOFER_DATA.put(favKey, JSON.stringify(favs));
  }

  return jsonResponse({ ok: true });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}
