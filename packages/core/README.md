# @semantic-lambda/core

[![npm version](https://img.shields.io/npm/v/@semantic-lambda/core.svg)](https://www.npmjs.com/package/@semantic-lambda/core)
[![npm downloads](https://img.shields.io/npm/dm/@semantic-lambda/core.svg)](https://www.npmjs.com/package/@semantic-lambda/core)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@semantic-lambda/core)](https://bundlephobia.com/package/@semantic-lambda/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Wrap AWS Lambda handlers with OpenTelemetry semantic spans following the [FaaS semantic conventions](https://opentelemetry.io/docs/specs/semconv/faas/faas-spans/).

## Installation

```bash
npm install @semantic-lambda/core
# or
yarn add @semantic-lambda/core
```

## Quick Start

```typescript
import { trace } from '@opentelemetry/api'
import { wrap, apiGatewayV2Trigger } from '@semantic-lambda/core'

const tracer = trace.getTracer('my-service')

// Explicit trigger type (recommended for best performance and type safety)
export const handler = wrap(tracer, apiGatewayV2Trigger, async (event, context) => {
  // Your handler logic - runs within an OpenTelemetry span
  // event is fully typed as APIGatewayProxyEventV2
  return { statusCode: 200, body: JSON.stringify({ message: 'Hello' }) }
})
```

## Usage Patterns

### Explicit Trigger Type

Specify the trigger type for best performance and type safety:

```typescript
import { wrap, apiGatewayV2Trigger, sqsTrigger, snsTrigger } from '@semantic-lambda/core'

// API Gateway v2 / HTTP API
export const handler = wrap(tracer, apiGatewayV2Trigger, async (event, context) => {
  return { statusCode: 200, body: 'ok' }
})

// SQS
export const sqsHandler = wrap(tracer, sqsTrigger, async (event, context) => {
  for (const record of event.Records) {
    // Process each message
  }
  return { batchItemFailures: [] }
})

// SNS
export const snsHandler = wrap(tracer, snsTrigger, async (event, context) => {
  for (const record of event.Records) {
    const message = record.Sns.Message
    // Process notification
  }
})
```

### Dynamic Detection

For multi-trigger lambdas, use the `/auto` entry point which detects event types at runtime:

```typescript
import { wrapWithEventDetection } from '@semantic-lambda/core/auto'

const autoWrap = wrapWithEventDetection(tracer)

export const handler = autoWrap(async (event, context) => {
  // Event type is detected automatically (cached after first invocation)
  return { statusCode: 200, body: 'ok' }
})
```

### Custom Span Names

Override the default span name:

```typescript
export const handler = wrap(tracer, apiGatewayV2Trigger, async (event, context) => {
  return { statusCode: 200, body: 'ok' }
}, { spanNameOverride: 'ProcessUserRequest' })
```

## Supported Triggers

| Trigger | Span Name Format | Semantic Attributes |
|---------|-----------------|---------------------|
| `apiGateway` | `{method} {route}` | HTTP attributes |
| `apiGatewayV2` | `{method} {route}` | HTTP attributes |
| `alb` | `{method} {path}` | HTTP attributes |
| `lambdaUrl` | `{method} {route}` | HTTP attributes |
| `sqs` | `{queue} process` | Messaging attributes |
| `sns` | `{topic} process` | Messaging attributes |
| `kinesis` | `{stream} process` | Messaging attributes |
| `kafka` | `{topic} process` | Messaging attributes |
| `eventBridge` | `{function}` | - |
| `dynamoDb` | `{table} process` | Datasource attributes |
| `s3` | `{bucket} process` | Datasource attributes |
| `cloudWatch` | `{function}` | - |

## Semantic Attributes

The wrapper automatically sets these attributes according to OTel conventions:

### Common (all triggers)
- `faas.invocation_id` - AWS Request ID
- `faas.name` - Function name
- `faas.version` - Function version
- `faas.coldstart` - Whether this is a cold start
- `faas.trigger` - Trigger category (http, pubsub, datasource, timer)
- `cloud.provider` - `aws`
- `cloud.region` - AWS region
- `cloud.account.id` - AWS account ID

### HTTP triggers
- `http.request.method` - HTTP method
- `http.route` - Route pattern
- `url.path` - Request path
- `url.query` - Query string
- `url.scheme` - HTTP/HTTPS
- `server.address` - Host header
- `client.address` - Source IP
- `user_agent.original` - User agent

### Messaging triggers (SQS, SNS, Kinesis, Kafka)
- `messaging.system` - `aws_sqs`, `aws_sns`, `aws_kinesis`, `kafka`
- `messaging.operation.type` - `process`
- `messaging.destination.name` - Queue/topic/stream name
- `messaging.batch.message_count` - Number of messages

## Error Handling

Errors thrown from your handler are automatically captured on the span:

```typescript
export const handler = wrap(tracer, apiGatewayV2Trigger, async (event, context) => {
  // Just throw - the library handles the rest
  throw new Error('Something went wrong')
})
```

When an error is thrown:
1. The span status is set to `ERROR` with the error message
2. The full exception (including stack trace) is recorded via `recordException()`
3. The error is re-thrown so Lambda runtime handles it normally

This means you don't need try/catch blocks for observability purposes. The error will still:
- Trigger Lambda retries for async invocations (SQS, streams)
- Appear in CloudWatch logs
- Increment Lambda error metrics

If you need to handle errors yourself while still recording them, you can create child spans:

```typescript
import { trace, SpanStatusCode } from '@opentelemetry/api'
import { wrap, sqsTrigger } from '@semantic-lambda/core'

export const handler = wrap(tracer, sqsTrigger, async (event, context) => {
  for (const record of event.Records) {
    const span = trace.getTracer('my-service').startSpan('processRecord')
    try {
      await processRecord(record)
      span.setStatus({ code: SpanStatusCode.OK })
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
      span.recordException(error)
      // Handle error (e.g., add to batchItemFailures) instead of re-throwing
    } finally {
      span.end()
    }
  }
  return { batchItemFailures: [] }
})
```

## Context Propagation

The wrapper automatically extracts trace context from:
- **HTTP triggers**: W3C Trace Context headers (`traceparent`, `tracestate`)
- **SQS**: X-Ray trace header in message attributes

## Performance

Benchmarks on typical hardware show:
- **Warm invocation overhead**: ~7µs per request
- **Explicit vs Dynamic**: Explicit trigger type is ~12-14% faster
- **Batch scaling**: Linear with message count

For latency-critical applications, prefer explicit trigger types.

## Related Packages

- [`@semantic-lambda/testing`](../testing) - Testing utilities with in-memory exporters

## Licence

MIT
