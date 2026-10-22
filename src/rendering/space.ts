import Phaser from 'phaser';
import { PULSAR_BEAM_HALF_WIDTH, PULSAR_BEAM_LENGTH } from '../config.js';
import { bodyAt, bodyPosition, pulsarAngle, type CelestialBody } from '../entities/CelestialBody.js';
import { POWERUP_COLORS, type Pickup } from '../entities/PowerUp.js';
import type { Wormhole } from '../entities/Wormhole.js';
import { drawBody } from './draw.js';
export function drawOrbit(g: Phaser.GameObjects.Graphics, body: CelestialBody, time = 0): void {
  if (!body.motion) return;
  const center = body.motion.parent ? bodyPosition(body.motion.parent, time) : body;
  g.lineStyle(1, 0x87b8d1, 0.17).strokeCircle(center.x, center.y, body.motion.radius);
  g.lineStyle(1, 0x87b8d1, 0.35).lineBetween(center.x - 4, center.y, center.x + 4, center.y)
    .lineBetween(center.x, center.y - 4, center.x, center.y + 4);
}
export function drawCelestial(g: Phaser.GameObjects.Graphics, source: CelestialBody, time = 0): void {
  const body = bodyAt(source, time);
  if (body.type !== 'pulsar') { drawBody(g, body, time); return; }
  const a = pulsarAngle(body, time), w = PULSAR_BEAM_HALF_WIDTH, length = PULSAR_BEAM_LENGTH;
  g.save().translateCanvas(body.x, body.y).rotateCanvas(a);
  g.fillStyle(0x6ae7ff, 0.17).fillRect(-length, -w, length * 2, w * 2);
  g.fillStyle(0x6ae7ff, 0.24).fillRect(-length, -w * 0.4, length * 2, w * 0.8);
  g.lineStyle(2, 0xa9f6ff, 0.45).lineBetween(-length, 0, length, 0);
  for (let x = -length; x < length; x += 48) {
    const phase = (time * 65) % 48;
    g.lineStyle(1.5, 0xa9f6ff, 0.55).lineBetween(x + phase, -w, x + phase + 16, w);
  }
  g.restore();
  for (let i = 5; i > 0; i--) g.fillStyle(0x8deaff, 0.025).fillCircle(body.x, body.y, body.radius + i * 6);
  g.save().translateCanvas(body.x, body.y).rotateCanvas(a);
  g.lineStyle(2, 0x67dcff, 0.5).strokeEllipse(0, 0, body.radius * 3, body.radius * 1.5);
  g.fillStyle(0xc7faff, 0.75).fillTriangle(body.radius, -8, body.radius + 30, 0, body.radius, 8)
    .fillTriangle(-body.radius, -8, -body.radius - 30, 0, -body.radius, 8);
  g.restore();
  g.fillStyle(0x99e7ff).fillCircle(body.x, body.y, body.radius);
  g.fillStyle(0xf5fcff).fillCircle(body.x - 3, body.y - 3, body.radius * 0.7);
}
export function drawWormhole(g: Phaser.GameObjects.Graphics, gate: Wormhole, time: number): void {
  const color = gate.id.startsWith('second-') ? 0xffc597 : gate.id.endsWith('a') ? 0x79ceff : 0xa6beff, r = gate.radius;
  g.save().translateCanvas(gate.x, gate.y).rotateCanvas(gate.orientation);
  // A luminous lens around a dark throat: the ring marks the actual crossing radius.
  for (let i = 6; i > 0; i--) g.fillStyle(color, 0.018).fillCircle(0, 0, r + i * 4);
  g.lineStyle(6, color, 0.12).strokeEllipse(0, 0, r * 3.05, r * 1.35);
  g.lineStyle(1.5, color, 0.55).strokeEllipse(0, 0, r * 3.05, r * 1.35);
  g.fillStyle(0x020514).fillCircle(0, 0, r);
  for (let i = 4; i > 0; i--) g.lineStyle(i * 2, color, 0.06).strokeCircle(0, 0, r * 0.94);
  g.lineStyle(2.5, 0xd6edff, 0.85).strokeCircle(0, 0, r);
  // Several tightening ellipses make the opening read as depth instead of a flat symbol.
  for (let i = 0; i < 5; i++) {
    const depth = ((i / 5 + time * 0.17) % 1), scale = 1 - depth;
    g.lineStyle(1, color, 0.18 + scale * 0.32).strokeEllipse(-depth * r * 0.16, 0, r * 1.7 * scale, r * 1.5 * scale);
  }
  for (let arm = 0; arm < 3; arm++) {
    g.lineStyle(1.7, color, 0.65).beginPath();
    for (let j = 0; j <= 28; j++) {
      const f = j / 28, a = arm * Math.PI * 2 / 3 + f * 3.8 - time * 0.65, radius = r * (0.14 + f * 0.8);
      const x = Math.cos(a) * radius, y = Math.sin(a) * radius * 0.85;
      if (j === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.strokePath();
  }
  g.fillStyle(0x01030c).fillEllipse(-r * 0.12, 0, r * 0.42, r * 0.36);
  for (let i = 0; i < 10; i++) {
    const f = (i / 10 + time * 0.22) % 1, a = i * 2.4 - time * 0.35 + f * 1.3, radius = r * (1.45 - f * 1.1);
    g.fillStyle(0xedfaff, Math.sin(f * Math.PI) * 0.85).fillCircle(Math.cos(a) * radius, Math.sin(a) * radius * 0.82, 1.2);
  }
  // A short foreground lens arc gives the rim a bright near side.
  g.lineStyle(3, 0xe5f5ff, 0.8).beginPath().arc(0, 0, r * 1.04, 0.15, 1.8).strokePath();
  g.restore();
}
export function drawPickup(g: Phaser.GameObjects.Graphics, pickup: Pickup, time: number): void {
  const c = POWERUP_COLORS[pickup.type], bob = Math.sin(time * 3 + pickup.id) * 3;
  g.save().translateCanvas(pickup.x, pickup.y + bob);
  g.fillStyle(c, 0.08).fillCircle(0, 0, 27);
  g.fillStyle(0x101e2b, 0.95).lineStyle(2, c, 0.9);
  g.beginPath().moveTo(0, -21).lineTo(21, 0).lineTo(0, 21).lineTo(-21, 0).closePath().fillPath().strokePath();
  if (pickup.type === 'trajectory') {
    for (let i = 0; i < 6; i++) g.fillStyle(c).fillCircle(-10 + i * 4, 7 - Math.sin(i / 5 * Math.PI / 2) * 16, 2);
  } else if (pickup.type === 'shield') {
    g.lineStyle(2, c).beginPath().moveTo(-8, -8).lineTo(8, -8).lineTo(7, 3).lineTo(0, 11).lineTo(-7, 3).closePath().strokePath();
  } else if (pickup.type === 'laser') {
    g.lineStyle(3, c).lineBetween(-7, 10, 7, -10).lineBetween(-1, -2, 8, -10).lineBetween(-8, 10, 1, 2);
  } else if (pickup.type === 'orbital') {
    g.lineStyle(1.5, c).strokeEllipse(0, 0, 22, 12); g.fillStyle(c).fillCircle(0, 0, 3).fillCircle(10, 0, 3);
  } else if (pickup.type === 'homing') {
    g.lineStyle(2, c).strokeCircle(0, 0, 9).lineBetween(-14, 0, -6, 0).lineBetween(6, 0, 14, 0)
      .lineBetween(0, -14, 0, -6).lineBetween(0, 6, 0, 14);
    g.fillStyle(c).fillTriangle(0, -5, -4, 4, 4, 4);
  } else g.fillStyle(c).fillCircle(0, 0, 7);
  g.restore();
}
