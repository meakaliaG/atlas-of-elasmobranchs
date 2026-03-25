/**
 * viewer.js — Elasmobranch Atlas
 *
 * Full-screen underwater Three.js scene.
 * A procedural shark placeholder swims a figure-8 path until a real model
 * is injected via loadGLTF() or loadOBJ().
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader }    from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader }     from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader }     from 'three/examples/jsm/loaders/MTLLoader.js';

// ─── Renderer ─────────────────────────────────────────────────────────────────

const canvas = document.getElementById('modelCanvas');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace  = THREE.SRGBColorSpace;
renderer.toneMapping        = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
renderer.shadowMap.enabled  = true;
renderer.shadowMap.type     = THREE.PCFSoftShadowMap;

// ─── Scene & Fog ──────────────────────────────────────────────────────────────

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x00060f);

// Exponential fog sells the depth-of-water feeling better than linear
scene.fog = new THREE.FogExp2(0x003977, 0.028);

// ─── Camera ───────────────────────────────────────────────────────────────────

const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    200,
);
camera.position.set(0, 1.5, 14);

// ─── Orbit Controls ───────────────────────────────────────────────────────────

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping  = true;
controls.dampingFactor  = 0.05;
controls.minDistance    = 3;
controls.maxDistance    = 35;
controls.maxPolarAngle  = Math.PI * 0.88;
controls.target.set(0, 0, 0);
controls.autoRotate      = false; // camera stays where the user leaves it

// ─── Lighting ─────────────────────────────────────────────────────────────────

// Deep ambient — very blue, low intensity; nothing is truly dark underwater
const ambient = new THREE.AmbientLight(0x0059b2, 3.5);
scene.add(ambient);

// Directional "sun shaft" filtering down from above the surface
const sunLight = new THREE.DirectionalLight(0x4488bb, 1.6);
sunLight.position.set(3, 18, 6);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near   = 0.5;
sunLight.shadow.camera.far    = 50;
sunLight.shadow.camera.left   = -20;
sunLight.shadow.camera.right  =  20;
sunLight.shadow.camera.top    =  20;
sunLight.shadow.camera.bottom = -20;
sunLight.shadow.bias          = -0.001;
scene.add(sunLight);

// ── Caustic point lights — animated to mimic refracted surface light ──────────

const CAUSTIC_DEFS = [
    { color: 0x0055bb, base: 3.2, radius: 28 },
    { color: 0x007acc, base: 2.6, radius: 22 },
    { color: 0x00aadd, base: 2.0, radius: 18 },
    { color: 0x004488, base: 3.8, radius: 26 },
];

const causticLights = CAUSTIC_DEFS.map((def, i) => {
    const light = new THREE.PointLight(def.color, def.base, def.radius);
    const phase = (i / CAUSTIC_DEFS.length) * Math.PI * 2;
    light.position.set(
        Math.cos(phase) * 7,
        4 + i * 0.6,
        Math.sin(phase) * 7,
    );
    scene.add(light);
    return { light, phase, base: def.base, speed: 0.28 + i * 0.04 };
});

// ─── God Rays (light shaft cones) ─────────────────────────────────────────────

const rayMat = new THREE.MeshBasicMaterial({
    color: 0x003366,
    transparent: true,
    opacity: 0.055,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
});

for (let i = 0; i < 7; i++) {
    const h   = 22 + Math.random() * 8;
    const geo = new THREE.ConeGeometry(2 + Math.random() * 2.5, h, 5, 1, true);
    const ray = new THREE.Mesh(geo, rayMat.clone());
    ray.material.opacity = 0.03 + Math.random() * 0.05;
    // Offset the geometry so the apex is at the mesh origin (the "source")
    geo.translate(0, -h / 2, 0);
    ray.position.set(
        (Math.random() - 0.5) * 20,
        14,                           // hang from just above the surface plane
        (Math.random() - 0.5) * 20,
    );
    ray.rotation.z = Math.PI;         // open end faces down
    scene.add(ray);
}

// ─── Water Surface Plane (seen from below) ─────────────────────────────────

const SURFACE_Y = 14;
const surfaceGeo = new THREE.PlaneGeometry(80, 80, 32, 32);
const surfaceMat = new THREE.MeshStandardMaterial({
    color: 0x003d55,
    transparent: true,
    opacity: 0.55,
    side: THREE.BackSide,
    roughness: 0.0,
    metalness: 0.9,
    envMapIntensity: 1.2,
});
const surfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
surfaceMesh.rotation.x = Math.PI / 2;
surfaceMesh.position.y  = SURFACE_Y;
scene.add(surfaceMesh);

// Cache the original Y values so we can animate ripples
const surfacePositions = surfaceGeo.attributes.position;
const surfaceOrigY = new Float32Array(surfacePositions.count);
for (let i = 0; i < surfacePositions.count; i++) {
    surfaceOrigY[i] = surfacePositions.getY(i);
}

// ─── Particles (plankton / sediment) ──────────────────────────────────────────

const PARTICLE_COUNT = 1400;
const pArr   = new Float32Array(PARTICLE_COUNT * 3);
const pSpeed = new Float32Array(PARTICLE_COUNT);

for (let i = 0; i < PARTICLE_COUNT; i++) {
    pArr[i * 3]     = (Math.random() - 0.5) * 60;
    pArr[i * 3 + 1] = (Math.random() - 0.5) * 35;
    pArr[i * 3 + 2] = (Math.random() - 0.5) * 60;
    pSpeed[i]        = 0.004 + Math.random() * 0.008;
}

const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3));

const pMat = new THREE.PointsMaterial({
    color: 0x55aacc,
    size: 0.065,
    transparent: true,
    opacity: 0.28,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});

const particleSystem = new THREE.Points(pGeo, pMat);
scene.add(particleSystem);

// ─── Procedural Shark ─────────────────────────────────────────────────────────
//
// Hierarchy:
//   sharkRoot       ← positioned & yaw-rotated along the swim path
//     └ sharkPivot  ← rotation.y = +PI/2  →  body's +X maps to root's +Z (forward)
//         ├ body, snout, fins, eye meshes
//         └ tailGroup  ← rotation.y is animated for side-to-side wag
//

let sharkRoot    = null;
let sharkPivot   = null;
let tailGroup    = null;
let currentModel = null; // holds an injected real model (GLTF/OBJ)

const buildPlaceholderShark = () => {
    const root  = new THREE.Group();
    const pivot = new THREE.Group();
    pivot.rotation.y = Math.PI / 2; // align body's +X with root's +Z
    root.add(pivot);

    const darkMat = new THREE.MeshStandardMaterial({ color: 0x3d5f74, roughness: 0.35, metalness: 0.45 });
    const bellMat = new THREE.MeshStandardMaterial({ color: 0x8aaabb, roughness: 0.4,  metalness: 0.2  });

    // ── Body
    const bodyGeo = new THREE.CapsuleGeometry(0.38, 1.85, 10, 24);
    const body    = new THREE.Mesh(bodyGeo, darkMat);
    body.rotation.z = Math.PI / 2; // capsule (Y-axis) → along X-axis
    body.castShadow = true;
    pivot.add(body);

    // ── Belly overlay (lighter underside)
    const bellyGeo = new THREE.CapsuleGeometry(0.3, 1.5, 8, 16);
    const belly    = new THREE.Mesh(bellyGeo, bellMat);
    belly.rotation.z  = Math.PI / 2;
    belly.position.y  = -0.08;
    belly.position.x  = 0.1;
    belly.scale.z     = 0.55;
    pivot.add(belly);

    // ── Snout (tapered cone at +X)
    const snoutGeo = new THREE.ConeGeometry(0.19, 0.5, 10);
    const snout    = new THREE.Mesh(snoutGeo, darkMat);
    snout.rotation.z  = -Math.PI / 2;
    snout.position.x  =  1.15;
    snout.castShadow  = true;
    pivot.add(snout);

    // ── Dorsal fin (curved shape)
    const dShape = new THREE.Shape();
    dShape.moveTo(0, 0);
    dShape.quadraticCurveTo(-0.06, 0.38, 0.08, 0.68);
    dShape.lineTo(0.52, 0);
    dShape.closePath();
    const dorsalGeo = new THREE.ShapeGeometry(dShape);
    const dorsal    = new THREE.Mesh(dorsalGeo, darkMat);
    dorsal.position.set(0.1, 0.38, 0);
    dorsal.rotation.y = Math.PI / 2;
    pivot.add(dorsal);

    // ── Pectoral fins (left & right)
    const pShape = new THREE.Shape();
    pShape.moveTo(0, 0);
    pShape.quadraticCurveTo(0.08, -0.28, -0.06, -0.62);
    pShape.lineTo(0.52, -0.18);
    pShape.closePath();
    const pFinGeo = new THREE.ShapeGeometry(pShape);

    [1, -1].forEach((side) => {
        const fin = new THREE.Mesh(pFinGeo, darkMat);
        fin.position.set(0.22, -0.1, side * 0.4);
        fin.rotation.x  = -side * 0.32;
        fin.rotation.y  = side > 0 ? 0 : Math.PI;
        pivot.add(fin);
    });

    // ── Second dorsal (small, further back)
    const d2Shape = new THREE.Shape();
    d2Shape.moveTo(0, 0);
    d2Shape.lineTo(0.06, 0.22);
    d2Shape.lineTo(0.26, 0);
    d2Shape.closePath();
    const d2Geo = new THREE.ShapeGeometry(d2Shape);
    const d2    = new THREE.Mesh(d2Geo, darkMat);
    d2.position.set(-0.5, 0.38, 0);
    d2.rotation.y = Math.PI / 2;
    pivot.add(d2);

    // ── Pelvic fins
    const pvShape = new THREE.Shape();
    pvShape.moveTo(0, 0);
    pvShape.lineTo(0, -0.28);
    pvShape.lineTo(0.3, -0.08);
    pvShape.closePath();
    const pvGeo = new THREE.ShapeGeometry(pvShape);

    [1, -1].forEach((side) => {
        const fin = new THREE.Mesh(pvGeo, darkMat);
        fin.position.set(-0.35, -0.25, side * 0.35);
        fin.rotation.x  = -side * 0.2;
        fin.rotation.y  = side > 0 ? 0 : Math.PI;
        pivot.add(fin);
    });

    // ── Tail group — waggled around Y each frame
    const tg = new THREE.Group();
    tg.position.x = -1.0; // at the tail end of the body (-X)
    pivot.add(tg);

    const tailShape = new THREE.Shape();
    tailShape.moveTo(0,  0);
    tailShape.quadraticCurveTo(-0.15,  0.28, -0.44,  0.45);
    tailShape.lineTo(-0.18, 0);
    tailShape.quadraticCurveTo(-0.15, -0.28, -0.44, -0.45);
    tailShape.closePath();
    const tailGeo  = new THREE.ShapeGeometry(tailShape);
    const tailMesh = new THREE.Mesh(tailGeo, darkMat);
    tailMesh.rotation.y = Math.PI / 2;
    tg.add(tailMesh);

    // ── Eye (both sides)
    const eyeGeo = new THREE.SphereGeometry(0.055, 10, 10);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000008, roughness: 0.05, metalness: 0.6 });

    [0.33, -0.33].forEach((side) => {
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(0.85, 0.14, side);
        pivot.add(eye);
    });

    scene.add(root);
    return { root, pivot, tg };
};

({ root: sharkRoot, pivot: sharkPivot, tg: tailGroup } = buildPlaceholderShark());

// ─── Swimming Path — Lemniscate of Bernoulli (figure-8) ──────────────────────

const SWIM_A     = 6.5;  // path radius
const SWIM_SPEED = 0.26; // radians per second

/**
 * Returns a position Vector3 on the figure-8 path for parameter t.
 */
