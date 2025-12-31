import { useState, useMemo, useRef, useEffect, Suspense, memo, forwardRef, useImperativeHandle } from 'react';
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { shaderMaterial, OrbitControls, PerspectiveCamera, Stars, Sparkles, Float } from '@react-three/drei';
import { MathUtils, Raycaster } from 'three';
import * as random from 'maath/random';
import { GestureRecognizer, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';

// --- Background Music Component ---
const BackgroundMusic = forwardRef(function BackgroundMusic(props: any, ref: any) {
  const { src = '/music1.mp3', fallbackUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' } = props || {};
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [_isPlaying, setIsPlaying] = useState(false);
  const [_muted, setMuted] = useState(true);
  const [_loadedSrc, setLoadedSrc] = useState('');
  const [_error, setError] = useState<string | null>(null);
  const lastObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    audio.muted = true; // start muted to satisfy autoplay
    audioRef.current = audio;

    const revokeLastObjectUrl = () => {
      if (lastObjectUrlRef.current) {
        try { URL.revokeObjectURL(lastObjectUrlRef.current); } catch (e) {}
        lastObjectUrlRef.current = null;
      }
    };

    const loadAsObjectUrl = async (url: string) => {
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const obj = URL.createObjectURL(blob);
        revokeLastObjectUrl();
        lastObjectUrlRef.current = obj;
        audio.src = obj;
        setLoadedSrc(url);
        return true;
      } catch (e) {
        return false;
      }
    };

    const tryPlay = async () => {
      try {
        await audio.play();
        if (!mounted) return true;
        console.log('[BackgroundMusic] started (muted:', audio.muted, ') from', audio.src);
        setIsPlaying(true);
        setMuted(audio.muted ?? true);
        setError(null);
        return true;
      } catch (e: any) {
        console.warn('[BackgroundMusic] play() failed', e?.message || e);
        return false;
      }
    };

    (async () => {
      // Try to fetch local source as blob (avoids CORS when served from same origin)
      const ok = await loadAsObjectUrl(src);
      if (ok) {
        await tryPlay();
        return;
      }

      // If local fetch failed, only attempt fallback if it can be fetched (CORS-safe)
      const fbOk = await loadAsObjectUrl(fallbackUrl);
      if (fbOk) {
        await tryPlay();
        return;
      }

      console.warn('[BackgroundMusic] no usable audio source found; ensure public/music.mp3 exists or provide a CORS-enabled fallback.');
      setError('No audio source available (check public/music.mp3)');
    })();

    return () => {
      mounted = false;
      try { audio.pause(); audio.src = ''; } catch (e) {}
      revokeLastObjectUrl();
      audioRef.current = null;
    };
  }, [src, fallbackUrl]);

  // expose imperative API to control playback (unmute/play)
  useImperativeHandle(ref, () => ({
    async unmute() {
      try {
        if (!audioRef.current) {
          const a = new Audio();
          a.loop = true; a.preload = 'auto'; a.crossOrigin = 'anonymous';
          audioRef.current = a;
        }
        const audio = audioRef.current!;

        const fetchToObjectUrl = async (url: string) => {
          try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const blob = await resp.blob();
            const obj = URL.createObjectURL(blob);
            if (lastObjectUrlRef.current) {
              try { URL.revokeObjectURL(lastObjectUrlRef.current); } catch (e) {}
            }
            lastObjectUrlRef.current = obj;
            audio.src = obj;
            audio.load();
            return true;
          } catch (e) {
            return false;
          }
        };

        if (!audio.src || audio.src === '') {
          let ok = await fetchToObjectUrl(src).catch(() => false);
          if (!ok) ok = await fetchToObjectUrl(fallbackUrl).catch(() => false);
        }

        audio.muted = false;
        try {
          await audio.play();
          setMuted(false);
          setIsPlaying(true);
          console.log('[BackgroundMusic] unmuted via imperative call');
          return;
        } catch (playErr: any) {
          if (playErr && (playErr.name === 'NotSupportedError' || /no supported sources/i.test(String(playErr.message || '')))) {
            console.warn('[BackgroundMusic] unmute attempt blocked NotSupportedError - trying fallback source', playErr);
            try {
              audio.pause();
              audio.src = fallbackUrl;
              audio.load();
              await audio.play();
              setMuted(false);
              setIsPlaying(true);
              console.log('[BackgroundMusic] unmuted with fallback source');
              return;
            } catch (fallbackErr) {
              console.warn('[BackgroundMusic] fallback unmute failed', fallbackErr);
            }
          }
          console.warn('[BackgroundMusic] unmute attempt blocked', playErr);
        }
      } catch (e) {
        console.warn('[BackgroundMusic] unmute unexpected error', e);
      }
    }
  }), [src, fallbackUrl]);

  // Hidden component — playback handled automatically and via imperative unmute
  return null;
});

// Load ALL available photos - generate paths for photos 1-92 plus the special one
const MAX_PHOTO_NUMBER = 92;
const bodyPhotoPaths = [
  ...Array.from({ length: MAX_PHOTO_NUMBER }, (_, i) => `/photos/${i + 1}.jpg`),
  '/photos/427861847_305426262544486_5164544616489027935_n.jpg'
];

// --- 视觉配置 (New Year + Galaxy + Love Theme) ---
const CONFIG = {
  colors: {
    // New Year Colors - Celebration & Fireworks
    newYearGold: '#FFD700', // 新年金色
    newYearSilver: '#C0C0C0', // 新年银色
    fireworksRed: '#FF1744', // 烟花红
    fireworksBlue: '#00E5FF', // 烟花蓝
    fireworksGreen: '#00FF88', // 烟花绿
    celebration: '#FF6B00', // 庆祝橙
    
    // Galaxy Colors - Deep Space & Cosmic
    galaxyDeep: '#0A0A1A', // 深空黑
    galaxyNebula: '#1A0A2E', // 星云紫
    cosmicBlue: '#0F3460', // 宇宙蓝
    starWhite: '#FFFFFF', // 星光白
    stardust: '#E8E8FF', // 星尘
    
    // Love Colors - Romantic & Warm
    loveRose: '#FF69B4', // 玫瑰粉
    lovePink: '#FF1493', // 爱之粉
    loveCoral: '#FF6B9D', // 珊瑚粉
    warmGlow: '#FFB6C1', // 温暖光
    
    // Combined Theme Colors
    primary: '#FF69B4', // 主色：粉红（爱情）
    secondary: '#FF1493', // 次色：深粉（爱情）
    accent: '#9D4EDD', // 强调：紫色（银河）
    background: '#0A0A1A', // 背景：深空
    
    // Lights & Effects
    lights: [
      '#FFD700', '#FF6B00', '#FF1744', // New Year: Gold, Orange, Red
      '#FF69B4', '#FF1493', '#FF6B9D', // Love: Pink shades
      '#9D4EDD', '#6B46C1', '#4A90E2', // Galaxy: Purple, Blue
      '#00E5FF', '#00FF88', '#C0C0C0'  // Fireworks: Cyan, Green, Silver
    ],
    
    // Photo borders - New Year + Galaxy theme
    borders: [
      '#FFD700', '#FFA500', '#FF6B00', // Gold gradients
      '#9D4EDD', '#6B46C1', '#4A90E2', // Galaxy purples
      '#FF69B4', '#FF1493', '#FF6B9D', // Love pinks
      '#C0C0C0', '#E8E8FF' // Silver & stardust
    ],
    
    // Decorative elements
    loveColors: ['#FF69B4', '#FF1493', '#FF6B9D', '#FFB6C1', '#FFD700', '#FF6B00'],
    newYearColors: ['#FFD700', '#FFA500', '#FF6B00', '#FF1744', '#C0C0C0', '#00E5FF'],
    galaxyColors: ['#9D4EDD', '#6B46C1', '#4A90E2', '#0F3460', '#00E5FF', '#E8E8FF']
  },
  counts: {
    foliage: 20000,   // 星尘粒子数量 (增加更多银河效果)
    ornaments: 300,   // 照片数量 - 我们的回忆
    elements: 300,    // 装饰元素 (心形、星星、烟花、礼物)
    lights: 600,      // 彩灯数量 (新年+银河+爱情)
    fireworks: 150,   // 烟花粒子
    confetti: 200     // 彩纸粒子
  },
  tree: { height: 22, radius: 9 }, // 树体尺寸
  photos: {
    body: bodyPhotoPaths
  }
};

// --- Shader Material (Foliage - Stardust/Particles) ---
const FoliageMaterial = shaderMaterial(
  { uTime: 0, uColor: new THREE.Color(CONFIG.colors.loveRose), uProgress: 0 },
  `uniform float uTime; uniform float uProgress; attribute vec3 aTargetPos; attribute float aRandom;
  varying vec2 vUv; varying float vMix;
  float cubicInOut(float t) { return t < 0.5 ? 4.0 * t * t * t : 0.5 * pow(2.0 * t - 2.0, 3.0) + 1.0; }
  void main() {
    vUv = uv;
    vec3 noise = vec3(sin(uTime * 1.5 + position.x), cos(uTime + position.y), sin(uTime * 1.5 + position.z)) * 0.15;
    float t = cubicInOut(uProgress);
    vec3 finalPos = mix(position, aTargetPos + noise, t);
    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_PointSize = (60.0 * (1.0 + aRandom)) / -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
    vMix = t;
  }`,
  `uniform vec3 uColor; varying float vMix;
  void main() {
    float r = distance(gl_PointCoord, vec2(0.5)); if (r > 0.5) discard;
    vec3 finalColor = mix(uColor * 0.3, uColor * 1.2, vMix);
    gl_FragColor = vec4(finalColor, 1.0);
  }`
);
extend({ FoliageMaterial });

// --- Helper: Tree Shape ---
const getTreePosition = () => {
  const h = CONFIG.tree.height; const rBase = CONFIG.tree.radius;
  const y = (Math.random() * h) - (h / 2); const normalizedY = (y + (h/2)) / h;
  const currentRadius = rBase * (1 - normalizedY); const theta = Math.random() * Math.PI * 2;
  const r = Math.random() * currentRadius;
  return [r * Math.cos(theta), y, r * Math.sin(theta)];
};

// --- Helper: Galaxy Position (for stardust) ---
const getGalaxyPosition = () => {
  const arms = 3; // number of spiral arms
  const maxR = 35; // galaxy radius for stardust
  // radial distribution: more density near center
  const r = Math.pow(Math.random(), 0.6) * maxR;
  const arm = Math.floor(Math.random() * arms);
  const baseAngle = (arm / arms) * Math.PI * 2;
  const theta = baseAngle + r * 0.2 + (Math.random() - 0.5) * 0.8; // add noise
  const z = (Math.random() - 0.5) * 8 * (r / maxR); // slight thickness
  return [r * Math.cos(theta), z, r * Math.sin(theta)];
};

