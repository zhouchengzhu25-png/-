import * as THREE from 'three';

export interface SceneRef {
  addPhotos: (files: FileList) => void;
  playAudio: (url?: string) => void;
  toggleAudio: () => boolean; // Returns new playing state
  setMusicVolume: (volume: number) => void;
}

export interface AppState {
  isLoading: boolean;
  loadingText: string;
  uiVisible: boolean;
  isPlaying: boolean;
}

export const CONFIG = {
  colors: {
    bg: 0x000000,
    champagneGold: 0xffb7c5, // Rose Gold / Light Pink
    deepGreen: 0x4a0e2e,     // Deep Magenta / Dark Purple (replaces green)
    accentRed: 0xff1493,     // Deep Hot Pink (replaces red)
  },
  particles: {
    count: 1200,
    snowCount: 800,
    treeHeight: 24,
    treeRadius: 8,
  },
  ai: {
    detectInterval: 80,
  },
};

export const DEFAULT_AUDIO_URL = 'https://cdn.pixabay.com/audio/2022/12/13/audio_732b6e1530.mp3';