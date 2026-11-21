import { createWorld } from './game/src/world.js';
import { createRandom } from './game/src/random.js';
import { STEP } from './game/src/config.js';

const IDLE = { moveX: 0, moveY: 0, drive: 0, steer: 0, brake: false, nos: false, run: false, shoot: false, aimAngle: null, interact: false, camYaw: 0 };

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`ok - ${name}`); }
  else { fail++; console.log(`FAIL - ${name}`); }
}

// a) Determinism
{
  const mk = () => {
    const w = createWorld(createRandom(42));
    const p = w.state.player;
    p.inCar = true; p.carId = w.state.myCar.id;
    return w;
  };
  const a = mk();
  const b = mk();
  for (let i = 0; i < 1800; i++) { a.step(STEP, { ...IDLE, drive: 1 }); b.step(STEP, { ...IDLE, drive: 1 }); }
  const snap = (w) => JSON.stringify({ s: w.serialize(), x: w.state.player.x, z: w.state.player.z, cops: w.state.copCars.length });
  check('determinism: same seed, same outcome after 1800 steps', snap(a) === snap(b));
}

// b) All 10 missions
{
  const w = createWorld(createRandom(7));
  const p = w.state.player;
  let guard = 40;
  while (!w.state.complete && guard-- > 0) {
    const t = w.missionTarget();
    if (!t) break;
    p.inCar = false; p.carId = -1; p.x = t.x; p.z = t.z;
    if (w.state.missionStage === 'deliver') w.state.enemies = [];
    w.step(STEP, { ...IDLE, interact: true });
    w.step(STEP, IDLE);
  }
  check('missions: all 10 completed', w.state.stats.missions === 10 && w.state.complete === true);
}

// c) All 4 jobs
{
  const w = createWorld(createRandom(9));
  const p = w.state.player;
  const jobsBefore = w.state.stats.jobs;
  let heatDuringDrop = 0;
  for (const kind of ['taxi', 'courier', 'sprint', 'getaway']) {
    w.startJob(kind);
    let guard = 200;
    while (w.jobTarget() && guard-- > 0) {
      const t = w.jobTarget();
      p.inCar = false; p.carId = -1; p.x = t.x; p.z = t.z;
      const wasDrop = kind === 'getaway' && w.state.job && w.state.job.stage === 'drop';
      w.step(STEP, IDLE);
      if (wasDrop) heatDuringDrop = w.state.heat;
    }
    check(`job ${kind}: completed`, w.state.job === null);
  }
  check('jobs: stats increased by 4', w.state.stats.jobs === jobsBefore + 4);
  check('getaway: heat held at >= 2 during drop stage', heatDuringDrop >= 2);
}

// d) Police response at 5 stars
{
  const w = createWorld(createRandom(11));
  const p = w.state.player;
  w.addHeat(5);
  p.inCar = true; p.carId = w.state.myCar.id;
  for (let i = 0; i < 600; i++) w.step(STEP, { ...IDLE, drive: 1 });
  check('police: at least 4 cop cars at 5 stars', w.state.copCars.length >= 4);
  check('police: helicopter active', w.state.heli.active === true);
  check('police: roadblocks present', w.state.roadblocks.length > 0);
  check('police: all cop car positions finite', w.state.copCars.every((c) => Number.isFinite(c.x) && Number.isFinite(c.z)));
}

console.log(`SIM-TEST: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
// v4 witness — 2026-11-21: suite authored in the v4 build session; re-witnessed under the v4 repair recording.
