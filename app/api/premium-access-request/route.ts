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
    return json(500, { error: 'supabase_not_configured' });
  }

  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return json(401, { error: 'auth_required' });
  }

  const body = await request.json().catch(() => null) as {
    target_pack_key?: string;
    request_message?: string | null;
  } | null;

  const targetPackKey = body?.target_pack_key?.trim();
  const requestMessage = body?.request_message?.trim() || null;

  if (!targetPackKey) {
    return json(400, { error: 'invalid_pack_key' });
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

  const { data, error } = await supabase.rpc('submit_premium_access_request', {
    target_pack_key: targetPackKey,
    request_message: requestMessage,
  });

  if (error) {
    return json(400, { error: error.message });
  }

  const row = ((data as Array<{
    request_id?: string;
    pack_key?: string;
    status?: string;
    message?: string | null;
    created_at?: string;
  }> | null) ?? [])[0];

  const requestId = row?.request_id?.trim();
  if (!requestId) {
    return json(500, { error: 'invalid_payload' });
  }

  if (resendApiKey && notificationTo) {
    const packLabel = packLabels[targetPackKey] ?? targetPackKey;
    const adminUrl = new URL('/admin/premium', request.nextUrl.origin).toString();
    const userEmail = userData.user.email ?? 'Ukendt bruger';
    const createdAt = new Date(row.created_at ?? Date.now()).toLocaleString('da-DK', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Copenhagen',
    });

    const text = [
      `Ny premium-anmodning fra ${userEmail}`,
      '',
      `Pakke: ${packLabel}`,
      `Tidspunkt: ${createdAt}`,
      requestMessage ? `Besked: ${requestMessage}` : null,
      '',
      `Godkend anmodningen her: ${adminUrl}`,
    ].filter(Boolean).join('\n');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #162016;">
        <h1 style="font-size: 20px; margin: 0 0 12px;">Ny premium-anmodning</h1>
        <p><strong>Bruger:</strong> ${escapeHtml(userEmail)}</p>
        <p><strong>Pakke:</strong> ${escapeHtml(packLabel)}</p>
        <p><strong>Tidspunkt:</strong> ${escapeHtml(createdAt)}</p>
        ${requestMessage ? `<p><strong>Besked:</strong> ${escapeHtml(requestMessage)}</p>` : ''}
        <p>
          <a href="${adminUrl}" style="display: inline-block; padding: 10px 14px; background: #b8ff6a; color: #162016; border-radius: 999px; text-decoration: none; font-weight: 700;">
            Åbn premium admin
          </a>
        </p>
      </div>
    `;

    const emailResponse = await fetch('https://api.resend.com/emails', {
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

    if (!emailResponse.ok) {
      const responseText = await emailResponse.text();
      console.error('Premium access request email failed', emailResponse.status, responseText);
      return json(502, { error: 'email_failed', request_id: requestId });
    }
  }

  return json(200, { ok: true, request_id: requestId });
}
