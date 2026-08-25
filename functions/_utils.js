export const DEFAULT_LOC = {
  latitude:           39.90872,
  longitude:          116.39748,
  altitude:           44,
  horizontalAccuracy: 39,
  verticalAccuracy:   1000,
  jitter:             true,
  address:            '北京市东城区 · 天安门广场'
};

export async function getUserAuth(contextOrRequest, env, params) {
  let request, envObj, paramsObj;
  if (contextOrRequest && contextOrRequest.request && contextOrRequest.env) {
    request = contextOrRequest.request;
    envObj = contextOrRequest.env;
    paramsObj = contextOrRequest.params || {};
  } else {
    request = contextOrRequest;
    envObj = env || {};
    paramsObj = params || {};
  }

  const url = new URL(request.url);
  // 1. Path param: /u/:user
  let token = paramsObj.user || '';
  if (!token) {
    // 2. Query param: ?token= or ?code=
    token = url.searchParams.get('token') || url.searchParams.get('code') || '';
  }

  const masterToken = envObj.ADMIN_TOKEN || envObj.TOKEN || '';

  // 1. If matches Master Admin Token -> Admin
  if (masterToken && token === masterToken) {
    return { ok: true, isAdmin: true, token: 'master', user: { name: '超级管理员', expiresAt: null } };
  }

  // 2. If no master token set and token is master/empty -> default admin
  if (!masterToken && (!token || token === 'master')) {
    return { ok: true, isAdmin: true, token: 'master', user: { name: '管理员', expiresAt: null } };
  }

  if (!token) {
    return { ok: false, isAdmin: false, error: '未提供访问专属码或凭证' };
  }

  // 3. Check KV users_meta table
  if (envObj.SPOOFER_DATA) {
    const usersMap = await envObj.SPOOFER_DATA.get('users_meta', { type: 'json' }) || {};
    const user = usersMap[token];
    if (user) {
      if (user.enabled === false) {
        return { ok: false, isAdmin: false, error: '该专属链接已被管理员暂停使用', user: user, isPaused: true };
      }
      if (user.expiresAt && user.expiresAt < Date.now()) {
        return { ok: false, isAdmin: false, error: '该专属链接已到期，请联系管理员续期', user: user, isExpired: true };
      }
      return { ok: true, isAdmin: false, token: token, user: user };
    }
  }

  return { ok: false, isAdmin: false, error: '专属链接不存在或已失效' };
}

export function authOk(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || url.searchParams.get('code') || '';
  const masterToken = env.ADMIN_TOKEN || env.TOKEN || '';
  return !masterToken || token === masterToken;
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    }
  });
}

export function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

/* ─── GCJ-02 (China Apple Maps) → WGS-84 (GPS) ──────────── */
export function outOfChina(lat, lng) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x, y) {
  let r = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  r += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  r += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
  r += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320.0 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
  return r;
}

function transformLng(x, y) {
  let r = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  r += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  r += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
  r += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
  return r;
}

export function gcj2wgs(lat, lng) {
  if (outOfChina(lat, lng)) return [lat, lng];
  const a = 6378245.0, ee = 0.00669342162296594323;
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1.0 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((a * (1.0 - ee)) / (magic * sqrtMagic) * Math.PI);
  dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * Math.PI);
  const mgLat = lat + dLat;
  const mgLng = lng + dLng;
  return [Number((lat * 2.0 - mgLat).toFixed(6)), Number((lng * 2.0 - mgLng).toFixed(6))];
}
