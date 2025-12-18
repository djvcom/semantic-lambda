import { context as otelContext, type Tracer, trace } from '@opentelemetry/api'
import type { Context } from 'aws-lambda'
import { CachedDetector } from '../detection/detector'
import { ColdStartTracker } from '../internal/cold-start'
import {
  finaliseSpanError,
  finaliseSpanSuccess,
  prepareSpanCreation,
} from '../internal/span-lifecycle'
import type { AsyncHandler, Handler } from '../internal/wrap'
import { allTriggers } from '../triggers/index'

export type { Handler }
/** @deprecated Use `Handler` instead */
export type { AsyncHandler }

export interface WrapperOptions {
  spanNameOverride?: string
}

export interface AutoWrapperInstance {
  <TResult = unknown>(
    handler: Handler<unknown, TResult>,
    options?: WrapperOptions,
  ): Handler<unknown, TResult>
  resetColdStart: () => void
  resetDetector: () => void
}

/**
 * Creates a Lambda wrapper with automatic trigger detection.
 *
 * This includes all trigger configurations for runtime detection,
 * resulting in a larger bundle size. For smaller bundles, use
 * the primary `wrap()` API with explicit trigger configurations.
 *
 * @param tracer - OpenTelemetry tracer instance
 * @returns Wrapper function with auto-detection
 *
 * @example
 * ```typescript
 * import { trace } from '@opentelemetry/api'
 * import { wrapWithEventDetection } from '@semantic-lambda/core/auto'
 *
 * const tracer = trace.getTracer('my-service')
 * const wrap = wrapWithEventDetection(tracer)
 *
 * export const handler = wrap(async (event, context) => {
 *   // Trigger type is auto-detected
 *   return { statusCode: 200, body: 'ok' }
 * })
 * ```
 */
export function wrapWithEventDetection(tracer: Tracer): AutoWrapperInstance {
  const coldStartTracker = new ColdStartTracker()
  const detector = new CachedDetector(allTriggers)

  const wrap = <TResult>(
    handler: Handler<unknown, TResult>,
    options?: WrapperOptions,
  ): Handler<unknown, TResult> => {
    return async (event: unknown, lambdaContext: Context): Promise<TResult> => {
      const isColdStart = coldStartTracker.isColdStart()

      const ctx = prepareSpanCreation(detector, event, lambdaContext, isColdStart, options)

      const span = tracer.startSpan(
        ctx.spanName,
        { kind: ctx.spanKind, attributes: ctx.attributes, links: ctx.links },
        ctx.parentContext,
      )

      try {
        const result = await otelContext.with(trace.setSpan(ctx.parentContext, span), async () =>
          handler(ctx.parsedEvent, lambdaContext),
        )

        coldStartTracker.markWarm()
        finaliseSpanSuccess(span, result, ctx.isHttpTrigger)
        return result
      } catch (error) {
        coldStartTracker.markWarm()
        finaliseSpanError(span, error)
        throw error
      }
    }
  }

  const instance = wrap as AutoWrapperInstance
  instance.resetColdStart = () => coldStartTracker.reset()
  instance.resetDetector = () => detector.reset()

  return instance
}
