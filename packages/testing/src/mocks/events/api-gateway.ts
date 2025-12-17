import type { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from 'aws-lambda'

/**
 * Options for creating a mock API Gateway REST API (v1) event.
 */
export interface MockApiGatewayEventOptions {
  /** HTTP method. Defaults to 'GET'. */
  httpMethod?: string
  /** Request path. Defaults to '/test'. */
  path?: string
  /** API Gateway resource pattern (e.g., '/users/{id}'). Defaults to path. */
  resource?: string
  /** Request body. */
  body?: string | null
  /** HTTP headers. Common headers are provided by default. */
  headers?: Record<string, string>
  /** Query string parameters. */
  queryStringParameters?: Record<string, string> | null
  /** Path parameters extracted from resource pattern. */
  pathParameters?: Record<string, string> | null
  /** Override request context fields. */
  requestContext?: Partial<APIGatewayProxyEvent['requestContext']>
}

/**
 * Creates a mock API Gateway REST API (v1) event for testing Lambda handlers.
 *
 * @param options - Configuration for the mock event
 * @returns A valid APIGatewayProxyEvent object
 *
 * @example
 * ```typescript
 * const event = createMockApiGatewayEvent({
 *   httpMethod: 'POST',
 *   path: '/users',
 *   body: JSON.stringify({ name: 'Alice' }),
 * })
 * ```
 */
export function createMockApiGatewayEvent(
  options: MockApiGatewayEventOptions = {},
): APIGatewayProxyEvent {
  const httpMethod = options.httpMethod ?? 'GET'
  const path = options.path ?? '/test'
  const resource = options.resource ?? path

  return {
    httpMethod,
    path,
    resource,
    body: options.body ?? null,
    headers: {
      Host: 'api.example.com',
      'User-Agent': 'test-agent',
      'X-Forwarded-Proto': 'https',
      'X-Forwarded-Port': '443',
      ...options.headers,
    },
    multiValueHeaders: {},
    queryStringParameters: options.queryStringParameters ?? null,
    multiValueQueryStringParameters: null,
    pathParameters: options.pathParameters ?? null,
    stageVariables: null,
    isBase64Encoded: false,
    requestContext: {
      accountId: '123456789012',
      apiId: 'testapi',
      authorizer: null,
      httpMethod,
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
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
      path,
      protocol: 'HTTP/1.1',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'testresource',
      resourcePath: resource,
      stage: 'test',
      ...options.requestContext,
    },
  }
}

/**
 * Options for creating a mock API Gateway HTTP API (v2) event.
 */
export interface MockApiGatewayV2EventOptions {
  /** HTTP method. Defaults to 'GET'. */
  method?: string
  /** Request path. Defaults to '/test'. */
  path?: string
  /** Route key (e.g., 'GET /users/{id}'). Defaults to method + path. */
  routeKey?: string
  /** Request body. */
  body?: string
  /** HTTP headers. Common headers are provided by default. */
  headers?: Record<string, string>
  /** Query string parameters. */
  queryStringParameters?: Record<string, string>
  /** Path parameters extracted from route. */
  pathParameters?: Record<string, string>
  /** Raw query string (e.g., 'foo=bar&baz=qux'). */
  rawQueryString?: string
}

/**
 * Creates a mock API Gateway HTTP API (v2) event for testing Lambda handlers.
 *
 * @param options - Configuration for the mock event
 * @returns A valid APIGatewayProxyEventV2 object
 *
 * @example
 * ```typescript
 * const event = createMockApiGatewayV2Event({
 *   method: 'GET',
 *   path: '/users/123',
 *   pathParameters: { id: '123' },
 * })
 * ```
 */
export function createMockApiGatewayV2Event(
  options: MockApiGatewayV2EventOptions = {},
): APIGatewayProxyEventV2 {
  const method = options.method ?? 'GET'
  const path = options.path ?? '/test'
  const routeKey = options.routeKey ?? `${method} ${path}`

  const event: APIGatewayProxyEventV2 = {
    version: '2.0',
    routeKey,
    rawPath: path,
    rawQueryString: options.rawQueryString ?? '',
    headers: {
      host: 'api.example.com',
      'user-agent': 'test-agent',
      'x-forwarded-proto': 'https',
      'x-forwarded-port': '443',
      ...options.headers,
    },
    isBase64Encoded: false,
    requestContext: {
      accountId: '123456789012',
      apiId: 'testapi',
      domainName: 'api.example.com',
      domainPrefix: 'api',
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
      requestId: 'test-request-id',
      routeKey,
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
  }

  if (options.queryStringParameters) {
    event.queryStringParameters = options.queryStringParameters
  }
  if (options.pathParameters) {
    event.pathParameters = options.pathParameters
  }
  if (options.body) {
    event.body = options.body
  }

  return event
}
