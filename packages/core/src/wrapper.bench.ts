import { trace } from '@opentelemetry/api'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import {
  createMockApiGatewayV2Event,
  createMockContext,
  createMockSqsEvent,
  InMemorySpanExporter,
} from '@semantic-lambda/testing'
import { bench, describe } from 'vitest'
import { wrapWithEventDetection } from './entries/auto'
import { apiGatewayV2Trigger, sqsTrigger, wrap } from './index'

const exporter = new InMemorySpanExporter()
const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({ 'service.name': 'benchmark' }),
  spanProcessors: [new SimpleSpanProcessor(exporter)],
})
provider.register()

const tracer = trace.getTracer('benchmark')

const apiGatewayEvent = createMockApiGatewayV2Event({
  method: 'GET',
  path: '/users/123',
  routeKey: 'GET /users/{id}',
})

const sqsEvent = createMockSqsEvent({
  queueName: 'orders-queue',
  records: [{ body: JSON.stringify({ orderId: '123' }) }],
})

const context = createMockContext({ functionName: 'benchmark-function' })

const noopHandler = async (_event: unknown, _context: unknown) => ({ statusCode: 200, body: 'ok' })
const sqsNoopHandler = async (_event: unknown, _context: unknown) => ({ batchItemFailures: [] })

describe('wrap() - API Gateway V2', () => {
  const explicitHandler = wrap(tracer, apiGatewayV2Trigger, noopHandler)

  const autoWrap = wrapWithEventDetection(tracer)
  const dynamicHandler = autoWrap(noopHandler)

  bench('explicit trigger type (warm)', async () => {
    exporter.reset()
    await explicitHandler(apiGatewayEvent, context)
  })

  bench('dynamic event detection (warm)', async () => {
    exporter.reset()
    await dynamicHandler(apiGatewayEvent, context)
  })

  bench('cold start simulation', async () => {
    exporter.reset()
    const freshHandler = wrap(tracer, apiGatewayV2Trigger, noopHandler)
    await freshHandler(apiGatewayEvent, context)
  })

  bench('baseline (no instrumentation)', async () => {
    await noopHandler(apiGatewayEvent, context)
  })
})

describe('wrap() - SQS', () => {
  const explicitHandler = wrap(tracer, sqsTrigger, sqsNoopHandler)

  const autoWrap = wrapWithEventDetection(tracer)
  const dynamicHandler = autoWrap(sqsNoopHandler)

  bench('explicit trigger type (warm)', async () => {
    exporter.reset()
    await explicitHandler(sqsEvent, context)
  })

  bench('dynamic event detection (warm)', async () => {
    exporter.reset()
    await dynamicHandler(sqsEvent, context)
  })

  bench('baseline (no instrumentation)', async () => {
    await sqsNoopHandler(sqsEvent, context)
  })
})

describe('Event detection overhead', () => {
  bench('API Gateway V2 detection', async () => {
    const autoWrap = wrapWithEventDetection(tracer)
    const handler = autoWrap(noopHandler)
    exporter.reset()
    await handler(apiGatewayEvent, context)
  })

  bench('SQS detection', async () => {
    const autoWrap = wrapWithEventDetection(tracer)
    const handler = autoWrap(sqsNoopHandler)
    exporter.reset()
    await handler(sqsEvent, context)
  })
})

describe('Memory allocation', () => {
  bench('span creation and cleanup', async () => {
    exporter.reset()
    const handler = wrap(tracer, apiGatewayV2Trigger, noopHandler)
    await handler(apiGatewayEvent, context)
  })

  bench('batch processing (10 messages)', async () => {
    const largeSqsEvent = createMockSqsEvent({
      queueName: 'batch-queue',
      records: Array.from({ length: 10 }, (_, i) => ({
        body: JSON.stringify({ messageId: i }),
      })),
    })
    const handler = wrap(tracer, sqsTrigger, sqsNoopHandler)
    exporter.reset()
    await handler(largeSqsEvent, context)
  })

  bench('batch processing (100 messages)', async () => {
    const largeSqsEvent = createMockSqsEvent({
      queueName: 'batch-queue',
      records: Array.from({ length: 100 }, (_, i) => ({
        body: JSON.stringify({ messageId: i }),
      })),
    })
    const handler = wrap(tracer, sqsTrigger, sqsNoopHandler)
    exporter.reset()
    await handler(largeSqsEvent, context)
  })
})
