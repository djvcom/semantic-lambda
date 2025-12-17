import { type Tracer, trace } from '@opentelemetry/api'
import { type Resource, resourceFromAttributes } from '@opentelemetry/resources'
import { type ReadableSpan, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { InMemorySpanExporter } from './exporter'

/** Test SDK interface for OpenTelemetry testing */
export interface TestSdk {
  /** Get a tracer instance for creating spans */
  getTracer(name: string, version?: string): Tracer
  /** Get all spans (including unfinished) */
  getSpans(): ReadableSpan[]
  /** Get only finished spans */
  getFinishedSpans(): ReadableSpan[]
  /** Clear all recorded spans */
  reset(): void
  /** Shut down the SDK and flush spans */
  shutdown(): Promise<void>
}

/** Options for creating the test SDK */
export interface TestSdkOptions {
  /** Service name for the resource (default: 'test-lambda') */
  serviceName?: string
  /** Custom OpenTelemetry resource */
  resource?: Resource
}

/**
 * Creates an OpenTelemetry SDK configured for testing with an in-memory exporter.
 *
 * @param options - Optional SDK configuration
 * @returns TestSdk instance for creating tracers and inspecting spans
 *
 * @example
 * ```typescript
 * const sdk = createTestSdk()
 * const tracer = sdk.getTracer('test')
 * // ... run tests
 * const spans = sdk.getFinishedSpans()
 * await sdk.shutdown()
 * ```
 */
export function createTestSdk(options: TestSdkOptions = {}): TestSdk {
  const exporter = new InMemorySpanExporter()

  const resource =
    options.resource ??
    resourceFromAttributes({
      'service.name': options.serviceName ?? 'test-lambda',
      'faas.name': 'test-function',
      'faas.version': '$LATEST',
      'cloud.provider': 'aws',
      'cloud.region': 'eu-west-1',
    })

  const provider = new NodeTracerProvider({
    resource,
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  })
  provider.register()

  return {
    getTracer(name: string, version?: string): Tracer {
      return trace.getTracer(name, version)
    },

    getSpans(): ReadableSpan[] {
      return exporter.getSpans()
    },

    getFinishedSpans(): ReadableSpan[] {
      return exporter.getSpans().filter(span => span.ended)
    },

    reset(): void {
      exporter.reset()
    },

    async shutdown(): Promise<void> {
      await provider.shutdown()
    },
  }
}
