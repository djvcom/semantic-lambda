import { randomUUID } from 'node:crypto'
import type { Context } from 'aws-lambda'

export interface MockContextOptions {
  functionName?: string
  functionVersion?: string
  invokedFunctionArn?: string
  memoryLimitInMB?: string
  awsRequestId?: string
  logGroupName?: string
  logStreamName?: string
  remainingTimeMs?: number
}

/**
 * Creates a mock AWS Lambda context for testing.
 *
 * @param options - Optional context values to override defaults
 * @returns A valid Lambda context object
 * @throws {TypeError} If memoryLimitInMB is not a valid positive integer string
 * @throws {TypeError} If remainingTimeMs is not a positive number
 */
export function createMockContext(options: MockContextOptions = {}): Context {
  const functionName = options.functionName ?? 'test-function'
  const awsRequestId = options.awsRequestId ?? randomUUID()
  const memoryLimitInMB = options.memoryLimitInMB ?? '128'
  const remainingTimeMs = options.remainingTimeMs ?? 30000

  // Validate memoryLimitInMB
  const memoryNum = Number.parseInt(memoryLimitInMB, 10)
  if (Number.isNaN(memoryNum) || memoryNum <= 0) {
    throw new TypeError(
      `Invalid memoryLimitInMB: "${memoryLimitInMB}". Must be a positive integer string.`,
    )
  }

  // Validate remainingTimeMs
  if (remainingTimeMs <= 0 || !Number.isFinite(remainingTimeMs)) {
    throw new TypeError(
      `Invalid remainingTimeMs: ${remainingTimeMs}. Must be a positive finite number.`,
    )
  }

  return {
    functionName,
    functionVersion: options.functionVersion ?? '$LATEST',
    invokedFunctionArn:
      options.invokedFunctionArn ??
      `arn:aws:lambda:eu-west-1:123456789012:function:${functionName}`,
    memoryLimitInMB,
    awsRequestId,
    logGroupName: options.logGroupName ?? `/aws/lambda/${functionName}`,
    logStreamName: options.logStreamName ?? `2025/01/01/[$LATEST]${awsRequestId.replace(/-/g, '')}`,
    callbackWaitsForEmptyEventLoop: true,
    getRemainingTimeInMillis: () => remainingTimeMs,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  }
}
