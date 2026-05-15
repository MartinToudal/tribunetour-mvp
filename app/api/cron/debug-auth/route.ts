import { createHash } from 'crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function fingerprint(value: string | undefined) {
  const normalized = (value ?? '').trim();
  if (!normalized) {
    return null;
  }

  return createHash('sha256').update(normalized).digest('hex').slice(0, 12);
}

export async function GET(request: Request) {
  const runtimeSecret = process.env.CRON_SECRET?.trim() ?? '';
  const authorization = request.headers.get('authorization') ?? '';
  const headerSecret = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';

  return NextResponse.json(
    {
      ok: true,
      runtimeSecretPresent: runtimeSecret.length > 0,
      runtimeSecretLength: runtimeSecret.length,
      runtimeSecretFingerprint: fingerprint(runtimeSecret),
      authorizationHeaderPresent: authorization.length > 0,
      authorizationHeaderLength: authorization.length,
      headerSecretLength: headerSecret.length,
      headerSecretFingerprint: fingerprint(headerSecret),
      secretsMatch: runtimeSecret.length > 0 && headerSecret.length > 0 && runtimeSecret === headerSecret,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
