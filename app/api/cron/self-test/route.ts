import { NextResponse } from 'next/server';
import { dispatchGitHubWorkflow } from '../../_lib/githubWorkflowDispatch';

export const runtime = 'nodejs';

const SELF_TEST_TOKEN = 'tt-self-test-20260515-rerun-3c6c5d2f7d5f4f0b8f2b62c1a42f91d6';

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  const token = request.headers.get('x-tribunetour-self-test')?.trim() ?? '';
  if (token !== SELF_TEST_TOKEN) {
    return json(401, { error: 'unauthorized' });
  }

  return dispatchGitHubWorkflow({
    workflowId: 'daily-fixture-check.yml',
  });
}
