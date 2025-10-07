# Hyperfy SDK Package Structure

This document outlines the optimal package structure for the Hyperfy SDK npm package.

## Overview

The Hyperfy SDK is designed as a comprehensive Node.js library for building immersive 3D experiences on the Hyperfy platform. The package structure balances development convenience with production optimization.

## Directory Structure

```
hypersdk/
├── src/                    # Source code
│   ├── managers/          # SDK managers (App, Entity, Chat, etc.)
│   ├── client/           # HTTP and WebSocket clients
│   ├── entities/         # Entity management system
│   ├── builders/         # Builder utilities
│   ├── utils/            # Utility functions and helpers
│   ├── types/            # TypeScript type definitions
│   ├── index.ts          # Main entry point
│   └── cli.ts            # CLI tool
├── dist/                  # Built distribution files
│   ├── index.js          # CommonJS build
│   ├── index.esm.js      # ES Module build
│   ├── index.d.ts        # TypeScript definitions
│   └── cli.js            # CLI tool (executable)
├── examples/              # Usage examples
│   ├── basic-usage.ts
│   ├── entity-management.ts
│   ├── file-operations.ts
│   └── app-development.ts
├── tests/                 # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/                  # Documentation
│   ├── GETTING_STARTED.md
│   ├── API_REFERENCE.md
│   ├── TESTING.md
│   └── APP_DEVELOPMENT_SDK.md
├── .github/               # GitHub workflows
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── package.json           # Package configuration
├── .npmignore            # Files to exclude from npm package
├── .gitignore            # Files to exclude from git
├── tsconfig.json         # TypeScript configuration
├── rollup.config.js      # Build configuration
├── jest.setup.js         # Jest test setup
├── README.md             # Main documentation
├── CHANGELOG.md          # Version history
├── LICENSE               # MIT license
├── CONTRIBUTING.md       # Contribution guidelines
└── RELEASE_PROCESS.md    # Release procedures
```

## Files Included in npm Package

The `.npmignore` file ensures only necessary files are published:

### Included Files
- `dist/` - Built distribution files
- `src/` - Source code (for transparency and debugging)
- `examples/` - Usage examples
- `README.md` - Main documentation
- `LICENSE` - License file
- `CHANGELOG.md` - Version history

### Excluded Files
- All test files (`tests/`, `test-*.js`, `*-test.js`)
- Development configuration (`.github/`, `config/`)
- Build artifacts and caches (`node_modules/`, `coverage/`)
- Development tools files
- Documentation drafts and internal files
- CI/CD workflows and configuration

## Package Configuration

### package.json Optimizations

#### Core Configuration
```json
{
  "name": "@hyperfy/sdk",
  "main": "dist/index.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.esm.js",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist",
    "src",
    "examples",
    "README.md",
    "LICENSE",
    "CHANGELOG.md"
  ]
}
```

#### Build Scripts
```json
{
  "scripts": {
    "build": "rimraf dist && rollup -c",
    "build:watch": "rollup -c -w",
    "dev": "npm run build:watch",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "type-check": "tsc --noEmit",
    "docs": "typedoc src/index.ts --out docs/api",
    "prepublishOnly": "npm run build && npm test",
    "prepack": "npm run build",
    "postpublish": "npm run clean"
  }
}
```

### Build Configuration

#### TypeScript (tsconfig.json)
- Target: ES2020
- Module: ESNext
- Output: `dist/`
- Strict type checking enabled
- Declaration generation enabled
- Source maps enabled

#### Rollup (rollup.config.js)
- **ES Module build**: `dist/index.esm.js`
- **CommonJS build**: `dist/index.js`
- **Type definitions**: `dist/index.d.ts`
- **CLI tool**: `dist/cli.js` (executable)
- Minification in production
- Source maps for debugging
- External dependencies tree-shaken

## Multi-Format Support

The package supports multiple module formats for maximum compatibility:

1. **ES Modules** (`index.esm.js`) - Modern bundlers and Node.js
2. **CommonJS** (`index.js`) - Legacy Node.js environments
3. **TypeScript Definitions** (`index.d.ts`) - Full type safety

