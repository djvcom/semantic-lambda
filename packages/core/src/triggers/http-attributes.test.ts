import {
  createMockAlbEvent,
  createMockApiGatewayEvent,
  createMockApiGatewayV2Event,
} from '@semantic-lambda/testing'
import { describe, expect, it } from 'vitest'
import { extractAlbAttributes } from './alb'
import { extractApiGatewayAttributes } from './api-gateway'
import { extractApiGatewayV2Attributes } from './api-gateway-v2'

describe('extractApiGatewayAttributes', () => {
  it('extracts basic HTTP attributes', () => {
    const event = createMockApiGatewayEvent({
      httpMethod: 'POST',
      path: '/users/123',
      resource: '/users/{id}',
    })

    const attributes = extractApiGatewayAttributes(event)

    expect(attributes['http.request.method']).toBe('POST')
    expect(attributes['http.route']).toBe('/users/{id}')
    expect(attributes['url.path']).toBe('/users/123')
    expect(attributes['network.protocol.name']).toBe('http')
  })

  it('extracts query string parameters', () => {
    const event = createMockApiGatewayEvent({
      queryStringParameters: { foo: 'bar', baz: 'qux' },
    })

    const attributes = extractApiGatewayAttributes(event)

    expect(attributes['url.query']).toBe('foo=bar&baz=qux')
  })

  it('handles empty query string parameters', () => {
    const event = createMockApiGatewayEvent({
      queryStringParameters: null,
    })

    const attributes = extractApiGatewayAttributes(event)

    expect(attributes['url.query']).toBeUndefined()
  })

  it('extracts host from Host header', () => {
    const event = createMockApiGatewayEvent({
      headers: { Host: 'api.example.com' },
    })

    const attributes = extractApiGatewayAttributes(event)

    expect(attributes['server.address']).toBe('api.example.com')
  })

  it('extracts host and port from Host header with port', () => {
    const event = createMockApiGatewayEvent({
      headers: { Host: 'api.example.com:8080' },
    })

    const attributes = extractApiGatewayAttributes(event)

    expect(attributes['server.address']).toBe('api.example.com')
    expect(attributes['server.port']).toBe(8080)
  })

  it('uses x-forwarded-port when Host has no port', () => {
    const event = createMockApiGatewayEvent({
      headers: {
        Host: 'api.example.com',
        'X-Forwarded-Port': '443',
      },
    })

    const attributes = extractApiGatewayAttributes(event)

    expect(attributes['server.address']).toBe('api.example.com')
    expect(attributes['server.port']).toBe(443)
  })

  it('prefers Host port over x-forwarded-port', () => {
    const event = createMockApiGatewayEvent({
      headers: {
        Host: 'api.example.com:8080',
        'X-Forwarded-Port': '443',
      },
    })

    const attributes = extractApiGatewayAttributes(event)

    expect(attributes['server.port']).toBe(8080)
  })

  it('extracts user agent', () => {
    const event = createMockApiGatewayEvent({
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })

    const attributes = extractApiGatewayAttributes(event)

    expect(attributes['user_agent.original']).toBe('Mozilla/5.0')
  })

  it('extracts URL scheme from x-forwarded-proto', () => {
    const event = createMockApiGatewayEvent({
      headers: { 'X-Forwarded-Proto': 'https' },
    })

    const attributes = extractApiGatewayAttributes(event)

    expect(attributes['url.scheme']).toBe('https')
  })

  it('extracts client IP from request context', () => {
    const event = createMockApiGatewayEvent({
      requestContext: {
        identity: {
          sourceIp: '192.168.1.100',
          userAgent: 'test',
          accessKey: null,
          accountId: null,
          apiKey: null,
          apiKeyId: null,
          caller: null,
          clientCert: null,
          cognitoAuthenticationProvider: null,
          cognitoAuthenticationType: null,
          cognitoIdentityId: null,
          cognitoIdentityPoolId: null,
          principalOrgId: null,
          user: null,
          userArn: null,
        },
      },
    })

    const attributes = extractApiGatewayAttributes(event)

    expect(attributes['client.address']).toBe('192.168.1.100')
  })

  it('normalises header names to lowercase', () => {
    const event = createMockApiGatewayEvent({
      headers: {
        HOST: 'api.example.com',
        'USER-AGENT': 'Custom Agent',
      },
    })

    const attributes = extractApiGatewayAttributes(event)

    expect(attributes['server.address']).toBe('api.example.com')
    expect(attributes['user_agent.original']).toBe('Custom Agent')
  })

  it('uppercases HTTP method', () => {
    const event = createMockApiGatewayEvent({
      httpMethod: 'post',
    })

    const attributes = extractApiGatewayAttributes(event)

    expect(attributes['http.request.method']).toBe('POST')
  })
})

