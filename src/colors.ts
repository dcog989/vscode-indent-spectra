// Opacity Constants
const OPACITY_LIGHT = 0.08;
const OPACITY_COLORBLIND = 0.2;
const OPACITY_AESTHETIC = 0.1;

export type PaletteKey = 'universal' | 'protan-deuteran' | 'tritan' | 'cool' | 'warm';

export const PALETTES: Record<PaletteKey, string[]> = {
    universal: [
        `rgba(255, 215, 0, ${OPACITY_LIGHT})`,
        `rgba(65, 105, 225, ${OPACITY_LIGHT})`,
        `rgba(255, 105, 180, ${OPACITY_LIGHT})`,
        `rgba(0, 255, 255, ${OPACITY_LIGHT})`,
    ],
    'protan-deuteran': [
        `rgba(240, 228, 66, ${OPACITY_COLORBLIND})`,
        `rgba(86, 180, 233, ${OPACITY_COLORBLIND})`,
        `rgba(230, 159, 0, ${OPACITY_COLORBLIND})`,
        `rgba(0, 114, 178, ${OPACITY_COLORBLIND})`,
    ],
    tritan: [
        `rgba(204, 121, 167, ${OPACITY_COLORBLIND})`,
        `rgba(0, 158, 115, ${OPACITY_COLORBLIND})`,
        `rgba(213, 94, 0, ${OPACITY_COLORBLIND})`,
        `rgba(240, 240, 240, ${OPACITY_COLORBLIND})`,
    ],
    cool: [
        `rgba(64, 224, 208, ${OPACITY_AESTHETIC})`,
        `rgba(100, 149, 237, ${OPACITY_AESTHETIC})`,
        `rgba(123, 104, 238, ${OPACITY_AESTHETIC})`,
        `rgba(176, 196, 222, ${OPACITY_AESTHETIC})`,
    ],
    warm: [
        `rgba(255, 160, 122, ${OPACITY_AESTHETIC})`,
        `rgba(255, 215, 0, ${OPACITY_AESTHETIC})`,
        `rgba(255, 127, 80, ${OPACITY_AESTHETIC})`,
        `rgba(240, 230, 140, ${OPACITY_AESTHETIC})`,
    ],
};

// Re-export for backward compatibility
export type { ColorBrightnessCache } from './ColorUtils';
