import type { Attributes } from '@opentelemetry/api'
import {
  ATTR_MESSAGING_BATCH_MESSAGE_COUNT,
  ATTR_MESSAGING_DESTINATION_NAME,
  ATTR_MESSAGING_OPERATION_NAME,
  ATTR_MESSAGING_OPERATION_TYPE,
  ATTR_MESSAGING_SYSTEM,
  MESSAGING_OPERATION_TYPE_VALUE_PROCESS,
  MESSAGING_SYSTEM_VALUE_KAFKA,
} from '@opentelemetry/semantic-conventions/incubating'
import type { TriggerConfig } from './base'

export interface KafkaEvent {
  eventSource: string
  bootstrapServers?: string
  records: Record<string, Array<{ topic: string; partition: number; offset: number }>>
}

function extractTopicName(event: KafkaEvent): string | undefined {
  const topics = Object.keys(event.records)
  if (topics.length === 1 && topics[0]) {
    // Topic format: "topic-name-partition", extract topic name
    return topics[0].split('-').slice(0, -1).join('-') || topics[0]
  }
  return undefined
}

function countMessages(event: KafkaEvent): number {
  let count = 0
  for (const records of Object.values(event.records)) {
    count += records.length
  }
  return count
}

export function extractKafkaAttributes(event: KafkaEvent): Attributes {
  const destinationName = extractTopicName(event)
  const messageCount = countMessages(event)

  return {
    [ATTR_MESSAGING_SYSTEM]: MESSAGING_SYSTEM_VALUE_KAFKA,
    [ATTR_MESSAGING_OPERATION_TYPE]: MESSAGING_OPERATION_TYPE_VALUE_PROCESS,
    [ATTR_MESSAGING_OPERATION_NAME]: 'process',
    [ATTR_MESSAGING_BATCH_MESSAGE_COUNT]: messageCount,
    ...(destinationName && { [ATTR_MESSAGING_DESTINATION_NAME]: destinationName }),
  }
}

export function getKafkaSpanName(event: KafkaEvent): string {
  const topicName = extractTopicName(event)
  return topicName ? `${topicName} process` : 'multiple_sources process'
}

// Note: Kafka events don't have a schema in @aws-lambda-powertools/parser
// Detection will need to be handled differently or schema added manually
export const kafkaTrigger: TriggerConfig<KafkaEvent> = {
  name: 'kafka',
  category: 'pubsub',
  // No schema available - must be specified explicitly
  detectionPriority: 80,

  extractAttributes: extractKafkaAttributes,
  getSpanName: getKafkaSpanName,
}
