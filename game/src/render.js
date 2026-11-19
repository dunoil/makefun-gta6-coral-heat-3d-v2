// Drawing only: WebGL2 low-poly city, chase camera, minimap, portraits. No rules here.
import { GRID, HALF, ISLAND_R, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_DIALOGUE = 'dialogue';
export const SCREEN_SHOP = 'shop';
export const SCREEN_GARAGE = 'garage';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_COMPLETE = 'complete';

const VERT = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
layout(location=3) in vec2 aUv;
layout(location=4) in float aTex;
layout(location=5) in float aEmis;
uniform mat4 uProj; uniform mat4 uView; uniform mat4 uModel;
uniform vec3 uSun; uniform float uDay;
out vec3 vColor; out vec2 vUv; out float vTex; out float vEmis; out float vFog;
void main(){
  vec4 wp = uModel * vec4(aPos, 1.0);
  vec3 n = normalize(mat3(uModel) * aNormal);
  float diff = max(dot(n, uSun), 0.0);
  float amb = 0.30 + 0.70 * uDay;
  float light = amb + diff * (0.30 + 0.70 * uDay);
  vColor = aColor * light;
  vUv = aUv; vTex = aTex; vEmis = aEmis;
  vec4 vp = uView * wp;
  vFog = clamp((-vp.z - 120.0) / 260.0, 0.0, 0.85);
  gl_Position = uProj * vp;
}`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex0; uniform sampler2D uTex1; uniform sampler2D uTex2;
uniform vec3 uFogColor; uniform float uNight; uniform float uAlpha;
in vec3 vColor; in vec2 vUv; in float vTex; in float vEmis; in float vFog;
out vec4 frag;
void main(){
  vec3 c = vColor;
  if (vTex > 0.5 && vTex < 1.5) {
    vec3 t = texture(uTex0, vUv).rgb;
    float g = texture(uTex1, vUv).r;
    c = t * c + vec3(g) * uNight * 1.4;
  } else if (vTex > 1.5) {
    c = texture(uTex2, vUv).rgb * c;
  }
  c = mix(c, vec3(1.0, 0.9, 0.55), vEmis * 0.85);
  frag = vec4(mix(c, uFogColor, vFog), uAlpha);
}`;

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function mat4Perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect; out[5] = f; out[10] = (far + near) / (near - far);
  out[11] = -1; out[14] = (2 * far * near) / (near - far);
  return out;
}

