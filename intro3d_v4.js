/* ===== 에이도 3D 인트로 v4 (2026-10-29): "에이도 해부도" =====
   참고: OCTABOOT(The Anatomy of a Suit) 릴스 — 어둠 속 선 → 부품이 한 겹씩 채워짐 → 완성 → 착용.
   흐름: 흰 선으로 그린 안경 → 프레임 → 카메라 → 렌즈 → 코받침(골전도) → 다리(투시: 속 부품) → 완성 49g
         → 좌→우 회전해 뒷면이 나를 향함 → 한쪽 렌즈 뒤(눈 위치)로 들어가 착용 → 1인칭 장면(pov_shoot.webp).
   모델은 실물 사진을 보고 만든 단순화 3D(mm 단위). 제조사 3D 파일을 받으면 교체 가능. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SHAPE } from './eido_shape.js?v=1'; // 실물 정면 사진에서 딴 윤곽

const section = document.getElementById('intro');
const stage = document.getElementById('introStage');
const canvas = document.getElementById('introCanvas');
const beats = [...document.querySelectorAll('.ibeat')];
const bar = document.getElementById('introBar');
const wearBlur = document.getElementById('wearBlur');

let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
catch (e) { stage.classList.add('no-webgl'); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
const camera = new THREE.PerspectiveCamera(30, 1, 1, 6000);

/* ---------- 도우미 ---------- */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (p, a, b) => clamp((p - a) / (b - a));
const io = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const sm = t => t * t * (3 - 2 * t);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function roundedPoly(sh, pts, radii) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], a0 = pts[(i - 1 + n) % n], b0 = pts[(i + 1) % n];
    const r = Array.isArray(radii) ? radii[i] : radii;
    const v1 = new THREE.Vector2(a0[0] - p[0], a0[1] - p[1]), v2 = new THREE.Vector2(b0[0] - p[0], b0[1] - p[1]);
    const r1 = Math.min(r, v1.length() / 2), r2 = Math.min(r, v2.length() / 2);
    v1.normalize(); v2.normalize();
    const A = [p[0] + v1.x * r1, p[1] + v1.y * r1], B = [p[0] + v2.x * r2, p[1] + v2.y * r2];
    if (i === 0) sh.moveTo(A[0], A[1]); else sh.lineTo(A[0], A[1]);
    sh.quadraticCurveTo(p[0], p[1], B[0], B[1]);
  }
  sh.closePath(); return sh;
}
const lensPts = (cx, s = 1) => {
  const sgn = Math.sign(cx), c = [38, -1];
  return [[15, 18], [63, 18], [60, -19.5], [19, -19.5]].map(([x, y]) => [sgn * (c[0] + (x - c[0]) * s), c[1] + (y - c[1]) * s]);
};
const lensRadii = [6, 8, 16, 14];

/* ---------- 재질 ---------- */
const BASE = {
  frame: new THREE.MeshPhysicalMaterial({ color: 0x0f0f0f, roughness: 0.7, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.6, envMapIntensity: 0.5 }),
  lens: new THREE.MeshPhysicalMaterial({ color: 0x0d0e12, roughness: 0.05, metalness: 0.15, clearcoat: 1, envMapIntensity: 0.9, side: THREE.DoubleSide }),
  metal: new THREE.MeshStandardMaterial({ color: 0xdedee3, metalness: 1, roughness: 0.26, envMapIntensity: 1.2 }),
  pad: new THREE.MeshPhysicalMaterial({ color: 0xf2efe8, roughness: 0.3, transmission: 0.9, thickness: 2 }),
  camRing: new THREE.MeshStandardMaterial({ color: 0x090909, metalness: 0.7, roughness: 0.22 }),
  camGlass: new THREE.MeshPhysicalMaterial({ color: 0x05070d, metalness: 0.4, roughness: 0.04, clearcoat: 1, envMapIntensity: 1.1 }),
  iris: new THREE.MeshStandardMaterial({ color: 0x2a3770, emissive: 0x18224a, emissiveIntensity: 0.8, roughness: 0.2 }),
  led: new THREE.MeshStandardMaterial({ color: 0x9aa0ad, emissive: 0x6c7690, emissiveIntensity: 0.2, roughness: 0.35 }),
  red: new THREE.MeshStandardMaterial({ color: 0xd8322a, emissive: 0x501010, roughness: 0.4 }),
};
// 색조합(2026-10-29 사용자 선택): 제트 블랙 #0A0A0A 배경 / 세룰리안 블루 #007BA7 선·푸른 빛 / 네온 로즈 #FF2D95 조명
const LINE_COLOR = 0x007BA7, BLUE = 0x007BA7, ROSE = 0xFF2D95;

