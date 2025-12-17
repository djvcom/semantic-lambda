# @semantic-lambda/testing

[![npm version](https://img.shields.io/npm/v/@semantic-lambda/testing.svg)](https://www.npmjs.com/package/@semantic-lambda/testing)
[![npm downloads](https://img.shields.io/npm/dm/@semantic-lambda/testing.svg)](https://www.npmjs.com/package/@semantic-lambda/testing)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@semantic-lambda/testing)](https://bundlephobia.com/package/@semantic-lambda/testing)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Testing utilities for `@semantic-lambda/core` with in-memory span exporters and assertion helpers.

## Installation

```bash
npm install --save-dev @semantic-lambda/testing
# or
yarn add --dev @semantic-lambda/testing
```

## Quick Start

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import {
  createTestSdk,
  createMockApiGatewayV2Event,
  createMockContext,
  findSpan,
  getSpanAttribute,
} from '@semantic-lambda/testing'
import { wrap, apiGatewayV2Trigger } from '@semantic-lambda/core'

describe('my lambda', () => {
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

  it('creates spans correctly', async () => {
    const tracer = sdk.getTracer('test')

    const handler = wrap(tracer, apiGatewayV2Trigger, async () => {
      return { statusCode: 200, body: 'ok' }
    })

    await handler(
      createMockApiGatewayV2Event({ method: 'GET', path: '/users' }),
      createMockContext()
    )

    const spans = sdk.getFinishedSpans()
    expect(spans).toHaveLength(1)
    expect(getSpanAttribute(spans[0], 'faas.trigger')).toBe('http')
  })
})
```

## API Reference

### Test SDK

#### `createTestSdk(options?)`

Creates an OpenTelemetry SDK configured for testing with an in-memory exporter.

```typescript
interface TestSdkOptions {
  serviceName?: string  // Default: 'test-lambda'
  resource?: Resource   // Custom resource
}

interface TestSdk {
  getTracer(name: string, version?: string): Tracer
  getSpans(): ReadableSpan[]
  getFinishedSpans(): ReadableSpan[]
  reset(): void
  shutdown(): Promise<void>
}
```

### Mock Event Factories

#### `createMockApiGatewayV2Event(options?)`

```typescript
interface MockApiGatewayV2EventOptions {
  method?: string       // Default: 'GET'
  path?: string         // Default: '/test'
  routeKey?: string     // Default: 'GET /test'
  headers?: Record<string, string>
  queryStringParameters?: Record<string, string>
  body?: string
  pathParameters?: Record<string, string>
  stageVariables?: Record<string, string>
}
```

#### `createMockSqsEvent(options?)`

```typescript
interface MockSqsEventOptions {
  records?: MockSqsRecordOptions[]
  queueName?: string    // Default: 'test-queue'
  queueArn?: string
}

interface MockSqsRecordOptions {
  body?: string
  messageId?: string
  queueArn?: string
  queueName?: string
  awsTraceHeader?: string
  messageAttributes?: SQSRecord['messageAttributes']
}
```

#### `createMockContext(options?)`

```typescript
interface MockContextOptions {
  functionName?: string       // Default: 'test-function'
  functionVersion?: string    // Default: '$LATEST'
  invokedFunctionArn?: string
  memoryLimitInMB?: string   // Default: '128'
  awsRequestId?: string      // Default: random UUID
  logGroupName?: string
  logStreamName?: string
  remainingTimeMs?: number   // Default: 30000
}
```

### Assertion Helpers

#### `findSpan(spans, matcher)`

Find a single span matching the criteria.

```typescript
const span = findSpan(spans, { name: 'GET /users' })
const span = findSpan(spans, { name: /GET.*/ })
const span = findSpan(spans, { attributes: { 'faas.trigger': 'http' } })
```

#### `findSpans(spans, matcher)`

Find all spans matching the criteria.

```typescript
const httpSpans = findSpans(spans, { attributes: { 'faas.trigger': 'http' } })
```

#### `hasSpan(spans, matcher)`

Check if any span matches the criteria.

```typescript
if (hasSpan(spans, { name: 'database-query' })) {
  // ...
}
```

#### `assertSpanExists(spans, matcher, message?)`

Assert a span exists and return it, or throw an error.

```typescript
const span = assertSpanExists(spans, {
  name: 'GET /users',
  attributes: { 'faas.trigger': 'http' }
})
```

#### `assertNoSpan(spans, matcher, message?)`

Assert no span matches the criteria.

```typescript
assertNoSpan(spans, { status: { code: SpanStatusCode.ERROR } })
```

#### `getSpanAttribute(span, key)`

Get a single attribute value from a span.

```typescript
const method = getSpanAttribute(span, 'http.request.method')
```

#### `getSpanAttributes(span)`

Get all attributes from a span as an object.

```typescript
const attrs = getSpanAttributes(span)
```

#### `spanHasAttribute(span, key, value?)`

Check if a span has an attribute (optionally with a specific value).

```typescript
if (spanHasAttribute(span, 'faas.coldstart', true)) {
  // This was a cold start
}
```

### Span Matcher

All assertion helpers use the `SpanMatcher` interface:

```typescript
interface SpanMatcher {
  name?: string | RegExp
  kind?: SpanKind
  attributes?: Record<string, unknown>
  status?: Partial<SpanStatus>
  hasParent?: boolean
}
```

## Examples

### Testing Error Handling

```typescript
it('records errors on the span', async () => {
  const handler = wrap(tracer, apiGatewayV2Trigger, async () => {
    throw new Error('Something went wrong')
  })

  await expect(handler(event, context)).rejects.toThrow()

  const span = sdk.getFinishedSpans()[0]
  expect(span.status.code).toBe(SpanStatusCode.ERROR)
  expect(span.status.message).toBe('Something went wrong')
  expect(span.events).toContainEqual(
    expect.objectContaining({ name: 'exception' })
  )
})
```

### Testing Cold Start

```typescript
it('sets coldstart attribute on first invocation', async () => {
  const handler = wrap(tracer, apiGatewayV2Trigger, async () => ({ statusCode: 200, body: 'ok' }))

  await handler(event, context)

  const span = sdk.getFinishedSpans()[0]
  expect(getSpanAttribute(span, 'faas.coldstart')).toBe(true)
})

it('can reset cold start state for testing', async () => {
  const handler = wrap(tracer, apiGatewayV2Trigger, async () => ({ statusCode: 200, body: 'ok' }))

  // First invocation is cold
  await handler(event, context)
  expect(getSpanAttribute(sdk.getFinishedSpans()[0], 'faas.coldstart')).toBe(true)

  sdk.reset()
  handler.resetColdStart() // Reset cold start state

  // Next invocation is cold again
  await handler(event, context)
  expect(getSpanAttribute(sdk.getFinishedSpans()[0], 'faas.coldstart')).toBe(true)
})
```

### Testing Trace Context Propagation

```typescript
it('extracts trace context from headers', async () => {
  const event = createMockApiGatewayV2Event({
    headers: {
      traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    },
  })

  await handler(event, context)

  const span = sdk.getFinishedSpans()[0]
  expect(span.parentSpanContext).toBeDefined()
})
```

## Licence

MIT
