'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const P = require('./dist/physics.js'), rooms = new Map(), root = path.join(__dirname, 'dist'), PORT = Number(process.env.PORT) || 8080;
const VERSION = '2.2.0';
function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }
function updateLobby(r) { r.dirty = true; r.state.lobby = { hostId: r.players.values().next().value?.id ?? null, players: [...r.players.values()].map(p => ({ id: p.id, name: r.state.cars[p.id].name, team: r.state.cars[p.id].team, ready: p.ready })) }; }
function removePlayer(r, token) { const p = r.players.get(token); if (!p) return; p.stream?.end(); r.players.delete(token); P.releasePlayer(r.state, p.id); delete r.inputs[p.id]; if (r.state.phase === 'lobby') r.state.participants = []; updateLobby(r); }
function createState(n, duration, round = 1) { const s = P.create(n, duration); s.matchId = round; s.phase = 'lobby'; s.protocol = 3; s.version = VERSION; return s; }
const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname === '/health') return json(res, 200, { ok: true, version: VERSION, protocol: 3, rooms: rooms.size });
    if (u.pathname === '/api/events') {
        const r = rooms.get(u.searchParams.get('room')), player = r?.players.get(u.searchParams.get('token'));
        if (!player) return json(res, 403, { error: 'Комната или игрок не найдены' });
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(': connected\n\n'); player.stream?.end(); player.stream = res; player.seen = Date.now();
        res.write('data: ' + JSON.stringify(r.state) + '\n\n');
        req.on('close', () => { if (player.stream === res) { player.stream = null; player.seen = Date.now(); if (r.state.phase === 'lobby') { player.ready = false; updateLobby(r); } } }); return;
    }
    if (req.method === 'POST' && u.pathname.startsWith('/api/')) {
        let body = '';
        try {
            for await (const chunk of req) { body += chunk; if (body.length > 4096) { json(res, 413, { error: 'Слишком большой запрос' }); req.destroy(); return; } }
            const data = JSON.parse(body || '{}');
            if (u.pathname === '/api/create' || u.pathname === '/api/join') {
                if (data.protocol !== 3) return json(res, 426, { error: 'Обновите страницу для загрузки новой версии комнаты ожидания.' });
                let code, r;
                if (u.pathname === '/api/create') {
                    if (rooms.size >= 100) return json(res, 503, { error: 'Сервер заполнен' });
                    const n = Math.floor(P.clamp(Number(data.n) || 4, 1, 12));
                    do { code = crypto.randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code));
                    r = { state: createState(n, [180, 300, 600].includes(data.duration) ? data.duration : 180), players: new Map(), inputs: {}, seen: Date.now() }; rooms.set(code, r);
                } else {
                    code = String(data.room || '').toUpperCase(); r = rooms.get(code);
                    if (!r) return json(res, 404, { error: 'Комната не найдена' });
                    if (r.state.phase !== 'lobby') return json(res, 409, { error: 'Матч уже начался. Дождитесь следующего сбора в комнате.' });
                }
                const occupied = new Set([...r.players.values()].map(p => p.id)), team = Number(data.team) === 1 ? 1 : 0;
                const car = r.state.cars.find(c => c.team === team && !occupied.has(c.id)) || r.state.cars.find(c => !occupied.has(c.id));
                if (!car) return json(res, 409, { error: 'Комната заполнена' });
                const token = crypto.randomBytes(20).toString('hex');
                r.players.set(token, { id: car.id, seen: Date.now(), stream: null, ready: false });
                car.stats = P.emptyStats(); P.namePlayer(r.state, car.id, data.name); car.ack = 0; r.inputs[car.id] = {}; updateLobby(r);
                return json(res, 200, { room: code, token, id: car.id, state: r.state });
            }
            const r = rooms.get(String(data.room || '').toUpperCase()), p = r?.players.get(data.token);
            if (!p) return json(res, 403, { error: 'Игрок не найден' });
            p.seen = Date.now();
            if (u.pathname === '/api/ready') {
                if (r.state.phase !== 'lobby') return json(res, 409, { error: 'Матч уже начался' });
                p.ready = data.ready === true; updateLobby(r); return json(res, 200, { ok: true });
            }
            if (u.pathname === '/api/start') {
                if (data.token !== r.players.keys().next().value) return json(res, 403, { error: 'Матч запускает создатель комнаты' });
                if (r.state.phase !== 'lobby') return json(res, 409, { error: 'Матч уже начался' });
                if (![...r.players.values()].every(q => q.ready)) return json(res, 409, { error: 'Дождитесь готовности всех игроков' });
                r.state.phase = 'playing'; r.state.freeze = 3; r.inputs = {}; r.state.participants = [];
                for (const q of r.players.values()) r.inputs[q.id] = {};
                return json(res, 200, { ok: true });
            }
            if (u.pathname === '/api/input') {
                const k = data.keys || {};
                r.inputs[p.id] = r.state.phase === 'playing' ? { w: !!k.w, s: !!k.s, a: !!k.a, d: !!k.d, shift: !!k.shift, jump: !!k.jump } : {};
                if (Number.isSafeInteger(data.seq)) r.state.cars[p.id].ack = data.seq;
                return json(res, 200, { ok: true });
            }
            if (u.pathname === '/api/leave') { removePlayer(r, data.token); return json(res, 200, { ok: true }); }
            if (u.pathname === '/api/restart') {
                if (data.token !== r.players.keys().next().value) return json(res, 403, { error: 'Новый матч запускает создатель комнаты' });
                if (!r.state.ended) return json(res, 409, { error: 'Дождитесь окончания матча' });
                const old = r.state; r.state = createState(old.n, old.duration, old.matchId + 1); r.inputs = {};
                for (const q of r.players.values()) { P.namePlayer(r.state, q.id, old.cars[q.id].name); r.inputs[q.id] = {}; q.ready = false; }
                updateLobby(r);
                return json(res, 200, { ok: true });
            }
            return json(res, 404, { error: 'Неизвестный запрос' });
        } catch { return json(res, 400, { error: 'Некорректный запрос' }); }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' });
    let relative;
    try { relative = decodeURIComponent(u.pathname); } catch { return json(res, 400, { error: 'Bad URL' }); }
    const file = path.resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
    if (!file.startsWith(root + path.sep)) return json(res, 403, { error: 'Forbidden' });
    fs.readFile(file, (err, data) => {
        if (err) return json(res, 404, { error: 'Not found' });
        const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }[path.extname(file)] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'X-Boostball-Version': VERSION, 'Cache-Control': path.extname(file) === '.html' ? 'no-store' : 'no-cache' }); res.end(req.method === 'HEAD' ? undefined : data);
    });
});
let previous = performance.now(), accumulator = 0, broadcastAt = previous;
setInterval(() => {
    const now = performance.now(); accumulator += Math.min((now - previous) / 1000, .25); previous = now;
    while (accumulator >= 1 / 60) { for (const r of rooms.values()) if (r.state.phase === 'playing') { P.step(r.state, 1 / 60, r.inputs); if (r.state.ended) r.state.phase = 'ended'; } accumulator -= 1 / 60; }
    if (now - broadcastAt < 50) return;
    broadcastAt = now;
    for (const [code, r] of rooms) {
        for (const [token, p] of r.players) if (Date.now() - p.seen > 20000 && !p.stream) removePlayer(r, token);
        if (!r.players.size) { if (Date.now()-r.seen>120000)rooms.delete(code); continue; }
        r.seen=Date.now();
        const full=r.dirty || r.lastPhase!==r.state.phase || now-(r.fullAt||0)>=1000;
        if (r.state.phase!=='playing'&&!full)continue;
        // Names, statistics and roster are sent on changes and once per second. Motion remains at 20 Hz.
        const s=r.state, payload=full?s:{partial:true,matchId:s.matchId,phase:s.phase,tick:s.tick,time:s.time,freeze:s.freeze,score:s.score,lastGoal:s.lastGoal,ball:s.ball,
            cars:s.cars.map(c=>({id:c.id,x:c.x,y:c.y,z:c.z,vx:c.vx,vy:c.vy,vz:c.vz,a:c.a,boost:c.boost,boosting:c.boosting,ack:c.ack}))};
        const snapshot='data: '+JSON.stringify(payload,(key,value)=>typeof value==='number'?Math.round(value*1000)/1000:value)+'\n\n';
        for (const p of r.players.values()) if (p.stream&&!p.stream.destroyed&&(p.stream.writableLength||0)<65536)p.stream.write(snapshot);
        if(full){r.fullAt=now;r.dirty=false;r.lastPhase=s.phase;}
    }
}, 8).unref();
server.listen(PORT, process.env.HOST || '127.0.0.1', () => console.log(`BOOSTBALL ${VERSION}: port ${PORT}`));
