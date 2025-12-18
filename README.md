# @semantic-lambda

[![npm version](https://img.shields.io/npm/v/@semantic-lambda/core.svg)](https://www.npmjs.com/package/@semantic-lambda/core)
[![npm downloads](https://img.shields.io/npm/dm/@semantic-lambda/core.svg)](https://www.npmjs.com/package/@semantic-lambda/core)
[![CI](https://github.com/djvcom/semantic-lambda/actions/workflows/ci.yml/badge.svg)](https://github.com/djvcom/semantic-lambda/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Wrap AWS Lambda handlers with OpenTelemetry semantic spans following the [FaaS semantic conventions](https://opentelemetry.io/docs/specs/semconv/faas/faas-spans/).

## Why?

Existing Lambda instrumentation libraries have significant gaps:

- **[@opentelemetry/instrumentation-aws-lambda](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/opentelemetry-instrumentation-aws-lambda)** only extracts semantic attributes for HTTP triggers. SQS, SNS, Kinesis, DynamoDB Streams, S3, and other event sources get basic spans with no meaningful attributes.

- **[AWS Distro for OpenTelemetry (ADOT)](https://aws-otel.github.io/)** focuses on auto-instrumentation but doesn't enrich spans with trigger-specific semantic conventions.

This package fills that gap by:

1. **Full trigger coverage** — Semantic attributes for all common Lambda triggers, not just HTTP
2. **Proper span naming** — `{queue} process` for SQS, `{topic} process` for SNS, following OTel messaging conventions
3. **Batch message handling** — Span links for all messages in a batch, proper `messaging.batch.message_count` attributes
4. **Context propagation** — W3C Trace Context from HTTP headers, X-Ray trace headers from SQS/SNS message attributes
5. **Correct span kinds** — `SERVER` for HTTP, `CONSUMER` for messaging and data sources

The result: traces that actually tell you what happened, not just that a Lambda ran.

## Packages

| Package | Description |
|---------|-------------|
| [`@semantic-lambda/core`](./packages/core) | Lambda wrapper with automatic span creation |
| [`@semantic-lambda/testing`](./packages/testing) | Testing utilities with in-memory exporters |

## Features

- Automatic semantic span creation for Lambda handlers
- Support for all common Lambda triggers (API Gateway, SQS, SNS, Kinesis, etc.)
- W3C Trace Context and X-Ray header propagation
- Cold start detection
- Minimal overhead (~7µs per invocation)
- Full TypeScript support
- Compatible with Middy middleware

## Quick Start

```bash
npm install @semantic-lambda/core @opentelemetry/api
```

```typescript
import { trace } from '@opentelemetry/api'
import { wrap, apiGatewayV2Trigger } from '@semantic-lambda/core'

const tracer = trace.getTracer('my-service')

export const handler = wrap(tracer, apiGatewayV2Trigger, async (event, context) => {
  return { statusCode: 200, body: JSON.stringify({ message: 'Hello' }) }
})
```

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Winston Logging with OTel Context](./docs/examples/winston-otel-logging.md)

## Supported Triggers

| Trigger | Category | Span Name Format |
|---------|----------|-----------------|
| `apiGateway` | HTTP | `{method} {route}` |
| `apiGatewayV2` | HTTP | `{method} {route}` |
| `alb` | HTTP | `{method} {path}` |
| `lambdaUrl` | HTTP | `{method} {route}` |
| `sqs` | Messaging | `{queue} process` |
| `sns` | Messaging | `{topic} process` |
| `kinesis` | Messaging | `{stream} process` |
| `kafka` | Messaging | `{topic} process` |
| `eventBridge` | Messaging | `{function}` |
| `dynamoDb` | Datasource | `{table} process` |
| `s3` | Datasource | `{bucket} process` |
| `cloudWatch` | Datasource | `cloudwatch process` |

## Performance

Benchmarks show minimal overhead:

| Scenario | Overhead |
|----------|----------|
| Warm invocation (explicit) | ~7µs |
| Warm invocation (dynamic) | ~8µs |
| Batch processing | Linear with message count |

For latency-critical applications, prefer explicit trigger types over dynamic detection.

## Development

```bash
# Install dependencies
yarn install

# Run tests
yarn test:run

# Run benchmarks
yarn bench:run

# Type check
yarn workspaces foreach -A run typecheck

# Lint
yarn lint
```

### Using Nix

A `flake.nix` is provided for reproducible development environments:

```bash
nix develop
```

This gives you Node.js 24 and Yarn without needing to install them globally.

## Requirements

- Node.js 24+

## Licence

MIT
