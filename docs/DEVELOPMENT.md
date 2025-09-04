# Development Guide

This guide covers the development workflow for the diamonds-monitor development environment.

## 🏁 Getting Started

### 1. Clone and Setup

```bash
git clone <repository-url>
cd diamonds-monitor-devenv
yarn install
```

### 2. Environment Setup

Copy the example environment file and configure:

```bash
cp .env.example .env
# Edit .env with your configuration
```

## 🔧 Development Workflow

### Package Development

The main development happens in the `packages/diamonds-monitor` directory:

```bash
# Navigate to package directory
cd packages/diamonds-monitor

# Start development mode
yarn build:watch

# Or from root directory
yarn monitor:dev
```

### Contract Development

```bash
# Compile contracts
yarn compile

# Run contract tests
yarn test

# Deploy to local network
npx hardhat node  # In one terminal
npx hardhat run scripts/deploy/rpc/deploy.ts --network localhost  # In another
```

### Testing Strategy

1. **Unit Tests**: Test individual functions and classes
2. **Integration Tests**: Test interactions between components
3. **Contract Tests**: Test smart contract functionality

```bash
# Run all tests
yarn workspace:test

# Run with coverage
yarn monitor:test:coverage

# Watch mode for development
yarn monitor:test:watch
```

## 📦 Package Structure

```bash
packages/diamonds-monitor/
├── src/
│   ├── index.ts              # Main export file
│   ├── monitor.ts            # DiamondMonitor class
│   ├── facet-manager.ts      # FacetManager class
│   ├── types.ts              # TypeScript types
│   ├── utils.ts              # Utility functions
│   └── __tests__/            # Test files
├── dist/                     # Compiled output
├── coverage/                 # Test coverage reports
├── package.json              # Package configuration
├── tsconfig.json             # TypeScript config
├── jest.config.js            # Jest configuration
├── .eslintrc.js              # ESLint configuration
└── README.md                 # Package documentation
```

## 🧪 Testing Guidelines

### Writing Tests

1. **Naming**: Use descriptive test names that explain what is being tested
2. **Structure**: Follow Arrange-Act-Assert pattern
3. **Coverage**: Aim for 80%+ code coverage
4. **Isolation**: Each test should be independent

Example test structure:

```typescript
describe("ClassName", () => {
  describe("methodName", () => {
    it("should return expected result when given valid input", () => {
      // Arrange
      const input = "test-input";
      const expected = "expected-output";

      // Act
      const result = classInstance.methodName(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Test Categories

- **Unit Tests**: Test individual functions/methods
- **Integration Tests**: Test component interactions
- **Contract Tests**: Test smart contract functionality
- **E2E Tests**: Test complete workflows

## 🏗️ Build Process

### TypeScript Compilation

```bash
# Build package
yarn monitor:build

# Build with watch mode
yarn monitor:build:watch

# Build all packages
yarn workspace:build
```

### Output Structure

The build process generates:

- `dist/` - Compiled JavaScript
- `*.d.ts` - TypeScript declarations
- `*.js.map` - Source maps
- `coverage/` - Test coverage reports

## 📋 Code Quality

### Linting and Formatting

```bash
# Lint code
yarn lint

# Fix linting issues
yarn lint --fix

# Format code
yarn format

# Check formatting
yarn format --check
```

### Pre-commit Hooks

Husky runs these checks before each commit:

- ESLint for code quality
- Prettier for formatting
- Tests for functionality

### Code Style Guidelines

1. **TypeScript**: Use strict mode with proper typing
2. **Naming**: Use camelCase for variables, PascalCase for classes
3. **Comments**: Use JSDoc for public APIs
4. **Imports**: Organize imports (external, internal, relative)
5. **Error Handling**: Always handle errors appropriately

## 🚀 Release Process

### Version Management

1. **Semantic Versioning**: Follow semver (MAJOR.MINOR.PATCH)
2. **Changelog**: Update CHANGELOG.md with new features/fixes
3. **Version Bump**: Update version in package.json
4. **Git Tags**: Create git tags for releases

### Manual Release

```bash
cd packages/diamonds-monitor

# Update version
npm version patch|minor|major

# Build package
yarn build

# Publish to NPM
npm publish
```

### Automated Release

The CI/CD pipeline automatically publishes when:

1. Code is pushed to main branch
2. Version in package.json has changed
3. All tests pass

## 🔍 Debugging

### Development Tools

1. **VS Code**: Use recommended extensions
2. **TypeScript**: Enable strict mode for better error catching
3. **Jest**: Use `--watch` flag for test-driven development
4. **Console**: Use structured logging with Winston

### Common Issues

1. **Module Resolution**: Check tsconfig.json paths
2. **Build Errors**: Clear dist/ and node_modules/, then rebuild
3. **Test Failures**: Check for async/await issues
4. **Linting Errors**: Run `yarn lint --fix`

## 📈 Performance

### Optimization Tips

1. **Bundle Size**: Monitor package size with `npm pack`
2. **Dependencies**: Keep dependencies minimal
3. **Tree Shaking**: Use ES modules for better tree shaking
4. **Async Operations**: Use proper error handling for promises

### Monitoring

1. **Build Time**: Monitor TypeScript compilation time
2. **Test Time**: Keep test suite fast (<30s)
3. **Package Size**: Monitor dist/ size
4. **Dependencies**: Regular dependency audits

## 🤝 Contributing

### Pull Request Process

1. **Branch**: Create feature branch from main
2. **Develop**: Make changes following code style
3. **Test**: Ensure all tests pass
4. **Commit**: Use conventional commit messages
5. **Review**: Submit PR for code review

### Commit Message Format

```bash
type(scope): description

body

footer
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:

```bash
feat(monitor): add health check functionality

Implement comprehensive health checking for diamond contracts
including facet validation and selector conflict detection.

Closes #123
```

## 📚 Resources

### Documentation

- [ERC-2535 Diamond Standard](https://eips.ethereum.org/EIPS/eip-2535)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)
- [Yarn Workspaces](https://yarnpkg.com/features/workspaces)

### Tools

- [Hardhat](https://hardhat.org/docs)
- [Ethers.js](https://docs.ethers.org/v6/)
- [ESLint](https://eslint.org/docs/user-guide/)
- [Prettier](https://prettier.io/docs/en/)

## 🆘 Troubleshooting

### Common Solutions

```bash
# Clear all caches and reinstall
rm -rf node_modules yarn.lock dist coverage
yarn install

# Reset TypeScript
yarn monitor:clean
yarn monitor:build

# Fix permission issues
chmod +x .husky/pre-commit

# Update dependencies
yarn upgrade-interactive
```

### Getting Help

1. Check existing issues in GitHub
2. Review documentation and guides
3. Ask questions in GitHub Discussions
4. Contact the development team
