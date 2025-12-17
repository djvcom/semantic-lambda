import type { Context, TextMapGetter } from '@opentelemetry/api'
import { ROOT_CONTEXT } from '@opentelemetry/api'
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from '@opentelemetry/core'
import { AWSXRAY_TRACE_ID_HEADER, AWSXRayPropagator } from '@opentelemetry/propagator-aws-xray'

/**
 * Composite propagator supporting W3C Trace Context, W3C Baggage, and AWS X-Ray formats.
 * When multiple headers exist (e.g., both X-Ray and W3C), propagators merge their
 * extractions with W3C taking precedence for overlapping fields.
 */
export const lambdaPropagator = new CompositePropagator({
  propagators: [
    new AWSXRayPropagator(),
    new W3CTraceContextPropagator(),
    new W3CBaggagePropagator(),
  ],
})

const httpHeaderGetter: TextMapGetter<Record<string, string | undefined>> = {
  keys(carrier) {
    return Object.keys(carrier)
  },
  get(carrier, key) {
    return carrier[key.toLowerCase()]
  },
}

/**
 * Extracts trace context from HTTP headers using the composite propagator.
 * Supports W3C Trace Context (traceparent), W3C Baggage, and AWS X-Ray (x-amzn-trace-id) headers.
 */
export function extractContextFromHeaders(
  headers: Record<string, string | undefined> | null,
): Context {
  if (!headers) {
    return ROOT_CONTEXT
  }

  const normalisedHeaders: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(headers)) {
    normalisedHeaders[key.toLowerCase()] = value
  }

  return lambdaPropagator.extract(ROOT_CONTEXT, normalisedHeaders, httpHeaderGetter)
}

/**
 * Extracts trace context from multi-value HTTP headers (API Gateway v1 format).
 * Takes the first value from each multi-value header.
 */
export function extractContextFromMultiValueHeaders(
  headers: Record<string, Array<string> | undefined> | null,
): Context {
  if (!headers) {
    return ROOT_CONTEXT
  }

  const normalisedHeaders: Record<string, string | undefined> = {}
  for (const [key, values] of Object.entries(headers)) {
    if (values && values.length > 0) {
      normalisedHeaders[key.toLowerCase()] = values[0]
    }
  }

  return lambdaPropagator.extract(ROOT_CONTEXT, normalisedHeaders, httpHeaderGetter)
}

/**
 * Extracts trace context from a raw X-Ray trace header string.
 * Used for SQS/SNS message attributes and the _X_AMZN_TRACE_ID environment variable.
 */
export function extractContextFromXRayHeader(header: string | undefined): Context {
  if (!header) {
    return ROOT_CONTEXT
  }

  // Create a carrier with the X-Ray header
  const carrier: Record<string, string> = {
    [AWSXRAY_TRACE_ID_HEADER]: header,
  }

  return lambdaPropagator.extract(ROOT_CONTEXT, carrier, httpHeaderGetter)
}
