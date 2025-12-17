import { EventBridgeSchema } from '@aws-lambda-powertools/parser/schemas'
import type { Attributes } from '@opentelemetry/api'
import type { EventBridgeEvent } from 'aws-lambda'
import type { TriggerConfig } from './base'

const ATTR_AWS_EVENTBRIDGE_SOURCE = 'aws.eventbridge.source'
const ATTR_AWS_EVENTBRIDGE_DETAIL_TYPE = 'aws.eventbridge.detail_type'

export function extractEventBridgeAttributes(event: EventBridgeEvent<string, unknown>): Attributes {
  return {
    [ATTR_AWS_EVENTBRIDGE_SOURCE]: event.source,
    [ATTR_AWS_EVENTBRIDGE_DETAIL_TYPE]: event['detail-type'],
  }
}

export function getEventBridgeSpanName(event: EventBridgeEvent<string, unknown>): string {
  return `${event.source} ${event['detail-type']}`
}

export const eventbridgeTrigger: TriggerConfig<EventBridgeEvent<string, unknown>> = {
  name: 'eventbridge',
  category: 'pubsub',
  schema: EventBridgeSchema,
  detectionPriority: 70,

  extractAttributes: extractEventBridgeAttributes,
  getSpanName: getEventBridgeSpanName,
}
