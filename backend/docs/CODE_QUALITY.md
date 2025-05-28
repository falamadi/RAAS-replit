# Code Quality Setup

This document outlines the code quality tools and practices implemented in the RaaS backend.

## Tools Configured

### ESLint
- **Purpose**: Static analysis to identify problematic patterns in JavaScript/TypeScript
- **Configuration**: `.eslintrc.json`
- **Integration**: Prettier integration to avoid conflicts

### Prettier
- **Purpose**: Opinionated code formatter for consistent style
- **Configuration**: `.prettierrc` and `.prettierignore`
- **Settings**: Single quotes, semicolons, 2-space tabs

### Husky
- **Purpose**: Git hooks to enforce quality checks before commits
- **Setup**: Pre-commit hooks run linting and formatting

### Lint-Staged
- **Purpose**: Run linters on staged files only for faster commits
- **Configuration**: In `package.json`

## Available Scripts

### Linting
```bash
npm run lint          # Check for linting errors
npm run lint:fix      # Fix auto-fixable linting errors
```

### Formatting
```bash
npm run format        # Format all source files
npm run format:check  # Check if files are formatted correctly
```

### Type Checking
```bash
npm run typecheck     # Run TypeScript compiler without emitting files
```

## Pre-commit Hooks

The following checks run automatically before each commit:

1. **ESLint**: Checks for code quality issues and fixes auto-fixable ones
2. **Prettier**: Formats code according to style rules
3. **Type Check**: Ensures TypeScript compilation succeeds

## ESLint Rules

### Core Rules
- `@typescript-eslint/explicit-function-return-type`: Warn on missing return types
- `@typescript-eslint/no-explicit-any`: Error on explicit any usage
- `@typescript-eslint/no-unused-vars`: Error on unused variables
- `no-console`: Warn on console usage (allow warn/error)
- `prettier/prettier`: Error on formatting violations

### Code Quality Rules
- `prefer-const`: Enforce const for immutable variables
- `no-var`: Disallow var declarations

## Prettier Configuration

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

## Ignored Files

### ESLint Ignores
- `node_modules/`
- `dist/`
- `build/`
- `coverage/`

### Prettier Ignores
- `node_modules`
- `dist`
- `build`
- `coverage`
- `*.log`
- `.env*`
- `.DS_Store`
- `docs/*.md`
- `*.md`
- `package-lock.json`
- `yarn.lock`

## Integration with IDE

### VS Code
Install extensions:
- ESLint
- Prettier - Code formatter

Add to `settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## Continuous Integration

The code quality checks should also run in CI/CD pipeline:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
```

## Best Practices

### Writing Quality Code
1. Use meaningful variable and function names
2. Add return type annotations to functions
3. Avoid `any` type - use specific types
4. Handle errors explicitly
5. Write unit tests for new functionality

### Commit Guidelines
1. Make small, focused commits
2. Write clear commit messages
3. Ensure all quality checks pass before pushing
4. Review your own changes before submitting PRs

### Code Review
1. Check for proper typing
2. Verify error handling
3. Look for code duplication
4. Ensure proper test coverage
5. Validate security considerations

## Troubleshooting

### Common Issues

#### ESLint Errors
- Run `npm run lint:fix` to auto-fix issues
- Check `.eslintrc.json` for rule configuration
- Use `// eslint-disable-next-line` for justified exceptions

#### Prettier Conflicts
- ESLint and Prettier are configured to work together
- Run `npm run format` to fix formatting
- Check `.prettierrc` for style preferences

#### Pre-commit Hook Failures
- Fix linting errors: `npm run lint:fix`
- Format code: `npm run format`
- Check types: `npm run typecheck`
- Commit again after fixes

#### Type Errors
- Add proper type annotations
- Check import statements
- Verify TypeScript configuration in `tsconfig.json`

## Maintenance

### Updating Dependencies
```bash
npm update eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
npm update prettier eslint-config-prettier eslint-plugin-prettier
npm update husky lint-staged
```

### Adding New Rules
1. Update `.eslintrc.json` with new rules
2. Test rules on existing codebase
3. Update documentation
4. Communicate changes to team