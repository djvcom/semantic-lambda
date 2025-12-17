import { describe, expect, it, vi } from 'vitest'
import type { TriggerConfig } from '../triggers/base'
import { CachedDetector, detectEventType } from './detector'

const createMockTrigger = (
  name: string,
  validator: (data: unknown) => boolean,
  priority = 50,
): TriggerConfig => ({
  name,
  category: 'other',
  schema: {
    safeParse: (data: unknown) =>
      validator(data) ? { success: true, data } : { success: false, error: new Error('Invalid') },
  } as never,
  detectionPriority: priority,
  extractAttributes: () => ({}),
  getSpanName: () => name,
})

describe('CachedDetector', () => {
  describe('detect', () => {
    it('detects matching event and returns trigger config', () => {
      const trigger = createMockTrigger('test', data => typeof data === 'object' && data !== null)
      const detector = new CachedDetector([trigger])

      const result = detector.detect({ foo: 'bar' })

      expect(result).not.toBeNull()
      expect(result?.trigger.name).toBe('test')
      expect(result?.event).toEqual({ foo: 'bar' })
    })

    it('returns null when no trigger matches', () => {
      const trigger = createMockTrigger('test', () => false)
      const detector = new CachedDetector([trigger])

      const result = detector.detect({ foo: 'bar' })

      expect(result).toBeNull()
    })

    it('returns null when triggers array is empty', () => {
      const detector = new CachedDetector([])

      const result = detector.detect({ foo: 'bar' })

      expect(result).toBeNull()
    })

    it('tries triggers in priority order', () => {
      const lowPriority = createMockTrigger('low', () => true, 10)
      const highPriority = createMockTrigger('high', () => true, 100)
      const detector = new CachedDetector([lowPriority, highPriority])

      const result = detector.detect({})

      expect(result?.trigger.name).toBe('high')
    })

    it('caches successful detection', () => {
      const trigger = createMockTrigger('test', () => true)
      const safeParseSpy = vi.spyOn(trigger.schema!, 'safeParse')
      const detector = new CachedDetector([trigger])

      detector.detect({})
      detector.detect({})
      detector.detect({})

      // First call: full detection, Second+: cached
      // Full detection calls safeParse once, cached calls once more
      expect(safeParseSpy).toHaveBeenCalledTimes(3)
    })

    it('uses cached trigger on subsequent calls', () => {
      const trigger = createMockTrigger('test', () => true)
      const detector = new CachedDetector([trigger])

      detector.detect({})

      expect(detector.getCachedTrigger()).toBe(trigger)
    })

    it('clears cache on detection failure and retries full detection', () => {
      let callCount = 0
      const trigger = createMockTrigger('test', () => {
        callCount++
        return callCount <= 1 // Succeeds first time, fails second
      })
      const detector = new CachedDetector([trigger])

      const firstResult = detector.detect({})
      expect(firstResult).not.toBeNull()
      expect(detector.getCachedTrigger()).not.toBeNull()

      const secondResult = detector.detect({})
      expect(secondResult).toBeNull()
      expect(detector.getCachedTrigger()).toBeNull()
    })

    it('falls back to other triggers when cached trigger fails', () => {
      let primaryCallCount = 0
      const primary = createMockTrigger(
        'primary',
        () => {
          primaryCallCount++
          return primaryCallCount <= 1
        },
        100,
      )
      const fallback = createMockTrigger('fallback', () => true, 50)
      const detector = new CachedDetector([primary, fallback])

      const firstResult = detector.detect({})
      expect(firstResult?.trigger.name).toBe('primary')

      const secondResult = detector.detect({})
      expect(secondResult?.trigger.name).toBe('fallback')
    })
  })

  describe('reset', () => {
    it('clears the cached trigger', () => {
      const trigger = createMockTrigger('test', () => true)
      const detector = new CachedDetector([trigger])

      detector.detect({})
      expect(detector.getCachedTrigger()).not.toBeNull()

      detector.reset()
      expect(detector.getCachedTrigger()).toBeNull()
    })
  })

  describe('getCachedTrigger', () => {
    it('returns null initially', () => {
      const detector = new CachedDetector([])
      expect(detector.getCachedTrigger()).toBeNull()
    })

    it('returns cached trigger after detection', () => {
      const trigger = createMockTrigger('test', () => true)
      const detector = new CachedDetector([trigger])

      detector.detect({})

      expect(detector.getCachedTrigger()).toBe(trigger)
    })
  })
})

describe('detectEventType', () => {
  it('detects matching event', () => {
    const trigger = createMockTrigger('test', () => true)

    const result = detectEventType([trigger], {})

    expect(result?.trigger.name).toBe('test')
  })

  it('returns null when no match', () => {
    const trigger = createMockTrigger('test', () => false)

    const result = detectEventType([trigger], {})

    expect(result).toBeNull()
  })

  it('does not cache (stateless)', () => {
    const trigger = createMockTrigger('test', () => true)
    const safeParseSpy = vi.spyOn(trigger.schema!, 'safeParse')

    detectEventType([trigger], {})
    detectEventType([trigger], {})
    detectEventType([trigger], {})

    expect(safeParseSpy).toHaveBeenCalledTimes(3)
  })
})
