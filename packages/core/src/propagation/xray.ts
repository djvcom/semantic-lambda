const XRAY_TRACE_HEADER_KEY = 'AWSTraceHeader'

/**
 * Checks if SQS message attributes have a structure compatible with X-Ray header extraction.
 *
 * This validates just enough structure to safely access the AWSTraceHeader field.
 * It does NOT fully validate all SQS message attributes - only that the object
 * is safe to read the X-Ray header from.
 *
 * @param attrs - Unknown value to check
 * @returns True if the attributes can be safely read for X-Ray header extraction
 *
 * @remarks
 * SQS message system attributes (where AWSTraceHeader lives) are flat key-value
 * pairs with string values, unlike SNS which uses a nested structure.
 */
export function isSqsMessageAttributes(attrs: unknown): attrs is Record<string, string> {
  if (typeof attrs !== 'object' || attrs === null) return false
  const record = attrs as Record<string, unknown>
  return (
    record[XRAY_TRACE_HEADER_KEY] === undefined || typeof record[XRAY_TRACE_HEADER_KEY] === 'string'
  )
}

/**
 * Checks if SNS message attributes have a structure compatible with X-Ray header extraction.
 *
 * This validates just enough structure to safely access the AWSTraceHeader field.
 * It does NOT fully validate all SNS message attributes - only that the object
 * is safe to read the X-Ray header from.
 *
 * @param attrs - Unknown value to check
 * @returns True if the attributes can be safely read for X-Ray header extraction
 *
 * @remarks
 * SNS message attributes use a nested structure with Type and Value fields,
 * unlike SQS which uses flat key-value pairs for system attributes.
 */
export function isSnsMessageAttributes(
  attrs: unknown,
): attrs is Record<string, { Type: string; Value: string }> {
  if (typeof attrs !== 'object' || attrs === null) return false
  const record = attrs as Record<string, unknown>
  const xrayAttr = record[XRAY_TRACE_HEADER_KEY]
  if (xrayAttr === undefined) return true
  if (typeof xrayAttr !== 'object' || xrayAttr === null) return false
  const typed = xrayAttr as Record<string, unknown>
  return typeof typed.Type === 'string' && typeof typed.Value === 'string'
}

/**
 * Extracts the X-Ray trace header value from SQS message attributes.
 */
export function extractXRayHeaderFromSqsAttributes(
  attributes: Record<string, string> | undefined,
): string | undefined {
  return attributes?.[XRAY_TRACE_HEADER_KEY]
}

/**
 * Extracts the X-Ray trace header value from SNS message attributes.
 */
export function extractXRayHeaderFromSnsAttributes(
  attributes: Record<string, { Type: string; Value: string }> | undefined,
): string | undefined {
  const attr = attributes?.[XRAY_TRACE_HEADER_KEY]
  if (attr?.Type === 'String') {
    return attr.Value
  }
  return undefined
}
