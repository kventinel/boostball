(function (root) {
'use strict';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cleanName = value => String(value || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, '').trim().slice(0, 24);
const emptyStats = () => ({ goals: 0, assists: 0, ownGoals: 0, shots: 0, touches: 0, distance: 0, boostTime: 0, playTime: 0, topSpeed: 0 });
function create(n = 4, duration = 180) {
    const s = { n, duration, time: duration, score: [0, 0], cars: [], ball: { x: 0, y: 1.5, z: 0, vx: 0, vy: 0, vz: 0 }, freeze: 2, ended: false, tick: 0, elapsed: 0, lastTouch: null, previousTouch: null, lastShot: null, contacts: [], goal: null, lastGoal: null, participants: [] };
    for (let team = 0; team < 2; team++) for (let i = 0; i < n; i++) s.cars.push({ id: team * n + i, team, name: `Бот ${team ? 'О' : 'С'}${i + 1}`, x: 0, y: .65, z: 0, vx: 0, vy: 0, vz: 0, a: 0, boost: 100, jump: false, boosting: false, human: false, stats: emptyStats() });
    reset(s); return s;
}
function reset(s) {
    s.ball = { x: 0, y: 1.5, z: 0, vx: 0, vy: 0, vz: 0 }; s.contacts = []; s.lastTouch = s.previousTouch = s.lastShot = null;
    for (const c of s.cars) {
        const i = c.id % s.n;
        c.x = (c.team ? 1 : -1) * (13 + Math.floor(i / 4) * 6); c.z = (i % 4 - (Math.min(4, s.n) - 1) / 2) * 7;
        c.y = .65; c.vx = c.vy = c.vz = 0; c.a = c.team ? Math.PI : 0; c.boost = 100; c.jump = c.boosting = false;
    }
    s.freeze = 2;
}
function namePlayer(s, id, name) {
    let value = cleanName(name) || 'Игрок'; const base = value;
    let i = 2;
    while (s.cars.some(c => c.id !== id && c.human && c.name.toLocaleLowerCase() === value.toLocaleLowerCase())) value = `${base.slice(0, 20)} (${i++})`;
    s.cars[id].name = value; s.cars[id].human = true; return value;
}
function releasePlayer(s, id) {
    const c = s.cars[id];
    if (c.human) s.participants.push({ ...c, stats: { ...c.stats }, disconnected: true });
    c.human = false; c.name = `Бот ${c.team ? 'О' : 'С'}${id % s.n + 1}`; c.stats = emptyStats();
    if (s.lastTouch?.id === id) s.lastTouch = null;
    if (s.previousTouch?.id === id) s.previousTouch = null;
    if (s.lastShot?.id === id) s.lastShot = null;
}
function bot(s, c, rank) {
    const b = s.ball, dir = c.team ? -1 : 1;
    let tx = b.x - dir * 2.8, tz = b.z;
    if (rank > 1) { tx = clamp(b.x - dir * (10 + rank * 2), -37, 37); tz = clamp(b.z + (c.id % 2 ? 1 : -1) * (6 + rank * 2), -23, 23); }
    if (rank === s.n - 1 && s.n > 2) { tx = clamp(b.x - dir * 10, -38, 38); tz = clamp(b.z * .65, -10, 10); }
    // Approach the back of the ball around its side instead of driving it into our own net.
    if ((c.x - b.x) * dir > -.8 && Math.hypot(c.x - b.x, c.z - b.z) < 10) {
        tx = clamp(b.x - dir * 4, -41, 41); tz = clamp(b.z + (c.z >= b.z ? 1 : -1) * 5.5, -24, 24);
    }
    const target = Math.atan2(tz - c.z, tx - c.x), da = Math.atan2(Math.sin(target - c.a), Math.cos(target - c.a));
    return { w: Math.abs(da) < 1.7, a: da < -.08, d: da > .08, shift: rank < 2 && Math.abs(da) < .3 && Math.hypot(tx - c.x, tz - c.z) > 13, jump: rank < 2 && Math.hypot(c.x - b.x, c.z - b.z) < 5 && b.y > 2.5 };
}
// Shared by the authoritative simulation and immediate client-side car prediction.
function drive(c, dt, k) {
    const f = k.w ? 1 : k.s ? -.65 : 0, speed = Math.hypot(c.vx, c.vz);
    c.a += ((k.d ? 1 : 0) - (k.a ? 1 : 0)) * dt * (1.3 + Math.min(speed / 10, 1.6)) * (f < 0 ? -1 : 1);
    c.boosting = !!(k.shift && c.boost > 0 && f > 0); c.boost = clamp(c.boost + (c.boosting ? -30 : 12) * dt, 0, 100);
    const accel = c.boosting ? 43 : 27, drag = Math.exp(-1.8 * dt);
    c.vx = (c.vx + Math.cos(c.a) * f * accel * dt) * drag; c.vz = (c.vz + Math.sin(c.a) * f * accel * dt) * drag;
    if (k.jump && !c.jump && c.y < .68) c.vy = 10;
    c.jump = !!k.jump; c.vy -= 23 * dt; c.x += c.vx * dt; c.z += c.vz * dt; c.y += c.vy * dt;
    if (c.y < .65) { c.y = .65; c.vy = 0; }
    if (Math.abs(c.x) > 42.4) { c.x = Math.sign(c.x) * 42.4; c.vx *= -.5; }
    if (Math.abs(c.z) > 26.4) { c.z = Math.sign(c.z) * 26.4; c.vz *= -.5; }
}
function scoreGoal(s, team) {
    s.score[team]++; s.goal = team;
    const last = s.lastTouch, previous = s.previousTouch;
    let scorer = null, assist = null, ownGoal = null;
    if (last && s.elapsed - last.at < 12) {
        const credited = last.team !== team && last.deflectedShot?.team === team ? last.deflectedShot : last;
        const c = s.cars[credited.id];
        if (c.team === team) {
            c.stats.goals++; scorer = c.name;
            const pass = credited === last ? previous : credited.pass;
            if (pass && pass.id !== c.id && pass.team === team && s.elapsed - pass.at <= 10) { s.cars[pass.id].stats.assists++; assist = s.cars[pass.id].name; }
        } else { c.stats.ownGoals++; ownGoal = c.name; }
    }
    s.lastGoal = { team, scorer, assist, ownGoal, tick: s.tick };
    reset(s); s.freeze = 3;
}
function step(s, dt, inputs = {}) {
    if (s.ended) return;
    s.tick++;
    if (s.freeze > 0) { s.freeze = Math.max(0, s.freeze - dt); return; }
    s.time = Math.max(0, s.time - dt); s.elapsed += dt;
    if (s.time < 1e-7) { s.time = 0; s.ended = true; return; }
    const ranks = new Int8Array(s.cars.length);
    for (let team = 0; team < 2; team++) s.cars.filter(c => c.team === team).sort((a, b) => (a.x - s.ball.x) ** 2 + (a.z - s.ball.z) ** 2 - (b.x - s.ball.x) ** 2 - (b.z - s.ball.z) ** 2).forEach((c, i) => ranks[c.id] = i);
    for (const c of s.cars) {
        const x = c.x, z = c.z;
        drive(c, dt, inputs[c.id] || (c.human ? {} : bot(s, c, ranks[c.id])));
        c.stats.playTime += dt; c.stats.distance += Math.hypot(c.x - x, c.z - z); c.stats.topSpeed = Math.max(c.stats.topSpeed, Math.hypot(c.vx, c.vz));
        if (c.boosting) c.stats.boostTime += dt;
    }
    for (let i = 0; i < s.cars.length; i++) for (let j = i + 1; j < s.cars.length; j++) {
        const a = s.cars[i], b = s.cars[j]; let dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
        if (d < 2.2 && d > .001 && Math.abs(a.y - b.y) < 1.4) {
            dx /= d; dz /= d; const o = (2.2 - d) / 2; a.x -= dx * o; a.z -= dz * o; b.x += dx * o; b.z += dz * o;
            const v = (a.vx - b.vx) * dx + (a.vz - b.vz) * dz;
            if (v > 0) { a.vx -= v * .7 * dx; a.vz -= v * .7 * dz; b.vx += v * .7 * dx; b.vz += v * .7 * dz; }
        }
    }
    const b = s.ball, contacts = [];
    for (const c of s.cars) {
        const dx = b.x - c.x, dy = b.y - c.y, dz = b.z - c.z, d = Math.hypot(dx, dy, dz);
        if (d < 2.55 && d > .01) {
            const nx = dx / d, ny = dy / d, nz = dz / d; b.x += nx * (2.55 - d); b.y += ny * (2.55 - d); b.z += nz * (2.55 - d);
            const incoming = (c.team ? 1 : -1) * b.vx, incomingTime = ((c.team ? 43 : -43) - b.x) / b.vx;
            const deflectedShot = s.lastShot && s.lastShot.team !== c.team && s.elapsed - s.lastShot.at < 8 && incoming > 4 && incomingTime > 0 && incomingTime < 6 && Math.abs(b.z + b.vz * incomingTime) < 9 ? s.lastShot : null;
            const impact = Math.max(0, (c.vx - b.vx) * nx + (c.vy - b.vy) * ny + (c.vz - b.vz) * nz);
            b.vx += nx * (impact * 1.7 + 2); b.vy += ny * (impact * 1.5 + 2) + Math.min(impact * .24, 5); b.vz += nz * (impact * 1.7 + 2);
            contacts.push(c.id);
            if (!s.contacts.includes(c.id)) {
                c.stats.touches++;
                if (s.lastTouch?.id !== c.id) { s.previousTouch = s.lastTouch; s.lastTouch = { id: c.id, team: c.team, at: s.elapsed, deflectedShot }; }
                else { s.lastTouch.at = s.elapsed; s.lastTouch.deflectedShot = deflectedShot; }
                const toward = (c.team ? -1 : 1) * b.vx, goalX = c.team ? -43 : 43;
                if (toward > 4) { const arrival = (goalX - b.x) / b.vx; if (arrival > 0 && arrival < 6 && Math.abs(b.z + b.vz * arrival) < 9) { c.stats.shots++; s.lastShot = { id: c.id, team: c.team, at: s.elapsed, pass: s.previousTouch?.team === c.team ? { id: s.previousTouch.id, team: s.previousTouch.team, at: s.previousTouch.at } : null }; } }
            }
        }
    }
    s.contacts = contacts;
    b.vy -= 18 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vx *= Math.exp(-.16 * dt); b.vz *= Math.exp(-.16 * dt);
    if (b.y < 1.45) { b.y = 1.45; b.vy = Math.abs(b.vy) * .73; if (b.vy < .8) b.vy = 0; }
    if (b.y > 17) { b.y = 17; b.vy = -Math.abs(b.vy) * .8; }
    if (Math.abs(b.z) > 25.5) { b.z = Math.sign(b.z) * 25.5; b.vz *= -.82; }
    if (Math.abs(b.x) > 42.5) { if (Math.abs(b.z) < 8.5 && b.y < 7) scoreGoal(s, b.x > 0 ? 0 : 1); else { b.x = Math.sign(b.x) * 42.5; b.vx *= -.85; } }
}
const api = { create, step, reset, drive, clamp, cleanName, namePlayer, releasePlayer, emptyStats };
if (typeof module !== 'undefined') module.exports = api; else root.Physics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
