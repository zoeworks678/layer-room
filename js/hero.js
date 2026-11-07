import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

/* ------------------------------------------------------------------ */
/* Content: one entry per cake, in scroll order                        */
/* ------------------------------------------------------------------ */
const CAKES = [
  { file: 'models/berry_cake.glb',     field: '#d9e4bf', ink: '#7a1630' },
  { file: 'models/chocolate_cake.glb', field: '#e9c6bd', ink: '#3a1d12' },
  { file: 'models/ombre_cake.glb',     field: '#f3e4a4', ink: '#3e4f86' },
];
const LAST = CAKES.length - 1;

/* Wheel tuning */
const STEP = THREE.MathUtils.degToRad(50); // angle between cakes on the wheel
const CAKE_SIZE = 1.9;                     // world units for each cake's largest side
const SPIN_PER_STEP = Math.PI * 0.85;      // how far a cake turns on its own axis per step

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ */
/* DOM                                                                  */
/* ------------------------------------------------------------------ */
const hero = document.getElementById('hero');
const canvas = document.getElementById('hero-canvas');
const loadingEl = document.getElementById('loading');
const copyBlocks = [...document.querySelectorAll('.cake-copy')];
const pickerBtns = [...document.querySelectorAll('.picker button')];
const orderBtn = document.querySelector('.order-btn');
const rootStyle = document.documentElement.style;

/* ------------------------------------------------------------------ */
/* Three.js setup                                                       */
/* ------------------------------------------------------------------ */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

const key = new THREE.DirectionalLight(0xffffff, 0.6);
key.position.set(-3, 5, 4);
scene.add(key);

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
camera.position.set(0, 1.1, 9);
camera.lookAt(0, 0, 0);

/* Soft contact shadow, drawn once and shared by all cakes */
function makeShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.38)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.12)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const shadowMat = new THREE.MeshBasicMaterial({
  map: makeShadowTexture(), transparent: true, depthWrite: false, toneMapped: false,
});

const wheel = new THREE.Group();
scene.add(wheel);

/* Each cake: holder (position on the wheel) > spinner (turns on Y) > model */
const slots = CAKES.map(() => {
  const holder = new THREE.Group();
  const spinner = new THREE.Group();
  holder.add(spinner);
  holder.visible = false;
  wheel.add(holder);
  return { holder, spinner, height: CAKE_SIZE };
});

function fitModel(model, slot) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = CAKE_SIZE / Math.max(size.x, size.y, size.z);
  model.scale.setScalar(s);
  model.position.set(-center.x * s, -center.y * s, -center.z * s); // centre on origin
  slot.height = size.y * s;
  slot.spinner.add(model);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(CAKE_SIZE * 1.45, CAKE_SIZE * 1.45), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -slot.height / 2 + 0.005;
  slot.holder.add(shadow);
}

/* ------------------------------------------------------------------ */
/* Layout: where the "current" cake sits, per screen shape              */
/* ------------------------------------------------------------------ */
const layout = { x: 0, y: 0, scale: 1, radius: 3.6, step: STEP };

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  const dist = camera.position.length();
  const viewH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const viewW = viewH * camera.aspect;
  const mobile = w <= 760;

  if (mobile) {
    layout.scale = Math.min(1, viewW / 3.0);
    layout.x = 0;
    layout.y = viewH * 0.2;
    layout.step = STEP * 1.45;   // wider gaps on phones so waiting cakes stay off the copy
  } else {
    layout.step = STEP;
    layout.scale = Math.min(1.25, viewW / 6.2);
    layout.x = viewW * 0.22;
    layout.y = -viewH * 0.02;
  }
  layout.radius = 3.6 * layout.scale;
}

/* ------------------------------------------------------------------ */
/* State driven by scroll                                               */
/* ------------------------------------------------------------------ */
let target = 0;   // where scroll says we should be (0 … LAST)
let t = 0;        // smoothed value actually rendered
let intro = 0;    // 0 → 1 entrance once models load
let idle = 0;     // slow idle turn of the front cake
let ready = false;
let activeIndex = 0;

const lerpColor = (a, b, k) => gsap.utils.interpolate(a, b, k);

function applyTheme(v) {
  const i = Math.min(Math.floor(v), LAST - 1);
  const k = v - i;
  rootStyle.setProperty('--field', lerpColor(CAKES[i].field, CAKES[i + 1].field, k));
  rootStyle.setProperty('--ink', lerpColor(CAKES[i].ink, CAKES[i + 1].ink, k));
}

