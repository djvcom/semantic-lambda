import { Writable } from 'node:stream'
import { context, trace } from '@opentelemetry/api'
import {
  createMockApiGatewayV2Event,
  createMockContext,
  createMockSqsEvent,
  createTestSdk,
  type TestSdk,
} from '@semantic-lambda/testing'
import type { SQSEvent } from 'aws-lambda'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import winston from 'winston'
import { apiGatewayV2Trigger, sqsTrigger, wrap } from './index'

/**
 * Custom Winston format that injects OTel trace context into log records.
 * This is the manual approach - alternatively use @opentelemetry/instrumentation-winston
 */
const otelFormat = winston.format(info => {
  const span = trace.getSpan(context.active())
  if (span) {
    const spanContext = span.spanContext()
    info.trace_id = spanContext.traceId
    info.span_id = spanContext.spanId
    info.trace_flags = spanContext.traceFlags.toString(16).padStart(2, '0')
  }
  return info
})

describe('Winston logging with OpenTelemetry context', () => {
  let sdk: TestSdk
  let logOutput: Array<Record<string, unknown>>
  let logger: winston.Logger

  beforeAll(() => {
    sdk = createTestSdk()
  })

  beforeEach(() => {
    sdk.reset()
    logOutput = []

    const captureStream = new Writable({
      write(chunk, _encoding, callback) {
        const message = chunk.toString().trim()
        if (message) {
          logOutput.push(JSON.parse(message))
        }
        callback()
      },
    })

    logger = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(otelFormat(), winston.format.json()),
      transports: [new winston.transports.Stream({ stream: captureStream })],
    })
  })

  afterAll(async () => {
    await sdk.shutdown()
  })

  it('logs include trace context when within a span', async () => {
    const handler = wrap(sdk.getTracer('test'), apiGatewayV2Trigger, async () => {
      logger.info('Processing request', { userId: '123' })
      return { statusCode: 200, body: 'ok' }
    })
    handler.resetColdStart()

    await handler(createMockApiGatewayV2Event(), createMockContext())

    expect(logOutput).toHaveLength(1)
    const logEntry = logOutput[0]!

    expect(logEntry.message).toBe('Processing request')
    expect(logEntry.userId).toBe('123')
    expect(logEntry.trace_id).toMatch(/^[0-9a-f]{32}$/)
    expect(logEntry.span_id).toMatch(/^[0-9a-f]{16}$/)
    expect(logEntry.trace_flags).toBe('01')
  })

  it('log trace_id matches the span trace_id', async () => {
    const handler = wrap(sdk.getTracer('test'), apiGatewayV2Trigger, async () => {
      logger.info('Test log')
      return { statusCode: 200, body: 'ok' }
    })
    handler.resetColdStart()

    await handler(createMockApiGatewayV2Event(), createMockContext())

    const spans = sdk.getFinishedSpans()
    expect(spans).toHaveLength(1)

    const span = spans[0]!
    const logEntry = logOutput[0]!

    expect(logEntry.trace_id).toBe(span.spanContext().traceId)
    expect(logEntry.span_id).toBe(span.spanContext().spanId)
  })

  it('multiple logs share the same trace context', async () => {
    const handler = wrap(sdk.getTracer('test'), apiGatewayV2Trigger, async () => {
      logger.info('Start processing')
      logger.debug('Processing step 1')
      logger.info('End processing')
      return { statusCode: 200, body: 'ok' }
    })
    handler.resetColdStart()

    await handler(createMockApiGatewayV2Event(), createMockContext())

    expect(logOutput).toHaveLength(3)

    const traceIds = logOutput.map(log => log.trace_id)
    const spanIds = logOutput.map(log => log.span_id)

    expect(new Set(traceIds).size).toBe(1)
    expect(new Set(spanIds).size).toBe(1)
  })

  it('logs outside span context have no trace fields', async () => {
    logger.info('Log outside span')

    expect(logOutput).toHaveLength(1)
    const logEntry = logOutput[0]!

    expect(logEntry.trace_id).toBeUndefined()
    expect(logEntry.span_id).toBeUndefined()
  })

  it('error logs include trace context', async () => {
    const handler = wrap(sdk.getTracer('test'), apiGatewayV2Trigger, async () => {
      try {
        throw new Error('Something went wrong')
      } catch (error) {
        logger.error('Request failed', {
          error: error instanceof Error ? error.message : String(error),
        })
      }
      return { statusCode: 500, body: 'error' }
    })
    handler.resetColdStart()

    await handler(createMockApiGatewayV2Event(), createMockContext())

    expect(logOutput).toHaveLength(1)
    const logEntry = logOutput[0]!

    expect(logEntry.level).toBe('error')
    expect(logEntry.error).toBe('Something went wrong')
    expect(logEntry.trace_id).toMatch(/^[0-9a-f]{32}$/)
  })

  it('SQS handler logs include correct trace context', async () => {
    const handler = wrap(sdk.getTracer('test'), sqsTrigger, async (event: SQSEvent) => {
      for (const record of event.Records) {
        logger.info('Processing message', { messageId: record.messageId })
      }
      return { batchItemFailures: [] }
    })
    handler.resetColdStart()

    await handler(
      createMockSqsEvent({
        queueName: 'test-queue',
        records: [{ body: 'test' }],
      }),
      createMockContext(),
    )

    expect(logOutput).toHaveLength(1)
    const logEntry = logOutput[0]!

    expect(logEntry.trace_id).toMatch(/^[0-9a-f]{32}$/)

    const spans = sdk.getFinishedSpans()
    expect(logEntry.trace_id).toBe(spans[0]!.spanContext().traceId)
  })
})