// --- Helper: Heart Position ---
const getHeartPosition = () => {
  // Parametric heart equation: https://mathworld.wolfram.com/HeartCurve.html
  const t = Math.random() * Math.PI * 2;
  const scale = 15 + Math.random() * 20; // Heart size
  
  // Heart parametric equations (simplified)
  const x = scale * 16 * Math.pow(Math.sin(t), 3);
  const y = scale * (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
  const z = (Math.random() - 0.5) * 5; // slight depth variation
  
  return [x * 0.05, y * 0.05, z];
};

// --- Helper: I LOVE YOU Text Position ---
// Creates positions to form "I LOVE YOU" text in 3D space
const getILoveYouPosition = (index: number, total: number) => {
  // Define letter patterns for "I LOVE YOU" (simplified block letters)
  // Each letter is represented as a grid of positions
  const letterHeight = 12;
  const letterSpacing = 12;
  const scale = 0.8;
  
  // Calculate which letter and position within that letter
  const letters = [
    // "I"
    [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [3.5, 0], [3.5, 1], [3.5, 2], [3.5, 10], [3.5, 11], [0, 11], [1, 11], [2, 11], [3, 11], [4, 11], [5, 11], [6, 11], [7, 11]],
    // " " (space between I and LOVE)
    [],
    // "L"
    [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10], [0, 11], [1, 11], [2, 11], [3, 11], [4, 11], [5, 11], [6, 11], [7, 11]],
    // "O"
    [[1, 2], [2, 1], [3, 1], [4, 1], [5, 1], [6, 2], [6, 3], [6, 4], [6, 5], [6, 6], [6, 7], [6, 8], [6, 9], [5, 10], [4, 10], [3, 10], [2, 10], [1, 9], [1, 8], [1, 7], [1, 6], [1, 5], [1, 4], [1, 3]],
    // "V"
    [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 6], [2, 7], [3, 8], [4, 9], [5, 10], [6, 11], [7, 10], [8, 9], [9, 8], [10, 7], [11, 6], [12, 5], [12, 4], [12, 3], [12, 2], [12, 1], [12, 0]],
    // "E"
    [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10], [0, 11], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [1, 11], [2, 11], [3, 11], [4, 11], [5, 11], [6, 11]],
    // " " (space between LOVE and YOU)
    [],
    // "Y"
    [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [3, 6], [4, 7], [5, 8], [6, 9], [6, 10], [6, 11], [7, 8], [8, 7], [9, 6], [10, 5], [10, 4], [10, 3], [10, 2], [10, 1], [10, 0]],
    // "O"
    [[1, 2], [2, 1], [3, 1], [4, 1], [5, 1], [6, 2], [6, 3], [6, 4], [6, 5], [6, 6], [6, 7], [6, 8], [6, 9], [5, 10], [4, 10], [3, 10], [2, 10], [1, 9], [1, 8], [1, 7], [1, 6], [1, 5], [1, 4], [1, 3]],
    // "U"
    [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10], [1, 11], [2, 11], [3, 11], [4, 11], [5, 11], [6, 11], [7, 10], [7, 9], [7, 8], [7, 7], [7, 6], [7, 5], [7, 4], [7, 3], [7, 2], [7, 1], [7, 0]]
  ];
  
  // Calculate which letter we're in based on index distribution
  const positionsPerLetter = Math.ceil(total / letters.reduce((sum, l) => sum + Math.max(l.length, 1), 0));
  let accumulatedPositions = 0;
  let currentLetterIndex = 0;
  let positionInLetter = index;
  
  for (let i = 0; i < letters.length; i++) {
    const letterPositions = Math.max(letters[i].length, 1) * positionsPerLetter;
    if (index < accumulatedPositions + letterPositions) {
      currentLetterIndex = i;
      positionInLetter = index - accumulatedPositions;
      break;
    }
    accumulatedPositions += letterPositions;
  }
  
  const letter = letters[currentLetterIndex];
  if (letter.length === 0) {
    // Space - return random position
    return [(Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 3];
  }
  
  // Calculate position within letter
  const positionInPattern = positionInLetter % letter.length;
  const patternPos = letter[positionInPattern];
  // Flip the X coordinate to fix the reversed text
  const baseX = -(currentLetterIndex * letterSpacing - (letters.length * letterSpacing) / 2);
  
  // Add some randomness for organic look
  const noiseX = (Math.random() - 0.5) * 0.5;
  const noiseY = (Math.random() - 0.5) * 0.5;
  const noiseZ = (Math.random() - 0.5) * 1.5;
  
  const x = (baseX - patternPos[0] * scale + noiseX) * 0.6;
  const y = (patternPos[1] * scale - letterHeight * scale / 2 + noiseY) * 0.6;
  const z = noiseZ;
  
  return [x, y, z];
};

