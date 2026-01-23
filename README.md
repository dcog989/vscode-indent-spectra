# Indent Spectra

![Indent Spectra logo](https://raw.githubusercontent.com/dcog989/vscode-indent-spectra/main/assets/icon-64.png)

_Indent Spectra_ colorizes line indentation levels in Visual Studio Code, making code structure instantly readable.

It has feature parity with _Indent Rainbow_, it's just [faster, slimmer, modern](#comparison-with-indent-rainbow).

[Install _Indent Spectra_ from Marketplace](https://marketplace.visualstudio.com/items?itemName=dcog989.indent-spectra).

![Indent Spectra screenshot](https://raw.githubusercontent.com/dcog989/vscode-indent-spectra/main/assets/screen-1.png)

## Features

- **High Performance**: Built with a modernized O(1) rendering engine designed for speed.
- **Color Presets**: Includes palettes for 'Universal Contrast', Color Blindness (Protanopia/Deuteranopia/Tritanopia), and aesthetic themes.
- **Error Highlighting**: Highlights lines where indentation does not match the configured tab size.
- **Mixed Indent Detection**: Detects and highlights lines that mix tabs and spaces.
- **Light Mode**: Optional subtle line indicators instead of full background blocks.
- **Live Configuration**: Updates immediately when settings change—no window reload required.

## Color Presets

Choose from color palettes designed from first principles using color theory frameworks [Okabe-Ito](https://easystats.github.io/see/reference/scale_color_okabeito.html), [Temperature Alternation](https://en.wikipedia.org/wiki/Color_theory#Warm_vis-_cool_colors), and [Analogous Harmony](https://www.colorpsychology.org/analogous-colors/).

| Preset                  | Description                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| **Universal** (Default) | Excellent contrast (Gold, Royal Blue, Pink, Cyan), optimized for all. |
| **Protan/Deuteran**     | Safe for Red/Green color blindness. Uses Blue/Yellow/Gray scales.     |
| **Tritan**              | Safe for Blue color blindness. Uses Red/Teal/Gray scales.             |
| **Cool**                | Calming blues and turquoises.                                         |
| **Warm**                | Energetic golds, corals, and salmons.                                 |
| **Custom**              | Use your own color array.                                             |

## Configuration

Customize _Indent Spectra_ in your `settings.json` or via the Settings UI:

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

// Highlight intensity of the active / current block (0 - 9)
"indentSpectra.activeIndentBrightness": 3
```

## Requirements

VS Code 1.107+.

## Acknowledgements

Inspired by [indent-rainbow](https://marketplace.visualstudio.com/items?itemName=oderwat.indent-rainbow).

## Comparison with Indent Rainbow

For starters, it's lightweight: _Indent Spectra_ install file = 12 KB, _Indent Rainbow_ = 179 KB.

### 1. Performance, Efficiency

The rendering engine was rewritten from scratch to handle large files without slowing down the editor.

- **O(1) vs O(N) Lookups:** The original extension uses `Array.indexOf` inside the main rendering loop to check for ignored lines, leading to quadratic complexity. _Indent Spectra_ uses `Set` lookups (O(1)), making it instantaneously fast regardless of file size.
- **Memory Management:** Reduced Garbage Collection pressure by reusing RegExp objects and avoiding unnecessary string splitting/array allocations during the render loop.
- **Smart Debouncing:** Implemented input debouncing to prevent the extension from trying to render every single keystroke during rapid typing.

### 2. Accessibility, Color Theory

_Rainbow_ uses a standard spectrum where adjacent colors (like Green and Cyan) blend together for many people. _Spectra_ uses:

- **Interleaved Contrast:** Instead of a gradient, _Spectra_ alternates **Warm** (Gold, Pink) and **Cool** (Blue, Cyan) colors. This maximizes the "visual distance" between indentation levels.
- **Accessibility Presets:** Includes built-in palettes designed for **Color Vision Deficiencies** ([Protanopia, Deuteranopia, and Tritanopia](https://www.colourblindawareness.org/colour-blindness/types-of-colour-blindness/)) based on the [Okabe-Ito standard](https://easystats.github.io/see/reference/scale_color_okabeito.html).

### 3. UX

- **Live Configuration:** Changing settings (colors, tab size, styles) updates the editor instantly. _Rainbow_ requires a full window reload to apply settings.
- **Web Native:** Configured to run in **VS Code for the Web** (github.dev, vscode.dev) with `virtualWorkspaces` support enabled in the manifest.

### 4. Code Quality & Maintenance

- **Strict Typing:** TypeScript 5.9 / `strict: true`. _Rainbow_ relies on loose `var` declarations and implicit `any` types.
- **Modern Architecture:** Clean class structure (`IndentSpectra.ts`) with proper lifecycle management (`dispose` patterns), so easier to maintain and less prone to memory leaks.

### Summary Table

| Feature          | Indent Rainbow                  | Indent Spectra                     |
| :--------------- | :------------------------------ | :--------------------------------- |
| **Complexity**   | O(N²) (Slower on large files)   | **O(N) (Linear / Fast)**           |
| **Lookups**      | Array Iteration                 | **Set / Hash Map**                 |
| **Colors**       | Standard Rainbow (Low Contrast) | **Interleaved / Color Blind Safe** |
| **Config**       | Requires Reload                 | **Live Update**                    |
| **Architecture** | Legacy JS/TS                    | **Modern Strict TS**               |
| **Typing**       | Loose (`any`)                   | **Strict**                         |

## License

MIT
