/**
 * One-off asset optimisation for the humans in public/models (spec: load
 * speed). Originals are kept outside public/ in models-original/ and are the
 * inputs every run, so the script is idempotent.
 *
 *   node scripts/optimize-avatars.mjs
 *
 * VALID avatars (public/models/people):
 * - drops every morph target (65 ARKit facial blend shapes per face mesh; the
 *   app never animates faces — they were ~60% of each file and >10 MB of GPU
 *   memory per model)
 * - downsamples textures to 1024² WebP (2048² decoded to 22 MB VRAM each)
 * - re-applies meshopt compression
 *
 * Soldier.glb is only the Mixamo clip source for retargetMixamoClips(): its
 * skinned mesh, materials and textures are dropped, leaving the bone nodes
 * and the four clips (2.1 MB → ~0.25 MB).
 */
import { mkdir, readdir, copyFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, meshopt, simplify } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

// OUT_DIR=public/models/people-lite MAX_TEX=512 node scripts/optimize-avatars.mjs → lightweight set for Fast/Balanced
const dir = process.env.OUT_DIR ?? 'public/models/people';
const backup = 'models-original/people';
const MAX_TEX = Number(process.env.MAX_TEX ?? 1024);
/** SIMPLIFY=0.4 keeps ~40% of triangles (lite set); unset = full geometry. */
const SIMPLIFY = process.env.SIMPLIFY ? Number(process.env.SIMPLIFY) : null;

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});

await mkdir(backup, { recursive: true });

// --- Soldier: animation-only ---
{
  const src = 'models-original/Soldier.glb';
  if (!existsSync(src)) await copyFile('public/models/Soldier.glb', src);
  const doc = await io.read(src);
  for (const mesh of doc.getRoot().listMeshes()) mesh.dispose();
  for (const skin of doc.getRoot().listSkins()) skin.dispose();
  await doc.transform(prune({ keepLeaves: true }));
  await io.write('public/models/Soldier.glb', doc);
  console.log(`Soldier.glb: ${((await stat(src)).size / 1e6).toFixed(2)} MB → ${((await stat('public/models/Soldier.glb')).size / 1e6).toFixed(2)} MB (animation only)`);
}

await mkdir(dir, { recursive: true });
for (const file of (await readdir(backup)).filter((f) => f.endsWith('.glb'))) {
  const src = path.join(backup, file);
  const before = (await stat(src)).size;

  const doc = await io.read(src);
  let targets = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const t of prim.listTargets()) {
        prim.removeTarget(t);
        t.dispose();
        targets++;
      }
    }
    mesh.setWeights([]);
  }
  await doc.transform(
    prune(),
    dedup(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [MAX_TEX, MAX_TEX], quality: 85 }),
    ...(SIMPLIFY ? [simplify({ simplifier: MeshoptSimplifier, ratio: SIMPLIFY, error: 0.002 })] : []),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const out = path.join(dir, file);
  await io.write(out, doc);
  const after = (await stat(out)).size;
  console.log(`${file}: ${(before / 1e6).toFixed(2)} MB → ${(after / 1e6).toFixed(2)} MB (−${targets} morph targets)`);
}
