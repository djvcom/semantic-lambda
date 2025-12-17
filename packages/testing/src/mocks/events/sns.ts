import { randomUUID } from 'node:crypto'
import type { SNSEvent, SNSEventRecord, SNSMessage } from 'aws-lambda'

/**
 * Options for creating a mock SNS message/record.
 */
export interface MockSnsMessageOptions {
  /** Message body content. Defaults to `{"test":"message"}`. */
  message?: string
  /** Unique message identifier. Defaults to random UUID. */
  messageId?: string
  /** Full ARN of the source topic. Overrides topicName if both provided. */
  topicArn?: string
  /** Topic name used to construct ARN. Defaults to 'test-topic'. */
  topicName?: string
  /** Optional subject line for the notification. */
  subject?: string
  /** Custom message attributes for filtering or metadata. */
  messageAttributes?: SNSMessage['MessageAttributes']
}

/**
 * Creates a mock SNS event record for testing Lambda handlers.
 *
 * @param options - Configuration for the mock record
 * @returns A valid SNSEventRecord object
 *
 * @example
 * ```typescript
 * const record = createMockSnsRecord({
 *   message: JSON.stringify({ orderId: '123' }),
 *   topicName: 'order-notifications',
 * })
 * ```
 */
export function createMockSnsRecord(options: MockSnsMessageOptions = {}): SNSEventRecord {
  const topicName = options.topicName ?? 'test-topic'
  const topicArn = options.topicArn ?? `arn:aws:sns:eu-west-1:123456789012:${topicName}`
  const messageId = options.messageId ?? randomUUID()

  return {
    EventVersion: '1.0',
    EventSubscriptionArn: `${topicArn}:subscription-id`,
    EventSource: 'aws:sns',
    Sns: {
      SignatureVersion: '1',
      Timestamp: new Date().toISOString(),
      Signature: 'mock-signature',
      SigningCertUrl: 'https://sns.eu-west-1.amazonaws.com/cert.pem',
      MessageId: messageId,
      Message: options.message ?? JSON.stringify({ test: 'message' }),
      MessageAttributes: options.messageAttributes ?? {},
      Type: 'Notification',
      UnsubscribeUrl: `https://sns.eu-west-1.amazonaws.com/?Action=Unsubscribe`,
      TopicArn: topicArn,
      Subject: options.subject ?? '',
    },
  }
}

/**
 * Options for creating a mock SNS event.
 */
export interface MockSnsEventOptions {
  /** Array of record configurations. Defaults to single empty record. */
  records?: MockSnsMessageOptions[]
  /** Default topic name for all records. Defaults to 'test-topic'. */
  topicName?: string
  /** Default topic ARN for all records. Overrides topicName if provided. */
  topicArn?: string
}

/**
 * Creates a mock SNS event for testing Lambda handlers.
 *
 * @param options - Configuration for the mock event
 * @returns A valid SNSEvent object
 *
 * @example
 * ```typescript
 * const event = createMockSnsEvent({
 *   topicName: 'order-notifications',
 *   records: [{ message: JSON.stringify({ orderId: '123' }) }],
 * })
 * ```
 */
export function createMockSnsEvent(options: MockSnsEventOptions = {}): SNSEvent {
  const topicName = options.topicName ?? 'test-topic'
  const topicArn = options.topicArn ?? `arn:aws:sns:eu-west-1:123456789012:${topicName}`

  const records = options.records ?? [{}]

  return {
    Records: records.map(recordOptions =>
      createMockSnsRecord({
        topicName,
        topicArn,
        ...recordOptions,
      }),
    ),
  }
}
