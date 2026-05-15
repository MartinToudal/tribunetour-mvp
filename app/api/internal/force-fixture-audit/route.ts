import { dispatchGitHubWorkflow } from '../../_lib/githubWorkflowDispatch';

export const runtime = 'nodejs';

export async function GET() {
  return dispatchGitHubWorkflow({
    workflowId: 'fixture-audit.yml',
    inputs: {
      scope: 'all',
    },
  });
}
