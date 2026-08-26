import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useEffect, useState, useMemo, useRef } from 'react';

import vertexShader from './shaders/raycast.vert?raw';
import fragmentShader from './shaders/raycast.frag?raw';

function VolumeMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  const dummyVolume = useMemo(() => {
    const size = 16;
    const data = new Float32Array(size * size * size);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random();
    }
    const tex = new THREE.Data3DTexture(data, size, size, size);
    tex.format = THREE.RedFormat;
    tex.type = THREE.FloatType;
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.unpackAlignment = 1;
    tex.needsUpdate = true;
    return tex;
  }, []);

  const uniforms = useMemo(() => ({
    volume: { value: dummyVolume },
    scale: { value: new THREE.Vector3(1, 1, 1) },
    camera: { value: new THREE.Vector3(0, 0, 5) },
    isoValue: { value: 0.5 },
    isoColor: { value: new THREE.Vector3(1.0, 1.0, 1.0) }, // Weiß
    compositeMode: { value: 1 }, // 1 = ISO, 0 = MIP
    lightPosition: { value: new THREE.Vector3(10, 10, 10) }
  }), [dummyVolume]);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.camera.value.copy(state.camera.position);
    }
  });

  return (
    <mesh ref={meshRef}>
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
      
      <Canvas camera={{ position: [0, 0, 2], fov: 75 }}>
        <OrbitControls />
        <VolumeMesh />
      </Canvas>
    </>
  );
}

export default App;