import {
  type Attributes,
  type Link,
  type Context as OtelContext,
  ROOT_CONTEXT,
  type Span,
  type SpanKind,
  SpanStatusCode,
} from '@opentelemetry/api'
import {
  ATTR_AWS_LAMBDA_INVOKED_ARN,
  ATTR_CLOUD_ACCOUNT_ID,
  ATTR_CLOUD_PROVIDER,
  ATTR_CLOUD_REGION,
  ATTR_CLOUD_RESOURCE_ID,
  ATTR_ERROR_TYPE,
  ATTR_FAAS_COLDSTART,
  ATTR_FAAS_INSTANCE,
  ATTR_FAAS_INVOCATION_ID,
  ATTR_FAAS_MAX_MEMORY,
  ATTR_FAAS_NAME,
  ATTR_FAAS_TRIGGER,
  ATTR_FAAS_VERSION,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  CLOUD_PROVIDER_VALUE_AWS,
} from '@opentelemetry/semantic-conventions/incubating'
import type { Context } from 'aws-lambda'
import type { CachedDetector } from '../detection/detector'
import { extractContextFromXRayHeader } from '../propagation'
import {
  getFaasTriggerValue,
  getSpanKindForCategory,
  type TriggerCategory,
  type TriggerConfig,
} from '../triggers/base'
import { extractRegionAndAccount } from './arn'
import { toError } from './utils'

export interface SpanCreationContext {
  parsedEvent: unknown
  trigger: TriggerConfig | null
  parentContext: OtelContext
  spanName: string
  attributes: Attributes
  links: Link[]
  spanKind: SpanKind
  isHttpTrigger: boolean
}

export function prepareSpanCreation(
  detector: CachedDetector,
  event: unknown,
  lambdaContext: Context,
  isColdStart: boolean,
  options?: { spanNameOverride?: string },
): SpanCreationContext {
  const detected = detector.detect(event)
  const trigger = detected?.trigger ?? null
  const parsedEvent = detected?.event ?? event
  const isHttpTrigger = trigger?.category === 'http'

  const parentContext = extractParentContext(
    parsedEvent,
    trigger,
    extractContextFromXRayHeader,
    process.env._X_AMZN_TRACE_ID,
  )

  const spanName =
    options?.spanNameOverride ??
    (trigger ? trigger.getSpanName(parsedEvent, lambdaContext) : lambdaContext.functionName)

  const commonAttributes = extractCommonAttributes(lambdaContext, isColdStart)
  const triggerAttributes = trigger ? trigger.extractAttributes(parsedEvent) : {}
  const attributes = buildSpanAttributes(
    commonAttributes,
    triggerAttributes,
    trigger?.category ?? null,
  )

  const links = trigger?.extractSpanLinks?.(parsedEvent) ?? []

  const spanKind = trigger
    ? getSpanKindForCategory(trigger.category)
    : getSpanKindForCategory('other')

  return {
    parsedEvent,
    trigger,
    parentContext,
    spanName,
    attributes,
    links,
    spanKind,
    isHttpTrigger,
  }
}

export function extractCommonAttributes(lambdaContext: Context, isColdStart: boolean): Attributes {
  const arnParts = extractRegionAndAccount(lambdaContext.invokedFunctionArn)

  return {
    [ATTR_FAAS_INVOCATION_ID]: lambdaContext.awsRequestId,
    [ATTR_FAAS_COLDSTART]: isColdStart,
    [ATTR_CLOUD_PROVIDER]: CLOUD_PROVIDER_VALUE_AWS,
    [ATTR_AWS_LAMBDA_INVOKED_ARN]: lambdaContext.invokedFunctionArn,
    [ATTR_FAAS_NAME]: lambdaContext.functionName,
    [ATTR_FAAS_VERSION]: lambdaContext.functionVersion,
    [ATTR_FAAS_MAX_MEMORY]: Number.parseInt(lambdaContext.memoryLimitInMB, 10),
    [ATTR_FAAS_INSTANCE]: lambdaContext.logStreamName,
    ...(arnParts && {
      [ATTR_CLOUD_REGION]: arnParts.region,
      [ATTR_CLOUD_ACCOUNT_ID]: arnParts.accountId,
      [ATTR_CLOUD_RESOURCE_ID]: lambdaContext.invokedFunctionArn,
    }),
  }
}

export function getStatusCodeFromResult(result: unknown): number | undefined {
  if (result && typeof result === 'object' && 'statusCode' in result) {
    const statusCode = (result as { statusCode: unknown }).statusCode
    if (typeof statusCode === 'number') {
      return statusCode
    }
  }
  return undefined
}

export function buildSpanAttributes(
  commonAttributes: Attributes,
  triggerAttributes: Attributes,
  triggerCategory: TriggerCategory | null,
): Attributes {
  const attrs = Object.assign({}, commonAttributes, triggerAttributes)
  if (triggerCategory !== null) {
    attrs[ATTR_FAAS_TRIGGER] = getFaasTriggerValue(triggerCategory)
  }
  return attrs
}

export function extractParentContext(
  event: unknown,
  trigger: TriggerConfig | null,
  extractXRayContext: (header: string) => OtelContext,
  xrayTraceHeader: string | undefined,
): OtelContext {
  if (trigger?.extractParentContext) {
    const extractedContext = trigger.extractParentContext(event)
    if (extractedContext && extractedContext !== ROOT_CONTEXT) {
      return extractedContext
    }
  }

  if (xrayTraceHeader) {
    return extractXRayContext(xrayTraceHeader)
  }

  return ROOT_CONTEXT
}

export function finaliseSpanSuccess(span: Span, result: unknown, isHttpTrigger: boolean): void {
  const statusCode = getStatusCodeFromResult(result)

  if (statusCode !== undefined) {
    span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, statusCode)
  }

  if (isHttpTrigger && statusCode !== undefined && statusCode >= 500) {
    span.setStatus({ code: SpanStatusCode.ERROR })
    span.setAttribute(ATTR_ERROR_TYPE, String(statusCode))
  } else {
    span.setStatus({ code: SpanStatusCode.OK })
  }

  span.end()
}

export function finaliseSpanError(span: Span, error: unknown): void {
  const err = toError(error)
  span.setStatus({ code: SpanStatusCode.ERROR, message: err.message })
  span.recordException(err)
  span.setAttribute(ATTR_ERROR_TYPE, err.name)
  span.end()
}
