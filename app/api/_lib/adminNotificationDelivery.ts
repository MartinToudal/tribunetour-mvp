import { createClient } from '@supabase/supabase-js';
import { connect } from 'node:http2';
import { createSign } from 'node:crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apnsKeyId = process.env.APNS_KEY_ID;
const apnsTeamId = process.env.APNS_TEAM_ID;
const apnsTopic = process.env.APNS_TOPIC ?? 'everystadium.Tribunetour';
const apnsPrivateKey = process.env.APNS_PRIVATE_KEY?.replaceAll('\\n', '\n');
const useApnsSandbox = process.env.APNS_USE_SANDBOX === 'true';

const apnsEndpoint = useApnsSandbox ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';

type PushSummary = {
  sent: number;
  skippedReason?: string;
  failedTokens: string[];
};

type PushTarget = {
  device_token: string;
  user_id: string;
};

export const packLabels: Record<string, string> = {
  germany_top_3: 'Tyskland',
  england_top_4: 'England',
  italy_top_3: 'Italien',
  spain_top_4: 'Spanien',
  france_top_3: 'Frankrig',
  premium_full: 'Alle premium-pakker',
};

export async function sendPremiumRequestPushNotifications(params: {
  requestId: string;
  targetPackKey: string;
  requesterEmail: string;
}) : Promise<PushSummary> {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return { sent: 0, skippedReason: 'service_role_not_configured', failedTokens: [] };
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: adminRows, error: adminError } = await serviceClient
    .from('admin_users')
    .select('user_id');

  if (adminError) {
    console.error('Unable to load admin users for push notifications', adminError);
    return { sent: 0, skippedReason: 'admin_lookup_failed', failedTokens: [] };
  }

  const userIds = Array.from(new Set((adminRows ?? []).map((row) => row.user_id).filter(Boolean)));
  if (userIds.length === 0) {
    return { sent: 0, skippedReason: 'no_admin_users', failedTokens: [] };
  }

  const { data: tokenRows, error: tokenError } = await serviceClient
    .from('admin_device_tokens')
    .select('device_token,user_id')
    .eq('is_active', true)
    .in('user_id', userIds);

  if (tokenError) {
    console.error('Unable to load admin device tokens', tokenError);
    return { sent: 0, skippedReason: 'token_lookup_failed', failedTokens: [] };
  }

  const pushTargets = ((tokenRows ?? []) as PushTarget[]).filter((row) => row.device_token && row.user_id);
  if (pushTargets.length === 0) {
    return { sent: 0, skippedReason: 'no_active_devices', failedTokens: [] };
  }

  if (!apnsKeyId || !apnsTeamId || !apnsPrivateKey) {
    return { sent: 0, skippedReason: 'apns_not_configured', failedTokens: [] };
  }

  const badgeCounts = new Map<string, number>();
  for (const userId of userIds) {
    const { count, error } = await serviceClient
      .from('admin_notifications')
      .select('*', { head: true, count: 'exact' })
      .eq('user_id', userId)
      .eq('is_actioned', false);

    if (error) {
      console.error('Unable to calculate admin badge count', userId, error);
      badgeCounts.set(userId, 1);
    } else {
      badgeCounts.set(userId, count ?? 0);
    }
  }

  const pushJwt = createApnsJwt();
  const packLabel = packLabels[params.targetPackKey] ?? params.targetPackKey;
  const title = 'Ny premium-anmodning';
  const body = `${params.requesterEmail} vil have adgang til ${packLabel}.`;

  let sent = 0;
  const failedTokens: string[] = [];

  for (const target of pushTargets) {
    const badge = badgeCounts.get(target.user_id) ?? 1;
    const result = await sendApnsPush({
      jwt: pushJwt,
      deviceToken: target.device_token,
      badge,
      title,
      body,
      payload: {
        type: 'premium_access_request',
        request_id: params.requestId,
        pack_key: params.targetPackKey,
      },
    });

    if (result.ok) {
      sent += 1;
      continue;
    }

    failedTokens.push(target.device_token);
    console.error('APNs push failed', result.status, result.reason);

    if (shouldDeactivateToken(result.status, result.reason)) {
      await serviceClient
        .from('admin_device_tokens')
        .update({ is_active: false })
        .eq('device_token', target.device_token);
    }
  }

  return { sent, failedTokens };
}

function createApnsJwt() {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({
    alg: 'ES256',
    kid: apnsKeyId,
  }));
  const claims = base64UrlEncode(JSON.stringify({
    iss: apnsTeamId,
    iat: issuedAt,
  }));
  const unsignedToken = `${header}.${claims}`;
  const signer = createSign('SHA256');
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(apnsPrivateKey!);
  return `${unsignedToken}.${base64UrlEncode(signature)}`;
}

async function sendApnsPush(params: {
  jwt: string;
  deviceToken: string;
  badge: number;
  title: string;
  body: string;
  payload: Record<string, string>;
}): Promise<{ ok: boolean; status: number; reason?: string }> {
  const body = JSON.stringify({
    aps: {
      alert: {
        title: params.title,
        body: params.body,
      },
      badge: params.badge,
      sound: 'default',
    },
    ...params.payload,
  });

  return new Promise((resolve) => {
    const client = connect(apnsEndpoint);
    client.on('error', (error) => {
      console.error('APNs connection error', error);
      resolve({ ok: false, status: 0, reason: 'connection_error' });
    });

    const request = client.request({
      ':method': 'POST',
      ':path': `/3/device/${params.deviceToken}`,
      authorization: `bearer ${params.jwt}`,
      'apns-topic': apnsTopic,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    });

    let status = 0;
    let responseText = '';

    request.setEncoding('utf8');
    request.on('response', (headers) => {
      status = Number(headers[':status'] ?? 0);
    });
    request.on('data', (chunk) => {
      responseText += chunk;
    });
    request.on('end', () => {
      client.close();
      if (status >= 200 && status < 300) {
        resolve({ ok: true, status });
        return;
      }

      let reason: string | undefined;
      try {
        const parsed = JSON.parse(responseText) as { reason?: string };
        reason = parsed.reason;
      } catch {
        reason = responseText || 'unknown_error';
      }

      resolve({ ok: false, status, reason });
    });
    request.on('error', (error) => {
      client.close();
      console.error('APNs request error', error);
      resolve({ ok: false, status: 0, reason: 'request_error' });
    });
    request.end(body);
  });
}

function shouldDeactivateToken(status: number, reason?: string) {
  if (status === 410) {
    return true;
  }
  if (status !== 400 || !reason) {
    return false;
  }
  return ['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic'].includes(reason);
}

function base64UrlEncode(input: string | Buffer) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/g, '');
}
