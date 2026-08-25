import { getUserAuth, jsonResponse, errorResponse, corsHeaders } from './_utils.js';

// GET /admin_users?token=ADMIN_TOKEN -> List all users
export async function onRequestGet(context) {
  const { request, env } = context;

  const auth = await getUserAuth(request, env);
  if (!auth.ok || !auth.isAdmin) {
    return errorResponse('无管理员权限', 403);
  }

  let usersMap = {};
  if (env.SPOOFER_DATA) {
    usersMap = await env.SPOOFER_DATA.get('users_meta', { type: 'json' }) || {};
  }

  const list = Object.values(usersMap).map(u => ({
    token: u.token,
    name: u.name || '未命名',
    createdAt: u.createdAt,
    expiresAt: u.expiresAt,
    enabled: u.enabled !== false,
    remainingDays: u.expiresAt ? Math.max(0, Math.ceil((u.expiresAt - Date.now()) / (86400 * 1000))) : null
  }));

  // Sort by createdAt desc
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return jsonResponse({
    ok: true,
    total: list.length,
    users: list
  });
}

// POST /admin_users?token=ADMIN_TOKEN -> Create a new user code
export async function onRequestPost(context) {
  const { request, env } = context;

  const auth = await getUserAuth(request, env);
  if (!auth.ok || !auth.isAdmin) {
    return errorResponse('无管理员权限', 403);
  }

  try {
    const data = await request.json();
    const token = (data.token || '').trim();
    const name = (data.name || '新用户').trim().slice(0, 30);
    const days = parseInt(data.days, 10); // e.g. 7, 30, 90, 365, 0 (permanent)

    if (!token) {
      return errorResponse('用户访问码 (Token) 不能为空', 400);
    }
    if (token.length < 3 || token.length > 32) {
      return errorResponse('访问码长度需在 3-32 位之间', 400);
    }

    let usersMap = {};
    if (env.SPOOFER_DATA) {
      usersMap = await env.SPOOFER_DATA.get('users_meta', { type: 'json' }) || {};
    }

    if (usersMap[token]) {
      return errorResponse('该访问码已存在，请更换其他码', 400);
    }

    const now = Date.now();
    const expiresAt = (days && days > 0) ? (now + days * 86400 * 1000) : null;

    const newUser = {
      token: token,
      name: name,
      createdAt: now,
      expiresAt: expiresAt,
      enabled: true
    };

    usersMap[token] = newUser;

    if (env.SPOOFER_DATA) {
      await env.SPOOFER_DATA.put('users_meta', JSON.stringify(usersMap));
    }

    return jsonResponse({
      ok: true,
      message: '用户访问码创建成功',
      user: newUser
    });
  } catch (err) {
    return errorResponse('参数解析失败: ' + err.message, 400);
  }
}

// PUT /admin_users?token=ADMIN_TOKEN -> Update / Extend / Toggle user
export async function onRequestPut(context) {
  const { request, env } = context;

  const auth = await getUserAuth(request, env);
  if (!auth.ok || !auth.isAdmin) {
    return errorResponse('无管理员权限', 403);
  }

  try {
    const data = await request.json();
    const token = (data.token || '').trim();

    if (!token) {
      return errorResponse('缺少用户 token 参数', 400);
    }

    let usersMap = {};
    if (env.SPOOFER_DATA) {
      usersMap = await env.SPOOFER_DATA.get('users_meta', { type: 'json' }) || {};
    }

    if (!usersMap[token]) {
      return errorResponse('用户不存在', 404);
    }

    const user = usersMap[token];
    if (typeof data.name === 'string') user.name = data.name.trim().slice(0, 30);
    if (typeof data.enabled === 'boolean') user.enabled = data.enabled;
    
    // Add extra days
    if (typeof data.addDays === 'number' && data.addDays > 0) {
      const baseTime = (user.expiresAt && user.expiresAt > Date.now()) ? user.expiresAt : Date.now();
      user.expiresAt = baseTime + data.addDays * 86400 * 1000;
    } else if (data.setPermanent === true) {
      user.expiresAt = null;
    }

    usersMap[token] = user;

    if (env.SPOOFER_DATA) {
      await env.SPOOFER_DATA.put('users_meta', JSON.stringify(usersMap));
    }

    return jsonResponse({
      ok: true,
      message: '用户信息已更新',
      user: user
    });
  } catch (err) {
    return errorResponse('操作失败: ' + err.message, 400);
  }
}

// DELETE /admin_users?token=ADMIN_TOKEN&user=TARGET_TOKEN -> Delete user
export async function onRequestDelete(context) {
  const { request, env } = context;

  const auth = await getUserAuth(request, env);
  if (!auth.ok || !auth.isAdmin) {
    return errorResponse('无管理员权限', 403);
  }

  const url = new URL(request.url);
  const targetToken = url.searchParams.get('user') || '';

  if (!targetToken) {
    return errorResponse('缺少目标 user 参数', 400);
  }

  if (env.SPOOFER_DATA) {
    let usersMap = await env.SPOOFER_DATA.get('users_meta', { type: 'json' }) || {};
    if (usersMap[targetToken]) {
      delete usersMap[targetToken];
      await env.SPOOFER_DATA.put('users_meta', JSON.stringify(usersMap));
      // Delete user's location and favorites data
      await env.SPOOFER_DATA.delete(`loc:${targetToken}`);
      await env.SPOOFER_DATA.delete(`fav:${targetToken}`);
    }
  }

  return jsonResponse({
    ok: true,
    message: '用户已彻底删除'
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}
