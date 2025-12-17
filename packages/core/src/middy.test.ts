import { SpanKind, SpanStatusCode } from '@opentelemetry/api'
import {
  createMockApiGatewayV2Event,
  createMockContext,
  createMockSqsEvent,
  createTestSdk,
  getSpanAttribute,
  type TestSdk,
} from '@semantic-lambda/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  getParentContextFromMiddyRequest,
  getSpanFromMiddyRequest,
  semanticSpanMiddleware,
} from './middy'

interface MiddyRequest<TEvent = unknown> {
  event: TEvent
  context: import('aws-lambda').Context
  response?: unknown
  error?: Error
}

describe('semanticSpanMiddleware', () => {
  let sdk: TestSdk

  beforeAll(() => {
    sdk = createTestSdk()
  })

  beforeEach(() => {
    sdk.reset()
  })

  afterAll(async () => {
    await sdk.shutdown()
  })

  describe('with API Gateway V2 events', () => {
    it('creates a span in before hook', async () => {
      const middleware = semanticSpanMiddleware(sdk.getTracer('test'))

      const request: MiddyRequest = {
        event: createMockApiGatewayV2Event({ method: 'GET', path: '/test', routeKey: 'GET /test' }),
        context: createMockContext({ functionName: 'my-function' }),
      }

      await middleware.before?.(request)

      // Span should be created but not ended yet
      const span = getSpanFromMiddyRequest(request)
      expect(span).toBeDefined()
      expect(span?.isRecording()).toBe(true)
    })

    it('ends span with success in after hook', async () => {
      const middleware = semanticSpanMiddleware(sdk.getTracer('test'))

      const request: MiddyRequest = {
        event: createMockApiGatewayV2Event({
          method: 'POST',
          path: '/users',
          routeKey: 'POST /users',
        }),
        context: createMockContext(),
        response: { statusCode: 201, body: 'created' },
      }

      await middleware.before?.(request)
      await middleware.after?.(request)

      const spans = sdk.getFinishedSpans()
      expect(spans).toHaveLength(1)

      const span = spans[0]!
      expect(span.name).toBe('POST /users')
      expect(span.kind).toBe(SpanKind.SERVER)
      expect(span.status.code).toBe(SpanStatusCode.OK)
      expect(getSpanAttribute(span, 'http.response.status_code')).toBe(201)
    })

    it('ends span with error in onError hook', async () => {
      const middleware = semanticSpanMiddleware(sdk.getTracer('test'))

      const request: MiddyRequest = {
        event: createMockApiGatewayV2Event(),
        context: createMockContext(),
        error: new Error('Handler failed'),
      }

      await middleware.before?.(request)
      await middleware.onError?.(request)

      const spans = sdk.getFinishedSpans()
      expect(spans).toHaveLength(1)

      const span = spans[0]!
      expect(span.status.code).toBe(SpanStatusCode.ERROR)
      expect(span.status.message).toBe('Handler failed')
      expect(getSpanAttribute(span, 'error.type')).toBe('Error')
    })

    it('records HTTP 5xx as ERROR status', async () => {
      const middleware = semanticSpanMiddleware(sdk.getTracer('test'))

      const request: MiddyRequest = {
        event: createMockApiGatewayV2Event(),
        context: createMockContext(),
        response: { statusCode: 500, body: 'Internal Server Error' },
      }

      await middleware.before?.(request)
      await middleware.after?.(request)

      const spans = sdk.getFinishedSpans()
      const span = spans[0]!
      expect(span.status.code).toBe(SpanStatusCode.ERROR)
      expect(getSpanAttribute(span, 'http.response.status_code')).toBe(500)
    })
  })

  describe('with options', () => {
    it('accepts spanNameOverride in options', async () => {
      const middleware = semanticSpanMiddleware(sdk.getTracer('test'), {
        spanNameOverride: 'custom-span-name',
      })

      const request: MiddyRequest = {
        event: createMockApiGatewayV2Event(),
        context: createMockContext(),
      }

      await middleware.before?.(request)
      await middleware.after?.(request)

      const spans = sdk.getFinishedSpans()
      expect(spans[0]!.name).toBe('custom-span-name')
    })
  })

  describe('with SQS events', () => {
    it('detects SQS event type automatically', async () => {
      const middleware = semanticSpanMiddleware(sdk.getTracer('test'))

      const request: MiddyRequest = {
        event: createMockSqsEvent({ queueName: 'test-queue' }),
        context: createMockContext(),
        response: { batchItemFailures: [] },
      }

      await middleware.before?.(request)
      await middleware.after?.(request)

      const spans = sdk.getFinishedSpans()
      expect(spans).toHaveLength(1)

      const span = spans[0]!
      expect(span.name).toBe('test-queue process')
      expect(span.kind).toBe(SpanKind.CONSUMER)
      expect(getSpanAttribute(span, 'faas.trigger')).toBe('pubsub')
      expect(getSpanAttribute(span, 'messaging.system')).toBe('aws_sqs')
    })

    it('replaces request.event with parsed event', async () => {
      const middleware = semanticSpanMiddleware(sdk.getTracer('test'))

      const originalEvent = createMockSqsEvent({ queueName: 'my-queue' })
      const request: MiddyRequest = {
        event: originalEvent,
        context: createMockContext(),
      }

      await middleware.before?.(request)

      // The event should be replaced with the Zod-parsed version
      // Both should have the same structure but the parsed one went through validation
      expect(request.event).toBeDefined()
      expect((request.event as { Records: unknown[] }).Records).toHaveLength(1)

      await middleware.after?.(request)

      const span = sdk.getFinishedSpans()[0]!
      expect(getSpanAttribute(span, 'messaging.system')).toBe('aws_sqs')
    })
  })

  describe('cold start tracking', () => {
    it('marks first invocation as cold start', async () => {
      const middleware = semanticSpanMiddleware(sdk.getTracer('test'))

      const request: MiddyRequest = {
        event: createMockApiGatewayV2Event(),
        context: createMockContext(),
      }

      await middleware.before?.(request)
      await middleware.after?.(request)

      const span = sdk.getFinishedSpans()[0]!
      expect(getSpanAttribute(span, 'faas.coldstart')).toBe(true)
    })

    it('marks subsequent invocations as warm', async () => {
      const middleware = semanticSpanMiddleware(sdk.getTracer('test'))

      // First invocation
      const request1: MiddyRequest = {
        event: createMockApiGatewayV2Event(),
        context: createMockContext(),
      }
      await middleware.before?.(request1)
      await middleware.after?.(request1)

      sdk.reset()

      // Second invocation
      const request2: MiddyRequest = {
        event: createMockApiGatewayV2Event(),
        context: createMockContext(),
      }
      await middleware.before?.(request2)
      await middleware.after?.(request2)

      const span = sdk.getFinishedSpans()[0]!
      expect(getSpanAttribute(span, 'faas.coldstart')).toBe(false)
    })
  })

  describe('helper functions', () => {
    it('getSpanFromMiddyRequest returns undefined before middleware runs', () => {
      const request: MiddyRequest = {
        event: createMockApiGatewayV2Event(),
        context: createMockContext(),
      }

      expect(getSpanFromMiddyRequest(request)).toBeUndefined()
    })

    it('getSpanFromMiddyRequest returns span during request lifecycle', async () => {
      const middleware = semanticSpanMiddleware(sdk.getTracer('test'))

      const request: MiddyRequest = {
        event: createMockApiGatewayV2Event(),
        context: createMockContext(),
      }

      await middleware.before?.(request)

      const span = getSpanFromMiddyRequest(request)
      expect(span).toBeDefined()
      expect(span?.isRecording()).toBe(true)
    })

    it('getSpanFromMiddyRequest returns undefined after request completes', async () => {
      const middleware = semanticSpanMiddleware(sdk.getTracer('test'))

      const request: MiddyRequest = {
        event: createMockApiGatewayV2Event(),
        context: createMockContext(),
      }

      await middleware.before?.(request)
      await middleware.after?.(request)

      // Span should be cleaned up from WeakMap after request completes
      expect(getSpanFromMiddyRequest(request)).toBeUndefined()
    })

    it('getParentContextFromMiddyRequest returns context during request', async () => {
      const middleware = semanticSpanMiddleware(sdk.getTracer('test'))

      const request: MiddyRequest = {
        event: createMockApiGatewayV2Event(),
        context: createMockContext(),
      }

      await middleware.before?.(request)

      const parentContext = getParentContextFromMiddyRequest(request)
      expect(parentContext).toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('handles after being called without before gracefully', async () => {
      const middleware = semanticSpanMiddleware(sdk.getTracer('test'))

      const request: MiddyRequest = {
        event: createMockApiGatewayV2Event(),
        context: createMockContext(),
      }

      // Call after without before - should not throw
      await middleware.after?.(request)

      // No spans should be created
      expect(sdk.getFinishedSpans()).toHaveLength(0)
    })

    it('handles onError being called without before gracefully', async () => {
      const middleware = semanticSpanMiddleware(sdk.getTracer('test'))

      const request: MiddyRequest = {
        event: createMockApiGatewayV2Event(),
        context: createMockContext(),
        error: new Error('Some error'),
      }

      // Call onError without before - should not throw
      await middleware.onError?.(request)

      // No spans should be created
      expect(sdk.getFinishedSpans()).toHaveLength(0)
    })

    it('handles non-Error thrown values', async () => {
      const middleware = semanticSpanMiddleware(sdk.getTracer('test'))

      const request: MiddyRequest = {
        event: createMockApiGatewayV2Event(),
        context: createMockContext(),
        error: 'string error' as unknown as Error,
      }

      await middleware.before?.(request)
      await middleware.onError?.(request)

      const spans = sdk.getFinishedSpans()
      const span = spans[0]!
      expect(span.status.code).toBe(SpanStatusCode.ERROR)
      expect(span.status.message).toBe('string error')
    })
  })
})