/* ---------- 부품 (각 부품 = 실물 메시 + 선) ---------- */
const glasses = new THREE.Group();
scene.add(glasses);
const parts = {};
function part(name, range, fly) {
  const g = new THREE.Group(); glasses.add(g);
  const lineG = new THREE.Group(); glasses.add(lineG); // 선은 제자리에 고정(설계도), 실물만 날아와 채워짐
  return (parts[name] = { name, g, lineG, range, fly, solids: [], mats: new Map(), lines: [] });
}
function solid(P, geo, baseMat, parent = P.g) {
  let m = P.mats.get(baseMat);
  if (!m) { m = baseMat.clone(); m.transparent = true; m.opacity = 0; m.userData.target = baseMat === BASE.pad ? 0.5 : 1; P.mats.set(baseMat, m); }
  const mesh = new THREE.Mesh(geo, m); parent.add(mesh); P.solids.push(mesh); return mesh;
}
function lineMat() { return new THREE.LineBasicMaterial({ color: LINE_COLOR, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }); }
function addLine(P, obj, parent = P.g) { obj.renderOrder = 4; parent.add(obj); P.lines.push(obj); return obj; }
function loop2D(pts2, z, P, parent) {
  const geo = new THREE.BufferGeometry().setFromPoints(pts2.map(p => V(p.x, p.y, z)));
  return addLine(P, new THREE.LineLoop(geo, lineMat()), parent);
}
function boxLines(w, h, d, P, parent, pos = V(0, 0, 0)) {
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), lineMat());
  l.position.copy(pos); return addLine(P, l, parent);
}
function circleLines(r, z, P, parent, seg = 40) {
  const pts = []; for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2; pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
  return loop2D(pts, z, P, parent);
}

