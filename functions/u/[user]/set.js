import { DEFAULT_LOC, getUserAuth, jsonResponse, errorResponse, corsHeaders, gcj2wgs, outOfChina } from '../../_utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const auth = await getUserAuth(context);
  if (!auth.ok) {
    return errorResponse(auth.error || 'unauthorized', 403);
  }

  const url = new URL(request.url);
  const qLat = url.searchParams.get('lat') || url.searchParams.get('latitude') || url.searchParams.get('ll');
  const qLng = url.searchParams.get('lng') || url.searchParams.get('longitude') || url.searchParams.get('lon');
  const rawUrl = url.searchParams.get('url') || url.searchParams.get('text') || '';
  const name = url.searchParams.get('name') || url.searchParams.get('address') || url.searchParams.get('q') || url.searchParams.get('title') || 'Apple 地图选点';
  const coordType = (url.searchParams.get('coord_type') || 'gcj02').toLowerCase();

  let targetLat = null;
  let targetLng = null;

  if (qLat && qLng) {
    targetLat = parseFloat(qLat);
    targetLng = parseFloat(qLng);
  } else if (qLat && qLat.includes(',')) {
    const parts = qLat.split(',');
    targetLat = parseFloat(parts[0]);
    targetLng = parseFloat(parts[1]);
  } else if (rawUrl) {
    const llMatch = rawUrl.match(/[?&]ll=([-\d.]+),([-\d.]+)/i) || rawUrl.match(/([-\d.]+)\s*,\s*([-\d.]+)/);
    if (llMatch) {
      targetLat = parseFloat(llMatch[1]);
      targetLng = parseFloat(llMatch[2]);
    }
  }

  if (isNaN(targetLat) || isNaN(targetLng) || targetLat === null || targetLng === null) {
    return errorResponse('缺少有效的经纬度坐标', 400);
  }

  let wgsLat = targetLat;
  let wgsLng = targetLng;
  if (coordType === 'gcj02' || (!outOfChina(targetLat, targetLng) && coordType !== 'wgs84')) {
    const w = gcj2wgs(targetLat, targetLng);
    wgsLat = w[0];
    wgsLng = w[1];
  }

  let current = DEFAULT_LOC;
  const locKey = `loc:${auth.token}`;
  if (env.SPOOFER_DATA) {
    current = await env.SPOOFER_DATA.get(locKey, { type: 'json' }) || DEFAULT_LOC;
  }

  const updated = {
    ...current,
    latitude: wgsLat,
    longitude: wgsLng,
    address: name
  };

  if (env.SPOOFER_DATA) {
    await env.SPOOFER_DATA.put(locKey, JSON.stringify(updated));
  }

  return jsonResponse({
    ok: true,
    message: `📍 定位已成功锁定至：${name}`,
    name: name,
    wgs84: { latitude: wgsLat, longitude: wgsLng },
    original: { latitude: targetLat, longitude: targetLng, coord_type: coordType },
    loc: updated
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const auth = await getUserAuth(context);
  if (!auth.ok) {
    return errorResponse(auth.error || 'unauthorized', 403);
  }

  try {
    const data = await request.json();
    let current = DEFAULT_LOC;
    const locKey = `loc:${auth.token}`;

    if (env.SPOOFER_DATA) {
      current = await env.SPOOFER_DATA.get(locKey, { type: 'json' }) || DEFAULT_LOC;
    }

    const updated = { ...current };
    if (typeof data.latitude           === 'number')  updated.latitude           = data.latitude;
    if (typeof data.longitude          === 'number')  updated.longitude          = data.longitude;
    if (typeof data.altitude           === 'number')  updated.altitude           = data.altitude;
    if (typeof data.horizontalAccuracy === 'number')  updated.horizontalAccuracy = data.horizontalAccuracy;
    if (typeof data.verticalAccuracy   === 'number')  updated.verticalAccuracy   = data.verticalAccuracy;
    if (typeof data.jitter             === 'boolean') updated.jitter             = data.jitter;
    if (typeof data.address            === 'string')  updated.address            = data.address;

    if (env.SPOOFER_DATA) {
      await env.SPOOFER_DATA.put(locKey, JSON.stringify(updated));
    }

    return jsonResponse(updated);
  } catch (err) {
    return errorResponse('bad json');
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}
