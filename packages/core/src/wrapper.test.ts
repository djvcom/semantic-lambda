import { SpanKind, SpanStatusCode } from '@opentelemetry/api'
import {
  assertSpanExists,
  createMockApiGatewayV2Event,
  createMockCloudWatchLogsEvent,
  createMockContext,
  createMockDynamoDbEvent,
  createMockEventBridgeEvent,
  createMockKafkaEvent,
  createMockKinesisEvent,
  createMockS3Event,
  createMockSnsEvent,
  createMockSqsEvent,
  createTestSdk,
  findSpan,
  getSpanAttribute,
  type TestSdk,
} from '@semantic-lambda/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { wrapWithEventDetection } from './entries/auto'
import {
  apiGatewayV2Trigger,
  cloudwatchTrigger,
  dynamodbTrigger,
  eventbridgeTrigger,
  kafkaTrigger,
  kinesisTrigger,
  s3Trigger,
  snsTrigger,
  sqsTrigger,
  wrap,
} from './index'

describe('Semantic Lambda Wrappers', () => {
  let sdk: TestSdk

  beforeAll(() => {
    sdk = createTestSdk()
  })

  beforeEach(() => {
    sdk.reset()
  })

  afterAll(async () => {
    await sdk.shutdown()
  })

  describe('Trigger-specific wrappers', () => {
    describe('apiGatewayV2', () => {
      it('creates a span for API Gateway V2 event', async () => {
        const handler = wrap(sdk.getTracer('test'), apiGatewayV2Trigger, async () => {
          return { statusCode: 200, body: 'ok' }
        })
        handler.resetColdStart()

        const event = createMockApiGatewayV2Event({
          method: 'GET',
          path: '/users/123',
          routeKey: 'GET /users/{id}',
        })
        const context = createMockContext({ functionName: 'my-function' })

        await handler(event, context)

        const spans = sdk.getFinishedSpans()
        expect(spans).toHaveLength(1)

        const span = spans[0]!
        expect(span.name).toBe('GET /users/{id}')
        expect(span.kind).toBe(SpanKind.SERVER)
        expect(span.status.code).toBe(SpanStatusCode.OK)

        expect(getSpanAttribute(span, 'faas.trigger')).toBe('http')
        expect(getSpanAttribute(span, 'faas.invocation_id')).toBe(context.awsRequestId)
        expect(getSpanAttribute(span, 'faas.name')).toBe('my-function')
        expect(getSpanAttribute(span, 'http.request.method')).toBe('GET')
        expect(getSpanAttribute(span, 'url.path')).toBe('/users/123')
      })

      it('records errors on the span', async () => {
        const handler = wrap(sdk.getTracer('test'), apiGatewayV2Trigger, async () => {
          throw new Error('Something went wrong')
        })
        handler.resetColdStart()

        const event = createMockApiGatewayV2Event()
        const context = createMockContext()

        await expect(handler(event, context)).rejects.toThrow('Something went wrong')

        const spans = sdk.getFinishedSpans()
        expect(spans).toHaveLength(1)

        const span = spans[0]!
        expect(span.status.code).toBe(SpanStatusCode.ERROR)
        expect(span.status.message).toBe('Something went wrong')
        expect(span.events).toHaveLength(1)
        expect(span.events[0]?.name).toBe('exception')
        expect(getSpanAttribute(span, 'error.type')).toBe('Error')
      })

      it('converts non-Error throws to Error objects', async () => {
        const handler = wrap(sdk.getTracer('test'), apiGatewayV2Trigger, async () => {
          throw 'string error'
        })
        handler.resetColdStart()

        const event = createMockApiGatewayV2Event()
        const context = createMockContext()

        await expect(handler(event, context)).rejects.toThrow('string error')

        const spans = sdk.getFinishedSpans()
        const span = spans[0]!
        expect(span.status.code).toBe(SpanStatusCode.ERROR)
        expect(span.status.message).toBe('string error')
      })

      it('sets coldstart attribute on first invocation', async () => {
        const handler = wrap(sdk.getTracer('test'), apiGatewayV2Trigger, async () => {
          return { statusCode: 200, body: 'ok' }
        })
        handler.resetColdStart()

        const event = createMockApiGatewayV2Event()
        const context = createMockContext()

        await handler(event, context)

        const spans = sdk.getFinishedSpans()
        const span = spans[0]!

        expect(getSpanAttribute(span, 'faas.coldstart')).toBe(true)
      })

      it('sets coldstart to false on subsequent invocations', async () => {
        const handler = wrap(sdk.getTracer('test'), apiGatewayV2Trigger, async () => {
          return { statusCode: 200, body: 'ok' }
        })
        handler.resetColdStart()

        const event = createMockApiGatewayV2Event()
        const context = createMockContext()

        // First invocation - cold start
        await handler(event, context)
        const firstSpan = sdk.getFinishedSpans()[0]!
        expect(getSpanAttribute(firstSpan, 'faas.coldstart')).toBe(true)

        sdk.reset()

        // Second invocation - warm
        await handler(event, context)
        const secondSpan = sdk.getFinishedSpans()[0]!
        expect(getSpanAttribute(secondSpan, 'faas.coldstart')).toBe(false)
      })

      it('tracks cold start per instance', async () => {
        const handler1 = wrap(sdk.getTracer('test'), apiGatewayV2Trigger, async () => ({
          statusCode: 200,
          body: 'ok',
        }))
        handler1.resetColdStart()

        const handler2 = wrap(sdk.getTracer('test'), apiGatewayV2Trigger, async () => ({
          statusCode: 200,
          body: 'ok',
        }))
        handler2.resetColdStart()

        const event = createMockApiGatewayV2Event()
        const context = createMockContext()

        // Both should be cold starts
        await handler1(event, context)
        await handler2(event, context)

        const spans = sdk.getFinishedSpans()
        expect(spans).toHaveLength(2)
        expect(getSpanAttribute(spans[0]!, 'faas.coldstart')).toBe(true)
        expect(getSpanAttribute(spans[1]!, 'faas.coldstart')).toBe(true)
      })

      it('includes faas.max_memory attribute', async () => {
        const handler = wrap(sdk.getTracer('test'), apiGatewayV2Trigger, async () => {
          return { statusCode: 200, body: 'ok' }
        })
        handler.resetColdStart()

        const event = createMockApiGatewayV2Event()
        const context = createMockContext({ memoryLimitInMB: '512' })

        await handler(event, context)

        const spans = sdk.getFinishedSpans()
        const span = spans[0]!
        expect(getSpanAttribute(span, 'faas.max_memory')).toBe(512)
      })
    })

    describe('sqs', () => {
      it('creates a span for SQS event with CONSUMER kind', async () => {
        const handler = wrap(sdk.getTracer('test'), sqsTrigger, async () => {
          return { batchItemFailures: [] }
        })
        handler.resetColdStart()

        const event = createMockSqsEvent({
          queueName: 'my-queue',
          records: [{ body: JSON.stringify({ message: 'test' }) }],
        })
        const context = createMockContext()

        await handler(event, context)

        const spans = sdk.getFinishedSpans()
        expect(spans).toHaveLength(1)

        const span = spans[0]!
        expect(span.name).toBe('my-queue process')
        expect(span.kind).toBe(SpanKind.CONSUMER)

        expect(getSpanAttribute(span, 'faas.trigger')).toBe('pubsub')
        expect(getSpanAttribute(span, 'messaging.system')).toBe('aws_sqs')
        expect(getSpanAttribute(span, 'messaging.operation.type')).toBe('process')
        expect(getSpanAttribute(span, 'messaging.operation.name')).toBe('process')
        expect(getSpanAttribute(span, 'messaging.batch.message_count')).toBe(1)
      })

      it('creates span links for SQS batch messages with trace context', async () => {
        const handler = wrap(sdk.getTracer('test'), sqsTrigger, async () => {
          return { batchItemFailures: [] }
        })
        handler.resetColdStart()

        // Create batch with 3 records, each with X-Ray trace headers
        const event = createMockSqsEvent({
          queueName: 'batch-queue',
          records: [
            {
              body: 'message 1',
              awsTraceHeader:
                'Root=1-5f84c7a7-00000000aaaaaaaaaaaaaaaa;Parent=bbbbbbbbbbbbbbbb;Sampled=1',
            },
            {
              body: 'message 2',
              awsTraceHeader:
                'Root=1-5f84c7a7-00000000cccccccccccccccc;Parent=dddddddddddddddd;Sampled=1',
            },
            {
              body: 'message 3',
              awsTraceHeader:
                'Root=1-5f84c7a7-00000000eeeeeeeeeeeeeeee;Parent=ffffffffffffffff;Sampled=1',
            },
          ],
        })
        const context = createMockContext()

        await handler(event, context)

        const spans = sdk.getFinishedSpans()
        expect(spans).toHaveLength(1)

        const span = spans[0]!
        // First record becomes parent context, remaining 2 records become span links
        expect(span.links).toHaveLength(2)

        // Verify links have valid trace context
        expect(span.links[0]?.context.traceId).toBe('5f84c7a700000000cccccccccccccccc')
        expect(span.links[0]?.context.spanId).toBe('dddddddddddddddd')
        expect(span.links[1]?.context.traceId).toBe('5f84c7a700000000eeeeeeeeeeeeeeee')
        expect(span.links[1]?.context.spanId).toBe('ffffffffffffffff')
      })

      it('handles SQS event with empty Records array', async () => {
        const handler = wrap(sdk.getTracer('test'), sqsTrigger, async () => {
          return { batchItemFailures: [] }
        })
        handler.resetColdStart()

        // Create event with empty Records
        const event = { Records: [] }
        const context = createMockContext()

        await handler(event as Parameters<typeof handler>[0], context)

        const spans = sdk.getFinishedSpans()
        expect(spans).toHaveLength(1)

        const span = spans[0]!
        expect(span.name).toBe('multiple_sources process')
        expect(getSpanAttribute(span, 'messaging.batch.message_count')).toBe(0)
      })

      it('handles SQS messages without trace headers', async () => {
        const handler = wrap(sdk.getTracer('test'), sqsTrigger, async () => {
          return { batchItemFailures: [] }
        })
        handler.resetColdStart()

        const event = createMockSqsEvent({
          queueName: 'test-queue',
          records: [{ body: 'message without trace' }],
        })
        const context = createMockContext()

        await handler(event, context)

        const spans = sdk.getFinishedSpans()
        expect(spans).toHaveLength(1)

        const span = spans[0]!
        // Should still create span, just without parent context
        expect(span.name).toBe('test-queue process')
        expect(span.links).toHaveLength(0)
      })
    })

    describe('sns', () => {
      it('creates a span for SNS event', async () => {
        const handler = wrap(sdk.getTracer('test'), snsTrigger, async () => {
          return { success: true }
        })
        handler.resetColdStart()

        const event = createMockSnsEvent({ topicName: 'orders-topic' })
        const context = createMockContext()

        await handler(event, context)

        const spans = sdk.getFinishedSpans()
        expect(spans).toHaveLength(1)

        const span = spans[0]!
        expect(span.name).toBe('orders-topic process')
        expect(span.kind).toBe(SpanKind.CONSUMER)
        expect(getSpanAttribute(span, 'faas.trigger')).toBe('pubsub')
        expect(getSpanAttribute(span, 'messaging.system')).toBe('aws.sns')
        expect(getSpanAttribute(span, 'messaging.operation.type')).toBe('process')
        expect(getSpanAttribute(span, 'messaging.batch.message_count')).toBe(1)
      })
    })

    describe('kinesis', () => {
      it('creates a span for Kinesis event', async () => {
        const handler = wrap(sdk.getTracer('test'), kinesisTrigger, async () => {
          return { batchItemFailures: [] }
        })
        handler.resetColdStart()

        const event = createMockKinesisEvent({ streamName: 'orders-stream' })
        const context = createMockContext()

        await handler(event, context)

        const spans = sdk.getFinishedSpans()
        expect(spans).toHaveLength(1)

        const span = spans[0]!
        expect(span.name).toBe('orders-stream process')
        expect(span.kind).toBe(SpanKind.CONSUMER)
        expect(getSpanAttribute(span, 'faas.trigger')).toBe('pubsub')
        expect(getSpanAttribute(span, 'messaging.system')).toBe('aws_kinesis')
        expect(getSpanAttribute(span, 'messaging.operation.type')).toBe('process')
        expect(getSpanAttribute(span, 'messaging.batch.message_count')).toBe(1)
      })

      it('includes partition ID for same-shard records', async () => {
        const handler = wrap(sdk.getTracer('test'), kinesisTrigger, async () => {
          return { batchItemFailures: [] }
        })
        handler.resetColdStart()

        const event = createMockKinesisEvent({
          streamName: 'test-stream',
          records: [{ shardId: 'shardId-000000000001' }, { shardId: 'shardId-000000000001' }],
        })
        const context = createMockContext()

        await handler(event, context)

        const spans = sdk.getFinishedSpans()
        const span = spans[0]!
        expect(getSpanAttribute(span, 'aws.kinesis.shard_id')).toBe('shardId-000000000001')
      })
    })

    describe('dynamodb', () => {
      it('creates a span for DynamoDB stream event', async () => {
        const handler = wrap(sdk.getTracer('test'), dynamodbTrigger, async () => {
          return { batchItemFailures: [] }
        })
        handler.resetColdStart()

        const event = createMockDynamoDbEvent({ tableName: 'users' })
        const context = createMockContext()

        await handler(event, context)

        const spans = sdk.getFinishedSpans()
        expect(spans).toHaveLength(1)

        const span = spans[0]!
        expect(span.name).toBe('users process')
        expect(span.kind).toBe(SpanKind.CONSUMER)
        expect(getSpanAttribute(span, 'faas.trigger')).toBe('datasource')
        expect(getSpanAttribute(span, 'faas.document.collection')).toBe('users')
        expect(getSpanAttribute(span, 'faas.document.operation')).toBe('insert')
      })

      it('maps DynamoDB operations correctly', async () => {
        const handler = wrap(sdk.getTracer('test'), dynamodbTrigger, async () => {
          return { batchItemFailures: [] }
        })
        handler.resetColdStart()

        const modifyEvent = createMockDynamoDbEvent({
          tableName: 'users',
          records: [{ eventName: 'MODIFY' }],
        })

        await handler(modifyEvent, createMockContext())

        const span = sdk.getFinishedSpans()[0]!
        expect(getSpanAttribute(span, 'faas.document.operation')).toBe('edit')
      })
    })

    describe('s3', () => {
      it('creates a span for S3 event', async () => {
        const handler = wrap(sdk.getTracer('test'), s3Trigger, async () => {
          return { success: true }
        })
        handler.resetColdStart()

        const event = createMockS3Event({
          bucketName: 'uploads-bucket',
          records: [{ objectKey: 'images/photo.jpg' }],
        })
        const context = createMockContext()

        await handler(event, context)

        const spans = sdk.getFinishedSpans()
        expect(spans).toHaveLength(1)

        const span = spans[0]!
        expect(span.name).toBe('uploads-bucket process')
        expect(span.kind).toBe(SpanKind.CONSUMER)
        expect(getSpanAttribute(span, 'faas.trigger')).toBe('datasource')
        expect(getSpanAttribute(span, 'faas.document.collection')).toBe('uploads-bucket')
        expect(getSpanAttribute(span, 'faas.document.name')).toBe('images/photo.jpg')
        expect(getSpanAttribute(span, 'faas.document.operation')).toBe('insert')
      })

      it('maps S3 delete operations correctly', async () => {
        const handler = wrap(sdk.getTracer('test'), s3Trigger, async () => {
          return { success: true }
        })
        handler.resetColdStart()

        const event = createMockS3Event({
          bucketName: 'data-bucket',
          records: [{ eventName: 'ObjectRemoved:Delete', objectKey: 'file.txt' }],
        })

        await handler(event, createMockContext())

        const span = sdk.getFinishedSpans()[0]!
        expect(getSpanAttribute(span, 'faas.document.operation')).toBe('delete')
      })
    })

    describe('kafka', () => {
      it('creates a span for Kafka event', async () => {
        const handler = wrap(sdk.getTracer('test'), kafkaTrigger, async () => {
          return { batchItemFailures: [] }
        })
        handler.resetColdStart()

        const event = createMockKafkaEvent({ topicName: 'orders' })
        const context = createMockContext()

        await handler(event, context)

        const spans = sdk.getFinishedSpans()
        expect(spans).toHaveLength(1)

        const span = spans[0]!
        expect(span.name).toBe('orders process')
        expect(span.kind).toBe(SpanKind.CONSUMER)
        expect(getSpanAttribute(span, 'faas.trigger')).toBe('pubsub')
        expect(getSpanAttribute(span, 'messaging.system')).toBe('kafka')
        expect(getSpanAttribute(span, 'messaging.operation.type')).toBe('process')
      })
    })

    describe('eventbridge', () => {
      it('creates a span for EventBridge event', async () => {
        const handler = wrap(sdk.getTracer('test'), eventbridgeTrigger, async () => {
          return { success: true }
        })
        handler.resetColdStart()

        const event = createMockEventBridgeEvent({
          source: 'orders.service',
          detailType: 'OrderCreated',
        })
        const context = createMockContext()

        await handler(event, context)

        const spans = sdk.getFinishedSpans()
        expect(spans).toHaveLength(1)

        const span = spans[0]!
        expect(span.name).toBe('orders.service OrderCreated')
        expect(span.kind).toBe(SpanKind.CONSUMER)
        expect(getSpanAttribute(span, 'faas.trigger')).toBe('pubsub')
        expect(getSpanAttribute(span, 'aws.eventbridge.source')).toBe('orders.service')
        expect(getSpanAttribute(span, 'aws.eventbridge.detail_type')).toBe('OrderCreated')
      })
    })

    describe('cloudwatch', () => {
      it('creates a span for CloudWatch Logs event', async () => {
        const handler = wrap(sdk.getTracer('test'), cloudwatchTrigger, async () => {
          return { success: true }
        })
        handler.resetColdStart()

        const event = createMockCloudWatchLogsEvent({
          logGroup: '/aws/lambda/my-function',
          messages: ['Log message 1', 'Log message 2'],
        })
        const context = createMockContext()

        await handler(event, context)

        const spans = sdk.getFinishedSpans()
        expect(spans).toHaveLength(1)

        const span = spans[0]!
        expect(span.name).toBe('cloudwatch process')
        expect(span.kind).toBe(SpanKind.CONSUMER)
        expect(getSpanAttribute(span, 'faas.trigger')).toBe('datasource')
      })
    })

    describe('HTTP status code handling', () => {
      it('records http.response.status_code for successful responses', async () => {
        const handler = wrap(sdk.getTracer('test'), apiGatewayV2Trigger, async () => {
          return { statusCode: 201, body: 'created' }
        })
        handler.resetColdStart()

        await handler(createMockApiGatewayV2Event(), createMockContext())

        const span = sdk.getFinishedSpans()[0]!
        expect(getSpanAttribute(span, 'http.response.status_code')).toBe(201)
        expect(span.status.code).toBe(SpanStatusCode.OK)
      })

      it('sets ERROR status for 5xx responses', async () => {
        const handler = wrap(sdk.getTracer('test'), apiGatewayV2Trigger, async () => {
          return { statusCode: 500, body: 'Internal Server Error' }
        })
        handler.resetColdStart()

        await handler(createMockApiGatewayV2Event(), createMockContext())

        const span = sdk.getFinishedSpans()[0]!
        expect(getSpanAttribute(span, 'http.response.status_code')).toBe(500)
        expect(span.status.code).toBe(SpanStatusCode.ERROR)
        expect(getSpanAttribute(span, 'error.type')).toBe('500')
      })

      it('sets ERROR status for 503 responses', async () => {
        const handler = wrap(sdk.getTracer('test'), apiGatewayV2Trigger, async () => {
          return { statusCode: 503, body: 'Service Unavailable' }
        })
        handler.resetColdStart()

        await handler(createMockApiGatewayV2Event(), createMockContext())

        const span = sdk.getFinishedSpans()[0]!
        expect(getSpanAttribute(span, 'http.response.status_code')).toBe(503)
        expect(span.status.code).toBe(SpanStatusCode.ERROR)
        expect(getSpanAttribute(span, 'error.type')).toBe('503')
      })

      it('sets OK status for 4xx responses', async () => {
        const handler = wrap(sdk.getTracer('test'), apiGatewayV2Trigger, async () => {
          return { statusCode: 404, body: 'Not Found' }
        })
        handler.resetColdStart()

        await handler(createMockApiGatewayV2Event(), createMockContext())

        const span = sdk.getFinishedSpans()[0]!
        expect(getSpanAttribute(span, 'http.response.status_code')).toBe(404)
        expect(span.status.code).toBe(SpanStatusCode.OK)
      })
    })
  })

  describe('wrapWithEventDetection (dynamic detection)', () => {
    it('detects API Gateway V2 event', async () => {
      const autoWrap = wrapWithEventDetection(sdk.getTracer('test'))
      autoWrap.resetColdStart()
      autoWrap.resetDetector()

      const handler = autoWrap(async () => {
        return { statusCode: 200, body: 'ok' }
      })

      const event = createMockApiGatewayV2Event({
        method: 'POST',
        path: '/orders',
        routeKey: 'POST /orders',
      })
      const context = createMockContext()

      await handler(event, context)

      const spans = sdk.getFinishedSpans()
      expect(spans).toHaveLength(1)

      const span = spans[0]!
      expect(span.name).toBe('POST /orders')
      expect(getSpanAttribute(span, 'faas.trigger')).toBe('http')
    })

    it('detects SQS event', async () => {
      const autoWrap = wrapWithEventDetection(sdk.getTracer('test'))
      autoWrap.resetColdStart()
      autoWrap.resetDetector()

      const handler = autoWrap(async () => {
        return {}
      })

      const event = createMockSqsEvent({ queueName: 'orders-queue' })
      const context = createMockContext()

      await handler(event, context)

      const spans = sdk.getFinishedSpans()
      expect(spans).toHaveLength(1)

      const span = spans[0]!
      expect(span.name).toBe('orders-queue process')
      expect(getSpanAttribute(span, 'messaging.system')).toBe('aws_sqs')
    })

    it('detects SNS event', async () => {
      const autoWrap = wrapWithEventDetection(sdk.getTracer('test'))
      autoWrap.resetColdStart()
      autoWrap.resetDetector()

      const handler = autoWrap(async () => {
        return { success: true }
      })

      const event = createMockSnsEvent({ topicName: 'notifications' })
      const context = createMockContext()

      await handler(event, context)

      const spans = sdk.getFinishedSpans()
      expect(spans).toHaveLength(1)

      const span = spans[0]!
      expect(span.name).toBe('notifications process')
      expect(getSpanAttribute(span, 'messaging.system')).toBe('aws.sns')
    })

    it('detects EventBridge event', async () => {
      const autoWrap = wrapWithEventDetection(sdk.getTracer('test'))
      autoWrap.resetColdStart()
      autoWrap.resetDetector()

      const handler = autoWrap(async () => {
        return { success: true }
      })

      const event = createMockEventBridgeEvent({
        source: 'aws.ec2',
        detailType: 'EC2 Instance State-change Notification',
      })
      const context = createMockContext()

      await handler(event, context)

      const spans = sdk.getFinishedSpans()
      expect(spans).toHaveLength(1)

      const span = spans[0]!
      expect(span.name).toBe('aws.ec2 EC2 Instance State-change Notification')
      expect(getSpanAttribute(span, 'aws.eventbridge.source')).toBe('aws.ec2')
    })

    it('records errors on the span with dynamic detection', async () => {
      const autoWrap = wrapWithEventDetection(sdk.getTracer('test'))
      autoWrap.resetColdStart()
      autoWrap.resetDetector()

      const handler = autoWrap(async () => {
        throw new Error('Dynamic detection error')
      })

      const event = createMockApiGatewayV2Event()
      const context = createMockContext()

      await expect(handler(event, context)).rejects.toThrow('Dynamic detection error')

      const spans = sdk.getFinishedSpans()
      expect(spans).toHaveLength(1)

      const span = spans[0]!
      expect(span.status.code).toBe(SpanStatusCode.ERROR)
      expect(span.status.message).toBe('Dynamic detection error')
    })
  })

  describe('assertion helpers', () => {
    it('finds spans by name', async () => {
      const handler = wrap(sdk.getTracer('test'), apiGatewayV2Trigger, async () => {
        return { statusCode: 200, body: 'ok' }
      })
      handler.resetColdStart()

      await handler(
        createMockApiGatewayV2Event({ method: 'GET', routeKey: 'GET /test' }),
        createMockContext(),
      )

      const spans = sdk.getFinishedSpans()

      const span = findSpan(spans, { name: 'GET /test' })
      expect(span).toBeDefined()

      const spanByRegex = findSpan(spans, { name: /GET.*/ })
      expect(spanByRegex).toBeDefined()
    })

    it('finds spans by attributes', async () => {
      const handler = wrap(sdk.getTracer('test'), apiGatewayV2Trigger, async () => {
        return { statusCode: 200, body: 'ok' }
      })
      handler.resetColdStart()

      await handler(createMockApiGatewayV2Event(), createMockContext())

      const spans = sdk.getFinishedSpans()

      const span = assertSpanExists(spans, {
        attributes: { 'faas.trigger': 'http' },
      })
      expect(span).toBeDefined()
    })
  })
})
