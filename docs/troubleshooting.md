# Troubleshooting

Common issues and solutions when using `@semantic-lambda/core`.

## No Spans Being Exported

### Check OpenTelemetry SDK is initialised

The OTel SDK must be started before your handler runs:

```typescript
// instrumentation.ts - must be imported FIRST
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http'

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
})
sdk.start()

// handler.ts
import './instrumentation.js' // First import!
import { wrap, sqsTrigger } from '@semantic-lambda/core'
```

### Check tracer is valid

Ensure you're getting a tracer from the API, not a no-op:

```typescript
import { trace } from '@opentelemetry/api'

const tracer = trace.getTracer('my-service')

// Debug: check if tracer is active
console.log('Tracer provider:', trace.getTracerProvider())
```

### Check exporter endpoint

Verify the OTLP endpoint is reachable from Lambda:

```bash
# Test connectivity from your Lambda VPC
curl -X POST https://your-collector:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Trigger Not Detected

### Event structure doesn't match schema

Auto-detection validates against Zod schemas. If your event doesn't match any schema, no trigger is detected:

```typescript
import { detectEventType } from '@semantic-lambda/core/extractors'

// Debug detection
const result = detectEventType(event)
if (!result) {
  console.log('No trigger detected for event:', JSON.stringify(event, null, 2))
}
```

### Use explicit trigger instead

If auto-detection fails, use explicit triggers:

```typescript
// Instead of auto-detection
import { wrapWithEventDetection } from '@semantic-lambda/core/auto'

// Use explicit trigger
import { wrap, sqsTrigger } from '@semantic-lambda/core'
export const handler = wrap(tracer, sqsTrigger, async (event) => { /* ... */ })
```

## TypeScript Type Errors

### Event type is `unknown`

With auto-detection, the event type is `unknown`. Use explicit triggers for type safety:

```typescript
// Type-safe with explicit trigger
import { wrap, sqsTrigger } from '@semantic-lambda/core'

export const handler = wrap(tracer, sqsTrigger, async (event, context) => {
  // event is SQSEvent
  for (const record of event.Records) { // ✓ TypeScript knows this is valid
    console.log(record.body)
  }
})
```

### Missing type exports

Some types need explicit imports:

```typescript
import type { TriggerConfig, TriggerCategory } from '@semantic-lambda/core'
import type { SQSEvent } from 'aws-lambda'
```

## Cold Start Always True

### Multiple wrapper instances

Each wrapper instance has its own cold start tracker:

```typescript
// Wrong: new wrapper per invocation
export const handler = async (event, context) => {
  const wrap = wrapWithEventDetection(tracer) // New tracker each time!
  return wrap(async () => { /* ... */ })(event, context)
}

// Correct: wrapper created once at module level
const wrap = wrapWithEventDetection(tracer)
export const handler = wrap(async (event, context) => { /* ... */ })
```

### Testing cold start

Reset cold start state between tests:

```typescript
import { describe, beforeEach, it } from 'vitest'

describe('handler', () => {
  let handler: ReturnType<typeof wrap>

  beforeEach(() => {
    // Create fresh handler with reset cold start
    handler = wrap(tracer, sqsTrigger, myHandler)
    handler.resetColdStart()
  })

  it('reports cold start on first invocation', async () => {
    await handler(event, context)
    // Check span has faas.coldstart = true
  })
})
```

## Middy Context Not Propagating

### Span context limitation

Due to Middy's architecture, the span context isn't automatically propagated via OpenTelemetry's context API. Use the provided helpers:

```typescript
import middy from '@middy/core'
import {
  semanticSpanMiddleware,
  getSpanFromMiddyRequest,
  getParentContextFromMiddyRequest,
} from '@semantic-lambda/core/middy'

const myMiddleware = () => ({
  before: (request) => {
    // Get the span created by semanticSpanMiddleware
    const span = getSpanFromMiddyRequest(request)
    if (span) {
      span.setAttribute('custom.attribute', 'value')
    }

    // Get parent context for child spans
    const parentContext = getParentContextFromMiddyRequest(request)
    // Use parentContext with tracer.startSpan()
  },
})

export const handler = middy(baseHandler)
  .use(semanticSpanMiddleware(tracer)) // Must be first
  .use(myMiddleware())
```

## High Cardinality Span Names

### ALB paths with IDs

ALB span names include the path, which can cause high cardinality if paths contain dynamic IDs:

```
GET /users/123      ← High cardinality
GET /users/456
GET /users/789
```

Use `spanNameOverride` to normalise:

```typescript
import { wrap, albTrigger } from '@semantic-lambda/core'

export const handler = wrap(tracer, albTrigger, myHandler, {
  spanNameOverride: 'GET /users/{id}', // Normalised
})
```

Or use API Gateway with route templates which automatically use the route pattern.

## Bundle Size Issues

### All triggers included unexpectedly

Check your imports - `/auto` includes all triggers:

```typescript
// Large bundle: includes all 12 trigger schemas
import { wrapWithEventDetection } from '@semantic-lambda/core/auto'

// Smaller bundle: only SQS schema
import { wrap, sqsTrigger } from '@semantic-lambda/core'
```

### Tree-shaking not working

Ensure your bundler supports tree-shaking and you're using ES modules:

```json
// package.json
{
  "type": "module"
}
```

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

## X-Ray Trace Context Not Propagating

### Check X-Ray is enabled

The `_X_AMZN_TRACE_ID` environment variable must be set by Lambda:

```typescript
console.log('X-Ray header:', process.env._X_AMZN_TRACE_ID)
// Should be: Root=1-xxx;Parent=xxx;Sampled=1
```

Enable X-Ray tracing in your Lambda configuration:

```yaml
# serverless.yml
provider:
  tracing:
    lambda: true
```

### Check propagator registration

For outbound HTTP calls to include trace context:

```typescript
import { propagation } from '@opentelemetry/api'
import { lambdaPropagator } from '@semantic-lambda/core/extractors'

propagation.setGlobalPropagator(lambdaPropagator)
```

## Still Having Issues?

1. Enable debug logging:
   ```typescript
   import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api'
   diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG)
   ```

2. Check the [GitHub issues](https://github.com/your-org/semantic-lambda/issues) for similar problems

3. File a new issue with:
   - Node.js version
   - Package versions (`npm ls @semantic-lambda/core @opentelemetry/api`)
   - Minimal reproduction code
   - Expected vs actual behaviour
