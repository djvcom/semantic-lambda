import { SqsSchema } from '@aws-lambda-powertools/parser/schemas'
import type { Attributes, Link, Context as OtelContext } from '@opentelemetry/api'
import { ROOT_CONTEXT, trace } from '@opentelemetry/api'
import {
  ATTR_MESSAGING_BATCH_MESSAGE_COUNT,
  ATTR_MESSAGING_DESTINATION_NAME,
  ATTR_MESSAGING_MESSAGE_ID,
  ATTR_MESSAGING_OPERATION_NAME,
  ATTR_MESSAGING_OPERATION_TYPE,
  ATTR_MESSAGING_SYSTEM,
  MESSAGING_OPERATION_TYPE_VALUE_PROCESS,
  MESSAGING_SYSTEM_VALUE_AWS_SQS,
} from '@opentelemetry/semantic-conventions/incubating'
import type { SQSEvent } from 'aws-lambda'
import { extractQueueName } from '../internal/arn'
import {
  extractContextFromXRayHeader,
  extractXRayHeaderFromSqsAttributes,
  isSqsMessageAttributes,
} from '../propagation'
import type { TriggerConfig } from './base'

function extractDestinationName(event: SQSEvent): string | undefined {
  const arns = new Set(event.Records.map(r => r.eventSourceARN).filter(Boolean))
  if (arns.size === 1) {
    // arns.size === 1 guarantees at least one record with eventSourceARN exists
    const firstArn = event.Records[0]!.eventSourceARN
    return extractQueueName(firstArn)
  }
  return undefined
}

export function extractSqsAttributes(event: SQSEvent): Attributes {
  const destinationName = extractDestinationName(event)
  const firstRecord = event.Records.length === 1 ? event.Records[0] : undefined

  return {
    [ATTR_MESSAGING_SYSTEM]: MESSAGING_SYSTEM_VALUE_AWS_SQS,
    [ATTR_MESSAGING_OPERATION_TYPE]: MESSAGING_OPERATION_TYPE_VALUE_PROCESS,
    [ATTR_MESSAGING_OPERATION_NAME]: 'process',
    [ATTR_MESSAGING_BATCH_MESSAGE_COUNT]: event.Records.length,
    ...(destinationName && { [ATTR_MESSAGING_DESTINATION_NAME]: destinationName }),
    ...(firstRecord && { [ATTR_MESSAGING_MESSAGE_ID]: firstRecord.messageId }),
  }
}

export function getSqsSpanName(event: SQSEvent): string {
  const destinationName = extractDestinationName(event)
  return destinationName ? `${destinationName} process` : 'multiple_sources process'
}

export function extractSqsParentContext(event: SQSEvent): OtelContext {
  const firstRecord = event.Records[0]
  if (firstRecord?.attributes) {
    const attrs: unknown = firstRecord.attributes
    if (isSqsMessageAttributes(attrs)) {
      const xrayHeader = extractXRayHeaderFromSqsAttributes(attrs)
      if (xrayHeader) {
        return extractContextFromXRayHeader(xrayHeader)
      }
    }
  }
  return ROOT_CONTEXT
}

export function extractSqsSpanLinks(event: SQSEvent): Link[] {
  const links: Link[] = []

  for (let i = 1; i < event.Records.length; i++) {
    const record = event.Records[i]
    if (record?.attributes) {
      const attrs: unknown = record.attributes
      if (isSqsMessageAttributes(attrs)) {
        const xrayHeader = extractXRayHeaderFromSqsAttributes(attrs)
        if (xrayHeader) {
          const context = extractContextFromXRayHeader(xrayHeader)
          const spanContext = trace.getSpanContext(context)
          if (spanContext?.traceId && spanContext.spanId) {
            links.push({ context: spanContext })
          }
        }
      }
    }
  }

  return links
}

export const sqsTrigger: TriggerConfig<SQSEvent> = {
  name: 'sqs',
  category: 'pubsub',
  schema: SqsSchema,
  detectionPriority: 80,

  extractAttributes: extractSqsAttributes,
  getSpanName: getSqsSpanName,
  extractParentContext: extractSqsParentContext,
  extractSpanLinks: extractSqsSpanLinks,
}
