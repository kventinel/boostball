(function (root) {
'use strict';
const C=typeof module!=='undefined'?require('./collision.js'):root.Collision;
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
    const goalDx=dir*44-b.x,goalDz=-b.z,goalDistance=Math.hypot(goalDx,goalDz)||1,sx=goalDx/goalDistance,sz=goalDz/goalDistance;
    let tx=b.x-sx*4.5,tz=b.z-sz*4.5;
    const behind=(c.x-b.x)*sx+(c.z-b.z)*sz,lateral=(c.x-b.x)*(-sz)+(c.z-b.z)*sx;
    if(rank<2&&behind< -2.5&&Math.abs(lateral)<1.8&&Math.hypot(c.x-b.x,c.z-b.z)<9){tx=b.x+sx*7;tz=b.z+sz*7;}
    if (rank > 1) { tx = clamp(b.x - dir * (10 + rank * 2), -37, 37); tz = clamp(b.z + (c.id % 2 ? 1 : -1) * (6 + rank * 2), -23, 23); }
    if (rank === s.n - 1 && s.n > 2) { tx = clamp(b.x - dir * 10, -38, 38); tz = clamp(b.z * .65, -10, 10); }
    // Approach the back of the ball around its side instead of driving it into our own net.
    if (behind > -1.0 && Math.hypot(c.x-b.x,c.z-b.z)<9) {
        const side=lateral>=0?1:-1;tx=clamp(b.x-sx*5-sz*side*5,-40,40);tz=clamp(b.z-sz*5+sx*side*5,-24,24);
    }
    const target = Math.atan2(tz - c.z, tx - c.x), da = Math.atan2(Math.sin(target - c.a), Math.cos(target - c.a));
    return { w: Math.abs(da) < 1.7, a: da < -.08, d: da > .08, shift: rank < 2 && Math.abs(da) < .3 && Math.hypot(tx - c.x, tz - c.z) > 13, jump: rank < 2 && Math.hypot(c.x - b.x, c.z - b.z) < 5 && b.y > 2.5 };
}
// Shared by the authoritative simulation and immediate client-side car prediction.
function drive(c, dt, k) {
    const steps=Math.max(1,Math.ceil(dt*120));for(let i=0;i<steps;i++)drivePart(c,dt/steps,k);
}
function drivePart(c, dt, k) {
    const f = k.w ? 1 : k.s ? -.65 : 0, speed = Math.hypot(c.vx, c.vz);
    c.a += ((k.d ? 1 : 0) - (k.a ? 1 : 0)) * dt * (1.3 + Math.min(speed / 10, 1.6)) * (f < 0 ? -1 : 1);
    c.boosting = !!(k.shift && c.boost > 0 && f > 0); c.boost = clamp(c.boost + (c.boosting ? -30 : 12) * dt, 0, 100);
    const accel = c.boosting ? 43 : 27, drag = Math.exp(-1.8 * dt);
    c.vx = (c.vx + Math.cos(c.a) * f * accel * dt) * drag; c.vz = (c.vz + Math.sin(c.a) * f * accel * dt) * drag;
    if (k.jump && !c.jump && c.y < .68) c.vy = 10;
    c.jump = !!k.jump; c.vy -= 23 * dt; c.x += c.vx * dt; c.z += c.vz * dt; c.y += c.vy * dt;
    C.carBounds(c);
}
function predictDrive(car,dt,keys,cars=[],ball=null) {
    drive(car,dt,keys);
    // Predict only our car; authoritative snapshots still own all other bodies and statistics.
    const others=cars.filter(c=>c.id!==car.id&&(c.x-car.x)**2+(c.z-car.z)**2<22).map(c=>({...c}));
    const localBall=ball?{...ball}:null;
    for(let i=0;i<3;i++){for(const other of others)C.resolveCars(car,other);if(localBall)C.resolveCarBall(car,localBall);C.carBounds(car);}
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
function recordTouch(s,c,hit) {
    const b=s.ball,incoming=(c.team?1:-1)*hit.before.vx,arrival=((c.team?43.5:-43.5)-b.x)/hit.before.vx;
    const deflectedShot=s.lastShot&&s.lastShot.team!==c.team&&s.elapsed-s.lastShot.at<8&&incoming>4&&arrival>0&&arrival<6&&Math.abs(b.z+hit.before.vz*arrival)<9?s.lastShot:null;
    c.stats.touches++;
    if(s.lastTouch?.id!==c.id){s.previousTouch=s.lastTouch;s.lastTouch={id:c.id,team:c.team,at:s.elapsed,deflectedShot};}
    else{s.lastTouch.at=s.elapsed;s.lastTouch.deflectedShot=deflectedShot;}
    const toward=(c.team?-1:1)*b.vx,flight=((c.team?-43.5:43.5)-b.x)/b.vx;
    if(toward>4&&flight>0&&flight<6&&Math.abs(b.z+b.vz*flight)<9){c.stats.shots++;s.lastShot={id:c.id,team:c.team,at:s.elapsed,pass:s.previousTouch?.team===c.team?{id:s.previousTouch.id,team:s.previousTouch.team,at:s.previousTouch.at}:null};}
}
function ballBounds(b){
    if(b.y<C.R){b.y=C.R;b.vy=b.vy<-.8?-b.vy*.66:0;}
    if(b.y>17){b.y=17;if(b.vy>0)b.vy*= -.7;}
    const limit=28-C.R;
    if(Math.abs(b.z)>limit){b.z=Math.sign(b.z)*limit;if(b.vz*b.z>0)b.vz*= -.74;}
    const mouth=Math.abs(b.z)<9&&b.y<7.2;
    if(Math.abs(b.x)>43.5-C.R&&!mouth){b.x=Math.sign(b.x)*(43.5-C.R);if(b.vx*b.x>0)b.vx*= -.74;}
    C.goalFrame(b);
}
function step(s, dt, inputs = {}) {
    if(s.ended||!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(dt,.05);s.tick++;
    if(s.freeze>0){s.freeze=Math.max(0,s.freeze-dt);return;}
    s.time=Math.max(0,s.time-dt);s.elapsed+=dt;
    if(s.time<1e-7){s.time=0;s.ended=true;return;}
    const ranks=new Int8Array(s.cars.length),controls={},starts=s.cars.map(c=>({x:c.x,z:c.z}));
    for(let team=0;team<2;team++)s.cars.filter(c=>c.team===team).sort((a,b)=>(a.x-s.ball.x)**2+(a.z-s.ball.z)**2-(b.x-s.ball.x)**2-(b.z-s.ball.z)**2).forEach((c,i)=>ranks[c.id]=i);
    let fastest=Math.hypot(s.ball.vx,s.ball.vy,s.ball.vz);
    for(const c of s.cars){controls[c.id]=inputs[c.id]||(c.human?{}:bot(s,c,ranks[c.id]));fastest=Math.max(fastest,Math.hypot(c.vx,c.vy,c.vz));}
    const substeps=Math.min(12,Math.max(Math.ceil(dt*120),Math.ceil((fastest+30)*dt/.5))),h=dt/substeps,contacts=new Set();
    for(let sub=0;sub<substeps;sub++){
        for(const c of s.cars)drive(c,h,controls[c.id]);
        const b=s.ball;b.vy-=18*h;b.x+=b.vx*h;b.y+=b.vy*h;b.z+=b.vz*h;const drag=Math.exp(-(b.y<=C.R+.03?.38:.12)*h);b.vx*=drag;b.vz*=drag;
        for(let iteration=0;iteration<6;iteration++){
            for(let i=0;i<s.cars.length;i++)for(let j=i+1;j<s.cars.length;j++)C.resolveCars(s.cars[i],s.cars[j]);
            for(const c of s.cars){const hit=C.resolveCarBall(c,b);if(hit){if(!contacts.has(c.id)&&!s.contacts.includes(c.id))recordTouch(s,c,hit);contacts.add(c.id);if(s.lastTouch?.id===c.id)s.lastTouch.at=s.elapsed;}C.carBounds(c);}
            ballBounds(b);
        }
        const speed=Math.hypot(b.vx,b.vy,b.vz);if(speed>95){b.vx*=95/speed;b.vy*=95/speed;b.vz*=95/speed;}
        if(Math.abs(b.x)>43.5+C.R&&Math.abs(b.z)<9-C.R-.2&&b.y+C.R<6.8){scoreGoal(s,b.x>0?0:1);break;}
    }
    s.contacts=[...contacts];
    for(const c of s.cars){c.stats.playTime+=dt;if(s.freeze<=0)c.stats.distance+=Math.hypot(c.x-starts[c.id].x,c.z-starts[c.id].z);c.stats.topSpeed=Math.max(c.stats.topSpeed,Math.hypot(c.vx,c.vz));if(c.boosting)c.stats.boostTime+=dt;}
}
const api = { create, step, reset, drive, predictDrive, clamp, cleanName, namePlayer, releasePlayer, emptyStats };
if (typeof module !== 'undefined') module.exports = api; else root.Physics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
