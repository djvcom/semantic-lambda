import { SqsSchema } from '@aws-lambda-powertools/parser/schemas'
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
  MESSAGING_SYSTEM_VALUE_AWS_SQS,
} from '@opentelemetry/semantic-conventions/incubating'
import type { SQSEvent, SQSRecord } from 'aws-lambda'
import { extractQueueName } from '../internal/arn'
import {
  createSpanLinkFromContext,
  extractContextFromCarrier,
  normaliseSqsMessageAttributes,
  normaliseSqsSystemAttributes,
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

/**
 * Extracts trace context from an SQS record's attributes.
 * Merges message attributes first, then system attributes (so system wins conflicts).
 * This prevents malicious injection of x-amzn-trace-id via user message attributes
 * while preserving W3C context (traceparent/tracestate) from SDK instrumentation.
 */
function extractContextFromSqsRecord(record: SQSRecord): OtelContext {
  const carrier = {
    ...normaliseSqsMessageAttributes(record.messageAttributes),
    ...normaliseSqsSystemAttributes(record.attributes),
  }
  return extractContextFromCarrier(carrier)
}

/**
 * Returns ROOT_CONTEXT for SQS events.
 *
 * For pub/sub semantics, we don't use any message's context as the parent.
 * Each message may come from a different producer/trace, so the processing
 * span should be its own root. Use extractSqsSpanLinks to get links to all
 * producer spans.
 */
export function extractSqsParentContext(_event: SQSEvent): OtelContext {
  return ROOT_CONTEXT
}

/**
 * Creates span links from ALL SQS records in the batch.
 * Each link connects this processing span to the producer span that sent the message.
 * Supports both W3C trace context (from messageAttributes) and X-Ray (from system attributes).
 */
export function extractSqsSpanLinks(event: SQSEvent): Link[] {
  const links: Link[] = []

  for (const record of event.Records) {
    const context = extractContextFromSqsRecord(record)
    const link = createSpanLinkFromContext(context)
    if (link) {
      links.push(link)
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
