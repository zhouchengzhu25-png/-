import React, { useRef } from 'react';
import { Camera, Music, Play, Pause, EyeOff, Eye } from 'lucide-react';

interface UIOverlayProps {
  visible: boolean;
  isPlaying: boolean;
  onToggleUI: () => void;
  onTogglePlay: () => void;
  onUploadPhotos: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadAudio: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const UIOverlay: React.FC<UIOverlayProps> = ({
  visible,
  isPlaying,
  onToggleUI,
  onTogglePlay,
  onUploadPhotos,
  onUploadAudio,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // We keep the container mounted but invisible to allow fade effects
  return (
    <div
      className={`absolute inset-0 z-10 flex flex-col items-center justify-between py-10 transition-opacity duration-500 ${
        visible ? 'opacity-100 pointer-events-none' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Title Section */}
      <div className={`text-center transition-transform duration-700 ${visible ? 'translate-y-0' : '-translate-y-10'}`}>
        <h1 className="text-gold-100 text-5xl md:text-7xl mt-5 font-normal tracking-[0.2em] font-cinzel drop-shadow-[0_0_50px_rgba(252,238,167,0.4)] bg-gradient-to-b from-white to-gold-200 bg-clip-text text-transparent">
          Merry Christmas
        </h1>
        <p className="text-gold-200/60 font-playfair tracking-widest text-sm mt-2 uppercase">
          Interactive 3D Experience
        </p>
      </div>

      {/* Controls Bar */}
      <div 
        className={`pointer-events-auto bg-black/60 backdrop-blur-md border border-gold-300/30 rounded-full px-6 py-3 flex gap-4 items-center transition-transform duration-500 mb-6 ${
          visible ? 'translate-y-0' : 'translate-y-20'
        }`}
      >
        {/* Photo Upload */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="group flex items-center gap-2 text-gold-300 hover:text-white hover:bg-gold-300/20 px-4 py-2 rounded-lg transition-all duration-300 text-xs uppercase tracking-widest border border-transparent hover:border-gold-300/50"
          title="Upload Photos"
        >
          <Camera size={16} />
          <span className="hidden sm:inline">Memories</span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={onUploadPhotos}
          />
        </button>

        {/* Play/Pause Button */}
        <button
          onClick={onTogglePlay}
          className={`group flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 text-xs uppercase tracking-widest border ${
            isPlaying
              ? 'bg-gold-300/80 text-black border-gold-300'
              : 'text-gold-300 hover:text-white hover:bg-gold-300/20 border-transparent hover:border-gold-300/50'
          }`}
          title={isPlaying ? "Pause Music" : "Play BGM"}
        >
          {isPlaying ? <Pause size={16} fill="black" /> : <Play size={16} />}
          <span className="hidden sm:inline">{isPlaying ? 'Pause' : 'BGM'}</span>
        </button>

        {/* Custom Audio Upload */}
        <button
          onClick={() => audioInputRef.current?.click()}
          className="group flex items-center gap-2 text-gold-300 hover:text-white hover:bg-gold-300/20 px-4 py-2 rounded-lg transition-all duration-300 text-xs uppercase tracking-widest border border-transparent hover:border-gold-300/50"
          title="Upload Custom MP3"
        >
          <Music size={16} />
          <span className="hidden sm:inline">Audio</span>
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={onUploadAudio}
          />
        </button>

        <div className="w-px h-6 bg-gold-300/20 mx-1"></div>

        {/* Hide UI Button */}
        <button
          onClick={onToggleUI}
          className="flex items-center gap-2 text-gold-300 hover:text-white hover:bg-gold-300/20 px-4 py-2 rounded-lg transition-all duration-300 text-xs uppercase tracking-widest border border-transparent hover:border-gold-300/50"
          title="Hide UI (Press H)"
        >
          <EyeOff size={16} />
          <span className="hidden sm:inline">Hide</span>
        </button>
      </div>
      
      {/* Restore UI Button (Visible only when UI is hidden) */}
      {!visible && (
        <button
          onClick={onToggleUI}
          className="fixed bottom-10 right-10 pointer-events-auto bg-black/60 backdrop-blur-md border border-gold-300/30 rounded-full p-4 text-gold-300 hover:text-white hover:bg-gold-300/20 transition-all duration-300 shadow-[0_0_20px_rgba(212,175,55,0.2)]"
          title="Show UI"
        >
          <Eye size={24} />
        </button>
      )}
    </div>
  );
};