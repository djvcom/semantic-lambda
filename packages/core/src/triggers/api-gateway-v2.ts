import { APIGatewayProxyEventV2Schema } from '@aws-lambda-powertools/parser/schemas'
import type { Attributes, Context as OtelContext } from '@opentelemetry/api'
import { ROOT_CONTEXT } from '@opentelemetry/api'
import {
  ATTR_CLIENT_ADDRESS,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_ROUTE,
  ATTR_NETWORK_PROTOCOL_NAME,
  ATTR_NETWORK_PROTOCOL_VERSION,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_URL_PATH,
  ATTR_URL_QUERY,
  ATTR_URL_SCHEME,
  ATTR_USER_AGENT_ORIGINAL,
} from '@opentelemetry/semantic-conventions/incubating'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'
import { extractContextFromHeaders } from '../propagation'
import type { TriggerConfig } from './base'
import { normaliseHeaders, parseHostHeader } from './http-shared'

export function extractApiGatewayV2Attributes(event: APIGatewayProxyEventV2): Attributes {
  const headers = normaliseHeaders(event.headers)

  const attributes: Attributes = {
    [ATTR_HTTP_REQUEST_METHOD]: event.requestContext.http.method.toUpperCase(),
    [ATTR_URL_PATH]: event.rawPath,
    [ATTR_URL_SCHEME]: headers['x-forwarded-proto'] ?? 'https',
    [ATTR_NETWORK_PROTOCOL_NAME]: 'http',
  }

  if (event.routeKey && event.routeKey !== '$default') {
    const routeParts = event.routeKey.split(' ')
    attributes[ATTR_HTTP_ROUTE] = routeParts.length > 1 ? routeParts[1] : event.routeKey
  }

  if (event.rawQueryString) {
    attributes[ATTR_URL_QUERY] = event.rawQueryString
  }

  if (event.requestContext.http.protocol) {
    const protocolParts = event.requestContext.http.protocol.split('/')
    if (protocolParts.length > 1 && protocolParts[1]) {
      attributes[ATTR_NETWORK_PROTOCOL_VERSION] = protocolParts[1]
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

  if (event.requestContext.http.sourceIp) {
    attributes[ATTR_CLIENT_ADDRESS] = event.requestContext.http.sourceIp
  }

  return attributes
}

export function getApiGatewayV2SpanName(event: APIGatewayProxyEventV2): string {
  const method = event.requestContext.http.method.toUpperCase()
  if (event.routeKey && event.routeKey !== '$default') {
    const routeParts = event.routeKey.split(' ')
    const route = routeParts.length > 1 ? routeParts[1] : event.routeKey
    return `${method} ${route}`
  }
  return method
}

export function extractApiGatewayV2ParentContext(event: APIGatewayProxyEventV2): OtelContext {
  if (event.headers) {
    const context = extractContextFromHeaders(event.headers)
    if (context !== ROOT_CONTEXT) return context
  }
  return ROOT_CONTEXT
}

export const apiGatewayV2Trigger: TriggerConfig<APIGatewayProxyEventV2> = {
  name: 'apiGatewayV2',
  category: 'http',
  schema: APIGatewayProxyEventV2Schema,
  detectionPriority: 100,

  extractAttributes: extractApiGatewayV2Attributes,
  getSpanName: getApiGatewayV2SpanName,
  extractParentContext: extractApiGatewayV2ParentContext,
}