// --- Component: Foliage ---
const Foliage = ({ state, theme, showILoveYou }: { state: 'CHAOS' | 'FORMED', theme: 'TREE' | 'GALAXY' | 'HEART', showILoveYou?: boolean }) => {
  const materialRef = useRef<any>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const targetPositionsRef = useRef<Float32Array | null>(null);
  
  const { positions, targetPositions, randoms } = useMemo(() => {
    const count = CONFIG.counts.foliage;
    const positions = new Float32Array(count * 3); 
    const targetPositions = new Float32Array(count * 3); 
    const randoms = new Float32Array(count);
    const spherePoints = random.inSphere(new Float32Array(count * 3), { radius: 25 }) as Float32Array;
    for (let i = 0; i < count; i++) {
      positions[i*3] = spherePoints[i*3]; 
      positions[i*3+1] = spherePoints[i*3+1]; 
      positions[i*3+2] = spherePoints[i*3+2];
      // Use appropriate position based on theme or I LOVE YOU
      let tx: number, ty: number, tz: number;
      if (showILoveYou) {
        [tx, ty, tz] = getILoveYouPosition(i, count);
      } else if (theme === 'GALAXY') {
        [tx, ty, tz] = getGalaxyPosition();
      } else if (theme === 'HEART') {
        [tx, ty, tz] = getHeartPosition();
      } else {
        [tx, ty, tz] = getTreePosition();
      }
      targetPositions[i*3] = tx; 
      targetPositions[i*3+1] = ty; 
      targetPositions[i*3+2] = tz;
      randoms[i] = Math.random();
    }
    targetPositionsRef.current = targetPositions;
    return { positions, targetPositions, randoms };
  }, [theme, showILoveYou]);
  
  // Update target positions when theme changes dynamically
  useEffect(() => {
    if (geometryRef.current && targetPositionsRef.current) {
      const count = CONFIG.counts.foliage;
      for (let i = 0; i < count; i++) {
        let tx: number, ty: number, tz: number;
        if (showILoveYou) {
          [tx, ty, tz] = getILoveYouPosition(i, count);
        } else if (theme === 'GALAXY') {
          [tx, ty, tz] = getGalaxyPosition();
        } else if (theme === 'HEART') {
          [tx, ty, tz] = getHeartPosition();
        } else {
          [tx, ty, tz] = getTreePosition();
        }
        targetPositionsRef.current[i*3] = tx;
        targetPositionsRef.current[i*3+1] = ty;
        targetPositionsRef.current[i*3+2] = tz;
      }
      const targetPosAttr = geometryRef.current.getAttribute('aTargetPos') as THREE.BufferAttribute;
      if (targetPosAttr) {
        targetPosAttr.needsUpdate = true;
      }
    }
  }, [theme, showILoveYou]);
  
  const targetColorRef = useRef(new THREE.Color(
    showILoveYou ? CONFIG.colors.loveRose :
    theme === 'GALAXY' ? CONFIG.colors.galaxyColors[0] : 
    theme === 'HEART' ? CONFIG.colors.loveRose : 
    CONFIG.colors.loveRose
  ));
  
  useEffect(() => {
    targetColorRef.current = new THREE.Color(
      showILoveYou ? CONFIG.colors.loveRose :
      theme === 'GALAXY' ? CONFIG.colors.galaxyColors[0] : 
      theme === 'HEART' ? CONFIG.colors.loveRose : 
      CONFIG.colors.loveRose
    );
  }, [theme, showILoveYou]);
  
  useFrame((rootState, delta) => {
    if (materialRef.current) {
      materialRef.current.uTime = rootState.clock.elapsedTime;
      const targetProgress = state === 'FORMED' ? 1 : 0;
      materialRef.current.uProgress = MathUtils.damp(materialRef.current.uProgress, targetProgress, 1.5, delta);
      // Update color based on theme - use galaxy purple when GALAXY theme
      materialRef.current.uColor.lerp(targetColorRef.current, delta * 2);
    }
  });
  return (
    <points>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aTargetPos" args={[targetPositions, 3]} />
        <bufferAttribute attach="attributes-aRandom" args={[randoms, 1]} />
      </bufferGeometry>
      {/* @ts-ignore */}
      <foliageMaterial ref={materialRef} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

// --- Component: Photo Ornaments (Double-Sided Polaroid) ---
const PhotoOrnaments = ({ state, onPhotoClick, zoomedPhotoIndex, cameraZoom, theme, showILoveYou }: { 
  state: 'CHAOS' | 'FORMED',
  onPhotoClick: (index: number) => void,
  zoomedPhotoIndex: number | null,
  cameraZoom: number,
  theme: 'TREE' | 'GALAXY' | 'HEART',
  showILoveYou?: boolean
}) => {
  // Load textures with error handling - skip failed photos (no placeholders)
  const [textures, setTextures] = useState<THREE.Texture[]>([]);
  const [texturesLoaded, setTexturesLoaded] = useState(false);
  
  useEffect(() => {
    let mounted = true;
    const loadedTexturesRef: THREE.Texture[] = [];
    
    const loadTextures = async () => {
      const loadedTextures: THREE.Texture[] = [];
      const failedIndices: number[] = []; // Track which indices failed
      
      // Load all photos
      for (let i = 0; i < CONFIG.photos.body.length; i++) {
        const path = CONFIG.photos.body[i];
        try {
          const loader = new THREE.TextureLoader();
          const texture = await new Promise<THREE.Texture>((resolve, reject) => {
            loader.load(
              path,
              (tex) => {
                // Check if texture loaded successfully (has valid image)
                if (tex.image && tex.image.width > 0 && tex.image.height > 0) {
                  tex.colorSpace = THREE.SRGBColorSpace;
                  console.log(`✅ Successfully loaded: ${path}`);
                  resolve(tex);
                } else {
                  console.warn(`⚠️ Invalid texture image for ${path}`);
                  reject(new Error('Invalid texture image'));
                }
              },
              undefined,
              (error) => {
                // Failed to load
                console.error(`❌ Failed to load ${path}:`, error);
                reject(error);
              }
            );
          });
          // Successfully loaded
          loadedTextures.push(texture);
          loadedTexturesRef.push(texture);
        } catch (error) {
          // Failed to load - mark this index as failed
          console.warn(`Failed to load ${path}, will use random photo instead`);
          failedIndices.push(i);
          // Add null placeholder that will be replaced with random photo
          loadedTextures.push(null as any);
        }
      }
      
      // Replace failed photos with random successfully loaded photos
      if (loadedTextures.length > 0 && failedIndices.length > 0) {
        const successfulTextures = loadedTextures.filter(tex => tex !== null);
        if (successfulTextures.length > 0) {
          failedIndices.forEach(failedIndex => {
            // Assign a random photo from successfully loaded ones
            const randomIndex = Math.floor(Math.random() * successfulTextures.length);
            loadedTextures[failedIndex] = successfulTextures[randomIndex];
            console.log(`Replaced failed photo at index ${failedIndex} with random photo`);
          });
        }
      }
      
      if (mounted) {
        // Filter out any remaining nulls (shouldn't happen, but safety check)
        const finalTextures = loadedTextures.filter(tex => tex !== null);
        setTextures(finalTextures);
        setTexturesLoaded(true);
        console.log(`Loaded ${finalTextures.length} photos (${CONFIG.photos.body.length - finalTextures.length} failed and replaced with random photos)`);
      }
    };
    
    loadTextures();
    
    return () => {
      mounted = false;
      // Cleanup textures
      loadedTexturesRef.forEach(tex => {
        if (tex && typeof tex.dispose === 'function') {
          tex.dispose();
        }
      });
    };
  }, []);
  
  // Use all textures (failed ones replaced with random photos)
  const validatedTextures = useMemo(() => {
    if (!texturesLoaded || textures.length === 0) {
      // Return empty array while loading
      return [];
    }
    // Return all textures (failed ones already replaced with random photos)
    return textures.filter(tex => tex && tex.image && tex.image.width > 0);
  }, [textures, texturesLoaded]);
  
  // Get camera at top level - hooks must be called at top level
  const { camera } = useThree();
  
  const count = CONFIG.counts.ornaments;
  const groupRef = useRef<THREE.Group>(null);
  const photoRefs = useRef<(THREE.Group | null)[]>([]);

  const borderGeometry = useMemo(() => new THREE.PlaneGeometry(1.2, 1.5), []);
  const photoGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  const data = useMemo(() => {
    const numTextures = validatedTextures.length;
    
    // Create a shuffled array of texture indices to ensure all photos appear evenly
    const textureIndices: number[] = [];
    if (numTextures > 0) {
      // Calculate how many times each photo should appear
      const timesPerPhoto = Math.ceil(count / numTextures);
      // Create array with each photo index repeated
      for (let i = 0; i < numTextures; i++) {
        for (let j = 0; j < timesPerPhoto; j++) {
          textureIndices.push(i);
        }
      }
      // Shuffle the array for random distribution
      for (let i = textureIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [textureIndices[i], textureIndices[j]] = [textureIndices[j], textureIndices[i]];
      }
      // Trim to exact count
      textureIndices.splice(count);
    }
    
    // If showILoveYou, arrange photos to form "I LOVE YOU" text
    if (showILoveYou) {
      return new Array(count).fill(0).map((_, i) => {
        const chaosPos = new THREE.Vector3((Math.random()-0.5)*120, (Math.random()-0.5)*120, (Math.random()-0.5)*120);
        const [tx, ty, tz] = getILoveYouPosition(i, count);
        const targetPos = new THREE.Vector3(tx, ty, tz);

        const isBig = Math.random() < 0.1;
        const baseScale = isBig ? 2.5 : 1.0 + Math.random() * 0.8;
        const weight = 0.6 + Math.random() * 0.9;
        const borderColor = CONFIG.colors.loveColors[Math.floor(Math.random() * CONFIG.colors.loveColors.length)];

        const rotationSpeed = { x: 0, y: 0, z: 0 };
        const chaosRotation = new THREE.Euler(0, 0, 0);

        let textureIndex = 0;
        if (numTextures > 0) textureIndex = textureIndices.length > 0 ? textureIndices[i] : (i % numTextures);

        return {
          chaosPos, targetPos, scale: baseScale, weight,
          textureIndex,
          borderColor,
          currentPos: chaosPos.clone(),
          chaosRotation,
          rotationSpeed,
          wobbleOffset: Math.random() * 10,
          wobbleSpeed: 0.2 + Math.random() * 0.3,
          zoomScale: 1,
          targetZoomScale: 1,
          isZoomed: false
        };
      });
    }
    
    // If theme is HEART, arrange photos in a heart formation
    if (theme === 'HEART') {
      return new Array(count).fill(0).map((_, i) => {
        const chaosPos = new THREE.Vector3((Math.random()-0.5)*120, (Math.random()-0.5)*120, (Math.random()-0.5)*120);
        const [tx, ty, tz] = getHeartPosition();
        const targetPos = new THREE.Vector3(tx, ty, tz);

        const isBig = Math.random() < 0.15;
        const baseScale = isBig ? 3.2 : 1.3 + Math.random() * 0.9;
        const weight = 0.7 + Math.random() * 1.0;
        const borderColor = CONFIG.colors.loveColors[Math.floor(Math.random() * CONFIG.colors.loveColors.length)];

        const rotationSpeed = { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5, z: (Math.random() - 0.5) * 0.5 };
        const chaosRotation = new THREE.Euler(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);

        let textureIndex = 0;
        if (numTextures > 0) textureIndex = textureIndices.length > 0 ? textureIndices[i] : (i % numTextures);

        return {
          chaosPos, targetPos, scale: baseScale, weight,
          textureIndex,
          borderColor,
          currentPos: chaosPos.clone(),
          chaosRotation,
          rotationSpeed,
          wobbleOffset: Math.random() * 10,
          wobbleSpeed: 0.3 + Math.random() * 0.4,
          zoomScale: 1,
          targetZoomScale: 1,
          isZoomed: false
        };
      });
    }
    
    // If theme is GALAXY, arrange photos in a spiral galaxy formation
    if (theme === 'GALAXY') {
      const arms = 3; // number of spiral arms
      const maxR = 40; // galaxy radius
      return new Array(count).fill(0).map((_, i) => {
        const chaosPos = new THREE.Vector3((Math.random()-0.5)*120, (Math.random()-0.5)*120, (Math.random()-0.5)*120);
        // radial distribution: more density near center
        const r = Math.pow(Math.random(), 0.7) * maxR;
        const arm = i % arms;
        const baseAngle = (arm / arms) * Math.PI * 2;
        const theta = baseAngle + r * 0.15 + (Math.random() - 0.5) * 0.6; // add noise
        const z = (Math.random() - 0.5) * 6 * (r / maxR); // slight thickness
        const targetPos = new THREE.Vector3(r * Math.cos(theta), z, r * Math.sin(theta));

        const isBig = Math.random() < 0.12;
        const baseScale = isBig ? 3.0 : 1.2 + Math.random() * 0.8;
        const weight = 0.6 + Math.random() * 0.8;
        const borderColor = CONFIG.colors.galaxyColors[Math.floor(Math.random() * CONFIG.colors.galaxyColors.length)];

        const rotationSpeed = { x: 0, y: 0.02 + Math.random() * 0.06, z: 0 };
        const chaosRotation = new THREE.Euler(0, Math.random()*Math.PI, 0);

        let textureIndex = 0;
        if (numTextures > 0) textureIndex = textureIndices.length > 0 ? textureIndices[i] : (i % numTextures);

        return {
          chaosPos, targetPos, scale: baseScale, weight,
          textureIndex,
          borderColor,
          currentPos: chaosPos.clone(),
          chaosRotation,
          rotationSpeed,
          wobbleOffset: Math.random() * 10,
          wobbleSpeed: 0.2 + Math.random() * 0.3,
          zoomScale: 1,
          targetZoomScale: 1,
          isZoomed: false
        };
      });
    }

    // Default TREE arrangement (original behavior)
    return new Array(count).fill(0).map((_, i) => {
      const chaosPos = new THREE.Vector3((Math.random()-0.5)*70, (Math.random()-0.5)*70, (Math.random()-0.5)*70);
      const h = CONFIG.tree.height; const y = (Math.random() * h) - (h / 2);
      const rBase = CONFIG.tree.radius;
      const currentRadius = (rBase * (1 - (y + (h/2)) / h)) + 0.5;
      const theta = Math.random() * Math.PI * 2;
      const targetPos = new THREE.Vector3(currentRadius * Math.cos(theta), y, currentRadius * Math.sin(theta));

      const isBig = Math.random() < 0.3;
      const baseScale = isBig ? 3.5 : 1.5 + Math.random() * 1.2;
      const weight = 0.8 + Math.random() * 1.2;
      const borderColor = CONFIG.colors.borders[Math.floor(Math.random() * CONFIG.colors.borders.length)];

      const rotationSpeed = { x: (Math.random() - 0.5) * 1.0, y: (Math.random() - 0.5) * 1.0, z: (Math.random() - 0.5) * 1.0 };
      const chaosRotation = new THREE.Euler(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);

      let textureIndex = 0;
      if (numTextures > 0) {
        textureIndex = textureIndices.length > 0 ? textureIndices[i] : (i % numTextures);
      }

      return {
        chaosPos, targetPos, scale: baseScale, weight,
        textureIndex,
        borderColor,
        currentPos: chaosPos.clone(),
        chaosRotation,
        rotationSpeed,
        wobbleOffset: Math.random() * 10,
        wobbleSpeed: 0.5 + Math.random() * 0.5,
        zoomScale: 1,
        targetZoomScale: 1,
        isZoomed: false
      };
    });
  }, [validatedTextures, count, theme, showILoveYou]);

  useFrame((stateObj, delta) => {
    if (!groupRef.current) return;
    const isFormed = state === 'FORMED';
    const time = stateObj.clock.elapsedTime;

    groupRef.current.children.forEach((group, i) => {
      const objData = data[i];
      const isZoomed = zoomedPhotoIndex === i;
      
      // Handle zoom - center photo perfectly in camera view with specific screen size
      if (isZoomed && camera) {
        // Get camera zoom from gestures (cameraZoom ranges from -1 to 1)
        // Positive = zoom in, Negative = zoom out
        // Much wider zoom range: from 0.05x (very zoomed out) to 3.0x (very zoomed in)
        // Formula: maps cameraZoom (-1 to 1) to zoom factor (0.05 to 3.0), centered at 1.0
        const minZoom = 0.05; // Maximum zoom out (5% of original size - very zoomed out)
        const maxZoom = 3.0; // Maximum zoom in (300% of original size - very zoomed in)
        const baseZoom = 1.0; // Normal size when cameraZoom = 0
        // Linear interpolation: -1 -> minZoom, 0 -> baseZoom, 1 -> maxZoom
        const gestureZoomFactor = cameraZoom < 0 
          ? baseZoom + (baseZoom - minZoom) * cameraZoom  // Zoom out: 1.0 to 0.05
          : baseZoom + (maxZoom - baseZoom) * cameraZoom; // Zoom in: 1.0 to 3.0
        
        // Calculate zoom scale to make photo smaller base size: 50% height and 30% width of screen
        const baseZoomDistance = 20; // Base distance from camera
        const zoomDistance = baseZoomDistance / gestureZoomFactor; // Adjust distance based on gesture zoom
        const cameraPos = camera.position.clone();
        const cameraForward = new THREE.Vector3(0, 0, -1);
        cameraForward.applyQuaternion(camera.quaternion);
        
        // Calculate visible screen dimensions at zoom distance
        const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
        const aspect = (camera as THREE.PerspectiveCamera).aspect;
        const visibleHeight = 2 * Math.tan(fov / 2) * zoomDistance;
        const visibleWidth = visibleHeight * aspect;
        
        // Actual photo content dimensions (1x1 square), border adds extra space
        const photoContentHeight = 1.0; // The actual photo is 1x1
        const photoContentWidth = 1.0;
        
        // Calculate scale to achieve smaller base size: 50% height and 30% width of screen
        const targetHeight = visibleHeight * 0.5; // 50% of screen height (reduced from 70%)
        const targetWidth = visibleWidth * 0.3;   // 30% of screen width (reduced from 40%)
        
        // Calculate scale needed for each dimension
        const scaleByHeight = targetHeight / photoContentHeight;
        const scaleByWidth = targetWidth / photoContentWidth;
        
        // Use the smaller scale to ensure the full photo fits within both constraints
        // Apply gesture zoom factor to allow zooming in/out
        const baseScale = Math.min(scaleByHeight, scaleByWidth);
        objData.targetZoomScale = baseScale * gestureZoomFactor;
        
        // Position photo directly in front of camera, centered on screen
        const zoomTarget = cameraPos.clone().add(cameraForward.multiplyScalar(zoomDistance));
        // Smoothly move photo to center position
        objData.currentPos.lerp(zoomTarget, delta * 4);
        // Make photo face camera directly
        group.lookAt(cameraPos);
      } else {
        objData.targetZoomScale = 1;
        const target = isFormed ? objData.targetPos : objData.chaosPos;
        objData.currentPos.lerp(target, delta * (isFormed ? 0.8 * objData.weight : 0.5));
      }

      objData.zoomScale = MathUtils.damp(objData.zoomScale, objData.targetZoomScale, 3, delta);
      group.position.copy(objData.currentPos);

      if (isFormed && !isZoomed) {
         const targetLookPos = new THREE.Vector3(group.position.x * 2, group.position.y + 0.5, group.position.z * 2);
         group.lookAt(targetLookPos);

         const wobbleX = Math.sin(time * objData.wobbleSpeed + objData.wobbleOffset) * 0.05;
         const wobbleZ = Math.cos(time * objData.wobbleSpeed * 0.8 + objData.wobbleOffset) * 0.05;
         group.rotation.x += wobbleX;
         group.rotation.z += wobbleZ;

      } else if (!isZoomed) {
         group.rotation.x += delta * objData.rotationSpeed.x;
         group.rotation.y += delta * objData.rotationSpeed.y;
         group.rotation.z += delta * objData.rotationSpeed.z;
      }
    });
  });

  // Handle photo clicks/touches with raycasting (mobile + desktop support)
  useEffect(() => {
    const handleInteraction = (event: MouseEvent | TouchEvent) => {
      if (!groupRef.current || !camera) return;
      
      // Prevent default to avoid scrolling on mobile
      event.preventDefault();
      
      // Get coordinates from mouse or touch
      let clientX: number, clientY: number;
      if (event instanceof TouchEvent) {
        if (event.touches.length === 0) return;
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      } else {
        clientX = event.clientX;
        clientY = event.clientY;
      }
      
      const mouse = new THREE.Vector2();
      mouse.x = (clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(clientY / window.innerHeight) * 2 + 1;

      const raycaster = new Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const intersects: (THREE.Intersection & { index: number })[] = [];
      groupRef.current.children.forEach((group, i) => {
        // Check both front and back photo meshes
        const frontGroup = group.children[0];
        const backGroup = group.children[1];
        
        if (frontGroup?.children[0]) {
          const mesh = frontGroup.children[0] as THREE.Mesh;
          const intersection = raycaster.intersectObject(mesh, false);
          if (intersection.length > 0) {
            intersects.push({ ...intersection[0], index: i });
          }
        }
        if (backGroup?.children[0]) {
          const mesh = backGroup.children[0] as THREE.Mesh;
          const intersection = raycaster.intersectObject(mesh, false);
          if (intersection.length > 0) {
            intersects.push({ ...intersection[0], index: i });
          }
        }
      });

      if (intersects.length > 0) {
        const closest = intersects.reduce((prev, curr) => 
          prev.distance < curr.distance ? prev : curr
        );
        const photoIndex = closest.index;
        const photoGroup = groupRef.current.children[photoIndex];
        if (photoGroup) {
          const finalIndex = photoIndex === zoomedPhotoIndex ? -1 : photoIndex;
          onPhotoClick(finalIndex);
        }
      }
    };

    // Add both mouse and touch event listeners
    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction, { passive: false });
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, [onPhotoClick, zoomedPhotoIndex, camera]);

  // Don't render if textures aren't loaded yet
  if (!texturesLoaded || validatedTextures.length === 0) {
    return null;
  }

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => {
        const isZoomed = zoomedPhotoIndex === i;
        const currentScale = obj.zoomScale * obj.scale;
        
        // Safety check: ensure texture index is valid
        const safeTextureIndex = Math.max(0, Math.min(obj.textureIndex, validatedTextures.length - 1));
        const texture = validatedTextures[safeTextureIndex];
        
        // Skip if texture is invalid
        if (!texture || !texture.image) {
          return null;
        }
        
        return (
        <group 
          key={i} 
          ref={(el) => { photoRefs.current[i] = el; }}
          scale={[currentScale, currentScale, currentScale]} 
          rotation={state === 'CHAOS' && !isZoomed ? obj.chaosRotation : [0,0,0]}
        >
          {/* 正面 */}
          <group position={[0, 0, 0.015]}>
            <mesh geometry={photoGeometry}>
              <meshStandardMaterial
                map={texture}
                roughness={0.4} 
                metalness={0.0}
                emissive={showILoveYou ? CONFIG.colors.loveRose : theme === 'GALAXY' ? CONFIG.colors.galaxyColors[0] : theme === 'HEART' ? CONFIG.colors.loveRose : CONFIG.colors.stardust} 
                emissiveMap={texture} 
                emissiveIntensity={0.8}
                side={THREE.FrontSide}
                toneMapped={true}
              />
            </mesh>
            <mesh geometry={borderGeometry} position={[0, -0.15, -0.01]}>
              <meshStandardMaterial 
                color={obj.borderColor} 
                roughness={0.8} 
                metalness={0.0}
                emissive={showILoveYou ? obj.borderColor : theme === 'GALAXY' ? obj.borderColor : theme === 'HEART' ? obj.borderColor : CONFIG.colors.loveRose}
                emissiveIntensity={0.15}
                side={THREE.FrontSide} 
              />
            </mesh>
          </group>
          {/* 背面 */}
          <group position={[0, 0, -0.015]} rotation={[0, Math.PI, 0]}>
            <mesh geometry={photoGeometry}>
              <meshStandardMaterial
                map={texture}
                roughness={0.4} 
                metalness={0.0}
                emissive={showILoveYou ? CONFIG.colors.loveRose : theme === 'GALAXY' ? CONFIG.colors.galaxyColors[0] : theme === 'HEART' ? CONFIG.colors.loveRose : CONFIG.colors.stardust} 
                emissiveMap={texture} 
                emissiveIntensity={0.8}
                side={THREE.FrontSide}
                toneMapped={true}
              />
            </mesh>
            <mesh geometry={borderGeometry} position={[0, -0.15, -0.01]}>
              <meshStandardMaterial 
                color={obj.borderColor} 
                roughness={0.8} 
                metalness={0.0}
                emissive={showILoveYou ? obj.borderColor : theme === 'GALAXY' ? obj.borderColor : theme === 'HEART' ? obj.borderColor : CONFIG.colors.loveRose}
                emissiveIntensity={0.15}
                side={THREE.FrontSide} 
              />
            </mesh>
          </group>
        </group>
        );
      })}
    </group>
  );
};

