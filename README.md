# Indent Spectra

**Indent Spectra** is an indentation highlighter for Visual Studio Code. It colorizes indentation levels to make code structure instantly readable.

## Features

- 🚀 **High Performance**: Built with an optimized rendering engine using O(1) lookups, `Set` checks, and efficient memory management.
- 🌈 **Rainbow Indentation**: Alternating colors for each indentation level.
- 🚫 **Error Highlighting**: Highlights lines where indentation does not match the configured tab size.
- ⚠️ **Mixed Indent Detection**: Detects and highlights lines that mix tabs and spaces.
- ⚡ **Live Configuration**: Updates immediately when settings change—no window reload required.
- 🧱 **Smart Ignoring**: Automatically ignores comment blocks (configurable via Regex).

## Configuration

Customize Indent Spectra in your `settings.json`:

```json
// Colors to cycle through (Hex, RGBA, etc.)
"indentSpectra.colors": [
    "rgba(255,255,64,0.07)",
    "rgba(127,255,127,0.07)",
    "rgba(255,127,255,0.07)",
    "rgba(79,236,236,0.07)"
],

// Color for indentation errors (not divisible by tab size)
"indentSpectra.errorColor": "rgba(128,32,32,0.4)",

// Color for lines mixing tabs and spaces
"indentSpectra.mixColor": "rgba(128,32,96,0.6)",

// Debounce delay in milliseconds (higher = less CPU usage during fast typing)
"indentSpectra.updateDelay": 100,

// Disable for specific languages
"indentSpectra.ignoredLanguages": [
    "plaintext",
    "markdown"
]
```

## Requirements

VS Code 1.106.0 or higher.

## Acknowledgments

Inspired by the popular *indent-rainbow* extension, rewritten from scratch for modern VS Code versions with a focus on performance and strict type safety.

## 📄 License

MIT
