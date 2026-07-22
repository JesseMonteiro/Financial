import { create } from 'zustand';
import { getLocalSetting, setLocalSetting, getProfileSettings, updateProfileSettings } from '../services/storage';

export const useSettingsStore = create((set, get) => ({
  theme: getLocalSetting('theme', 'dark'), // 'light' | 'dark'
  primaryColor: getLocalSetting('primaryColor', '#6366f1'),
  density: getLocalSetting('density', 'comfortable'), // 'compact' | 'comfortable' | 'spacious'
  animationsEnabled: getLocalSetting('animationsEnabled', true),
  currency: getLocalSetting('currency', 'BRL'),
  
  loadFromSupabase: async () => {
    const profile = await getProfileSettings();
    if (profile) {
      if (profile.theme) {
        setLocalSetting('theme', profile.theme);
        document.documentElement.setAttribute('data-theme', profile.theme);
      }
      if (profile.density) {
        setLocalSetting('density', profile.density);
        document.documentElement.setAttribute('data-density', profile.density);
      }
      if (profile.primaryColor) setLocalSetting('primaryColor', profile.primaryColor);
      if (profile.animationsEnabled !== undefined) setLocalSetting('animationsEnabled', profile.animationsEnabled);
      if (profile.currency) setLocalSetting('currency', profile.currency);

      set({
        theme: profile.theme || get().theme,
        primaryColor: profile.primaryColor || get().primaryColor,
        density: profile.density || get().density,
        animationsEnabled: profile.animationsEnabled !== undefined ? profile.animationsEnabled : get().animationsEnabled,
        currency: profile.currency || get().currency,
      });
    }
  },

  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    setLocalSetting('theme', theme);
    updateProfileSettings({ theme });
    set({ theme });
  },

  setDensity: (density) => {
    document.documentElement.setAttribute('data-density', density);
    setLocalSetting('density', density);
    updateProfileSettings({ density });
    set({ density });
  },

  setPrimaryColor: (color) => {
    setLocalSetting('primaryColor', color);
    updateProfileSettings({ primaryColor: color });
    set({ primaryColor: color });
  },

  setAnimationsEnabled: (enabled) => {
    setLocalSetting('animationsEnabled', enabled);
    updateProfileSettings({ animationsEnabled: enabled });
    set({ animationsEnabled: enabled });
  },

  setCurrency: (currency) => {
    setLocalSetting('currency', currency);
    updateProfileSettings({ currency });
    set({ currency });
  },

  initTheme: () => {
    const currentTheme = get().theme;
    const currentDensity = get().density;
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.documentElement.setAttribute('data-density', currentDensity);
  }
}));
