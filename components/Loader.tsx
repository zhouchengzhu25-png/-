import React from 'react';

interface LoaderProps {
  visible: boolean;
  text: string;
}

export const Loader: React.FC<LoaderProps> = ({ visible, text }) => {
  return (
    <div
      className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-black transition-opacity duration-1000 ${
        visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="w-12 h-12 rounded-full border border-gold-300/20 border-t-gold-300 animate-spin mb-6" />
      <div className="text-gold-300 text-sm tracking-[0.3em] uppercase font-light">
        {text}
      </div>
    </div>
  );
};