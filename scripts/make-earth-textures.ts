/**
 * Makes the Earth textures in public/textures from 2 NASA Earth Observatory
 * maps. The originals are large, so they are not in the repository. Download
 * them into one folder, then run:
 *
 *   node --no-warnings scripts/make-earth-textures.ts <folder with the originals>
 *
 * The script checks the SHA-256 of each original, so the textures can be made
 * again from the same files. Sources and credits: CREDITS.md and
 * docs/DATA-SOURCES.md. NASA asks for credit and forbids any suggestion of
 * endorsement. The textures carry no NASA logo.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";

interface Source {
  file: string;
  url: string;
  sha256: string;
  output: string;
}

const SOURCES: Source[] = [
  {
    // Blue Marble Next Generation, July 2004, with topography and bathymetry shading.
    file: "world.topo.bathy.200407.3x5400x2700.jpg",
    url: "https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/july/world.topo.bathy.200407.3x5400x2700.jpg",
    sha256: "4f4240673a3a1b173d61b92ca4b07bac5fd17059ea5f725ba6da5a9c5386b7ba",
    output: "earth-day",
  },
  {
    // Black Marble 2016, grayscale, 3 km per pixel. The shader tints the lights.
    file: "BlackMarble_2016_3km_gray.jpg",
    url: "https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144897/BlackMarble_2016_3km_gray.jpg",
    sha256: "3fbc8aae3529dc1ebfcf3aa9361bd3dfc11d19950a6af6d8ed2df61bd8b0134d",
    output: "earth-night",
  },
];

/** 512 px is the placeholder. Phones load 2048 px, desktops 4096 px (plan, M3). */
const WIDTHS = [512, 2048, 4096];
const QUALITY = 82;
const OUTPUT_DIR = new URL("../public/textures/", import.meta.url);

async function main(): Promise<void> {
  const folder = process.argv[2];
  if (!folder) {
    throw new Error("Give the folder that holds the original NASA maps.");
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const source of SOURCES) {
    const path = join(folder, source.file);
    const bytes = readFileSync(path);
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== source.sha256) {
      throw new Error(`${source.file}: SHA-256 ${digest} differs from ${source.sha256}. Download it again from ${source.url}`);
    }

    for (const width of WIDTHS) {
      const target = new URL(`${source.output}-${width}.webp`, OUTPUT_DIR);
      // Equirectangular maps are 2:1. Lanczos keeps coastlines and city lights sharp.
      await sharp(bytes, { limitInputPixels: 13_500 * 6_750 })
        .resize(width, width / 2, { kernel: "lanczos3" })
        .webp({ quality: QUALITY, effort: 6 })
        .toFile(target.pathname.replace(/^\/([A-Za-z]:)/, "$1"));
      const kib = Math.round(statSync(target).size / 1024);
      console.log(`${source.output}-${width}.webp  ${width}x${width / 2}  ${kib} KiB`);
    }
  }
}

await main();
