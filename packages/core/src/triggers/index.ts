// Base types and utilities

// Individual trigger configurations
export { albTrigger, extractAlbAttributes, extractAlbParentContext, getAlbSpanName } from './alb'
export {
  apiGatewayTrigger,
  extractApiGatewayAttributes,
  extractApiGatewayParentContext,
  getApiGatewaySpanName,
} from './api-gateway'
export {
  apiGatewayV2Trigger,
  extractApiGatewayV2Attributes,
  extractApiGatewayV2ParentContext,
  getApiGatewayV2SpanName,
} from './api-gateway-v2'
export type { TriggerCategory, TriggerConfig } from './base'
export { getFaasTriggerValue, getSpanKindForCategory } from './base'
export {
  cloudwatchTrigger,
  extractCloudWatchLogsAttributes,
  getCloudWatchLogsSpanName,
} from './cloudwatch'
export { dynamodbTrigger, extractDynamoDbAttributes, getDynamoDbSpanName } from './dynamodb'
export {
  eventbridgeTrigger,
  extractEventBridgeAttributes,
  getEventBridgeSpanName,
} from './eventbridge'
export { extractKafkaAttributes, getKafkaSpanName, type KafkaEvent, kafkaTrigger } from './kafka'
export { extractKinesisAttributes, getKinesisSpanName, kinesisTrigger } from './kinesis'
export { extractLambdaUrlAttributes, getLambdaUrlSpanName, lambdaUrlTrigger } from './lambda-url'
export { extractS3Attributes, getS3SpanName, s3Trigger } from './s3'
export {
  extractSnsAttributes,
  extractSnsParentContext,
  extractSnsSpanLinks,
  getSnsSpanName,
  snsTrigger,
} from './sns'
export {
  extractSqsAttributes,
  extractSqsParentContext,
  extractSqsSpanLinks,
  getSqsSpanName,
  sqsTrigger,
} from './sqs'

// All triggers for registration
import { albTrigger } from './alb'
import { apiGatewayTrigger } from './api-gateway'
import { apiGatewayV2Trigger } from './api-gateway-v2'
import { cloudwatchTrigger } from './cloudwatch'
import { dynamodbTrigger } from './dynamodb'
import { eventbridgeTrigger } from './eventbridge'
import { kafkaTrigger } from './kafka'
import { kinesisTrigger } from './kinesis'
import { lambdaUrlTrigger } from './lambda-url'
import { s3Trigger } from './s3'
import { snsTrigger } from './sns'
import { sqsTrigger } from './sqs'

/**
 * All available trigger configurations.
 * Import this array to register all triggers with a registry.
 */
export const allTriggers = [
  albTrigger,
  apiGatewayTrigger,
  apiGatewayV2Trigger,
  cloudwatchTrigger,
  dynamodbTrigger,
  eventbridgeTrigger,
  kafkaTrigger,
  kinesisTrigger,
  lambdaUrlTrigger,
  s3Trigger,
  snsTrigger,
  sqsTrigger,
] as const
