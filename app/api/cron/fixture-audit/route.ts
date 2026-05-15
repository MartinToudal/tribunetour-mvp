import { authorizeCronRequest, dispatchGitHubWorkflow } from '../../_lib/githubWorkflowDispatch';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const unauthorized = authorizeCronRequest(request);
  if (unauthorized) {
    return unauthorized;
  }

  return dispatchGitHubWorkflow({
    workflowId: 'fixture-audit.yml',
    inputs: {
      scope: 'due',
    },
  });
}
