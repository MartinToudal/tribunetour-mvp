import { NextResponse } from 'next/server';
import { dispatchGitHubWorkflow } from '../../_lib/githubWorkflowDispatch';

export const runtime = 'nodejs';

const SELF_TEST_TOKEN = 'tt-self-test-20260515-2ec8d0a9b0db4c45a4d5857f0c4f6b78';

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  const token = request.headers.get('x-tribunetour-self-test')?.trim() ?? '';
  if (token !== SELF_TEST_TOKEN) {
    return json(401, { error: 'unauthorized' });
  }

  const body = (await request.json().catch(() => null)) as { workflow?: string } | null;
  const workflow = body?.workflow?.trim() || 'daily';

  if (workflow === 'daily') {
    return dispatchGitHubWorkflow({
      workflowId: 'daily-fixture-check.yml',
    });
  }

  if (workflow === 'audit') {
    return dispatchGitHubWorkflow({
      workflowId: 'fixture-audit.yml',
      inputs: {
        scope: 'due',
      },
    });
  }

  return json(400, { error: 'invalid_workflow' });
}
