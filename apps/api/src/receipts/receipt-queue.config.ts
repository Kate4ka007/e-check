import type { DefaultJobOptions, WorkerOptions } from 'bullmq'

/** Снижают число Redis-команд: не храним историю задач дольше необходимого. */
export const RECEIPT_QUEUE_DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  removeOnComplete: true,
  removeOnFail: 50,
}

/**
 * Реже опрашиваем пустую очередь и проверяем stalled jobs.
 * Для личного проекта задержка подхвата задачи в десятки секунд незаметна.
 */
export const RECEIPT_WORKER_OPTIONS: Pick<WorkerOptions, 'drainDelay' | 'stalledInterval'> = {
  drainDelay: 60,
  stalledInterval: 120_000,
}
