import { NextResponse } from 'next/server';

const DEFAULT_REPOSITORY = 'MartinToudal/tribunetour-mvp';
const DEFAULT_REF = 'main';

type DispatchOptions = {
  workflowId: string;
  inputs?: Record<string, string>;
};

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export function authorizeCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return json(500, { error: 'cron_secret_not_configured' });
  }

  const authorization = request.headers.get('authorization') ?? '';
  if (authorization !== `Bearer ${cronSecret}`) {
    return json(401, { error: 'unauthorized' });
  }

  return null;
}

export async function dispatchGitHubWorkflow({ workflowId, inputs }: DispatchOptions) {
  const token = process.env.GITHUB_WORKFLOW_DISPATCH_TOKEN?.trim();
  if (!token) {
    return json(500, { error: 'github_dispatch_token_not_configured' });
  }

  const repository = process.env.GITHUB_WORKFLOW_DISPATCH_REPO?.trim() || DEFAULT_REPOSITORY;
  const ref = process.env.GITHUB_WORKFLOW_DISPATCH_REF?.trim() || DEFAULT_REF;
  const dispatchUrl = `https://api.github.com/repos/${repository}/actions/workflows/${workflowId}/dispatches`;

  const response = await fetch(dispatchUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Tribunetour-Vercel-Cron',
    },
    body: JSON.stringify({
      ref,
      ...(inputs ? { inputs } : {}),
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const responseText = await response.text();
    console.error('GitHub workflow dispatch failed', {
      workflowId,
      repository,
      status: response.status,
      responseText,
    });
    return json(502, {
      error: 'github_workflow_dispatch_failed',
      workflow_id: workflowId,
      repository,
      status: response.status,
    });
  }

  return json(200, {
    ok: true,
    workflow_id: workflowId,
    repository,
    ref,
    dispatched: true,
  });
}
