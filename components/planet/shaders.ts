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
  // Living World: 0 = degraded, smog-hazed planet · 1 = lush, clear, green.
  // 0.5 is the unaltered NASA composite.
  uniform float vitality;
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

    vec3 rawDay = texture2D(dayMap, vUv).rgb;
    vec3 nightCol = texture2D(nightMap, vUv).rgb;
    float water = texture2D(waterMap, vUv).r;
    float land = 1.0 - water;

    // Vegetation already in the imagery: green dominant over red and blue.
    float veg = smoothstep(0.0, 0.06, rawDay.g - max(rawDay.r * 0.92, rawDay.b));
    float lum = dot(rawDay, vec3(0.299, 0.587, 0.114));

    // Degraded: land desaturates toward dust, oceans toward grey.
    vec3 dust = vec3(lum * 1.12, lum * 0.96, lum * 0.74);
    vec3 parched = mix(mix(vec3(lum), rawDay, 0.25), dust, land * 0.7) * 0.82;
    // Lush: existing greenery deepens and spreads into semi-arid land; seas clear.
    vec3 grown = rawDay * vec3(0.72, 1.24, 0.8) + vec3(0.0, 0.03, 0.008);
    vec3 lush = mix(rawDay, grown, land * (0.35 + 0.65 * veg) * (1.0 - smoothstep(0.55, 0.85, lum)));
    lush = mix(lush, rawDay * vec3(0.92, 1.02, 1.08), water * 0.6);

    float down = clamp(1.0 - vitality * 2.0, 0.0, 1.0);
    float up = clamp(vitality * 2.0 - 1.0, 0.0, 1.0);
    vec3 dayCol = mix(mix(rawDay, parched, down), lush, up);

    vec3 lit = dayCol * (0.05 + 1.15 * max(ndl, 0.0));

    // Sun glint on open water only.
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 260.0) * water * 0.26 * day;

    // City light burns hotter and warmer on a degraded planet.
    vec3 nightSide = nightCol * mix(1.9, 1.25, vitality) * mix(vec3(1.0, 0.82, 0.6), vec3(1.0), vitality) + dayCol * 0.012;

    // Atmospheric scattering approximation: a blue rim that is brighter on
    // the lit limb and reddens slightly through the terminator. Smog turns it
    // amber-grey; a living planet tints it toward emerald-cyan.
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    float dusk = smoothstep(-0.25, 0.0, ndl) * (1.0 - smoothstep(0.0, 0.35, ndl));
    vec3 sky = mix(vec3(0.62, 0.52, 0.40), mix(vec3(0.28, 0.58, 1.0), vec3(0.24, 0.86, 0.72), up * 0.55), smoothstep(0.0, 0.5, vitality));
    vec3 rim = mix(sky, vec3(1.0, 0.55, 0.3), dusk * 0.6) * fres * (0.18 + 0.82 * day);

    vec3 col = mix(nightSide, lit, day) + spec * vec3(1.0, 0.94, 0.82) * (0.4 + 0.6 * vitality) + rim;
    // A brown haze over the lit hemisphere when degraded.
    col = mix(col, vec3(0.36, 0.31, 0.25) * (0.25 + 0.75 * day), down * (0.22 + 0.4 * fres));
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
  uniform float vitality;
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
    vec3 clear = mix(vec3(0.32, 0.64, 1.0), vec3(0.26, 0.9, 0.74), clamp(vitality * 2.0 - 1.0, 0.0, 1.0) * 0.5);
    vec3 smog = vec3(0.6, 0.48, 0.34);
    vec3 lit = mix(smog, clear, smoothstep(0.0, 0.55, vitality));
    vec3 col = mix(vec3(0.04, 0.09, 0.22), lit, sunward);
    gl_FragColor = vec4(col * intensity * 1.1, intensity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
