export const Palette = {
  dark: {
    background: '#131515',
    surface: '#333534',
    surfaceAlt: '#3E4140',
    accent: '#F5D198',
    text: '#FFFFFF',
    textSecondary: '#A8AAA9',
    danger: '#C0392B',
    info: '#2980B9',
    mapUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  },
  light: {
    background: '#FAF7F2',
    surface: '#EFE9DF',
    surfaceAlt: '#E3D7C3',
    accent: '#B8893F',
    text: '#131515',
    textSecondary: '#5C5A55',
    danger: '#B03A2E',
    info: '#2471A3',
    mapUrl: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  },
};

export type ThemeMode = 'light' | 'dark';
export type ThemeColors = typeof Palette.dark;
