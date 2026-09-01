import type { Env } from '../config/env.schema'
import { MockExtractor } from './mock.extractor'
import type { ReceiptExtractor } from './receipt-extractor'
import { VisionExtractor } from './vision.extractor'

export function createReceiptExtractor(env: Env): ReceiptExtractor {
  switch (env.EXTRACTOR_KIND) {
    case 'mock':
      return new MockExtractor()
    case 'vision':
      return new VisionExtractor(env)
    case 'two-stage':
      // Two-stage not wired yet — fall back to vision until M0 picks the variant.
      return new VisionExtractor(env)
    default:
      return new MockExtractor()
  }
}
