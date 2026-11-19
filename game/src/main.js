// Boot and the one loop: input every frame, the world in fixed 1/60 s steps, the renderer
// paints what is there. Screens: title, play, dialogue, shop, garage, paused, wasted,
// busted, complete. ?seed=N fixes the island; ?shot=title|combat|chase|dialogue stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady.
import { STEP, SAVE_KEY, BEST_KEY, WEAPONS, ECONOMY } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_MISSION, EVENT_CASH, EVENT_WASTED, EVENT_BUSTED, EVENT_COMPLETE, EVENT_SHOT, EVENT_CRIME, CHARACTERS, MISSIONS } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_INTERACT, ACTION_RADIO, ACTION_STATION, ACTION_JOB, createInput } from './input.js';
import { createRenderer, drawPortrait, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_DIALOGUE, SCREEN_SHOP, SCREEN_GARAGE, SCREEN_WASTED, SCREEN_BUSTED, SCREEN_COMPLETE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const minimap = document.getElementById('minimap');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas, minimap);
const audio = createAudio();

const $ = (id) => document.getElementById(id);
const hud = {
  cash: $('hud-cash'), stars: $('hud-stars'), weapon: $('hud-weapon'), ammo: $('hud-ammo'),
  health: $('hud-health'), armour: $('hud-armour'), speed: $('hud-speed'), radio: $('hud-radio'),
  mission: $('hud-mission'), message: $('hud-message'), bust: $('hud-bust'), bustWrap: $('hud-bust-wrap'),
  time: $('hud-time'),
};
const screens = {
  title: $('title-screen'), dialogue: $('dialogue-box'), shop: $('shop-box'), garage: $('garage-box'),
  paused: $('paused-box'), wasted: $('wasted-box'), busted: $('busted-box'), complete: $('complete-box'),
};
const dlg = { portrait: $('dlg-portrait'), name: $('dlg-name'), lines: $('dlg-lines'), prompt: $('dlg-prompt') };
const shopEl = { title: $('shop-title'), list: $('shop-list') };
const garageEl = { list: $('garage-list') };
const completeEl = { stats: $('complete-stats') };

let screen = SCREEN_TITLE;
let best = 0;
try {
  best = Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
} catch {
  best = 0;
}
let dialogue = null; // {char, lines, i, title}
let shopKind = null;
let prevStory = 0;
let prevStage = 'pickup';
let lastHud = '';

function announce(message) {
  status.textContent = message;
}

function showScreen(next) {
  screen = next;
  // Overlay keys match the SCREEN_* names; 'play' has no overlay, so all hide.
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle('hidden', key !== next);
  }
}

let pendingComplete = false;

function showComplete() {
  const s = world.state.stats;
  completeEl.stats.textContent = `Missions ${s.missions} · Jobs ${s.jobs} · Earned $${s.earned} · Shots ${s.shots} · Hits ${s.hits} (${s.shots ? Math.round((s.hits / s.shots) * 100) : 0}%)`;
  showScreen(SCREEN_COMPLETE);
  saveGame();
}

function openDialogue(charId, lines, title) {
  dialogue = { char: CHARACTERS[charId], lines, i: 0, title };
  drawPortrait(dlg.portrait.getContext('2d'), dialogue.char, 100);
  dlg.name.textContent = `${dialogue.char.name} — ${dialogue.char.role}${title ? ` · ${title}` : ''}`;
  dlg.lines.textContent = lines[0];
  dlg.prompt.textContent = lines.length > 1 ? 'E / Space — lanjut' : 'E / Space — tutup';
  showScreen(SCREEN_DIALOGUE);
  announce(`${dialogue.char.name}: ${lines[0]}`);
}

