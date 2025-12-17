import { AlbSchema } from '@aws-lambda-powertools/parser/schemas'
import { type Attributes, type Context as OtelContext, ROOT_CONTEXT } from '@opentelemetry/api'
import {
  ATTR_CLIENT_ADDRESS,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_NETWORK_PROTOCOL_NAME,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_URL_PATH,
  ATTR_URL_QUERY,
  ATTR_URL_SCHEME,
  ATTR_USER_AGENT_ORIGINAL,
} from '@opentelemetry/semantic-conventions/incubating'
import type { ALBEvent } from 'aws-lambda'
import { extractContextFromHeaders } from '../propagation'
import type { TriggerConfig } from './base'
import { normaliseHeaders, parseHostHeader } from './http-shared'

export function extractAlbAttributes(event: ALBEvent): Attributes {
  const headers = normaliseHeaders(event.headers ?? {})

  const attributes: Attributes = {
    [ATTR_HTTP_REQUEST_METHOD]: event.httpMethod.toUpperCase(),
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

  if (headers['x-forwarded-for']) {
    const ips = headers['x-forwarded-for'].split(',')
    const clientIp = ips[0]?.trim()
    if (clientIp) {
      attributes[ATTR_CLIENT_ADDRESS] = clientIp
    }
  }

  return attributes
}

/**
 * Returns span name for ALB events.
 * Note: ALB doesn't provide route templates, so the raw path is used.
 * This may create high-cardinality span names if paths contain dynamic segments.
 */
export function getAlbSpanName(event: ALBEvent): string {
  const method = event.httpMethod.toUpperCase()
  return event.path ? `${method} ${event.path}` : method
}

export function extractAlbParentContext(event: ALBEvent): OtelContext {
  if (event.headers) {
    const context = extractContextFromHeaders(event.headers)
    if (context !== ROOT_CONTEXT) return context
  }
  return ROOT_CONTEXT
}

export const albTrigger: TriggerConfig<ALBEvent> = {
  name: 'alb',
  category: 'http',
  schema: AlbSchema,
  detectionPriority: 90,

  extractAttributes: extractAlbAttributes,
  getSpanName: getAlbSpanName,
  extractParentContext: extractAlbParentContext,
}
