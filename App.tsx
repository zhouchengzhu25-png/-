import React, { useState, useRef, useCallback } from 'react';
import { Scene3D } from './components/Scene3D';
import { UIOverlay } from './components/UIOverlay';
import { Loader } from './components/Loader';
import { SceneRef } from './types';

function App() {
  const [loading, setLoading] = useState(true);
  const [uiVisible, setUiVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const sceneRef = useRef<SceneRef>(null);

  // Keydown handler for 'H' to toggle UI
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h') {
        setUiVisible((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLoadStart = useCallback(() => {
    setLoading(true);
  }, []);

  const handleLoadComplete = useCallback(() => {
    // Add a slight delay for aesthetic transition
    setTimeout(() => {
        setLoading(false);
    }, 1000);
  }, []);

  const handleUploadPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && sceneRef.current) {
      sceneRef.current.addPhotos(e.target.files);
    }
  };

  const handleUploadAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && sceneRef.current) {
      const url = URL.createObjectURL(e.target.files[0]);
      sceneRef.current.playAudio(url);
    }
  };

  const handleTogglePlay = () => {
      if(sceneRef.current) {
          sceneRef.current.toggleAudio();
      }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <Loader visible={loading} text="Initializing Experience" />
      
      <Scene3D 
        ref={sceneRef}
        onLoadStart={handleLoadStart} 
        onLoadComplete={handleLoadComplete}
        onPlaybackChange={setIsPlaying}
      />
      
      {!loading && (
        <UIOverlay 
            visible={uiVisible} 
            isPlaying={isPlaying}
            onToggleUI={() => setUiVisible(!uiVisible)}
            onTogglePlay={handleTogglePlay}
            onUploadPhotos={handleUploadPhotos}
            onUploadAudio={handleUploadAudio}
        />
      )}
    </div>
  );
}

export default App;