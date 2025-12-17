import { gunzipSync } from 'node:zlib'
import { CloudWatchLogsSchema } from '@aws-lambda-powertools/parser/schemas'
import type { Attributes } from '@opentelemetry/api'
import type { CloudWatchLogsEvent } from 'aws-lambda'
import type { TriggerConfig } from './base'

const ATTR_AWS_CLOUDWATCH_LOG_GROUP = 'aws.cloudwatch.log_group'

export function extractCloudWatchLogsAttributes(event: CloudWatchLogsEvent): Attributes {
  const data = Buffer.from(event.awslogs.data, 'base64')
  try {
    const decompressed = gunzipSync(data)
    const parsed = JSON.parse(decompressed.toString()) as { logGroup?: string }
    return {
      ...(parsed.logGroup && { [ATTR_AWS_CLOUDWATCH_LOG_GROUP]: parsed.logGroup }),
    }
  } catch {
    return {}
  }
}

export function getCloudWatchLogsSpanName(): string {
  return 'cloudwatch process'
}

export const cloudwatchTrigger: TriggerConfig<CloudWatchLogsEvent> = {
  name: 'cloudwatch',
  category: 'datasource',
  schema: CloudWatchLogsSchema,
  detectionPriority: 50,

  extractAttributes: extractCloudWatchLogsAttributes,
  getSpanName: getCloudWatchLogsSpanName,
}
