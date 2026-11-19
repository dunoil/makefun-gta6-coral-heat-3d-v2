// The four screenshot scenes behind ?shot=title|combat|chase|dialogue. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, so the frame is what a
// short game really looks like — and the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_DIALOGUE } from './render.js';

const IDLE = { moveX: 0, moveY: 0, drive: 0, steer: 0, brake: false, nos: false, run: false, shoot: false, aimAngle: null, interact: false, camYaw: 0 };

function placePlayerAt(world, x, z, angle) {
  const p = world.state.player;
  p.x = x;
  p.z = z;
  p.angle = angle;
  p.speed = 0;
  p.inCar = false;
  p.carId = -1;
}

export function stageShot(name, world) {
  world.reset(true);
  const st = world.state;
  const p = st.player;
  if (name === 'combat') {
    // Docks shootout: the player on foot, three enforcers ahead, mid-burst.
    st.time = 0.45;
    placePlayerAt(world, -170, 52, 0);
    st.enemies = [
      { x: -152, z: 48, angle: Math.PI, health: 60, shootTimer: 1.2, strafe: 1, dead: false },
      { x: -148, z: 62, angle: Math.PI, health: 60, shootTimer: 0.8, strafe: -1, dead: false },
      { x: -156, z: 40, angle: Math.PI, health: 60, shootTimer: 1.5, strafe: 1, dead: false },
    ];
    // A few real steps with the trigger held, so the tracer in the frame is a real shot.
    const ctrl = { ...IDLE, shoot: true, aimAngle: 0, camYaw: 0 };
    for (let i = 0; i < 6; i++) world.step(STEP, ctrl);
    p.firing = 0.08;
    // Keep the frame clean: no police in a staged shootout.
    st.heat = 0;
    st.wanted = 0;
    st.copCars = [];
    st.cops = [];
    return {
      screen: SCREEN_PLAY,
      camera: { eye: [p.x - 9, 4.5, p.z - 6], center: [-150, 1.6, 52] },
      dialogue: null,
    };
  }
  if (name === 'chase') {
    // Night pursuit: four stars, Air One overhead, the player flat out in the coupe.
    st.time = 0.92;
    st.heat = 4;
    st.wanted = 4;
    const coupe = st.myCar;
    p.inCar = true;
    p.carId = coupe.id;
    coupe.x = -40;
    coupe.z = 0;
    coupe.angle = 0;
    coupe.speed = 24;
    p.x = coupe.x;
    p.z = coupe.z;
    p.angle = 0;
    const ctrl = { ...IDLE, drive: 1, steer: 0, nos: false, camYaw: 0 };
    for (let i = 0; i < 240; i++) world.step(STEP, ctrl);
    const px = p.x;
    const pz = p.z;
    const a = p.angle;
    // Park Air One ahead and to the side, high enough to read against the sky.
    st.heli.x = px + Math.cos(a) * 6 - Math.sin(a) * 6;
    st.heli.z = pz + Math.sin(a) * 6 + Math.cos(a) * 6;
    st.heli.y = 22;
    return {
      screen: SCREEN_PLAY,
      camera: {
        eye: [px - Math.cos(a) * 26, 11, pz - Math.sin(a) * 26],
        center: [px + Math.cos(a) * 8, 12, pz + Math.sin(a) * 8],
      },
      dialogue: null,
    };
  }
  if (name === 'dialogue') {
    // Mission briefing: Solana's portrait and the First Run brief, at the marina.
    st.time = 0.3;
    placePlayerAt(world, 0, 180, -1.57);
    return {
      screen: SCREEN_DIALOGUE,
      camera: { eye: [p.x - 6, 3.5, p.z + 8], center: [p.x, 1.5, p.z - 4] },
      dialogue: { char: 'solana', lines: world.MISSIONS[0].brief, title: 'First Run' },
    };
  }
  // title (default): morning vista over the marina and the city.
  st.time = 0.28;
  placePlayerAt(world, 0, 185, -1.57);
  return {
    screen: SCREEN_TITLE,
    camera: { eye: [70, 75, 235], center: [0, 12, 20] },
    dialogue: null,
  };
}
