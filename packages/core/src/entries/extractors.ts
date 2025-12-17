/**
 * Low-level extractors for power users who need direct access to attribute
 * extraction, span naming logic, and detection utilities without the wrapper.
 *
 * Trigger configs (sqsTrigger, snsTrigger, etc.) are available from the main
 * entry point: `import { sqsTrigger } from '@semantic-lambda/core'`
 */

// Detector
export { CachedDetector, type DetectionResult, detectEventType } from '../detection/detector'

// Cold start tracking
export { ColdStartTracker } from '../internal/cold-start'

// Propagation utilities
export {
  extractContextFromHeaders,
  extractContextFromMultiValueHeaders,
  extractContextFromXRayHeader,
  lambdaPropagator,
} from '../propagation'
// ALB extractors
export { extractAlbAttributes, extractAlbParentContext, getAlbSpanName } from '../triggers/alb'
// API Gateway v1 extractors
export {
  extractApiGatewayAttributes,
  extractApiGatewayParentContext,
  getApiGatewaySpanName,
} from '../triggers/api-gateway'
// API Gateway v2 extractors
export {
  extractApiGatewayV2Attributes,
  extractApiGatewayV2ParentContext,
  getApiGatewayV2SpanName,
} from '../triggers/api-gateway-v2'
// Base types and utilities
export type { EventSchema, TriggerCategory, TriggerConfig } from '../triggers/base'
export { getFaasTriggerValue, getSpanKindForCategory } from '../triggers/base'
// CloudWatch extractors
export { extractCloudWatchLogsAttributes, getCloudWatchLogsSpanName } from '../triggers/cloudwatch'
// DynamoDB extractors
export { extractDynamoDbAttributes, getDynamoDbSpanName } from '../triggers/dynamodb'
// EventBridge extractors
export { extractEventBridgeAttributes, getEventBridgeSpanName } from '../triggers/eventbridge'
// All triggers array (for custom detection)
export { allTriggers } from '../triggers/index'

// Kafka extractors
export { extractKafkaAttributes, getKafkaSpanName, type KafkaEvent } from '../triggers/kafka'

// Kinesis extractors
export { extractKinesisAttributes, getKinesisSpanName } from '../triggers/kinesis'

// Lambda URL extractors
export { extractLambdaUrlAttributes, getLambdaUrlSpanName } from '../triggers/lambda-url'

// S3 extractors
export { extractS3Attributes, getS3SpanName } from '../triggers/s3'

// SNS extractors
export {
  extractSnsAttributes,
  extractSnsParentContext,
  extractSnsSpanLinks,
  getSnsSpanName,
} from '../triggers/sns'

// SQS extractors
export {
  extractSqsAttributes,
  extractSqsParentContext,
  extractSqsSpanLinks,
  getSqsSpanName,
} from '../triggers/sqs'
