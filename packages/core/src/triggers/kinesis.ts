import { KinesisDataStreamSchema } from '@aws-lambda-powertools/parser/schemas'
import type { Attributes } from '@opentelemetry/api'
import {
  ATTR_MESSAGING_BATCH_MESSAGE_COUNT,
  ATTR_MESSAGING_DESTINATION_NAME,
  ATTR_MESSAGING_OPERATION_NAME,
  ATTR_MESSAGING_OPERATION_TYPE,
  ATTR_MESSAGING_SYSTEM,
  MESSAGING_OPERATION_TYPE_VALUE_PROCESS,
} from '@opentelemetry/semantic-conventions/incubating'
import type { KinesisStreamEvent } from 'aws-lambda'
import { extractStreamName } from '../internal/arn'
import type { TriggerConfig } from './base'

const MESSAGING_SYSTEM_VALUE_AWS_KINESIS = 'aws_kinesis'
const ATTR_AWS_KINESIS_SHARD_ID = 'aws.kinesis.shard_id'

function extractDestinationName(event: KinesisStreamEvent): string | undefined {
  const arns = new Set(event.Records.map(r => r.eventSourceARN).filter(Boolean))
  if (arns.size === 1) {
    const firstArn = event.Records[0]?.eventSourceARN
    if (firstArn) {
      return extractStreamName(firstArn)
    }
  }
  return undefined
}

export function extractKinesisAttributes(event: KinesisStreamEvent): Attributes {
  const destinationName = extractDestinationName(event)

  // Extract partition ID (shard ID) if all records from same shard
  const shardIds = new Set(
    event.Records.map(r => {
      // eventID format: "shardId-000000000000:sequenceNumber"
      const parts = r.eventID.split(':')
      return parts[0]
    }).filter(Boolean),
  )
  const partitionId = shardIds.size === 1 ? [...shardIds][0] : undefined

  return {
    [ATTR_MESSAGING_SYSTEM]: MESSAGING_SYSTEM_VALUE_AWS_KINESIS,
    [ATTR_MESSAGING_OPERATION_TYPE]: MESSAGING_OPERATION_TYPE_VALUE_PROCESS,
    [ATTR_MESSAGING_OPERATION_NAME]: 'process',
    [ATTR_MESSAGING_BATCH_MESSAGE_COUNT]: event.Records.length,
    ...(destinationName && { [ATTR_MESSAGING_DESTINATION_NAME]: destinationName }),
    ...(partitionId && { [ATTR_AWS_KINESIS_SHARD_ID]: partitionId }),
  }
}

export function getKinesisSpanName(event: KinesisStreamEvent): string {
  const destinationName = extractDestinationName(event)
  return destinationName ? `${destinationName} process` : 'multiple_sources process'
}

export const kinesisTrigger: TriggerConfig<KinesisStreamEvent> = {
  name: 'kinesis',
  category: 'pubsub',
  schema: KinesisDataStreamSchema,
  detectionPriority: 80,

  extractAttributes: extractKinesisAttributes,
  getSpanName: getKinesisSpanName,
}
