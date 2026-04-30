import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const notificationTo = process.env.PREMIUM_REQUEST_NOTIFY_TO;
const notificationFrom = process.env.PREMIUM_REQUEST_NOTIFY_FROM ?? 'Tribunetour <onboarding@resend.dev>';

const packLabels: Record<string, string> = {
  germany_top_3: 'Tyskland',
  england_top_4: 'England',
  italy_top_3: 'Italien',
  spain_top_4: 'Spanien',
  france_top_3: 'Frankrig',
  premium_full: 'Alle premium-pakker',
};

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return json(200, { ok: true, skipped: 'supabase_not_configured' });
  }

  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return json(401, { error: 'auth_required' });
  }

  const body = await request.json().catch(() => null) as { request_id?: string } | null;
  const requestId = body?.request_id?.trim();
  if (!requestId) {
    return json(400, { error: 'request_id_required' });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return json(401, { error: 'auth_required' });
  }

  const { data: accessRequest, error: requestError } = await supabase
    .from('premium_access_requests')
    .select('id, pack_key, status, message, created_at')
    .eq('id', requestId)
    .maybeSingle();

  if (requestError) {
    return json(500, { error: requestError.message });
  }

  if (!accessRequest) {
    return json(404, { error: 'request_not_found' });
  }

  if (!resendApiKey || !notificationTo) {
    console.warn('Premium request notification skipped: missing RESEND_API_KEY or PREMIUM_REQUEST_NOTIFY_TO');
    return json(200, { ok: true, skipped: 'email_not_configured' });
  }

  const packLabel = packLabels[accessRequest.pack_key] ?? accessRequest.pack_key;
  const adminUrl = new URL('/admin/premium', request.nextUrl.origin).toString();
  const userEmail = userData.user.email ?? 'Ukendt bruger';
  const message = accessRequest.message?.trim();
  const createdAt = new Date(accessRequest.created_at).toLocaleString('da-DK', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Copenhagen',
  });

  const text = [
    `Ny premium-anmodning fra ${userEmail}`,
    '',
    `Pakke: ${packLabel}`,
    `Tidspunkt: ${createdAt}`,
    message ? `Besked: ${message}` : null,
    '',
    `Godkend anmodningen her: ${adminUrl}`,
  ].filter(Boolean).join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #162016;">
      <h1 style="font-size: 20px; margin: 0 0 12px;">Ny premium-anmodning</h1>
      <p><strong>Bruger:</strong> ${escapeHtml(userEmail)}</p>
      <p><strong>Pakke:</strong> ${escapeHtml(packLabel)}</p>
      <p><strong>Tidspunkt:</strong> ${escapeHtml(createdAt)}</p>
      ${message ? `<p><strong>Besked:</strong> ${escapeHtml(message)}</p>` : ''}
      <p>
        <a href="${adminUrl}" style="display: inline-block; padding: 10px 14px; background: #b8ff6a; color: #162016; border-radius: 999px; text-decoration: none; font-weight: 700;">
          Åbn premium admin
        </a>
      </p>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: notificationFrom,
      to: notificationTo,
      subject: `Ny premium-anmodning: ${packLabel}`,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    console.error('Premium request notification failed', response.status, responseText);
    return json(502, { error: 'email_failed' });
  }

  return json(200, { ok: true });
}
