import { getUserAuth, jsonResponse, errorResponse, corsHeaders } from './_utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const auth = await getUserAuth(request, env);
  if (!auth.ok) {
    return errorResponse(auth.error || 'unauthorized', 401);
  }

  return jsonResponse({
    ok: true,
    isAdmin: auth.isAdmin,
    name: auth.user ? auth.user.name : '',
    expiresAt: auth.user ? auth.user.expiresAt : null
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}