describe('extractApiGatewayV2Attributes', () => {
  it('extracts basic HTTP attributes', () => {
    const event = createMockApiGatewayV2Event({
      method: 'PUT',
      path: '/items/456',
      routeKey: 'PUT /items/{id}',
    })

    const attributes = extractApiGatewayV2Attributes(event)

    expect(attributes['http.request.method']).toBe('PUT')
    expect(attributes['http.route']).toBe('/items/{id}')
    expect(attributes['url.path']).toBe('/items/456')
    expect(attributes['network.protocol.name']).toBe('http')
  })

  it('extracts raw query string', () => {
    const event = createMockApiGatewayV2Event({
      rawQueryString: 'foo=bar&baz=qux',
    })

    const attributes = extractApiGatewayV2Attributes(event)

    expect(attributes['url.query']).toBe('foo=bar&baz=qux')
  })

  it('handles empty raw query string', () => {
    const event = createMockApiGatewayV2Event({
      rawQueryString: '',
    })

    const attributes = extractApiGatewayV2Attributes(event)

    expect(attributes['url.query']).toBeUndefined()
  })

  it('extracts protocol version from HTTP protocol', () => {
    const event = createMockApiGatewayV2Event()

    const attributes = extractApiGatewayV2Attributes(event)

    expect(attributes['network.protocol.version']).toBe('1.1')
  })

  it('handles $default route key', () => {
    const event = createMockApiGatewayV2Event({
      routeKey: '$default',
    })

    const attributes = extractApiGatewayV2Attributes(event)

    expect(attributes['http.route']).toBeUndefined()
  })

  it('handles route key without method prefix', () => {
    const event = createMockApiGatewayV2Event({
      routeKey: '/simple-path',
    })

    const attributes = extractApiGatewayV2Attributes(event)

    expect(attributes['http.route']).toBe('/simple-path')
  })

  it('extracts host from host header', () => {
    const event = createMockApiGatewayV2Event({
      headers: { host: 'api.example.com' },
    })

    const attributes = extractApiGatewayV2Attributes(event)

    expect(attributes['server.address']).toBe('api.example.com')
  })

  it('extracts host and port from host header with port', () => {
    const event = createMockApiGatewayV2Event({
      headers: { host: 'api.example.com:9000' },
    })

    const attributes = extractApiGatewayV2Attributes(event)

    expect(attributes['server.address']).toBe('api.example.com')
    expect(attributes['server.port']).toBe(9000)
  })

  it('extracts user agent', () => {
    const event = createMockApiGatewayV2Event({
      headers: { 'user-agent': 'CustomBot/1.0' },
    })

    const attributes = extractApiGatewayV2Attributes(event)

    expect(attributes['user_agent.original']).toBe('CustomBot/1.0')
  })

  it('extracts URL scheme from x-forwarded-proto', () => {
    const event = createMockApiGatewayV2Event({
      headers: { 'x-forwarded-proto': 'https' },
    })

    const attributes = extractApiGatewayV2Attributes(event)

    expect(attributes['url.scheme']).toBe('https')
  })

  it('extracts client IP from request context', () => {
    const event = createMockApiGatewayV2Event()

    const attributes = extractApiGatewayV2Attributes(event)

    expect(attributes['client.address']).toBe('127.0.0.1')
  })

  it('uppercases HTTP method', () => {
    const event = createMockApiGatewayV2Event({
      method: 'delete',
    })

    const attributes = extractApiGatewayV2Attributes(event)

    expect(attributes['http.request.method']).toBe('DELETE')
  })
})

