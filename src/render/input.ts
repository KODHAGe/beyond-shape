/**
 * Shared pointer input for the 3D previews — used by BOTH render tiers so the
 * "drag to turn" contract is identical whether the form is WebGL or software
 * rendered (QR-4 / LR-6: the tiers read the same; only the engine differs).
 *
 * `attachOrbit` turns raw pointer drags into yaw/pitch deltas and owns the
 * grab/grabbing cursor. `attachTurnHint` is a light "drag to turn" affordance
 * that fades after the first interaction — the discoverability cue that was
 * missing when every output looked like a static print.
 */

import { clamp } from '../lib/math';

export const ORBIT_MAX_PITCH = 1.25; // radians — keep the form upright-ish

export interface ViewAngles {
  yaw: number;
  pitch: number;
}

export interface OrbitHandle {
  dispose(): void;
}

/** Pointer drag → yaw/pitch deltas. `onDelta` decides what repaints. */
export function attachOrbit(canvas: HTMLCanvasElement, onDelta: (dYaw: number, dPitch: number) => void): OrbitHandle {
  let active = false;
  let lastX = 0;
  let lastY = 0;
  let frame = 0;
  let pendingDYaw = 0;
  let pendingDPitch = 0;

  function flush(): void {
    frame = 0;
    if (pendingDYaw !== 0 || pendingDPitch !== 0) {
      const dy = pendingDYaw;
      const dp = pendingDPitch;
      pendingDYaw = 0;
      pendingDPitch = 0;
      onDelta(dy, dp);
    }
  }

  function schedule(dYaw: number, dPitch: number): void {
    pendingDYaw += dYaw;
    pendingDPitch += dPitch;
    if (frame === 0) frame = requestAnimationFrame(flush);
  }

  function down(ev: PointerEvent): void {
    active = true;
    lastX = ev.clientX;
    lastY = ev.clientY;
    canvas.classList.add('bs-dragging');
    canvas.setPointerCapture(ev.pointerId);
  }

  function move(ev: PointerEvent): void {
    if (!active) return;
    const dYaw = (ev.clientX - lastX) * 0.008;
    const dPitch = (ev.clientY - lastY) * 0.008;
    lastX = ev.clientX;
    lastY = ev.clientY;
    schedule(dYaw, dPitch);
  }

  function up(ev: PointerEvent): void {
    if (!active) return;
    active = false;
    canvas.classList.remove('bs-dragging');
    if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
    flush();
  }

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.style.touchAction = 'none';

  return {
    dispose() {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      if (frame !== 0) cancelAnimationFrame(frame);
    },
  };
}

/** Apply a yaw/pitch delta onto a view, keeping pitch in the band. */
export function applyOrbitDelta(view: ViewAngles, dYaw: number, dPitch: number): ViewAngles {
  return {
    yaw: ((view.yaw + dYaw) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI),
    pitch: clamp(view.pitch + dPitch, -ORBIT_MAX_PITCH, ORBIT_MAX_PITCH),
  };
}

export interface TurnHintHandle {
  markSeen(): void;
  dispose(): void;
}

/**
 * "drag to turn" overlay, absolutely positioned in `container`. Fades once the
 * user actually drags (or the caller says `markSeen()`); harmless everywhere.
 */
export function attachTurnHint(container: HTMLElement, trigger: HTMLElement): TurnHintHandle {
  const hint = document.createElement('div');
  hint.className = 'bs-hint';
  hint.textContent = 'drag to turn';
  container.appendChild(hint);

  function seen(): void {
    if (!hint.classList.contains('bs-hint-seen')) hint.classList.add('bs-hint-seen');
  }

  trigger.addEventListener('pointerdown', seen, { once: true });
  trigger.addEventListener('wheel', seen, { once: true });
  // Falls back to fading out after 9 idle seconds even without interaction.
  const idle = window.setTimeout(seen, 9000);

  return {
    markSeen: seen,
    dispose() {
      window.clearTimeout(idle);
      trigger.removeEventListener('pointerdown', seen);
      trigger.removeEventListener('wheel', seen);
      hint.remove();
    },
  };
}