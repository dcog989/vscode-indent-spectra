# Indent Spectra Project Guidelines

Indent Spectra is an extension for VS Code that colorises line indentation to aid user readability. It focuses on performance, minimal resource usage.

## Tech Stack

- **Tauri** (v2.9) - Desktop framework wrapping the web frontend
- **Rust** (2024 / v1.92) - Backend logic, Markdown processing, file I/O
- **Svelte** (v5.47) - Frontend framework with Svelte 5 runes (`.svelte.ts` files)
- **TypeScript** (v5.9) - Type-safe frontend code
- **Tailwind** (v4.1) - Utility-first CSS
- **CodeMirror** (v6.0) - Code editor component
- **SQLite** (v3.51) - Local database for metadata/bookmarks

## Entry Points

### Frontend (SvelteKit)

- **`src/routes/+page.svelte`** - Main application page
- **`src/routes/+layout.svelte`** - Root layout wrapper
- **`src/lib/stores/state.svelte.ts`** - Centralized state tree (`appContext`)
- **`src/lib/components/editor/Editor.svelte`** - Main editor component
- **`src/lib/components/preview/Preview.svelte`** - Markdown preview component

### Backend (Tauri/Rust)

- **`src-tauri/src/main.rs`** - Rust application entry point
- **`src-tauri/src/commands/`** - Tauri command handlers (callable from frontend)
- **`src-tauri/src/markdown/`** - Markdown processing logic
- **`src-tauri/src/db/`** - SQLite database operations

### Key Architecture

- **State Management**: Svelte 5 runes in `$lib/stores/*.svelte.ts` files, accessed via `appContext`
- **Editor**: CodeMirror 6 configured in `$lib/components/editor/codemirror/`
- **Backend Communication**: Tauri commands in `src-tauri/src/commands/` invoked via `invoke()` from frontend
- **File System**: Handled by Tauri plugins and Rust backend (`$lib/utils/backend.ts` for frontend interface)

## Coding Principles

- Use current coding standards and patterns (Svelte 5 runes, modern TS/Rust)
- KISS, Occam's razor, DRY, YAGNI
- Optimize for actual and perceived performance
- Self-documenting code via clear naming
- Comments only for workarounds/complex logic
- No magic numbers
- **Do NOT create docs files** (summary, reference, testing, etc.) unless explicitly requested

## File System Access

### Allowed Directories

- `.claude/`, `.github/`, `.husky/`, `.svelte-kit/`, `.vscode/`
- `scripts/`, `src/`, `src-tauri/`, `static/`
- Root config files: `.editorconfig`, `.gitignore`, `*.config.*`, `package.json`, `tsconfig.json`, etc.

### Disallowed

- `.ai/`, `.assets/`, `.docs/`, `.git/`, `node_modules/`
- `repomix.config.json`, `bun.lock`, `AGENTS.md`, `.repomixignore`
- `src-tauri/Cargo.lock`, `src-tauri/target/`, `src-tauri/icons/`

## Common Patterns

- **Adding a feature**: Update relevant store in `$lib/stores/`, add UI in `$lib/components/`, connect via event handlers
- **Backend call**: Create Rust command in `src-tauri/src/commands/`, expose in `main.rs`, call via `invoke()` in frontend
- **Editor extension**: Add to `$lib/utils/*Extension.ts`, configure in `$lib/components/editor/codemirror/config.ts`
- **State access**: Import `appContext` from `$lib/stores/state.svelte.ts`, access as `appContext.editor.content`, etc.