// 1) 프레임
const FRONT = part('front', [0.07, 0.13], V(0, 0, -60));
const toV2 = arr => arr.map(([x, y]) => new THREE.Vector2(x, y));
const scaleAbout = (arr, k) => { const c = arr.reduce((m, [x, y]) => [m[0] + x / arr.length, m[1] + y / arr.length], [0, 0]); return arr.map(([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k]); };
const outer = new THREE.Shape(toV2(SHAPE.outer));
const holes = [SHAPE.lensR, SHAPE.lensL].map(h => new THREE.Path(toV2(h)));
holes.forEach(h => outer.holes.push(h));
const frontGeo = new THREE.ExtrudeGeometry(outer, { depth: 5, bevelEnabled: true, bevelThickness: 1.4, bevelSize: 0.9, bevelSegments: 5, curveSegments: 12 });
frontGeo.translate(0, 0, -2.5);
solid(FRONT, frontGeo, BASE.frame);
[4.3, -4.3].forEach(z => {
  loop2D(outer.getPoints(40), z, FRONT, FRONT.lineG);
  holes.forEach(h => loop2D(h.getPoints(24), z, FRONT, FRONT.lineG));
});
// 양 끝 블록(프레임에 포함)
[1, -1].forEach(s => {
  const b = solid(FRONT, new RoundedBoxGeometry(7, 15, 15, 3, 2.4), BASE.frame); b.position.set(s * 67.5, 14, -9);
  boxLines(7, 15, 15, FRONT, FRONT.lineG, V(s * 67.5, 14, -9));
});

// 2) 카메라 + LED
const CAM = part('cam', [0.15, 0.21], V(30, 16, 90));
const camG = new THREE.Group(); camG.position.set(SHAPE.cam[0], SHAPE.cam[1], 4); CAM.g.add(camG);
const camLineG = new THREE.Group(); camLineG.position.set(SHAPE.cam[0], SHAPE.cam[1], 4); CAM.lineG.add(camLineG);
{ const ring = solid(CAM, new THREE.CylinderGeometry(4.1, 4.1, 1.6, 40), BASE.camRing, camG); ring.rotation.x = Math.PI / 2; ring.position.z = 0.5;
  const iris = solid(CAM, new THREE.CircleGeometry(1.5, 32), BASE.iris, camG); iris.position.z = 1.35;
  const dome = solid(CAM, new THREE.SphereGeometry(3.0, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), BASE.camGlass, camG);
  dome.rotation.x = Math.PI / 2; dome.scale.set(1, 0.3, 1); dome.position.z = 1.3;
  circleLines(4.1, 1.4, CAM, camLineG); circleLines(3.0, 1.8, CAM, camLineG); circleLines(1.5, 2.1, CAM, camLineG, 24);
  const led = solid(CAM, new THREE.CylinderGeometry(0.9, 0.9, 0.8, 24), BASE.led); led.rotation.x = Math.PI / 2; led.position.set(SHAPE.led[0], SHAPE.led[1], 4.3);
  const ledL = circleLines(1.6, 0, CAM, CAM.lineG, 20); ledL.position.set(SHAPE.led[0], SHAPE.led[1], 4.8);
}

// 3) 렌즈
const LENS = part('lens', [0.24, 0.30], V(0, 0, 70));
[SHAPE.lensR, SHAPE.lensL].forEach(h => {
  const sh = new THREE.Shape(toV2(scaleAbout(h, 1.015)));
  const m = solid(LENS, new THREE.ShapeGeometry(sh, 24), BASE.lens); m.position.z = 0.2; m.renderOrder = 2;
  loop2D(sh.getPoints(24), 0.2, LENS, LENS.lineG);
});
LENS.mats.get(BASE.lens).userData.target = 0.9;
LENS.mats.get(BASE.lens).depthWrite = false;

// 4) 코받침 (골전도 마이크)
const PADS = part('pads', [0.33, 0.39], V(0, -40, -12));
[1, -1].forEach(s => {
  const screw = solid(PADS, new THREE.CylinderGeometry(0.9, 0.9, 0.6, 16), BASE.metal); screw.rotation.x = Math.PI / 2; screw.position.set(s * 8.7, 0.6, 3.6);
  const arm = solid(PADS, new THREE.CylinderGeometry(0.45, 0.45, 9, 8), BASE.metal); arm.position.set(s * 9.0, -3.5, -3); arm.rotation.x = 0.5;
  const pad = solid(PADS, new THREE.SphereGeometry(1, 24, 16), BASE.pad); pad.scale.set(2.6, 4.6, 1.4); pad.position.set(s * 9.4, -9.5, -7); pad.rotation.y = s * 0.55;
  const pl = circleLines(1, 0, PADS, PADS.lineG, 28); pl.scale.set(2.6, 4.6, 1); pl.position.set(s * 9.4, -9.5, -7); pl.rotation.y = s * 0.55;
});

// 5) 다리 (힌지 + 다리 + 귀걸이) + 투시용 속 부품 선
const TEMP = part('temples', [0.42, 0.48], V(0, 0, 0));
const temples = [];
const innerLines = [];
[1, -1].forEach(s => {
  const hinge = solid(TEMP, new RoundedBoxGeometry(2, 7, 7, 2, 0.8), BASE.metal); hinge.position.set(s * 62.6, 14, -16);
  const tg = new THREE.Group(); tg.position.set(s * 67.2, 13.6, -17); TEMP.g.add(tg);
  temples.push({ s, tg });
  const arm = solid(TEMP, new RoundedBoxGeometry(6, 10.5, 118, 3, 2.6), BASE.frame, tg); arm.position.z = -59;
  boxLines(6, 10.5, 118, TEMP, tg, V(0, 0, -59));
  const ear = new THREE.Group(); ear.position.z = -116; ear.rotation.x = -0.6; tg.add(ear);
  const tip = solid(TEMP, new RoundedBoxGeometry(5.6, 9, 36, 3, 2.4), BASE.frame, ear); tip.position.z = -15;
  boxLines(5.6, 9, 36, TEMP, ear, V(0, 0, -15));
  if (s === 1) [[-26, BASE.metal], [-36, BASE.red]].forEach(([z, mat]) => { const b = solid(TEMP, new RoundedBoxGeometry(0.9, 2.2, 8, 2, 0.4), mat, tg); b.position.set(3.1, 0.5, z); });
  // 속 부품(투시): 회로 · 배터리 · 스피커 — 선으로만
  const mk = (w, h, d, z) => { const l = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false })); l.position.set(0, 0, z); l.renderOrder = 6; tg.add(l); innerLines.push(l); };
  mk(3.6, 7, 22, -32); mk(4, 7.5, 34, -66); mk(4.2, 6.5, 14, -100);
  for (let i = 0; i < 4; i++) mk(4.4, 0.01, 0.01, -95 - i * 3.2); // 스피커 구멍 줄
});