// --- Helper: Create Heart Shape ---
const createHeartShape = () => {
  const shape = new THREE.Shape();
  const x = 0, y = 0;
  shape.moveTo(x, y + 0.25);
  shape.bezierCurveTo(x, y, x - 0.25, y - 0.25, x - 0.25, y - 0.5);
  shape.bezierCurveTo(x - 0.25, y - 0.75, x, y - 0.75, x, y - 0.5);
  shape.bezierCurveTo(x, y - 0.75, x + 0.25, y - 0.75, x + 0.25, y - 0.5);
  shape.bezierCurveTo(x + 0.25, y - 0.25, x, y, x, y + 0.25);
  return shape;
};

// --- Component: Love Elements (Hearts, Roses, Gifts) ---
const LoveElements = ({ state, theme, showILoveYou }: { state: 'CHAOS' | 'FORMED', theme: 'TREE' | 'GALAXY' | 'HEART', showILoveYou?: boolean }) => {
  const count = CONFIG.counts.elements;
  const groupRef = useRef<THREE.Group>(null);

  const boxGeometry = useMemo(() => new THREE.BoxGeometry(0.8, 0.8, 0.8), []);
  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(0.5, 16, 16), []);
  const heartGeometry = useMemo(() => {
    const shape = createHeartShape();
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.2,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 3,
    });
  }, []);
  // Star geometry for New Year theme
  const starGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const outerRadius = 0.5;
    const innerRadius = 0.25;
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI * 2) / 10;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.15,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
    });
  }, []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      const chaosPos = new THREE.Vector3((Math.random()-0.5)*60, (Math.random()-0.5)*60, (Math.random()-0.5)*60);
      
      // Use appropriate position based on theme or I LOVE YOU
      let targetPos: THREE.Vector3;
      if (showILoveYou) {
        const [tx, ty, tz] = getILoveYouPosition(i, count);
        targetPos = new THREE.Vector3(tx, ty, tz);
      } else if (theme === 'GALAXY') {
        const arms = 3;
        const maxR = 35;
        const r = Math.pow(Math.random(), 0.7) * maxR;
        const arm = Math.floor(Math.random() * arms);
        const baseAngle = (arm / arms) * Math.PI * 2;
        const theta = baseAngle + r * 0.2 + (Math.random() - 0.5) * 0.8;
        const z = (Math.random() - 0.5) * 8 * (r / maxR);
        targetPos = new THREE.Vector3(r * Math.cos(theta), z, r * Math.sin(theta));
      } else if (theme === 'HEART') {
        const [tx, ty, tz] = getHeartPosition();
        targetPos = new THREE.Vector3(tx, ty, tz);
      } else {
        const h = CONFIG.tree.height;
        const y = (Math.random() * h) - (h / 2);
        const rBase = CONFIG.tree.radius;
        const currentRadius = (rBase * (1 - (y + (h/2)) / h)) * 0.95;
        const theta = Math.random() * Math.PI * 2;
        targetPos = new THREE.Vector3(currentRadius * Math.cos(theta), y, currentRadius * Math.sin(theta));
      }

      // 4 types: Hearts (Love), Stars (New Year), Gifts (New Year), Orbs (Galaxy)
      const type = Math.floor(Math.random() * 4);
      let color; let scale = 1;
      // Use appropriate colors based on theme
      if (theme === 'GALAXY') {
        color = CONFIG.colors.galaxyColors[Math.floor(Math.random() * CONFIG.colors.galaxyColors.length)];
        scale = 0.6 + Math.random() * 0.5;
      } else if (theme === 'HEART') {
        color = CONFIG.colors.loveColors[Math.floor(Math.random() * CONFIG.colors.loveColors.length)];
        scale = 0.7 + Math.random() * 0.5;
      } else {
        if (type === 0) { 
          // Hearts - Love theme
          color = CONFIG.colors.loveColors[Math.floor(Math.random() * CONFIG.colors.loveColors.length)]; 
          scale = 0.8 + Math.random() * 0.4; 
        } else if (type === 1) { 
          // Stars - New Year theme
          color = CONFIG.colors.newYearColors[Math.floor(Math.random() * CONFIG.colors.newYearColors.length)]; 
          scale = 0.6 + Math.random() * 0.5; 
        } else if (type === 2) {
          // Gifts/Boxes - New Year theme
          color = CONFIG.colors.newYearColors[Math.floor(Math.random() * CONFIG.colors.newYearColors.length)]; 
          scale = 0.7 + Math.random() * 0.4; 
        } else { 
          // Orbs - Galaxy theme
          color = CONFIG.colors.galaxyColors[Math.floor(Math.random() * CONFIG.colors.galaxyColors.length)]; 
          scale = 0.6 + Math.random() * 0.4; 
        }
      }

      const rotationSpeed = { x: (Math.random()-0.5)*2.0, y: (Math.random()-0.5)*2.0, z: (Math.random()-0.5)*2.0 };
      return { type, chaosPos, targetPos, color, scale, currentPos: chaosPos.clone(), chaosRotation: new THREE.Euler(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI), rotationSpeed };
    });
  }, [boxGeometry, sphereGeometry, heartGeometry, starGeometry, theme, showILoveYou]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const isFormed = state === 'FORMED';
    groupRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const objData = data[i];
      const target = isFormed ? objData.targetPos : objData.chaosPos;
      objData.currentPos.lerp(target, delta * 1.5);
      mesh.position.copy(objData.currentPos);
      mesh.rotation.x += delta * objData.rotationSpeed.x; mesh.rotation.y += delta * objData.rotationSpeed.y; mesh.rotation.z += delta * objData.rotationSpeed.z;
    });
  });

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => {
        let geometry; 
        if (obj.type === 0) geometry = heartGeometry; // Hearts - Love
        else if (obj.type === 1) geometry = starGeometry; // Stars - New Year
        else if (obj.type === 2) geometry = boxGeometry; // Gift boxes - New Year
        else geometry = sphereGeometry; // Orbs - Galaxy
        return ( <mesh key={i} scale={[obj.scale, obj.scale, obj.scale]} geometry={geometry} rotation={obj.chaosRotation}>
          <meshStandardMaterial 
            color={obj.color} 
            roughness={0.2} 
            metalness={0.6} 
            emissive={obj.color} 
            emissiveIntensity={0.5}
            toneMapped={false}
          />
        </mesh> )})}
    </group>
  );
};

