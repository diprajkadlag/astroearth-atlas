import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Camera,
  type Texture,
  type WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { between, firstAtOrAfter, type Station } from "../data/skyEvents.ts";
import { skyEventsNow, useSkyEvents } from "../data/skyEventsLoader.ts";
import { findTimelineEvent, timelineEvents } from "../data/timelineEvents.ts";
import { GRAHA_IDS, NAKSHATRAS, RASIS, type GrahaId } from "../engine/zodiac.ts";
import { GRAHA_COLOR_TOKENS, UI_COLORS, grahaColor, withAlpha } from "../design/palette.ts";
import { grahaAbbreviation } from "../i18n/index.ts";
import { readSky } from "../state/hooks.ts";
import { currentStepMs, useAtlas } from "../state/store.ts";
import { calculateInstrumentFrameDistance } from "./camera-framing.ts";
import { createEarthMaterial } from "./earthMaterial.ts";
import {
  apply,
  earthInstantMs,
  earthToScene,
  eclipticToScene,
  geoToBody,
  sceneDirectionToGeo,
  sceneToEcliptic,
  transpose,
  type Matrix3,
  type Vec3,
} from "./frame.ts";
import { isFarSide, isHiddenByEarth, placeLabels } from "./labels.ts";
import {
  EARTH_RADIUS,
  NAKSHATRA_LABEL_RADIUS,
  PLATE_RADIUS,
  RING_RADIUS,
  SIGN_LABEL_RADIUS,
  ringTicks,
} from "./ringGeometry.ts";

/** The Koorma centre (DESIGN.md): the first view faces Mathura. */
const MATHURA = { latitudeDeg: 27.49, longitudeDeg: 77.67 };
const CAMERA_ELEVATION_DEG = 32;
const VERTICAL_FOV_DEG = 36;
const LABEL_FONT = '500 12px "Anek Devanagari", system-ui, sans-serif';

const MARKER_RADIUS: Readonly<Record<GrahaId, number>> = {
  sun: 0.075,
  moon: 0.062,
  mercury: 0.048,
  venus: 0.055,
  mars: 0.052,
  jupiter: 0.062,
  saturn: 0.058,
  rahu: 0.042,
  ketu: 0.034,
};

/** Read by the browser tests (CLAUDE.md: scene tests read positions, never pixels). */
export interface MediniDebug {
  frames: number;
  instantMs: number;
  earthInstantMs: number;
  cameraUp: [number, number, number];
  /** Width of the Earth maps on screen: 0 before any load, then 512, then 2048 or 4096. */
  mapsWidth: number;
  /** Sub-solar point under the Sun marker, from the Earth mesh's own matrix. */
  subSolarFromScene(): { latitudeDeg: number; longitudeDeg: number };
  /** Sidereal longitude of a graha marker, read from its scene position. */
  markerLongitude(id: GrahaId): number;
}

declare global {
  interface Window {
    __MEDINI_DEBUG__?: MediniDebug;
  }
}

export interface ViewApi {
  /** Turns the view about the ecliptic pole and tilts it. Angles in degrees. */
  turn(azimuthDeg: number, elevationDeg: number): void;
  zoom(factor: number): void;
}

function matrixFromRows(target: Mesh, m: Matrix3): void {
  target.matrix.set(
    m[0][0], m[0][1], m[0][2], 0,
    m[1][0], m[1][1], m[1][2], 0,
    m[2][0], m[2][1], m[2][2], 0,
    0, 0, 0, 1,
  );
  target.matrixWorldNeedsUpdate = true;
}

function rowsFromMatrix(mesh: Mesh): Matrix3 {
  const e = mesh.matrixWorld.elements;
  // three.js stores matrices column by column.
  return [
    [e[0] as number, e[4] as number, e[8] as number],
    [e[1] as number, e[5] as number, e[9] as number],
    [e[2] as number, e[6] as number, e[10] as number],
  ];
}

function lineMaterial(color: string, opacity: number): LineBasicMaterial {
  return new LineBasicMaterial({ color, transparent: opacity < 1, opacity });
}

