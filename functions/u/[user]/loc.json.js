import { DEFAULT_LOC, getUserAuth, jsonResponse, errorResponse, corsHeaders } from '../../_utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const auth = await getUserAuth(context);
  if (!auth.ok) {
    return errorResponse(auth.error || 'unauthorized', 403);
  }

  let loc = DEFAULT_LOC;
  const locKey = `loc:${auth.token}`;
  if (env.SPOOFER_DATA) {
    loc = await env.SPOOFER_DATA.get(locKey, { type: 'json' }) || DEFAULT_LOC;
  }

  // 智能微漂移 (±1.5米自然硬件级波动与海拔轻微波动)
  if (loc.jitter !== false) {
    const latRad = (loc.latitude || 39.9) * Math.PI / 180;
    const cosLat = Math.max(0.1, Math.cos(latRad));
    
    const now = Date.now() / 1000;
    const driftMetersLat = Math.sin(now / 40) * 1.0 + (Math.random() - 0.5) * 0.8;
    const driftMetersLng = Math.cos(now / 55) * 1.0 + (Math.random() - 0.5) * 0.8;
    
    const dLat = driftMetersLat / 111320;
    const dLng = driftMetersLng / (111320 * cosLat);
    const dAlt = Math.sin(now / 25) * 1.0 + (Math.random() - 0.5) * 0.6;
    const dHacc = Math.floor(Math.random() * 5) - 2;

    return jsonResponse({
      ...loc,
      latitude: Number((loc.latitude + dLat).toFixed(6)),
      longitude: Number((loc.longitude + dLng).toFixed(6)),
      altitude: Math.max(0, Number(((loc.altitude || 0) + dAlt).toFixed(1))),
      horizontalAccuracy: Math.max(5, (loc.horizontalAccuracy || 39) + dHacc),
      verticalAccuracy: loc.verticalAccuracy || 1000,
      _drift: true
    });
  }

  return jsonResponse(loc);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}