const swimPos = (t) => {
    const s     = Math.sin(t);
    const denom = 1 + s * s;
    return new THREE.Vector3(
        SWIM_A * Math.cos(t) / denom,
        Math.sin(t * 0.6) * 0.9,         // gentle vertical oscillation
        SWIM_A * s * Math.cos(t) / denom,
    );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const setStatus = (msg, isError = false) => {
    const el = document.getElementById('viewerStatus');
    if (!el) return;
    el.textContent  = msg;
    el.style.color  = isError ? '#ff6b6b' : '#00d4ff';
    el.style.display = msg ? 'block' : 'none';
};

const setSpecimenOverlay = (name, classification) => {
    const el = document.getElementById('specimenOverlay');
    if (!el) return;
    document.getElementById('specimenName').textContent  = name;
    document.getElementById('specimenClass').textContent = classification;
    el.classList.toggle('visible', !!(name || classification));
};

const centerAndScaleModel = (object) => {
    const box    = new THREE.Box3().setFromObject(object);
    const size   = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale  = 3 / Math.max(size.x, size.y, size.z);
    object.scale.setScalar(scale);
    box.setFromObject(object);
    box.getCenter(center);
    object.position.sub(center);
};

// ─── Model Loaders (public API) ───────────────────────────────────────────────

/**
 * Replace the placeholder shark with a GLTF/GLB model that will swim the
 * same figure-8 path automatically.
 *
 * @param {string} url          Path to the .glb / .gltf file
 * @param {string} [name]       Specimen display name (optional)
 * @param {string} [cls]        Taxonomic class label (optional)
 */
export const loadGLTF = (url, name = '', cls = '') => {
    setStatus('Loading model…');

    // Hide the procedural shark while loading
    if (sharkRoot) sharkRoot.visible = false;
    if (currentModel) scene.remove(currentModel);

    new GLTFLoader().load(
        url,
        (gltf) => {
            currentModel = gltf.scene;
            currentModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow    = true;
                    child.receiveShadow = true;
                }
            });
            centerAndScaleModel(currentModel);
            scene.add(currentModel);
            setStatus('');
            setSpecimenOverlay(name, cls);
        },
        (xhr) => setStatus(`Loading… ${Math.round((xhr.loaded / xhr.total) * 100)}%`),
        (err) => {
            console.error('GLTF load error:', err);
            setStatus('Failed to load model.', true);
            if (sharkRoot) sharkRoot.visible = true; // restore placeholder
        },
    );
};

