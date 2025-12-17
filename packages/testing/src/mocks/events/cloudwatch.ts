import { gzipSync } from 'node:zlib'
import type { CloudWatchLogsDecodedData, CloudWatchLogsEvent } from 'aws-lambda'

/**
 * Options for creating a mock CloudWatch Logs subscription event.
 */
export interface MockCloudWatchLogsEventOptions {
  /** Log group name. Defaults to '/aws/lambda/test-function'. */
  logGroup?: string
  /** Log stream name. */
  logStream?: string
  /** AWS account ID of the log owner. Defaults to '123456789012'. */
  owner?: string
  /** Log messages to include. Defaults to ['Test log message']. */
  messages?: string[]
}

/**
 * Creates a mock CloudWatch Logs subscription event for testing Lambda handlers.
 *
 * The event data is properly gzip compressed and base64 encoded as in real events.
 *
 * @param options - Configuration for the mock event
 * @returns A valid CloudWatchLogsEvent object
 *
 * @example
 * ```typescript
 * const event = createMockCloudWatchLogsEvent({
 *   logGroup: '/aws/lambda/my-function',
 *   messages: ['Error: Something went wrong', 'Stack trace...'],
 * })
 * ```
 */
export function createMockCloudWatchLogsEvent(
  options: MockCloudWatchLogsEventOptions = {},
): CloudWatchLogsEvent {
  const logGroup = options.logGroup ?? '/aws/lambda/test-function'
  const logStream = options.logStream ?? '2024/01/01/[$LATEST]abc123'
  const owner = options.owner ?? '123456789012'
  const messages = options.messages ?? ['Test log message']

  const decodedData: CloudWatchLogsDecodedData = {
    messageType: 'DATA_MESSAGE',
    owner,
    logGroup,
    logStream,
    subscriptionFilters: ['test-filter'],
    logEvents: messages.map((message, index) => ({
      id: `event-${index}`,
      timestamp: Date.now(),
      message,
    })),
  }

  const jsonData = JSON.stringify(decodedData)
  const gzippedData = gzipSync(jsonData)
  const base64Data = gzippedData.toString('base64')

  return {
    awslogs: {
      data: base64Data,
    },
  }
}
