// Opacity Constants
const OPACITY_LIGHT = 0.08;
const OPACITY_COLORBLIND = 0.2;
const OPACITY_AESTHETIC = 0.1;

export type PaletteKey = 'universal' | 'protan-deuteran' | 'tritan' | 'cool' | 'warm';

export const PALETTES: Record<PaletteKey, string[]> = {
    'universal': [
        `rgba(255, 215, 0, ${OPACITY_LIGHT})`,
        `rgba(65, 105, 225, ${OPACITY_LIGHT})`,
        `rgba(255, 105, 180, ${OPACITY_LIGHT})`,
        `rgba(0, 255, 255, ${OPACITY_LIGHT})`
    ],
    'protan-deuteran': [
        `rgba(240, 228, 66, ${OPACITY_COLORBLIND})`,
        `rgba(86, 180, 233, ${OPACITY_COLORBLIND})`,
        `rgba(230, 159, 0, ${OPACITY_COLORBLIND})`,
        `rgba(0, 114, 178, ${OPACITY_COLORBLIND})`
    ],
    'tritan': [
        `rgba(204, 121, 167, ${OPACITY_COLORBLIND})`,
        `rgba(0, 158, 115, ${OPACITY_COLORBLIND})`,
        `rgba(213, 94, 0, ${OPACITY_COLORBLIND})`,
        `rgba(240, 240, 240, ${OPACITY_COLORBLIND})`
    ],
    'cool': [
        `rgba(64, 224, 208, ${OPACITY_AESTHETIC})`,
        `rgba(100, 149, 237, ${OPACITY_AESTHETIC})`,
        `rgba(123, 104, 238, ${OPACITY_AESTHETIC})`,
        `rgba(176, 196, 222, ${OPACITY_AESTHETIC})`
    ],
    'warm': [
        `rgba(255, 160, 122, ${OPACITY_AESTHETIC})`,
        `rgba(255, 215, 0, ${OPACITY_AESTHETIC})`,
        `rgba(255, 127, 80, ${OPACITY_AESTHETIC})`,
        `rgba(240, 230, 140, ${OPACITY_AESTHETIC})`
    ]
};

export const CSS_NAMED_COLORS = new Set([
    'transparent', 'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure',
    'beige', 'bisque', 'black', 'blanchedalmond', 'blue', 'blueviolet', 'brown',
    'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue',
    'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod',
    'darkgray', 'darkgrey', 'darkgreen', 'darkkhaki', 'darkmagenta', 'darkolivegreen',
    'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen', 'darkslateblue',
    'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink',
    'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite',
    'forestgreen', 'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray',
    'grey', 'green', 'greenyellow', 'honeydew', 'hotpink', 'indianred', 'indigo',
    'ivory', 'khaki', 'lavender', 'lavenderblush', 'lawngreen', 'lemonchiffon',
    'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow', 'lightgray',
    'lightgrey', 'lightgreen', 'lightpink', 'lightsalmon', 'lightseagreen',
    'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue', 'lightyellow',
    'lime', 'limegreen', 'linen', 'magenta', 'maroon', 'mediumaquamarine',
    'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue',
    'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream',
    'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab',
    'orange', 'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise',
    'palevioletred', 'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue',
    'purple', 'rebeccapurple', 'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon',
    'sandybrown', 'seagreen', 'seashell', 'sienna', 'silver', 'skyblue', 'slateblue',
    'slategray', 'slategrey', 'snow', 'springgreen', 'steelblue', 'tan', 'teal',
    'thistle', 'tomato', 'turquoise', 'violet', 'wheat', 'white', 'whitesmoke',
    'yellow', 'yellowgreen'
]);

export enum ColorThemeKind {
    Light = 1,
    Dark = 2,
}

export function brightenColor(
    color: string,
    brightness: number,
    themeKind: ColorThemeKind,
): string {
    if (brightness === 0) return color;

    let r = 0,
        g = 0,
        b = 0,
        a = 1;
    let matched = false;

    const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
    if (rgbaMatch) {
        r = parseInt(rgbaMatch[1], 10);
        g = parseInt(rgbaMatch[2], 10);
        b = parseInt(rgbaMatch[3], 10);
        a = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
        matched = true;
    } else if (color.startsWith('#')) {
        let hex = color.slice(1);
        if (hex.length === 3 || hex.length === 4) {
            hex = hex
                .split('')
                .map((c) => c + c)
                .join('');
        }
        if (hex.length === 6 || hex.length === 8) {
            r = parseInt(hex.slice(0, 2), 16);
            g = parseInt(hex.slice(2, 4), 16);
            b = parseInt(hex.slice(4, 6), 16);
            a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
            matched = true;
        }
    }

    if (!matched) return color;

    const isLightTheme = themeKind === ColorThemeKind.Light;
    const factor = brightness / 10;

    if (isLightTheme) {
        r = Math.round(Math.max(0, r - r * factor * 0.4));
        g = Math.round(Math.max(0, g - g * factor * 0.4));
        b = Math.round(Math.max(0, b - b * factor * 0.4));
    } else {
        r = Math.round(Math.min(255, r + (255 - r) * factor * 0.4));
        g = Math.round(Math.min(255, g + (255 - g) * factor * 0.4));
        b = Math.round(Math.min(255, b + (255 - b) * factor * 0.4));
    }

    a = Math.min(1, a + factor * 0.3);

    return `rgba(${r}, ${g}, ${b}, ${a})`;
}