/**
 * Replace the placeholder with an OBJ model (+ optional MTL).
 *
 * @param {string} objUrl
 * @param {string} [mtlUrl]
 * @param {string} [name]
 * @param {string} [cls]
 */
export const loadOBJ = (objUrl, mtlUrl = null, name = '', cls = '') => {
    setStatus('Loading model…');
    if (sharkRoot) sharkRoot.visible = false;
    if (currentModel) scene.remove(currentModel);

    const doLoad = (materials) => {
        const loader = new OBJLoader();
        if (materials) loader.setMaterials(materials);

        loader.load(
            objUrl,
            (obj) => {
                currentModel = obj;
                obj.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow    = true;
                        child.receiveShadow = true;
                        if (!materials) {
                            child.material = new THREE.MeshStandardMaterial({
                                color: 0x557799, roughness: 0.45, metalness: 0.3,
                            });
                        }
                    }
                });
                centerAndScaleModel(obj);
                scene.add(obj);
                setStatus('');
                setSpecimenOverlay(name, cls);
            },
            (xhr) => setStatus(`Loading… ${Math.round((xhr.loaded / xhr.total) * 100)}%`),
            (err) => {
                console.error('OBJ load error:', err);
                setStatus('Failed to load model.', true);
                if (sharkRoot) sharkRoot.visible = true;
            },
        );
    };

    if (mtlUrl) {
        const mtl = new MTLLoader();
        mtl.load(mtlUrl, (mats) => { mats.preload(); doLoad(mats); });
    } else {
        doLoad(null);
    }
};

