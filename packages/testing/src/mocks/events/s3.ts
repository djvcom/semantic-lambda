import type { S3Event, S3EventRecord } from 'aws-lambda'

/**
 * Options for creating a mock S3 event record.
 */
export interface MockS3RecordOptions {
  /** S3 event type (e.g., 'ObjectCreated:Put', 'ObjectRemoved:Delete'). */
  eventName?: string
  /** Bucket name. Defaults to 'test-bucket'. */
  bucketName?: string
  /** Full bucket ARN. Defaults to constructed ARN from bucketName. */
  bucketArn?: string
  /** Object key (path within bucket). Defaults to 'test-object.json'. */
  objectKey?: string
  /** Object size in bytes. Defaults to 1024. */
  objectSize?: number
}

/**
 * Creates a mock S3 event record for testing Lambda handlers.
 *
 * @param options - Configuration for the mock record
 * @returns A valid S3EventRecord object
 *
 * @example
 * ```typescript
 * const record = createMockS3Record({
 *   bucketName: 'uploads',
 *   objectKey: 'images/photo.jpg',
 *   eventName: 'ObjectCreated:Put',
 * })
 * ```
 */
export function createMockS3Record(options: MockS3RecordOptions = {}): S3EventRecord {
  const bucketName = options.bucketName ?? 'test-bucket'
  const bucketArn = options.bucketArn ?? `arn:aws:s3:::${bucketName}`
  const objectKey = options.objectKey ?? 'test-object.json'

  return {
    eventVersion: '2.1',
    eventSource: 'aws:s3',
    awsRegion: 'eu-west-1',
    eventTime: new Date().toISOString(),
    eventName: options.eventName ?? 'ObjectCreated:Put',
    userIdentity: {
      principalId: 'EXAMPLE',
    },
    requestParameters: {
      sourceIPAddress: '127.0.0.1',
    },
    responseElements: {
      'x-amz-request-id': 'EXAMPLE123456789',
      'x-amz-id-2': 'EXAMPLE123/EXAMPLE123456789',
    },
    s3: {
      s3SchemaVersion: '1.0',
      configurationId: 'testConfigRule',
      bucket: {
        name: bucketName,
        ownerIdentity: {
          principalId: 'EXAMPLE',
        },
        arn: bucketArn,
      },
      object: {
        key: objectKey,
        size: options.objectSize ?? 1024,
        eTag: '0123456789abcdef0123456789abcdef',
        sequencer: '0A1B2C3D4E5F678901',
      },
    },
  }
}

/**
 * Options for creating a mock S3 event.
 */
export interface MockS3EventOptions {
  /** Array of record configurations. Defaults to single empty record. */
  records?: MockS3RecordOptions[]
  /** Default bucket name for all records. Defaults to 'test-bucket'. */
  bucketName?: string
}

/**
 * Creates a mock S3 event for testing Lambda handlers.
 *
 * @param options - Configuration for the mock event
 * @returns A valid S3Event object
 *
 * @example
 * ```typescript
 * const event = createMockS3Event({
 *   bucketName: 'uploads',
 *   records: [
 *     { objectKey: 'images/photo1.jpg' },
 *     { objectKey: 'images/photo2.jpg' },
 *   ],
 * })
 * ```
 */
export function createMockS3Event(options: MockS3EventOptions = {}): S3Event {
  const bucketName = options.bucketName ?? 'test-bucket'

  const records = options.records ?? [{}]

  return {
    Records: records.map(recordOptions =>
      createMockS3Record({
        bucketName,
        ...recordOptions,
      }),
    ),
  }
}
