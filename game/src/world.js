// CORAL HEAT 3D — the simulation: island city, driving, combat, police, missions, jobs.
// No drawing and no browser here: step() advances one fixed step and returns bit flags.
import { BLOCK, ROAD, GRID, HALF, ISLAND_R, PLAYER, CAR, WEAPONS, COP, ECONOMY, DAY_LENGTH } from './config.js';

export const EVENT_NONE = 0;
export const EVENT_MISSION = 1;
export const EVENT_CASH = 2;
export const EVENT_WASTED = 4;
export const EVENT_BUSTED = 8;
export const EVENT_COMPLETE = 16;
export const EVENT_SHOT = 32;
export const EVENT_HIT = 64;
export const EVENT_CRIME = 128;
export const EVENT_JOB = 256;

export const CHARACTERS = {
  solana: { name: 'Solana', role: 'Fixer', skin: '#c98d64', hair: '#1c1410', hairStyle: 'bob', accent: '#d4af37' },
  marco: { name: 'Marco', role: 'Wheelman', skin: '#b98a5e', hair: '#2a1c10', hairStyle: 'cap', accent: '#3e7cb1' },
  vera: { name: 'Vera', role: 'Port Boss', skin: '#e0aa80', hair: '#e8c832', hairStyle: 'long', accent: '#8e44ad' },
  rico: { name: 'Rico', role: 'Enforcer', skin: '#a87a52', hair: '#14100c', hairStyle: 'beard', accent: '#c0392b' },
  doc: { name: 'Doc', role: 'Mechanic', skin: '#8a6a48', hair: '#888888', hairStyle: 'bald', accent: '#27ae60' },
};

const rc = (i) => (i - HALF) * GRID;

export const MISSIONS = [
  {
    name: 'First Run', giver: 'solana', pay: 150,
    brief: ["Solana: Kid. A package is waiting at the marina.", 'Solana: Pick it up, bring it to the Coral Hotel. No detours.', 'Solana: Drive like you mean it, not like you stole it.'],
    after: ['Solana: Clean. The hotel concierge never saw a thing.', 'Solana: You drive all right. I may have more work.'],
    pickup: { x: 0, z: 188, label: 'Marina package' }, drop: { x: 104, z: -52, label: 'Coral Hotel' },
  },
  {
    name: 'The Collection', giver: 'solana', pay: 200,
    brief: ['Solana: Vera is holding cash at the portside bar.', 'Solana: Collect it. Bring it home to the safehouse.', 'Solana: If anyone follows you, lose them. Quietly.'],
    after: ['Solana: Counted. Every dollar. You are reliable, kid.'],
    pickup: { x: 188, z: 52, label: 'Portside bar' }, drop: { x: -156, z: 156, label: 'Safehouse' },
  },
  {
    name: 'Repo Man', giver: 'marco', pay: 250,
    brief: ['Marco: A coupe is sitting in the north car park, keys in the sun visor.', 'Marco: Take it to Doc at the garage. Do not scratch it.', 'Marco: Scratch it and the scratch comes out of your pay.'],
    after: ['Doc: Nice coupe. Shame about the paint. Just kidding — it is perfect.'],
    pickup: { x: -52, z: -156, label: 'North car park' }, drop: { x: -156, z: 156, label: 'Garage' }, car: true,
  },
  {
    name: 'Harbour Heat', giver: 'vera', pay: 300, heat: 2,
    brief: ['Vera: The harbour police are sniffing around my crates.', 'Vera: Run this courier bag to the marina while they watch.', 'Vera: Two stars of attention comes with the job. Do not get caught.'],
    after: ['Vera: You ran it with the whole harbour watching. Respect.'],
    pickup: { x: 188, z: -52, label: 'Harbour crates' }, drop: { x: 0, z: 188, label: 'Marina warehouse' },
  },
  {
    name: 'Night Fare', giver: 'marco', pay: 350, night: true,
    brief: ['Marco: Night shift. Three fares, one car, no questions.', 'Marco: Pick them up, drop them off. Tips are yours.'],
    after: ['Marco: Three fares, zero complaints. The night suits you.'],
    pickup: { x: 52, z: -156, label: 'Taxi stand' }, drop: { x: -104, z: 104, label: 'Last fare' }, taxi: true,
  },
  {
    name: 'The Shipment', giver: 'vera', pay: 450, combat: 3,
    brief: ['Vera: Crates at the port. Three of Rico\'s boys are guarding them.', 'Vera: They will not hand them over. So do not ask nicely.', 'Vera: Take the crates to the marina warehouse.'],
    after: ['Vera: Rico\'s boys are swimming home. The crates are mine.'],
    pickup: { x: 188, z: -104, label: 'Port crates' }, drop: { x: 0, z: 188, label: 'Marina warehouse' },
  },
  {
    name: 'Loose Ends', giver: 'solana', pay: 500, combat: 3,
    brief: ['Solana: Rico sent enforcers to the docks. They know your face.', 'Solana: Settle it, then deliver these documents to Vera.', 'Solana: Come back in one piece. I hate funerals.'],
    after: ['Solana: Loose ends tied. Vera has her papers. You have my thanks.'],
    pickup: { x: -188, z: 52, label: 'Docks' }, drop: { x: 188, z: 52, label: 'Vera at the port' },
  },
  {
    name: 'Coral Heat', giver: 'solana', pay: 800, combat: 4, finale: true,
    brief: ['Solana: The ledger. It is at the lighthouse, and Rico wants it more.', 'Solana: Get it. Bring it home. This ends tonight.', 'Solana: Whatever happens out there — drive like the city is yours.'],
    after: ['Solana: The ledger is ours. Rico is finished in Coral Bay.', 'Solana: You did it, kid. The city is yours now.'],
    pickup: { x: -188, z: -188, label: 'Lighthouse' }, drop: { x: -156, z: 156, label: 'Safehouse' },
  },
];

