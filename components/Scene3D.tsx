import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import GUI from 'lil-gui';
import { CONFIG, SceneRef, DEFAULT_AUDIO_URL } from '../types';

interface Scene3DProps {
  onLoadStart: () => void;
  onLoadComplete: () => void;
  onPlaybackChange: (isPlaying: boolean) => void;
}

// Updated images to 11 items as requested
const PRELOADED_IMAGES = [
    'https://images.unsplash.com/photo-1482938289607-e9573fc25ebb?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1518709414768-a8c98c64268e?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1509356843151-3e7d96241e11?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1516820208784-270b250306e3?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1526494631344-8c6fa64724b7?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1512389142860-9c449e58a543?q=80&w=800&auto=format&fit=crop', 
    'https://images.unsplash.com/photo-1542224566-6e85f2e6772f?q=80&w=800&auto=format&fit=crop', 
    'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?q=80&w=800&auto=format&fit=crop',
];

const PARAMS = {
  bloomStrength: 1.5, // Increased for pink glow
  bloomRadius: 0.5,
  rotationSpeed: 1.0,
  particleSize: 1.0,
  snowDensity: 1.0,
  musicVolume: 0.5,
};

export const Scene3D = forwardRef<SceneRef, Scene3DProps>(({ onLoadStart, onLoadComplete, onPlaybackChange }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Three.js instances ref
  const inst = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    composer: EffectComposer;
    bloomPass: UnrealBloomPass;
    mainGroup: THREE.Group;
    snowGroup: THREE.Group;
    photoMeshGroup: THREE.Group;
    cursor: THREE.Mesh; // Visual Hand Cursor
    particles: any[];
    clock: THREE.Clock;
    sound: THREE.Audio;
    audioLoader: THREE.AudioLoader;
    handLandmarker: HandLandmarker | null;
    gui: GUI;
    requestID: number;
    state: {
        mode: 'TREE' | 'SCATTER' | 'FOCUS';
        focusTarget: THREE.Object3D | null;
        hand: { detected: boolean; x: number; y: number };
        targetRotation: { x: number; y: number };
        currentRotation: { x: number; y: number };
        targetPosition: { x: number; y: number };
        currentPosition: { x: number; y: number };
    }
  } | null>(null);

  useImperativeHandle(ref, () => ({
    addPhotos: (files: FileList) => {
      if (!inst.current) return;
      if (inst.current.photoMeshGroup.children.length > 50) {
        alert("Memory limit reached for photos.");
        return;
      }
      Array.from(files).forEach((f) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          if(ev.target?.result) {
            new THREE.TextureLoader().load(ev.target.result as string, (t) => {
              t.colorSpace = THREE.SRGBColorSpace;
              // Ensure we check image dimensions for aspect ratio
              addPhotoToScene(t);
            });
          }
        };
        reader.readAsDataURL(f);
      });
    },
    playAudio: (url?: string) => {
        playMusic(url);
    },
    toggleAudio: () => {
        if(!inst.current) return false;
        if(inst.current.sound.isPlaying) {
            inst.current.sound.pause();
            onPlaybackChange(false);
            return false;
        } else {
            if(inst.current.sound.buffer) {
                inst.current.sound.play();
                onPlaybackChange(true);
                return true;
            } else {
                playMusic(DEFAULT_AUDIO_URL);
                return true;
            }
        }
    },
    setMusicVolume: (v: number) => {
        if(inst.current) inst.current.sound.setVolume(v);
    }
  }));

  const addPhotoToScene = (texture: THREE.Texture) => {
    if (!inst.current) return;
    const { photoMeshGroup, particles } = inst.current;

    const img = texture.image as HTMLImageElement;
    
    // Force 1:1 Aspect Ratio with Center Crop ("Cover" fit)
    if (img && img.width && img.height) {
        const imageAspect = img.width / img.height;
        const targetAspect = 1.0; // Square
        
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        
        if (imageAspect > targetAspect) {
            // Landscape image in Square frame: Crop width
            texture.repeat.x = targetAspect / imageAspect;
            texture.offset.x = (1 - texture.repeat.x) / 2;
        } else {
            // Portrait image in Square frame: Crop height
            texture.repeat.y = imageAspect / targetAspect;
            texture.offset.y = (1 - texture.repeat.y) / 2;
        }
    }

    // Square Frame Dimensions (1:1)
    const size = 1.2;
    const framePadding = 0.1;
    const frameGeo = new THREE.BoxGeometry(size + framePadding * 2, size + framePadding * 2, 0.05);
    const frameMat = new THREE.MeshStandardMaterial({
        color: CONFIG.colors.champagneGold, // Rose Gold
        metalness: 1.0,
        roughness: 0.1
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);

    const photoGeo = new THREE.PlaneGeometry(size, size);
    // Use texture with correct encoding
    const photoMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    const photo = new THREE.Mesh(photoGeo, photoMat);
    photo.position.z = 0.04;
    
    // Also add photo to back for rotation visibility
    const photoBack = photo.clone();
    photoBack.rotation.y = Math.PI;
    photoBack.position.z = -0.04;

    const group = new THREE.Group();
    group.add(frame);
    group.add(photo);
    group.add(photoBack);
    
    // Slight random scale
    const s = 0.8 + Math.random() * 0.3;
    group.scale.set(s,s,s);
    
    photoMeshGroup.add(group);
    particles.push(new Particle(group, 'PHOTO', inst.current.clock));
  };

  const playMusic = (url: string = DEFAULT_AUDIO_URL) => {
      if(!inst.current) return;
      const { sound, audioLoader } = inst.current;
      if(sound.isPlaying) sound.stop();
      audioLoader.load(url, (buffer) => {
          sound.setBuffer(buffer);
          sound.setLoop(true);
          sound.setVolume(PARAMS.musicVolume);
          sound.play();
          onPlaybackChange(true);
      });
  };

  useEffect(() => {
    if (!containerRef.current || !videoRef.current) return;
    
    onLoadStart();

    // -- INIT THREE JS --
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.colors.bg);
    scene.fog = new THREE.FogExp2(CONFIG.colors.bg, 0.02);

    const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 50);

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 2.0;
    containerRef.current.appendChild(renderer.domElement);

    const mainGroup = new THREE.Group();
    scene.add(mainGroup);
    const snowGroup = new THREE.Group();
    scene.add(snowGroup);
    const photoMeshGroup = new THREE.Group();
    mainGroup.add(photoMeshGroup);

    // Audio
    const listener = new THREE.AudioListener();
    camera.add(listener);
    const sound = new THREE.Audio(listener);
    const audioLoader = new THREE.AudioLoader();

    // Lighting
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    
    const ambient = new THREE.AmbientLight(0xffb7c5, 0.6); // Pinkish ambient
    scene.add(ambient);
    
    const innerLight = new THREE.PointLight(0xff69b4, 2, 25); // Hot pink inner glow
    innerLight.position.set(0, 5, 0);
    mainGroup.add(innerLight);
    
    const spotGold = new THREE.SpotLight(0xffdbe6, 800); // Pale pink spotlight
    spotGold.position.set(30, 40, 40);
    scene.add(spotGold);

    // Post Processing
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.5, 0.9);
    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // Gesture Cursor (Visual Feedback)
    const cursorGeo = new THREE.RingGeometry(0.8, 1.0, 32);
    const cursorMat = new THREE.MeshBasicMaterial({ color: 0xff69b4, transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const cursor = new THREE.Mesh(cursorGeo, cursorMat);
    cursor.visible = false;
    scene.add(cursor);

    // GUI
    const gui = new GUI({ title: 'Tree Settings' });
    const visuals = gui.addFolder('Visuals');
    visuals.add(PARAMS, 'bloomStrength', 0, 3).onChange((v: number) => bloomPass.strength = v);
    visuals.add(PARAMS, 'particleSize', 0.1, 2.0);
    const motion = gui.addFolder('Motion');
    motion.add(PARAMS, 'rotationSpeed', 0, 3);
    motion.add(PARAMS, 'snowDensity', 0, 1).onChange((v: number) => {
        snowGroup.visible = v > 0.05;
        snowGroup.children.forEach(c => c.visible = Math.random() < v);
    });
    const audio = gui.addFolder('Audio');
    audio.add(PARAMS, 'musicVolume', 0, 1).onChange((v: number) => sound.setVolume(v));

    // Particle System
    const particles: Particle[] = [];
    const clock = new THREE.Clock();

    // Helper functions for assets
    const createTextures = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,128,128);
        ctx.fillStyle = '#ff1493'; // Deep Pink Stripes
        ctx.beginPath();
        for(let i=-128; i<256; i+=32) {
            ctx.moveTo(i, 0); ctx.lineTo(i+32, 128); ctx.lineTo(i+16, 128); ctx.lineTo(i-16, 0);
        }
        ctx.fill();
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(3, 3);
        return tex;
    };
    
    const createSnowTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext('2d')!;
        const grad = ctx.createRadialGradient(16,16,0, 16,16,16);
        grad.addColorStop(0, 'rgba(255,220,230,1)'); // Light pink tint snow
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,32,32);
        return new THREE.CanvasTexture(canvas);
    };

    const caneTexture = createTextures();
    const snowTexture = createSnowTexture();

    // Initialize Particles
    const initParticles = () => {
        const sphereGeo = new THREE.SphereGeometry(0.5, 16, 16); 
        const boxGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55); 
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0, 0.3, 0),
            new THREE.Vector3(0.1, 0.5, 0), new THREE.Vector3(0.3, 0.4, 0)
        ]);
        const candyGeo = new THREE.TubeGeometry(curve, 8, 0.08, 6, false); 

        // Pink Palette Materials
        const roseGoldMat = new THREE.MeshStandardMaterial({
            color: CONFIG.colors.champagneGold, metalness: 0.9, roughness: 0.1,
            emissive: 0x831843, emissiveIntensity: 0.1
        });
        const deepMagentaMat = new THREE.MeshStandardMaterial({
            color: CONFIG.colors.deepGreen, metalness: 0.4, roughness: 0.6,
            emissive: 0x2e0212, emissiveIntensity: 0.1
        });
        const hotPinkMat = new THREE.MeshPhysicalMaterial({
            color: CONFIG.colors.accentRed, metalness: 0.3, roughness: 0.2, clearcoat: 1.0,
            emissive: 0x550022
        });
        const candyMat = new THREE.MeshStandardMaterial({ map: caneTexture, roughness: 0.4 });

        for (let i = 0; i < CONFIG.particles.count; i++) {
            const rand = Math.random();
            let mesh, type;
            
            // Re-distributed probabilities for the new theme
            if (rand < 0.40) { mesh = new THREE.Mesh(boxGeo, deepMagentaMat); type = 'BOX'; }
            else if (rand < 0.70) { mesh = new THREE.Mesh(boxGeo, roseGoldMat); type = 'GOLD_BOX'; }
            else if (rand < 0.92) { mesh = new THREE.Mesh(sphereGeo, roseGoldMat); type = 'GOLD_SPHERE'; }
            else if (rand < 0.97) { mesh = new THREE.Mesh(sphereGeo, hotPinkMat); type = 'RED'; }
            else { mesh = new THREE.Mesh(candyGeo, candyMat); type = 'CANE'; }

            const s = 0.4 + Math.random() * 0.5;
            mesh.scale.set(s,s,s);
            mesh.rotation.set(Math.random()*6, Math.random()*6, Math.random()*6);
            
            mainGroup.add(mesh);
            particles.push(new Particle(mesh, type, clock));
        }

        const starGeo = new THREE.OctahedronGeometry(1.2, 0);
        const starMat = new THREE.MeshStandardMaterial({
            color: 0xff69b4, emissive: 0xff1493, emissiveIntensity: 2.0, metalness: 1.0, roughness: 0
        });
        const star = new THREE.Mesh(starGeo, starMat);
        star.position.set(0, CONFIG.particles.treeHeight/2 + 1.2, 0);
        mainGroup.add(star);
    };

    const initSnow = () => {
        const snowMat = new THREE.SpriteMaterial({ 
            map: snowTexture, 
            color: 0xffe6f0, // Pale Pink
            transparent: true, 
            opacity: 0.8,
            blending: THREE.AdditiveBlending 
        });
        for(let i=0; i<CONFIG.particles.snowCount; i++) {
            const sprite = new THREE.Sprite(snowMat);
            sprite.position.set(
                (Math.random() - 0.5) * 40,
                (Math.random() - 0.5) * 50,
                (Math.random() - 0.5) * 40
            );
            const s = 0.2 + Math.random() * 0.3;
            sprite.scale.set(s,s,s);
            snowGroup.add(sprite);
            particles.push(new Particle(sprite, 'SNOW', clock));
        }
    };

    initParticles();
    initSnow();

    // Init State
    inst.current = {
        scene, camera, renderer, composer, bloomPass, mainGroup, snowGroup, photoMeshGroup, cursor, particles, clock, sound, audioLoader, gui,
        requestID: 0,
        handLandmarker: null,
        state: {
            mode: 'TREE',
            focusTarget: null,
            hand: { detected: false, x: 0, y: 0 },
            targetRotation: { x: 0, y: 0 },
            currentRotation: { x: 0, y: 0 },
            targetPosition: { x: 0, y: 0 },
            currentPosition: { x: 0, y: 0 },
        }
    };

    // Load Preloaded Images
    const loadDefaultImages = () => {
        const loader = new THREE.TextureLoader();
        PRELOADED_IMAGES.forEach(url => {
            loader.load(url, (t) => {
                t.colorSpace = THREE.SRGBColorSpace;
                addPhotoToScene(t);
            });
        });
    };
    loadDefaultImages();

    // -- MEDIAPIPE --
    const initVision = async () => {
        try {
            // UPDATED: Use 0.10.20 to match compatible versions and fix WASM loading
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/wasm"
            );
            const handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 1
            });
            
            if (inst.current) inst.current.handLandmarker = handLandmarker;
            
            if (navigator.mediaDevices?.getUserMedia && videoRef.current) {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                videoRef.current.srcObject = stream;
                // Explicitly play to ensure frame availability
                videoRef.current.play().then(() => {
                    onLoadComplete();
                }).catch(e => {
                    console.error("Video play error", e);
                    onLoadComplete();
                });
            } else {
                onLoadComplete(); 
            }
        } catch (e) {
            console.error("Failed to load MediaPipe", e);
            onLoadComplete(); 
        }
    };
    initVision();

    // -- ANIMATION LOOP --
    let lastAiTime = 0;
    const animate = () => {
        if (!inst.current) return;
        const { composer, clock, particles, state, handLandmarker, mainGroup, sound, cursor, camera } = inst.current;
        
        inst.current.requestID = requestAnimationFrame(animate);

        const dt = clock.getDelta();
        const now = performance.now();

        // AI Processing
        if (now - lastAiTime > CONFIG.ai.detectInterval) {
            // Check video dimensions to ensure it's ready
            if (handLandmarker && videoRef.current && videoRef.current.videoWidth > 0 && videoRef.current.readyState >= 2) {
                const result = handLandmarker.detectForVideo(videoRef.current, now);
                if (result.landmarks && result.landmarks.length > 0) {
                    state.hand.detected = true;
                    const lm = result.landmarks[0];
                    // Map Hand: Invert X for mirroring feel
                    const newX = (0.5 - lm[9].x) * 2; 
                    const newY = (0.5 - lm[9].y) * 2;
                    
                    // Smooth tracking
                    state.hand.x = THREE.MathUtils.lerp(state.hand.x, newX, 0.5);
                    state.hand.y = THREE.MathUtils.lerp(state.hand.y, newY, 0.5);

                    const thumb = lm[4]; const index = lm[8]; const wrist = lm[0];
                    const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
                    
                    // Average fingertip distance from wrist (to detect open/closed hand)
                    const tips = [lm[8], lm[12], lm[16], lm[20]];
                    let avgDist = 0;
                    tips.forEach(t => avgDist += Math.hypot(t.x - wrist.x, t.y - wrist.y));
                    avgDist /= 4;

                    // Relaxed thresholds for better responsiveness
                    if (pinchDist < 0.05) {
                        // Pinch -> Focus Photo
                        if (state.mode !== 'FOCUS') {
                            state.mode = 'FOCUS';
                            const photos = particles.filter(p => p.type === 'PHOTO');
                            if (photos.length) {
                                state.focusTarget = photos[Math.floor(Math.random()*photos.length)].mesh;
                            }
                        }
                    } else if (avgDist < 0.3) { 
                        // Fist (Gather) -> Tree
                        state.mode = 'TREE';
                        state.focusTarget = null;
                    } else if (avgDist > 0.35) {
                        // Open Hand (Scatter) -> Scatter
                        state.mode = 'SCATTER';
                        state.focusTarget = null;
                    }
                } else {
                    state.hand.detected = false;
                }
            }
            lastAiTime = now;
        }

        // Logic
        if (state.hand.detected) {
            cursor.visible = true;
            const vec = new THREE.Vector3(state.hand.x, state.hand.y + 0.2, 0.5); 
            vec.unproject(camera);
            const dir = vec.sub(camera.position).normalize();
            const distance = 25; 
            const pos = camera.position.clone().add(dir.multiplyScalar(distance));
            cursor.position.copy(pos);
            cursor.lookAt(camera.position);
        } else {
            cursor.visible = false;
        }

        // --- MODE BEHAVIOR ---
        if (state.mode === 'FOCUS') {
            // Lock rotation and position to center for stable viewing
            state.targetRotation.x = 0;
            state.targetRotation.y = 0;
            state.targetPosition.x = 0;
            state.targetPosition.y = 0;
        } 
        else if (state.hand.detected) {
            // Hand is controlling
            if (state.mode === 'SCATTER') {
                state.targetRotation.x = state.hand.y * Math.PI * 0.25;
                state.targetRotation.y = state.hand.x * Math.PI * 0.5;
                state.targetPosition.x = state.hand.x * 6;
                state.targetPosition.y = state.hand.y * 6;
            } else {
                // TREE (Fist) - Pause rotation, center position
                state.targetPosition.x = 0;
                state.targetPosition.y = 0;
            }
        } 
        else {
            // No Hand Detected (Idle / Auto)
            state.targetPosition.x = 0;
            state.targetPosition.y = 0;
            
            if (state.mode === 'TREE') {
                state.targetRotation.x = 0;
                state.targetRotation.y += 0.3 * dt * PARAMS.rotationSpeed;
                state.currentRotation.y += 0.3 * dt * PARAMS.rotationSpeed;
            } else if (state.mode === 'SCATTER') {
                state.targetRotation.y += 0.1 * dt * PARAMS.rotationSpeed;
            }
        }

        // Smooth Rotation & Position
        state.currentRotation.x = THREE.MathUtils.lerp(state.currentRotation.x, state.targetRotation.x, 3 * dt);
        if (state.mode !== 'TREE') {
            // Allow quicker rotation response in SCATTER/FOCUS, but smoother for TREE
            state.currentRotation.y = THREE.MathUtils.lerp(state.currentRotation.y, state.targetRotation.y, 3 * dt);
        }
        mainGroup.rotation.y = state.currentRotation.y;
        mainGroup.rotation.x = state.currentRotation.x;
        
        // Position Interp
        state.currentPosition.x = THREE.MathUtils.lerp(state.currentPosition.x, state.targetPosition.x, 2 * dt);
        state.currentPosition.y = THREE.MathUtils.lerp(state.currentPosition.y, state.targetPosition.y, 2 * dt);
        mainGroup.position.x = state.currentPosition.x;
        mainGroup.position.y = state.currentPosition.y;

        // Dynamic Audio Pitching
        if(sound && sound.isPlaying) {
            let targetRate = 1.0;
            if(state.mode === 'SCATTER') targetRate = 1.1 + (Math.abs(state.hand.x)*0.2); 
            else if (state.mode === 'FOCUS') targetRate = 0.8; 
            sound.playbackRate = THREE.MathUtils.lerp(sound.playbackRate, targetRate, 2 * dt);
        }

        particles.forEach(p => p.update(dt, state.mode, state.focusTarget));
        composer.render();
    };
    animate();

    const handleResize = () => {
        if (!containerRef.current || !inst.current) return;
        const { camera, renderer, composer, bloomPass } = inst.current;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
        bloomPass.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);
        if (inst.current) {
            cancelAnimationFrame(inst.current.requestID);
            inst.current.gui.destroy();
            inst.current.renderer.dispose();
            if(inst.current.handLandmarker) inst.current.handLandmarker.close();
        }
    };
  }, []);

  return (
    <>
        <div ref={containerRef} className="absolute top-0 left-0 w-full h-full z-0" />
        {/* Important: Video must have dimensions (not hidden) to be detected by MediaPipe, but we can make it invisible via opacity */}
        <video ref={videoRef} className="absolute top-0 left-0 w-px h-px opacity-0 pointer-events-none" playsInline muted />
    </>
  );
});

