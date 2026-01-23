export interface ParsedColor {
    r: number;
    g: number;
    b: number;
    a: number;
}

export class ColorUtils {
    private static readonly HEX_COLOR_REGEX =
        /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
    private static readonly RGBA_COLOR_REGEX =
        /^rgba?\(\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*(?:,\s*(?:0|1|0?\.\d+|\d{1,3}%?)\s*)?\)$/i;

    private static readonly CSS_NAMED_COLORS = new Set([
        'transparent',
        'aliceblue',
        'antiquewhite',
        'aqua',
        'aquamarine',
        'azure',
        'beige',
        'bisque',
        'black',
        'blanchedalmond',
        'blue',
        'blueviolet',
        'brown',
        'burlywood',
        'cadetblue',
        'chartreuse',
        'chocolate',
        'coral',
        'cornflowerblue',
        'cornsilk',
        'crimson',
        'cyan',
        'darkblue',
        'darkcyan',
        'darkgoldenrod',
        'darkgray',
        'darkgrey',
        'darkgreen',
        'darkkhaki',
        'darkmagenta',
        'darkolivegreen',
        'darkorange',
        'darkorchid',
        'darkred',
        'darksalmon',
        'darkseagreen',
        'darkslateblue',
        'darkslategray',
        'darkslategrey',
        'darkturquoise',
        'darkviolet',
        'deeppink',
        'deepskyblue',
        'dimgray',
        'dimgrey',
        'dodgerblue',
        'firebrick',
        'floralwhite',
        'forestgreen',
        'fuchsia',
        'gainsboro',
        'ghostwhite',
        'gold',
        'goldenrod',
        'gray',
        'grey',
        'green',
        'greenyellow',
        'honeydew',
        'hotpink',
        'indianred',
        'indigo',
        'ivory',
        'khaki',
        'lavender',
        'lavenderblush',
        'lawngreen',
        'lemonchiffon',
        'lightblue',
        'lightcoral',
        'lightcyan',
        'lightgoldenrodyellow',
        'lightgray',
        'lightgrey',
        'lightgreen',
        'lightpink',
        'lightsalmon',
        'lightseagreen',
        'lightskyblue',
        'lightslategray',
        'lightslategrey',
        'lightsteelblue',
        'lightyellow',
        'lime',
        'limegreen',
        'linen',
        'magenta',
        'maroon',
        'mediumaquamarine',
        'mediumblue',
        'mediumorchid',
        'mediumpurple',
        'mediumseagreen',
        'mediumslateblue',
        'mediumspringgreen',
        'mediumturquoise',
        'mediumvioletred',
        'midnightblue',
        'mintcream',
        'mistyrose',
        'moccasin',
        'navajowhite',
        'navy',
        'oldlace',
        'olive',
        'olivedrab',
        'orange',
        'orangered',
        'orchid',
        'palegoldenrod',
        'palegreen',
        'paleturquoise',
        'palevioletred',
        'papayawhip',
        'peachpuff',
        'peru',
        'pink',
        'plum',
        'powderblue',
        'purple',
        'rebeccapurple',
        'red',
        'rosybrown',
        'royalblue',
        'saddlebrown',
        'salmon',
        'sandybrown',
        'seagreen',
        'seashell',
        'sienna',
        'silver',
        'skyblue',
        'slateblue',
        'slategray',
        'slategrey',
        'snow',
        'springgreen',
        'steelblue',
        'tan',
        'teal',
        'thistle',
        'tomato',
        'turquoise',
        'violet',
        'wheat',
        'white',
        'whitesmoke',
        'yellow',
        'yellowgreen',
    ]);

    public static isValidColor(color: string): boolean {
        if (!color || typeof color !== 'string') return false;
        const trimmed = color.trim();
        return (
            this.HEX_COLOR_REGEX.test(trimmed) ||
            this.RGBA_COLOR_REGEX.test(trimmed) ||
            this.CSS_NAMED_COLORS.has(trimmed.toLowerCase())
        );
    }

    public static parseColor(color: string): ParsedColor | null {
        const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
        if (rgbaMatch) {
            return {
                r: parseInt(rgbaMatch[1], 10),
                g: parseInt(rgbaMatch[2], 10),
                b: parseInt(rgbaMatch[3], 10),
                a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1,
            };
        }

        if (color.startsWith('#')) {
            let hex = color.slice(1);
            if (hex.length === 3 || hex.length === 4) {
                hex = hex
                    .split('')
                    .map((c) => c + c)
                    .join('');
            }
            if (hex.length === 6 || hex.length === 8) {
                return {
                    r: parseInt(hex.slice(0, 2), 16),
                    g: parseInt(hex.slice(2, 4), 16),
                    b: parseInt(hex.slice(4, 6), 16),
                    a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
                };
            }
        }

        return null;
    }

    public static applyBrightness(
        parsed: ParsedColor,
        brightness: number,
        isLightTheme: boolean,
    ): string {
        const factor = brightness / 10;

        let { r, g, b, a } = parsed;

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

    public static brightenColor(color: string, brightness: number, isLightTheme: boolean): string {
        if (brightness === 0) return color;

        const parsed = this.parseColor(color);
        if (!parsed) return color;

        return this.applyBrightness(parsed, brightness, isLightTheme);
    }

    public static sanitizeColor(color: string): string {
        return this.isValidColor(color) ? color : '';
    }
}
