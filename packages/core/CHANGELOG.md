# Changelog

## [0.3.0](https://github.com/djvcom/semantic-lambda/compare/core-v0.2.0...core-v0.3.0) (2025-12-18)


### ⚠ BREAKING CHANGES

* **core:** Minimum Node.js version is now 24

### Features

* **core:** widen Handler type to support sync and async returns ([#7](https://github.com/djvcom/semantic-lambda/issues/7)) ([114c8f7](https://github.com/djvcom/semantic-lambda/commit/114c8f79f0d6205e7eb9b0619c1f3df96a6f14ab))

## [0.2.0](https://github.com/djvcom/semantic-lambda/compare/core-v0.1.1...core-v0.2.0) (2025-12-18)


### ⚠ BREAKING CHANGES

* SQS/SNS triggers now use pub/sub semantics where ALL messages become span links rather than using the first message's context as parent. This correctly models batch processing where each message may originate from different traces.


### Features

* **propagation:** support W3C context extraction for SQS/SNS ([46914c9](https://github.com/djvcom/semantic-lambda/commit/46914c91bdea4cf174fb354fa6ec2076fef4a785))


### Documentation

* update child span example and context propagation docs


## [0.1.1](https://github.com/djvcom/semantic-lambda/compare/core-v0.1.0...core-v0.1.1) (2025-12-17)


### Features

* initial release of [@semantic-lambda](https://github.com/semantic-lambda) packages ([8e10047](https://github.com/djvcom/semantic-lambda/commit/8e100474fa8cd9139d7312cd848b77ef11f58226))
