import type { TriggerConfig } from '../triggers/base'

/**
 * Result of event detection.
 */
export interface DetectionResult<TEvent = unknown> {
  /** The detected trigger configuration */
  trigger: TriggerConfig<TEvent>
  /** The parsed/validated event */
  event: TEvent
}

/**
 * Sort triggers by detection priority (highest first).
 * Only includes triggers with schemas for dynamic detection.
 */
function sortByPriority(triggers: readonly TriggerConfig[]): TriggerConfig[] {
  return triggers
    .filter(t => t.schema !== undefined)
    .sort((a, b) => (b.detectionPriority ?? 0) - (a.detectionPriority ?? 0))
}

/**
 * Detects Lambda trigger types from events using Zod schema validation.
 *
 * Caches the last successful schema to optimise repeated invocations
 * with the same trigger type (typical Lambda behaviour).
 */
export class CachedDetector {
  private cachedTrigger: TriggerConfig | null = null
  private readonly sortedTriggers: TriggerConfig[]

  constructor(triggers: readonly TriggerConfig[]) {
    this.sortedTriggers = sortByPriority(triggers)
  }

  /**
   * Detect the trigger type from an event.
   *
   * @param event - The Lambda event to detect
   * @returns Detection result with trigger config and parsed event, or null if unknown
   */
  detect(event: unknown): DetectionResult | null {
    // Fast path: try cached trigger first
    if (this.cachedTrigger?.schema) {
      const result = this.cachedTrigger.schema.safeParse(event)
      if (result.success) {
        return { trigger: this.cachedTrigger, event: result.data }
      }
      // Cache miss: clear and try full detection
      this.cachedTrigger = null
    }

    // Full detection: iterate through all triggers by priority
    for (const trigger of this.sortedTriggers) {
      if (!trigger.schema) continue

      const result = trigger.schema.safeParse(event)
      if (result.success) {
        this.cachedTrigger = trigger
        return { trigger, event: result.data }
      }
    }

    return null
  }

  /**
   * Reset the detection cache.
   * Primarily useful for testing.
   */
  reset(): void {
    this.cachedTrigger = null
  }

  /**
   * Get the currently cached trigger (if any).
   * Primarily useful for testing and debugging.
   */
  getCachedTrigger(): TriggerConfig | null {
    return this.cachedTrigger
  }
}

/**
 * Detect event type without caching.
 * Useful for one-off detection or testing.
 */
export function detectEventType(
  triggers: readonly TriggerConfig[],
  event: unknown,
): DetectionResult | null {
  const sorted = sortByPriority(triggers)

  for (const trigger of sorted) {
    if (!trigger.schema) continue

    const result = trigger.schema.safeParse(event)
    if (result.success) {
      return { trigger, event: result.data }
    }
  }

  return null
}
