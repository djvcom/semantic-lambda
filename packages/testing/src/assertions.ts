import type { SpanKind, SpanStatus } from '@opentelemetry/api'
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base'

/**
 * Criteria for matching spans in assertions.
 *
 * All specified fields must match for a span to be considered a match.
 * Unspecified fields are not checked.
 *
 * @example
 * ```typescript
 * const matcher: SpanMatcher = {
 *   name: 'my-queue process',
 *   kind: SpanKind.CONSUMER,
 *   attributes: { 'messaging.system': 'aws_sqs' },
 * }
 * ```
 */
export interface SpanMatcher {
  /** Span name to match (exact string or regex pattern). */
  name?: string | RegExp
  /** OpenTelemetry span kind (SERVER, CLIENT, CONSUMER, PRODUCER, INTERNAL). */
  kind?: SpanKind
  /** Attributes that must be present with matching values. */
  attributes?: Record<string, unknown>
  /** Status code and/or message to match. */
  status?: Partial<SpanStatus>
  /** Whether the span must have a parent span context. */
  hasParent?: boolean
}

/**
 * Finds the first span matching the given criteria.
 *
 * @param spans - Array of spans to search
 * @param matcher - Criteria to match against
 * @returns The first matching span, or undefined if none found
 *
 * @example
 * ```typescript
 * const span = findSpan(exporter.getFinishedSpans(), { name: 'my-queue process' })
 * expect(span).toBeDefined()
 * ```
 */
export function findSpan(spans: ReadableSpan[], matcher: SpanMatcher): ReadableSpan | undefined {
  return spans.find(span => matchesSpan(span, matcher))
}

/**
 * Finds all spans matching the given criteria.
 *
 * @param spans - Array of spans to search
 * @param matcher - Criteria to match against
 * @returns Array of all matching spans (empty if none found)
 *
 * @example
 * ```typescript
 * const httpSpans = findSpans(spans, { kind: SpanKind.SERVER })
 * expect(httpSpans).toHaveLength(3)
 * ```
 */
export function findSpans(spans: ReadableSpan[], matcher: SpanMatcher): ReadableSpan[] {
  return spans.filter(span => matchesSpan(span, matcher))
}

/**
 * Checks if any span matches the given criteria.
 *
 * @param spans - Array of spans to search
 * @param matcher - Criteria to match against
 * @returns True if at least one span matches
 *
 * @example
 * ```typescript
 * expect(hasSpan(spans, { name: /process$/ })).toBe(true)
 * ```
 */
export function hasSpan(spans: ReadableSpan[], matcher: SpanMatcher): boolean {
  return spans.some(span => matchesSpan(span, matcher))
}

function matchesSpan(span: ReadableSpan, matcher: SpanMatcher): boolean {
  if (matcher.name !== undefined) {
    if (typeof matcher.name === 'string') {
      if (span.name !== matcher.name) return false
    } else if (!matcher.name.test(span.name)) {
      return false
    }
  }

  if (matcher.kind !== undefined && span.kind !== matcher.kind) {
    return false
  }

  if (matcher.attributes !== undefined) {
    for (const [key, value] of Object.entries(matcher.attributes)) {
      if (span.attributes[key] !== value) {
        return false
      }
    }
  }

  if (matcher.status !== undefined) {
    if (matcher.status.code !== undefined && span.status.code !== matcher.status.code) {
      return false
    }
    if (matcher.status.message !== undefined && span.status.message !== matcher.status.message) {
      return false
    }
  }

  if (matcher.hasParent !== undefined) {
    const spanHasParent = span.parentSpanContext !== undefined
    if (matcher.hasParent !== spanHasParent) {
      return false
    }
  }

  return true
}

/**
 * Gets a single attribute value from a span.
 *
 * @param span - The span to read from
 * @param key - The attribute key (e.g., 'http.method', 'messaging.system')
 * @returns The attribute value, or undefined if not present
 *
 * @example
 * ```typescript
 * const method = getSpanAttribute(span, 'http.request.method')
 * expect(method).toBe('GET')
 * ```
 */
export function getSpanAttribute(span: ReadableSpan, key: string): unknown {
  return span.attributes[key]
}

/**
 * Gets all attributes from a span as a plain object.
 *
 * @param span - The span to read from
 * @returns A copy of all span attributes
 *
 * @example
 * ```typescript
 * const attrs = getSpanAttributes(span)
 * expect(attrs['faas.coldstart']).toBe(true)
 * ```
 */
export function getSpanAttributes(span: ReadableSpan): Record<string, unknown> {
  return { ...span.attributes }
}

/**
 * Checks if a span has a specific attribute, optionally with a specific value.
 *
 * @param span - The span to check
 * @param key - The attribute key to look for
 * @param value - Optional value to match (if omitted, just checks presence)
 * @returns True if the attribute exists (and matches value if specified)
 *
 * @example
 * ```typescript
 * // Check attribute exists
 * expect(spanHasAttribute(span, 'faas.coldstart')).toBe(true)
 *
 * // Check attribute has specific value
 * expect(spanHasAttribute(span, 'http.response.status_code', 200)).toBe(true)
 * ```
 */
export function spanHasAttribute(span: ReadableSpan, key: string, value?: unknown): boolean {
  if (value === undefined) {
    return key in span.attributes
  }
  return span.attributes[key] === value
}

/**
 * Asserts that a span matching the criteria exists, throwing if not found.
 *
 * @param spans - Array of spans to search
 * @param matcher - Criteria to match against
 * @param message - Optional custom error message
 * @returns The matching span (for chaining further assertions)
 * @throws Error if no matching span is found
 *
 * @example
 * ```typescript
 * const span = assertSpanExists(spans, { name: 'my-queue process' })
 * expect(span.attributes['messaging.batch.message_count']).toBe(5)
 * ```
 */
export function assertSpanExists(
  spans: ReadableSpan[],
  matcher: SpanMatcher,
  message?: string,
): ReadableSpan {
  const span = findSpan(spans, matcher)
  if (!span) {
    const matcherDesc = JSON.stringify(matcher, null, 2)
    const spansDesc = spans.map(s => `  - ${s.name}`).join('\n')
    throw new Error(
      message ??
        `Expected to find span matching:\n${matcherDesc}\n\nFound spans:\n${spansDesc || '  (none)'}`,
    )
  }
  return span
}

/**
 * Asserts that no span matching the criteria exists, throwing if one is found.
 *
 * @param spans - Array of spans to search
 * @param matcher - Criteria that should NOT match any span
 * @param message - Optional custom error message
 * @throws Error if a matching span is found
 *
 * @example
 * ```typescript
 * // Ensure no error spans were created
 * assertNoSpan(spans, { status: { code: SpanStatusCode.ERROR } })
 * ```
 */
export function assertNoSpan(spans: ReadableSpan[], matcher: SpanMatcher, message?: string): void {
  const span = findSpan(spans, matcher)
  if (span) {
    throw new Error(message ?? `Expected no span matching criteria, but found: ${span.name}`)
  }
}
