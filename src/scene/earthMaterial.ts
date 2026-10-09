import { Color, ShaderMaterial, Vector3, type Texture } from "three";

/**
 * The Earth: NASA Blue Marble by day, Black Marble city lights by night, a
 * soft terminator from the true Sun direction, and a thin atmosphere rim.
 * The mesh geometry is in the Earth body frame (see frame.ts), so the vertex
 * normal is the body-frame normal and the Sun direction comes in the same
 * frame. The rim and the terminator use gradients, because they are physical
 * (DESIGN.md, colour rules).
 */
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalBody;
  varying vec3 vNormalView;
  varying vec3 vViewDirection;

  void main() {
    vUv = uv;
    vNormalBody = normal;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDirection = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform vec3 sunDirection;
  uniform vec3 lightsColor;
  uniform vec3 rimColor;
  uniform float hasMaps;

  varying vec2 vUv;
  varying vec3 vNormalBody;
  varying vec3 vNormalView;
  varying vec3 vViewDirection;

  void main() {
    float cosSun = dot(normalize(vNormalBody), sunDirection);
    // About 5 degrees of twilight on each side of the terminator.
    float daylight = smoothstep(-0.08, 0.09, cosSun);

    vec3 ground = mix(vec3(0.05, 0.08, 0.16), texture2D(dayMap, vUv).rgb, hasMaps);
    float lights = texture2D(nightMap, vUv).r * hasMaps;

    vec3 dayColor = ground * (0.12 + 0.88 * clamp(cosSun * 1.25, 0.0, 1.0));
    vec3 nightColor = ground * 0.03 + lightsColor * pow(lights, 1.4) * 1.3;
    vec3 color = mix(nightColor, dayColor, daylight);

    // A warm band where the Sun rises or sets.
    float dusk = smoothstep(-0.14, 0.0, cosSun) * (1.0 - smoothstep(0.0, 0.18, cosSun));
    color += vec3(0.85, 0.42, 0.18) * dusk * 0.045;

    // Atmosphere: brightest at the limb, stronger on the day side.
    float facing = max(dot(normalize(vNormalView), normalize(vViewDirection)), 0.0);
    float rim = pow(1.0 - facing, 3.0);
    color += rimColor * rim * (0.2 + 0.8 * daylight);

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** A type alias, not an interface: ShaderMaterial needs an index signature. */
export type EarthUniforms = {
  dayMap: { value: Texture | null };
  nightMap: { value: Texture | null };
  sunDirection: { value: Vector3 };
  lightsColor: { value: Color };
  rimColor: { value: Color };
  hasMaps: { value: number };
};

export function createEarthMaterial(): ShaderMaterial & { uniforms: EarthUniforms } {
  const uniforms: EarthUniforms = {
    dayMap: { value: null },
    nightMap: { value: null },
    sunDirection: { value: new Vector3(1, 0, 0) },
    // City lights in a warm brass tone, rim in a pale sky blue.
    lightsColor: { value: new Color("#ffcf8a") },
    rimColor: { value: new Color("#7fb2ff") },
    hasMaps: { value: 0 },
  };
  return new ShaderMaterial({ uniforms, vertexShader, fragmentShader }) as ShaderMaterial & {
    uniforms: EarthUniforms;
  };
}
