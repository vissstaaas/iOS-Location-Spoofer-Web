import { getUserAuth, errorResponse, corsHeaders } from '../../_utils.js';

export async function onRequestGet(context) {
  const { request, env, params } = context;

  const auth = await getUserAuth(context);
  if (!auth.ok) {
    return errorResponse(auth.error || 'unauthorized', 403);
  }

  const url = new URL(request.url);
  const domain = url.origin;
  const userToken = auth.token;

  const moduleContent = `#!name=iOS Location Spoofer (${auth.user ? auth.user.name : userToken})
#!desc=iOS GPS 定位修改器 - 专属通道

[Script]
iOS Location Spoofer = type=http-response,pattern=^https?://.*\\.apple\\.com/clls/wloc,requires-body=1,binary-body-mode=1,max-size=1048576,script-path=${domain}/location-spoofer.js,argument=configUrl=${domain}/u/${userToken}/loc.json

[MITM]
hostname = %APPEND% *.apple.com
`;

  return new Response(moduleContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="ios-location-spoofer-${userToken}.sgmodule"`,
      ...corsHeaders()
    }
  });
}
