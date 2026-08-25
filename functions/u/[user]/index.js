import { getUserAuth } from '../../_utils.js';

export async function onRequestGet(context) {
  const { request, env, params } = context;

  const auth = await getUserAuth(context);
  if (!auth.ok) {
    const errorHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>专属访问受限 - iOS Location Spoofer</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: rgba(30,30,35,0.85); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px); border-radius: 24px; padding: 36px 28px; text-align: center; max-width: 380px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.12); }
    .icon { font-size: 52px; margin-bottom: 16px; }
    h2 { margin: 0 0 10px; color: #fff; font-size: 22px; font-weight: 700; }
    p { margin: 0 0 24px; color: #8e8e93; font-size: 15px; line-height: 1.5; }
    .badge { display: inline-block; padding: 8px 16px; border-radius: 12px; font-size: 14px; font-weight: 600; background: rgba(255,59,48,0.15); color: #ff453a; border: 1px solid rgba(255,59,48,0.3); }
    .footer { margin-top: 24px; font-size: 12px; color: #636366; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔒</div>
    <h2>专属链接不可用</h2>
    <p>${auth.error || '该专属链接已被管理员暂停或已到期'}</p>
    <div class="badge">请联系管理员续期或重新授权</div>
    <div class="footer">iOS Location Spoofer System</div>
  </div>
</body>
</html>`;
    return new Response(errorHtml, {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  // Fetch static index.html from Cloudflare Pages Assets
  const response = await env.ASSETS.fetch(new Request(new URL('/', request.url), request));
  if (!response.ok) {
    return response;
  }

  const user = auth.user || {};
  const amapKey = env.AMAP_KEY || '';
  const configScript = `<script>window.__CFG__=${JSON.stringify({
    user: auth.token,
    userName: user.name || '专属用户',
    expiresAt: user.expiresAt,
    isUserView: true,
    amapKey: amapKey
  })};</script>`;

  return new HTMLRewriter()
    .on('head', {
      element(element) {
        element.append(configScript, { html: true });
      }
    })
    .transform(response);
}