function advanceDialogue() {
  if (!dialogue) return;
  dialogue.i++;
  if (dialogue.i >= dialogue.lines.length) {
    dialogue = null;
    if (pendingComplete) {
      pendingComplete = false;
      showComplete();
    } else {
      showScreen(SCREEN_PLAY);
    }
  } else {
    dlg.lines.textContent = dialogue.lines[dialogue.i];
    dlg.prompt.textContent = dialogue.i < dialogue.lines.length - 1 ? 'E / Space — lanjut' : 'E / Space — tutup';
    announce(dialogue.lines[dialogue.i]);
  }
}

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.serialize()));
    const earned = world.state.stats.earned;
    if (earned > best) {
      best = earned;
      window.localStorage.setItem(BEST_KEY, String(best));
    }
  } catch {
    // Storage can be off: progress then lasts this visit only.
  }
}

function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    world.loadSave(JSON.parse(raw));
    return true;
  } catch {
    return false;
  }
}

function missionText() {
  const st = world.state;
  if (st.complete) return 'STORY COMPLETE — Coral Bay is yours. Free roam.';
  const m = world.mission();
  if (!m) return '';
  const t = world.missionTarget();
  const job = world.jobTarget();
  const jobText = job ? ` · Job: ${st.job.kind} → marker` : '';
  return `${m.name} — ${st.missionStage === 'pickup' ? 'Pick up' : 'Deliver'}: ${t.label}${jobText}`;
}

