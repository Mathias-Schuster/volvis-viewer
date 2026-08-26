import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useEffect, useState, useMemo, useRef } from 'react';

import vertexShader from './shaders/raycast.vert?raw';
import fragmentShader from './shaders/raycast.frag?raw';

const VOL_WIDTH = 256;
const VOL_HEIGHT = 256;
const VOL_DEPTH = 256;

function VolumeMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  const [volumeTex, setVolumeTex] = useState<THREE.Data3DTexture | null>(null);

  useEffect(() => {
    async function fetchVolume() {
      try {
        const response = await fetch('http://localhost:8080/api/volume');
        const buffer = await response.arrayBuffer();

        console.log("Exact byte length of fetched volume data:", buffer.byteLength);  // should be 256x256x256 = 16 777.216

        const data = new Uint8Array(buffer);
        const tex = new THREE.Data3DTexture(data, VOL_WIDTH, VOL_HEIGHT, VOL_DEPTH);
        tex.format = THREE.RedFormat;
        tex.type = THREE.UnsignedByteType;
        tex.minFilter = tex.magFilter = THREE.LinearFilter;
        tex.unpackAlignment = 1;
        tex.needsUpdate = true;
        setVolumeTex(tex);
      }
      catch (error) {
        console.error('Error fetching volume data:', error);
      }
    }
    fetchVolume();
  }, []);

  const uniforms = useMemo(() => ({
    volume: { value: volumeTex },
    scale: { value: new THREE.Vector3(1, 1, 1) },
    camera: { value: new THREE.Vector3(0, 0, 5) },
    isoValue: { value: 0.2 },
    isoColor: { value: new THREE.Vector3(1.0, 1.0, 1.0) }, // Weiß
    compositeMode: { value: 1 }, // 1 = ISO, 0 = MIP
    lightPosition: { value: new THREE.Vector3(10, 10, 10) }
  }), [volumeTex]);

  useFrame((state) => {
    if (meshRef.current && meshRef.current.material) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      if (material.uniforms && material.uniforms.camera) {
        material.uniforms.camera.value.copy(state.camera.position);
      }
    }
  });

  if (!volumeTex) return null;

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

  useEffect(() => {
    fetch('http://localhost:8080/api/status')
      .then(response => response.text())
      .then(data => setServerMessage(data))
      .catch(error => setServerMessage(`Error: ${error.message}`));
  }, []);


  return (
    <>
      <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', zIndex: 1 }}>
        <h2>Server Status: {serverMessage}</h2>
      </div>
      
      <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
        <OrbitControls />
        <VolumeMesh />
      </Canvas>
    </>
  );
}

export default App;