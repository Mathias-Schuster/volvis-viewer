uniform vec3 camera;
uniform vec3 scale;

out vec3 new_camera;
out vec3 new_fragPos;
out vec3 rayDirection;
out vec3 volumeDimensions;

void main() {
    volumeDimensions = scale;
    new_fragPos = position / scale +0.5; // +0.5 to center cube. divide to scale cube to box
    new_camera = camera / scale +0.5;
    rayDirection = new_fragPos - new_camera;

    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
}