# Advanced Usage

This guide covers advanced features for power users who need fine-grained control over trigger detection, attribute extraction, and custom instrumentation.

## Entry Points

The package provides multiple entry points for different use cases:

| Entry Point | Use Case | Bundle Impact |
|-------------|----------|---------------|
| `@semantic-lambda/core` | Primary API with explicit triggers | Minimal - only includes used triggers |
| `@semantic-lambda/core/auto` | Runtime trigger detection | Larger - includes all trigger schemas |
| `@semantic-lambda/core/middy` | Middy middleware | Similar to /auto |
| `@semantic-lambda/core/extractors` | Low-level utilities | Minimal - only utilities |

## Auto-Detection (`/auto`)

The `/auto` entry point provides runtime trigger detection when you don't know the trigger type at compile time.

```typescript
import { trace } from '@opentelemetry/api'
import { wrapWithEventDetection } from '@semantic-lambda/core/auto'

const tracer = trace.getTracer('my-service')
const wrap = wrapWithEventDetection(tracer)

// Trigger type detected at runtime
export const handler = wrap(async (event, context) => {
  return { statusCode: 200, body: 'ok' }
})
```

### When to Use Auto-Detection

- **Multi-trigger handlers**: Single Lambda handling multiple event sources
- **Rapid prototyping**: When trigger type isn't finalised
- **Generic utilities**: Shared handler logic across triggers

### Trade-offs

- **Larger bundle**: All 12 trigger schemas included (~30KB additional)
- **Cold start impact**: Schema validation on first invocation
- **No static typing**: Event type is `unknown`, requires runtime checks

### Resetting State

For testing, you can reset the cached detection and cold start state:

```typescript
const wrap = wrapWithEventDetection(tracer)

// Reset between tests
wrap.resetColdStart()
wrap.resetDetector()
```

## Low-Level Extractors (`/extractors`)

The `/extractors` entry point exposes individual extraction functions for building custom instrumentation.

```typescript
import {
  // Detection utilities
  CachedDetector,
  detectEventType,

  // Cold start tracking
  ColdStartTracker,

  // Propagation utilities
  extractContextFromHeaders,
  extractContextFromXRayHeader,
  lambdaPropagator,

  // Trigger-specific extractors
  extractSqsAttributes,
  getSqsSpanName,
  extractSqsParentContext,
  extractSqsSpanLinks,

  // All triggers array
  allTriggers,
} from '@semantic-lambda/core/extractors'
```

### Custom Detection

Build a custom detector with only the triggers you need:

```typescript
import { CachedDetector } from '@semantic-lambda/core/extractors'
import { sqsTrigger, snsTrigger } from '@semantic-lambda/core'

// Only detect SQS and SNS
const detector = new CachedDetector([sqsTrigger, snsTrigger])

const result = detector.detect(event)
if (result) {
  console.log(`Detected: ${result.trigger.name}`)
  console.log(`Parsed event:`, result.event)
}
```

### Manual Attribute Extraction

Extract attributes without creating spans:

```typescript
import { extractSqsAttributes, getSqsSpanName } from '@semantic-lambda/core/extractors'
import type { SQSEvent } from 'aws-lambda'

function logSqsMetrics(event: SQSEvent) {
  const attrs = extractSqsAttributes(event)
  const spanName = getSqsSpanName(event)

  console.log({
    spanName,
    system: attrs['messaging.system'],
    destination: attrs['messaging.destination.name'],
    batchSize: attrs['messaging.batch.message_count'],
  })
}
```

### Custom Context Propagation

Use propagation utilities for custom trace context handling:

```typescript
import {
  extractContextFromHeaders,
  extractContextFromXRayHeader,
  lambdaPropagator,
} from '@semantic-lambda/core/extractors'

// Extract from HTTP headers (W3C traceparent)
const context = extractContextFromHeaders(event.headers)

// Extract from X-Ray environment
const xrayContext = extractContextFromXRayHeader(process.env._X_AMZN_TRACE_ID)

// Use the propagator directly
import { propagation } from '@opentelemetry/api'
propagation.setGlobalPropagator(lambdaPropagator)
```

