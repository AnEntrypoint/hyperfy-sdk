# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of Hyperfy SDK for Node.js
- Entity management with full hierarchy support
- Real-time WebSocket communication
- App management and operations
- Builder session management with undo/redo
- Chat system with rooms and moderation
- File upload/download with metadata support
- Comprehensive error handling
- TypeScript definitions
- Event-driven architecture
- Logging system
- Utility functions for vector operations and common tasks

### Features

#### Core SDK
- HyperfySDK main class with connection management
- Authentication support with API keys
- Configuration management
- State management and statistics
- Event forwarding between managers

#### Network Layer
- HTTP client with retry logic and timeout handling
- WebSocket manager with auto-reconnection
- Message queuing for offline scenarios
- Heartbeat/ping-pong support

#### Entity System
- Create, update, delete entities
- Parent-child relationships
- Position, rotation, scale operations
- Property management
- Entity queries and search
- History tracking
- Validation system

#### App Management
- Create, read, update, delete apps
- App settings management
- Search and filtering
- Public/private app handling
- App statistics

#### Builder Tools
- Build session management
- Entity creation and manipulation
- Snapshot system
- Undo/redo functionality
- Build publishing

#### Chat System
- Message sending and receiving
- Chat rooms
- User management
- Moderation features
- Message history
- File sharing in chat

#### File Management
- Multi-format file uploads (images, models, documents)
- Stream, buffer, and file path uploads
- Metadata management
- Public/private file handling
- Download functionality
- Usage statistics

#### Utilities
- Vector3 math operations
- Entity validation
- Debounce/throttle functions
- File size formatting
- ID generation
- Deep cloning
- URL validation

### Technical Details
- Written in TypeScript with full type definitions
- Built for Node.js 16+
- Event-driven architecture with EventEmitter3
- WebSocket support with ws library
- HTTP client with node-fetch
- File upload support with formidable
- Message serialization with msgpackr
- Comprehensive test suite with Jest
- ESLint and Prettier configuration
- Rollup build system for CJS and ESM modules
- TypeDoc documentation generation

### Dependencies
- ws: WebSocket client
- msgpackr: Message serialization
- node-fetch: HTTP requests
- formidable: File uploads
- eventemitter3: Event handling
- TypeScript: Type safety

### Development Tools
- Jest: Testing framework
- ESLint: Linting
- Prettier: Code formatting
- Rollup: Building
- TypeDoc: Documentation
- rimraf: Cleanup

## [1.0.0] - 2024-10-07

### Added
- Initial release
- All core features implemented
- Complete documentation
- Examples and test coverage