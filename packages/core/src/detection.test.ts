import { createMockApiGatewayV2Event, createMockSqsEvent } from '@semantic-lambda/testing'
import { describe, expect, it } from 'vitest'
import { CachedDetector, detectEventType } from './detection/detector'
import { allTriggers } from './triggers/index'

describe('detectEventType', () => {
  it('detects API Gateway v2 events', () => {
    const event = createMockApiGatewayV2Event()
    const result = detectEventType(allTriggers, event)

    expect(result).not.toBeNull()
    expect(result?.trigger.name).toBe('apiGatewayV2')
  })

  it('detects SQS events', () => {
    const event = createMockSqsEvent()
    const result = detectEventType(allTriggers, event)

    expect(result).not.toBeNull()
    expect(result?.trigger.name).toBe('sqs')
  })

  it('returns null for unknown events', () => {
    const event = { unknownField: 'value' }
    const result = detectEventType(allTriggers, event)

    expect(result).toBeNull()
  })

  it('returns null for empty object', () => {
    const result = detectEventType(allTriggers, {})

    expect(result).toBeNull()
  })

  it('returns null for primitive values', () => {
    expect(detectEventType(allTriggers, 'string')).toBeNull()
    expect(detectEventType(allTriggers, 123)).toBeNull()
    expect(detectEventType(allTriggers, null)).toBeNull()
    expect(detectEventType(allTriggers, undefined)).toBeNull()
  })
})

describe('CachedDetector', () => {
  it('detects event on first call', () => {
    const detector = new CachedDetector(allTriggers)
    const event = createMockSqsEvent()

    const result = detector.detect(event)

    expect(result?.trigger.name).toBe('sqs')
  })

  it('uses cache for subsequent calls with same event type', () => {
    const detector = new CachedDetector(allTriggers)
    const event1 = createMockSqsEvent({ queueName: 'queue-1' })
    const event2 = createMockSqsEvent({ queueName: 'queue-2' })

    detector.detect(event1)
    const result = detector.detect(event2)

    expect(result?.trigger.name).toBe('sqs')
  })

  it('invalidates cache when event type changes', () => {
    const detector = new CachedDetector(allTriggers)
    const sqsEvent = createMockSqsEvent()
    const apiEvent = createMockApiGatewayV2Event()

    detector.detect(sqsEvent)
    const result = detector.detect(apiEvent)

    expect(result?.trigger.name).toBe('apiGatewayV2')
  })

  it('returns null when cached schema fails and no schema matches', () => {
    const detector = new CachedDetector(allTriggers)
    const sqsEvent = createMockSqsEvent()

    detector.detect(sqsEvent)
    const result = detector.detect({ unknownField: 'value' })

    expect(result).toBeNull()
  })

  it('returns null for unknown events', () => {
    const detector = new CachedDetector(allTriggers)

    const result = detector.detect({ unknownField: 'value' })

    expect(result).toBeNull()
  })
})
