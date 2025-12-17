import {
  type Attributes,
  type Link,
  type Context as OtelContext,
  SpanKind,
} from '@opentelemetry/api'
import type { Context } from 'aws-lambda'

/**
 * Category of trigger, maps to OTel FaaS trigger semantic convention.
 */
export type TriggerCategory = 'http' | 'pubsub' | 'datasource' | 'timer' | 'other'

/**
 * Schema interface for event validation.
 * Compatible with Zod schemas from @aws-lambda-powertools/parser.
 */
export interface EventSchema<TEvent = unknown> {
  safeParse(data: unknown): { success: true; data: TEvent } | { success: false; error: unknown }
}

/**
 * Configuration for a Lambda trigger type.
 * Each trigger implements this interface to provide semantic span attributes.
 */
export interface TriggerConfig<TEvent = unknown> {
  /**
   * Unique identifier for this trigger (e.g., 'sqs', 'apiGatewayV2').
   */
  readonly name: string

  /**
   * Category for SpanKind and faas.trigger attribute.
   */
  readonly category: TriggerCategory

  /**
   * Schema for event validation.
   * Used for dynamic event detection when trigger type is not specified.
   * Note: Schema output type may differ from TEvent due to Zod transformations.
   */
  readonly schema?: EventSchema

  /**
   * Priority for schema matching during dynamic detection.
   * Higher values are checked first. Default is 0.
   *
   * Recommended ranges:
   * - 100: Most specific schemas (unique fields)
   * - 80-90: Well-defined event structures
   * - 50-70: Less specific schemas
   */
  readonly detectionPriority?: number

  /**
   * Extract trigger-specific attributes from the event.
   * These are added to the span alongside common FaaS attributes.
   */
  extractAttributes(event: TEvent): Attributes

  /**
   * Generate the span name from the event and Lambda context.
   * Should follow OTel naming conventions for the trigger type.
   */
  getSpanName(event: TEvent, lambdaContext: Context): string

  /**
   * Extract parent context from the event for distributed tracing.
   * Returns the extracted context or undefined to use default propagation.
   */
  extractParentContext?(event: TEvent): OtelContext | undefined

  /**
   * Extract span links from batch events.
   * Used for messaging systems where batch contains multiple trace contexts.
   * Returns links to traces from records beyond the first.
   */
  extractSpanLinks?(event: TEvent): Link[]
}

/**
 * Maps trigger category to OTel SpanKind.
 */
export function getSpanKindForCategory(category: TriggerCategory): SpanKind {
  switch (category) {
    case 'pubsub':
    case 'datasource':
      return SpanKind.CONSUMER
    default:
      return SpanKind.SERVER
  }
}

/**
 * Maps trigger category to OTel faas.trigger attribute value.
 */
export function getFaasTriggerValue(category: TriggerCategory): string {
  switch (category) {
    case 'http':
      return 'http'
    case 'pubsub':
      return 'pubsub'
    case 'datasource':
      return 'datasource'
    case 'timer':
      return 'timer'
    default:
      return 'other'
  }
}