// --- Component: Fireworks (New Year Theme) ---
const Fireworks = ({ state }: { state: 'CHAOS' | 'FORMED' }) => {
  const count = CONFIG.counts.fireworks;
  const groupRef = useRef<THREE.Group>(null);
  const geometry = useMemo(() => new THREE.SphereGeometry(0.3, 8, 8), []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map(() => {
      // Fireworks burst from random positions in the sky
      const burstX = (Math.random() - 0.5) * 100;
      const burstY = Math.random() * 40 + 20; // Upper sky area
      const burstZ = (Math.random() - 0.5) * 100;
      const burstPos = new THREE.Vector3(burstX, burstY, burstZ);
      
      // Particles spread out from burst point
      const angle = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.5) * Math.PI;
      const speed = 0.5 + Math.random() * 1.5;
      const direction = new THREE.Vector3(
        Math.cos(elevation) * Math.cos(angle),
        Math.sin(elevation),
        Math.cos(elevation) * Math.sin(angle)
      );
      
      const color = CONFIG.colors.newYearColors[Math.floor(Math.random() * CONFIG.colors.newYearColors.length)];
      const lifetime = 2 + Math.random() * 3;
      
      return {
        burstPos,
        direction,
        speed,
        color,
        lifetime,
        age: 0,
        currentPos: burstPos.clone(),
        velocity: direction.multiplyScalar(speed)
      };
    });
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    
    groupRef.current.children.forEach((child, i) => {
      const objData = data[i];
      const mesh = child as THREE.Mesh;
      
      if (state === 'FORMED') {
        // Update particle position
        objData.currentPos.add(objData.velocity.clone().multiplyScalar(delta));
        objData.age += delta;
        
        // Reset particle when it expires
        if (objData.age > objData.lifetime) {
          objData.age = 0;
          objData.currentPos.copy(objData.burstPos);
          // New random direction
          const angle = Math.random() * Math.PI * 2;
          const elevation = (Math.random() - 0.5) * Math.PI;
          objData.velocity = new THREE.Vector3(
            Math.cos(elevation) * Math.cos(angle),
            Math.sin(elevation),
            Math.cos(elevation) * Math.sin(angle)
          ).multiplyScalar(objData.speed);
        }
        
        mesh.position.copy(objData.currentPos);
        
        // Fade out as particle ages
        const fade = 1 - (objData.age / objData.lifetime);
        if (mesh.material) {
          (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = fade * 3;
          mesh.scale.setScalar(0.3 + fade * 0.5);
        }
      } else {
        mesh.position.copy(objData.burstPos);
        if (mesh.material) {
          (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
        }
      }
    });
  });

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => (
        <mesh key={i} geometry={geometry}>
          <meshStandardMaterial 
            color={obj.color} 
            emissive={obj.color} 
            emissiveIntensity={0} 
            toneMapped={false} 
          />
        </mesh>
      ))}
    </group>
  );
};

// --- Component: Fairy Lights ---
const FairyLights = ({ state, theme, showILoveYou }: { state: 'CHAOS' | 'FORMED', theme: 'TREE' | 'GALAXY' | 'HEART', showILoveYou?: boolean }) => {
  const count = CONFIG.counts.lights;
  const groupRef = useRef<THREE.Group>(null);
  const geometry = useMemo(() => new THREE.SphereGeometry(0.8, 8, 8), []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      const chaosPos = new THREE.Vector3((Math.random()-0.5)*60, (Math.random()-0.5)*60, (Math.random()-0.5)*60);
      
      // Use appropriate position based on theme or I LOVE YOU
      let targetPos: THREE.Vector3;
      if (showILoveYou) {
        const [tx, ty, tz] = getILoveYouPosition(i, count);
        targetPos = new THREE.Vector3(tx, ty, tz);
      } else if (theme === 'GALAXY') {
        const arms = 3;
        const maxR = 38;
        const r = Math.pow(Math.random(), 0.7) * maxR;
        const arm = Math.floor(Math.random() * arms);
        const baseAngle = (arm / arms) * Math.PI * 2;
        const theta = baseAngle + r * 0.18 + (Math.random() - 0.5) * 0.7;
        const z = (Math.random() - 0.5) * 7 * (r / maxR);
        targetPos = new THREE.Vector3(r * Math.cos(theta), z, r * Math.sin(theta));
      } else if (theme === 'HEART') {
        const [tx, ty, tz] = getHeartPosition();
        targetPos = new THREE.Vector3(tx, ty, tz);
      } else {
        const h = CONFIG.tree.height; 
        const y = (Math.random() * h) - (h / 2); 
        const rBase = CONFIG.tree.radius;
        const currentRadius = (rBase * (1 - (y + (h/2)) / h)) + 0.3; 
        const theta = Math.random() * Math.PI * 2;
        targetPos = new THREE.Vector3(currentRadius * Math.cos(theta), y, currentRadius * Math.sin(theta));
      }
      
      // Use appropriate colors based on theme or I LOVE YOU
      const color = showILoveYou
        ? CONFIG.colors.loveColors[Math.floor(Math.random() * CONFIG.colors.loveColors.length)]
        : theme === 'GALAXY' 
        ? CONFIG.colors.galaxyColors[Math.floor(Math.random() * CONFIG.colors.galaxyColors.length)]
        : theme === 'HEART'
        ? CONFIG.colors.loveColors[Math.floor(Math.random() * CONFIG.colors.loveColors.length)]
        : CONFIG.colors.lights[Math.floor(Math.random() * CONFIG.colors.lights.length)];
      const speed = 2 + Math.random() * 3;
      return { chaosPos, targetPos, color, speed, currentPos: chaosPos.clone(), timeOffset: Math.random() * 100 };
    });
  }, [theme, showILoveYou]);

  useFrame((stateObj, delta) => {
    if (!groupRef.current) return;
    const isFormed = state === 'FORMED';
    const time = stateObj.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const objData = data[i];
      const target = isFormed ? objData.targetPos : objData.chaosPos;
      objData.currentPos.lerp(target, delta * 2.0);
      const mesh = child as THREE.Mesh;
      mesh.position.copy(objData.currentPos);
      const intensity = (Math.sin(time * objData.speed + objData.timeOffset) + 1) / 2;
      if (mesh.material) { (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = isFormed ? 3 + intensity * 4 : 0; }
    });
  });

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => ( <mesh key={i} scale={[0.15, 0.15, 0.15]} geometry={geometry}>
          <meshStandardMaterial color={obj.color} emissive={obj.color} emissiveIntensity={0} toneMapped={false} />
        </mesh> ))}
    </group>
  );
};