// Particle Class
class Particle {
    mesh: THREE.Object3D;
    type: string;
    posTree: THREE.Vector3;
    posScatter: THREE.Vector3;
    baseScale: number;
    isSnow: boolean;
    spinSpeed: THREE.Vector3;
    fallSpeed: number = 0;
    swaySpeed: number = 0;
    swayOffset: number = 0;
    clock: THREE.Clock;

    constructor(mesh: THREE.Object3D, type: string, clock: THREE.Clock) {
        this.mesh = mesh;
        this.type = type;
        this.clock = clock;
        this.posTree = new THREE.Vector3();
        this.posScatter = new THREE.Vector3();
        this.baseScale = mesh.scale.x; 
        this.isSnow = (type === 'SNOW');
        this.spinSpeed = new THREE.Vector3();

        if(this.isSnow) {
            this.fallSpeed = 0.5 + Math.random() * 1.5;
            this.swaySpeed = Math.random() * 2;
            this.swayOffset = Math.random() * Math.PI;
            return; 
        }

        const speedMult = (type === 'PHOTO') ? 0.3 : 1.5;
        this.spinSpeed.set(
            (Math.random() - 0.5) * speedMult,
            (Math.random() - 0.5) * speedMult,
            (Math.random() - 0.5) * speedMult
        );
        this.calculatePositions();
    }

