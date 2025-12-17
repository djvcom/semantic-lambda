import { APIGatewayProxyEventSchema } from '@aws-lambda-powertools/parser/schemas'
import type { Attributes, Context as OtelContext } from '@opentelemetry/api'
import { ROOT_CONTEXT } from '@opentelemetry/api'
import {
  ATTR_CLIENT_ADDRESS,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_ROUTE,
  ATTR_NETWORK_PROTOCOL_NAME,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_URL_PATH,
  ATTR_URL_QUERY,
  ATTR_URL_SCHEME,
  ATTR_USER_AGENT_ORIGINAL,
} from '@opentelemetry/semantic-conventions/incubating'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { extractContextFromHeaders, extractContextFromMultiValueHeaders } from '../propagation'
import type { TriggerConfig } from './base'
import { normaliseHeaders, parseHostHeader } from './http-shared'

export function extractApiGatewayAttributes(event: APIGatewayProxyEvent): Attributes {
  const headers = normaliseHeaders(event.headers)

  const attributes: Attributes = {
    [ATTR_HTTP_REQUEST_METHOD]: event.httpMethod.toUpperCase(),
    [ATTR_HTTP_ROUTE]: event.resource,
    [ATTR_URL_PATH]: event.path,
    [ATTR_URL_SCHEME]: headers['x-forwarded-proto'] ?? 'https',
    [ATTR_NETWORK_PROTOCOL_NAME]: 'http',
  }

  if (event.queryStringParameters) {
    const queryString = new URLSearchParams(
      event.queryStringParameters as Record<string, string>,
    ).toString()
    if (queryString) {
      attributes[ATTR_URL_QUERY] = queryString
    }
  }

  if (headers.host) {
    const { address, port } = parseHostHeader(headers.host)
    attributes[ATTR_SERVER_ADDRESS] = address
    if (port) {
      attributes[ATTR_SERVER_PORT] = port
    }
  }

  if (headers['x-forwarded-port'] && !attributes[ATTR_SERVER_PORT]) {
    const port = Number.parseInt(headers['x-forwarded-port'], 10)
    if (!Number.isNaN(port)) {
      attributes[ATTR_SERVER_PORT] = port
    }
  }

  if (headers['user-agent']) {
    attributes[ATTR_USER_AGENT_ORIGINAL] = headers['user-agent']
  }

  if (event.requestContext?.identity?.sourceIp) {
    attributes[ATTR_CLIENT_ADDRESS] = event.requestContext.identity.sourceIp
  }

  return attributes
}

export function getApiGatewaySpanName(event: APIGatewayProxyEvent): string {
  const method = event.httpMethod.toUpperCase()
  if (event.resource) {
    return `${method} ${event.resource}`
  }
  return method
}

export function extractApiGatewayParentContext(event: APIGatewayProxyEvent): OtelContext {
  // Try multiValueHeaders first (for AWS Lambda Proxy Integration)
  if (event.multiValueHeaders) {
    const context = extractContextFromMultiValueHeaders(event.multiValueHeaders)
    if (context !== ROOT_CONTEXT) return context
  }

  // Fall back to single value headers
  if (event.headers) {
    const context = extractContextFromHeaders(event.headers)
    if (context !== ROOT_CONTEXT) return context
  }

  return ROOT_CONTEXT
}

export const apiGatewayTrigger: TriggerConfig<APIGatewayProxyEvent> = {
  name: 'apiGateway',
  category: 'http',
  schema: APIGatewayProxyEventSchema,
  detectionPriority: 90,

  extractAttributes: extractApiGatewayAttributes,
  getSpanName: getApiGatewaySpanName,
  extractParentContext: extractApiGatewayParentContext,
}