function segmentsObject(positions: Float32Array, material: LineBasicMaterial): LineSegments {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  return new LineSegments(geometry, material);
}

function lineObject(positions: Float32Array, material: LineBasicMaterial): Line {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  return new Line(geometry, material);
}

/** Desktops with a large texture limit get 4096 px maps, everyone else 2048 px (plan, M3). */
function fullTextureWidth(gl: WebGLRenderer): number {
  const wide = window.matchMedia("(min-width: 1024px)").matches;
  return wide && gl.capabilities.maxTextureSize >= 4096 ? 4096 : 2048;
}

interface SceneObjects {
  root: Group;
  plate: Mesh;
  earth: Mesh;
  earthMaterial: ReturnType<typeof createEarthMaterial>;
  markers: Map<GrahaId, Mesh>;
  axis: Line;
  /** The degree ticks draw in during the first-load animation. */
  degreeTicks: LineSegments;
  /** Pins ride on the Earth (children of its mesh): the selected event and eclipses within 7 days. */
  selectedPin: Mesh;
  eclipsePins: Mesh[];
  dispose(): void;
}

function buildScene(): SceneObjects {
  const root = new Group();

  const plate = new Mesh(
    new CircleGeometry(PLATE_RADIUS, 180),
    new MeshBasicMaterial({ color: UI_COLORS.dial, depthTest: false, depthWrite: false }),
  );
  // The dial plate is the background of the instrument: drawn first, it never hides the Earth.
  plate.renderOrder = -10;
  root.add(plate);

  const ticks = ringTicks();
  const degreeTicks = segmentsObject(ticks.degrees, lineMaterial(UI_COLORS.ivory, 0.42));
  root.add(
    degreeTicks,
    segmentsObject(ticks.nakshatras, lineMaterial(UI_COLORS.ivory, 0.8)),
    segmentsObject(ticks.signs, lineMaterial(UI_COLORS.ivory, 1)),
    lineObject(ticks.inner, lineMaterial(UI_COLORS.ivory, 0.9)),
    lineObject(ticks.outer, lineMaterial(UI_COLORS.ivory, 0.45)),
  );

  const earthMaterial = createEarthMaterial();
  // SphereGeometry has its pole on +Y. Turned 90 degrees about X, its
  // vertices are in the Earth body frame: Z north, X Greenwich, Y 90 E.
  const earth = new Mesh(new SphereGeometry(1, 128, 64).rotateX(Math.PI / 2), earthMaterial);
  earth.matrixAutoUpdate = false;
  root.add(earth);

  const selectedPin = new Mesh(new SphereGeometry(0.026, 20, 12), new MeshBasicMaterial({ color: UI_COLORS.ivory }));
  selectedPin.visible = false;
  earth.add(selectedPin);
  const eclipsePins = Array.from({ length: 3 }, () => {
    const pin = new Mesh(new SphereGeometry(0.022, 20, 12), new MeshBasicMaterial({ color: UI_COLORS.eclipse }));
    pin.visible = false;
    earth.add(pin);
    return pin;
  });

  const markers = new Map<GrahaId, Mesh>();
  for (const id of GRAHA_IDS) {
    // The Moon's phase is drawn on the label layer, from the true elongation.
    const material = new MeshBasicMaterial({ color: grahaColor(id) });
    const marker = new Mesh(new SphereGeometry(MARKER_RADIUS[id], 32, 16), material);
    marker.name = id;
    markers.set(id, marker);
    root.add(marker);
  }

  const axisGeometry = new BufferGeometry();
  axisGeometry.setAttribute("position", new BufferAttribute(new Float32Array(6), 3));
  const axis = new Line(axisGeometry, lineMaterial(GRAHA_COLOR_TOKENS.nodes, 0.9));
  root.add(axis);


  return {
    root,
    plate,
    earth,
    earthMaterial,
    markers,
    axis,
    degreeTicks,
    selectedPin,
    eclipsePins,
    dispose() {
      root.traverse((object) => {
        if (object instanceof Mesh || object instanceof Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      earthMaterial.uniforms.dayMap.value?.dispose();
      earthMaterial.uniforms.nightMap.value?.dispose();
    },
  };
}

const PIN_RADIUS = 1.012;
const ECLIPSE_PIN_WINDOW_MS = 7 * 86_400_000;
const TRAIL_RADIUS = RING_RADIUS + 0.055;
const INTRO_MS = 1100;

function placePin(pin: Mesh, latitudeDeg: number, longitudeDeg: number): void {
  const v = geoToBody(latitudeDeg, longitudeDeg);
  pin.position.set(v[0] * PIN_RADIUS, v[1] * PIN_RADIUS, v[2] * PIN_RADIUS);
  pin.visible = true;
}

/** The selected event (world event with a place, or eclipse) and eclipses within 7 days get pins. */
function updatePins(objects: SceneObjects, instantMs: number, eventId: string | null): void {
  const sky = skyEventsNow();
  const selected = findTimelineEvent(timelineEvents(sky), eventId);
  const place =
    selected?.world?.place ??
    (selected?.eclipse ? { latitudeDeg: selected.eclipse.latitudeDeg, longitudeDeg: selected.eclipse.longitudeDeg } : null);
  if (place) placePin(objects.selectedPin, place.latitudeDeg, place.longitudeDeg);
  else objects.selectedPin.visible = false;
  const near = sky
    ? between(sky.eclipses, instantMs - ECLIPSE_PIN_WINDOW_MS, instantMs + ECLIPSE_PIN_WINDOW_MS).filter(
        (eclipse) => eclipse !== selected?.eclipse,
      )
    : [];
  objects.eclipsePins.forEach((pin, index) => {
    const eclipse = near[index];
    if (eclipse) placePin(pin, eclipse.latitudeDeg, eclipse.longitudeDeg);
    else pin.visible = false;
  });
}

/** The current retrograde loop of a graha: the stations before and after the instant. */
function retrogradeLoop(stations: readonly Station[], id: GrahaId, instantMs: number): { fromDeg: number; toDeg: number } | null {
  const index = firstAtOrAfter(stations, instantMs);
  let before: Station | undefined;
  for (let k = index - 1; k >= 0 && k >= index - 40; k -= 1) {
    if (stations[k]?.graha === id) {
      before = stations[k];
      break;
    }
  }
  let after: Station | undefined;
  for (let k = index; k < stations.length && k < index + 40; k += 1) {
    if (stations[k]?.graha === id) {
      after = stations[k];
      break;
    }
  }
  if (before?.turns !== "retrograde" || after?.turns !== "direct") return null;
  return { fromDeg: before.longitudeDeg, toDeg: after.longitudeDeg };
}

/** Starts the degree ticks at 0 and the camera a little farther out, for the first-load animation. */
function startIntro(objects: SceneObjects): void {
  objects.degreeTicks.geometry.setDrawRange(0, 0);
}

/** One frame of the first-load animation. Returns true while it runs. */
function stepIntro(objects: SceneObjects, progress: number): boolean {
  const total = objects.degreeTicks.geometry.getAttribute("position").count;
  const ticks = Math.min(1, progress / 0.7);
  objects.degreeTicks.geometry.setDrawRange(0, progress >= 1 ? Infinity : Math.floor(total * ticks));
  return progress < 1;
}

/** Angle between 2 longitudes, 0 to 180 degrees. */
function elongation(aDeg: number, bDeg: number): number {
  const delta = Math.abs(((aDeg - bDeg) % 360 + 360) % 360);
  return delta > 180 ? 360 - delta : delta;
}

/**
 * The Moon's phase as seen from the Earth: the lit fraction follows the
 * elongation from the Sun (0 degrees new, 180 degrees full), and the lit limb
 * faces the Sun's mark on screen. Drawn over the Moon mark, with a ring in the
 * Moon's colour for identity.
 */
function drawMoonPhase(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  elongationDeg: number,
  towardSunRad: number,
): void {
  const terminator = Math.cos((elongationDeg * Math.PI) / 180) * radius;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(towardSunRad);
  ctx.fillStyle = UI_COLORS.dial;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  // The lit half faces the Sun (+x). The terminator is an ellipse that cuts it
  // to a crescent (elongation under 90 degrees) or widens it to a gibbous Moon.
  ctx.fillStyle = UI_COLORS.ivory;
  ctx.beginPath();
  ctx.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2, false);
  ctx.ellipse(0, 0, Math.abs(terminator), radius, 0, Math.PI / 2, -Math.PI / 2, terminator > 0);
  ctx.fill();
  ctx.strokeStyle = GRAHA_COLOR_TOKENS.moon;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, radius + 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** The dial plate shrinks to the framed ring on narrow screens, so the canvas never cuts it. */
function fitPlate(plate: Mesh, radius: number): void {
  plate.scale.setScalar(radius / PLATE_RADIUS);
}

/** Puts new day and night maps on the Earth and frees the old ones. */
function applyEarthMaps(
  material: ReturnType<typeof createEarthMaterial>,
  day: Texture,
  night: Texture,
  anisotropy: number,
): void {
  for (const texture of [day, night]) {
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = anisotropy;
  }
  const { uniforms } = material;
  const previous = [uniforms.dayMap.value, uniforms.nightMap.value];
  uniforms.dayMap.value = day;
  uniforms.nightMap.value = night;
  uniforms.hasMaps.value = 1;
  previous.forEach((texture) => texture?.dispose());
}

interface OverlayContext {
  canvas: HTMLCanvasElement;
  camera: Camera;
  width: number;
  height: number;
  dpr: number;
}

const projected = new Vector3();

function project(point: Vec3, camera: Camera, width: number, height: number): { x: number; y: number } {
  projected.set(point[0], point[1], point[2]).project(camera);
  return { x: ((projected.x + 1) / 2) * width, y: ((1 - projected.y) / 2) * height };
}

/** Labels and marks in screen space: names, rays, retrograde rings. */
function drawOverlay(
  { canvas, camera, width, height, dpr }: OverlayContext,
  sky: ReturnType<typeof readSky>["sky"],
  markers: Map<GrahaId, Mesh>,
  extras: { instantMs: number; stations: readonly Station[]; selectedPin: Mesh },
): void {
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.font = LABEL_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const cameraPosition: Vec3 = [camera.position.x, camera.position.y, camera.position.z];

  // Retrograde trails: the arc of the current loop, just outside the ring.
  for (const graha of sky.grahas) {
    if (!graha.retrograde || graha.id === "sun" || graha.id === "moon" || graha.id === "rahu" || graha.id === "ketu") continue;
    const loop = retrogradeLoop(extras.stations, graha.id, extras.instantMs);
    if (!loop) continue;
    let sweep = loop.fromDeg - loop.toDeg;
    if (sweep < 0) sweep += 360;
    ctx.strokeStyle = withAlpha(grahaColor(graha.id), 0.85);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    let open = false;
    for (let step = 0; step <= Math.ceil(sweep * 2); step += 1) {
      const longitude = loop.fromDeg - Math.min(sweep, step / 2);
      const point = eclipticToScene(longitude, 0, TRAIL_RADIUS);
      if (isHiddenByEarth(cameraPosition, point)) {
        open = false;
        continue;
      }
      const { x, y } = project(point, camera, width, height);
      if (open) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
      open = true;
    }
    ctx.stroke();
  }

  // The selected event: a brass ring around its pin, when the pin faces the camera.
  if (extras.selectedPin.visible) {
    const world = new Vector3();
    extras.selectedPin.getWorldPosition(world);
    const facing = world.x * (cameraPosition[0] - world.x) + world.y * (cameraPosition[1] - world.y) + world.z * (cameraPosition[2] - world.z);
    if (facing > 0) {
      const { x, y } = project([world.x, world.y, world.z], camera, width, height);
      ctx.strokeStyle = UI_COLORS.brass;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const centre = project([0, 0, 0], camera, width, height);
  const visible = sky.grahas
    .map((graha) => {
      const marker = markers.get(graha.id);
      if (!marker) return null;
      const point: Vec3 = [marker.position.x, marker.position.y, marker.position.z];
      if (isHiddenByEarth(cameraPosition, point)) return null;
      const screen = project(point, camera, width, height);
      const edge = project(
        [point[0], point[1], point[2] + MARKER_RADIUS[graha.id]],
        camera,
        width,
        height,
      );
      const radiusPx = Math.max(3, Math.hypot(edge.x - screen.x, edge.y - screen.y));
      const length = Math.hypot(screen.x - centre.x, screen.y - centre.y) || 1;
      return {
        graha,
        ...screen,
        radiusPx,
        dx: (screen.x - centre.x) / length,
        dy: (screen.y - centre.y) / length,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.graha.siderealLongitudeDeg - b.graha.siderealLongitudeDeg);

  const labelText = (item: (typeof visible)[number]) => {
    const physical = item.graha.id !== "rahu" && item.graha.id !== "ketu";
    const retrograde = physical && item.graha.retrograde && item.graha.id !== "sun" && item.graha.id !== "moon";
    return { retrograde, text: grahaAbbreviation(item.graha.id) + (retrograde ? " R" : "") };
  };
  const positions = placeLabels(
    visible.map((item) => ({
      x: item.x + item.dx * (item.radiusPx + 12),
      y: item.y + item.dy * (item.radiusPx + 10),
      dx: item.dx,
      dy: item.dy,
      halfWidth: ctx.measureText(labelText(item).text).width / 2,
    })),
    { width, height },
    15,
    14,
  );

  // Ring labels give way to the grahas: a name that would touch a graha mark
  // or its label is left out. The sky table still lists every position.
  const occupied = visible.flatMap((item, index) => {
    const label = positions[index];
    return label
      ? [
          { x: item.x, y: item.y, rx: item.radiusPx + 26, ry: item.radiusPx + 9 },
          { x: label.x, y: label.y, rx: 34, ry: 11 },
        ]
      : [];
  });
  const clashes = (x: number, y: number, halfWidth: number) =>
    occupied.some((zone) => Math.abs(zone.x - x) < zone.rx + halfWidth - 26 && Math.abs(zone.y - y) < zone.ry);
  // Ring labels also give way to each other: a name that would touch an earlier one is left out.
  const drawn: { x: number; y: number; halfWidth: number }[] = [];
  const ringLabel = (text: string, longitudeDeg: number, radius: number) => {
    const point = eclipticToScene(longitudeDeg, 0, radius);
    if (isHiddenByEarth(cameraPosition, point)) return;
    const { x, y } = project(point, camera, width, height);
    const halfWidth = ctx.measureText(text).width / 2;
    if (clashes(x, y, halfWidth)) return;
    if (drawn.some((other) => Math.abs(other.x - x) < other.halfWidth + halfWidth + 4 && Math.abs(other.y - y) < 14)) return;
    drawn.push({ x, y, halfWidth });
    // Far-side names stay dimmer than near-side ones, but readable (about 5:1 on the dial).
    ctx.fillStyle = isFarSide(cameraPosition, point) ? withAlpha(UI_COLORS.ivory, 0.55) : UI_COLORS.muted;
    ctx.fillText(text, x, y);
  };
  // DESIGN.md: sign names from 480 px, all nakshatra names from 700 px.
  if (width >= 480) RASIS.forEach((name, index) => ringLabel(name, index * 30 + 15, SIGN_LABEL_RADIUS));
  // On the ring, the 6 compound names take short forms (P. Phalguni, U. Ashadha); the sky table keeps the full names.
  if (width >= 700) {
    NAKSHATRAS.forEach((name, index) =>
      ringLabel(name.replace(/^Purva /, "P. ").replace(/^Uttara /, "U. "), (index + 0.5) * (360 / 27), NAKSHATRA_LABEL_RADIUS),
    );
  }

  visible.forEach((item, index) => {
    const position = positions[index];
    if (!position) return;
    const { retrograde, text } = labelText(item);

    ctx.strokeStyle = grahaColor(item.graha.id);
    ctx.lineWidth = 1.25;
    if (item.graha.id === "sun") {
      // DESIGN.md: the Sun mark has rays.
      for (let ray = 0; ray < 8; ray += 1) {
        const angle = (ray * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(item.x + Math.cos(angle) * item.radiusPx * 1.35, item.y + Math.sin(angle) * item.radiusPx * 1.35);
        ctx.lineTo(item.x + Math.cos(angle) * item.radiusPx * 1.9, item.y + Math.sin(angle) * item.radiusPx * 1.9);
        ctx.stroke();
      }
    }
    if (retrograde) {
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.radiusPx + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (item.graha.id === "moon") {
      const sunMarker = markers.get("sun");
      const sun = sky.grahas.find((graha) => graha.id === "sun");
      if (sunMarker && sun) {
        const sunScreen = project([sunMarker.position.x, sunMarker.position.y, sunMarker.position.z], camera, width, height);
        const towardSun = Math.atan2(sunScreen.y - item.y, sunScreen.x - item.x);
        drawMoonPhase(ctx, item.x, item.y, Math.max(5, item.radiusPx + 1), elongation(sun.siderealLongitudeDeg, item.graha.siderealLongitudeDeg), towardSun);
      }
    }
    // A label that had to move away from its mark gets a thin leader line.
    const gap = Math.hypot(position.x - item.x, position.y - item.y);
    if (gap > item.radiusPx + 24) {
      const ux = (position.x - item.x) / gap;
      const uy = (position.y - item.y) / gap;
      ctx.strokeStyle = withAlpha(UI_COLORS.ivory, 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(item.x + ux * (item.radiusPx + 3), item.y + uy * (item.radiusPx + 3));
      ctx.lineTo(position.x - ux * 9, position.y - uy * 9);
      ctx.stroke();
    }
    ctx.fillStyle = UI_COLORS.ivory;
    ctx.fillText(text, position.x, position.y);
  });
}

export interface SkySceneProps {
  overlayRef: RefObject<HTMLCanvasElement | null>;
  apiRef: RefObject<ViewApi | null>;
  interactive: boolean;
}

/** The instrument: the dial plate, the engraved ring, the Earth and the grahas. */
export function SkyScene({ overlayRef, apiRef, interactive }: SkySceneProps) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);

  const objects = useMemo(() => buildScene(), []);
  useEffect(() => () => objects.dispose(), [objects]);

  const controlsRef = useRef<OrbitControls | null>(null);
  const userZoomedRef = useRef(false);
  const lastRef = useRef<{ instantMs: number; earthMs: number; eventId: string | null; sky: unknown }>({
    instantMs: Number.NaN,
    earthMs: Number.NaN,
    eventId: null,
    sky: undefined,
  });
  const introRef = useRef<number | null>(null);

  // The sky events load after the page; draw again when they arrive (pins, trails).
  const skyEvents = useSkyEvents();
  useEffect(() => invalidate(), [skyEvents, invalidate]);

  // DESIGN.md, motion: one orchestrated moment on first load, skipped with reduced motion.
  useLayoutEffect(() => {
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    startIntro(objects);
    introRef.current = performance.now();
  }, [objects]);

  // Below 480 px the ring has no sign names outside it, so the ring fills the frame.
  const framedPlateRadius = size.width < 480 ? RING_RADIUS + 0.3 : PLATE_RADIUS;
  useLayoutEffect(() => fitPlate(objects.plate, framedPlateRadius), [objects, framedPlateRadius]);

  const fitDistance = useMemo(
    () =>
      calculateInstrumentFrameDistance({
        width: Math.max(1, size.width),
        height: Math.max(1, size.height),
        verticalFovDeg: VERTICAL_FOV_DEG,
        elevationDeg: CAMERA_ELEVATION_DEG,
        plateRadius: framedPlateRadius,
        earthRadius: EARTH_RADIUS,
      }),
    [size.width, size.height, framedPlateRadius],
  );

  // First view: above the ecliptic, facing the Koorma centre at Mathura.
  useLayoutEffect(() => {
    const { instantMs } = useAtlas.getState();
    const earthMs = earthInstantMs(instantMs, currentStepMs(useAtlas.getState()));
    const mathura = apply(earthToScene(new Date(earthMs)), geoToBody(MATHURA.latitudeDeg, MATHURA.longitudeDeg));
    const azimuth = Math.atan2(mathura[1], mathura[0]);
    const elevation = (CAMERA_ELEVATION_DEG * Math.PI) / 180;
    camera.up.set(0, 0, 1);
    camera.position.set(
      Math.cos(elevation) * Math.cos(azimuth),
      Math.cos(elevation) * Math.sin(azimuth),
      Math.sin(elevation),
    );
    camera.lookAt(0, 0, 0);
    // Only on mount: later the user owns the camera.
  }, [camera]);

  // Keep the instrument framed when the canvas changes size, unless the user zoomed.
  useLayoutEffect(() => {
    if (userZoomedRef.current) return;
    camera.position.setLength(fitDistance);
    controlsRef.current?.update();
    invalidate();
  }, [camera, fitDistance, invalidate]);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.rotateSpeed = 0.6;
    controls.zoomSpeed = 0.8;
    controls.minDistance = 2.2;
    controls.minPolarAngle = 0.08;
    controls.maxPolarAngle = Math.PI - 0.08;
    const onChange = () => invalidate();
    const onStart = () => {
      userZoomedRef.current = true;
    };
    controls.addEventListener("change", onChange);
    controls.addEventListener("start", onStart);
    controlsRef.current = controls;
    return () => {
      controls.removeEventListener("change", onChange);
      controls.removeEventListener("start", onStart);
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl, invalidate]);

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.maxDistance = fitDistance * 1.6;
  }, [fitDistance]);

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.enabled = interactive;
  }, [interactive]);

  // Keyboard and button control of the view (DESIGN.md: every control works by keyboard).
  useEffect(() => {
    apiRef.current = {
      turn(azimuthDeg, elevationDeg) {
        const position = camera.position;
        const radius = position.length();
        const azimuth = Math.atan2(position.y, position.x) + (azimuthDeg * Math.PI) / 180;
        const polar = Math.min(
          Math.PI - 0.08,
          Math.max(0.08, Math.acos(position.z / radius) - (elevationDeg * Math.PI) / 180),
        );
        position.set(
          radius * Math.sin(polar) * Math.cos(azimuth),
          radius * Math.sin(polar) * Math.sin(azimuth),
          radius * Math.cos(polar),
        );
        camera.lookAt(0, 0, 0);
        controlsRef.current?.update();
        invalidate();
      },
      zoom(factor) {
        const controls = controlsRef.current;
        const min = controls?.minDistance ?? 2.2;
        const max = controls?.maxDistance ?? fitDistance * 1.6;
        camera.position.setLength(Math.min(max, Math.max(min, camera.position.length() * factor)));
        userZoomedRef.current = true;
        controls?.update();
        invalidate();
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, camera, fitDistance, invalidate]);

  // Earth maps: a 512 px placeholder first, then the full size.
  useEffect(() => {
    const loader = new TextureLoader();
    const base = import.meta.env.BASE_URL;
    const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    let cancelled = false;
    const load = (name: string, width: number) =>
      new Promise<Texture>((resolve, reject) => {
        loader.load(`${base}textures/${name}-${width}.webp`, resolve, undefined, reject);
      });
    void (async () => {
      for (const width of [512, fullTextureWidth(gl)]) {
        const [day, night] = await Promise.all([load("earth-day", width), load("earth-night", width)]);
        if (cancelled) {
          day.dispose();
          night.dispose();
          return;
        }
        applyEarthMaps(objects.earthMaterial, day, night, anisotropy);
        const debug = window.__MEDINI_DEBUG__;
        if (debug) debug.mapsWidth = width;
        invalidate();
      }
    })().catch(() => {
      // Without maps the Earth keeps its plain ocean colour. The rest still works.
    });
    return () => {
      cancelled = true;
    };
  }, [gl, invalidate, objects]);

  // Redraw on every change of the date.
  useEffect(() => useAtlas.subscribe(() => invalidate()), [invalidate]);

  // Debug hook for the browser tests.
  useEffect(() => {
    const debug: MediniDebug = {
      frames: 0,
      instantMs: Number.NaN,
      earthInstantMs: Number.NaN,
      cameraUp: [camera.up.x, camera.up.y, camera.up.z],
      mapsWidth: objects.earthMaterial.uniforms.hasMaps.value ? 512 : 0,
      subSolarFromScene() {
        const sun = objects.markers.get("sun");
        if (!sun) throw new Error("The scene has no Sun marker.");
        const direction: Vec3 = [sun.position.x, sun.position.y, sun.position.z];
        const rows = rowsFromMatrix(objects.earth);
        return sceneDirectionToGeo(new Date(debug.earthInstantMs), direction, rows);
      },
      markerLongitude(id) {
        const marker = objects.markers.get(id);
        if (!marker) throw new Error(`The scene has no marker for ${id}.`);
        return sceneToEcliptic([marker.position.x, marker.position.y, marker.position.z]).longitudeDeg;
      },
    };
    window.__MEDINI_DEBUG__ = debug;
    return () => {
      if (window.__MEDINI_DEBUG__ === debug) delete window.__MEDINI_DEBUG__;
    };
  }, [camera, objects]);

  useFrame(() => {
    const atlas = useAtlas.getState();
    const earthMs = earthInstantMs(atlas.instantMs, currentStepMs(atlas));
    const reading = readSky(atlas.instantMs);
    const previous = lastRef.current;
    const instantChanged = atlas.instantMs !== previous.instantMs;

    if (instantChanged || earthMs !== previous.earthMs) {
      const earthMatrix = earthToScene(new Date(earthMs));
      matrixFromRows(objects.earth, earthMatrix);
      objects.earth.updateMatrixWorld(true);

      for (const graha of reading.sky.grahas) {
        const point = eclipticToScene(graha.siderealLongitudeDeg, 0, RING_RADIUS);
        objects.markers.get(graha.id)?.position.set(point[0], point[1], point[2]);
        if (graha.id === "sun") {
          const sunScene = eclipticToScene(graha.siderealLongitudeDeg, graha.eclipticLatitudeDeg);
          const sunBody = apply(transpose(earthMatrix), sunScene);
          objects.earthMaterial.uniforms.sunDirection.value.set(sunBody[0], sunBody[1], sunBody[2]).normalize();
        }
      }

      const rahu = objects.markers.get("rahu")?.position;
      const ketu = objects.markers.get("ketu")?.position;
      if (rahu && ketu) {
        const attribute = objects.axis.geometry.getAttribute("position") as BufferAttribute;
        attribute.setXYZ(0, rahu.x, rahu.y, rahu.z);
        attribute.setXYZ(1, ketu.x, ketu.y, ketu.z);
        attribute.needsUpdate = true;
        objects.axis.geometry.computeBoundingSphere();
      }
    }

    const sky = skyEventsNow();
    if (instantChanged || atlas.eventId !== previous.eventId || sky !== previous.sky) {
      updatePins(objects, atlas.instantMs, atlas.eventId);
    }
    lastRef.current = { instantMs: atlas.instantMs, earthMs, eventId: atlas.eventId, sky };

    // First-load animation: the degree ticks draw in, the camera settles.
    if (introRef.current !== null) {
      const progress = Math.min(1, (performance.now() - introRef.current) / INTRO_MS);
      const ease = 1 - (1 - progress) ** 3;
      if (!userZoomedRef.current) camera.position.setLength(fitDistance * (1 + 0.25 * (1 - ease)));
      if (stepIntro(objects, progress)) invalidate();
      else introRef.current = null;
    }

    // Damping keeps the camera moving for a few frames after a drag.
    if (controlsRef.current?.update()) invalidate();

    const canvas = overlayRef.current;
    if (canvas) {
      drawOverlay(
        { canvas, camera, width: size.width, height: size.height, dpr: gl.getPixelRatio() },
        reading.sky,
        objects.markers,
        { instantMs: atlas.instantMs, stations: sky?.stations ?? [], selectedPin: objects.selectedPin },
      );
    }

    const debug = window.__MEDINI_DEBUG__;
    if (debug) {
      debug.frames += 1;
      debug.instantMs = atlas.instantMs;
      debug.earthInstantMs = earthMs;
    }
  });

  return <primitive object={objects.root} />;
}