// --- Component: Top Heart (Pure Gold 3D Heart for Love) ---
const TopHeart = ({ state }: { state: 'CHAOS' | 'FORMED' }) => {
  const groupRef = useRef<THREE.Group>(null);

  const heartShape = useMemo(() => {
    const shape = new THREE.Shape();
    const x = 0, y = 0;
    shape.moveTo(x, y + 0.25);
    shape.bezierCurveTo(x, y, x - 0.25, y - 0.25, x - 0.25, y - 0.5);
    shape.bezierCurveTo(x - 0.25, y - 0.75, x, y - 0.75, x, y - 0.5);
    shape.bezierCurveTo(x, y - 0.75, x + 0.25, y - 0.75, x + 0.25, y - 0.5);
    shape.bezierCurveTo(x + 0.25, y - 0.25, x, y, x, y + 0.25);
    return shape;
  }, []);

  const heartGeometry = useMemo(() => {
    return new THREE.ExtrudeGeometry(heartShape, {
      depth: 0.4,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.1,
      bevelSegments: 3,
    });
  }, [heartShape]);

  // 爱情粉和星云粉渐变材质 - 象征宇宙中的爱情
  const heartMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: CONFIG.colors.loveRose,
    emissive: CONFIG.colors.lovePink,
    emissiveIntensity: 2.0,
    roughness: 0.1,
    metalness: 1.0,
  }), []);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5;
      const targetScale = state === 'FORMED' ? 1 : 0;
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 3);
    }
  });

  return (
    <group ref={groupRef} position={[0, CONFIG.tree.height / 2 + 1.8, 0]}>
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.2}>
        <mesh geometry={heartGeometry} material={heartMaterial} />
      </Float>
    </group>
  );
};

// --- Main Scene Experience ---
const Experience = memo(({ 
  sceneState, 
  rotationSpeed, 
  cameraZoom, 
  onPhotoClick, 
  zoomedPhotoIndex,
  theme,
  showILoveYou
}: { 
  sceneState: 'CHAOS' | 'FORMED',
  rotationSpeed: number,
  cameraZoom: number,
  onPhotoClick: (index: number) => void,
  zoomedPhotoIndex: number | null,
  theme: 'TREE' | 'GALAXY' | 'HEART',
  showILoveYou?: boolean
}) => {
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  
  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.setAzimuthalAngle(controlsRef.current.getAzimuthalAngle() + rotationSpeed);
      controlsRef.current.update();
    }
    if (cameraRef.current) {
      // Apply camera zoom based on gesture
      const targetFov = 45 - cameraZoom * 20; // Zoom in when cameraZoom increases
      cameraRef.current.fov = MathUtils.damp(cameraRef.current.fov, targetFov, 3, 0.016);
      cameraRef.current.updateProjectionMatrix();
    }
  });

  return (
    <>
      <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 8, 60]} fov={45} near={0.1} far={500} />
      <OrbitControls 
        ref={controlsRef} 
        enablePan={false} 
        enableZoom={zoomedPhotoIndex === null} 
        enableRotate={zoomedPhotoIndex === null}
        minDistance={20} 
        maxDistance={300} 
        autoRotate={rotationSpeed === 0 && sceneState === 'FORMED' && zoomedPhotoIndex === null} 
        autoRotateSpeed={0.3} 
        maxPolarAngle={Math.PI / 1.7} 
      />

      <color attach="background" args={[
        theme === 'GALAXY' ? CONFIG.colors.galaxyDeep : 
        theme === 'HEART' ? CONFIG.colors.background : 
        CONFIG.colors.background
      ]} />
      <Stars radius={200} depth={100} count={12000} factor={8} saturation={0.7} fade speed={2} />
      {/* Environment disabled to reduce WebGL context usage */}
      {/* <Environment preset="night" background={false} /> */}

      {/* Enhanced lighting for New Year + Galaxy + Love theme */}
      <ambientLight intensity={0.4} color={theme === 'GALAXY' ? CONFIG.colors.galaxyNebula : CONFIG.colors.galaxyNebula} />
      <pointLight position={[30, 30, 30]} intensity={180} color={theme === 'GALAXY' ? CONFIG.colors.accent : CONFIG.colors.loveRose} />
      <pointLight position={[-30, 10, -30]} intensity={100} color={theme === 'GALAXY' ? CONFIG.colors.galaxyNebula : CONFIG.colors.lovePink} />
      <pointLight position={[0, -20, 10]} intensity={80} color={theme === 'GALAXY' ? CONFIG.colors.accent : CONFIG.colors.accent} />
      <pointLight position={[0, 40, 0]} intensity={120} color={theme === 'GALAXY' ? CONFIG.colors.accent : CONFIG.colors.loveRose} />
      <pointLight position={[20, 20, -20]} intensity={90} color={theme === 'GALAXY' ? CONFIG.colors.fireworksBlue : CONFIG.colors.fireworksBlue} />
      <pointLight position={[-20, 20, -20]} intensity={90} color={theme === 'GALAXY' ? CONFIG.colors.galaxyNebula : CONFIG.colors.fireworksGreen} />
      {/* Additional light focused on photo area for better visibility */}
      <pointLight position={[0, 0, 30]} intensity={180} color={theme === 'GALAXY' ? CONFIG.colors.galaxyColors[0] : CONFIG.colors.stardust} />
      {/* Extra light for zoomed photos */}
      {zoomedPhotoIndex !== null && (
        <pointLight position={[0, 0, 25]} intensity={120} color={theme === 'GALAXY' ? CONFIG.colors.galaxyColors[0] : CONFIG.colors.stardust} />
      )}

      <group position={[0, -6, 0]}>
        <Foliage state={sceneState} theme={theme} showILoveYou={showILoveYou} />
        <Suspense fallback={null}>
           <PhotoOrnaments state={sceneState} onPhotoClick={onPhotoClick} zoomedPhotoIndex={zoomedPhotoIndex} cameraZoom={cameraZoom} theme={theme} showILoveYou={showILoveYou} />
           <LoveElements state={sceneState} theme={theme} showILoveYou={showILoveYou} />
           <FairyLights state={sceneState} theme={theme} showILoveYou={showILoveYou} />
           <Fireworks state={sceneState} />
           <TopHeart state={sceneState} />
        </Suspense>
        {/* Multiple sparkle layers for richer New Year + Galaxy + Love effect */}
        <Sparkles count={1200} scale={90} size={14} speed={1.0} opacity={1.0} color={theme === 'GALAXY' ? CONFIG.colors.accent : theme === 'HEART' ? CONFIG.colors.loveRose : CONFIG.colors.loveRose} />
        <Sparkles count={900} scale={75} size={10} speed={1.4} opacity={0.7} color={theme === 'GALAXY' ? CONFIG.colors.galaxyColors[0] : theme === 'HEART' ? CONFIG.colors.lovePink : CONFIG.colors.lovePink} />
        <Sparkles count={700} scale={85} size={8} speed={0.7} opacity={0.6} color={theme === 'GALAXY' ? CONFIG.colors.galaxyColors[1] : theme === 'HEART' ? CONFIG.colors.loveCoral : CONFIG.colors.accent} />
        <Sparkles count={500} scale={70} size={6} speed={0.5} opacity={0.5} color={theme === 'GALAXY' ? CONFIG.colors.galaxyColors[2] : theme === 'HEART' ? CONFIG.colors.warmGlow : CONFIG.colors.fireworksBlue} />
      </group>

      <EffectComposer>
        <Bloom luminanceThreshold={0.8} luminanceSmoothing={0.1} intensity={1.5} radius={0.5} mipmapBlur />
        <Vignette eskil={false} offset={0.1} darkness={1.2} />
      </EffectComposer>
    </>
  );
});

