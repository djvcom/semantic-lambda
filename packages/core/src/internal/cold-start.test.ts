import { beforeEach, describe, expect, it } from 'vitest'
import { ColdStartTracker } from './cold-start'

describe('ColdStartTracker', () => {
  let tracker: ColdStartTracker

  beforeEach(() => {
    tracker = new ColdStartTracker()
  })

  describe('isColdStart', () => {
    it('returns true on first call', () => {
      expect(tracker.isColdStart()).toBe(true)
    })

    it('returns true on multiple calls before markWarm', () => {
      expect(tracker.isColdStart()).toBe(true)
      expect(tracker.isColdStart()).toBe(true)
      expect(tracker.isColdStart()).toBe(true)
    })
  })

  describe('markWarm', () => {
    it('causes isColdStart to return false', () => {
      expect(tracker.isColdStart()).toBe(true)

      tracker.markWarm()

      expect(tracker.isColdStart()).toBe(false)
    })

    it('is idempotent', () => {
      tracker.markWarm()
      tracker.markWarm()
      tracker.markWarm()

      expect(tracker.isColdStart()).toBe(false)
    })
  })

  describe('reset', () => {
    it('resets to cold start state', () => {
      tracker.markWarm()
      expect(tracker.isColdStart()).toBe(false)

      tracker.reset()

      expect(tracker.isColdStart()).toBe(true)
    })
  })

  describe('isolation', () => {
    it('each instance has independent state', () => {
      const tracker1 = new ColdStartTracker()
      const tracker2 = new ColdStartTracker()

      tracker1.markWarm()

      expect(tracker1.isColdStart()).toBe(false)
      expect(tracker2.isColdStart()).toBe(true)
    })
  })
})
