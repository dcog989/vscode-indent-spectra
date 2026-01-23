# VS Code Indent Spectra Guidelines

Indent Spectra is an extension for VS Code that colorises line indentation to aid user readability. It prioritises performance, minimal resource usage.

## Tech Stack

- **TypeScript 5.9** with strict mode enabled
- **VS Code Extension API** (^1.106.1)
- **Node.js** runtime (ES2024 target)
- **esbuild** for bundling (production builds)
- **Bun** for package management and scripts
- **Mocha** for testing
- **ESLint** for linting

## Entry Points

### Extension Entry Point

- **Main**: `src/extension.ts` - Exports `activate()` and `deactivate()` functions
    - Creates `IndentSpectra` instance
    - Sets up VS Code event listeners (document changes, editor changes, configuration changes)
    - Manages extension lifecycle

### Core Components

- **IndentSpectra** (`src/IndentSpectra.ts`) - Main rendering engine
    - Manages decorators and caching
    - Analyzes indentation patterns
    - Applies decorations to visible text
    - Handles incremental updates

- **ConfigurationManager** (`src/ConfigurationManager.ts`) - Configuration management
    - Loads and validates settings from VS Code configuration
    - Compiles regex patterns for ignored lines
    - Provides color palette resolution
    - Emits configuration change events

- **colors.ts** (`src/colors.ts`) - Color palettes and definitions
    - Defines preset color palettes (universal, protan-deuteran, tritan, cool, warm)
    - CSS named colors validation

### Build Output

- **Bundled**: `dist/extension.js` (for both Node and browser)
- **Compiled**: `out/` directory (TypeScript compilation for testing)

## Key Architecture

### Performance Optimizations

1. **O(1) Lookups**: Uses `Set` for ignored lines instead of array searches
2. **Incremental Caching**: Caches line analysis results per document URI
3. **Smart Debouncing**: Configurable delay (default 100ms) before updating decorations
4. **Chunked Processing**: Processes large files in 1000-line chunks with yielding
5. **Visible Range Optimization**: Only processes visible lines + buffer (50 lines)
6. **Cancellation Tokens**: Cancels in-progress work when new updates arrive

### Caching Strategy

- **lineCache**: Stores analyzed line data per document (blocks, visual width, flags)
- **ignoredLinesCache**: Caches lines matching ignore patterns
- **lastAppliedState**: Tracks last applied state to avoid redundant updates
- **lastTabSize**: Tracks tab size changes to invalidate cache

### Event Handling

Extension responds to:

- `onDidChangeActiveTextEditor` - Clear state, trigger update
- `onDidChangeTextEditorOptions` - Trigger update
- `onDidChangeTextEditorVisibleRanges` - Trigger update
- `onDidChangeTextDocument` - Incremental cache update
- `onDidOpenTextDocument` - Trigger update
- `onDidCloseTextDocument` - Clear cache
- `onDidChangeConfiguration` - Reload config

### Decorator System

- **Spectra decorators**: Array of decorators for indent levels (cycles through colors)
- **Error decorator**: Highlights malformed indentation
- **Mix decorator**: Highlights mixed tabs/spaces
- **Styles**: Classic (background) or Light (border line)

## Coding Principles

- Use current coding standards and patterns
- KISS, Occam's razor, DRY, YAGNI
- Optimize for actual and perceived performance
- Self-documenting code via clear naming
- Comments only for workarounds/complex logic
- No magic numbers - use constants like `CHUNK_SIZE_LINES`, `VISIBLE_LINE_BUFFER`
- **Do NOT create docs files** (summary, reference, testing, etc.) unless explicitly instructed

## File System Access

### Allowed

- `.claude/`, `.github/`, `.vscode/`
- `scripts/`, `src/`
- Root files: `README.md`, `.editorconfig`, `.gitignore`, `eslint.config.mjs`, `package.json`, `tsconfig.json`, etc.

### Disallowed

- `.ai/`, `.assets/`, `.docs/`, `.git/`, `node_modules/`
- `repomix.config.json`, `bun.lock`, `AGENTS.md`, `.repomixignore`

## Common Patterns

### Async Work with Cancellation

```typescript
this.cancellationSource = new vscode.CancellationTokenSource();
await this.someAsyncWork(this.cancellationSource.token);
// Check token.isCancellationRequested periodically
```

### Debounced Updates

```typescript
if (this.timeout) clearTimeout(this.timeout);
this.timeout = setTimeout(() => this.update(), delay);
```

### Cache Invalidation

```typescript
// Clear all caches for a document
this.lineCache.delete(uriString);
this.ignoredLinesCache.delete(uriString);
this.lastAppliedState.delete(uriString);
```

### Line Analysis Result Structure

```typescript
interface LineAnalysis {
    blocks: number[];        // Character positions of indent boundaries
    visualWidth: number;     // Visual width considering tab expansion
    isMixed: boolean;        // Mixed tabs and spaces
    isError: boolean;        // Incorrect indentation
    isIgnored: boolean;      // Matches ignore pattern
}
```

### Configuration Management

- Always use `this.configManager.current` to access config
- Listen to `configManager.onDidChangeConfig` for updates
- Config changes trigger decorator recreation and cache clearing