// --- Gesture Controller ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GestureController = ({ onGesture, onMove, onZoom, onStatus, onTheme, onUnmute, onILoveYou, debugMode }: any) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastHandPositions = useRef<{ x: number, y: number, z: number }[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Use refs to store callbacks and prevent re-initialization
  const onGestureRef = useRef(onGesture);
  const onMoveRef = useRef(onMove);
  const onZoomRef = useRef(onZoom);
  const onStatusRef = useRef(onStatus);
  const onThemeRef = useRef(onTheme);
  const onUnmuteRef = useRef(onUnmute);
  const onILoveYouRef = useRef(onILoveYou);
  const themeCandidateRef = useRef<'TREE' | 'GALAXY' | 'HEART' | null>(null);
  const themeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
  const requestRef = useRef<number | null>(null);
  const isSettingUpRef = useRef(false);

  // Update refs when callbacks change
  useEffect(() => {
    onGestureRef.current = onGesture;
    onMoveRef.current = onMove;
    onZoomRef.current = onZoom;
    onStatusRef.current = onStatus;
    onThemeRef.current = onTheme;
    onUnmuteRef.current = onUnmute;
    onILoveYouRef.current = onILoveYou;
  }, [onGesture, onMove, onZoom, onStatus, onUnmute, onILoveYou]);

  // Delay initialization to ensure Canvas renders first
  useEffect(() => {
    const initTimer = setTimeout(() => {
      setIsInitialized(true);
    }, 1000);
    return () => clearTimeout(initTimer);
  }, []);

  useEffect(() => {
    if (!isInitialized || isSettingUpRef.current) return;
    
    isSettingUpRef.current = true;

    const predictWebcam = () => {
      if (gestureRecognizerRef.current && videoRef.current && canvasRef.current) {
        if (videoRef.current.videoWidth > 0) {
            const results = gestureRecognizerRef.current.recognizeForVideo(videoRef.current, Date.now());
            const ctx = canvasRef.current.getContext("2d");
            if (ctx && debugMode) {
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                canvasRef.current.width = videoRef.current.videoWidth; canvasRef.current.height = videoRef.current.videoHeight;
                if (results.landmarks) for (const landmarks of results.landmarks) {
                        const drawingUtils = new DrawingUtils(ctx);
                        drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, { color: "#FF69B4", lineWidth: 2 });
                        drawingUtils.drawLandmarks(landmarks, { color: "#FF1493", lineWidth: 1 });
                }
            } else if (ctx && !debugMode) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

            // Handle gestures and hand tracking
              if (results.gestures.length > 0) {
              const name = results.gestures[0][0].categoryName; 
              const score = results.gestures[0][0].score;
              
              if (score > 0.4) {
                if (name === "Open_Palm") {
                 onGestureRef.current("CHAOS");
                 // trigger unmute when user opens hand
                 try { onUnmuteRef.current && onUnmuteRef.current(); } catch (e) { console.warn('onUnmute handler failed', e); }
                }
                 if (name === "Closed_Fist") onGestureRef.current("FORMED");
                 if (debugMode) onStatusRef.current(`DETECTED: ${name}`);
              }
            }

            // Handle hand position tracking for rotation
            if (results.landmarks.length > 0) {
              const landmarks = results.landmarks[0];
              const wrist = landmarks[0];
              
              // Horizontal movement for rotation
              const speed = (0.5 - wrist.x) * 0.15;
              onMoveRef.current(Math.abs(speed) > 0.01 ? speed : 0);

              // Store hand position
              lastHandPositions.current[0] = { x: wrist.x, y: wrist.y, z: wrist.z };

              // Detect "index finger only" (pointing with only index extended)
              try {
                const tip = (i: number) => landmarks[i];
                const isExtended = (tipIdx: number, pipIdx: number) => {
                  // In normalized coords, smaller y is higher. Check tip is notably above pip.
                  return tip(tipIdx).y + 0.02 < landmarks[pipIdx].y;
                };
                const indexExtended = isExtended(8, 6);
                const middleExtended = isExtended(12, 10);
                const ringExtended = isExtended(16, 14);
                const pinkyExtended = isExtended(20, 18);
                
                // Detect thumb extended (thumb tip 4, thumb MCP 2)
                // Thumb is extended if tip is far from base (different x or y coordinate)
                const thumbTip = landmarks[4];
                const thumbMCP = landmarks[2];
                const thumbExtended = Math.abs(thumbTip.x - thumbMCP.x) > 0.08 || Math.abs(thumbTip.y - thumbMCP.y) > 0.08;

                // Detect "I Love You" sign: thumb + index + pinky extended, middle + ring folded
                const iLoveYouSign = thumbExtended && indexExtended && pinkyExtended && !middleExtended && !ringExtended;

                // Detect gestures:
                // "I Love You" (thumb + index + pinky extended, middle + ring folded) → Show "I LOVE YOU"
                // Victory (index + middle extended, others closed) → HEART
                // Pointing (only index extended) → GALAXY
                // Otherwise → TREE
                
                // Handle "I Love You" sign detection
                if (iLoveYouSign && onILoveYouRef.current) {
                  try {
                    onILoveYouRef.current(true);
                    if (debugMode) onStatusRef.current(`💕 I LOVE YOU SIGN DETECTED 💕`);
                  } catch (e) {
                    console.warn('onILoveYou handler failed', e);
                  }
                } else if (!iLoveYouSign && onILoveYouRef.current) {
                  try {
                    onILoveYouRef.current(false);
                  } catch (e) {
                    // Ignore
                  }
                }
                
                let detectedTheme: 'TREE' | 'GALAXY' | 'HEART' = 'TREE';
                if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
                  detectedTheme = 'HEART'; // Victory gesture
                } else if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
                  detectedTheme = 'GALAXY'; // Pointing gesture
                }
                
                // Debounce: only switch theme if detected consistently for 400ms
                if (themeCandidateRef.current !== detectedTheme) {
                  // reset existing timer
                  if (themeTimerRef.current) { clearTimeout(themeTimerRef.current); themeTimerRef.current = null; }
                  themeCandidateRef.current = detectedTheme;
                  themeTimerRef.current = setTimeout(() => {
                    if (onThemeRef.current) {
                      onThemeRef.current(detectedTheme);
                      // When pointing (GALAXY) or victory (HEART), also set state to FORMED to transform
                      if (detectedTheme === 'GALAXY' || detectedTheme === 'HEART') {
                        onGestureRef.current("FORMED");
                        if (debugMode) {
                          if (detectedTheme === 'GALAXY') {
                            onStatusRef.current(`✨ POINTING → GALAXY TRANSFORMATION ✨`);
                          } else if (detectedTheme === 'HEART') {
                            onStatusRef.current(`💖 VICTORY → HEART TRANSFORMATION 💖`);
                          }
                        }
                      }
                    }
                    if (debugMode && detectedTheme === 'TREE') {
                      onStatusRef.current(`THEME: ${detectedTheme}`);
                    }
                    themeTimerRef.current = null;
                  }, 400);
                }
              } catch (e) {
                // ignore detection errors
              }
            }

            // PRIMARY ZOOM METHOD: Two-hand distance - hands closer = zoom in, farther = zoom out
            if (results.landmarks.length === 2) {
              const hand1 = results.landmarks[0][0];
              const hand2 = results.landmarks[1][0];
              
              // Calculate distance between two hands
              const distance = Math.sqrt(
                Math.pow(hand1.x - hand2.x, 2) + 
                Math.pow(hand1.y - hand2.y, 2) + 
                Math.pow(hand1.z - hand2.z, 2)
              );
              
              // Continuous zoom based on hand distance
              // Closer hands (smaller distance) = zoom in (positive)
              // Farther hands (larger distance) = zoom out (negative)
              const maxDistance = 0.6;  // Hands far apart
              const neutralDistance = 0.3; // Neutral position
              
              // Normalize distance to -1 to 1 range
              let zoomValue = 0;
              if (distance < neutralDistance) {
                // Hands closer than neutral = zoom in
                zoomValue = 1 - (distance / neutralDistance); // 0 to 1
              } else {
                // Hands farther than neutral = zoom out
                zoomValue = -((distance - neutralDistance) / (maxDistance - neutralDistance)); // -1 to 0
              }
              
              // Clamp to valid range
              const clampedZoom = Math.max(-1.0, Math.min(1.0, zoomValue));
              onZoomRef.current(clampedZoom);
              
              if (debugMode) {
                onStatusRef.current(`TWO HANDS: Distance ${distance.toFixed(3)} → ZOOM ${clampedZoom > 0 ? 'IN' : 'OUT'} (${clampedZoom.toFixed(2)})`);
              }
            } else if (results.landmarks.length === 0) {
              // Reset zoom when no hands detected
              onMoveRef.current(0);
              onZoomRef.current(0);
              if (debugMode) onStatusRef.current("AI READY: NO HAND");
            } else if (results.landmarks.length === 1) {
              // Single hand - no zoom, just rotation
              onZoomRef.current(0);
            }
        }
        requestRef.current = requestAnimationFrame(predictWebcam);
      }
    };

    const setup = async () => {
      onStatusRef.current("DOWNLOADING AI...");
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
        gestureRecognizerRef.current = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "CPU" // Use CPU instead of GPU to reduce WebGL context conflicts
          },
          runningMode: "VIDEO",
          numHands: 2 // Enable two-hand detection for pinch zoom
        });
        onStatusRef.current("REQUESTING CAMERA...");
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              await videoRef.current.play();
              onStatusRef.current("AI READY: SHOW HAND");
              predictWebcam();
            }
          } catch (cameraErr: any) {
            onStatusRef.current(`CAMERA ERROR: ${cameraErr.message || 'Camera access failed'}`);
            console.error('Camera error:', cameraErr);
            isSettingUpRef.current = false;
          }
        } else {
            onStatusRef.current("ERROR: CAMERA NOT SUPPORTED");
            isSettingUpRef.current = false;
        }
      } catch (err: any) {
        onStatusRef.current(`ERROR: ${err.message || 'MODEL FAILED'}`);
        console.error('Gesture recognizer error:', err);
        isSettingUpRef.current = false;
      }
    };
    
    setup();
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      // Clear theme debounce timer if any
      if (themeTimerRef.current) { clearTimeout(themeTimerRef.current); themeTimerRef.current = null; }
      themeCandidateRef.current = null;
      // Close gesture recognizer if it exists
      if (gestureRecognizerRef.current) {
        try {
          gestureRecognizerRef.current.close();
        } catch (e) {
          // Ignore errors during cleanup
        }
        gestureRecognizerRef.current = null;
      }
      isSettingUpRef.current = false;
    };
  }, [isInitialized, debugMode]);

  return (
    <>
      <video 
        ref={videoRef} 
        style={{ 
          opacity: debugMode ? 0.6 : 0, 
          position: 'fixed', 
          top: 0, 
          right: 0, 
          width: debugMode ? '320px' : '1px', 
          height: debugMode ? '240px' : '1px',
          zIndex: debugMode ? 100 : -1, 
          pointerEvents: 'none', 
          transform: 'scaleX(-1)',
          display: debugMode ? 'block' : 'none'
        }} 
        playsInline 
        muted 
        autoPlay 
      />
      <canvas 
        ref={canvasRef} 
        style={{ 
          position: 'fixed', 
          top: 0, 
          right: 0, 
          width: debugMode ? '320px' : '1px', 
          height: debugMode ? '240px' : '1px', 
          zIndex: debugMode ? 101 : -1, 
          pointerEvents: 'none', 
          transform: 'scaleX(-1)',
          display: debugMode ? 'block' : 'none'
        }} 
      />
    </>
  );
};

