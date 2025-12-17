# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-12-17

### Added

#### @semantic-lambda/core

- Initial release
- Lambda handler wrapper with automatic span creation
- Support for all major AWS Lambda triggers:
  - API Gateway (v1 and v2)
  - Application Load Balancer
  - Lambda Function URLs
  - SQS
  - SNS
  - Kinesis Data Streams
  - DynamoDB Streams
  - S3
  - EventBridge
  - CloudWatch Logs
- OpenTelemetry FaaS semantic convention compliance
- Automatic context propagation (W3C Trace Context and X-Ray)
- Cold start detection per instance
- Automatic error recording on spans
- Middy middleware integration
- Both explicit trigger type and dynamic detection modes

#### @semantic-lambda/testing

- Initial release
- In-memory span exporter for testing
- Mock event factories for API Gateway, SQS, and Lambda Context
- Span assertion helpers (findSpan, assertSpanExists)
- Attribute extraction utilities

[Unreleased]: https://github.com/djvcom/semantic-lambda/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/djvcom/semantic-lambda/releases/tag/v0.1.0
