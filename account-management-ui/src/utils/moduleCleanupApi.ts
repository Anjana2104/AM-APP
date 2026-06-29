export type ModuleCleanupTarget = 'resources' | 'requests' | 'process';
export type ModuleCleanupArtifact = 'audit' | 'comments';

function artifactPath(artifact: ModuleCleanupArtifact): 'all-audit' | 'all-comments' {
  return artifact === 'audit' ? 'all-audit' : 'all-comments';
}

export async function clearModuleArtifact(
  target: ModuleCleanupTarget,
  artifact: ModuleCleanupArtifact,
  logContext: string,
): Promise<boolean> {
  const endpoint = `/api/${target}/${artifactPath(artifact)}`;
  try {
    const res = await fetch(endpoint, { method: 'DELETE' });
    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }
    return true;
  } catch (error) {
    console.error(`[${logContext}] Failed clearing ${artifact} via ${endpoint}`, error);
    return false;
  }
}
