# Contributing to @semantic-lambda

Thank you for your interest in contributing. This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 20, 22, or 24
- Yarn 4.12.0+ (via corepack)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/djvcom/semantic-lambda.git
cd semantic-lambda

# Install dependencies
corepack enable
yarn install

# Run tests
yarn test:run

# Run tests in watch mode
yarn test

# Build all packages
yarn build

# Lint and format
yarn lint:fix
yarn format
```

## Project Structure

```
semantic-lambda/
├── packages/
│   ├── core/          # Main Lambda wrapper package
│   └── testing/       # Testing utilities
├── docs/              # Documentation
└── .github/           # CI/CD workflows
```

## Making Changes

### Branching Strategy

- `main` - stable branch
- Feature branches: `feature/description`
- Bug fixes: `fix/description`

### Commit Messages

Follow Conventional Commits format:

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

Types: feat, fix, docs, style, refactor, test, chore, perf

Examples:
```
feat(core): add support for EventBridge triggers
fix(testing): correct mock SQS event structure
docs: update getting started guide
```

### Testing

- Write tests for all new features
- Ensure all tests pass: `yarn test:run`
- Maintain or improve code coverage: `yarn test:coverage`
- Add benchmarks for performance-critical changes: `yarn bench:run`

### Code Style

- Code is automatically formatted with Biome
- Run `yarn lint:fix` before committing
- TypeScript strict mode is enforced
- Prefer self-documenting code over inline comments

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure CI passes (lint, typecheck, tests, build)
5. Submit a PR with a clear description

### PR Checklist

- [ ] Tests added/updated
- [ ] Documentation updated (if user-facing changes)
- [ ] CHANGELOG.md updated (for user-facing changes)
- [ ] Types exported and documented
- [ ] Benchmarks run (for performance changes)

## Release Process

Releases are managed by maintainers:

1. Update version in package.json files
2. Update CHANGELOG.md
3. Create git tag
4. Publish to npm

## Questions?

Open an issue or discussion on GitHub.

## Licence

By contributing, you agree that your contributions will be licenced under the MIT Licence.
