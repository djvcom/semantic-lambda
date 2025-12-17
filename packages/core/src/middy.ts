import type { Context as OtelContext, Span, Tracer } from '@opentelemetry/api'
import type { Context } from 'aws-lambda'
import { CachedDetector } from './detection/detector'
import { ColdStartTracker } from './internal/cold-start'
import {
  finaliseSpanError,
  finaliseSpanSuccess,
  prepareSpanCreation,
} from './internal/span-lifecycle'
import type { TriggerConfig } from './triggers/base'
import { allTriggers } from './triggers/index'

interface MiddyRequest<TEvent = unknown> {
  event: TEvent
  context: Context
  response?: unknown
  error?: Error
}

interface MiddySpanState {
  span: Span
  parentContext: OtelContext
  trigger: TriggerConfig | null
  markWarm: () => void
}

// WeakMap stores span state between middleware phases (before → after/onError).
//
// Why WeakMap instead of Middy's request.internal pattern:
// - request.internal is designed for sharing data between different middlewares
// - Our use case is storing state within our own middleware phases only
// - WeakMap provides automatic GC if request objects are reused
// - Explicit deletion in after/onError ensures cleanup during request lifetime
const requestSpans = new WeakMap<MiddyRequest, MiddySpanState>()

interface MiddyMiddlewareObject {
  before?: (request: MiddyRequest) => Promise<void> | void
  after?: (request: MiddyRequest) => Promise<void> | void
  onError?: (request: MiddyRequest) => Promise<void> | void
}

export interface SemanticSpanMiddlewareOptions {
  spanNameOverride?: string
}

/**
 * Middy middleware that creates semantic OpenTelemetry spans for Lambda handlers.
 *
 * Uses automatic trigger detection based on event structure. The middleware
 * will replace `request.event` with the Zod-parsed version of the event,
 * providing validated, typed event data to downstream middleware and the handler.
 *
 * @param tracer - OpenTelemetry tracer instance
 * @param options - Middleware options
 * @returns Middy middleware object
 *
 * @example
 * ```typescript
 * import middy from '@middy/core'
 * import { semanticSpanMiddleware } from '@semantic-lambda/core/middy'
 *
 * const handler = middy(baseHandler)
 *   .use(semanticSpanMiddleware(tracer))
 * ```
 *
 * @remarks
 * This middleware should be added early in the chain so that the span
 * is available to other middleware via `getSpanFromMiddyRequest()`.
 *
 * **Context limitation**: Due to Middy's architecture, the span context
 * is not automatically propagated via OpenTelemetry's context API. Use
 * `getSpanFromMiddyRequest()` or `getParentContextFromMiddyRequest()`
 * to access the span in downstream middleware.
 */
export function semanticSpanMiddleware(
  tracer: Tracer,
  options?: SemanticSpanMiddlewareOptions,
): MiddyMiddlewareObject {
  const detector = new CachedDetector(allTriggers)
  const coldStartTracker = new ColdStartTracker()

  return {
    before: request => {
      const isColdStart = coldStartTracker.isColdStart()

      const ctx = prepareSpanCreation(
        detector,
        request.event,
        request.context,
        isColdStart,
        options,
      )

      // Replace event with parsed version for downstream middleware
      request.event = ctx.parsedEvent

      const span = tracer.startSpan(
        ctx.spanName,
        { kind: ctx.spanKind, attributes: ctx.attributes, links: ctx.links },
        ctx.parentContext,
      )

      // Store state for after/onError
      requestSpans.set(request, {
        span,
        parentContext: ctx.parentContext,
        trigger: ctx.trigger,
        markWarm: () => coldStartTracker.markWarm(),
      })
    },

    after: request => {
      const state = requestSpans.get(request)
      if (state) {
        const { span, trigger, markWarm } = state
        const isHttpTrigger = trigger?.category === 'http'

        markWarm()
        finaliseSpanSuccess(span, request.response, isHttpTrigger)
        requestSpans.delete(request)
      }
    },

    onError: request => {
      const state = requestSpans.get(request)
      if (state) {
        const { span, markWarm } = state

        markWarm()
        // request.error should always exist in onError, but handle undefined defensively
        finaliseSpanError(span, request.error ?? new Error('Unknown error'))
        requestSpans.delete(request)
      }
    },
  }
}

/**
 * Get the span associated with a Middy request.
 *
 * Use this in downstream middleware to access the current span
 * for adding attributes or creating child spans.
 */
export function getSpanFromMiddyRequest(request: MiddyRequest): Span | undefined {
  return requestSpans.get(request)?.span
}

/**
 * Get the parent context associated with a Middy request.
 *
 * Use this to create child spans that are properly linked to
 * the request's trace context.
 */
export function getParentContextFromMiddyRequest(request: MiddyRequest): OtelContext | undefined {
  return requestSpans.get(request)?.parentContext
}
