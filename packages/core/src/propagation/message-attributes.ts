import type { SNSMessageAttributes, SQSMessageAttributes, SQSRecordAttributes } from 'aws-lambda'

/**
 * Maps SQS/SNS attribute names to their HTTP header equivalents.
 * This allows the propagator to recognise trace context headers.
 */
const ATTRIBUTE_TO_HEADER_MAP: Record<string, string> = {
  AWSTraceHeader: 'x-amzn-trace-id',
}

/**
 * Normalises SQS message attributes (user-defined) to a flat carrier.
 * Extracts stringValue from the nested structure.
 */
export function normaliseSqsMessageAttributes(
  attrs: SQSMessageAttributes | undefined,
): Record<string, string> {
  if (!attrs) return {}

  const carrier: Record<string, string> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (value?.stringValue) {
      carrier[key] = value.stringValue
    }
  }
  return carrier
}

/**
 * Normalises SQS system attributes to a flat carrier.
 * Maps AWSTraceHeader to x-amzn-trace-id for propagator compatibility.
 */
export function normaliseSqsSystemAttributes(
  attrs: SQSRecordAttributes | undefined,
): Record<string, string> {
  if (!attrs) return {}

  const carrier: Record<string, string> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'string') {
      const headerKey = ATTRIBUTE_TO_HEADER_MAP[key] ?? key
      carrier[headerKey] = value
    }
  }
  return carrier
}

/**
 * Normalises SNS message attributes to a flat carrier.
 * Only String types are processed as trace context propagation
 * (W3C Trace Context and X-Ray) requires string values.
 * Maps AWSTraceHeader to x-amzn-trace-id for propagator compatibility.
 */
export function normaliseSnsMessageAttributes(
  attrs: SNSMessageAttributes | undefined,
): Record<string, string> {
  if (!attrs) return {}

  const carrier: Record<string, string> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (value?.Type === 'String' && value.Value) {
      const headerKey = ATTRIBUTE_TO_HEADER_MAP[key] ?? key
      carrier[headerKey] = value.Value
    }
  }
  return carrier
}