function mat4LookAt(eye, center, up) {
  const zx = eye[0] - center[0];
  const zy = eye[1] - center[1];
  const zz = eye[2] - center[2];
  let zl = Math.hypot(zx, zy, zz) || 1;
  const z = [zx / zl, zy / zl, zz / zl];
  let xx = up[1] * z[2] - up[2] * z[1];
  let xy = up[2] * z[0] - up[0] * z[2];
  let xz = up[0] * z[1] - up[1] * z[0];
  const xl = Math.hypot(xx, xy, xz) || 1;
  xx /= xl; xy /= xl; xz /= xl;
  const yx = z[1] * xz - z[2] * xy;
  const yy = z[2] * xx - z[0] * xz;
  const yz = z[0] * xy - z[1] * xx;
  const out = new Float32Array(16);
  out[0] = xx; out[1] = yx; out[2] = z[0]; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = z[1]; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = z[2]; out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);
  out[15] = 1;
  return out;
}

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function makeGroundTexture(city) {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  const W = 640; // world span the texture covers (-320..320)
  const px = (x) => (x + W / 2) / W * S;
  const sc = (v) => (v / W) * S;
  // Water.
  g.fillStyle = '#0d4d6e';
  g.fillRect(0, 0, S, S);
  // Sand ring.
  g.fillStyle = '#e0c98f';
  g.beginPath();
  g.arc(S / 2, S / 2, (ISLAND_R / W) * S, 0, 6.29);
  g.fill();
  // Island ground.
  g.fillStyle = '#7d8a6a';
  g.beginPath();
  g.arc(S / 2, S / 2, ((ISLAND_R - 14) / W) * S, 0, 6.29);
  g.fill();
  // Blocks (sidewalk grey).
  for (let bi = 0; bi < 2 * HALF; bi++) {
    for (let bj = 0; bj < 2 * HALF; bj++) {
      const x0 = (bi - HALF) * GRID + 6;
      const z0 = (bj - HALF) * GRID + 6;
      g.fillStyle = '#8a8f96';
      g.fillRect(px(x0), px(z0), sc(40), sc(40));
    }
  }
  // Parks.
  g.fillStyle = '#4d8a4d';
  for (const pk of city.parks) g.fillRect(px(pk.x - 20), px(pk.z - 20), sc(40), sc(40));
  // Roads.
  g.fillStyle = '#2e3138';
  for (let i = 0; i <= 2 * HALF; i++) {
    const c0 = (i - HALF) * GRID;
    g.fillRect(px(c0 - 6), 0, sc(12), S);
    g.fillRect(0, px(c0 - 6), S, sc(12));
  }
  // Road centre dashes.
  g.fillStyle = '#d8c94c';
  for (let i = 0; i <= 2 * HALF; i++) {
    const c0 = (i - HALF) * GRID;
    for (let d = -150; d < 160; d += 20) {
      g.fillRect(px(c0 - 0.6), px(d), sc(1.2), sc(8));
      g.fillRect(px(d), px(c0 - 0.6), sc(8), sc(1.2));
    }
  }
  // Marina piers (south).
  g.fillStyle = '#6b4f2a';
  for (let b = 0; b < 6; b++) g.fillRect(px(-128 + b * 48), px(196), sc(6), sc(26));
  // Port apron (east).
  g.fillStyle = '#5a6068';
  g.fillRect(px(176), px(-110), sc(34), sc(220));
  // Beach umbrellas dots.
  g.fillStyle = '#e74c3c';
  for (let i = 0; i < 10; i++) {
    const a = i * 0.63;
    g.beginPath();
    g.arc(S / 2 + Math.cos(a) * ((ISLAND_R - 7) / W) * S, S / 2 + Math.sin(a) * ((ISLAND_R - 7) / W) * S, 4, 0, 6.29);
    g.fill();
  }
  return c;
}

function makeFacadeTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#cfc8bd';
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = '#b8b0a2';
  for (let y = 0; y < 256; y += 16) g.fillRect(0, y, 128, 2);
  for (let y = 8; y < 256; y += 16) {
    for (let x = 8; x < 128; x += 16) {
      g.fillStyle = '#232c3d';
      g.fillRect(x, y, 10, 10);
    }
  }
  return c;
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 128, 256);
  // Deterministic lit windows (a fixed pattern, no RNG needed).
  for (let y = 8; y < 256; y += 16) {
    for (let x = 8; x < 128; x += 16) {
      if (((x * 7 + y * 13) % 5) < 2) {
        g.fillStyle = '#ffd98a';
        g.fillRect(x, y, 10, 10);
      }
    }
  }
  return c;
}

