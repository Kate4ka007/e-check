import { PrismaClient } from '../generated/prisma'
import { loadEnv, type Env } from '../config/env.schema'
import { createReceiptExtractor } from '../extraction/extractor.factory'
import { createProcessingOrchestrator } from '../processing/processing.orchestrator'
import { StorageService } from '../storage/storage.service'

export function createWorkerDeps(env: Env = loadEnv()) {
  const prisma = new PrismaClient()
  const storage = new StorageService(env)
  const extractor = createReceiptExtractor(env)
  const orchestrator = createProcessingOrchestrator({ prisma, storage, extractor, env })

  return { env, prisma, storage, extractor, orchestrator }
}
