# Indent Spectra

*Indent Spectra* is an indentation highlighter for Visual Studio Code. It colorizes indentation levels to make code structure instantly readable.

## Features

- 🚀 **High Performance**: Built with a modernized O(1) rendering engine designed for speed.
- 🎨 **Color Presets**: Includes palettes for **Universal Contrast**, **Color Blindness** (Protanopia/Deuteranopia/Tritanopia), and aesthetic themes.
- 🚫 **Error Highlighting**: Highlights lines where indentation does not match the configured tab size.
- ⚠️ **Mixed Indent Detection**: Detects and highlights lines that mix tabs and spaces.
- 💡 **Light Mode**: Optional subtle line indicators instead of full background blocks.
- ⚡ **Live Configuration**: Updates immediately when settings change—no window reload required.

## Color Presets

Choose from color palettes designed from first principles using color theory frameworks Okabe-Ito, Temperature Alternation, and Analogous Harmony.

| Preset                  | Description                                                            |
| :---------------------- | :--------------------------------------------------------------------- |
| **Universal** (Default) | High-contrast (Gold, Royal Blue, Pink, Cyan), optimized for all users. |
| **Protan/Deuteran**     | Safe for Red/Green color blindness. Uses Blue/Yellow/Gray scales.      |
| **Tritan**              | Safe for Blue color blindness. Uses Red/Teal/Gray scales.              |
| **Cool**                | Calming blues and turquoises.                                          |
| **Warm**                | Energetic golds, corals, and salmons.                                  |
| **Custom**              | Use your own color array.                                              |

## Configuration

Customize *Indent Spectra* in your `settings.json` or via the Settings UI:

```json
// Choose a preset palette
"indentSpectra.colorPreset": "universal",

// OR use custom colors (requires preset set to 'custom')
"indentSpectra.colors": [
    "rgba(255, 215, 0, 0.15)",
    "rgba(65, 105, 225, 0.15)",
    "rgba(255, 105, 180, 0.15)",
    "rgba(0, 255, 255, 0.15)"
],

// Render style: 'classic' (block) or 'light' (thin line)
"indentSpectra.indicatorStyle": "classic",

// Color for indentation errors
"indentSpectra.errorColor": "rgba(200, 50, 50, 0.5)",

// Color for mixed tabs/spaces
"indentSpectra.mixColor": "rgba(150, 50, 150, 0.6)",

// Delay in ms before updating (debouncing)
"indentSpectra.updateDelay": 100
```

## Requirements

VS Code 1.106.0+. Probably works on previous versions, but not tested.

## Acknowledgements

Inspired by [indent-rainbow](https://marketplace.visualstudio.com/items?itemName=oderwat.indent-rainbow).

## Comparison with Indent Rainbow

### 1. 🚀 Performance & Efficiency (The Engine)
The most significant change is under the hood. The rendering engine was rewritten from scratch to handle large files without slowing down the editor.

*   **O(1) vs O(N) Lookups:** The original extension used `Array.indexOf` inside the main rendering loop to check for ignored lines, leading to quadratic complexity. **Indent Spectra** uses `Set` lookups (O(1)), making it instantaneously fast regardless of file size.
*   **Memory Management:** Reduced Garbage Collection pressure by reusing RegExp objects and avoiding unnecessary string splitting/array allocations during the render loop.
*   **Smart Debouncing:** Implemented input debouncing to prevent the extension from trying to render every single keystroke during rapid typing.

### 2. 👁️ Accessibility & Color Theory (The Visuals)
The original extension used a standard spectrum where adjacent colors (like Green and Cyan) often blended together at low opacity.

*   **Interleaved Contrast:** Instead of a gradient, Spectra alternates **Warm** (Gold, Pink) and **Cool** (Blue, Cyan) colors. This maximizes the "visual distance" between indentation levels 2 and 3, making the structure clearer.
*   **Accessibility Presets:** Includes built-in palettes specifically designed for **Color Vision Deficiencies** (Protanopia, Deuteranopia, and Tritanopia) based on the Okabe-Ito standard.
*   **Opacity Calibration:** Default opacity was calibrated to `0.08` (8%) to provide subtle guidance without dominating the code syntax highlighting.

### 3. ⚡ User Experience (The Flow)
*   **Live Configuration:** Changing settings (colors, tab size, styles) updates the editor **instantly**. The original extension required a full "Reload Window" to apply settings.
*   **Web Native:** Fully configured to run in **VS Code for the Web** (github.dev, vscode.dev) with `virtualWorkspaces` support enabled in the manifest.

### 4. 🛡️ Code Quality & Maintenance
*   **Strict Typing:** Written in modern **TypeScript 5.9+** with `strict: true`. The original codebase relied heavily on loose `var` declarations and implicit `any` types.
*   **Modern Architecture:** Logic is encapsulated in a clean class structure (`IndentSpectra.ts`) with proper lifecycle management (`dispose` patterns), making it easier to maintain and less prone to memory leaks.
*   **Secure Build:** Includes `package-lock.json` for reproducible builds and strict dependency management.

### Summary Table

| Feature          | Indent Rainbow (Original)       | Indent Spectra (New)               |
| :--------------- | :------------------------------ | :--------------------------------- |
| **Complexity**   | O(N²) (Slower on large files)   | **O(N) (Linear / Fast)**           |
| **Lookups**      | Array Iteration                 | **Set / Hash Map**                 |
| **Colors**       | Standard Rainbow (Low Contrast) | **Interleaved / Color Blind Safe** |
| **Config**       | Requires Reload                 | **Live Update**                    |
| **Architecture** | Legacy JS/TS                    | **Modern Strict TS**               |
| **Typing**       | Loose (`any`)                   | **Strict**                         |

## License

MIT
