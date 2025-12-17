export interface ArnComponents {
  partition: string
  service: string
  region: string
  accountId: string
  resource: string
}

const ARN_REGEX = /^arn:([^:]+):([^:]+):([^:]*):([^:]*):(.+)$/

export function parseArn(arn: string): ArnComponents | null {
  const match = arn.match(ARN_REGEX)
  if (!match) return null

  // Regex guarantees partition ([^:]+), service ([^:]+), and resource (.+) are non-empty
  const [, partition, service, region, accountId, resource] = match

  return {
    partition: partition!,
    service: service!,
    region: region ?? '',
    accountId: accountId ?? '',
    resource: resource!,
  }
}

export function extractRegionAndAccount(arn: string): { region: string; accountId: string } | null {
  const components = parseArn(arn)
  if (!components || !components.region || !components.accountId) return null

  return {
    region: components.region,
    accountId: components.accountId,
  }
}

export function extractResourceName(arn: string): string {
  const components = parseArn(arn)
  if (!components) return arn

  const resource = components.resource

  // DynamoDB table: table/name or table/name/stream/...
  if (resource.startsWith('table/')) {
    const parts = resource.split('/')
    return parts[1] ?? resource
  }

  // Kinesis stream: stream/name
  if (resource.startsWith('stream/')) {
    const parts = resource.split('/')
    return parts[1] ?? resource
  }

  // Lambda function: function:name or function:name:qualifier
  if (resource.startsWith('function:')) {
    const parts = resource.split(':')
    return parts[1] ?? resource
  }

  // Default: last segment after colon (SQS, SNS, etc.)
  const colonParts = resource.split(':')
  return colonParts[colonParts.length - 1] ?? resource
}

export function extractQueueName(arn: string): string {
  return extractResourceName(arn)
}

export function extractTopicName(arn: string): string {
  return extractResourceName(arn)
}

export function extractStreamName(arn: string): string {
  return extractResourceName(arn)
}

export function extractTableName(arn: string): string {
  return extractResourceName(arn)
}