    calculatePositions() {
        const h = CONFIG.particles.treeHeight;
        const halfH = h / 2;
        let t = Math.random(); t = Math.pow(t, 0.8); 
        const y = (t * h) - halfH;
        let rMax = CONFIG.particles.treeRadius * (1.0 - t); if (rMax < 0.5) rMax = 0.5;
        const angle = t * 50 * Math.PI + Math.random() * Math.PI; 
        const r = rMax * (0.8 + Math.random() * 0.4); 
        this.posTree.set(Math.cos(angle) * r, y, Math.sin(angle) * r);

        let rScatter = (8 + Math.random()*12);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        this.posScatter.set(
            rScatter * Math.sin(phi) * Math.cos(theta),
            rScatter * Math.sin(phi) * Math.sin(theta),
            rScatter * Math.cos(phi)
        );
    }

    update(dt: number, mode: string, focusTargetMesh: THREE.Object3D | null) {
        if(this.isSnow) {
            if(!this.mesh.visible) return;
            this.mesh.position.y -= this.fallSpeed * dt * 5; 
            this.mesh.position.x += Math.sin(this.clock.elapsedTime * this.swaySpeed + this.swayOffset) * 0.05; 
            if(this.mesh.position.y < -20) {
                this.mesh.position.y = 25;
                this.mesh.position.x = (Math.random() - 0.5) * 40;
                this.mesh.position.z = (Math.random() - 0.5) * 40;
            }
            return;
        }

        let target = this.posTree;
        if (mode === 'SCATTER') target = this.posScatter;
        else if (mode === 'FOCUS') {
            if (this.mesh === focusTargetMesh) {
                // Fixed position relative to camera (Camera at z=50, y=2)
                // z=40 puts it 10 units in front of camera
                // y=2 puts it at eye level
                target = new THREE.Vector3(0, 2, 40);
            } else target = this.posScatter;
        }

        const lerpSpeed = (mode === 'FOCUS' && this.mesh === focusTargetMesh) ? 3.0 : 2.0; 
        this.mesh.position.lerp(target, lerpSpeed * dt);

        if (mode === 'SCATTER') {
            this.mesh.rotation.x += this.spinSpeed.x * dt;
            this.mesh.rotation.y += this.spinSpeed.y * dt;
            this.mesh.rotation.z += this.spinSpeed.z * dt;
        } else if (mode === 'TREE') {
            this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, 0, dt * 2);
            this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, dt * 2);
            this.mesh.rotation.y += 0.5 * dt; 
        } else if (mode === 'FOCUS' && this.mesh === focusTargetMesh) {
            // Slowly rotate the focused photo
             this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, 0, dt * 2);
             this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, dt * 2);
             this.mesh.rotation.y += 0.2 * dt;
        }
        
        // Scale
        let s = this.baseScale * PARAMS.particleSize; 
        if (mode === 'SCATTER' && this.type === 'PHOTO') s = this.baseScale * 2.5 * PARAMS.particleSize; 
        else if (mode === 'FOCUS') {
            if (this.mesh === focusTargetMesh) s = 3.5; // Reduced from 6.0
            else s = 0.01; 
        }
        this.mesh.scale.lerp(new THREE.Vector3(s,s,s), 4*dt);
    }
}