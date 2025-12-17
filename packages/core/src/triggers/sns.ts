import { SnsSchema } from '@aws-lambda-powertools/parser/schemas'
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
  MESSAGING_SYSTEM_VALUE_AWS_SNS,
} from '@opentelemetry/semantic-conventions/incubating'
import type { SNSEvent } from 'aws-lambda'
import { extractTopicName } from '../internal/arn'
import {
  extractContextFromXRayHeader,
  extractXRayHeaderFromSnsAttributes,
  isSnsMessageAttributes,
} from '../propagation'
import type { TriggerConfig } from './base'

function extractDestinationName(event: SNSEvent): string | undefined {
  const arns = new Set(event.Records.map(r => r.Sns.TopicArn).filter(Boolean))
  if (arns.size === 1) {
    const firstArn = event.Records[0]?.Sns.TopicArn
    if (firstArn) {
      return extractTopicName(firstArn)
    }
  }
  return undefined
}

export function extractSnsAttributes(event: SNSEvent): Attributes {
  const destinationName = extractDestinationName(event)
  const firstRecord = event.Records.length === 1 ? event.Records[0] : undefined

  return {
    [ATTR_MESSAGING_SYSTEM]: MESSAGING_SYSTEM_VALUE_AWS_SNS,
    [ATTR_MESSAGING_OPERATION_TYPE]: MESSAGING_OPERATION_TYPE_VALUE_PROCESS,
    [ATTR_MESSAGING_OPERATION_NAME]: 'process',
    [ATTR_MESSAGING_BATCH_MESSAGE_COUNT]: event.Records.length,
    ...(destinationName && { [ATTR_MESSAGING_DESTINATION_NAME]: destinationName }),
    ...(firstRecord && { [ATTR_MESSAGING_MESSAGE_ID]: firstRecord.Sns.MessageId }),
  }
}

export function getSnsSpanName(event: SNSEvent): string {
  const destinationName = extractDestinationName(event)
  return destinationName ? `${destinationName} process` : 'multiple_sources process'
}

export function extractSnsParentContext(event: SNSEvent): OtelContext {
  const firstRecord = event.Records[0]
  if (firstRecord?.Sns.MessageAttributes) {
    const attrs: unknown = firstRecord.Sns.MessageAttributes
    if (isSnsMessageAttributes(attrs)) {
      const xrayHeader = extractXRayHeaderFromSnsAttributes(attrs)
      if (xrayHeader) {
        return extractContextFromXRayHeader(xrayHeader)
      }
    }
  }
  return ROOT_CONTEXT
}

export function extractSnsSpanLinks(event: SNSEvent): Link[] {
  const links: Link[] = []

  for (let i = 1; i < event.Records.length; i++) {
    const record = event.Records[i]
    if (record?.Sns.MessageAttributes) {
      const attrs: unknown = record.Sns.MessageAttributes
      if (isSnsMessageAttributes(attrs)) {
        const xrayHeader = extractXRayHeaderFromSnsAttributes(attrs)
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

export const snsTrigger: TriggerConfig<SNSEvent> = {
  name: 'sns',
  category: 'pubsub',
  schema: SnsSchema,
  detectionPriority: 80,

  extractAttributes: extractSnsAttributes,
  getSpanName: getSnsSpanName,
  extractParentContext: extractSnsParentContext,
  extractSpanLinks: extractSnsSpanLinks,
}
