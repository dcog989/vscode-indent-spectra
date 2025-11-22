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

## License

MIT
