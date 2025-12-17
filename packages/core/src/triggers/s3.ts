import { S3Schema } from '@aws-lambda-powertools/parser/schemas'
import type { Attributes } from '@opentelemetry/api'
import {
  ATTR_FAAS_DOCUMENT_COLLECTION,
  ATTR_FAAS_DOCUMENT_NAME,
  ATTR_FAAS_DOCUMENT_OPERATION,
  FAAS_DOCUMENT_OPERATION_VALUE_DELETE,
  FAAS_DOCUMENT_OPERATION_VALUE_INSERT,
} from '@opentelemetry/semantic-conventions/incubating'
import type { S3Event } from 'aws-lambda'
import type { TriggerConfig } from './base'

function mapS3Operation(eventName: string): string {
  if (eventName.startsWith('ObjectCreated')) {
    return FAAS_DOCUMENT_OPERATION_VALUE_INSERT
  }
  if (eventName.startsWith('ObjectRemoved')) {
    return FAAS_DOCUMENT_OPERATION_VALUE_DELETE
  }
  return eventName.toLowerCase()
}

export function extractS3Attributes(event: S3Event): Attributes {
  const buckets = new Set(event.Records.map(r => r.s3.bucket.name))
  const firstRecord = event.Records[0]

  const collection =
    buckets.size === 1 && firstRecord?.s3.bucket.name ? firstRecord.s3.bucket.name : undefined
  const isSingleRecord = event.Records.length === 1 && firstRecord
  const documentName = isSingleRecord ? firstRecord.s3.object.key : undefined
  const operation =
    isSingleRecord && firstRecord.eventName ? mapS3Operation(firstRecord.eventName) : undefined

  return {
    ...(collection && { [ATTR_FAAS_DOCUMENT_COLLECTION]: collection }),
    ...(documentName && { [ATTR_FAAS_DOCUMENT_NAME]: documentName }),
    ...(operation && { [ATTR_FAAS_DOCUMENT_OPERATION]: operation }),
  }
}

export function getS3SpanName(event: S3Event): string {
  const buckets = new Set(event.Records.map(r => r.s3.bucket.name))
  if (buckets.size === 1) {
    const firstRecord = event.Records[0]
    if (firstRecord?.s3.bucket.name) {
      return `${firstRecord.s3.bucket.name} process`
    }
  }
  return 's3 process'
}

export const s3Trigger: TriggerConfig<S3Event> = {
  name: 's3',
  category: 'datasource',
  schema: S3Schema,
  detectionPriority: 60,

  extractAttributes: extractS3Attributes,
  getSpanName: getS3SpanName,
}
