import { randomUUID } from 'node:crypto'
import type { SQSEvent, SQSRecord } from 'aws-lambda'

/**
 * Options for creating a mock SQS record.
 */
export interface MockSqsRecordOptions {
  /** Message body content. Defaults to `{"test":"message"}`. */
  body?: string
  /** Unique message identifier. Defaults to random UUID. */
  messageId?: string
  /** Full ARN of the source queue. Overrides queueName if both provided. */
  queueArn?: string
  /** Queue name used to construct ARN. Defaults to 'test-queue'. */
  queueName?: string
  /** X-Ray trace header for distributed tracing. */
  awsTraceHeader?: string
  /** Custom message attributes. */
  messageAttributes?: SQSRecord['messageAttributes']
}

/**
 * Creates a mock SQS record for testing Lambda handlers.
 *
 * @param options - Configuration for the mock record
 * @returns A valid SQSRecord object
 *
 * @example
 * ```typescript
 * const record = createMockSqsRecord({
 *   body: JSON.stringify({ orderId: '123' }),
 *   queueName: 'orders-queue',
 * })
 * ```
 */
export function createMockSqsRecord(options: MockSqsRecordOptions = {}): SQSRecord {
  const queueName = options.queueName ?? 'test-queue'
  const queueArn = options.queueArn ?? `arn:aws:sqs:eu-west-1:123456789012:${queueName}`
  const messageId = options.messageId ?? randomUUID()

  const attributes: SQSRecord['attributes'] = {
    ApproximateReceiveCount: '1',
    SentTimestamp: String(Date.now()),
    SenderId: '123456789012',
    ApproximateFirstReceiveTimestamp: String(Date.now()),
    AWSTraceHeader: options.awsTraceHeader,
  }

  return {
    messageId,
    receiptHandle: `receipt-${messageId}`,
    body: options.body ?? JSON.stringify({ test: 'message' }),
    attributes,
    messageAttributes: options.messageAttributes ?? {},
    md5OfBody: 'abc123',
    eventSource: 'aws:sqs',
    eventSourceARN: queueArn,
    awsRegion: 'eu-west-1',
  }
}

/**
 * Options for creating a mock SQS event.
 */
export interface MockSqsEventOptions {
  /** Array of record configurations. Defaults to single empty record. */
  records?: MockSqsRecordOptions[]
  /** Default queue name for all records. Defaults to 'test-queue'. */
  queueName?: string
  /** Default queue ARN for all records. Overrides queueName if provided. */
  queueArn?: string
}

/**
 * Creates a mock SQS event for testing Lambda handlers.
 *
 * @param options - Configuration for the mock event
 * @returns A valid SQSEvent object
 *
 * @example
 * ```typescript
 * const event = createMockSqsEvent({
 *   queueName: 'orders-queue',
 *   records: [
 *     { body: JSON.stringify({ orderId: '123' }) },
 *     { body: JSON.stringify({ orderId: '456' }) },
 *   ],
 * })
 * ```
 */
export function createMockSqsEvent(options: MockSqsEventOptions = {}): SQSEvent {
  const queueName = options.queueName ?? 'test-queue'
  const queueArn = options.queueArn ?? `arn:aws:sqs:eu-west-1:123456789012:${queueName}`

  const records = options.records ?? [{}]

  return {
    Records: records.map(recordOptions =>
      createMockSqsRecord({
        queueName,
        queueArn,
        ...recordOptions,
      }),
    ),
  }
}