describe('extractAlbAttributes', () => {
  it('extracts basic HTTP attributes', () => {
    const event = createMockAlbEvent({
      httpMethod: 'PATCH',
      path: '/resources/789',
    })

    const attributes = extractAlbAttributes(event)

    expect(attributes['http.request.method']).toBe('PATCH')
    expect(attributes['url.path']).toBe('/resources/789')
    expect(attributes['network.protocol.name']).toBe('http')
  })

  it('extracts query string parameters', () => {
    const event = createMockAlbEvent({
      queryStringParameters: { key: 'value', other: 'param' },
    })

    const attributes = extractAlbAttributes(event)

    expect(attributes['url.query']).toBe('key=value&other=param')
  })

  it('handles undefined query string parameters', () => {
    const event = createMockAlbEvent({})

    const attributes = extractAlbAttributes(event)

    expect(attributes['url.query']).toBeUndefined()
  })

  it('extracts host from host header', () => {
    const event = createMockAlbEvent({
      headers: { host: 'alb.example.com' },
    })

    const attributes = extractAlbAttributes(event)

    expect(attributes['server.address']).toBe('alb.example.com')
  })

  it('extracts host and port from host header with port', () => {
    const event = createMockAlbEvent({
      headers: { host: 'alb.example.com:8443' },
    })

    const attributes = extractAlbAttributes(event)

    expect(attributes['server.address']).toBe('alb.example.com')
    expect(attributes['server.port']).toBe(8443)
  })

  it('uses x-forwarded-port when host has no port', () => {
    const event = createMockAlbEvent({
      headers: {
        host: 'alb.example.com',
        'x-forwarded-port': '443',
      },
    })

    const attributes = extractAlbAttributes(event)

    expect(attributes['server.port']).toBe(443)
  })

  it('extracts user agent', () => {
    const event = createMockAlbEvent({
      headers: { 'user-agent': 'ALB-HealthChecker/2.0' },
    })

    const attributes = extractAlbAttributes(event)

    expect(attributes['user_agent.original']).toBe('ALB-HealthChecker/2.0')
  })

  it('extracts URL scheme from x-forwarded-proto', () => {
    const event = createMockAlbEvent({
      headers: { 'x-forwarded-proto': 'https' },
    })

    const attributes = extractAlbAttributes(event)

    expect(attributes['url.scheme']).toBe('https')
  })

  it('extracts client IP from x-forwarded-for header', () => {
    const event = createMockAlbEvent({
      headers: { 'x-forwarded-for': '10.0.0.50, 192.168.1.1' },
    })

    const attributes = extractAlbAttributes(event)

    expect(attributes['client.address']).toBe('10.0.0.50')
  })

  it('handles single IP in x-forwarded-for', () => {
    const event = createMockAlbEvent({
      headers: { 'x-forwarded-for': '172.16.0.1' },
    })

    const attributes = extractAlbAttributes(event)

    expect(attributes['client.address']).toBe('172.16.0.1')
  })

  it('handles empty x-forwarded-for header', () => {
    const event = createMockAlbEvent({
      headers: { 'x-forwarded-for': '' },
    })

    const attributes = extractAlbAttributes(event)

    expect(attributes['client.address']).toBeUndefined()
  })

  it('uppercases HTTP method', () => {
    const event = createMockAlbEvent({
      httpMethod: 'options',
    })

    const attributes = extractAlbAttributes(event)

    expect(attributes['http.request.method']).toBe('OPTIONS')
  })
})
