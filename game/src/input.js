// Keyboard + pointer input. Actions are edge-triggered bits consumed by the loop.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_SHOOT = 8;
export const ACTION_RADIO = 16;
export const ACTION_STATION = 32;
export const ACTION_NOS = 64;
export const ACTION_JOB = 128;

const KEYMAP = {
  Space: ACTION_CONFIRM,
  Enter: ACTION_CONFIRM,
  KeyE: ACTION_INTERACT,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyR: ACTION_RADIO,
  KeyQ: ACTION_STATION,
  KeyJ: ACTION_JOB,
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  function down(e) {
    if (e.repeat) return;
    keys.add(e.code);
    const a = KEYMAP[e.code];
    if (a !== undefined) actions |= a;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }
  function up(e) {
    keys.delete(e.code);
  }
  function move(e) {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  }
  function press(e) {
    move(e);
    mouseDown = true;
    actions |= ACTION_SHOOT;
  }
  function release() {
    mouseDown = false;
  }

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mousedown', press);
  window.addEventListener('mouseup', release);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const axis = (neg, pos) => (keys.has(pos) ? 1 : 0) - (keys.has(neg) ? 1 : 0);

  return {
    takeActions() {
      const a = actions;
      actions = 0;
      return a;
    },
    held(code) {
      return keys.has(code);
    },
    moveX() {
      return axis('KeyA', 'KeyD') + axis('ArrowLeft', 'ArrowRight');
    },
    moveY() {
      return axis('KeyW', 'KeyS') + axis('ArrowUp', 'ArrowDown');
    },
    drive() {
      return axis('KeyS', 'KeyW') + axis('ArrowDown', 'ArrowUp');
    },
    steer() {
      return axis('KeyA', 'KeyD') + axis('ArrowLeft', 'ArrowRight');
    },
    brake() {
      return keys.has('Space');
    },
    nos() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    run() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    shootHeld() {
      return mouseDown || keys.has('KeyF');
    },
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
  };
}