// --- App Entry ---
export default function GrandTreeApp() {
  const [sceneState, setSceneState] = useState<'CHAOS' | 'FORMED'>('FORMED');
  const [theme, setTheme] = useState<'TREE' | 'GALAXY' | 'HEART'>('TREE');
  const [rotationSpeed, setRotationSpeed] = useState(0);
  const [cameraZoom, setCameraZoom] = useState(0);
  const [zoomedPhotoIndex, setZoomedPhotoIndex] = useState<number | null>(null);
  const [aiStatus, setAiStatus] = useState("LOADING...");
  const [debugMode, setDebugMode] = useState(false);
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [showGestureGuide, setShowGestureGuide] = useState(false);
  const [showILoveYou, setShowILoveYou] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Track window size for responsive design
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePhotoClick = (index: number) => {
    if (index === -1) {
      // Clicking zoomed photo = zoom out
      setZoomedPhotoIndex(null);
    } else {
      // Clicking a photo = zoom in
      setZoomedPhotoIndex(index);
    }
  };

  const zoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const musicRef = useRef<{ unmute?: () => Promise<void> | void } | null>(null);
  
  const handleZoom = (zoomValue: number) => {
    // Clear existing timeout
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current);
    }
    
    // Clamp zoom value to valid range
    const clampedZoom = Math.max(-1, Math.min(1, zoomValue));
    setCameraZoom(clampedZoom);
    
    // Auto-reset zoom to neutral when hand is removed (value becomes 0)
    if (Math.abs(clampedZoom) < 0.05) {
      zoomTimeoutRef.current = setTimeout(() => {
        setCameraZoom(current => {
          let resetZoom = current;
          const resetInterval = setInterval(() => {
            resetZoom = MathUtils.damp(resetZoom, 0, 2, 0.016);
            setCameraZoom(resetZoom);
            if (Math.abs(resetZoom) < 0.01) {
              clearInterval(resetInterval);
              setCameraZoom(0);
            }
          }, 16);
          return resetZoom;
        });
      }, 500); // Longer delay before reset
    }
  };

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      backgroundColor: '#000', 
      position: 'relative', 
      overflow: 'hidden',
      touchAction: 'none',
      WebkitUserSelect: 'none',
      userSelect: 'none'
    }}>
      <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
        <Canvas 
          key="main-canvas"
          dpr={[1, 2]} 
          gl={{ 
            toneMapping: THREE.ReinhardToneMapping,
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
            preserveDrawingBuffer: false,
            stencil: false,
            depth: true
          }} 
          shadows={false}
          frameloop="always"
          onCreated={({ gl }) => {
            gl.setClearColor(CONFIG.colors.background, 1);
            // Prevent context loss
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              console.warn('WebGL context lost - attempting to restore...');
            });
            gl.domElement.addEventListener('webglcontextrestored', () => {
              console.log('WebGL context restored');
            });
            console.log('✅ Canvas initialized - New Year • Galaxy • Love Tree 2025 should be visible!');
          }}
        >
            <Experience 
              sceneState={sceneState} 
              rotationSpeed={rotationSpeed} 
              cameraZoom={cameraZoom}
              onPhotoClick={handlePhotoClick}
              zoomedPhotoIndex={zoomedPhotoIndex}
              theme={theme}
              showILoveYou={showILoveYou}
            />
        </Canvas>
      </div>
      {/* Background music player: tries to autoplay /music.mp3 and can be unmuted when gestures enabled */}
      <BackgroundMusic ref={musicRef} />
      {gestureEnabled && (
        <GestureController 
          onGesture={setSceneState} 
          onMove={setRotationSpeed} 
          onZoom={handleZoom}
          onStatus={setAiStatus} 
          onTheme={setTheme}
          onUnmute={() => { try { musicRef.current?.unmute && musicRef.current.unmute(); } catch (e) { console.warn('music unmute failed', e); } }}
          onILoveYou={setShowILoveYou}
          debugMode={debugMode} 
        />
      )}

      {/* UI - Stats - Mobile Responsive */}
      <div style={{ 
        position: 'absolute', 
        bottom: isMobile ? '20px' : '30px', 
        left: isMobile ? '20px' : '40px', 
        color: '#888', 
        zIndex: 10, 
        fontFamily: 'sans-serif', 
        userSelect: 'none' 
      }}>
        <div style={{ marginBottom: '15px' }}>
          <p style={{ fontSize: isMobile ? '8px' : '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px', color: CONFIG.colors.stardust }}>HAPPY NEW YEAR MY LOVE</p>
          <p style={{ fontSize: isMobile ? '18px' : '24px', color: CONFIG.colors.loveRose, fontWeight: 'bold', margin: 0, textShadow: `0 0 10px ${CONFIG.colors.loveRose}` }}>
            {CONFIG.counts.ornaments.toLocaleString()} <span style={{ fontSize: isMobile ? '8px' : '10px', color: '#888', fontWeight: 'normal' }}>MEMORIES</span>
          </p>
        </div>
        <div>
          <p style={{ fontSize: isMobile ? '8px' : '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px', color: CONFIG.colors.stardust }}>Galaxy Love Tree</p>
          <p style={{ fontSize: isMobile ? '18px' : '24px', color: CONFIG.colors.loveRose, fontWeight: 'bold', margin: 0, textShadow: `0 0 10px ${CONFIG.colors.loveRose}` }}>
            {(CONFIG.counts.foliage / 1000).toFixed(0)}K <span style={{ fontSize: isMobile ? '8px' : '10px', color: '#888', fontWeight: 'normal' }}>STARDUST</span>
          </p>
        </div>
      </div>

      {/* UI - Buttons - Mobile Responsive */}
      <div style={{ 
        position: 'absolute', 
        bottom: isMobile ? '20px' : '30px', 
        right: isMobile ? '20px' : '40px', 
        zIndex: 10, 
        display: 'flex', 
        gap: isMobile ? '8px' : '10px', 
        flexDirection: 'column' 
      }}>
        <button 
          onClick={() => {
            const newVal = !gestureEnabled;
            setGestureEnabled(newVal);
            if (newVal) {
              try { musicRef.current?.unmute && musicRef.current.unmute(); } catch (e) { console.warn('Music unmute failed', e); }
            }
          }}
          style={{ 
            padding: isMobile ? '10px 12px' : '12px 15px', 
            backgroundColor: gestureEnabled ? CONFIG.colors.loveRose : 'rgba(10, 10, 26, 0.8)', 
            border: `2px solid ${CONFIG.colors.loveRose}`, 
            color: gestureEnabled ? '#000' : CONFIG.colors.loveRose, 
            fontFamily: 'sans-serif', 
            fontSize: isMobile ? '10px' : '12px', 
            fontWeight: 'bold', 
            cursor: 'pointer', 
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            backdropFilter: 'blur(8px)', 
            boxShadow: gestureEnabled ? `0 0 20px ${CONFIG.colors.loveRose}` : 'none', 
            transition: 'all 0.3s' 
          }}
        >
           {gestureEnabled ? '🖐️ GESTURES ON' : '🖐️ ENABLE GESTURES'}
        </button>
        <button 
          onClick={() => setDebugMode(!debugMode)} 
          style={{ 
            padding: isMobile ? '10px 12px' : '12px 15px', 
            backgroundColor: debugMode ? CONFIG.colors.fireworksBlue : 'rgba(10, 10, 26, 0.8)', 
            border: `2px solid ${CONFIG.colors.fireworksBlue}`, 
            color: debugMode ? '#000' : CONFIG.colors.fireworksBlue, 
            fontFamily: 'sans-serif', 
            fontSize: isMobile ? '10px' : '12px', 
            fontWeight: 'bold', 
            cursor: 'pointer', 
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            backdropFilter: 'blur(8px)', 
            boxShadow: debugMode ? `0 0 15px ${CONFIG.colors.fireworksBlue}` : 'none', 
            transition: 'all 0.3s' 
          }}
        >
           {debugMode ? 'HIDE VISUALIZE' : '👁️ VISUALIZE'}
        </button>
      </div>

      {/* UI - AI Status - Mobile Responsive */}
      <div style={{ 
        position: 'absolute', 
        top: isMobile ? '15px' : '20px', 
        left: '50%', 
        transform: 'translateX(-50%)', 
        color: aiStatus.includes('ERROR') ? '#FF0000' : CONFIG.colors.loveRose, 
        fontSize: isMobile ? '8px' : '10px', 
        letterSpacing: '2px', 
        zIndex: 10, 
        background: 'rgba(10, 10, 26, 0.9)', 
        padding: isMobile ? '4px 8px' : '6px 12px', 
        borderRadius: '8px', 
        border: `2px solid ${CONFIG.colors.loveRose}`, 
        boxShadow: `0 0 15px ${CONFIG.colors.loveRose}40`,
        maxWidth: isMobile ? '90%' : 'auto'
      }}>
        {gestureEnabled ? aiStatus : 'GESTURES DISABLED'}
      </div>

      {/* UI - Title - Mobile Responsive */}
      {!showILoveYou && (
        <div style={{ 
          position: 'absolute', 
          top: isMobile ? '40px' : '50px', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          color: CONFIG.colors.loveRose, 
          fontSize: isMobile ? '14px' : '22px',
          letterSpacing: isMobile ? '2px' : '5px',
          zIndex: 10, 
          fontFamily: 'serif', 
          fontWeight: 'bold', 
          textShadow: `0 0 20px ${CONFIG.colors.loveRose}, 0 0 40px ${CONFIG.colors.lovePink}, 0 0 60px ${CONFIG.colors.accent}`, 
          textAlign: 'center',
          padding: isMobile ? '0 10px' : '0',
          maxWidth: isMobile ? '90%' : 'auto',
          transition: 'opacity 0.5s ease-in-out'
        }}>
          🎆 FROM 22 TO 25 & STILL COUNTING 🎆
        </div>
      )}

      {/* UI - I LOVE YOU Display - Mobile Responsive */}
      {showILoveYou && (
        <div className="iloveyou-text" style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          color: CONFIG.colors.loveRose, 
          fontSize: isMobile ? '32px' : '56px',
          letterSpacing: isMobile ? '4px' : '8px',
          zIndex: 20, 
          fontFamily: 'serif', 
          fontWeight: 'bold', 
          textShadow: `0 0 30px ${CONFIG.colors.loveRose}, 0 0 60px ${CONFIG.colors.lovePink}, 0 0 90px ${CONFIG.colors.accent}, 0 0 120px ${CONFIG.colors.loveRose}`, 
          textAlign: 'center',
          padding: isMobile ? '20px' : '40px',
          transition: 'opacity 0.5s ease-in-out'
        }}>
          💕 I LOVE YOU 💕
        </div>
      )}

      
      {/* UI - Gesture Guide - Hidden by default, can be toggled */}
      {showGestureGuide && !debugMode && (
        <div style={{ position: 'absolute', top: '100px', right: '40px', color: CONFIG.colors.stardust, fontSize: '11px', zIndex: 10, fontFamily: 'sans-serif', background: 'rgba(10, 10, 26, 0.9)', padding: '18px', borderRadius: '12px', maxWidth: '220px', border: `2px solid ${CONFIG.colors.loveRose}`, boxShadow: `0 0 20px ${CONFIG.colors.loveRose}40`, backdropFilter: 'blur(10px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <p style={{ margin: 0, color: CONFIG.colors.loveRose, fontWeight: 'bold', fontSize: '12px', textShadow: `0 0 8px ${CONFIG.colors.loveRose}` }}>✨ GESTURE CONTROLS ✨</p>
            <button onClick={() => setShowGestureGuide(false)} style={{ background: 'transparent', border: 'none', color: CONFIG.colors.loveRose, cursor: 'pointer', fontSize: '16px', padding: '0 5px' }}>×</button>
          </div>
          <p style={{ margin: '5px 0', color: CONFIG.colors.lovePink }}>🖐 Open Palm → Disperse</p>
          <p style={{ margin: '5px 0', color: CONFIG.colors.lovePink }}>✊ Fist → Assemble</p>
          <p style={{ margin: '5px 0', color: CONFIG.colors.accent }}>👆 Point (Index Finger) → Transform to Galaxy ✨</p>
          <p style={{ margin: '5px 0', color: CONFIG.colors.fireworksBlue }}>👋 Hand Left/Right → Rotate</p>
          <p style={{ margin: '5px 0', color: CONFIG.colors.loveRose }}>🤏 Hands Closer → Zoom In</p>
          <p style={{ margin: '5px 0', color: CONFIG.colors.loveRose }}>🤏 Hands Farther → Zoom Out</p>
          <p style={{ margin: '10px 0 0 0', color: CONFIG.colors.accent, fontSize: '10px', fontStyle: 'italic' }}>🖱️ Click Memory → View</p>
        </div>
      )}
      
      {/* Show button to toggle gesture guide when it's hidden and not in debug mode */}
      {!showGestureGuide && !debugMode && (
        <button 
          onClick={() => setShowGestureGuide(true)} 
          style={{ 
            position: 'absolute', 
            top: '100px', 
            right: '40px', 
            padding: '8px 12px', 
            backgroundColor: 'rgba(10, 10, 26, 0.8)', 
            border: `1px solid ${CONFIG.colors.loveRose}`, 
            color: CONFIG.colors.loveRose, 
            fontSize: '10px', 
            cursor: 'pointer', 
            borderRadius: '6px',
            zIndex: 10,
            fontFamily: 'sans-serif'
          }}
        >
          Show Controls
        </button>
      )}
    </div>
  );
}