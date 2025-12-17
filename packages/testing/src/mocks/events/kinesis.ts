import type { KinesisStreamEvent, KinesisStreamRecord } from 'aws-lambda'

/**
 * Options for creating a mock Kinesis stream record.
 */
export interface MockKinesisRecordOptions {
  /** Record data (will be base64 encoded). Defaults to `{"test":"message"}`. */
  data?: string
  /** Partition key for the record. Defaults to 'partition-key-1'. */
  partitionKey?: string
  /** Sequence number within the shard. */
  sequenceNumber?: string
  /** Full ARN of the source stream. Overrides streamName if both provided. */
  streamArn?: string
  /** Stream name used to construct ARN. Defaults to 'test-stream'. */
  streamName?: string
  /** Shard identifier. Defaults to 'shardId-000000000000'. */
  shardId?: string
}

/**
 * Creates a mock Kinesis stream record for testing Lambda handlers.
 *
 * @param options - Configuration for the mock record
 * @returns A valid KinesisStreamRecord object
 *
 * @example
 * ```typescript
 * const record = createMockKinesisRecord({
 *   data: JSON.stringify({ userId: '123', action: 'login' }),
 *   streamName: 'user-events',
 * })
 * ```
 */
export function createMockKinesisRecord(
  options: MockKinesisRecordOptions = {},
): KinesisStreamRecord {
  const streamName = options.streamName ?? 'test-stream'
  const streamArn =
    options.streamArn ?? `arn:aws:kinesis:eu-west-1:123456789012:stream/${streamName}`
  const shardId = options.shardId ?? 'shardId-000000000000'
  const sequenceNumber =
    options.sequenceNumber ?? '49590338271490256608559692538361571095921575989136588850'

  const data = options.data ?? JSON.stringify({ test: 'message' })
  const base64Data = Buffer.from(data).toString('base64')

  return {
    kinesis: {
      kinesisSchemaVersion: '1.0',
      partitionKey: options.partitionKey ?? 'partition-key-1',
      sequenceNumber,
      data: base64Data,
      approximateArrivalTimestamp: Date.now() / 1000,
    },
    eventSource: 'aws:kinesis',
    eventVersion: '1.0',
    eventID: `${shardId}:${sequenceNumber}`,
    eventName: 'aws:kinesis:record',
    invokeIdentityArn: `arn:aws:iam::123456789012:role/lambda-role`,
    awsRegion: 'eu-west-1',
    eventSourceARN: streamArn,
  }
}

/**
 * Options for creating a mock Kinesis stream event.
 */
export interface MockKinesisEventOptions {
  /** Array of record configurations. Defaults to single empty record. */
  records?: MockKinesisRecordOptions[]
  /** Default stream name for all records. Defaults to 'test-stream'. */
  streamName?: string
  /** Default stream ARN for all records. Overrides streamName if provided. */
  streamArn?: string
}

/**
 * Creates a mock Kinesis stream event for testing Lambda handlers.
 *
 * @param options - Configuration for the mock event
 * @returns A valid KinesisStreamEvent object
 *
 * @example
 * ```typescript
 * const event = createMockKinesisEvent({
 *   streamName: 'user-events',
 *   records: [
 *     { data: JSON.stringify({ action: 'login' }) },
 *     { data: JSON.stringify({ action: 'logout' }) },
 *   ],
 * })
 * ```
 */
export function createMockKinesisEvent(options: MockKinesisEventOptions = {}): KinesisStreamEvent {
  const streamName = options.streamName ?? 'test-stream'
  const streamArn =
    options.streamArn ?? `arn:aws:kinesis:eu-west-1:123456789012:stream/${streamName}`

  const records = options.records ?? [{}]

  return {
    Records: records.map(recordOptions =>
      createMockKinesisRecord({
        streamName,
        streamArn,
        ...recordOptions,
      }),
    ),
  }
}
