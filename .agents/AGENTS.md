# VS Code Indent Spectra Guidelines

'Indent Spectra' colors line indentation for readability. Prioritizes performance and minimal resource usage.

## Tech Stack

- **TypeScript 5.9** (strict mode)
- **VS Code Extension API** (^1.109.0)
- **Node.js** (ES2024 target)
- **esbuild** for bundling
- **Bun** for package management
- **Mocha** + **ESLint** for testing/linting

## Entry Points

- `src/extension.ts` - Main entry, exports `activate()` / `deactivate()`
- `src/IndentSpectra.ts` - Core rendering engine (decorators, caching, incremental updates)
- `src/ConfigurationManager.ts` - Settings management and color palette resolution

## Key Architecture

- **O(1) Lookups**: Uses `Set` for ignored lines
- **Caching**: Per-document line analysis, ignore patterns, applied state
- **Smart Debouncing**: Configurable delay (default 100ms)
- **Chunked Processing**: 1000-line chunks with yielding
- **Visible Range Optimization**: Only processes visible + 50 line buffer

## Event Handling

- `onDidChangeActiveTextEditor`, `onDidChangeTextEditorOptions`, `onDidChangeTextEditorVisibleRanges`
- `onDidChangeTextDocument`, `onDidOpenTextDocument`, `onDidCloseTextDocument`
- `onDidChangeConfiguration`

## Commands

- `bun install` - Install dependencies
- `bun run test` - Run tests
- `bun run lint` - Run ESLint
- `bun run compile` - TypeScript compilation
- `bun run build` - Production build

## Coding Principles

- KISS, DRY, YAGNI
- Optimize for performance
- Self-documenting code via clear naming
- Use comments only where *necessary* for workarounds, to do, etc.
- No magic numbers - use constants (e.g., `CHUNK_SIZE_LINES`)
- No docs files unless explicitly requested

## File Access

- Allowed: All source files in root
- Excluded: `.assets/`, `.docs/`, `.git/`, `node_modules/`, `bun.lock`