## CLI Tool

The package includes a CLI tool (`hyperfy-sdk`) for common tasks:

```bash
hyperfy-sdk init          # Initialize new project
hyperfy-sdk serve         # Start development server
hyperfy-sdk build         # Build for production
hyperfy-sdk deploy        # Deploy to Hyperfy
```

## Examples

Comprehensive examples demonstrate SDK usage:

- **Basic Usage**: Core SDK functionality
- **Entity Management**: 3D entity operations
- **File Operations**: Upload/download workflows
- **App Development**: Complete app lifecycle
- **Chat System**: Real-time communication

## Documentation Structure

### User-Facing Documentation
- `README.md` - Overview and quick start
- `docs/GETTING_STARTED.md` - Detailed setup guide
- `docs/API_REFERENCE.md` - Complete API documentation
- `docs/TESTING.md` - Testing strategies and tools

### Developer Documentation
- `CONTRIBUTING.md` - Contribution guidelines
- `RELEASE_PROCESS.md` - Release procedures
- Internal API documentation (generated)

## Testing Infrastructure

### Test Types
- **Unit Tests**: Individual component testing
- **Integration Tests**: Manager and client integration
- **E2E Tests**: Full workflow testing

### Test Configuration
- Jest framework with TypeScript support
- Coverage threshold: 70% minimum
- Mock implementations for external dependencies
- CI/CD integration with GitHub Actions

## Release Workflow

### Automated Release Process
1. **CI Pipeline**: Tests, linting, build verification
2. **Build Process**: Creates optimized distribution files
3. **NPM Publish**: Automated publication to registry
4. **GitHub Release**: Release notes and changelog
5. **Documentation**: Updated API documentation

### Version Management
- Semantic versioning (SemVer)
- Automated changelog generation
- Git tag-based releases
- Rollback procedures for critical issues

## Size Optimization

### Bundle Size Management
- Tree-shaking for unused code elimination
- External dependency exclusion
- Minification in production builds
- Source maps for debugging (development only)

### Dependency Strategy
- Minimal production dependencies
- Development-only dependencies excluded
- Peer dependencies for flexibility
- Security scanning and updates

## Security Considerations

### Security Measures
- No hardcoded credentials or URLs
- Input validation and sanitization
- Secure WebSocket connections
- API key protection
- Regular security audits

### Dependency Security
- Automated vulnerability scanning
- Dependency update monitoring
- Security patch management
- Safe dependency versions

## Performance Optimizations

### Build Performance
- Parallel test execution
- Incremental builds
- File watching for development
- Fast CI/CD pipelines

### Runtime Performance
- Efficient WebSocket management
- Connection pooling
- Memory usage optimization
- Error handling and recovery

## Developer Experience

### Development Tools
- TypeScript for type safety
- ESLint and Prettier for code quality
- Comprehensive error messages
- Detailed logging system
- Hot reloading in development

### IDE Integration
- Full IntelliSense support
- Go to definition
- Type checking
- Auto-completion
- Error highlighting

## Package Quality Metrics

### Code Quality
- 70%+ test coverage
- TypeScript strict mode
- ESLint compliance
- Prettier formatting
- Security audit passing

### Documentation Quality
- Comprehensive API documentation
- Usage examples
- Getting started guide
- Troubleshooting section
- Community support channels

## Distribution Strategy

### NPM Registry
- Public access configuration
- Semantic versioning
- Automated publishing
- Metadata optimization
- Search keyword optimization

### Alternative Distribution
- CDN availability
- GitHub releases
- Package mirrors
- Regional distribution

## Maintenance Strategy

### Regular Updates
- Dependency updates
- Security patches
- Feature enhancements
- Bug fixes
- Documentation improvements

### Community Management
- Issue tracking and resolution
- Pull request review
- Community engagement
- Feedback incorporation
- Contributor recognition

This package structure ensures the Hyperfy SDK is production-ready, developer-friendly, and maintainable long-term while providing optimal performance and security.