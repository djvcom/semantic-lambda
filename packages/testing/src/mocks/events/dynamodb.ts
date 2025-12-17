import { randomUUID } from 'node:crypto'
import type { AttributeValue, DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda'

/**
 * Options for creating a mock DynamoDB Streams record.
 */
export interface MockDynamoDbRecordOptions {
  /** Type of change event. Defaults to 'INSERT'. */
  eventName?: 'INSERT' | 'MODIFY' | 'REMOVE'
  /** Table name used to construct ARN. Defaults to 'test-table'. */
  tableName?: string
  /** Full ARN of the source table stream. Overrides tableName if both provided. */
  tableArn?: string
  /** Primary key attributes of the changed item. */
  keys?: Record<string, AttributeValue>
  /** New item state (for INSERT/MODIFY). */
  newImage?: Record<string, AttributeValue>
  /** Previous item state (for MODIFY/REMOVE). */
  oldImage?: Record<string, AttributeValue>
  /** Stream sequence number. */
  sequenceNumber?: string
}

/**
 * Creates a mock DynamoDB Streams record for testing Lambda handlers.
 *
 * @param options - Configuration for the mock record
 * @returns A valid DynamoDBRecord object
 *
 * @example
 * ```typescript
 * const record = createMockDynamoDbRecord({
 *   eventName: 'INSERT',
 *   tableName: 'users',
 *   keys: { id: { S: 'user-123' } },
 *   newImage: { id: { S: 'user-123' }, name: { S: 'Alice' } },
 * })
 * ```
 */
export function createMockDynamoDbRecord(options: MockDynamoDbRecordOptions = {}): DynamoDBRecord {
  const tableName = options.tableName ?? 'test-table'
  const tableArn =
    options.tableArn ??
    `arn:aws:dynamodb:eu-west-1:123456789012:table/${tableName}/stream/2024-01-01T00:00:00.000`
  const sequenceNumber = options.sequenceNumber ?? '100000000000000000001'

  const record: DynamoDBRecord = {
    eventID: randomUUID(),
    eventName: options.eventName ?? 'INSERT',
    eventVersion: '1.1',
    eventSource: 'aws:dynamodb',
    awsRegion: 'eu-west-1',
    eventSourceARN: tableArn,
    dynamodb: {
      ApproximateCreationDateTime: Date.now() / 1000,
      Keys: options.keys ?? { id: { S: 'test-id' } },
      SequenceNumber: sequenceNumber,
      SizeBytes: 100,
      StreamViewType: 'NEW_AND_OLD_IMAGES',
    },
  }

  if (options.newImage && record.dynamodb) {
    record.dynamodb.NewImage = options.newImage
  }
  if (options.oldImage && record.dynamodb) {
    record.dynamodb.OldImage = options.oldImage
  }

  return record
}

/**
 * Options for creating a mock DynamoDB Streams event.
 */
export interface MockDynamoDbEventOptions {
  /** Array of record configurations. Defaults to single empty record. */
  records?: MockDynamoDbRecordOptions[]
  /** Default table name for all records. Defaults to 'test-table'. */
  tableName?: string
  /** Default table ARN for all records. Overrides tableName if provided. */
  tableArn?: string
}

/**
 * Creates a mock DynamoDB Streams event for testing Lambda handlers.
 *
 * @param options - Configuration for the mock event
 * @returns A valid DynamoDBStreamEvent object
 *
 * @example
 * ```typescript
 * const event = createMockDynamoDbEvent({
 *   tableName: 'users',
 *   records: [
 *     { eventName: 'INSERT', keys: { id: { S: 'user-1' } } },
 *     { eventName: 'MODIFY', keys: { id: { S: 'user-2' } } },
 *   ],
 * })
 * ```
 */
export function createMockDynamoDbEvent(
  options: MockDynamoDbEventOptions = {},
): DynamoDBStreamEvent {
  const tableName = options.tableName ?? 'test-table'
  const tableArn =
    options.tableArn ??
    `arn:aws:dynamodb:eu-west-1:123456789012:table/${tableName}/stream/2024-01-01T00:00:00.000`

  const records = options.records ?? [{}]

  return {
    Records: records.map(recordOptions =>
      createMockDynamoDbRecord({
        tableName,
        tableArn,
        ...recordOptions,
      }),
    ),
  }
}
