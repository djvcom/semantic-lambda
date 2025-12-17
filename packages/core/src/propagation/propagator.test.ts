import { trace } from '@opentelemetry/api'
import { createTestSdk, type TestSdk } from '@semantic-lambda/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  extractContextFromHeaders,
  extractContextFromMultiValueHeaders,
  extractContextFromXRayHeader,
} from './propagator'

describe('propagator', () => {
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

  describe('extractContextFromHeaders', () => {
    it('extracts W3C traceparent header', () => {
      const headers = {
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      }

      const context = extractContextFromHeaders(headers)
      const spanContext = trace.getSpanContext(context)

      expect(spanContext).toBeDefined()
      expect(spanContext?.traceId).toBe('0af7651916cd43dd8448eb211c80319c')
      expect(spanContext?.spanId).toBe('b7ad6b7169203331')
      expect(spanContext?.traceFlags).toBe(1)
    })

    it('extracts X-Ray trace header', () => {
      const headers = {
        'x-amzn-trace-id':
          'Root=1-5f84c7a7-00000000aaaaaaaaaaaaaaaa;Parent=bbbbbbbbbbbbbbbb;Sampled=1',
      }

      const context = extractContextFromHeaders(headers)
      const spanContext = trace.getSpanContext(context)

      expect(spanContext).toBeDefined()
      expect(spanContext?.traceId).toBe('5f84c7a700000000aaaaaaaaaaaaaaaa')
      expect(spanContext?.spanId).toBe('bbbbbbbbbbbbbbbb')
      expect(spanContext?.traceFlags).toBe(1)
    })

    it('prioritises W3C traceparent over X-Ray when both present', () => {
      const headers = {
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
        'x-amzn-trace-id':
          'Root=1-5f84c7a7-00000000aaaaaaaaaaaaaaaa;Parent=bbbbbbbbbbbbbbbb;Sampled=1',
      }

      const context = extractContextFromHeaders(headers)
      const spanContext = trace.getSpanContext(context)

      expect(spanContext).toBeDefined()
      // Should use W3C trace ID, not X-Ray
      expect(spanContext?.traceId).toBe('0af7651916cd43dd8448eb211c80319c')
      expect(spanContext?.spanId).toBe('b7ad6b7169203331')
    })

    it('handles case-insensitive header names', () => {
      const headers = {
        TRACEPARENT: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      }

      const context = extractContextFromHeaders(headers)
      const spanContext = trace.getSpanContext(context)

      expect(spanContext).toBeDefined()
      expect(spanContext?.traceId).toBe('0af7651916cd43dd8448eb211c80319c')
    })

    it('returns ROOT_CONTEXT for null headers', () => {
      const context = extractContextFromHeaders(null)
      const spanContext = trace.getSpanContext(context)

      expect(spanContext).toBeUndefined()
    })

    it('returns ROOT_CONTEXT for empty headers', () => {
      const context = extractContextFromHeaders({})
      const spanContext = trace.getSpanContext(context)

      expect(spanContext).toBeUndefined()
    })

    it('returns ROOT_CONTEXT for invalid traceparent', () => {
      const headers = {
        traceparent: 'invalid-format',
      }

      const context = extractContextFromHeaders(headers)
      const spanContext = trace.getSpanContext(context)

      expect(spanContext).toBeUndefined()
    })
  })

  describe('extractContextFromMultiValueHeaders', () => {
    it('extracts from multi-value headers taking first value', () => {
      const headers = {
        traceparent: ['00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01', 'ignored'],
      }

      const context = extractContextFromMultiValueHeaders(headers)
      const spanContext = trace.getSpanContext(context)

      expect(spanContext).toBeDefined()
      expect(spanContext?.traceId).toBe('0af7651916cd43dd8448eb211c80319c')
    })

    it('handles empty array values', () => {
      const headers = {
        traceparent: [],
      }

      const context = extractContextFromMultiValueHeaders(headers)
      const spanContext = trace.getSpanContext(context)

      expect(spanContext).toBeUndefined()
    })

    it('returns ROOT_CONTEXT for null headers', () => {
      const context = extractContextFromMultiValueHeaders(null)
      const spanContext = trace.getSpanContext(context)

      expect(spanContext).toBeUndefined()
    })
  })

  describe('extractContextFromXRayHeader', () => {
    it('extracts context from X-Ray trace header string', () => {
      const header = 'Root=1-5f84c7a7-00000000aaaaaaaaaaaaaaaa;Parent=bbbbbbbbbbbbbbbb;Sampled=1'

      const context = extractContextFromXRayHeader(header)
      const spanContext = trace.getSpanContext(context)

      expect(spanContext).toBeDefined()
      expect(spanContext?.traceId).toBe('5f84c7a700000000aaaaaaaaaaaaaaaa')
      expect(spanContext?.spanId).toBe('bbbbbbbbbbbbbbbb')
      expect(spanContext?.traceFlags).toBe(1)
    })

    it('handles unsampled traces', () => {
      const header = 'Root=1-5f84c7a7-00000000aaaaaaaaaaaaaaaa;Parent=bbbbbbbbbbbbbbbb;Sampled=0'

      const context = extractContextFromXRayHeader(header)
      const spanContext = trace.getSpanContext(context)

      expect(spanContext).toBeDefined()
      expect(spanContext?.traceFlags).toBe(0)
    })

    it('returns ROOT_CONTEXT for undefined header', () => {
      const context = extractContextFromXRayHeader(undefined)
      const spanContext = trace.getSpanContext(context)

      expect(spanContext).toBeUndefined()
    })

    it('returns ROOT_CONTEXT for empty header', () => {
      const context = extractContextFromXRayHeader('')
      const spanContext = trace.getSpanContext(context)

      expect(spanContext).toBeUndefined()
    })

    it('returns ROOT_CONTEXT for malformed header', () => {
      const context = extractContextFromXRayHeader('invalid-header')
      const spanContext = trace.getSpanContext(context)

      expect(spanContext).toBeUndefined()
    })

    it('returns ROOT_CONTEXT for header missing Parent field', () => {
      const header = 'Root=1-5f84c7a7-00000000aaaaaaaaaaaaaaaa;Sampled=1'

      const context = extractContextFromXRayHeader(header)
      const spanContext = trace.getSpanContext(context)

      expect(spanContext).toBeUndefined()
    })
  })
})
