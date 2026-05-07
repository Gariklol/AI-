export interface FilterState {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  sepia: number;
  blur: number;
  exposure: number;
  shadows: number;
  highlights: number;
  whites: number;
  blacks: number;
  temperature: number;
  tint: number;
  noiseReduction: number;
  sharpening: number;
  grain: number;
  perspectiveX: number;
  perspectiveY: number;
  scale: number;
  hdr: number;
  vignette: number;
  frame: number;
  doubleExposureOpacity: number;
  doubleExposureBlendMode: string;
}

export const defaultFilters: FilterState = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  sepia: 0,
  blur: 0,
  exposure: 0,
  shadows: 0,
  highlights: 0,
  whites: 0,
  blacks: 0,
  temperature: 0,
  tint: 0,
  noiseReduction: 0,
  sharpening: 0,
  grain: 0,
  perspectiveX: 0,
  perspectiveY: 0,
  scale: 100,
  hdr: 0,
  vignette: 0,
  frame: 0,
  doubleExposureOpacity: 0,
  doubleExposureBlendMode: 'screen',
};

export const presets: Record<string, FilterState> = {
  original: { ...defaultFilters },
  cinema8k: {
    ...defaultFilters,
    brightness: 105,
    contrast: 130,
    saturation: 85,
    hue: -5,
    sepia: 10,
    temperature: -5,
  },
  vibrant4k: {
    ...defaultFilters,
    brightness: 110,
    contrast: 115,
    saturation: 140,
  },
  bw: {
    ...defaultFilters,
    contrast: 120,
    saturation: 0,
  },
  vintage: {
    ...defaultFilters,
    brightness: 95,
    contrast: 110,
    saturation: 80,
    sepia: 40,
    noiseReduction: 20,
  },
  skinSmooth: {
    ...defaultFilters,
    brightness: 108,
    contrast: 95,
    saturation: 105,
    blur: 0.8,
  },
  filmGrain: {
    ...defaultFilters,
    brightness: 90,
    contrast: 125,
    saturation: 80,
    sepia: 20,
    grain: 40,
  },
  bokehGlow: {
    ...defaultFilters,
    brightness: 110,
    contrast: 105,
    saturation: 120,
    blur: 4,
    highlights: 20,
  },
  mattePortrait: {
    ...defaultFilters,
    brightness: 105,
    contrast: 90,
    saturation: 95,
    temperature: 10,
    blacks: 15,
  },
  cyberpunk: {
    ...defaultFilters,
    brightness: 95,
    contrast: 140,
    saturation: 160,
    temperature: -30,
    tint: 40,
    grain: 15,
  },
  softSkin: { 
    ...defaultFilters, 
    brightness: 105, 
    contrast: 95, 
    saturation: 105, 
    blur: 0.5, 
    highlights: -10,
    temperature: 5,
  },
  fashion: { 
    ...defaultFilters, 
    brightness: 100, 
    contrast: 120, 
    saturation: 90, 
    whites: 10, 
    blacks: -10, 
    sharpening: 10,
  },
  studio: { 
    ...defaultFilters, 
    brightness: 110, 
    contrast: 110, 
    shadows: 15, 
    highlights: -15, 
    sharpening: 5,
  },
  glamour: { 
    ...defaultFilters, 
    brightness: 108, 
    contrast: 115, 
    saturation: 85, 
    blur: 1, 
    highlights: 10,
    temperature: 10,
  },
  dramatic: { 
    ...defaultFilters, 
    contrast: 140, 
    saturation: 70, 
    shadows: -20, 
    whites: 20, 
    vignette: 30,
  }
};
