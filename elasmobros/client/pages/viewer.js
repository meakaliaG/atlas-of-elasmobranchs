import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';

// ─── Scene Setup ────────────────────────────────────────────────────────────

const canvas = document.getElementById('modelCanvas');
const container = document.getElementById('viewerContainer');

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true, // transparent background so the water video shows through
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
);
camera.position.set(0, 1.5, 5);

// ─── Controls ────────────────────────────────────────────────────────────────

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 1.5;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI * 0.85;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.6;

// Pause auto-rotate while user is interacting
renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; });
renderer.domElement.addEventListener('pointerup',   () => { controls.autoRotate = true; });

// ─── Lighting ────────────────────────────────────────────────────────────────

// Ambient — cool blue-tinted underwater feel
const ambient = new THREE.AmbientLight(0x88ccff, 0.9);
scene.add(ambient);

// Key light from above (sun filtering through water)
const keyLight = new THREE.DirectionalLight(0xd0eeff, 2.5);
keyLight.position.set(3, 6, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 0.1;
keyLight.shadow.camera.far = 30;
scene.add(keyLight);

// Rim light — caustic shimmer from below
const rimLight = new THREE.PointLight(0x00aaff, 1.2, 20);
rimLight.position.set(-3, -2, 2);
scene.add(rimLight);

// Fill light
const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
fillLight.position.set(-4, 2, -3);
scene.add(fillLight);

// ─── Caustic Floor Plane ─────────────────────────────────────────────────────

const floorGeo = new THREE.PlaneGeometry(20, 20);
const floorMat = new THREE.MeshStandardMaterial({
    color: 0x004466,
    roughness: 0.8,
    metalness: 0.1,
    transparent: true,
    opacity: 0.1,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -2;
floor.receiveShadow = true;
scene.add(floor);

// ─── Procedural Shark Placeholder ───────────────────────────────────────────
// Visible only until a real model is loaded. Delete this block once models are loaded
// GLTF/OBJ, or call removePlaceholder() before loadModel().

let placeholderGroup = null;

const buildPlaceholder = () => {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
        color: 0x5588aa,
        roughness: 0.4,
        metalness: 0.3,
    });

    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.4, 1.6, 8, 16);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    group.add(body);

    // Dorsal fin
    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(0, 0);
    dorsalShape.lineTo(0.15, 0.55);
    dorsalShape.lineTo(0.45, 0);
    dorsalShape.closePath();
    const dorsalGeo = new THREE.ShapeGeometry(dorsalShape);
    const dorsal = new THREE.Mesh(dorsalGeo, mat);
    dorsal.position.set(0, 0.4, 0);
    dorsal.rotation.y = Math.PI / 2;
    group.add(dorsal);

    // Pectoral fins (left & right)
    const pectoralShape = new THREE.Shape();
    pectoralShape.moveTo(0, 0);
    pectoralShape.lineTo(0, -0.5);
    pectoralShape.lineTo(0.4, -0.2);
    pectoralShape.closePath();
    const pGeo = new THREE.ShapeGeometry(pectoralShape);

    const pLeft = new THREE.Mesh(pGeo, mat);
    pLeft.position.set(0.05, -0.15, 0.42);
    pLeft.rotation.x = -0.3;
    group.add(pLeft);

    const pRight = new THREE.Mesh(pGeo, mat);
    pRight.position.set(0.05, -0.15, -0.42);
    pRight.rotation.x = 0.3;
    pRight.rotation.y = Math.PI;
    group.add(pRight);

    // Tail
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.lineTo(-0.4,  0.35);
    tailShape.lineTo(-0.15, 0);
    tailShape.lineTo(-0.4, -0.35);
    tailShape.closePath();
    const tailGeo = new THREE.ShapeGeometry(tailShape);
    const tail = new THREE.Mesh(tailGeo, mat);
    tail.position.set(-0.92, 0, 0);
    tail.rotation.y = Math.PI / 2;
    group.add(tail);

    // Eye
    const eyeGeo = new THREE.SphereGeometry(0.055, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1 });
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0.82, 0.14, 0.32);
    group.add(eye);

    scene.add(group);
    return group;
};

const removePlaceholder = () => {
    if (placeholderGroup) {
        scene.remove(placeholderGroup);
        placeholderGroup.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
        placeholderGroup = null;
    }
};

placeholderGroup = buildPlaceholder();

// ─── Model Loading ───────────────────────────────────────────────────────────

let currentModel = null;