// One box, 24 vertices, into the flat array. tex: 0 plain, 1 facade, 2 ground.
function box(arr, cx, cy, cz, sx, sy, sz, color, tex = 0, uvx = 1, uvy = 1, emis = 0) {
  const col = hexRgb(color);
  const faces = [
    { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
    { n: [0, 0, -1], v: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
    { n: [1, 0, 0], v: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
    { n: [-1, 0, 0], v: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
    { n: [0, 1, 0], v: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
    { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
  ];
  const uvs = [[0, 0], [uvx, 0], [uvx, uvy], [0, uvy]];
  for (const f of faces) {
    const idx = [0, 1, 2, 0, 2, 3];
    for (const k of idx) {
      const p = f.v[k];
      arr.push(
        cx + (p[0] * sx) / 2, cy + (p[1] * sy) / 2, cz + (p[2] * sz) / 2,
        f.n[0], f.n[1], f.n[2],
        col[0], col[1], col[2],
        uvs[k][0], uvs[k][1], tex, emis,
      );
    }
  }
}

function pyramid(arr, cx, cy, cz, r, h, color, emis = 0) {
  const col = hexRgb(color);
  const base = [[-r, 0, -r], [r, 0, -r], [r, 0, r], [-r, 0, r]];
  const apex = [0, h, 0];
  for (let i = 0; i < 4; i++) {
    const a = base[i];
    const b = base[(i + 1) % 4];
    const n = [0, 0.7, 0];
    for (const p of [a, b, apex]) {
      arr.push(cx + p[0], cy + p[1], cz + p[2], n[0], n[1], n[2], col[0], col[1], col[2], 0, 0, 0, emis);
    }
  }
}

const STRIDE = 13;

export function createRenderer(canvas, minimap) {
  const gl = canvas.getContext('webgl2', { antialias: true });
  if (!gl) throw new Error('WebGL2 is not available');
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const U = {};
  for (const name of ['uProj', 'uView', 'uModel', 'uSun', 'uDay', 'uFogColor', 'uNight', 'uAlpha']) U[name] = gl.getUniformLocation(prog, name);
  gl.uniform1i(gl.getUniformLocation(prog, 'uTex0'), 0);
  gl.uniform1i(gl.getUniformLocation(prog, 'uTex1'), 1);
  gl.uniform1i(gl.getUniformLocation(prog, 'uTex2'), 2);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  let off = 0;
  for (const [loc, size] of [[0, 3], [1, 3], [2, 3], [3, 2], [4, 1], [5, 1]]) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE * 4, off * 4);
    off += size;
  }

  let staticVerts = null;
  let staticCount = 0;
  let tex0 = null;
  let tex1 = null;
  let tex2 = null;
  let groundReady = false;

  function texFrom(canvasEl, slot) {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + slot);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvasEl);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.generateMipmap(gl.TEXTURE_2D);
    return t;
  }

  function buildStatic(city) {
    tex0 = texFrom(makeFacadeTexture(), 0);
    tex1 = texFrom(makeGlowTexture(), 1);
    tex2 = texFrom(makeGroundTexture(city), 2);
    const a = [];
    // Ground plane.
    const G = 320;
    const ground = [
      [-G, 0, -G, 0, 1, 0, 1, 1, 1, 0, 0, 2, 0],
      [G, 0, -G, 0, 1, 0, 1, 1, 1, 1, 0, 2, 0],
      [G, 0, G, 0, 1, 0, 1, 1, 1, 1, 1, 2, 0],
      [-G, 0, -G, 0, 1, 0, 1, 1, 1, 0, 0, 2, 0],
      [G, 0, G, 0, 1, 0, 1, 1, 1, 1, 1, 2, 0],
      [-G, 0, G, 0, 1, 0, 1, 1, 1, 0, 1, 2, 0],
    ];
    for (const v of ground) a.push(...v);
    // Buildings.
    for (const b of city.buildings) {
      box(a, b.x, b.h / 2, b.z, b.w, b.h, b.d, b.tint, 1, Math.max(1, b.w / 16), Math.max(1, b.h / 32));
      // Roof lip.
      box(a, b.x, b.h + 0.3, b.z, b.w + 0.6, 0.6, b.d + 0.6, '#5a5f66', 0);
    }
    // Trees: trunk + foliage.
    for (const t of city.trees) {
      box(a, t.x, 0.8 * t.s, t.z, 0.5 * t.s, 1.6 * t.s, 0.5 * t.s, '#6b4f2a', 0);
      box(a, t.x, (1.6 + 1.4) * t.s, t.z, 2.6 * t.s, 2.8 * t.s, 2.6 * t.s, '#3d7a3d', 0);
    }
    // Boats in the marina.
    for (const b of city.boats) {
      box(a, b.x, 0.6, b.z, 5, 1.2, 2.2, b.hull, 0);
      box(a, b.x, 2.2, b.z, 0.3, 3, 0.3, '#8a6a42', 0);
    }
    // Port containers.
    for (const c of city.containers) box(a, c.x, 1.4, c.z, 6, 2.8, 2.6, c.color, 0);
    // Lighthouse (north-west corner).
    box(a, city.lighthouse.x, 14, city.lighthouse.z, 6, 28, 6, '#e8e4da', 0);
    box(a, city.lighthouse.x, 29, city.lighthouse.z, 4, 2.5, 4, '#c0392b', 0, 1, 1, 1);
    // Piers.
    for (let b = 0; b < 6; b++) box(a, -120 + b * 48, 0.4, 209, 6, 0.8, 26, '#6b4f2a', 0);
    staticVerts = new Float32Array(a);
    staticCount = a.length / STRIDE;
    groundReady = true;
  }

  const camera = { eye: [0, 60, 120], center: [0, 0, 0], yaw: 0 };
  let override = null;

  function draw(state, city, screen, time) {
    if (!groundReady) buildStatic(city);
    const day = state.dayFactorValue ?? 0.9;
    const night = 1 - day;
    // Sky + fog by time of day.
    const sky = [
      PALETTE.skyNight[0] + (PALETTE.skyDay[0] - PALETTE.skyNight[0]) * day,
      PALETTE.skyNight[1] + (PALETTE.skyDay[1] - PALETTE.skyNight[1]) * day,
      PALETTE.skyNight[2] + (PALETTE.skyDay[2] - PALETTE.skyNight[2]) * day,
    ];
    if (state.time > 0.62 && state.time < 0.8) {
      sky[0] = sky[0] * 0.7 + PALETTE.skyDusk[0] * 0.3;
      sky[1] = sky[1] * 0.7 + PALETTE.skyDusk[1] * 0.3;
      sky[2] = sky[2] * 0.7 + PALETTE.skyDusk[2] * 0.3;
    }
    const fog = [
      PALETTE.fogNight[0] + (PALETTE.fogDay[0] - PALETTE.fogNight[0]) * day,
      PALETTE.fogNight[1] + (PALETTE.fogDay[1] - PALETTE.fogNight[1]) * day,
      PALETTE.fogNight[2] + (PALETTE.fogDay[2] - PALETTE.fogNight[2]) * day,
    ];
    const w = canvas.clientWidth || 1024;
    const h = canvas.clientHeight || 640;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(sky[0], sky[1], sky[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.uniform1f(U.uDay, Math.max(0.12, day));
    gl.uniform1f(U.uNight, night);
    gl.uniform3f(U.uFogColor, fog[0], fog[1], fog[2]);
    gl.uniform1f(U.uAlpha, 1);
    const sunA = (state.time - 0.25) * Math.PI * 2;
    gl.uniform3f(U.uSun, Math.cos(sunA) * 0.6, 0.8, Math.sin(sunA) * 0.6);

    const p = state.player;
    let eye;
    let center;
    if (override) {
      eye = override.eye;
      center = override.center;
    } else if (screen === SCREEN_TITLE) {
      const a = time * 0.05;
      eye = [Math.cos(a) * 190, 85, Math.sin(a) * 190];
      center = [0, 10, 60];
    } else if (p.inCar) {
      const back = 12;
      const up = 5;
      const tx = p.x - Math.cos(p.angle) * back;
      const tz = p.z - Math.sin(p.angle) * back;
      eye = [tx, up, tz];
      center = [p.x + Math.cos(p.angle) * 10, 1.5, p.z + Math.sin(p.angle) * 10];
    } else {
      const back = 7.5;
      const up = 3.4;
      const tx = p.x - Math.cos(p.angle) * back;
      const tz = p.z - Math.sin(p.angle) * back;
      eye = [tx, up, tz];
      center = [p.x + Math.cos(p.angle) * 5, 1.4, p.z + Math.sin(p.angle) * 5];
    }
    // Smooth the chase camera.
    const k = override || screen === SCREEN_TITLE ? 1 : 0.12;
    camera.eye[0] += (eye[0] - camera.eye[0]) * k;
    camera.eye[1] += (eye[1] - camera.eye[1]) * k;
    camera.eye[2] += (eye[2] - camera.eye[2]) * k;
    camera.center[0] += (center[0] - camera.center[0]) * k;
    camera.center[1] += (center[1] - camera.center[1]) * k;
    camera.center[2] += (center[2] - camera.center[2]) * k;
    camera.yaw = Math.atan2(camera.center[2] - camera.eye[2], camera.center[0] - camera.eye[0]);
    const proj = mat4Perspective(1.08, canvas.width / canvas.height, 0.5, 900);
    const view = mat4LookAt(camera.eye, camera.center, [0, 1, 0]);
    gl.uniformMatrix4fv(U.uProj, false, proj);
    gl.uniformMatrix4fv(U.uView, false, view);
    gl.uniformMatrix4fv(U.uModel, false, IDENTITY);

    // Static geometry.
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, staticVerts, gl.STATIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, staticCount);

    // Dynamic geometry.
    const d = [];
    // A yaw-rotated box centred at (cx, cy, cz), long axis along `yaw`.
    function boxYaw(cx, cy, cz, sx, sy, sz, yaw, color, emis = 0) {
      const ca = Math.cos(yaw);
      const sa = Math.sin(yaw);
      const hx = sx / 2;
      const hy = sy / 2;
      const hz = sz / 2;
      const corners = [];
      for (const [ox, oy, oz] of [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz], [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]) {
        const rx = ca * ox - sa * oz;
        const rz = sa * ox + ca * oz;
        corners.push([cx + rx, cy + oy, cz + rz]);
      }
      const col = hexRgb(color);
      const faces = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]];
      const normals = [[0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0], [0, 1, 0], [0, -1, 0]];
      for (let f = 0; f < 6; f++) {
        const fn = normals[f];
        const rn = [ca * fn[0] - sa * fn[2], fn[1], sa * fn[0] + ca * fn[2]];
        const quad = faces[f];
        const tris = [quad[0], quad[1], quad[2], quad[0], quad[2], quad[3]];
        for (const qi of tris) {
          const pt = corners[qi];
          d.push(pt[0], pt[1], pt[2], rn[0], rn[1], rn[2], col[0], col[1], col[2], 0, 0, 0, emis);
        }
      }
    }
    function carRot(c, isCop) {
      const a = c.angle;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const put = (lx, lz, cy, sx, sy, sz, color, emis = 0) => {
        const wx = c.x + ca * lx - sa * lz;
        const wz = c.z + sa * lx + ca * lz;
        boxYaw(wx, cy, wz, sx, sy, sz, a, color, emis);
      };
      put(0, 0, 0.9, 4.6, 1.1, 2.1, isCop ? '#20242c' : c.color);
      put(-0.3, 0, 1.8, 2.2, 0.9, 1.9, '#20242c');
      if (isCop) {
        put(-0.3, 0, 2.5, 1.2, 0.25, 0.5, '#e74c3c', 0.9);
        put(1.6, 0, 0.45, 0.7, 0.9, 0.4, '#111111');
        put(-1.6, 0, 0.45, 0.7, 0.9, 0.4, '#111111');
      } else {
        put(1.5, 1.05, 0.45, 0.7, 0.9, 0.4, '#111111');
        put(1.5, -1.05, 0.45, 0.7, 0.9, 0.4, '#111111');
        put(-1.5, 1.05, 0.45, 0.7, 0.9, 0.4, '#111111');
        put(-1.5, -1.05, 0.45, 0.7, 0.9, 0.4, '#111111');
      }
      if (night > 0.5) put(2.4, 0, 0.9, 0.2, 0.3, 1.6, '#fff2b0', 1);
    }
    for (const c of state.cars) carRot(c, false);
    for (const c of state.copCars) carRot(c, true);
    // Tracers: thin emissive bars from muzzle to hit point.
    for (const t of state.tracers) {
      const dx = t.x2 - t.x1;
      const dz = t.z2 - t.z1;
      const len = Math.hypot(dx, dz) || 0.01;
      const yaw = Math.atan2(dz, dx);
      boxYaw((t.x1 + t.x2) / 2, 1.4, (t.z1 + t.z2) / 2, len, 0.09, 0.09, yaw, '#ffe9a8', 1);
    }
    for (const rb of state.roadblocks) {
      box(d, rb.x, 0.9, rb.z, 4.6, 1.1, 2.1, '#20242c', 0);
      box(d, rb.x, 1.8, rb.z, 0.2, 0.9, 2.1, '#f39c12', 0, 1, 1, 0.7);
    }
    // Player on foot.
    if (!p.inCar) {
      const swing = Math.sin(p.walkPhase) * 0.35;
      const a = p.angle;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const leg = (side) => {
        const lx = p.x + ca * 0 - sa * side * 0.25;
        const lz = p.z + sa * 0 + ca * side * 0.25;
        const fx = p.x + ca * swing * side - sa * side * 0.25;
        const fz = p.z + sa * swing * side + ca * side * 0.25;
        box(d, (lx + fx) / 2, 0.45, (lz + fz) / 2, 0.3, 0.9, 0.3, '#2c3e50', 0);
      };
      leg(1);
      leg(-1);
      box(d, p.x, 1.35, p.z, 0.9, 0.9, 0.5, '#d94f3d', 0);
      box(d, p.x, 2.05, p.z, 0.55, 0.55, 0.55, '#c98d64', 0);
      box(d, p.x, 2.35, p.z, 0.6, 0.25, 0.6, '#1c1410', 0);
      if (p.firing > 0) {
        const gx = p.x + Math.cos(a) * 0.9;
        const gz = p.z + Math.sin(a) * 0.9;
        box(d, gx, 1.5, gz, 0.5, 0.15, 0.15, '#ffd98a', 0, 1, 1, 1);
      }
    }
    // Pedestrians.
    for (const pd of state.peds) {
      if (pd.down) {
        box(d, pd.x, 0.35, pd.z, 1.6, 0.7, 0.7, pd.shirt, 0);
      } else {
        box(d, pd.x, 0.9, pd.z, 0.7, 1.1, 0.4, pd.shirt, 0);
        box(d, pd.x, 1.65, pd.z, 0.45, 0.45, 0.45, '#c98d64', 0);
      }
    }
    // Enemies + cops on foot.
    for (const e of state.enemies) {
      box(d, e.x, 0.9, e.z, 0.8, 1.1, 0.45, '#2c2c34', 0);
      box(d, e.x, 1.65, e.z, 0.5, 0.5, 0.5, '#a87a52', 0);
      box(d, e.x, 1.2, e.z, 0.9, 0.15, 0.15, '#111111', 0);
    }
    for (const c of state.cops) {
      box(d, c.x, 0.9, c.z, 0.8, 1.1, 0.45, '#1c2a4a', 0);
      box(d, c.x, 1.65, c.z, 0.5, 0.5, 0.5, '#c98d64', 0);
      box(d, c.x, 1.95, c.z, 0.55, 0.2, 0.55, '#101828', 0);
    }
    // Cash drops.
    for (const dr of state.drops) {
      const bob = 0.6 + Math.sin(time * 4 + dr.x) * 0.15;
      box(d, dr.x, bob, dr.z, 0.7, 0.25, 0.5, '#2ecc71', 0, 1, 1, 0.8);
    }
    // Mission / job marker: a bobbing diamond.
    const target = state.missionTarget ?? state.jobTarget;
    if (target) {
      const bob = 3.2 + Math.sin(time * 3) * 0.5;
      pyramid(d, target.x, bob, target.z, 1.6, 2.2, '#f2c94c', 0.9);
      pyramid(d, target.x, bob + 2.2, target.z, 1.6, -2.2, '#f2c94c', 0.9);
    }
    // Helicopter.
    if (state.heli.active) {
      const h = state.heli;
      box(d, h.x, h.y, h.z, 5, 2, 2.4, '#3a4152', 0);
      box(d, h.x, h.y - 0.4, h.z, 5.1, 0.7, 2.5, '#e8e4da', 0);
      box(d, h.x - 4, h.y + 0.4, h.z, 5, 0.8, 0.8, '#3a4152', 0);
      const ra = h.rotor;
      const r1 = [Math.cos(ra) * 4.5, 0, Math.sin(ra) * 4.5];
      const r2 = [-r1[0], 0, -r1[2]];
      box(d, h.x + r1[0] / 2, h.y + 1.3, h.z + r1[2] / 2, Math.abs(r1[0]) + 0.4, 0.15, Math.abs(r1[2]) + 0.4, '#111111', 0);
      box(d, h.x + r2[0] / 2, h.y + 1.3, h.z + r2[2] / 2, Math.abs(r2[0]) + 0.4, 0.15, Math.abs(r2[2]) + 0.4, '#111111', 0);
      box(d, h.x, h.y - 0.8, h.z, 1.1, 0.7, 1.1, '#fff2b0', 0, 1, 1, 1);
      box(d, h.x + 2.6, h.y + 0.6, h.z, 0.5, 0.5, 0.5, '#ff3b30', 0, 1, 1, 1);
      // Searchlight cone (translucent).
      const cone = [];
      const top = [h.x, h.y - 1, h.z];
      const baseY = 0.2;
      const br = 7;
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * Math.PI * 2;
        const a1 = ((i + 1) / 8) * Math.PI * 2;
        const p0 = [p.x + Math.cos(a0) * br, baseY, p.z + Math.sin(a0) * br];
        const p1 = [p.x + Math.cos(a1) * br, baseY, p.z + Math.sin(a1) * br];
        cone.push(...top, 0, 1, 0, 1, 1, 0.9, 0, 0, 0, 0);
        cone.push(...p0, 0, 1, 0, 1, 1, 0.9, 0, 0, 0, 0);
        cone.push(...p1, 0, 1, 0, 1, 0, 1, 1, 0.9, 0, 0, 0, 0);
      }
      const dyn = new Float32Array(d);
      gl.bufferData(gl.ARRAY_BUFFER, dyn, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, dyn.length / STRIDE);
      // Cone + light pool, blended.
      const coneArr = new Float32Array(cone);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1f(U.uAlpha, 0.16);
      gl.bufferData(gl.ARRAY_BUFFER, coneArr, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, coneArr.length / STRIDE);
      gl.uniform1f(U.uAlpha, 1);
      gl.disable(gl.BLEND);
      drawMinimap(state, city, time);
      return;
    }
    const dyn = new Float32Array(d);
    gl.bufferData(gl.ARRAY_BUFFER, dyn, gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, dyn.length / STRIDE);
    drawMinimap(state, city, time);
  }

  function drawMinimap(state, city, time) {
    if (!minimap) return;
    const g = minimap.getContext('2d');
    const S = minimap.width;
    const px = (x) => (x + ISLAND_R + 20) / (2 * (ISLAND_R + 20)) * S;
    g.fillStyle = '#0d4d6e';
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#5a6b4d';
    g.beginPath();
    g.arc(S / 2, S / 2, (ISLAND_R / (2 * (ISLAND_R + 20))) * S, 0, 6.29);
    g.fill();
    g.strokeStyle = '#2e3138';
    g.lineWidth = 3;
    for (let i = 0; i <= 2 * HALF; i++) {
      const c0 = (i - HALF) * GRID;
      g.beginPath();
      g.moveTo(px(c0), 0);
      g.lineTo(px(c0), S);
      g.stroke();
      g.beginPath();
      g.moveTo(0, px(c0));
      g.lineTo(S, px(c0));
      g.stroke();
    }
    const dot = (x, z, color, r) => {
      g.fillStyle = color;
      g.beginPath();
      g.arc(px(x), px(z), r, 0, 6.29);
      g.fill();
    };
    for (const s of city.shops) dot(s.x, s.z, '#2ecc71', 3);
    dot(city.garage.x, city.garage.z, '#3498db', 3);
    dot(city.safehouse.x, city.safehouse.z, '#ecf0f1', 3);
    const target = state.missionTarget ?? state.jobTarget;
    if (target) {
      const pulse = 3 + Math.sin(time * 5) * 1.5;
      dot(target.x, target.z, '#f2c94c', pulse);
    }
    for (const c of state.copCars) dot(c.x, c.z, '#e74c3c', 3);
    for (const c of state.cops) dot(c.x, c.z, '#e74c3c', 2);
    if (state.heli.active) dot(state.heli.x, state.heli.z, '#ffffff', 3);
    // Player arrow.
    const p = state.player;
    g.save();
    g.translate(px(p.x), px(p.z));
    g.rotate(p.angle);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(6, 0);
    g.lineTo(-4, -4);
    g.lineTo(-4, 4);
    g.closePath();
    g.fill();
    g.restore();
  }

  function setOverride(o) {
    override = o;
  }
  function clearOverride() {
    override = null;
  }

  return { draw, setOverride, clearOverride, camera };
}

