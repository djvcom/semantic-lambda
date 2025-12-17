import { describe, expect, it } from 'vitest'
import {
  extractXRayHeaderFromSnsAttributes,
  extractXRayHeaderFromSqsAttributes,
  isSnsMessageAttributes,
  isSqsMessageAttributes,
} from './xray'

describe('isSqsMessageAttributes', () => {
  it('returns true for object with string AWSTraceHeader', () => {
    const attrs = { AWSTraceHeader: 'Root=1-abc-def' }
    expect(isSqsMessageAttributes(attrs)).toBe(true)
  })

  it('returns true for object without AWSTraceHeader', () => {
    const attrs = { otherKey: 'value' }
    expect(isSqsMessageAttributes(attrs)).toBe(true)
  })

  it('returns true for empty object', () => {
    expect(isSqsMessageAttributes({})).toBe(true)
  })

  it('returns false for non-object values', () => {
    expect(isSqsMessageAttributes('string')).toBe(false)
    expect(isSqsMessageAttributes(123)).toBe(false)
    expect(isSqsMessageAttributes(null)).toBe(false)
    expect(isSqsMessageAttributes(undefined)).toBe(false)
  })

  it('returns false for object with non-string AWSTraceHeader', () => {
    const attrs = { AWSTraceHeader: 123 }
    expect(isSqsMessageAttributes(attrs)).toBe(false)
  })
})

describe('isSnsMessageAttributes', () => {
  it('returns true for object with valid SNS AWSTraceHeader', () => {
    const attrs = {
      AWSTraceHeader: { Type: 'String', Value: 'Root=1-abc-def' },
    }
    expect(isSnsMessageAttributes(attrs)).toBe(true)
  })

  it('returns true for object without AWSTraceHeader', () => {
    const attrs = { otherKey: { Type: 'String', Value: 'test' } }
    expect(isSnsMessageAttributes(attrs)).toBe(true)
  })

  it('returns true for empty object', () => {
    expect(isSnsMessageAttributes({})).toBe(true)
  })

  it('returns false for non-object values', () => {
    expect(isSnsMessageAttributes('string')).toBe(false)
    expect(isSnsMessageAttributes(123)).toBe(false)
    expect(isSnsMessageAttributes(null)).toBe(false)
    expect(isSnsMessageAttributes(undefined)).toBe(false)
  })

  it('returns false when AWSTraceHeader is not an object', () => {
    const attrs = { AWSTraceHeader: 'string' }
    expect(isSnsMessageAttributes(attrs)).toBe(false)
  })

  it('returns false when AWSTraceHeader is null', () => {
    const attrs = { AWSTraceHeader: null }
    expect(isSnsMessageAttributes(attrs)).toBe(false)
  })

  it('returns false when AWSTraceHeader.Type is not a string', () => {
    const attrs = { AWSTraceHeader: { Type: 123, Value: 'test' } }
    expect(isSnsMessageAttributes(attrs)).toBe(false)
  })

  it('returns false when AWSTraceHeader.Value is not a string', () => {
    const attrs = { AWSTraceHeader: { Type: 'String', Value: 123 } }
    expect(isSnsMessageAttributes(attrs)).toBe(false)
  })
})

describe('extractXRayHeaderFromSqsAttributes', () => {
  it('extracts AWSTraceHeader value', () => {
    const attrs = { AWSTraceHeader: 'Root=1-abc-def' }
    expect(extractXRayHeaderFromSqsAttributes(attrs)).toBe('Root=1-abc-def')
  })

  it('returns undefined when AWSTraceHeader is missing', () => {
    const attrs = { otherKey: 'value' }
    expect(extractXRayHeaderFromSqsAttributes(attrs)).toBeUndefined()
  })

  it('returns undefined when attributes is undefined', () => {
    expect(extractXRayHeaderFromSqsAttributes(undefined)).toBeUndefined()
  })
})

describe('extractXRayHeaderFromSnsAttributes', () => {
  it('extracts value when Type is String', () => {
    const attrs = {
      AWSTraceHeader: { Type: 'String', Value: 'Root=1-abc-def' },
    }
    expect(extractXRayHeaderFromSnsAttributes(attrs)).toBe('Root=1-abc-def')
  })

  it('returns undefined when Type is not String', () => {
    const attrs = {
      AWSTraceHeader: { Type: 'Binary', Value: 'base64data' },
    }
    expect(extractXRayHeaderFromSnsAttributes(attrs)).toBeUndefined()
  })

  it('returns undefined when AWSTraceHeader is missing', () => {
    const attrs = { otherKey: { Type: 'String', Value: 'test' } }
    expect(extractXRayHeaderFromSnsAttributes(attrs)).toBeUndefined()
  })

  it('returns undefined when attributes is undefined', () => {
    expect(extractXRayHeaderFromSnsAttributes(undefined)).toBeUndefined()
  })
})