const JOB_SPOTS = [
  { kind: 'taxi', x: 52, z: -156, label: 'Taxi stand' },
  { kind: 'courier', x: -52, z: 156, label: 'Courier office' },
  { kind: 'sprint', x: 0, z: -156, label: 'Sprint start' },
];

function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function createWorld(random) {
  // ---- city generation (seeded, deterministic) ----
  const city = { nodes: [], buildings: [], trees: [], boats: [], containers: [], parks: [], shops: [], safehouse: { x: -156, z: 156 }, garage: { x: -156, z: 140 } };
  for (let i = 0; i <= 2 * HALF; i++) {
    for (let j = 0; j <= 2 * HALF; j++) city.nodes.push({ x: rc(i), z: rc(j), i, j });
  }
  // Nodes are pushed i-outer, j-inner, so index = i * width + j.
  const nodeAt = (i, j) => city.nodes[i * (2 * HALF + 1) + j];
  const tints = ['#c9a37e', '#b8c4cc', '#d8b48f', '#9fb3c8', '#c8b8a0', '#e0a080'];
  for (let bi = 0; bi < 2 * HALF; bi++) {
    for (let bj = 0; bj < 2 * HALF; bj++) {
      const cx = rc(bi) + GRID / 2;
      const cz = rc(bj) + GRID / 2;
      // A couple of blocks are parks, the rest hold 1-2 buildings.
      if ((bi === 1 && bj === 4) || (bi === 4 && bj === 1)) {
        city.parks.push({ x: cx, z: cz });
        for (let t = 0; t < 5; t++) city.trees.push({ x: cx + random.range(-16, 16), z: cz + random.range(-16, 16), s: random.range(0.8, 1.4) });
        continue;
      }
      const n = random.next() < 0.45 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const w = n === 1 ? random.range(26, 34) : random.range(14, 18);
        const d = n === 1 ? random.range(26, 34) : random.range(14, 18);
        const ox = n === 1 ? 0 : (k === 0 ? -9 : 9);
        const oz = n === 1 ? 0 : (k === 0 ? -9 : 9);
        const h = 8 + Math.abs(Math.sin((bi + 1) * (bj + 2))) * 26 + random.range(0, 6);
        city.buildings.push({ x: cx + ox, z: cz + oz, w, d, h, tint: random.pick(tints), seed: random.int(0, 9999) });
      }
      for (let t = 0; t < 2; t++) city.trees.push({ x: cx + random.range(-19, 19), z: cz + random.range(-19, 19), s: random.range(0.7, 1.2) });
    }
  }
  // Marina (south), port (east), lighthouse (north-west corner).
  for (let b = 0; b < 6; b++) city.boats.push({ x: -120 + b * 48, z: 198, angle: random.range(-0.2, 0.2), hull: random.pick(['#e8e8e8', '#d94f3d', '#3e7cb1']) });
  for (let c = 0; c < 10; c++) city.containers.push({ x: 196, z: -90 + c * 20, color: random.pick(['#c0392b', '#2980b9', '#27ae60', '#f39c12']) });
  city.shops = [
    { kind: 'arms', name: 'Ammu-Nation', x: -104, z: -104 },
    { kind: 'armour', name: 'Vest & Co', x: 104, z: -104 },
    { kind: 'food', name: 'Taco Pier', x: -104, z: 188 },
  ];
  city.lighthouse = { x: -188, z: -188 };

  // ---- state ----
  const state = {
    time: 0.28, // morning
    elapsed: 0,
    player: {
      x: city.safehouse.x, z: city.safehouse.z, angle: 0, speed: 0,
      health: PLAYER.health, armour: 0, cash: ECONOMY.startCash,
      inCar: false, carId: -1, weapon: 'pistol', mag: { pistol: 12, smg: 0, shotgun: 0 },
      owned: { pistol: true, smg: false, shotgun: false },
      upgrades: { engine: 0, plating: 0, nos: false },
      invuln: 0, walkPhase: 0, firing: 0, reload: 0,
    },
    cars: [],
    peds: [],
    cops: [],
    copCars: [],
    enemies: [],
    drops: [],
    tracers: [],
    heli: { active: false, x: 0, z: 0, y: 42, angle: 0, rotor: 0 },
    roadblocks: [],
    wanted: 0,
    heat: 0,
    bust: 0,
    crimeTimer: 99,
    storyIndex: 0,
    missionStage: 'pickup', // pickup | deliver | done
    missionDone: 0,
    job: null,
    jobSpots: JOB_SPOTS,
    message: '',
    messageTimer: 0,
    stats: { earned: 0, missions: 0, jobs: 0, shots: 0, hits: 0 },
    complete: false,
    myCar: null, // the player's own coupe, parked at the safehouse
  };

  const CAR_COLORS = ['#d94f3d', '#3e7cb1', '#f2c94c', '#7d8a99', '#27ae60', '#8e44ad', '#e67e22'];

  function spawnTraffic() {
    for (let i = 0; i < 14; i++) {
      const a = nodeAt(random.int(0, 6), random.int(0, 6));
      let b = nodeAt(Math.min(6, a.i + 1), a.j);
      if (random.next() < 0.5) b = nodeAt(a.i, Math.min(6, a.j + 1));
      state.cars.push({ id: i, x: a.x, z: a.z, angle: 0, speed: random.range(8, 14), color: random.pick(CAR_COLORS), nodeA: a, nodeB: b, t: random.next(), traffic: true, parked: false, hp: 100 });
    }
  }

  function spawnPeds() {
    for (let i = 0; i < 18; i++) {
      const a = nodeAt(random.int(0, 6), random.int(0, 6));
      const b = nodeAt(Math.min(6, a.i + 1), a.j);
      state.peds.push({ x: a.x + random.range(-8, 8), z: a.z + random.range(-8, 8), angle: random.next() * 6.28, speed: random.range(1, 2.2), nodeA: a, nodeB: b, t: random.next(), down: false, timer: 0, shirt: random.pick(['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#ecf0f1']) });
    }
  }

  function reset(full) {
    state.time = 0.28;
    state.elapsed = 0;
    const p = state.player;
    p.x = city.safehouse.x;
    p.z = city.safehouse.z;
    p.angle = 0;
    p.speed = 0;
    p.health = PLAYER.health;
    p.armour = 0;
    p.inCar = false;
    p.carId = -1;
    p.invuln = 0;
    p.firing = 0;
    p.reload = 0;
    if (full) {
      p.cash = ECONOMY.startCash;
      p.weapon = 'pistol';
      p.mag = { pistol: 12, smg: 0, shotgun: 0 };
      p.owned = { pistol: true, smg: false, shotgun: false };
      p.upgrades = { engine: 0, plating: 0, nos: false };
      state.storyIndex = 0;
      state.missionDone = 0;
      state.stats = { earned: 0, missions: 0, jobs: 0, shots: 0, hits: 0 };
      state.complete = false;
    }
    state.cars = [];
    state.peds = [];
    state.cops = [];
    state.copCars = [];
    state.enemies = [];
    state.drops = [];
    state.tracers = [];
    state.roadblocks = [];
    state.heli.active = false;
    state.wanted = 0;
    state.heat = 0;
    state.bust = 0;
    state.missionStage = 'pickup';
    state.job = null;
    state.message = '';
    state.messageTimer = 0;
    state.myCar = null;
    spawnTraffic();
    spawnPeds();
    // The player's own coupe, parked by the safehouse.
    const coupe = { id: 900, x: city.safehouse.x + 6, z: city.safehouse.z - 4, angle: 1.57, speed: 0, color: '#d94f3d', traffic: false, parked: true, hp: 100, mine: true };
    state.cars.push(coupe);
    state.myCar = coupe;
    // Loaner cars parked where missions start, so the first job never strands the player.
    state.cars.push({ id: 901, x: 14, z: 168, angle: 0, speed: 0, color: '#3e7cb1', traffic: false, parked: true, hp: 100 });
    state.cars.push({ id: 902, x: 168, z: 62, angle: 1.57, speed: 0, color: '#f2c94c', traffic: false, parked: true, hp: 100 });
  }

  function say(text) {
    state.message = text;
    state.messageTimer = 4;
  }

  function addHeat(amount) {
    state.heat = Math.min(5, state.heat + amount);
    state.wanted = Math.ceil(state.heat);
    state.crimeTimer = 0;
    return EVENT_CRIME;
  }

  function mission() {
    return MISSIONS[state.storyIndex] ?? null;
  }

  function missionTarget() {
    const m = mission();
    if (!m) return null;
    return state.missionStage === 'pickup' ? m.pickup : m.drop;
  }

  function nearestCar(x, z, maxD) {
    let best = null;
    let bestD = maxD * maxD;
    for (const c of state.cars) {
      const d = dist2(x, z, c.x, c.z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  function collideBuildings(x, z, r) {
    for (const b of city.buildings) {
      const nx = Math.max(b.x - b.w / 2, Math.min(x, b.x + b.w / 2));
      const nz = Math.max(b.z - b.d / 2, Math.min(z, b.z + b.d / 2));
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.001;
        const push = (r - d) / d;
        return { x: x + dx * push, z: z + dz * push, hit: true };
      }
    }
    return { x, z, hit: false };
  }

  function rayBlocked(x1, z1, x2, z2) {
    // Sample the segment against building AABBs.
    for (let t = 0; t <= 1; t += 0.05) {
      const x = x1 + (x2 - x1) * t;
      const z = z1 + (z2 - z1) * t;
      for (const b of city.buildings) {
        if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) return true;
      }
    }
    return false;
  }

  function shoot(fromX, fromZ, angle, weaponKey, byPlayer, shooter = null) {
    const w = WEAPONS[weaponKey];
    const pellets = w.pellets ?? 1;
    let events = EVENT_SHOT;
    for (let p = 0; p < pellets; p++) {
      const a = angle + (random.next() - 0.5) * w.spread * 2;
      const tx = fromX + Math.cos(a) * w.range;
      const tz = fromZ + Math.sin(a) * w.range;
      let hx = tx;
      let hz = tz;
      // Hit the nearest enemy/cop/ped/player along the ray (never the shooter).
      let bestD = w.range;
      let victim = null;
      let victimKind = null;
      const targets = [];
      for (const e of state.enemies) if (e !== shooter) targets.push({ x: e.x, z: e.z, r: 0.9, o: e, kind: 'enemy' });
      for (const c of state.cops) if (c !== shooter) targets.push({ x: c.x, z: c.z, r: 0.9, o: c, kind: 'cop' });
      for (const c of state.copCars) targets.push({ x: c.x, z: c.z, r: 2.2, o: c, kind: 'copcar' });
      for (const pd of state.peds) if (!pd.down) targets.push({ x: pd.x, z: pd.z, r: 0.8, o: pd, kind: 'ped' });
      if (!byPlayer) targets.push({ x: state.player.x, z: state.player.z, r: 0.9, o: state.player, kind: 'player' });
      for (const t of targets) {
        const dx = t.x - fromX;
        const dz = t.z - fromZ;
        const along = dx * Math.cos(a) + dz * Math.sin(a);
        if (along < 0 || along > bestD) continue;
        const perp = Math.abs(-dx * Math.sin(a) + dz * Math.cos(a));
        if (perp < t.r) {
          bestD = along;
          victim = t.o;
          victimKind = t.kind;
        }
      }
      // Buildings block the shot.
      if (victim && rayBlocked(fromX, fromZ, victim.x, victim.z)) {
        victim = null;
      }
      if (victim) {
        hx = victim.x;
        hz = victim.z;
        if (victimKind === 'enemy') {
          victim.health -= w.damage;
          if (byPlayer) state.stats.hits++;
          if (victim.health <= 0) {
            victim.dead = true;
            state.drops.push({ x: victim.x, z: victim.z, amount: 25 });
          }
        } else if (victimKind === 'cop') {
          victim.health -= w.damage;
          if (victim.health <= 0) victim.dead = true;
          if (byPlayer) events |= addHeat(1);
        } else if (victimKind === 'copcar') {
          victim.hp -= w.damage;
          if (victim.hp <= 0) victim.dead = true;
          if (byPlayer) events |= addHeat(0.5);
        } else if (victimKind === 'ped') {
          victim.down = true;
          victim.timer = 8;
          if (byPlayer) events |= addHeat(1.5);
        } else if (victimKind === 'player') {
          damagePlayer(w.damage, false);
          events |= EVENT_HIT;
        }
      }
      state.tracers.push({ x1: fromX, y1: 1.4, z1: fromZ, x2: hx, y2: 1.4, z2: hz, life: 0.09 });
    }
    return events;
  }

  function damagePlayer(amount, armoured) {
    const p = state.player;
    if (p.invuln > 0) return;
    let left = amount;
    if (armoured && p.armour > 0) {
      const absorbed = Math.min(p.armour, left * 0.7);
      p.armour -= absorbed;
      left -= absorbed;
    }
    if (p.upgrades.plating > 0) left *= 1 - 0.15 * p.upgrades.plating;
    p.health -= left;
    p.invuln = 0.25;
  }

  // ---- police ----
  function astar(from, to) {
    const W = 2 * HALF + 1;
    const key = (i, j) => j * W + i;
    const open = [{ i: from.i, j: from.j, g: 0, f: 0, parent: null }];
    const seen = new Map();
    seen.set(key(from.i, from.j), 0);
    while (open.length > 0) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (open[k].f < open[bi].f) bi = k;
      const cur = open.splice(bi, 1)[0];
      if (cur.i === to.i && cur.j === to.j) {
        const path = [];
        let n = cur;
        while (n) {
          path.unshift(nodeAt(n.i, n.j));
          n = n.parent;
        }
        return path;
      }
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = cur.i + di;
        const nj = cur.j + dj;
        if (ni < 0 || ni > 2 * HALF || nj < 0 || nj > 2 * HALF) continue;
        const g = cur.g + 1;
        const k = key(ni, nj);
        if (seen.has(k) && seen.get(k) <= g) continue;
        seen.set(k, g);
        open.push({ i: ni, j: nj, g, f: g + Math.abs(ni - to.i) + Math.abs(nj - to.j), parent: cur });
      }
    }
    return [to];
  }

  function nearestNode(x, z) {
    let best = city.nodes[0];
    let bd = Infinity;
    for (const n of city.nodes) {
      const d = dist2(x, z, n.x, n.z);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }

  function maintainPolice(dt) {
    const p = state.player;
    // Cop cars: one per star, up to 5. They respond from a nearby
    // intersection, not the far map edge: an edge-spawned car takes 20+
    // seconds to arrive, and by then the on-foot cop has already gunned a
    // stationary player down — the bust meter (which needs a cop car within
    // 7 units) never gets a chance to fill.
    while (state.copCars.length < state.wanted) {
      const pn = nearestNode(p.x, p.z);
      let di = 0, dj = 0;
      while (di === 0 && dj === 0) {
        di = random.int(-2, 2);
        dj = random.int(-2, 2);
      }
      const n = nodeAt(Math.max(0, Math.min(2 * HALF, pn.i + di)), Math.max(0, Math.min(2 * HALF, pn.j + dj)));
      state.copCars.push({ id: 1000 + state.copCars.length, x: n.x, z: n.z, angle: 0, speed: 0, color: '#20242c', cop: true, traffic: false, parked: false, hp: 100, path: [], pathI: 0, repath: 0 });
    }
    while (state.copCars.length > state.wanted) state.copCars.pop();
    while (state.cops.length < Math.min(state.wanted, 3)) {
      state.cops.push({ x: p.x + random.range(-30, 30), z: p.z + random.range(-30, 30), angle: 0, health: 40, shootTimer: random.range(0.5, 1.5), strafe: random.pick([-1, 1]) });
    }
    while (state.cops.length > Math.min(state.wanted, 3)) state.cops.pop();
    // Helicopter at 4+ stars.
    state.heli.active = state.wanted >= 4;
    // Roadblocks at 5 stars.
    if (state.wanted >= 5 && state.roadblocks.length === 0) {
      const pn = nearestNode(p.x, p.z);
      const ahead = nodeAt(Math.max(0, Math.min(6, pn.i + (p.x > 0 ? 1 : -1))), pn.j);
      for (const n of [pn, ahead]) {
        state.roadblocks.push({ x: n.x + 6, z: n.z, angle: 1.57 });
        state.roadblocks.push({ x: n.x - 6, z: n.z, angle: 1.57 });
      }
      say('ROADBLOCK AHEAD — the whole city is looking for you.');
    }
    if (state.wanted < 5) state.roadblocks = [];
    // Wanted decays when quiet.
    state.crimeTimer += dt;
    if (state.crimeTimer > 25 && state.wanted > 0) {
      state.heat = Math.max(0, state.heat - dt * 0.06);
      state.wanted = Math.ceil(state.heat);
    }
  }

  function stepCopCars(dt) {
    const p = state.player;
    const target = nearestNode(p.x, p.z);
    for (const c of state.copCars) {
      c.repath -= dt;
      if (c.repath <= 0 || c.path.length === 0) {
        c.path = astar(nearestNode(c.x, c.z), target);
        c.pathI = 0;
        c.repath = 1;
      }
      const wp = c.path[Math.min(c.pathI, c.path.length - 1)];
      const dx = wp.x - c.x;
      const dz = wp.z - c.z;
      const d = Math.hypot(dx, dz);
      if (d < 8 && c.pathI < c.path.length - 1) c.pathI++;
      const distP = Math.hypot(p.x - c.x, p.z - c.z);
      // Close in: steer straight at the player instead of the last node, so the
      // car parks on the player and the bust meter can actually fill.
      let tx = wp.x;
      let tz = wp.z;
      if (c.pathI >= c.path.length - 1 && distP < 30) {
        tx = p.x;
        tz = p.z;
      }
      const want = Math.atan2(tz - c.z, tx - c.x);
      let da = want - c.angle;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      c.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, da));
      if (c.angle > Math.PI) c.angle -= 2 * Math.PI;
      if (c.angle < -Math.PI) c.angle += 2 * Math.PI;
      // Brake hard for the turn: the turn radius (speed / turn rate) must stay
      // inside the waypoint arrival radius, or the car circles the node forever.
      const targetSpeed = distP < 8 ? 10 : d < 20 ? Math.max(8, d * 0.9) : COP.carSpeed;
      c.speed += (targetSpeed - c.speed) * Math.min(1, dt * 1.5);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.z += Math.sin(c.angle) * c.speed * dt;
      // Ram the player when close.
      if (distP < 4 && p.inCar) {
        const car = state.cars.find((v) => v.id === p.carId);
        if (car) {
          car.speed *= 0.94;
          damagePlayer(2 * dt * 10, true);
        }
      }
    }
    state.copCars = state.copCars.filter((c) => !c.dead);
  }

  function stepCops(dt) {
    const p = state.player;
    for (const c of state.cops) {
      if (c.dead) continue;
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const d = Math.hypot(dx, dz);
      c.angle = Math.atan2(dz, dx);
      if (d > COP.shootRange) {
        c.x += Math.cos(c.angle) * COP.footSpeed * dt;
        c.z += Math.sin(c.angle) * COP.footSpeed * dt;
      } else {
        // Strafe sideways while shooting.
        c.x += Math.cos(c.angle + Math.PI / 2) * c.strafe * 2.4 * dt;
        c.z += Math.sin(c.angle + Math.PI / 2) * c.strafe * 2.4 * dt;
        if (random.next() < dt * 0.2) c.strafe *= -1;
        c.shootTimer -= dt;
        if (c.shootTimer <= 0) {
          c.shootTimer = random.range(0.7, 1.4);
          if (!rayBlocked(c.x, c.z, p.x, p.z) && random.next() < COP.accuracy) {
            shoot(c.x, c.z, c.angle, 'pistol', false, c);
          } else {
            state.tracers.push({ x1: c.x, y1: 1.4, z1: c.z, x2: p.x + random.range(-4, 4), y2: 1.4, z2: p.z + random.range(-4, 4), life: 0.09 });
          }
        }
      }
      const hit = collideBuildings(c.x, c.z, 0.8);
      c.x = hit.x;
      c.z = hit.z;
    }
    state.cops = state.cops.filter((c) => !c.dead);
  }

  function stepEnemies(dt) {
    const p = state.player;
    for (const e of state.enemies) {
      if (e.dead) continue;
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const d = Math.hypot(dx, dz);
      e.angle = Math.atan2(dz, dx);
      if (d > 26) {
        e.x += Math.cos(e.angle) * 5 * dt;
        e.z += Math.sin(e.angle) * 5 * dt;
      } else {
        e.x += Math.cos(e.angle + Math.PI / 2) * e.strafe * 3 * dt;
        e.z += Math.sin(e.angle + Math.PI / 2) * e.strafe * 3 * dt;
        if (random.next() < dt * 0.25) e.strafe *= -1;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = random.range(0.8, 1.6);
          if (!rayBlocked(e.x, e.z, p.x, p.z) && random.next() < 0.4) shoot(e.x, e.z, e.angle, 'smg', false, e);
          else state.tracers.push({ x1: e.x, y1: 1.4, z1: e.z, x2: p.x + random.range(-4, 4), y2: 1.4, z2: p.z + random.range(-4, 4), life: 0.09 });
        }
      }
      const hit = collideBuildings(e.x, e.z, 0.8);
      e.x = hit.x;
      e.z = hit.z;
    }
    state.enemies = state.enemies.filter((e) => !e.dead);
  }

  function stepTraffic(dt) {
    for (const c of state.cars) {
      if (!c.traffic) continue;
      const dx = c.nodeB.x - c.x;
      const dz = c.nodeB.z - c.z;
      const d = Math.hypot(dx, dz);
      const want = Math.atan2(dz, dx);
      let da = want - c.angle;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      c.angle += Math.max(-3 * dt, Math.min(3 * dt, da));
      // Slow for the player car ahead.
      const p = state.player;
      let slow = false;
      if (p.inCar) {
        const car = state.cars.find((v) => v.id === p.carId);
        if (car && dist2(c.x, c.z, car.x, car.z) < 100) slow = true;
      }
      const sp = slow ? 0 : c.speed;
      c.x += Math.cos(c.angle) * sp * dt;
      c.z += Math.sin(c.angle) * sp * dt;
      if (d < 4) {
        c.nodeA = c.nodeB;
        const opts = [];
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = c.nodeB.i + di;
          const nj = c.nodeB.j + dj;
          if (ni >= 0 && ni <= 6 && nj >= 0 && nj <= 6) opts.push(nodeAt(ni, nj));
        }
        c.nodeB = random.pick(opts);
      }
    }
  }

  function stepPeds(dt) {
    for (const pd of state.peds) {
      if (pd.down) {
        pd.timer -= dt;
        if (pd.timer <= 0) {
          pd.down = false;
          pd.x = nodeAt(random.int(0, 6), random.int(0, 6)).x + random.range(-8, 8);
          pd.z = nodeAt(random.int(0, 6), random.int(0, 6)).z + random.range(-8, 8);
        }
        continue;
      }
      const dx = pd.nodeB.x - pd.x;
      const dz = pd.nodeB.z - pd.z;
      const d = Math.hypot(dx, dz);
      pd.angle = Math.atan2(dz, dx);
      pd.x += Math.cos(pd.angle) * pd.speed * dt;
      pd.z += Math.sin(pd.angle) * pd.speed * dt;
      if (d < 3) {
        pd.nodeA = pd.nodeB;
        const opts = [];
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = pd.nodeB.i + di;
          const nj = pd.nodeB.j + dj;
          if (ni >= 0 && ni <= 6 && nj >= 0 && nj <= 6) opts.push(nodeAt(ni, nj));
        }
        pd.nodeB = random.pick(opts);
      }
      // Run over by a car?
      const p = state.player;
      if (p.inCar) {
        const car = state.cars.find((v) => v.id === p.carId);
        if (car && Math.abs(car.speed) > 5 && dist2(pd.x, pd.z, car.x, car.z) < 5) {
          pd.down = true;
          pd.timer = 8;
          addHeat(1.5);
        }
      }
    }
  }

  function stepJob(dt) {
    const job = state.job;
    if (!job) return EVENT_NONE;
    let events = EVENT_NONE;
    if (job.kind === 'taxi') {
      const target = job.stage === 'pickup' ? job.pickup : job.drop;
      if (dist2(state.player.x, state.player.z, target.x, target.z) < 36) {
        if (job.stage === 'pickup') {
          job.stage = 'drop';
          say('Passenger aboard. Take them to the marker.');
        } else {
          const pay = job.pay;
          state.player.cash += pay;
          state.stats.earned += pay;
          state.stats.jobs++;
          state.job = null;
          say(`Fare complete. +$${pay}`);
          events |= EVENT_JOB | EVENT_CASH;
        }
      }
    } else if (job.kind === 'courier') {
      const target = job.stops[job.i];
      if (dist2(state.player.x, state.player.z, target.x, target.z) < 36) {
        job.i++;
        if (job.i >= job.stops.length) {
          const pay = job.pay;
          state.player.cash += pay;
          state.stats.earned += pay;
          state.stats.jobs++;
          state.job = null;
          say(`All parcels delivered. +$${pay}`);
          events |= EVENT_JOB | EVENT_CASH;
        } else {
          say(`Parcel ${job.i} of ${job.stops.length} delivered. Next marker.`);
        }
      }
    } else if (job.kind === 'sprint') {
      job.timer -= dt;
      const target = job.gates[job.i];
      if (dist2(state.player.x, state.player.z, target.x, target.z) < 49) {
        job.i++;
        if (job.i >= job.gates.length) {
          const pay = job.timer > 0 ? job.pay : Math.floor(job.pay / 2);
          state.player.cash += pay;
          state.stats.earned += pay;
          state.stats.jobs++;
          state.job = null;
          say(job.timer > 0 ? `Sprint won! +$${pay}` : `Sprint finished late. +$${pay}`);
          events |= EVENT_JOB | EVENT_CASH;
        } else {
          say(`Gate ${job.i + 1} of ${job.gates.length}`);
        }
      }
      if (job.timer <= 0 && state.job) {
        state.job = null;
        say('Sprint failed — out of time.');
      }
    }
    return events;
  }

  function startJob(kind) {
    const p = state.player;
    if (kind === 'taxi') {
      const pick = nodeAt(random.int(0, 6), random.int(0, 6));
      const drop = nodeAt(random.int(0, 6), random.int(0, 6));
      state.job = { kind, stage: 'pickup', pickup: { x: pick.x, z: pick.z }, drop: { x: drop.x, z: drop.z }, pay: 60 + random.int(0, 60) };
      say('Taxi job: pick up the passenger at the marker.');
    } else if (kind === 'courier') {
      const stops = [];
      for (let i = 0; i < 3; i++) {
        const n = nodeAt(random.int(0, 6), random.int(0, 6));
        stops.push({ x: n.x, z: n.z });
      }
      state.job = { kind, i: 0, stops, pay: 150 };
      say('Courier job: deliver 3 parcels, in order.');
    } else if (kind === 'sprint') {
      const gates = [];
      for (let i = 0; i < 5; i++) {
        const n = nodeAt(random.int(0, 6), random.int(0, 6));
        gates.push({ x: n.x, z: n.z });
      }
      state.job = { kind, i: 0, gates, timer: 90, pay: 250 };
      say('Sprint: 5 gates, 90 seconds. Go!');
    }
  }

  function jobTarget() {
    const job = state.job;
    if (!job) return null;
    if (job.kind === 'taxi') return job.stage === 'pickup' ? job.pickup : job.drop;
    if (job.kind === 'courier') return job.stops[job.i];
    if (job.kind === 'sprint') return job.gates[job.i];
    return null;
  }

  function completeMission() {
    const m = mission();
    state.player.cash += m.pay;
    state.stats.earned += m.pay;
    state.stats.missions++;
    state.missionDone++;
    state.storyIndex++;
    state.missionStage = 'pickup';
    if (state.storyIndex >= MISSIONS.length) {
      state.complete = true;
      return EVENT_MISSION | EVENT_CASH | EVENT_COMPLETE;
    }
    const next = mission();
    say(`Mission complete — ${m.name}. +$${m.pay}. Next: ${next.name}.`);
    return EVENT_MISSION | EVENT_CASH;
  }

  // ---- the one step ----
  function step(dt, ctrl) {
    const p = state.player;
    let events = EVENT_NONE;
    state.elapsed += dt;
    state.time = (state.time + dt / DAY_LENGTH) % 1;
    if (state.messageTimer > 0) {
      state.messageTimer -= dt;
      if (state.messageTimer <= 0) state.message = '';
    }
    if (p.invuln > 0) p.invuln -= dt;
    if (p.reload > 0) p.reload -= dt;
    if (p.firing > 0) p.firing -= dt;

    // Mission scripting: scripted heat and night.
    const m = mission();
    if (m) {
      if (m.heat && state.missionStage === 'deliver' && state.heat < m.heat) state.heat = m.heat;
      if (m.night && state.missionStage === 'deliver') state.time = 0.9;
    }

    // ---- movement ----
    if (p.inCar) {
      const car = state.cars.find((v) => v.id === p.carId);
      if (car) {
        const maxSpeed = CAR.maxSpeed * (1 + 0.25 * p.upgrades.engine) * (ctrl.nos && p.upgrades.nos ? 1.5 : 1);
        if (ctrl.drive > 0) car.speed += CAR.accel * dt;
        else if (ctrl.drive < 0) car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.5) * dt;
        else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
        if (ctrl.brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CAR.brake * dt);
        car.speed = Math.max(-CAR.reverse, Math.min(maxSpeed, car.speed));
        const steer = ctrl.steer * (car.speed >= 0 ? 1 : -1);
        car.angle += steer * CAR.turn * dt * Math.min(1, Math.abs(car.speed) / 8 + 0.2);
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.z += Math.sin(car.angle) * car.speed * dt;
        const hit = collideBuildings(car.x, car.z, CAR.radius);
        if (hit.hit) {
          car.x = hit.x;
          car.z = hit.z;
          car.speed *= 0.5;
        }
        const rr = Math.hypot(car.x, car.z);
        if (rr > ISLAND_R - 4) {
          const s = (ISLAND_R - 4) / rr;
          car.x *= s;
          car.z *= s;
          car.speed *= 0.6;
        }
        p.x = car.x;
        p.z = car.z;
        p.angle = car.angle;
        p.speed = car.speed;
      } else {
        p.inCar = false;
      }
    } else {
      const run = ctrl.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      let mx = ctrl.moveX;
      let my = ctrl.moveY;
      const len = Math.hypot(mx, my);
      if (len > 1) {
        mx /= len;
        my /= len;
      }
      // Camera-relative movement (camYaw passed in ctrl): forward is the camera's
      // look direction (cos, sin), right is (-sin, cos); W must move away from the camera.
      const cy = ctrl.camYaw ?? 0;
      const wx = my * Math.cos(cy) - mx * Math.sin(cy);
      const wz = my * Math.sin(cy) + mx * Math.cos(cy);
      p.x += wx * run * dt;
      p.z += wz * run * dt;
      if (len > 0.1) {
        const want = Math.atan2(wz, wx);
        let da = want - p.angle;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        p.angle += Math.max(-PLAYER.turn * dt, Math.min(PLAYER.turn * dt, da));
      }
      p.speed = len * run;
      p.walkPhase += dt * (len > 0.1 ? run * 0.9 : 0);
      const hit = collideBuildings(p.x, p.z, PLAYER.radius);
      p.x = hit.x;
      p.z = hit.z;
      const rr = Math.hypot(p.x, p.z);
      if (rr > ISLAND_R - 2) {
        const s = (ISLAND_R - 2) / rr;
        p.x *= s;
        p.z *= s;
      }
    }

    // ---- interact (edge) ----
    if (ctrl.interact) {
      // Delivering works from the car too: drive into the marker and press E.
      const deliverTarget = missionTarget();
      const nearDeliver = m && state.missionStage === 'deliver' && deliverTarget
        && dist2(p.x, p.z, deliverTarget.x, deliverTarget.z) < 64;
      if (nearDeliver) {
        if (state.enemies.length === 0) {
          events |= completeMission();
        } else {
          say('Clear the hostiles first!');
        }
      } else if (!p.inCar) {
        // Mission pickup.
        const target = missionTarget();
        if (m && target && dist2(p.x, p.z, target.x, target.z) < 64) {
          if (state.missionStage === 'pickup') {
            state.missionStage = 'deliver';
            if (m.car) {
              const coupe = nearestCar(target.x, target.z, 30);
              if (coupe) {
                coupe.parked = false;
                p.inCar = true;
                p.carId = coupe.id;
              }
            }
            if (m.combat) {
              for (let i = 0; i < m.combat; i++) {
                state.enemies.push({ x: m.drop.x + (i - 1) * 8, z: m.drop.z + 10 + (i % 2) * 8, angle: 0, health: 60, shootTimer: 1 + i * 0.4, strafe: i % 2 === 0 ? 1 : -1, dead: false });
              }
              say('Hostiles at the drop point. Clear them out.');
            } else {
              say(`Got it. Deliver to ${m.drop.label}.`);
            }
            events |= EVENT_MISSION;
          }
        } else {
          // Job spots.
          let started = false;
          for (const spot of JOB_SPOTS) {
            if (dist2(p.x, p.z, spot.x, spot.z) < 64) {
              startJob(spot.kind);
              started = true;
              break;
            }
          }
          if (!started) {
            // Enter a car.
            const car = nearestCar(p.x, p.z, 5);
            if (car && !car.cop) {
              if (!car.mine && !car.traffic) {
                // Mission car: free.
              } else if (car.traffic) {
                events |= addHeat(1);
                say('You jacked a car! The law noticed.');
              }
              car.traffic = false;
              car.parked = false;
              p.inCar = true;
              p.carId = car.id;
            }
          }
        }
      } else {
        // Exit car.
        const car = state.cars.find((v) => v.id === p.carId);
        p.inCar = false;
        p.carId = -1;
        if (car) {
          p.x = car.x - Math.sin(car.angle) * 2.4;
          p.z = car.z + Math.cos(car.angle) * 2.4;
          car.speed = 0;
        }
      }
    }

    // ---- shooting ----
    if (ctrl.shoot && !p.inCar && p.reload <= 0) {
      const w = WEAPONS[p.weapon];
      if (p.mag[p.weapon] > 0) {
        p.mag[p.weapon]--;
        p.firing = 0.08;
        state.stats.shots++;
        const angle = ctrl.aimAngle !== null && ctrl.aimAngle !== undefined ? ctrl.aimAngle : p.angle;
        events |= shoot(p.x, p.z, angle, p.weapon, true);
        events |= addHeat(0.2);
        if (p.mag[p.weapon] === 0) {
          p.reload = w.reload;
          // Auto-reload from reserve: mags are bought as ammo; keep it simple: reload refills if owned.
          p.mag[p.weapon] = w.mag;
        }
      } else {
        p.reload = w.reload;
        p.mag[p.weapon] = w.mag;
      }
    }

    // ---- pickups ----
    for (const d of state.drops) {
      if (dist2(p.x, p.z, d.x, d.z) < 4) {
        p.cash += d.amount;
        state.stats.earned += d.amount;
        d.taken = true;
        events |= EVENT_CASH;
      }
    }
    state.drops = state.drops.filter((d) => !d.taken);

    // ---- world life ----
    stepTraffic(dt);
    stepPeds(dt);
    maintainPolice(dt);
    stepCopCars(dt);
    stepCops(dt);
    stepEnemies(dt);
    events |= stepJob(dt);

    // Helicopter follows the player.
    if (state.heli.active) {
      const h = state.heli;
      h.rotor += dt * 30;
      const tx = p.x + Math.sin(state.elapsed * 0.5) * 12;
      const tz = p.z + Math.cos(state.elapsed * 0.4) * 12;
      h.x += (tx - h.x) * Math.min(1, dt * 0.8);
      h.z += (tz - h.z) * Math.min(1, dt * 0.8);
      h.angle += dt * 0.6;
    }

    // Bust meter.
    let nearCop = false;
    for (const c of state.copCars) {
      if (dist2(p.x, p.z, c.x, c.z) < COP.bustRange * COP.bustRange && Math.abs(p.speed) < 3) nearCop = true;
    }
    for (const c of state.cops) {
      if (dist2(p.x, p.z, c.x, c.z) < 25 && Math.abs(p.speed) < 3) nearCop = true;
    }
    if (nearCop && state.wanted > 0) {
      state.bust += COP.bustRate * dt * (state.heli.active ? 1.5 : 1);
      if (state.bust >= 1) {
        state.bust = 0;
        return events | EVENT_BUSTED;
      }
    } else {
      state.bust = Math.max(0, state.bust - dt * 0.2);
    }

    // Wasted.
    if (p.health <= 0) return events | EVENT_WASTED;

    // Tracers decay.
    for (const t of state.tracers) t.life -= dt;
    state.tracers = state.tracers.filter((t) => t.life > 0);

    return events;
  }

  function dayFactor() {
    // 0.28 = morning, 0.5 = noon, 0.75 = dusk, 0.9+ = night.
    const t = state.time;
    if (t < 0.4) return 0.75 + (t - 0.28) * 1.5;
    if (t < 0.65) return 1;
    if (t < 0.8) return 1 - (t - 0.65) * 4;
    return 0.12;
  }

  function serialize() {
    const p = state.player;
    return {
      storyIndex: state.storyIndex,
      cash: p.cash,
      weapon: p.weapon,
      mag: p.mag,
      owned: p.owned,
      upgrades: p.upgrades,
      health: p.health,
      armour: p.armour,
      earned: state.stats.earned,
      missions: state.stats.missions,
      jobs: state.stats.jobs,
    };
  }

  function loadSave(s) {
    reset(true);
    const p = state.player;
    state.storyIndex = s.storyIndex ?? 0;
    p.cash = s.cash ?? ECONOMY.startCash;
    p.weapon = s.weapon ?? 'pistol';
    p.mag = s.mag ?? { pistol: 12, smg: 0, shotgun: 0 };
    p.owned = s.owned ?? { pistol: true, smg: false, shotgun: false };
    p.upgrades = s.upgrades ?? { engine: 0, plating: 0, nos: false };
    p.health = s.health ?? PLAYER.health;
    p.armour = s.armour ?? 0;
    state.stats.earned = s.earned ?? 0;
    state.stats.missions = s.missions ?? 0;
    state.stats.jobs = s.jobs ?? 0;
    state.missionStage = 'pickup';
  }

  reset(true);

  return {
    state,
    city,
    step,
    reset,
    mission,
    missionTarget,
    jobTarget,
    dayFactor,
    serialize,
    loadSave,
    say,
    addHeat,
    startJob,
    nearestCar,
    MISSIONS,
    CHARACTERS,
  };
}
