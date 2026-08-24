import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useState } from 'react';

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
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} />
        
        <OrbitControls />

        <mesh>
          <boxGeometry args={[2, 2, 2]} />
          <meshStandardMaterial color="hotpink" />
        </mesh>
      </Canvas>
    </>
  );
}

export default App;