export function drawPortrait(ctx, char, size) {
  const s = size / 100;
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, char.accent);
  grad.addColorStop(1, '#1c1c26');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  // Shoulders / jacket.
  ctx.fillStyle = '#2c2c34';
  ctx.beginPath();
  ctx.moveTo(10 * s, 100 * s);
  ctx.quadraticCurveTo(50 * s, 62 * s, 90 * s, 100 * s);
  ctx.closePath();
  ctx.fill();
  // Neck + face.
  ctx.fillStyle = char.skin;
  ctx.fillRect(44 * s, 58 * s, 12 * s, 12 * s);
  ctx.beginPath();
  ctx.ellipse(50 * s, 40 * s, 17 * s, 21 * s, 0, 0, 6.29);
  ctx.fill();
  // Hair.
  ctx.fillStyle = char.hair;
  if (char.hairStyle === 'bob') {
    ctx.beginPath();
    ctx.ellipse(50 * s, 30 * s, 18 * s, 14 * s, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(31 * s, 28 * s, 6 * s, 26 * s);
    ctx.fillRect(63 * s, 28 * s, 6 * s, 26 * s);
  } else if (char.hairStyle === 'long') {
    ctx.beginPath();
    ctx.ellipse(50 * s, 28 * s, 18 * s, 13 * s, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(30 * s, 26 * s, 7 * s, 40 * s);
    ctx.fillRect(63 * s, 26 * s, 7 * s, 40 * s);
  } else if (char.hairStyle === 'cap') {
    ctx.beginPath();
    ctx.ellipse(50 * s, 30 * s, 18 * s, 12 * s, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = char.accent;
    ctx.fillRect(30 * s, 28 * s, 40 * s, 5 * s);
  } else if (char.hairStyle === 'beard') {
    ctx.beginPath();
    ctx.ellipse(50 * s, 28 * s, 17 * s, 10 * s, 0, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(50 * s, 52 * s, 14 * s, 10 * s, 0, 0, Math.PI);
    ctx.fill();
  } else if (char.hairStyle === 'bald') {
    // Glasses.
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2 * s;
    ctx.strokeRect(34 * s, 36 * s, 12 * s, 9 * s);
    ctx.strokeRect(54 * s, 36 * s, 12 * s, 9 * s);
    ctx.beginPath();
    ctx.moveTo(46 * s, 40 * s);
    ctx.lineTo(54 * s, 40 * s);
    ctx.stroke();
  }
  // Eyes.
  ctx.fillStyle = '#141414';
  ctx.beginPath();
  ctx.arc(43 * s, 40 * s, 2.2 * s, 0, 6.29);
  ctx.arc(57 * s, 40 * s, 2.2 * s, 0, 6.29);
  ctx.fill();
  // Mouth.
  ctx.strokeStyle = '#5a2e22';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(44 * s, 54 * s);
  ctx.quadraticCurveTo(50 * s, 57 * s, 56 * s, 54 * s);
  ctx.stroke();
  // Earring for Solana.
  if (char.accent === '#d4af37') {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(67 * s, 48 * s, 2.5 * s, 0, 6.29);
    ctx.fill();
  }
  ctx.restore();
}
