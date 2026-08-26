//precision highp float;
precision highp sampler3D;

uniform sampler3D volume;

uniform float isoValue;
uniform vec3 isoColor;
uniform int compositeMode; // 0: MIP, 1: ISO
uniform vec3 lightPosition;

out vec4 FragColor;

in vec3 new_camera;
in vec3 new_fragPos;
in vec3 rayDirection;
in vec3 volumeDimensions;

vec2 intersect_box(vec3 start, vec3 direction, vec3 boundingBoxMin, vec3 boundingBoxMax){
    vec3 invDir = 1.0 / direction; // using inverse makes division cheaper

    // calculate the moment when a ray enters and exits the bounding box for each axis
    vec3 tmin_tmp = invDir * (boundingBoxMin - start);
    vec3 tmax_tmp = invDir * (boundingBoxMax - start);

    // find maximum entering moment and minimum exiting moment
    vec3 tmin = min(tmin_tmp, tmax_tmp);
    vec3 tmax = max(tmin_tmp, tmax_tmp);

    // find the first entering moment
    float t0 = max(max(tmin.x, tmin.y), tmin.z);
    // find the first exiting moment
    float t1 = min(min(tmax.x, tmax.y), tmax.z);

    return vec2(t0, t1);
}

vec3 computeGradient(vec3 pos, float epsilon){
    float dx = texture(volume, pos + vec3(epsilon, 0.0, 0.0)).r - texture(volume, pos - vec3(epsilon, 0.0, 0.0)).r;
    float dy = texture(volume, pos + vec3(0.0, epsilon, 0.0)).r - texture(volume, pos - vec3(0.0, epsilon, 0.0)).r;
    float dz = texture(volume, pos + vec3(0.0, 0.0, epsilon)).r - texture(volume, pos - vec3(0.0, 0.0, epsilon)).r;
    return vec3(dx, dy, dz) / (2.0 * epsilon);
}


void main() {
    vec3 rayDir = normalize(rayDirection);

    // find the intersection interval of the ray with the bounding box
    vec2 t_hit = intersect_box(new_camera, rayDir, vec3(0.0), vec3(1.0));
    if (t_hit.x > t_hit.y) {
        discard;
    }

    // clamp to near plane, if an intersection is behind the camera
    t_hit.x = max(t_hit.x, 0.0);

    // compute step size for ray marching
    vec3 dt = 1.0 / (abs(rayDir) * volumeDimensions);
    float stepSize = min(min(dt.x, dt.y), dt.z);
    vec3 rayStep = rayDir * stepSize;

    // compute the starting position of the ray
    vec3 rayStart = new_camera + rayDir * t_hit.x;
    vec3 rayPos = rayStart;

    // initialize color and alpha
    vec3 color = vec3(0.0);
    float alpha = 0.0;

    // for first hit compositing, previous float is used to store the previous alpha
    float previous = 0.0;

    // ray marching in between the bounding box
    for (float t = t_hit.x; t < t_hit.y; t += stepSize) {
        rayPos += rayStep;

        // density of the current sample along the ray
        float current = texture(volume, rayPos.xyz).r;

        // for MIP
        if (compositeMode == 0) {
            // find the maximum density (opacity) along the ray
            if (current > alpha) {
                alpha = current; // update opacity
                color = vec3(1.0); // just white
            }
        }
        // for ISO
        else if (compositeMode == 1) {
            // for every step, check if the iso value lies between the previous and current density. if yes, we interpolate between the two positions to find the exact position of the iso surface
            if (isoValue >= previous && isoValue <= current) {
                // linear interpolation
                float t = (isoValue - previous) / (current - previous);
                vec3 isoPos = mix(rayPos - rayStep, rayPos, t);

                // compute normal
                vec3 normal = normalize(computeGradient(isoPos, stepSize));
                vec3 lightDir = normalize(lightPosition - isoPos);
                float diff = max(dot(normal, lightDir), 0.0);

                // phong shading
                vec3 viewDir = normalize(-isoPos);
                vec3 reflectDir = reflect(-lightDir, normal);
                vec3 ambientColor = vec3(0.8);
                vec3 diffuseColor = vec3(0.5);
                vec3 specularColor = vec3(0.5);
                float ambientIntensity = 1.0;
                float shininess = 12.0;
                float spec = pow(max(dot(normal, lightDir), 0.0), shininess);

                vec3 ambient = ambientIntensity * ambientColor;
                vec3 diffuse = diffuseColor * diff * vec3(1.0);
                vec3 specular = specularColor * spec * vec3(1.0);
                color = (ambient + diffuse + specular) * isoColor;

                // compute color
                //color = vec3(1.0, 0.0, 0.0);
                alpha = 1.0;
                break;
            }
            previous = current;
        }
    }

    // test color with gradients
    //color = computeGradient(rayPos, stepSize) * 0.5 + 0.5;

    FragColor = vec4(color, alpha);
}