/* ---------- 착용 시 화면 가운데 테는 녹아 사라짐 (실제로 썼을 때 코 다리가 안 보이는 것처럼) ---------- */
const CF = { uCF: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } };
function centerFade(m){
  m.onBeforeCompile = sh => {
    sh.uniforms.uCF = CF.uCF; sh.uniforms.uRes = CF.uRes;
    sh.fragmentShader = 'uniform float uCF; uniform vec2 uRes;\n' + sh.fragmentShader.replace('#include <dithering_fragment>',
      `#include <dithering_fragment>
      vec2 q = gl_FragCoord.xy / uRes - 0.5; q.x *= uRes.x / uRes.y;
      gl_FragColor.a *= mix(1.0, smoothstep(0.22, 0.62, length(q)), uCF);`);
  };
  m.customProgramCacheKey = () => 'cf';
}
Object.values(parts).forEach(P => P.mats.forEach(centerFade));

/* ---------- 빛 (어둠 속에서 윤곽이 드러나게) ---------- */
scene.add(new THREE.HemisphereLight(0x9fc6dc, 0x0a0a0a, 0.3));
const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(160, 220, 320); scene.add(key);
const top = new THREE.DirectionalLight(0xffffff, 0.6); top.position.set(0, 400, 60); scene.add(top);
const rimL = new THREE.DirectionalLight(BLUE, 5.5); rimL.position.set(-320, 140, -260); scene.add(rimL);
const rimR = new THREE.DirectionalLight(ROSE, 4.5); rimR.position.set(320, 80, -220); scene.add(rimR);

/* ---------- 렌즈 너머 세상 ---------- */
const PLANE_Z = -900;
let povAspect = 16 / 9;
const povTex = new THREE.TextureLoader().load('pov_shoot.webp', t => { t.colorSpace = THREE.SRGBColorSpace; povAspect = t.image.width / t.image.height; layout(); });
const pov = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: povTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
pov.position.z = PLANE_Z; pov.renderOrder = -1; scene.add(pov);

/* ---------- 카메라 동선 (키프레임) ----------
   ry/rx = 안경 회전, f = 안경 위의 초점(로컬 좌표), o = 초점에서 카메라까지(월드 방향) */
const KF = [
  { p: 0.00, ry: -0.55, rx: 0.16, f: [0, 24, 0], o: [0, 10, 380] },
  { p: 0.10, ry: -0.45, rx: 0.14, f: [0, 2, 0], o: [0, 10, 300] },     // 프레임
  { p: 0.19, ry: -0.32, rx: 0.10, f: [58, 12, 4], o: [26, 8, 125] },    // 카메라 근접
  { p: 0.28, ry: 0.12, rx: 0.06, f: [-30, 0, 0], o: [0, 4, 190] },      // 렌즈
  { p: 0.37, ry: 0.5, rx: -0.32, f: [0, -4, -4], o: [0, -6, 160] },     // 코받침 (아래에서)
  { p: 0.48, ry: 1.3, rx: 0.10, f: [0, 10, -55], o: [0, 22, 340] },    // 다리 측면
  { p: 0.60, ry: 2.15, rx: 0.14, f: [0, 4, -30], o: [0, 18, 380] },    // 완성
  { p: 0.70, ry: Math.PI, rx: 0.0, f: [0, 0, 0], o: [0, 0, 320] },      // 뒷면이 나를 향함
];
const W_START = 0.70, W_END = 0.9, END_Z = -8, END_FOV = 70;

