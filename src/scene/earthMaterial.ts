import { Color, ShaderMaterial, Vector3, type Texture } from "three";

import {
  CENTRE_RADIUS_DEG,
  CLASSICAL_RADIUS_DEG,
  KOORMA_CENTRE,
  KOORMA_WEDGES,
  type KoormaRegionId,
} from "../engine/koorma.ts";
import { UI_COLORS } from "../design/palette.ts";
import { geoToBody } from "./frame.ts";

/**
 * The Earth: NASA Blue Marble by day, Black Marble city lights by night, a
 * soft terminator from the true Sun direction, and a thin atmosphere rim.
 * The mesh geometry is in the Earth body frame (see frame.ts), so the vertex
 * normal is the body-frame normal and the Sun direction comes in the same
 * frame. The rim and the terminator use gradients, because they are physical
 * (DESIGN.md, colour rules).
 *
 * The Koorma Chakra lies over the map as soft glows, never as lines
 * (DESIGN.md, scene). The shader repeats the geometry of engine/koorma.ts:
 * a centre circle and 8 wedges of 45 degrees, by great-circle bearing in
 * classical mode and by rhumb-line bearing in global mode.
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

  uniform vec3 koormaCentre;
  uniform float koormaCentreLat;
  uniform float koormaCentreLon;
  uniform float koormaCentreIso;
  uniform float koormaClassical;
  uniform float koormaStrength[9];
  uniform vec3 koormaBrass;
  uniform vec3 koormaEclipse;

  varying vec2 vUv;
  varying vec3 vNormalBody;
  varying vec3 vNormalView;
  varying vec3 vViewDirection;

  const float PI = 3.141592653589793;
  const float DEG = PI / 180.0;
  const float CENTRE_RADIUS = ${CENTRE_RADIUS_DEG.toFixed(3)} * DEG;
  const float CLASSICAL_RADIUS = ${CLASSICAL_RADIUS_DEG.toFixed(3)} * DEG;
  const float CENTRE_EDGE = 2.0 * DEG;
  // Wedges cross-fade over about 8 degrees of arc on the ground, at least 5 degrees of bearing.
  const float WEDGE_GROUND = 4.0 * DEG;
  const float WEDGE_EDGE = 5.0 * DEG;

  // DESIGN.md, Koorma glow: eclipse ivory (3), brass (2), brass at 50 % (1).
  float glowAlpha(float strength) {
    if (strength > 2.5) return 0.32;
    if (strength > 1.5) return 0.26;
    if (strength > 0.5) return 0.13;
    return 0.0;
  }

  vec3 glowColour(float strength) {
    return strength > 2.5 ? koormaEclipse : koormaBrass;
  }

  // The glow mixes in perceptual space: in linear light a small amount over the
  // dark night side would show far too bright after the sRGB encoding.
  vec3 toPerceptual(vec3 c) { return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2)); }
  vec3 toLinear(vec3 c) { return pow(max(c, vec3(0.0)), vec3(2.2)); }

  float isometricLatitude(float latitude) {
    float clamped = clamp(latitude, -1.5707, 1.5707);
    return log(tan(PI / 4.0 + clamped / 2.0));
  }

  vec3 koorma(vec3 colour, vec3 n, float daylight) {
    float distance = acos(clamp(dot(n, koormaCentre), -1.0, 1.0));
    float classical = step(0.5, koormaClassical);
    float outer = mix(PI / 2.0, CLASSICAL_RADIUS, classical);
    float fade = mix(8.0, 4.0, classical) * DEG;
    // Global mode: each lit direction is a soft ray from the centre (14.1: the lands
    // "beginning from the centre of Bharatavarsha"), bright near it and faint far away.
    float far = clamp(distance / (PI / 2.0), 0.0, 1.0);
    float radiate = mix(0.15 + 0.85 * pow(1.0 - far, 1.5), 1.0, classical);
    float reach = (1.0 - smoothstep(outer - fade, outer, distance)) * radiate;
    if (reach <= 0.0) return colour;

    float latitude = asin(clamp(n.z, -1.0, 1.0));
    float longitude = atan(n.y, n.x);
    float dLon = mod(longitude - koormaCentreLon + PI, 2.0 * PI) - PI;
    float greatCircle = atan(
      sin(dLon) * cos(latitude),
      cos(koormaCentreLat) * sin(latitude) - sin(koormaCentreLat) * cos(latitude) * cos(dLon)
    );
    float rhumb = atan(dLon, isometricLatitude(latitude) - koormaCentreIso);
    float bearing = mix(rhumb, greatCircle, classical);

    float centre = 1.0 - smoothstep(CENTRE_RADIUS - CENTRE_EDGE, CENTRE_RADIUS + CENTRE_EDGE, distance);
    float alpha = centre * glowAlpha(koormaStrength[0]);
    vec3 glow = alpha * glowColour(koormaStrength[0]);
    // A bearing step covers less ground near the centre: widen the fade there, so the
    // edge keeps about the same width on the ground. The cap keeps the 2 weights summing to 1.
    float wedgeEdge = clamp(WEDGE_GROUND / max(sin(distance), 0.05), WEDGE_EDGE, PI / 8.0);
    for (int i = 0; i < 8; i++) {
      // Wedge i is centred on bearing i × 45° (KOORMA_UNIFORM_ORDER).
      float middle = float(i) * PI / 4.0;
      float offset = abs(mod(bearing - middle + PI, 2.0 * PI) - PI);
      float weight = (1.0 - smoothstep(PI / 8.0 - wedgeEdge, PI / 8.0 + wedgeEdge, offset)) * (1.0 - centre);
      float strength = koormaStrength[i + 1];
      float a = weight * glowAlpha(strength);
      alpha += a;
      glow += a * glowColour(strength);
    }

    if (alpha <= 0.0) return colour;
    vec3 light = glow / alpha;
    float amount = clamp(alpha * reach, 0.0, 1.0);
    // A little stronger on the night side, where the glow reads as light.
    amount *= mix(1.15, 0.85, daylight);
    return toLinear(mix(toPerceptual(colour), toPerceptual(light), amount));
  }

  void main() {
    vec3 normalBody = normalize(vNormalBody);
    float cosSun = dot(normalBody, sunDirection);
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

    color = koorma(color, normalBody, daylight);

    // Atmosphere: brightest at the limb, stronger on the day side.
    float facing = max(dot(normalize(vNormalView), normalize(vViewDirection)), 0.0);
    float rim = pow(1.0 - facing, 3.0);
    color += rimColor * rim * (0.2 + 0.8 * daylight);

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * The order of the strength uniform: the centre, then the wedges by compass
 * sector from north. The shader centres wedge i (1 to 8) on bearing (i - 1) × 45°.
 */
