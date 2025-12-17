import { DynamoDBStreamSchema } from '@aws-lambda-powertools/parser/schemas'
import type { Attributes } from '@opentelemetry/api'
import {
  ATTR_FAAS_DOCUMENT_COLLECTION,
  ATTR_FAAS_DOCUMENT_OPERATION,
  FAAS_DOCUMENT_OPERATION_VALUE_DELETE,
  FAAS_DOCUMENT_OPERATION_VALUE_EDIT,
  FAAS_DOCUMENT_OPERATION_VALUE_INSERT,
} from '@opentelemetry/semantic-conventions/incubating'
import type { DynamoDBStreamEvent } from 'aws-lambda'
import { extractTableName } from '../internal/arn'
import type { TriggerConfig } from './base'

function mapDynamoDbOperation(eventName: string): string {
  switch (eventName) {
    case 'INSERT':
      return FAAS_DOCUMENT_OPERATION_VALUE_INSERT
    case 'MODIFY':
      return FAAS_DOCUMENT_OPERATION_VALUE_EDIT
    case 'REMOVE':
      return FAAS_DOCUMENT_OPERATION_VALUE_DELETE
    default:
      return eventName.toLowerCase()
  }
}

export function extractDynamoDbAttributes(event: DynamoDBStreamEvent): Attributes {
  const tableArns = new Set(event.Records.map(r => r.eventSourceARN).filter(Boolean))
  const operations = new Set(event.Records.map(r => r.eventName))

  const firstRecord = event.Records[0]
  const collection =
    tableArns.size === 1 && firstRecord?.eventSourceARN
      ? extractTableName(firstRecord.eventSourceARN)
      : undefined
  const operation =
    operations.size === 1 && firstRecord?.eventName
      ? mapDynamoDbOperation(firstRecord.eventName)
      : undefined

  return {
    ...(collection && { [ATTR_FAAS_DOCUMENT_COLLECTION]: collection }),
    ...(operation && { [ATTR_FAAS_DOCUMENT_OPERATION]: operation }),
  }
}

export function getDynamoDbSpanName(event: DynamoDBStreamEvent): string {
  const tableArns = new Set(event.Records.map(r => r.eventSourceARN).filter(Boolean))

  if (tableArns.size === 1) {
    const firstRecord = event.Records[0]
    if (firstRecord?.eventSourceARN) {
      return `${extractTableName(firstRecord.eventSourceARN)} process`
    }
  }
  return 'dynamodb process'
}

export const dynamodbTrigger: TriggerConfig<DynamoDBStreamEvent> = {
  name: 'dynamodb',
  category: 'datasource',
  schema: DynamoDBStreamSchema,
  detectionPriority: 70,

  extractAttributes: extractDynamoDbAttributes,
  getSpanName: getDynamoDbSpanName,
}
