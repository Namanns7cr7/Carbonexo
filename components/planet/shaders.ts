/**
 * GLSL for the Living Earth.
 *
 * Lighting is computed in world space against a real sun direction (the
 * subsolar point for the current time), so the terminator on screen is where
 * it is on the planet right now. Textures are sRGB; three decodes them to
 * linear on sample and the colorspace chunk re-encodes on output.
 */

export const earthVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const earthFragment = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D waterMap;
  uniform vec3 sunDir;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vPosW);
    vec3 L = normalize(sunDir);
    float ndl = dot(N, L);

    // Soft terminator: civil twilight spans a few degrees of arc.
    float day = smoothstep(-0.14, 0.2, ndl);

    vec3 dayCol = texture2D(dayMap, vUv).rgb;
    vec3 nightCol = texture2D(nightMap, vUv).rgb;
    float water = texture2D(waterMap, vUv).r;

    vec3 lit = dayCol * (0.05 + 1.15 * max(ndl, 0.0));

    // Sun glint on open water only.
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 260.0) * water * 0.26 * day;

    vec3 nightSide = nightCol * 1.5 + dayCol * 0.012;

    // Atmospheric scattering approximation: a blue rim that is brighter on
    // the lit limb and reddens slightly through the terminator.
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    float dusk = smoothstep(-0.25, 0.0, ndl) * (1.0 - smoothstep(0.0, 0.35, ndl));
    vec3 rim = mix(vec3(0.28, 0.58, 1.0), vec3(1.0, 0.55, 0.3), dusk * 0.6) * fres * (0.18 + 0.82 * day);

    vec3 col = mix(nightSide, lit, day) + spec * vec3(1.0, 0.94, 0.82) + rim;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const cloudFragment = /* glsl */ `
  uniform sampler2D cloudMap;
  uniform vec3 sunDir;
  uniform float opacity;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;

  void main() {
    vec3 N = normalize(vNormalW);
    float ndl = dot(N, normalize(sunDir));
    float lit = smoothstep(-0.18, 0.3, ndl);
    float a = texture2D(cloudMap, vUv).r;
    vec3 col = vec3(1.0) * (0.04 + 0.96 * lit);
    gl_FragColor = vec4(col, a * opacity * (0.2 + 0.8 * lit));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const atmosphereVertex = /* glsl */ `
  varying vec3 vPosW;
  varying vec3 vNormalW;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const atmosphereFragment = /* glsl */ `
  uniform vec3 sunDir;
  varying vec3 vPosW;
  varying vec3 vNormalW;
  void main() {
    // Exact, perspective-correct limb glow. For the sight ray through this
    // fragment, b is its closest approach to the planet's centre (radius 1;
    // the shell is r = 1.1). The glow is zero where the ray just grazes the
    // shell (b = 1.1, so no hard outer ring) and peaks where it grazes the
    // surface (b = 1.0), so it hugs the limb with no dark gap.
    vec3 dir = normalize(vPosW - cameraPosition);
    float b = length(cross(cameraPosition, dir));
    float t = clamp((1.1 - b) / 0.1, 0.0, 1.0);
    float intensity = pow(t, 1.8);
    float sunward = smoothstep(-0.35, 0.45, dot(normalize(vNormalW), normalize(sunDir)));
    vec3 col = mix(vec3(0.04, 0.09, 0.22), vec3(0.32, 0.64, 1.0), sunward);
    gl_FragColor = vec4(col * intensity * 1.1, intensity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