const setStatus = (msg, isError = false) => {
    const el = document.getElementById('viewerStatus');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? '#ff6b6b' : '#a8d8ea';
    el.style.display = msg ? 'block' : 'none';
};

const centerAndScaleModel = (object) => {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Normalize to fit within a 3-unit bounding box
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 3 / maxDim;
    object.scale.setScalar(scale);

    // Re-center after scaling
    box.setFromObject(object);
    box.getCenter(center);
    object.position.sub(center);
    object.position.y += 0.2; // slight lift off floor
};

/**
 * Load a GLTF or GLB model.
 * @param {string} url - path relative to /assets, e.g. '/assets/models/shark.glb'
 */
export const loadGLTF = (url) => {
    removePlaceholder();
    if (currentModel) scene.remove(currentModel);
    setStatus('Loading model…');

    const loader = new GLTFLoader();
    loader.load(
        url,
        (gltf) => {
            currentModel = gltf.scene;
            currentModel.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            centerAndScaleModel(currentModel);
            scene.add(currentModel);
            setStatus('');
        },
        (xhr) => {
            const pct = Math.round((xhr.loaded / xhr.total) * 100);
            setStatus(`Loading… ${pct}%`);
        },
        (err) => {
            console.error('GLTF load error:', err);
            setStatus('Failed to load model.', true);
            placeholderGroup = buildPlaceholder(); // restore placeholder on error
        }
    );
};

/**
 * Load an OBJ model, optionally with a paired MTL material file.
 * @param {string} objUrl  - e.g. '/assets/models/shark.obj'
 * @param {string} [mtlUrl] - e.g. '/assets/models/shark.mtl'  (optional)
 */
export const loadOBJ = (objUrl, mtlUrl = null) => {
    removePlaceholder();
    if (currentModel) scene.remove(currentModel);
    setStatus('Loading model…');

    const doLoad = (materials) => {
        const loader = new OBJLoader();
        if (materials) loader.setMaterials(materials);

        loader.load(
            objUrl,
            (obj) => {
                currentModel = obj;
                obj.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (!materials) {
                            // Fallback material if no MTL
                            child.material = new THREE.MeshStandardMaterial({
                                color: 0x7799bb,
                                roughness: 0.5,
                                metalness: 0.2,
                            });
                        }
                    }
                });
                centerAndScaleModel(obj);
                scene.add(obj);
                setStatus('');
            },
            (xhr) => {
                const pct = Math.round((xhr.loaded / xhr.total) * 100);
                setStatus(`Loading… ${pct}%`);
            },
            (err) => {
                console.error('OBJ load error:', err);
                setStatus('Failed to load model.', true);
                placeholderGroup = buildPlaceholder();
            }
        );
    };

    if (mtlUrl) {
        const mtlLoader = new MTLLoader();
        mtlLoader.load(mtlUrl, (materials) => {
            materials.preload();
            doLoad(materials);
        });
    } else {
        doLoad(null);
    }
};

// ─── Model Switcher UI ───────────────────────────────────────────────────────
// Wires up the dropdown in the viewer panel to load different models.

const initModelSwitcher = () => {
    const select = document.getElementById('modelSelect');
    if (!select) return;

    select.addEventListener('change', (e) => {
        const val = e.target.value;
        if (!val) return;

        const ext = val.split('.').pop().toLowerCase();
        if (ext === 'glb' || ext === 'gltf') {
            loadGLTF(`/assets/models/${val}`);
        } else if (ext === 'obj') {
            // Assumes a paired .mtl with same base name lives alongside the .obj
            const mtlVal = val.replace(/\.obj$/i, '.mtl');
            loadOBJ(`/assets/models/${val}`, `/assets/models/${mtlVal}`);
        }
    });
};

// ─── Resize Handler ───────────────────────────────────────────────────────────

const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
};
window.addEventListener('resize', onResize);

// ─── Render Loop ─────────────────────────────────────────────────────────────

const timer = new THREE.Timer();

const animate = () => {
    requestAnimationFrame(animate);
    const t = timer.getElapsed();

    // Gentle undulation on the placeholder shark
    if (placeholderGroup) {
        placeholderGroup.rotation.y = Math.sin(t * 0.4) * 0.25;
        placeholderGroup.position.y = Math.sin(t * 0.7) * 0.08;
    }

    // Animate caustic rim light
    rimLight.position.x = Math.sin(t * 0.5) * 3;
    rimLight.position.z = Math.cos(t * 0.5) * 3;

    controls.update();
    renderer.render(scene, camera);
};

// ─── Init ─────────────────────────────────────────────────────────────────────

initModelSwitcher();
animate();