loadOBJ(
    '/assets/models/juvenileGreat.obj',
    '/assets/models/juvenileGreat.mtl', // or null if there's no .mtl
    'Juvenile Great White',
    'Lamniformes'
);

// ─── Resize Handler ───────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Render Loop ──────────────────────────────────────────────────────────────

const clock = new THREE.Timer();
let swimT = 0;

const _dir  = new THREE.Vector3();
const _up   = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();

const animate = () => {
    requestAnimationFrame(animate);

    const delta   = clock.getDelta();
    const elapsed = clock.getElapsed();

    // ── Shark / active model swimming ──────────────────────────────────────
    swimT += delta * SWIM_SPEED;

    const pos  = swimPos(swimT);
    const look = swimPos(swimT + 0.025); // lookahead point for orientation

    // const activeModel = currentModel ?? sharkRoot;

    // if (activeModel) {
    //     activeModel.position.copy();

    //     // Smooth yaw toward travel direction
    //     _dir.copy(look).sub(pos).normalize();
    //     const yaw   = Math.atan2(_dir.x, _dir.z);
    //     const pitch = Math.asin(THREE.MathUtils.clamp(-_dir.y, -1, 1));

    //     // Use YXZ order: heading first, then pitch
    //     activeModel.rotation.set(pitch, yaw, Math.sin(swimT * 1.8) * 0.09, 'YXZ');
    // }

    // // ── Placeholder-specific animation ─────────────────────────────────────
    // if (sharkRoot && sharkRoot.visible) {
    //     // Tail wag — side-to-side in sharkPivot local space (= world horizontal)
    //     tailGroup.rotation.y  = Math.sin(elapsed * 2.7) * 0.44;

    //     // Subtle body undulation (phase-offset from tail for S-curve feel)
    //     sharkPivot.rotation.y = Math.sin(elapsed * 2.7 - 0.7) * 0.06;
    // }

    // Shark / active model swimming
    const activeModel = currentModel ?? sharkRoot;

    if (activeModel?.position) {
        activeModel.position.copy(pos);

        _dir.copy(look).sub(pos).normalize();
        const yaw   = Math.atan2(_dir.x, _dir.z);
        const pitch = Math.asin(THREE.MathUtils.clamp(-_dir.y, -1, 1));

        activeModel.rotation.set(pitch, yaw, Math.sin(swimT * 1.8) * 0.09, 'YXZ');
    }

    // Placeholder-specific animation
    if (sharkRoot?.visible && tailGroup && sharkPivot) {
        tailGroup.rotation.y  = Math.sin(elapsed * 2.7) * 0.44;
        sharkPivot.rotation.y = Math.sin(elapsed * 2.7 - 0.7) * 0.06;
    }

    // ── Caustic lights ─────────────────────────────────────────────────────
    causticLights.forEach(({ light, phase, base, speed }) => {
        light.position.x  = Math.sin(elapsed * speed + phase) * 9;
        light.position.z  = Math.cos(elapsed * speed * 0.75 + phase) * 9;
        light.intensity   = base + Math.sin(elapsed * 1.8 + phase) * 0.55;
    });

    // ── Water surface ripple ───────────────────────────────────────────────
    for (let i = 0; i < surfacePositions.count; i++) {
        const x = surfacePositions.getX(i);
        const z = surfacePositions.getZ(i);
        surfacePositions.setY(
            i,
            surfaceOrigY[i]
            + Math.sin(x * 0.45 + elapsed * 0.9)  * 0.28
            + Math.cos(z * 0.35 + elapsed * 0.65) * 0.18,
        );
    }
    surfacePositions.needsUpdate = true;
    surfaceGeo.computeVertexNormals();

    // ── Particles drift upward ─────────────────────────────────────────────
    const pos3 = pGeo.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        pos3[i * 3 + 1] += pSpeed[i];
        if (pos3[i * 3 + 1] > 18) pos3[i * 3 + 1] = -18;
    }
    pGeo.attributes.position.needsUpdate = true;

    // ── Subtle camera drift (floating-in-water feel) ────────────────────────
    camera.position.x += Math.sin(elapsed * 0.12) * 0.0012;
    camera.position.y += Math.sin(elapsed * 0.17) * 0.0008;

    controls.update();
    renderer.render(scene, camera);
};

animate();
