# Winston Logging with OpenTelemetry Context

This example demonstrates how to configure Winston logging so that log entries automatically include the OpenTelemetry trace context (trace ID, span ID). This enables correlation between logs and traces in observability platforms.

## Setup

Install the required dependencies:

```bash
npm install winston @opentelemetry/api @opentelemetry/instrumentation-winston
```

## Basic Configuration

### Option 1: Using OpenTelemetry Winston Instrumentation (Recommended)

The `@opentelemetry/instrumentation-winston` package automatically injects trace context into Winston logs:

```typescript
// instrumentation.ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http'
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston'
import { resourceFromAttributes } from '@opentelemetry/resources'

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': process.env.AWS_LAMBDA_FUNCTION_NAME ?? 'my-lambda',
  }),
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [
    new WinstonInstrumentation({
      // Inject trace context into log records
      logHook: (span, record) => {
        record['resource.service.name'] = 'my-lambda'
      },
    }),
  ],
})

sdk.start()

export { sdk }
```

```typescript
// logger.ts
import winston from 'winston'

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
})
```

With this setup, logs automatically include `trace_id`, `span_id`, and `trace_flags` fields when logged within an active span context.

### Option 2: Manual Context Injection

If you prefer manual control or can't use the instrumentation package:

```typescript
// logger.ts
import winston from 'winston'
import { trace, context } from '@opentelemetry/api'

const otelFormat = winston.format((info) => {
  const span = trace.getSpan(context.active())
  if (span) {
    const spanContext = span.spanContext()
    info.trace_id = spanContext.traceId
    info.span_id = spanContext.spanId
    info.trace_flags = spanContext.traceFlags.toString(16).padStart(2, '0')
  }
  return info
})

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    otelFormat(),
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
})
```

## Complete Lambda Example

```typescript
// instrumentation.ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http'
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston'
import { resourceFromAttributes } from '@opentelemetry/resources'

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': process.env.AWS_LAMBDA_FUNCTION_NAME ?? 'my-lambda',
    'cloud.provider': 'aws',
    'cloud.region': process.env.AWS_REGION ?? 'unknown',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
  instrumentations: [new WinstonInstrumentation()],
})

sdk.start()

export { sdk }
```

```typescript
// handler.ts
import './instrumentation.js'
import { trace } from '@opentelemetry/api'
import { wrap, apiGatewayV2Trigger } from '@semantic-lambda/core'
import winston from 'winston'

const tracer = trace.getTracer('my-service', '1.0.0')

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
})

export const handler = wrap(tracer, apiGatewayV2Trigger, async (event, context) => {
  const userId = event.pathParameters?.id

  // This log will automatically include trace_id, span_id, trace_flags
  logger.info('Processing request', { userId, path: event.rawPath })

  try {
    const result = await processUser(userId)

    logger.info('Request completed successfully', { userId, result })

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    }
  } catch (error) {
    // Error logs also include trace context for correlation
    logger.error('Request failed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
})

async function processUser(userId: string | undefined) {
  // Simulate processing
  logger.debug('Looking up user', { userId })
  return { id: userId, name: 'Test User' }
}
```

## Example Log Output

When running within an active span, logs will include trace context:

```json
{
  "level": "info",
  "message": "Processing request",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "userId": "123",
  "path": "/users/123",
  "trace_id": "0af7651916cd43dd8448eb211c80319c",
  "span_id": "b7ad6b7169203331",
  "trace_flags": "01"
}
```

## Using with Log Aggregators

### AWS CloudWatch

CloudWatch Logs Insights can query by trace ID:

```
fields @timestamp, @message
| filter trace_id = "0af7651916cd43dd8448eb211c80319c"
| sort @timestamp asc
```

### Datadog

Datadog automatically correlates logs and traces when `dd.trace_id` and `dd.span_id` are present. Map the OTel fields:

```typescript
const datadogFormat = winston.format((info) => {
  if (info.trace_id) {
    // Convert hex trace ID to Datadog's decimal format
    info['dd.trace_id'] = BigInt('0x' + info.trace_id.slice(-16)).toString()
    info['dd.span_id'] = BigInt('0x' + info.span_id).toString()
  }
  return info
})
```

### Grafana Loki

Use the Loki integration with Tempo for trace-to-log correlation:

```typescript
const lokiFormat = winston.format.combine(
  otelFormat(),
  winston.format.label({ label: 'my-lambda' }),
  winston.format.json(),
)
```

## Testing Log Context

Use `@semantic-lambda/testing` to verify logs include trace context:

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { createTestSdk, createMockApiGatewayV2Event, createMockContext } from '@semantic-lambda/testing'
import { wrap, apiGatewayV2Trigger } from '@semantic-lambda/core'
import { trace, context } from '@opentelemetry/api'

describe('Winston logging with OTel context', () => {
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

  it('logs include trace context within span', async () => {
    const logSpy = vi.fn()
    const tracer = sdk.getTracer('test')

    const handler = wrap(tracer, apiGatewayV2Trigger, async () => {
      const span = trace.getSpan(context.active())
      if (span) {
        const ctx = span.spanContext()
        logSpy({
          trace_id: ctx.traceId,
          span_id: ctx.spanId,
        })
      }
      return { statusCode: 200, body: 'ok' }
    })

    await handler(createMockApiGatewayV2Event(), createMockContext())

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        trace_id: expect.stringMatching(/^[0-9a-f]{32}$/),
        span_id: expect.stringMatching(/^[0-9a-f]{16}$/),
      })
    )

    // Verify the trace ID matches the span
    const spans = sdk.getFinishedSpans()
    const span = spans[0]
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        trace_id: span.spanContext().traceId,
      })
    )
  })
})
```

## Best Practices

1. **Always log within the span context** - The trace context is only available when there's an active span
2. **Use structured logging** - JSON format makes it easy to parse and query trace IDs
3. **Include meaningful context** - Add business-relevant fields alongside trace context
4. **Set appropriate log levels** - Use debug for verbose logging, info for key events
5. **Consider log volume** - Trace context adds ~80 bytes per log entry

## Troubleshooting

### Logs don't have trace context

- Ensure the Winston instrumentation is registered before creating the logger
- Verify logging happens within an active span (inside the handler function)
- Check that `@opentelemetry/instrumentation-winston` is installed

### Trace IDs don't match

- Ensure you're using the same tracer provider for both spans and logs
- Check that context propagation is working correctly between services