let W = 1, H = 1, aspect = 1, dist = 1;
function layout() {
  W = stage.clientWidth; H = stage.clientHeight; aspect = W / H;
  renderer.setSize(W, H, false); camera.aspect = aspect;
  dist = aspect < 1 ? Math.min(2.6, 1.15 / aspect) : Math.max(1, 1.5 / aspect);
  const d = END_Z - PLANE_Z, vh = 2 * d * Math.tan(THREE.MathUtils.degToRad(END_FOV / 2)), vw = vh * aspect;
  if (vw / vh > povAspect) pov.scale.set(vw, vw / povAspect, 1); else pov.scale.set(vh * povAspect, vh, 1);
}

let progress = 0, target = 0, first = true;
function readScroll() { const r = section.getBoundingClientRect(); target = clamp(-r.top / (section.offsetHeight - innerHeight)); if (first) { progress = target; first = false; } }

const tmpF = V(0, 0, 0), camPos = V(0, 0, 0), look = V(0, 0, 0);
function sampleKF(p) {
  let i = 0; while (i < KF.length - 2 && p > KF[i + 1].p) i++;
  const A = KF[i], B = KF[i + 1], t = io(seg(p, A.p, B.p));
  return {
    ry: lerp(A.ry, B.ry, t), rx: lerp(A.rx, B.rx, t),
    f: A.f.map((v, k) => lerp(v, B.f[k], t)), o: A.o.map((v, k) => lerp(v, B.o[k], t)),
  };
}

