# Release Process

This document outlines the release process for the Hyperfy SDK.

## Overview

The Hyperfy SDK follows Semantic Versioning (SemVer) for releases:
- **Major (X.0.0)**: Breaking changes
- **Minor (X.Y.0)**: New features, backward compatible
- **Patch (X.Y.Z)**: Bug fixes, backward compatible

## Prerequisites

- All tests passing
- Code coverage threshold met (70%+)
- Documentation updated
- CHANGELOG.md updated
- Version number updated in package.json

## Release Types

### Patch Release (Bug Fixes)

1. Fix the issue in a feature branch
2. Create pull request to main
3. Wait for CI to pass and review approval
4. Merge to main
5. Update version: `npm version patch`
6. Push tag: `git push origin main --tags`

### Minor Release (New Features)

1. Complete feature development in feature branch
2. Update documentation and examples
3. Create pull request to main
4. Wait for CI to pass and review approval
5. Merge to main
6. Update version: `npm version minor`
7. Push tag: `git push origin main --tags`

### Major Release (Breaking Changes)

1. Complete breaking changes in feature branch
2. Update all documentation and migration guides
3. Update version to major: `npm version major`
4. Create pull request to main
5. Wait for CI to pass and review approval
6. Merge to main
7. Push tag: `git push origin main --tags`

## Automated Release Process

When a version tag is pushed to GitHub, the automated release process:

1. **CI Pipeline**: Runs tests, linting, and builds
2. **Build Process**: Creates distribution files
3. **NPM Publish**: Publishes to npm registry
4. **GitHub Release**: Creates release with changelog
5. **Documentation**: Updates API documentation

## Manual Release Steps

### Preparation

1. **Update Version**
   ```bash
   npm version patch|minor|major
   ```

2. **Update CHANGELOG**
   ```markdown
   ## [1.2.3] - 2024-01-15

   ### Added
   - New feature X

   ### Fixed
   - Bug fix Y

   ### Changed
   - Improvement Z

   ### Breaking
   - Breaking change A (only for major releases)
   ```

3. **Update Documentation**
   - Update README.md if needed
   - Update API documentation
   - Add new examples
   - Update migration guide for breaking changes

### Testing

1. **Run Full Test Suite**
   ```bash
   npm test
   npm run lint
   npm run type-check
   ```

2. **Test Build Process**
   ```bash
   npm run build
   npm pack --dry-run
   ```

3. **Local Integration Testing**
   ```bash
   npm link
   # Test with local project
   npm unlink
   ```

### Release

1. **Create Release Commit**
   ```bash
   git add .
   git commit -m "chore: release v1.2.3"
   ```

2. **Create and Push Tag**
   ```bash
   git tag v1.2.3
   git push origin main --tags
   ```

3. **Monitor Release**
   - Check GitHub Actions workflow
   - Verify npm publication
   - Confirm GitHub release creation

### Post-Release

1. **Verify Installation**
   ```bash
   npm install @hyperfy/sdk@latest
   ```

2. **Update Development Environment**
   ```bash
   npm install
   npm run build
   ```

3. **Communicate Release**
   - Update Discord community
   - Send announcement email
   - Update social media

## Emergency Releases

For critical security issues or production bugs:

1. Create hotfix branch from latest release
2. Fix the issue
3. Run full test suite
4. Create patch release
5. Push to main immediately
6. Communicate urgently to users

## Version Bumping Examples

### Patch Release
```bash
npm version patch
# 1.2.3 -> 1.2.4
```

### Minor Release
```bash
npm version minor
# 1.2.3 -> 1.3.0
```

### Major Release
```bash
npm version major
# 1.2.3 -> 2.0.0
```

### Pre-release
```bash
npm version prerelease
# 1.2.3 -> 1.2.4-0
```

### Pre-release with beta
```bash
npm version preminor --preid=beta
# 1.2.3 -> 1.3.0-beta.0
```

## Release Checklist

### Before Release
- [ ] All tests passing
- [ ] Code coverage ≥ 70%
- [ ] No security vulnerabilities
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Examples tested
- [ ] Version number updated
- [ ] Breaking changes documented (if applicable)

### Release Process
- [ ] Create release commit
- [ ] Create version tag
- [ ] Push to main branch
- [ ] Push tags to origin
- [ ] Monitor CI/CD pipeline
- [ ] Verify npm publication
- [ ] Verify GitHub release

### After Release
- [ ] Test fresh installation
- [ ] Update local development environment
- [ ] Announce to community
- [ ] Update website/documentation
- [ ] Monitor for issues
- [ ] Plan next release

## Rollback Process

If a release causes critical issues:

1. **Unpublish from npm** (if within 72 hours)
   ```bash
   npm unpublish @hyperfy/sdk@1.2.3
   ```

2. **Deprecate Version** (if after 72 hours)
   ```bash
   npm deprecate @hyperfy/sdk@1.2.3 "Critical security issue, please upgrade to 1.2.4"
   ```

3. **Fix and Re-release**
   - Create hotfix release
   - Follow normal release process
   - Communicate urgently

## Release Communication

### Channels
- **GitHub Release**: Automated with changelog
- **Discord**: Community announcements
- **Email**: Developer newsletter
- **Twitter/X**: Public announcements
- **Documentation**: Version-specific guides

### Template
```
🚀 Hyperfy SDK v1.2.3 Released

✨ New Features:
- Feature A description
- Feature B description

🐛 Bug Fixes:
- Fixed issue with X
- Resolved problem with Y

📚 Documentation:
- Updated API reference
- Added new examples

🔗 Links:
- npm: https://www.npmjs.com/package/@hyperfy/sdk
- GitHub: https://github.com/hyperfy/hyperfy-sdk/releases/tag/v1.2.3
- Docs: https://docs.hyperfy.com
```

## Metrics and Monitoring

Track release success metrics:
- Download numbers from npm
- GitHub stars and forks
- Issue reports and resolutions
- Community feedback
- Performance benchmarks

## Automation Tools

### GitHub Actions
- Automated testing on PR
- Build and publish on tag
- Security scanning
- Dependency updates

### npm Scripts
```bash
npm run release:patch    # npm version patch && npm publish
npm run release:minor    # npm version minor && npm publish
npm run release:major    # npm version major && npm publish
```

### Release Tools
- `semantic-release` for automated releases
- `changesets` for changelog management
- `np` for simplified publishing
- `standard-version` for version management