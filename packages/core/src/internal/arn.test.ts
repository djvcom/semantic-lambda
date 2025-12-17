import { describe, expect, it } from 'vitest'
import {
  extractQueueName,
  extractRegionAndAccount,
  extractResourceName,
  extractStreamName,
  extractTableName,
  extractTopicName,
  parseArn,
} from './arn'

describe('parseArn', () => {
  it('parses a valid SQS ARN', () => {
    const arn = 'arn:aws:sqs:eu-west-1:123456789012:my-queue'
    const result = parseArn(arn)

    expect(result).toEqual({
      partition: 'aws',
      service: 'sqs',
      region: 'eu-west-1',
      accountId: '123456789012',
      resource: 'my-queue',
    })
  })

  it('parses a valid Lambda ARN', () => {
    const arn = 'arn:aws:lambda:us-east-1:123456789012:function:my-function'
    const result = parseArn(arn)

    expect(result).toEqual({
      partition: 'aws',
      service: 'lambda',
      region: 'us-east-1',
      accountId: '123456789012',
      resource: 'function:my-function',
    })
  })

  it('parses a DynamoDB stream ARN', () => {
    const arn =
      'arn:aws:dynamodb:eu-west-1:123456789012:table/my-table/stream/2024-01-01T00:00:00.000'
    const result = parseArn(arn)

    expect(result).toEqual({
      partition: 'aws',
      service: 'dynamodb',
      region: 'eu-west-1',
      accountId: '123456789012',
      resource: 'table/my-table/stream/2024-01-01T00:00:00.000',
    })
  })

  it('parses a GovCloud ARN', () => {
    const arn = 'arn:aws-us-gov:sqs:us-gov-west-1:123456789012:my-queue'
    const result = parseArn(arn)

    expect(result).toEqual({
      partition: 'aws-us-gov',
      service: 'sqs',
      region: 'us-gov-west-1',
      accountId: '123456789012',
      resource: 'my-queue',
    })
  })

  it('parses a China region ARN', () => {
    const arn = 'arn:aws-cn:sqs:cn-north-1:123456789012:my-queue'
    const result = parseArn(arn)

    expect(result).toEqual({
      partition: 'aws-cn',
      service: 'sqs',
      region: 'cn-north-1',
      accountId: '123456789012',
      resource: 'my-queue',
    })
  })

  it('returns null for invalid ARN', () => {
    expect(parseArn('not-an-arn')).toBeNull()
    expect(parseArn('')).toBeNull()
    expect(parseArn('arn:aws:sqs')).toBeNull()
  })
})

describe('extractRegionAndAccount', () => {
  it('extracts region and account from valid ARN', () => {
    const arn = 'arn:aws:sqs:eu-west-1:123456789012:my-queue'
    const result = extractRegionAndAccount(arn)

    expect(result).toEqual({
      region: 'eu-west-1',
      accountId: '123456789012',
    })
  })

  it('returns null for ARN without region', () => {
    const arn = 'arn:aws:s3:::my-bucket'
    const result = extractRegionAndAccount(arn)

    expect(result).toBeNull()
  })

  it('returns null for invalid ARN', () => {
    expect(extractRegionAndAccount('not-an-arn')).toBeNull()
  })
})

describe('extractResourceName', () => {
  it('extracts queue name from SQS ARN', () => {
    const arn = 'arn:aws:sqs:eu-west-1:123456789012:my-queue'
    expect(extractResourceName(arn)).toBe('my-queue')
  })

  it('extracts topic name from SNS ARN', () => {
    const arn = 'arn:aws:sns:eu-west-1:123456789012:my-topic'
    expect(extractResourceName(arn)).toBe('my-topic')
  })

  it('extracts stream name from Kinesis ARN', () => {
    const arn = 'arn:aws:kinesis:eu-west-1:123456789012:stream/my-stream'
    expect(extractResourceName(arn)).toBe('my-stream')
  })

  it('extracts table name from DynamoDB table ARN', () => {
    const arn = 'arn:aws:dynamodb:eu-west-1:123456789012:table/my-table'
    expect(extractResourceName(arn)).toBe('my-table')
  })

  it('extracts table name from DynamoDB stream ARN', () => {
    const arn =
      'arn:aws:dynamodb:eu-west-1:123456789012:table/my-table/stream/2024-01-01T00:00:00.000'
    expect(extractResourceName(arn)).toBe('my-table')
  })

  it('extracts function name from Lambda ARN', () => {
    const arn = 'arn:aws:lambda:eu-west-1:123456789012:function:my-function'
    expect(extractResourceName(arn)).toBe('my-function')
  })

  it('extracts function name from Lambda ARN with qualifier', () => {
    const arn = 'arn:aws:lambda:eu-west-1:123456789012:function:my-function:prod'
    expect(extractResourceName(arn)).toBe('my-function')
  })

  it('returns original string for invalid ARN', () => {
    expect(extractResourceName('not-an-arn')).toBe('not-an-arn')
  })
})

describe('convenience functions', () => {
  it('extractQueueName works', () => {
    const arn = 'arn:aws:sqs:eu-west-1:123456789012:orders-queue'
    expect(extractQueueName(arn)).toBe('orders-queue')
  })

  it('extractTopicName works', () => {
    const arn = 'arn:aws:sns:eu-west-1:123456789012:notifications'
    expect(extractTopicName(arn)).toBe('notifications')
  })

  it('extractStreamName works', () => {
    const arn = 'arn:aws:kinesis:eu-west-1:123456789012:stream/events'
    expect(extractStreamName(arn)).toBe('events')
  })

  it('extractTableName works', () => {
    const arn = 'arn:aws:dynamodb:eu-west-1:123456789012:table/users'
    expect(extractTableName(arn)).toBe('users')
  })
})
