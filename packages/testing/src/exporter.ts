import type { ExportResult } from '@opentelemetry/core'
import { ExportResultCode } from '@opentelemetry/core'
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base'

export class InMemorySpanExporter implements SpanExporter {
  private spans: ReadableSpan[] = []
  private stopped = false

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    if (this.stopped) {
      resultCallback({ code: ExportResultCode.FAILED })
      return
    }

    this.spans.push(...spans)
    resultCallback({ code: ExportResultCode.SUCCESS })
  }

  shutdown(): Promise<void> {
    this.stopped = true
    return Promise.resolve()
  }

  forceFlush(): Promise<void> {
    return Promise.resolve()
  }

  getSpans(): ReadableSpan[] {
    return [...this.spans]
  }

  reset(): void {
    this.spans = []
  }
}
