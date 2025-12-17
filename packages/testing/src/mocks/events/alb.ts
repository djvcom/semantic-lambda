import type { ALBEvent } from 'aws-lambda'

/**
 * Options for creating a mock ALB (Application Load Balancer) event.
 */
export interface MockAlbEventOptions {
  /** HTTP method. Defaults to 'GET'. */
  httpMethod?: string
  /** Request path. Defaults to '/test'. */
  path?: string
  /** Request body. */
  body?: string | null
  /** HTTP headers. Common headers are provided by default. */
  headers?: Record<string, string>
  /** Query string parameters. */
  queryStringParameters?: Record<string, string>
  /** Whether the body is base64 encoded. Defaults to false. */
  isBase64Encoded?: boolean
}

/**
 * Creates a mock ALB event for testing Lambda handlers.
 *
 * @param options - Configuration for the mock event
 * @returns A valid ALBEvent object
 *
 * @example
 * ```typescript
 * const event = createMockAlbEvent({
 *   httpMethod: 'POST',
 *   path: '/api/orders',
 *   body: JSON.stringify({ product: 'widget' }),
 * })
 * ```
 */
export function createMockAlbEvent(options: MockAlbEventOptions = {}): ALBEvent {
  const httpMethod = options.httpMethod ?? 'GET'
  const path = options.path ?? '/test'

  return {
    requestContext: {
      elb: {
        targetGroupArn:
          'arn:aws:elasticloadbalancing:eu-west-1:123456789012:targetgroup/my-target-group/abc123',
      },
    },
    httpMethod,
    path,
    queryStringParameters: options.queryStringParameters,
    headers: {
      host: 'api.example.com',
      'user-agent': 'test-agent',
      'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      'x-forwarded-proto': 'https',
      'x-forwarded-port': '443',
      ...options.headers,
    },
    body: options.body ?? null,
    isBase64Encoded: options.isBase64Encoded ?? false,
  }
}