export const KOORMA_UNIFORM_ORDER: readonly KoormaRegionId[] = ["centre", ...KOORMA_WEDGES];

/** A type alias, not an interface: ShaderMaterial needs an index signature. */
export type EarthUniforms = {
  dayMap: { value: Texture | null };
  nightMap: { value: Texture | null };
  sunDirection: { value: Vector3 };
  lightsColor: { value: Color };
  rimColor: { value: Color };
  hasMaps: { value: number };
  koormaCentre: { value: Vector3 };
  koormaCentreLat: { value: number };
  koormaCentreLon: { value: number };
  /** Mercator ordinate of the centre's latitude, for the rhumb bearing. */
  koormaCentreIso: { value: number };
  /** 1 for classical mode, 0 for global mode. */
  koormaClassical: { value: number };
  /** Glow strength 0 to 3 of the centre, then the wedges north, north-east, ... north-west. */
  koormaStrength: { value: Float32Array };
  koormaBrass: { value: Color };
  koormaEclipse: { value: Color };
};

export function createEarthMaterial(): ShaderMaterial & { uniforms: EarthUniforms } {
  const centre = geoToBody(KOORMA_CENTRE.latitudeDeg, KOORMA_CENTRE.longitudeDeg);
  const uniforms: EarthUniforms = {
    dayMap: { value: null },
    nightMap: { value: null },
    sunDirection: { value: new Vector3(1, 0, 0) },
    // City lights in a warm brass tone, rim in a pale sky blue.
    lightsColor: { value: new Color("#ffcf8a") },
    rimColor: { value: new Color("#7fb2ff") },
    hasMaps: { value: 0 },
    koormaCentre: { value: new Vector3(centre[0], centre[1], centre[2]) },
    koormaCentreLat: { value: (KOORMA_CENTRE.latitudeDeg * Math.PI) / 180 },
    koormaCentreLon: { value: (KOORMA_CENTRE.longitudeDeg * Math.PI) / 180 },
    koormaCentreIso: { value: Math.log(Math.tan(Math.PI / 4 + (KOORMA_CENTRE.latitudeDeg * Math.PI) / 360)) },
    koormaClassical: { value: 0 },
    koormaStrength: { value: new Float32Array(9) },
    koormaBrass: { value: new Color(UI_COLORS.brass) },
    koormaEclipse: { value: new Color(UI_COLORS.eclipse) },
  };
  return new ShaderMaterial({ uniforms, vertexShader, fragmentShader }) as ShaderMaterial & {
    uniforms: EarthUniforms;
  };
}
