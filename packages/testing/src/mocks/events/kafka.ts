import type { MSKEvent } from 'aws-lambda'

/**
 * Options for creating a mock Kafka record.
 */
export interface MockKafkaRecordOptions {
  /** Topic name. */
  topic?: string
  /** Partition number. Defaults to 0. */
  partition?: number
  /** Message offset within partition. */
  offset?: number
  /** Message key (will be base64 encoded). */
  key?: string
  /** Message value (will be base64 encoded). Defaults to `{"test":"message"}`. */
  value?: string
  /** Message timestamp in milliseconds. Defaults to current time. */
  timestamp?: number
}

/**
 * Options for creating a mock Kafka event.
 */
export interface MockKafkaEventOptions {
  /** Event source type. Defaults to 'aws:kafka' (MSK). */
  eventSource?: 'aws:kafka' | 'SelfManagedKafka'
  /** Kafka bootstrap servers. Defaults to 'kafka.example.com:9092'. */
  bootstrapServers?: string
  /** Records keyed by topic-partition (e.g., 'my-topic-0'). */
  records?: Record<string, MockKafkaRecordOptions[]>
  /** Default topic name for records. Defaults to 'test-topic'. */
  topicName?: string
}

/**
 * Creates a mock Kafka event (MSK or self-managed) for testing Lambda handlers.
 *
 * @param options - Configuration for the mock event
 * @returns A valid MSKEvent object
 *
 * @example
 * ```typescript
 * const event = createMockKafkaEvent({
 *   topicName: 'user-events',
 *   records: {
 *     'user-events-0': [
 *       { value: JSON.stringify({ action: 'login' }) },
 *       { value: JSON.stringify({ action: 'logout' }) },
 *     ],
 *   },
 * })
 * ```
 */
export function createMockKafkaEvent(options: MockKafkaEventOptions = {}): MSKEvent {
  const topicName = options.topicName ?? 'test-topic'
  const eventSource = options.eventSource ?? 'aws:kafka'

  // Build records from options or create default
  const records: MSKEvent['records'] = {}

  if (options.records) {
    for (const [topicPartition, recordOptions] of Object.entries(options.records)) {
      records[topicPartition] = recordOptions.map((opts, index) => ({
        topic: opts.topic ?? topicName,
        partition: opts.partition ?? 0,
        offset: opts.offset ?? index,
        timestamp: opts.timestamp ?? Date.now(),
        timestampType: 'CREATE_TIME' as const,
        key: opts.key ? Buffer.from(opts.key).toString('base64') : '',
        value: Buffer.from(opts.value ?? JSON.stringify({ test: 'message' })).toString('base64'),
        headers: [],
      }))
    }
  } else {
    // Default: single topic with one record
    const topicPartitionKey = `${topicName}-0`
    records[topicPartitionKey] = [
      {
        topic: topicName,
        partition: 0,
        offset: 0,
        timestamp: Date.now(),
        timestampType: 'CREATE_TIME',
        key: '',
        value: Buffer.from(JSON.stringify({ test: 'message' })).toString('base64'),
        headers: [],
      },
    ]
  }

  return {
    eventSource,
    eventSourceArn:
      eventSource === 'aws:kafka'
        ? `arn:aws:kafka:eu-west-1:123456789012:cluster/test-cluster/abc123`
        : undefined,
    bootstrapServers: options.bootstrapServers ?? 'kafka.example.com:9092',
    records,
  } as MSKEvent
}
