import { randomUUID } from 'node:crypto'
import type { EventBridgeEvent } from 'aws-lambda'

/**
 * Options for creating a mock EventBridge event.
 */
export interface MockEventBridgeEventOptions<TDetail = unknown> {
  /** Event source (e.g., 'aws.ec2', 'myapp.orders'). Defaults to 'test.source'. */
  source?: string
  /** Event detail type (e.g., 'Order Placed'). Defaults to 'Test Event'. */
  detailType?: string
  /** Event payload. Defaults to `{ test: 'data' }`. */
  detail?: TDetail
  /** Unique event identifier. Defaults to random UUID. */
  id?: string
  /** AWS account ID. Defaults to '123456789012'. */
  account?: string
  /** AWS region. Defaults to 'eu-west-1'. */
  region?: string
  /** Event timestamp (ISO 8601). Defaults to current time. */
  time?: string
  /** Related AWS resource ARNs. */
  resources?: string[]
}

/**
 * Creates a mock EventBridge event for testing Lambda handlers.
 *
 * @param options - Configuration for the mock event
 * @returns A valid EventBridgeEvent object
 *
 * @example
 * ```typescript
 * const event = createMockEventBridgeEvent({
 *   source: 'myapp.orders',
 *   detailType: 'Order Placed',
 *   detail: { orderId: '123', amount: 99.99 },
 * })
 * ```
 */
export function createMockEventBridgeEvent<TDetail = Record<string, unknown>>(
  options: MockEventBridgeEventOptions<TDetail> = {},
): EventBridgeEvent<string, TDetail> {
  return {
    version: '0',
    id: options.id ?? randomUUID(),
    'detail-type': options.detailType ?? 'Test Event',
    source: options.source ?? 'test.source',
    account: options.account ?? '123456789012',
    time: options.time ?? new Date().toISOString(),
    region: options.region ?? 'eu-west-1',
    resources: options.resources ?? [],
    detail: (options.detail ?? { test: 'data' }) as TDetail,
  }
}
