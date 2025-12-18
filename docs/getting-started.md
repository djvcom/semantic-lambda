# Getting Started

This guide walks you through setting up `@semantic-lambda/core` in your AWS Lambda project.

## Prerequisites

- Node.js 24 or later
- An existing Lambda project with TypeScript
- OpenTelemetry SDK configured (or use `@semantic-lambda/testing` for tests)

## Installation

```bash
npm install @semantic-lambda/core @opentelemetry/api
```

For a production setup, you'll also need:

```bash
npm install @opentelemetry/sdk-node @opentelemetry/exporter-otlp-http
```

## Basic Setup

### 1. Configure OpenTelemetry

Create an instrumentation file that runs before your handler:

```typescript
// instrumentation.ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': process.env.AWS_LAMBDA_FUNCTION_NAME ?? 'my-lambda',
    'service.version': process.env.AWS_LAMBDA_FUNCTION_VERSION ?? '$LATEST',
    'cloud.provider': 'aws',
    'cloud.region': process.env.AWS_REGION ?? 'unknown',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
  }),
})

sdk.start()

export { sdk }
```

### 2. Create Your Handler

```typescript
// handler.ts
import './instrumentation.js'
import { trace } from '@opentelemetry/api'
import { wrap, apiGatewayV2Trigger } from '@semantic-lambda/core'

const tracer = trace.getTracer('my-service', '1.0.0')

export const handler = wrap(tracer, apiGatewayV2Trigger, async (event, context) => {
  // Your business logic here
  // event is fully typed as APIGatewayProxyEventV2
  const userId = event.pathParameters?.id

  // Create child spans for sub-operations
  const span = trace.getActiveSpan()

  return {
    statusCode: 200,
    body: JSON.stringify({ userId }),
  }
})
```

### 3. Configure Your Lambda

Set these environment variables in your Lambda configuration:

```yaml
# serverless.yml example
environment:
  OTEL_EXPORTER_OTLP_ENDPOINT: https://your-collector.example.com
  OTEL_SERVICE_NAME: ${self:service}
```

## Choosing Between Explicit and Dynamic Detection

### Explicit Trigger Type (Recommended)

```typescript
import { wrap, apiGatewayV2Trigger } from '@semantic-lambda/core'

export const handler = wrap(tracer, apiGatewayV2Trigger, async (event, context) => {
  // TypeScript knows event is APIGatewayProxyEventV2
  return { statusCode: 200, body: 'ok' }
})
```

**Advantages:**
- Full TypeScript type inference
- ~12-14% faster (no schema validation)
- Clearer code intent

### Dynamic Detection

For multi-trigger lambdas, use the `/auto` entry point:

```typescript
import { wrapWithEventDetection } from '@semantic-lambda/core/auto'

const autoWrap = wrapWithEventDetection(tracer)

export const handler = autoWrap(async (event, context) => {
  // Event type detected at runtime
  return { statusCode: 200, body: 'ok' }
})
```

**Advantages:**
- Simpler code for multi-trigger lambdas
- Detection result is cached after first invocation

## Error Handling

Errors thrown from your handler are automatically captured on the span. You don't need try/catch blocks for observability:

```typescript
export const handler = wrap(tracer, apiGatewayV2Trigger, async (event, context) => {
  const user = await getUser(event.pathParameters?.id)
  if (!user) {
    // Just throw - the error is recorded on the span automatically
    throw new Error('User not found')
  }
  return { statusCode: 200, body: JSON.stringify(user) }
})
```

When an error is thrown:
1. The span status is set to `ERROR` with the error message
2. The full exception (including stack trace) is recorded
3. The error is re-thrown so Lambda handles it normally (retries, CloudWatch, metrics)

## Creating Child Spans

For complex operations, create child spans within your handler:

```typescript
import { trace, SpanKind, SpanStatusCode } from '@opentelemetry/api'
import { wrap, sqsTrigger } from '@semantic-lambda/core'

export const handler = wrap(tracer, sqsTrigger, async (event, context) => {
  const batchItemFailures: { itemIdentifier: string }[] = []

  for (const record of event.Records) {
    await tracer.startActiveSpan(
      `process ${record.messageId}`,
      { kind: SpanKind.INTERNAL },
      async span => {
        try {
          const body = JSON.parse(record.body)
          await processMessage(body)
          span.setStatus({ code: SpanStatusCode.OK })
        } catch (error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
          span.recordException(error)
          batchItemFailures.push({ itemIdentifier: record.messageId })
        } finally {
          span.end()
        }
      }
    )
  }

  return { batchItemFailures }
})
```

## Using with Middy

`@semantic-lambda/core` is compatible with Middy middleware. Import the middleware adapter:

```typescript
import middy from '@middy/core'
import httpJsonBodyParser from '@middy/http-json-body-parser'
import { trace } from '@opentelemetry/api'
import { semanticSpanMiddleware } from '@semantic-lambda/core/middy'

const tracer = trace.getTracer('my-service')

const baseHandler = async (event, context) => {
  return { statusCode: 200, body: JSON.stringify(event.body) }
}

export const handler = middy(baseHandler)
  .use(semanticSpanMiddleware(tracer, { trigger: 'apiGatewayV2' }))
  .use(httpJsonBodyParser())
```

## Next Steps

- [Examples](./examples/) - Complete working examples
- [Advanced Usage](./advanced.md) - Power user features, custom triggers, and extractors
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
- [@semantic-lambda/testing](../packages/testing/README.md) - Testing utilities with in-memory exporters
