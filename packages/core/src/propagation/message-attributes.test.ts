import type { SNSMessageAttributes, SQSMessageAttributes, SQSRecordAttributes } from 'aws-lambda'
import { describe, expect, it } from 'vitest'
import {
  normaliseSnsMessageAttributes,
  normaliseSqsMessageAttributes,
  normaliseSqsSystemAttributes,
} from './message-attributes'

describe('normaliseSqsMessageAttributes', () => {
  it('extracts stringValue from message attributes', () => {
    const attrs: SQSMessageAttributes = {
      traceparent: {
        stringValue: '00-abc123-def456-01',
        dataType: 'String',
      },
      tracestate: {
        stringValue: 'vendor=value',
        dataType: 'String',
      },
    }

    const result = normaliseSqsMessageAttributes(attrs)

    expect(result).toEqual({
      traceparent: '00-abc123-def456-01',
      tracestate: 'vendor=value',
    })
  })

  it('skips attributes without stringValue', () => {
    const attrs: SQSMessageAttributes = {
      traceparent: {
        stringValue: '00-abc123-def456-01',
        dataType: 'String',
      },
      binaryAttr: {
        binaryValue: 'base64data',
        dataType: 'Binary',
      },
    }

    const result = normaliseSqsMessageAttributes(attrs)

    expect(result).toEqual({
      traceparent: '00-abc123-def456-01',
    })
  })

  it('returns empty object for undefined', () => {
    expect(normaliseSqsMessageAttributes(undefined)).toEqual({})
  })

  it('returns empty object for empty attributes', () => {
    expect(normaliseSqsMessageAttributes({})).toEqual({})
  })
})

describe('normaliseSqsSystemAttributes', () => {
  it('maps AWSTraceHeader to x-amzn-trace-id', () => {
    const attrs: SQSRecordAttributes = {
      AWSTraceHeader: 'Root=1-abc-def;Parent=123;Sampled=1',
      ApproximateReceiveCount: '1',
      SentTimestamp: '1234567890',
      SenderId: 'sender123',
      ApproximateFirstReceiveTimestamp: '1234567890',
    }

    const result = normaliseSqsSystemAttributes(attrs)

    expect(result['x-amzn-trace-id']).toBe('Root=1-abc-def;Parent=123;Sampled=1')
    expect(result.ApproximateReceiveCount).toBe('1')
  })

  it('passes through other attributes unchanged', () => {
    const attrs: SQSRecordAttributes = {
      ApproximateReceiveCount: '5',
      SentTimestamp: '9999999999',
      SenderId: 'test-sender',
      ApproximateFirstReceiveTimestamp: '9999999999',
    }

    const result = normaliseSqsSystemAttributes(attrs)

    expect(result).toEqual({
      ApproximateReceiveCount: '5',
      SentTimestamp: '9999999999',
      SenderId: 'test-sender',
      ApproximateFirstReceiveTimestamp: '9999999999',
    })
  })

  it('returns empty object for undefined', () => {
    expect(normaliseSqsSystemAttributes(undefined)).toEqual({})
  })
})

describe('normaliseSnsMessageAttributes', () => {
  it('extracts Value from String type attributes', () => {
    const attrs: SNSMessageAttributes = {
      traceparent: {
        Type: 'String',
        Value: '00-abc123-def456-01',
      },
      tracestate: {
        Type: 'String',
        Value: 'vendor=value',
      },
    }

    const result = normaliseSnsMessageAttributes(attrs)

    expect(result).toEqual({
      traceparent: '00-abc123-def456-01',
      tracestate: 'vendor=value',
    })
  })

  it('maps AWSTraceHeader to x-amzn-trace-id', () => {
    const attrs: SNSMessageAttributes = {
      AWSTraceHeader: {
        Type: 'String',
        Value: 'Root=1-abc-def;Parent=123;Sampled=1',
      },
    }

    const result = normaliseSnsMessageAttributes(attrs)

    expect(result['x-amzn-trace-id']).toBe('Root=1-abc-def;Parent=123;Sampled=1')
    expect(result.AWSTraceHeader).toBeUndefined()
  })

  it('skips non-String type attributes', () => {
    const attrs: SNSMessageAttributes = {
      traceparent: {
        Type: 'String',
        Value: '00-abc123-def456-01',
      },
      numberAttr: {
        Type: 'Number',
        Value: '42',
      },
    }

    const result = normaliseSnsMessageAttributes(attrs)

    expect(result).toEqual({
      traceparent: '00-abc123-def456-01',
    })
  })

  it('returns empty object for undefined', () => {
    expect(normaliseSnsMessageAttributes(undefined)).toEqual({})
  })

  it('returns empty object for empty attributes', () => {
    expect(normaliseSnsMessageAttributes({})).toEqual({})
  })
})

describe('carrier merge order security', () => {
  it('system attributes should override message attributes with same key', () => {
    const messageAttrs: SQSMessageAttributes = {
      'x-amzn-trace-id': {
        stringValue: 'malicious-trace-id',
        dataType: 'String',
      },
    }
    const systemAttrs: SQSRecordAttributes = {
      AWSTraceHeader: 'Root=1-legitimate-trace;Parent=abc;Sampled=1',
      ApproximateReceiveCount: '1',
      SentTimestamp: '1234567890',
      SenderId: 'sender',
      ApproximateFirstReceiveTimestamp: '1234567890',
    }

    // Correct merge order: message attrs first, then system attrs (system wins)
    const carrier = {
      ...normaliseSqsMessageAttributes(messageAttrs),
      ...normaliseSqsSystemAttributes(systemAttrs),
    }

    // System's AWSTraceHeader (mapped to x-amzn-trace-id) should override malicious value
    expect(carrier['x-amzn-trace-id']).toBe('Root=1-legitimate-trace;Parent=abc;Sampled=1')
  })
})