function updateHud() {
  const st = world.state;
  const p = st.player;
  const w = WEAPONS[p.weapon];
  const stars = '★'.repeat(st.wanted) + '☆'.repeat(5 - st.wanted);
  const key = [
    p.cash, stars, w.name, p.mag[p.weapon], Math.round(p.health), Math.round(p.armour),
    Math.round(Math.abs(p.speed) * 3.6), audio.stationName(), audio.radioOn(), missionText(),
    st.message, Math.round(st.bust * 100), st.time,
  ].join('|');
  if (key === lastHud) return;
  lastHud = key;
  hud.cash.textContent = `$${p.cash}`;
  hud.stars.textContent = stars;
  hud.stars.style.color = st.wanted >= 4 ? '#ff5a4d' : '#ffd94c';
  hud.weapon.textContent = w.name;
  hud.ammo.textContent = `${p.mag[p.weapon]} / ${w.mag}${p.reload > 0 ? ' …' : ''}`;
  hud.health.textContent = `HP ${Math.max(0, Math.round(p.health))}`;
  hud.armour.textContent = `ARM ${Math.round(p.armour)}`;
  hud.speed.textContent = `${Math.round(Math.abs(p.speed) * 3.6)} km/h`;
  hud.radio.textContent = audio.radioOn() ? `♪ ${audio.stationName()}` : '♪ off';
  hud.mission.textContent = missionText();
  hud.message.textContent = st.message;
  hud.bustWrap.style.visibility = st.bust > 0.02 ? 'visible' : 'hidden';
  hud.bust.style.width = `${Math.round(st.bust * 100)}%`;
  const hh = Math.floor(st.time * 24);
  const mm = Math.floor((st.time * 24 - hh) * 60);
  hud.time.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const SHOP_ITEMS = {
  arms: [
    { key: '1', label: 'SMG — $450', price: 450, buy: () => buyWeapon('smg') },
    { key: '2', label: 'Shotgun — $700', price: 700, buy: () => buyWeapon('shotgun') },
    { key: '3', label: 'SMG ammo (32) — $30', price: 30, buy: () => buyAmmo('smg') },
    { key: '4', label: 'Shotgun ammo (6) — $40', price: 40, buy: () => buyAmmo('shotgun') },
    { key: '5', label: 'Pistol ammo (12) — $12', price: 12, buy: () => buyAmmo('pistol') },
  ],
  armour: [
    { key: '1', label: 'Kevlar vest (ARM 100) — $120', price: 120, buy: () => { world.state.player.armour = 100; return true; } },
  ],
  food: [
    { key: '1', label: 'Taco — $8 (HP +40)', price: 8, buy: () => { world.state.player.health = Math.min(100, world.state.player.health + 40); return true; } },
    { key: '2', label: 'Feast — $20 (HP full)', price: 20, buy: () => { world.state.player.health = 100; return true; } },
  ],
};

function buyWeapon(kind) {
  const p = world.state.player;
  if (p.owned[kind]) {
    p.weapon = kind;
    return true;
  }
  p.owned[kind] = true;
  p.weapon = kind;
  p.mag[kind] = WEAPONS[kind].mag;
  return true;
}
function buyAmmo(kind) {
  const p = world.state.player;
  if (!p.owned[kind]) return false;
  p.mag[kind] = WEAPONS[kind].mag;
  return true;
}

function openShop(kind, name) {
  shopKind = kind;
  shopEl.title.textContent = `${name} — press a number to buy, E to leave`;
  shopEl.list.innerHTML = SHOP_ITEMS[kind].map((it) => `<div>[${it.key}] ${it.label}</div>`).join('');
  showScreen(SCREEN_SHOP);
}

const GARAGE_ITEMS = [
  { key: '1', label: 'Repair car — $60', price: 60, run: () => { const c = world.state.cars.find((v) => v.id === world.state.player.carId) || world.state.myCar; if (c) c.hp = 100; return true; } },
  { key: '2', label: 'Respray (wipes heat) — $150', price: 150, run: () => { world.state.heat = 0; world.state.wanted = 0; return true; } },
  { key: '3', label: 'Engine upgrade — $600', price: 600, run: () => { const u = world.state.player.upgrades; if (u.engine >= 2) return false; u.engine++; return true; } },
  { key: '4', label: 'Armour plating — $400', price: 400, run: () => { const u = world.state.player.upgrades; if (u.plating >= 2) return false; u.plating++; return true; } },
  { key: '5', label: 'NOS boost — $350', price: 350, run: () => { const u = world.state.player.upgrades; if (u.nos) return false; u.nos = true; return true; } },
];

function openGarage() {
  garageEl.list.innerHTML = GARAGE_ITEMS.map((it) => `<div>[${it.key}] ${it.label}</div>`).join('');
  showScreen(SCREEN_GARAGE);
}

// Number keys are held, not edge-triggered: buy only on the frame the key first goes down.
let lastBuyKey = null;
function tryBuy(list) {
  let pressed = null;
  for (const it of list) {
    if (input.held(`Digit${it.key}`) || input.held(`Numpad${it.key}`)) {
      pressed = it.key;
      break;
    }
  }
  if (!pressed) {
    lastBuyKey = null;
    return;
  }
  if (pressed === lastBuyKey) return;
  lastBuyKey = pressed;
  const it = list.find((x) => x.key === pressed);
  const p = world.state.player;
  if (p.cash < it.price) {
    world.say('Not enough cash.');
    return;
  }
  const ok = it.buy ? it.buy() : it.run();
  if (ok) {
    p.cash -= it.price;
    audio.blip(880);
    saveGame();
  } else {
    world.say('Already owned / maxed.');
  }
}

function nearShop() {
  const p = world.state.player;
  for (const s of world.city.shops) {
    const dx = p.x - s.x;
    const dz = p.z - s.z;
    if (dx * dx + dz * dz < 100) return s;
  }
  return null;
}

function nearGarage() {
  const p = world.state.player;
  const g = world.city.garage;
  const dx = p.x - g.x;
  const dz = p.z - g.z;
  return dx * dx + dz * dz < 100 ? g : null;
}

function respawn(fine, label) {
  const p = world.state.player;
  p.cash = Math.max(0, p.cash - fine);
  p.health = 100;
  p.armour = Math.round(p.armour / 2);
  world.state.wanted = 0;
  world.state.heat = 0;
  world.state.bust = 0;
  world.state.copCars = [];
  world.state.cops = [];
  world.state.enemies = [];
  world.state.heli.active = false;
  if (p.inCar) {
    const car = world.state.cars.find((v) => v.id === p.carId);
    if (car) car.speed = 0;
    p.inCar = false;
    p.carId = -1;
  }
  p.x = world.city.safehouse.x;
  p.z = world.city.safehouse.z;
  p.angle = 0;
  world.say(`${label} — fined $${fine}. Back at the safehouse.`);
  saveGame();
  showScreen(SCREEN_PLAY);
}

const input = createInput(canvas);

// Debug handle for automated testing (harmless in play): the world, the
// renderer and the current screen, so a test can inspect and re-aim the camera.
window.__coral = { world, renderer, screen: () => screen };

function aimAngle() {
  const m = input.mouse();
  const w = canvas.clientWidth || 1024;
  const yaw = renderer.camera.yaw;
  return yaw + ((m.x / w) - 0.5) * 1.3;
}

function runShot(name) {
  const scene = stageShot(name, world);
  if (scene.camera) renderer.setOverride(scene.camera);
  world.state.dayFactorValue = world.dayFactor();
  world.state.missionTarget = world.missionTarget();
  world.state.jobTarget = world.jobTarget();
  if (scene.dialogue) openDialogue(scene.dialogue.char, scene.dialogue.lines, scene.dialogue.title);
  else showScreen(scene.screen);
  if (scene.screen === SCREEN_TITLE) {
    document.getElementById('title-menu').innerHTML = '<div>CORAL HEAT 3D</div><div class="sub">Coral Bay · 8 missions · WebGL2</div>';
  }
  let painted = 0;
  function paint() {
    world.state.dayFactorValue = world.dayFactor();
    world.state.missionTarget = world.missionTarget();
    world.state.jobTarget = world.jobTarget();
    renderer.draw(world.state, world.city, scene.screen, world.state.elapsed);
    updateHud();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  let pausedFrom = null;

  function startNew() {
    world.reset(true);
    prevStory = 0;
    prevStage = 'pickup';
    saveGame();
    showScreen(SCREEN_PLAY);
    announce('Coral Heat 3D. Go to the marker: First Run.');
    audio.unlock();
  }

  function continueGame() {
    if (loadGame()) {
      prevStory = world.state.storyIndex;
      prevStage = world.state.missionStage;
      showScreen(SCREEN_PLAY);
      announce('Welcome back. The city kept your progress.');
      audio.unlock();
    } else {
      startNew();
    }
  }

  function stepWorld(dt, actions) {
    const st = world.state;
    const p = st.player;
    const ctrl = {
      moveX: input.moveX(),
      moveY: input.moveY(),
      drive: input.drive(),
      steer: input.steer(),
      brake: input.brake(),
      nos: input.nos(),
      run: input.run(),
      shoot: input.shootHeld(),
      aimAngle: input.shootHeld() ? aimAngle() : null,
      interact: Boolean(actions & ACTION_INTERACT),
      camYaw: renderer.camera.yaw,
    };
    const events = world.step(dt, ctrl);
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_MISSION) {
      const m = world.mission();
      if (st.storyIndex > prevStory) {
        const done = MISSIONS[prevStory];
        openDialogue(done.giver, done.after, `${done.name} — done`);
      } else if (m && st.missionStage === 'deliver' && prevStage === 'pickup') {
        openDialogue(m.giver, m.brief, m.name);
      }
      saveGame();
    }
    if (events & EVENT_CASH) saveGame();
    if (events & EVENT_WASTED) {
      showScreen(SCREEN_WASTED);
      announce('Wasted. Press Space to respawn at the safehouse.');
    }
    if (events & EVENT_BUSTED) {
      showScreen(SCREEN_BUSTED);
      announce('Busted. Press Space to pay the fine and walk out.');
    }
    if (events & EVENT_COMPLETE) {
      // The finale's after-lines play first; the results screen follows when they close.
      if (dialogue) pendingComplete = true;
      else showComplete();
    }
    prevStory = st.storyIndex;
    prevStage = st.missionStage;
    return events;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    audio.update(dt);
    audio.engine(world.state.player.inCar ? world.state.player.speed : 0, world.state.player.inCar && screen === SCREEN_PLAY);
    audio.siren(world.state.wanted > 0 && screen === SCREEN_PLAY);

    if (screen === SCREEN_TITLE) {
      world.step(dt, { moveX: 0, moveY: 0, drive: 0, steer: 0, brake: false, nos: false, run: false, shoot: false, aimAngle: null, interact: false, camYaw: 0 });
      if (actions & ACTION_CONFIRM) {
        const saveExists = (() => {
          try {
            return !!window.localStorage.getItem(SAVE_KEY);
          } catch {
            return false;
          }
        })();
        if (saveExists) continueGame();
        else startNew();
      }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        pausedFrom = SCREEN_PLAY;
        showScreen(SCREEN_PAUSED);
        announce('Paused.');
      } else if (actions & ACTION_RADIO) {
        const on = audio.toggleRadio();
        world.say(on ? `Radio on — ${audio.stationName()}` : 'Radio off.');
      } else if (actions & ACTION_STATION) {
        if (audio.radioOn()) world.say(`Radio — ${audio.nextStation()}`);
      } else if (actions & ACTION_JOB) {
        const p = world.state.player;
        let nearest = null;
        let bd = 1600;
        for (const spot of world.state.jobSpots) {
          const d2 = (p.x - spot.x) ** 2 + (p.z - spot.z) ** 2;
          if (d2 < bd) {
            bd = d2;
            nearest = spot;
          }
        }
        if (nearest) world.startJob(nearest.kind);
        else world.say('No job stand nearby. Look for the markers.');
      } else if (actions & ACTION_INTERACT) {
        // The mission marker wins over a shop: the world handles mission interaction.
        const mt = world.missionTarget();
        const nearMission = mt && (world.state.player.x - mt.x) ** 2 + (world.state.player.z - mt.z) ** 2 < 64;
        if (!nearMission) {
          const shop = nearShop();
          const garage = nearGarage();
          if (shop) openShop(shop.kind, shop.name);
          else if (garage) openGarage();
        }
      }
      if (screen === SCREEN_PLAY) {
        const st = world.state;
        const p = st.player;
        // Weapon switching: 1/2/3.
        if (input.held('Digit1') && p.owned.pistol) p.weapon = 'pistol';
        if (input.held('Digit2') && p.owned.smg) p.weapon = 'smg';
        if (input.held('Digit3') && p.owned.shotgun) p.weapon = 'shotgun';
        stepWorld(dt, actions);
      }
    } else if (screen === SCREEN_DIALOGUE) {
      if (actions & (ACTION_CONFIRM | ACTION_INTERACT)) advanceDialogue();
    } else if (screen === SCREEN_SHOP) {
      if (actions & (ACTION_INTERACT | ACTION_PAUSE)) showScreen(SCREEN_PLAY);
      else tryBuy(SHOP_ITEMS[shopKind]);
    } else if (screen === SCREEN_GARAGE) {
      if (actions & (ACTION_INTERACT | ACTION_PAUSE)) showScreen(SCREEN_PLAY);
      else tryBuy(GARAGE_ITEMS);
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) showScreen(SCREEN_PLAY);
    } else if (screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM) respawn(ECONOMY.wastedFine, 'Wasted');
    } else if (screen === SCREEN_BUSTED) {
      if (actions & ACTION_CONFIRM) respawn(ECONOMY.bustedFine, 'Busted');
    } else if (screen === SCREEN_COMPLETE) {
      if (actions & ACTION_CONFIRM) showScreen(SCREEN_PLAY);
    }

    world.state.dayFactorValue = world.dayFactor();
    world.state.missionTarget = world.missionTarget();
    world.state.jobTarget = world.jobTarget();
    renderer.draw(world.state, world.city, screen, world.state.elapsed);
    updateHud();
  }

  document.getElementById('title-menu').innerHTML = '<div class="menu-title">CORAL HEAT 3D</div><div class="sub">Coral Bay · 8 missions · WebGL2 · press Space</div>';
  announce('Coral Heat 3D. Press Space to start.');
  showScreen(SCREEN_TITLE);
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
