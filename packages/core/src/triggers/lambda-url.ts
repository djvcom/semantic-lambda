import { LambdaFunctionUrlSchema } from '@aws-lambda-powertools/parser/schemas'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'
import {
  extractApiGatewayV2Attributes,
  extractApiGatewayV2ParentContext,
  getApiGatewayV2SpanName,
} from './api-gateway-v2'
import type { TriggerConfig } from './base'

// Lambda URL events use the same format as API Gateway v2
export const lambdaUrlTrigger: TriggerConfig<APIGatewayProxyEventV2> = {
  name: 'lambdaUrl',
  category: 'http',
  schema: LambdaFunctionUrlSchema,
  detectionPriority: 100,

  extractAttributes: extractApiGatewayV2Attributes,
  getSpanName: getApiGatewayV2SpanName,
  extractParentContext: extractApiGatewayV2ParentContext,
}

// Re-export for convenience
export { extractApiGatewayV2Attributes as extractLambdaUrlAttributes }
export { getApiGatewayV2SpanName as getLambdaUrlSpanName }