let introK = 0;
function frame(time) {
  progress += (target - progress) * 0.09; if (Math.abs(target - progress) < 0.00005) progress = target; // 스크롤 감속
  const p = progress;
  const k = sampleKF(Math.min(p, W_START));
  const idle = 1 - seg(p, 0.62, 0.7);
  glasses.rotation.set(k.rx + Math.sin(time * 0.0007) * 0.015 * idle, k.ry + Math.sin(time * 0.0005) * 0.03 * idle, 0);
  // 착용: 코받침 사이 빈 공간(0,-1,0)을 중심으로 안경이 점점 커지며 테가 시야 밖으로 빠져나감 (멈춤 없이 연속)
  const flyT = Math.pow(seg(p, 0.83, 0.97), 1.7), sc = 1 + 18 * flyT;
  glasses.scale.setScalar(sc);
  glasses.position.set(0, (sc - 1) + Math.sin(time * 0.0011) * 1.6 * idle, 0);
  glasses.updateMatrixWorld(true);

  // 부품 채우기
  const draw = clamp(introK);
  Object.values(parts).forEach(P => {
    const a = io(seg(p, P.range[0], P.range[1]));
    P.a = a;
    P.g.position.copy(P.fly).multiplyScalar(1 - a);
    P.mats.forEach(m => {
      let op = a * m.userData.target;
      if (P === TEMP) op *= 1 - 0.85 * xray(p);
      if (P === LENS) op = lerp(op, op * 0.3, seg(p, 0.76, 0.86));
      op *= 1 - seg(p, 0.94, 0.975); // 끝에 남은 테 정리
      if (P === PADS) op *= 1 - seg(p, 0.825, 0.86); // 코받침·철사는 먼저 사라짐 (코에 너무 가까워 안 보이는 것처럼)
      m.opacity = op; m.visible = op > 0.002;
      const solidNow = op >= 0.999 && m.userData.target === 1;
      m.transparent = !solidNow; m.depthWrite = solidNow || P !== LENS && op > 0.6;
    });
    const lineOp = draw * (0.95 - 0.85 * a) * (1 - seg(p, 0.6, 0.66));
    P.lines.forEach(l => {
      l.material.opacity = lineOp; l.visible = lineOp > 0.003;
      const n = l.geometry.attributes.position.count;
      l.geometry.setDrawRange(0, Math.ceil(n * draw));
    });
  });
  temples.forEach(({ s, tg }) => { const a = TEMP.a; tg.rotation.y = s * (0.035 + 1.47 * (1 - a)) + (s === 1 ? 0 : -0.04 * (1 - a)); tg.position.y = 13.6 + (s === 1 ? 0 : 2.5 * (1 - a)); }); // 접힌 다리 → 펼쳐짐
  const xr = xray(p);
  innerLines.forEach(l => { l.material.opacity = xr * 0.85; l.visible = xr > 0.01; });

  // 카메라
  tmpF.set(...k.f).applyMatrix4(glasses.matrixWorld);
  const w1 = io(seg(p, W_START, W_END)), w2 = io(seg(p, W_END + 0.02, 0.99));
  const off = V(...k.o).multiplyScalar(dist);
  camPos.copy(tmpF).add(off);
  // 착용: 한쪽 렌즈 뒤(눈 위치)로
  const eye = V(0, -1, 46); // 코 다리 아래 가운데(두 눈 사이)로 들어감 → 두 렌즈가 좌우 대칭
  camPos.lerp(eye, w1);
  // (v11) 카메라는 눈 위치에서 계속 정면을 봄, 안경이 커지며 지나감
  camera.position.copy(camPos);
  camera.fov = lerp(30, 84, sm(seg(p, W_START + 0.02, W_END)));
  camera.updateProjectionMatrix();
  look.copy(tmpF).lerp(V(camPos.x, camPos.y, -2000), w1);
  camera.lookAt(look);

  { const d = camera.position.z - PLANE_Z, vh = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), vw = vh * aspect;
    if (vw / vh > povAspect) pov.scale.set(vw, vw / povAspect, 1); else pov.scale.set(vh * povAspect, vh, 1);
    pov.position.x = camera.position.x; pov.position.y = camera.position.y; }
  pov.material.opacity = sm(seg(p, 0.74, 0.88));
  CF.uCF.value = sm(seg(p, 0.835, 0.93));
  renderer.getDrawingBufferSize(CF.uRes.value);
  if (CF.uCF.value > 0) Object.values(parts).forEach(P => P.mats.forEach(m => { m.transparent = true; m.depthWrite = false; }));
  const dark = sm(seg(p, 0.76, 0.9));
  FRONT.mats.forEach(m => { if (m.color) m.color.setRGB(lerp(0.0056, 0.0012, dark), lerp(0.0056, 0.001, dark), lerp(0.0056, 0.0009, dark)); });
  key.intensity = lerp(1.5, 0.5, dark); top.intensity = lerp(0.6, 0.12, dark); rimL.intensity = lerp(5.5, 1.2, dark); rimR.intensity = lerp(4.5, 1.0, dark);
  if (wearBlur) wearBlur.style.opacity = sm(seg(p, 0.83, 0.92)) * (1 - seg(p, 0.95, 0.99));
  LENS.mats.forEach(m => { if (p > W_END) m.opacity *= 1 - w2; });

  renderer.render(scene, camera);

  beats.forEach(b => {
    const a = +b.dataset.a, z = +b.dataset.b, f = 0.02;
    let o = Math.min(seg(p, a - f, a + f * 0.6), 1 - seg(p, z - f * 0.6, z + f));
    if (a <= 0) o = Math.min(introK, 1 - seg(p, z - f * 0.6, z + f));
    b.style.opacity = o;
    b.style.transform = `translate3d(0, ${(1 - o) * 18}px, 0)`;
    b.style.visibility = o < 0.01 ? 'hidden' : 'visible';
  });
  if (bar) bar.style.transform = `scaleX(${p})`;
  stage.classList.toggle('is-worn', p > 0.97);
}
function xray(p) { return Math.min(seg(p, 0.46, 0.5), 1 - seg(p, 0.55, 0.59)); }

const t0 = performance.now();
let running = false;
function loop(t) { introK = clamp((t - t0 - 200) / 1800); frame(t); if (running) requestAnimationFrame(loop); }
new IntersectionObserver(es => {
  const vis = es[0].isIntersecting;
  if (vis && !running) { running = true; requestAnimationFrame(loop); }
  if (!vis) running = false;
}, { rootMargin: '100px' }).observe(section);

addEventListener('scroll', readScroll, { passive: true });
addEventListener('resize', () => { layout(); readScroll(); });
layout(); readScroll();
stage.classList.add('is-ready');
