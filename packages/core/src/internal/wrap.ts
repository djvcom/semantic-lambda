import { context as otelContext, type Tracer, trace } from '@opentelemetry/api'
import type { Context } from 'aws-lambda'
import { extractContextFromXRayHeader } from '../propagation'
import { getSpanKindForCategory, type TriggerConfig } from '../triggers/base'
import { ColdStartTracker } from './cold-start'
import {
  buildSpanAttributes,
  extractCommonAttributes,
  extractParentContext,
  finaliseSpanError,
  finaliseSpanSuccess,
} from './span-lifecycle'

export type AsyncHandler<TEvent = unknown, TResult = unknown> = (
  event: TEvent,
  context: Context,
) => Promise<TResult>

export interface WrapperOptions {
  spanNameOverride?: string
}

export interface WrapInstance<TEvent, TResult> {
  (event: TEvent, context: Context): Promise<TResult>
  resetColdStart: () => void
}

/**
 * Wraps a Lambda handler with OpenTelemetry instrumentation.
 *
 * @param tracer - OpenTelemetry tracer instance
 * @param trigger - Trigger configuration defining how to extract attributes
 * @param handler - Lambda handler function
 * @param options - Optional wrapper configuration
 * @returns Wrapped async handler with resetColdStart method
 *
 * @example
 * ```typescript
 * import { trace } from '@opentelemetry/api'
 * import { wrap, sqsTrigger } from '@semantic-lambda/core'
 *
 * const tracer = trace.getTracer('my-service')
 *
 * export const handler = wrap(tracer, sqsTrigger, async (event, context) => {
 *   for (const record of event.Records) {
 *     console.log(record.body)
 *   }
 *   return { batchItemFailures: [] }
 * })
 * ```
 */
export function wrap<TEvent, TResult>(
  tracer: Tracer,
  trigger: TriggerConfig<TEvent>,
  handler: AsyncHandler<TEvent, TResult>,
  options?: WrapperOptions,
): WrapInstance<TEvent, TResult> {
  const coldStartTracker = new ColdStartTracker()
  const isHttpTrigger = trigger.category === 'http'

  const wrapped = async (event: TEvent, lambdaContext: Context): Promise<TResult> => {
    const isColdStart = coldStartTracker.isColdStart()

    const parentContext = extractParentContext(
      event,
      trigger,
      extractContextFromXRayHeader,
      process.env._X_AMZN_TRACE_ID,
    )

    const spanName = options?.spanNameOverride ?? trigger.getSpanName(event, lambdaContext)

    const commonAttributes = extractCommonAttributes(lambdaContext, isColdStart)
    const triggerAttributes = trigger.extractAttributes(event)
    const attributes = buildSpanAttributes(commonAttributes, triggerAttributes, trigger.category)

    const links = trigger.extractSpanLinks?.(event) ?? []

    const span = tracer.startSpan(
      spanName,
      {
        kind: getSpanKindForCategory(trigger.category),
        attributes,
        links,
      },
      parentContext,
    )

    try {
      const result = await otelContext.with(trace.setSpan(parentContext, span), async () =>
        handler(event, lambdaContext),
      )

      coldStartTracker.markWarm()
      finaliseSpanSuccess(span, result, isHttpTrigger)
      return result
    } catch (error) {
      coldStartTracker.markWarm()
      finaliseSpanError(span, error)
      throw error
    }
  }

  const instance = wrapped as WrapInstance<TEvent, TResult>
  instance.resetColdStart = () => coldStartTracker.reset()

  return instance
}