### Span Kind and Trigger Categories

Map trigger categories to OpenTelemetry span kinds:

```typescript
import { getSpanKindForCategory, getFaasTriggerValue } from '@semantic-lambda/core/extractors'
import { SpanKind } from '@opentelemetry/api'

// 'http' → SpanKind.SERVER
// 'pubsub' → SpanKind.CONSUMER
// 'datasource' → SpanKind.CONSUMER
// 'timer' → SpanKind.INTERNAL
// 'other' → SpanKind.INTERNAL

const kind = getSpanKindForCategory('http') // SpanKind.SERVER
const trigger = getFaasTriggerValue('pubsub') // 'pubsub'
```

## Custom Trigger Configuration

Create a custom trigger for unsupported event sources:

```typescript
import type { TriggerConfig } from '@semantic-lambda/core'
import { z } from 'zod'

// Define your event schema
const MyCustomEventSchema = z.object({
  source: z.literal('my-custom-source'),
  payload: z.object({
    id: z.string(),
    data: z.unknown(),
  }),
})

type MyCustomEvent = z.infer<typeof MyCustomEventSchema>

export const myCustomTrigger: TriggerConfig<MyCustomEvent> = {
  name: 'my-custom',
  category: 'other',
  schema: MyCustomEventSchema,
  detectionPriority: 50, // Higher = checked first

  extractAttributes: (event) => ({
    'custom.source': event.source,
    'custom.payload.id': event.payload.id,
  }),

  getSpanName: (event, context) => `custom ${event.payload.id}`,

  // Optional: extract parent context from event
  extractParentContext: (event) => {
    // Return OtelContext or undefined
    return undefined
  },

  // Optional: create span links for batch processing
  extractSpanLinks: (event) => {
    return [] // Array of Link objects
  },
}
```

Use with the wrap function:

```typescript
import { wrap } from '@semantic-lambda/core'
import { myCustomTrigger } from './my-custom-trigger'

export const handler = wrap(tracer, myCustomTrigger, async (event, context) => {
  // event is typed as MyCustomEvent
  return { success: true }
})
```

## Performance Considerations

### Bundle Size

For minimal bundle size, import only what you need:

```typescript
// Good: Only SQS trigger included
import { wrap, sqsTrigger } from '@semantic-lambda/core'

// Avoid: All triggers included
import { wrapWithEventDetection } from '@semantic-lambda/core/auto'
```

### Cold Start Optimisation

The cold start tracker is per-wrapper instance. For shared wrappers across handlers in the same file, cold start is correctly tracked:

```typescript
const wrap = wrapWithEventDetection(tracer)

// Both handlers share cold start state
export const handlerA = wrap(async (event) => { /* ... */ })
export const handlerB = wrap(async (event) => { /* ... */ })
// First invocation of either is cold start, subsequent are warm
```

### Detection Caching

The `CachedDetector` caches the last successful detection result. If your handler always receives the same event type, subsequent invocations skip schema validation:

```typescript
const detector = new CachedDetector(allTriggers)

// First call: validates against all schemas
detector.detect(sqsEvent) // Tests schemas until SQS matches

// Second call with same structure: returns cached result
detector.detect(anotherSqsEvent) // Immediate return, no validation
```

## Testing with Extractors

Use extractors in tests to verify attribute extraction:

```typescript
import { describe, it, expect } from 'vitest'
import { extractSqsAttributes } from '@semantic-lambda/core/extractors'
import { createMockSqsEvent } from '@semantic-lambda/testing'

describe('SQS attributes', () => {
  it('extracts queue name from ARN', () => {
    const event = createMockSqsEvent({ queueName: 'orders-queue' })
    const attrs = extractSqsAttributes(event)

    expect(attrs['messaging.destination.name']).toBe('orders-queue')
    expect(attrs['messaging.system']).toBe('aws_sqs')
  })
})
```
