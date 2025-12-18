/**
 * @packageDocumentation
 * OpenTelemetry semantic span instrumentation for AWS Lambda.
 *
 * @example Basic usage with SQS trigger
 * ```typescript
 * import { trace } from '@opentelemetry/api'
 * import { wrap, sqsTrigger } from '@semantic-lambda/core'
 *
 * const tracer = trace.getTracer('my-service')
 *
 * export const handler = wrap(tracer, sqsTrigger, async (event, context) => {
 *   for (const record of event.Records) {
 *     console.log(record.body)
 *   }
 *   return { batchItemFailures: [] }
 * })
 * ```
 *
 * @example HTTP trigger with API Gateway v2
 * ```typescript
 * import { wrap, apiGatewayV2Trigger } from '@semantic-lambda/core'
 *
 * export const handler = wrap(tracer, apiGatewayV2Trigger, async (event) => {
 *   return { statusCode: 200, body: JSON.stringify({ message: 'ok' }) }
 * })
 * ```
 */

// Primary API
export {
  /** @deprecated Use `Handler` instead */
  type AsyncHandler,
  type Handler,
  type WrapInstance,
  type WrapperOptions,
  wrap,
} from './internal/wrap'

// Types
export type { TriggerCategory, TriggerConfig } from './triggers/base'

// Trigger configurations

/** ALB (Application Load Balancer) trigger for HTTP requests via ALB target groups. */
export { albTrigger } from './triggers/alb'

/** API Gateway REST API (v1) trigger for HTTP requests. */
export { apiGatewayTrigger } from './triggers/api-gateway'

/** API Gateway HTTP API (v2) trigger for HTTP requests. */
export { apiGatewayV2Trigger } from './triggers/api-gateway-v2'

/** CloudWatch Logs subscription filter trigger. */
export { cloudwatchTrigger } from './triggers/cloudwatch'

/** DynamoDB Streams trigger for table change events. */
export { dynamodbTrigger } from './triggers/dynamodb'

/** EventBridge (CloudWatch Events) trigger for event bus messages. */
export { eventbridgeTrigger } from './triggers/eventbridge'

/** Self-managed or MSK Kafka trigger for Kafka messages. */
export { type KafkaEvent, kafkaTrigger } from './triggers/kafka'

/** Kinesis Data Streams trigger for stream records. */
export { kinesisTrigger } from './triggers/kinesis'

/** Lambda Function URL trigger for direct HTTP access. */
export { lambdaUrlTrigger } from './triggers/lambda-url'

/** S3 event notification trigger for bucket events. */
export { s3Trigger } from './triggers/s3'

/** SNS (Simple Notification Service) trigger for pub/sub messages. */
export { snsTrigger } from './triggers/sns'

/** SQS (Simple Queue Service) trigger for queue messages. */
export { sqsTrigger } from './triggers/sqs'
