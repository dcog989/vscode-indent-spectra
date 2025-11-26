# ![Indent Spectra logo](https://raw.githubusercontent.com/dcog989/vscode-indent-spectra/main/assets/icon.png) Indent Spectra

*Indent Spectra* is an indentation highlighter for Visual Studio Code. It colorizes indentation levels to make code structure instantly readable.

It has feature parity with *Indent Rainbow*, it's just [faster, slimmer, modern](#comparison-with-indent-rainbow).

[Install *Indent Spectra* from Marketplace](https://marketplace.visualstudio.com/items?itemName=dcog989.indent-spectra).

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
| :---------------------- | :-------------------------------------------------------------------- |
| **Universal** (Default) | Excellent contrast (Gold, Royal Blue, Pink, Cyan), optimized for all. |
| **Protan/Deuteran**     | Safe for Red/Green color blindness. Uses Blue/Yellow/Gray scales.     |
| **Tritan**              | Safe for Blue color blindness. Uses Red/Teal/Gray scales.             |
| **Cool**                | Calming blues and turquoises.                                         |
| **Warm**                | Energetic golds, corals, and salmons.                                 |
| **Custom**              | Use your own color array.                                             |

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

For starters, it's lightweight: *Indent Spectra* install file = 18 KB, *Indent Rainbow* = 8.45 MB. Not a typo: *18 KB vs 8,450 KB*.

### 1. Performance, Efficiency

The rendering engine was rewritten from scratch to handle large files without slowing down the editor.

- **O(1) vs O(N) Lookups:** The original extension uses `Array.indexOf` inside the main rendering loop to check for ignored lines, leading to quadratic complexity. *Indent Spectra* uses `Set` lookups (O(1)), making it instantaneously fast regardless of file size.
- **Memory Management:** Reduced Garbage Collection pressure by reusing RegExp objects and avoiding unnecessary string splitting/array allocations during the render loop.
- **Smart Debouncing:** Implemented input debouncing to prevent the extension from trying to render every single keystroke during rapid typing.

### 2. Accessibility, Color Theory

*Rainbow* uses a standard spectrum where adjacent colors (like Green and Cyan) blend together for many people.

- **Interleaved Contrast:** Instead of a gradient, *Spectra* alternates **Warm** (Gold, Pink) and **Cool** (Blue, Cyan) colors. This maximizes the "visual distance" between indentation levels.
- **Accessibility Presets:** Includes built-in palettes designed for **Color Vision Deficiencies** ([Protanopia, Deuteranopia, and Tritanopia](https://www.colourblindawareness.org/colour-blindness/types-of-colour-blindness/)) based on the [Okabe-Ito standard](https://easystats.github.io/see/reference/scale_color_okabeito.html).

### 3. UX

- **Live Configuration:** Changing settings (colors, tab size, styles) updates the editor instantly. *Rainbow* requires a full window reload to apply settings.
- **Web Native:** Configured to run in **VS Code for the Web** (github.dev, vscode.dev) with `virtualWorkspaces` support enabled in the manifest.

### 4. Code Quality & Maintenance

- **Strict Typing:** TypeScript 5.9 / `strict: true`. *Rainbow* relies on loose `var` declarations and implicit `any` types.
- **Modern Architecture:** Clean class structure (`IndentSpectra.ts`) with proper lifecycle management (`dispose` patterns), so easier to maintain and less prone to memory leaks.

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
