import { SnsSchema } from '@aws-lambda-powertools/parser/schemas'
import type { Attributes, Link, Context as OtelContext } from '@opentelemetry/api'
import { ROOT_CONTEXT } from '@opentelemetry/api'
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
import type { SNSEvent, SNSEventRecord } from 'aws-lambda'
import { extractTopicName } from '../internal/arn'
import {
  createSpanLinkFromContext,
  extractContextFromCarrier,
  normaliseSnsMessageAttributes,
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

/**
 * Extracts trace context from an SNS record's message attributes.
 * Uses the propagator to extract context (supports W3C and X-Ray).
 */
function extractContextFromSnsRecord(record: SNSEventRecord): OtelContext {
  const carrier = normaliseSnsMessageAttributes(record.Sns.MessageAttributes)
  return extractContextFromCarrier(carrier)
}

/**
 * Returns ROOT_CONTEXT for SNS events.
 *
 * For pub/sub semantics, we don't use any message's context as the parent.
 * Each message may come from a different producer/trace, so the processing
 * span should be its own root. Use extractSnsSpanLinks to get links to all
 * producer spans.
 */
export function extractSnsParentContext(_event: SNSEvent): OtelContext {
  return ROOT_CONTEXT
}

/**
 * Creates span links from ALL SNS records in the batch.
 * Each link connects this processing span to the producer span that sent the message.
 * Supports both W3C trace context and X-Ray (via messageAttributes).
 */
export function extractSnsSpanLinks(event: SNSEvent): Link[] {
  const links: Link[] = []

  for (const record of event.Records) {
    const context = extractContextFromSnsRecord(record)
    const link = createSpanLinkFromContext(context)
    if (link) {
      links.push(link)
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