function applyCopy(v) {
  copyBlocks.forEach((el, k) => {
    const o = k - v;                                   // -1 above, 0 current, +1 below
    const opacity = Math.max(0, 1 - Math.abs(o) * 2.6);  // brief gap so blocks never overlap
    el.style.transform = `translate3d(0, ${o * 90}px, 0)`;
    el.style.opacity = opacity;
    el.style.visibility = opacity > 0.01 ? 'visible' : 'hidden';
  });

  const idx = Math.round(v);
  if (idx !== activeIndex) {
    activeIndex = idx;
    copyBlocks.forEach((el, k) => el.setAttribute('aria-hidden', k === idx ? 'false' : 'true'));
    pickerBtns.forEach((b, k) => b.setAttribute('aria-current', k === idx ? 'true' : 'false'));
    // "Order this cake" pre-selects whichever cake is showing
    orderBtn.dataset.cake = copyBlocks[idx].querySelector('.cake-name').textContent.trim();
  }
}

function applyWheel(v) {
  const introEase = 1 - Math.pow(1 - intro, 3);
  const pivotX = layout.x + layout.radius;
  const pivotY = layout.y;

  slots.forEach((slot, k) => {
    // Before the intro finishes, the whole wheel is wound back one extra step
    const a = (k - v + (1 - introEase) * 0.9) * layout.step;
    const dist = Math.abs(a) / layout.step;
    const { holder, spinner } = slot;

    holder.visible = ready && dist < 1.7;
    holder.position.set(
      pivotX - Math.cos(a) * layout.radius,
      pivotY - Math.sin(a) * layout.radius,
      -Math.min(dist, 1) * 0.8
    );
    holder.rotation.z = -a * 0.35;                       // lean into the curve
    holder.rotation.x = 0.12;
    holder.scale.setScalar(layout.scale * (1 - Math.min(dist, 1) * 0.28));
    spinner.rotation.y = (k - v) * SPIN_PER_STEP + idle - 0.5;
  });
}

/* ------------------------------------------------------------------ */
/* ScrollTrigger: pin the hero for two extra screens, then let go       */
/* ------------------------------------------------------------------ */
const st = ScrollTrigger.create({
  trigger: hero,
  start: 'top top',
  end: () => `+=${window.innerHeight * LAST}`,
  pin: true,
  anticipatePin: 1,
  snap: {
    snapTo: 1 / LAST,
    duration: reduceMotion ? 0.1 : { min: 0.25, max: 0.7 },
    delay: 0.05,
    ease: 'power2.inOut',
  },
  onUpdate: (self) => { target = self.progress * LAST; },
});

pickerBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const k = Number(btn.dataset.go);
    const y = st.start + (st.end - st.start) * (k / LAST);
    window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
  });
});

/* ------------------------------------------------------------------ */
/* Render loop (paused while the hero is off screen)                    */
/* ------------------------------------------------------------------ */
let heroVisible = true;
new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero);

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);

  t += (target - t) * (1 - Math.exp(-dt * (reduceMotion ? 30 : 9)));
  if (Math.abs(target - t) < 0.0005) t = target;

  if (ready && intro < 1) intro = reduceMotion ? 1 : Math.min(1, intro + dt / 1.4);
  if (!reduceMotion) idle += dt * 0.18;

  applyTheme(t);
  applyCopy(t);
  if (!heroVisible) return;
  applyWheel(t);
  renderer.render(scene, camera);
}

/* ------------------------------------------------------------------ */
/* Boot                                                                 */
/* ------------------------------------------------------------------ */
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

window.addEventListener('resize', () => { resize(); });
resize();
frame();

Promise.all(CAKES.map((c) => loader.loadAsync(c.file)))
  .then((gltfs) => {
    gltfs.forEach((g, k) => fitModel(g.scene, slots[k]));
    // Upload textures before revealing so the first spin doesn't stutter
    renderer.compile(scene, camera);
    ready = true;
    canvas.classList.add('is-ready');
    loadingEl.hidden = true;
    window.__heroReady = true;
  })
  .catch((err) => {
    console.error(err);
    loadingEl.textContent = "The cakes couldn't load. Refresh the page to try again.";
  });
