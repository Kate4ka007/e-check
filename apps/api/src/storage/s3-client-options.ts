import type { Env } from '../config/env.schema'

/** Supabase S3 API breaks TLS when virtual-host style rewrites the hostname. */
export function resolveS3ForcePathStyle(
  env: Pick<Env, 'S3_ENDPOINT' | 'S3_FORCE_PATH_STYLE'>,
): boolean {
  if (env.S3_ENDPOINT.includes('supabase.co')) {
    return true
  }

  return env.S3_FORCE_PATH_STYLE
}

export function isManagedObjectStorage(endpoint: string): boolean {
  return endpoint.includes('supabase.co') || endpoint.includes('r2.cloudflarestorage.com')
}
