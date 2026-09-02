import { describe, expect, it } from 'vitest'
import { isManagedObjectStorage, resolveS3ForcePathStyle } from './s3-client-options'

describe('resolveS3ForcePathStyle', () => {
  it('forces path style for Supabase endpoints', () => {
    expect(
      resolveS3ForcePathStyle({
        S3_ENDPOINT: 'https://abc.storage.supabase.co/storage/v1/s3',
        S3_FORCE_PATH_STYLE: false,
      }),
    ).toBe(true)
  })

  it('respects env for non-Supabase endpoints', () => {
    expect(
      resolveS3ForcePathStyle({
        S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
        S3_FORCE_PATH_STYLE: false,
      }),
    ).toBe(false)

    expect(
      resolveS3ForcePathStyle({
        S3_ENDPOINT: 'http://localhost:9000',
        S3_FORCE_PATH_STYLE: true,
      }),
    ).toBe(true)
  })
})

describe('isManagedObjectStorage', () => {
  it('detects Supabase and R2', () => {
    expect(isManagedObjectStorage('https://abc.storage.supabase.co/storage/v1/s3')).toBe(true)
    expect(isManagedObjectStorage('https://id.r2.cloudflarestorage.com')).toBe(true)
    expect(isManagedObjectStorage('http://localhost:9000')).toBe(false)
  })
})
