import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useEffect, useState, useMemo, useRef } from 'react';

import vertexShader from './shaders/raycast.vert?raw';
import fragmentShader from './shaders/raycast.frag?raw';
import Histogram from './components/Histogram';

const VOL_WIDTH = 256;
const VOL_HEIGHT = 256;
const VOL_DEPTH = 256;

export interface ControlPoint {
  x: number;  // density (0.0 - 1.0)
  alpha: number;
  color: string;
}

interface VolumeMeshProps {
  volumeTex: THREE.Data3DTexture | null;
  isoValue: number;
  compositeMode: number;
  transferFunctionTex: THREE.CanvasTexture | null;
}

function VolumeMesh({ volumeTex, isoValue, compositeMode, transferFunctionTex }: VolumeMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(() => {
    if (!volumeTex || !transferFunctionTex) return null;
    return {
      volume: { value: volumeTex },
      transferFunction: { value: transferFunctionTex },
      scale: { value: new THREE.Vector3(1, 1, 1) },
      camera: { value: new THREE.Vector3(0, 0, 5) },
      isoValue: { value: isoValue },
      isoColor: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
      compositeMode: { value: compositeMode },
      lightPosition: { value: new THREE.Vector3(10, 10, 10) }
    };
  }, [volumeTex, transferFunctionTex, isoValue, compositeMode]);

  useEffect(() => {
    if (meshRef.current && meshRef.current.material) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      if (material.uniforms) {
        material.uniforms.isoValue.value = isoValue;
        material.uniforms.compositeMode.value = compositeMode;
      }
    }
  }, [isoValue, compositeMode]);

  useFrame((state) => {
    if (meshRef.current && meshRef.current.material) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      if (material.uniforms && material.uniforms.camera) {
        material.uniforms.camera.value.copy(state.camera.position);
      }
    }
  });

  if (!uniforms) return null;

  return (
    <mesh ref={meshRef} scale={[3, 3, 3]}>
      <boxGeometry args={[1, 1, 1]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        glslVersion={THREE.GLSL3} 
        transparent={true}
      />
    </mesh>
  );
}

function App() {
  const [serverMessage, setServerMessage] = useState<string>("Loading...");

  const [isoValue, setIsoValue] = useState<number>(0.2);
  const [controlPoints, setControlPoints] = useState<ControlPoint[]>([
    { x: 0.0, alpha: 0.0, color: '#000000' },
    { x: 0.15, alpha: 0.1, color: '#ff4444' },  // soft tissue
    { x: 0.6, alpha: 0.8, color: '#ffffff' },   // bone
    { x: 1.0, alpha: 0.8, color: '#ffffff' }
  ]);

  const [compositeMode, setCompositeMode] = useState<number>(1);

  const [rawData, setRawData] = useState<Uint8Array | null>(null);
  const [volumeTex, setVolumeTex] = useState<THREE.Data3DTexture | null>(null);

  const transferFunctionTex = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 256, 0);
      
      controlPoints.forEach(pt => {
        ctx.fillStyle = pt.color;
        ctx.fillRect(0,0,0,0); // trigger canvas parser
        
        // convert hex string to individual rgb values
        const hex = pt.color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        gradient.addColorStop(pt.x, `rgba(${r}, ${g}, ${b}, ${pt.alpha})`);
      });
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 256, 1);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    return texture;
  }, [controlPoints]);

  useEffect(() => {
    fetch('http://localhost:8080/api/status')
      .then(response => response.text())
      .then(data => setServerMessage(data))
      .catch(error => setServerMessage(`Error: ${error.message}`));
  }, []);

  useEffect(() => {
    async function fetchVolume() {
      try {
        const response = await fetch('http://localhost:8080/api/volume');
        const buffer = await response.arrayBuffer();
        const data = new Uint8Array(buffer);
        const tex = new THREE.Data3DTexture(data, VOL_WIDTH, VOL_HEIGHT, VOL_DEPTH);
        tex.format = THREE.RedFormat;
        tex.type = THREE.UnsignedByteType;
        tex.minFilter = tex.magFilter = THREE.LinearFilter;
        tex.unpackAlignment = 1;
        tex.needsUpdate = true;

        setRawData(data);
        setVolumeTex(tex);
      }
      catch (error) {
        console.error('Error fetching volume data:', error);
      }
    }
    fetchVolume();
  }, []);


  return (
    <>
      <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', zIndex: 1, background: 'rgba(0,0,0,0.6)', padding: '15px', borderRadius: '8px', minWidth: '200px' }}>
        <h3 style={{ margin: '0 0 10 px 0', fontSize: '16px' }}>VolVis Viewer</h3>
        <p style={{ margin: '0 0 15px 0', fontSize: '12px' }}>Server: {serverMessage}</p>
        
        {compositeMode === 1 && (
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
              Iso Value: {isoValue.toFixed(2)}
            </label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={isoValue} 
              onChange={(e) => setIsoValue(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        )}

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
            Render Mode:
          </label>
          <select 
            value={compositeMode} 
            onChange={(e) => setCompositeMode(parseInt(e.target.value))}
            style={{ width: '100%', padding: '5px' }}
          >
            <option value={2}>DVR (Transfer Function)</option>
            <option value={1}>ISO (Surface)</option>
            <option value={0}>MIP (X-Ray)</option>
          </select>
        </div>

        {rawData && (
          <Histogram 
            volumeData={rawData} 
            isoValue={isoValue} 
            setIsoValue={setIsoValue} 
            controlPoints={controlPoints}
            setControlPoints={setControlPoints}
            compositeMode={compositeMode}
          />
        )}
      </div>
      
      <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
        <OrbitControls />
        <VolumeMesh volumeTex={volumeTex} isoValue={isoValue} compositeMode={compositeMode} transferFunctionTex={transferFunctionTex} />
      </Canvas>
    </>
  );
}

export default App;