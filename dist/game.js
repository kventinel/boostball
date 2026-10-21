'use strict';
const $ = id => document.getElementById(id), P = Physics, VERSION = '2.2.0';
let renderer;
try { renderer = new ArenaRenderer($('game')); } catch (e) { $('error').textContent = e.message; $('play').disabled = true; }
let state = P.create(4,600), view = state, playing = false, paused = false, mode = 'solo', localId = 0, keys = {}, session = null, events = null, follow = true, muted = true, audio = null;
let last = performance.now(), accum = 0, announceUntil = 0, lastGoalTick = -1, lastHud = 0, lastLabels = 0, lastNet = 0, lastInput = '', netBusy = false, inputSeq = 0, ping = 0, lastReceived = 0;
let snapshots = [], predicted = null, viewCars = [], viewBall = {}, predictionAccum = 0, lastRender = 0;
const labels = new Map(), timeline = new Netcode.SnapshotBuffer(), predictor = new Netcode.CarPrediction(P.drive);
let lastSceneRender = 0;
$('buildVersion').textContent = 'v' + VERSION;
const waiting = () => !!session && state.phase === 'lobby';
let lobbySignature = '', lobbyBusy = false;
function syncWaitingRoom() {
    const wasWaiting = !$('waitingRoom').hidden;
    $('waitingRoom').hidden = !waiting();
    document.body.classList.toggle('waiting', waiting());
    if (!waiting()) {
        if (session && state.phase === 'playing' && !playing) { enter(); return; }
        if (playing) $('hud').hidden = false;
        if (wasWaiting && playing) { keys = {}; renderer?.reset(state.cars[localId]); }
        $('restart').disabled = !!session && state.lobby?.hostId !== localId; $('restart').textContent = !session ? 'НОВЫЙ МАТЧ' : state.lobby?.hostId === localId ? 'В КОМНАТУ ОЖИДАНИЯ' : 'ЖДЁМ СОЗДАТЕЛЯ';
        lobbySignature = ''; return;
    }
    playing = false; keys = {}; document.body.classList.remove('playing'); $('menu').hidden = true; $('arenaTag').hidden = true; $('hud').hidden = true; $('overlay').hidden = true; $('results').hidden = true; paused = false;
    const lobby = state.lobby; if (!lobby) return;
    const signature = JSON.stringify([lobby, lobbyBusy, state.matchId]); if (signature === lobbySignature) return; lobbySignature = signature;
    const players = lobby.players, mine = players.find(p => p.id === localId), host = lobby.hostId === localId, ready = players.filter(p => p.ready).length;
    $('lobbyCode').textContent = session.room; $('lobbyMatch').textContent = `${state.n} × ${state.n} · ${state.duration / 60} МИН`;
    $('lobbyCount').textContent = `${players.length} / ${state.n * 2} игроков · готовы ${ready} / ${players.length}`;
    for (const [team, id] of [[0, 'lobbyBlue'], [1, 'lobbyOrange']]) {
        const list = $(id); list.replaceChildren(); const members = players.filter(p => p.team === team);
        $(team ? 'lobbyOrangeCount' : 'lobbyBlueCount').textContent = `${members.length} / ${state.n}`;
        if (!members.length) { const row = document.createElement('li'); row.className = 'empty-seat'; row.textContent = 'ЖДЁМ ИГРОКОВ'; list.append(row); }
        for (const player of members) {
            const row = document.createElement('li'), name = document.createElement('span'), status = document.createElement('b');
            name.textContent = player.name; const role = document.createElement('small'); role.textContent = (player.id === localId ? 'ТЫ' : '') + (player.id === lobby.hostId ? (player.id === localId ? ' · ' : '') + 'СОЗДАТЕЛЬ' : ''); name.append(role);
            status.textContent = player.ready ? 'ГОТОВ' : 'СОБИРАЕТСЯ'; row.dataset.ready = player.ready; row.append(name, status); list.append(row);
        }
    }
    const bots = state.n * 2 - players.length; $('lobbyBots').textContent = bots ? `Свободных мест: ${bots}. После старта их займут боты.` : 'Обе команды собраны — все места заняты игроками.';
    $('lobbyHint').textContent = host ? (ready === players.length ? 'Все готовы. Можно начинать — или дождаться ещё друзей.' : 'Дождитесь готовности всех игроков, затем начинайте матч.') : 'Когда все будут готовы, создатель запустит матч.';
    $('lobbyReady').textContent = mine?.ready ? 'Я ГОТОВ ✓' : 'Я ГОТОВ'; $('lobbyReady').setAttribute('aria-pressed', String(!!mine?.ready)); $('lobbyReady').disabled = lobbyBusy;
    $('lobbyStart').hidden = !host; $('lobbyStart').disabled = lobbyBusy || ready !== players.length;
}
try { $('playerName').value = localStorage.getItem('boostball.name') || ''; $('quality').value = localStorage.getItem('boostball.quality') || 'auto'; } catch {}
renderer?.setQuality($('quality').value);
$('quality').onchange = () => { renderer?.setQuality($('quality').value); try { localStorage.setItem('boostball.quality', $('quality').value); } catch {} };
function input() { return { w: !!(keys.w || keys.arrowup), s: !!(keys.s || keys.arrowdown), a: !!(keys.a || keys.arrowleft), d: !!(keys.d || keys.arrowright), shift: !!keys.shift, jump: !!keys[' '] }; }
function beep(freq=500,len=.12) { if(muted)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.value=freq;g.gain.setValueAtTime(.05,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+len);o.start();o.stop(audio.currentTime+len);}catch{} }
function announce(text,seconds=1) { $('announcement').textContent=text;announceUntil=performance.now()+seconds*1000; }
function receive(next) {
    const now = performance.now();
    if (next.partial) {
        if (next.matchId !== state.matchId) return;
        next = {...state, ...next, cars: next.cars.map(c => ({...state.cars[c.id], ...c}))};
    }
    if (session && !['lobby','playing','ended'].includes(next.phase)) throw Error('Обновите страницу: версия сервера изменилась.');
    const changed = state.matchId !== next.matchId || next.tick < state.tick, starting = state.phase === 'lobby' && next.phase === 'playing';
    const teleport = changed || starting || next.freeze > 0 || next.ended || next.phase === 'lobby';
    state = next; lastReceived = now;
    if (waiting() && $('lobbyError').textContent === 'Связь прервалась. Переподключаемся…') $('lobbyError').textContent = '';
    if(changed) { paused=false;$('overlay').hidden=true;$('results').hidden=true;lastGoalTick=-1;predictionAccum=0; }
    if(teleport)timeline.reset();timeline.push(next,now);
    predictor.accept(next.cars[localId],now,ping,teleport);predicted=predictor.car;
    $('connection').textContent='ПОДКЛЮЧЕНО';syncWaitingRoom();
}
function sampleNetwork(now) {
    const sample=timeline.sample(now);if(!sample)return state;
    const {a,b,alpha:t,extrapolate,stale}=sample;
    for(let i=0;i<state.cars.length;i++) {
        const left=a.cars[i],right=b.cars[i];let c=viewCars[i];if(!c)c=viewCars[i]={};Object.assign(c,right);
        for(const key of ['x','y','z','boost'])c[key]=left[key]+(right[key]-left[key])*t;
        c.a=left.a+Math.atan2(Math.sin(right.a-left.a),Math.cos(right.a-left.a))*t;
        if(extrapolate&&!stale&&state.freeze<=0){c.x+=right.vx*extrapolate;c.z+=right.vz*extrapolate;}
        if(i===localId&&predicted&&!state.ended&&state.freeze<=0)Object.assign(c,predictor.view(),{name:right.name,human:true});
    }
    for(const key of ['x','y','z'])viewBall[key]=a.ball[key]+(b.ball[key]-a.ball[key])*t;
    if(extrapolate&&!stale&&state.freeze<=0){viewBall.x+=b.ball.vx*extrapolate;viewBall.z+=b.ball.vz*extrapolate;}
    return {...state,cars:viewCars,ball:viewBall};
}
function updateHUD(now) {
    if (waiting()) { syncWaitingRoom(); return; }
    const c=state.cars[localId];if(!c)return;
    $('blueScore').textContent=state.score[0];$('orangeScore').textContent=state.score[1];const sec=Math.ceil(state.time);$('clock').textContent=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
    $('boostValue').textContent=Math.round(predicted&&session?predicted.boost:c.boost);$('boostRing').style.strokeDashoffset=327*(1-(predicted&&session?predicted.boost:c.boost)/100);
    const humans=state.cars.filter(c=>c.human).length;$('roster').textContent=`${humans} ${session?'онлайн':'игрок'} · ${state.cars.length-humans} ботов`;
    $('playerLogin').textContent=c.name;
    $('performance').dataset.drawMs=String(renderer?.gpuMs||0);$('performance').dataset.uploadBytes=String(renderer?.uploadBytes||0);$('performance').dataset.drawCalls=String(renderer?.drawCalls||0);
    $('performance').textContent=renderer?.lost?'ВОССТАНАВЛИВАЕМ ГРАФИКУ':`${Math.round(renderer?.fps||0)} FPS${session?` · ${Math.round(ping)} мс`:''}`;
    if(session&&now-lastReceived>2000)$('connection').textContent='ВОССТАНАВЛИВАЕМ СВЯЗЬ';
    const goal=state.lastGoal;
    if(goal&&goal.tick!==lastGoalTick){lastGoalTick=goal.tick;announce(`${goal.team?'ОРАНЖЕВЫЕ':'СИНИЕ'} · ГОЛ!${goal.scorer?' '+goal.scorer:goal.ownGoal?' Автогол: '+goal.ownGoal:''}`,2.5);beep(700,.5);}
    else if(now>announceUntil)$('announcement').textContent=state.freeze>0?Math.ceil(state.freeze):'';
    if(state.ended&&$('results').hidden)showResults();
}
function updateLabels() {
    if(!renderer)return;
    const visible=new Set();
    for(const c of view.cars){if(!c.human)continue;visible.add(c.id);let el=labels.get(c.id);if(!el){el=document.createElement('span');el.className='car-label';$('nameplates').append(el);labels.set(c.id,el);}const p=renderer.project(c.x,c.y+2.1,c.z);el.hidden=!p?.visible||!playing||waiting();el.textContent=(c.id===localId?'ТЫ · ':'')+c.name;el.dataset.team=c.team;el.style.transform=p?`translate(${p.x}px,${p.y}px) translate(-50%,-100%)`:'';}
    for(const [id,el]of labels)if(!visible.has(id))el.hidden=true;
}
function frame(now) {
    const elapsed=now-last;if(elapsed<5){requestAnimationFrame(frame);return;}const dt=Math.min(elapsed/1000,.1);last=now;
    if(!session&&!paused){accum+=dt;let steps=0;while(accum>=1/60&&steps++<6){P.step(state,1/60,playing?{[localId]:input()}:{});accum-=1/60;}if(!playing&&state.ended)state=P.create(4,600);}
    if(session&&!waiting()&&predicted&&state.freeze<=0&&!state.ended){predictionAccum+=dt;let steps=0;while(predictionAccum>=1/60&&steps++<6){if(now-lastReceived<1000)predictor.step(1/60,paused?{}:input(),now);predictionAccum-=1/60;}}
    view=session?sampleNetwork(now):state;
    if(playing||session){
        if(now-lastHud>=100){updateHUD(now);lastHud=now;}
        if(session){const current=JSON.stringify(paused||waiting()?{}:input());if(!netBusy&&now-lastNet>=33&&(current!==lastInput||now-lastNet>500)){lastInput=current;lastNet=now;netBusy=true;const started=now;api('input',{...session,seq:++inputSeq,keys:JSON.parse(current)}).then(()=>{ping=ping*.7+(performance.now()-started)*.3;}).catch(()=>{lastInput='';}).finally(()=>netBusy=false);}}
    }
    // The menu needs less rendering work than an active match.
    const interval=playing?($('quality').value==='high'?1000/120:1000/60):100;
    if(!document.hidden&&now-lastRender>=interval-1){renderer?.draw(view,playing,localId,follow,now,Math.min((now-lastSceneRender)/1000,.1)||dt);lastRender+=Math.max(1,Math.floor((now-lastRender)/interval))*interval;lastSceneRender=now;if(now-lastLabels>50){updateLabels();lastLabels=now;}}
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
async function api(action,data) {
    const controller=typeof AbortController!=='undefined'?new AbortController():null;
    const timeout=controller?setTimeout(()=>controller.abort(),action==='input'?1200:5000):null;
    try { const r=await fetch('/api/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:controller?.signal});const d=await r.json();if(!r.ok)throw Error(d.error||'Ошибка сервера');return d; }
    finally {if(timeout)clearTimeout(timeout);}
}
function setSize(n) { n=Math.floor(P.clamp(Number(n)||4,1,12));$('size').value=n;$('sizeLabel').textContent=`${n} НА ${n}`;document.querySelectorAll('[data-size]').forEach(b=>b.classList.toggle('selected',+b.dataset.size===n)); }
document.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>setSize(b.dataset.size));$('size').onchange=()=>setSize($('size').value);
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));$('settings').hidden=mode==='join';$('joinSettings').hidden=mode!=='join';$('play').innerHTML=(mode==='solo'?'НА ПОЛЕ':mode==='host'?'СОЗДАТЬ КОМНАТУ':'ПРИСОЕДИНИТЬСЯ')+' <span>↗</span>';$('menuHint').textContent=mode==='solo'?'Ты за рулём. Остальные места займут боты.':mode==='host'?'Поделись кодом. Сначала соберитесь в комнате ожидания.':'Нужны код комнаты и доступ к одному серверу.';$('error').textContent='';});
$('play').onclick=async()=>{
    if($('play').disabled||!renderer)return;
    try{
        $('play').disabled=true;$('error').textContent='';const name=P.cleanName($('playerName').value)||'Игрок';$('playerName').value=name;try{localStorage.setItem('boostball.name',name);}catch{}
        const n=+$('size').value,duration=+$('duration').value,team=+$('team').value;
        if(mode==='solo'){state=P.create(n,duration);state.matchId=1;localId=team*n;P.namePlayer(state,localId,name);}
        else {
            const data=await api(mode==='host'?'create':'join',{n,duration,team,name,protocol:3,room:$('roomInput').value.trim()});if(data.state.phase!=='lobby')throw Error('Обновите страницу: сервер должен открыть комнату ожидания.');session={room:data.room,token:data.token};localId=data.id;playing=false;timeline.reset();receive(data.state);
            events=new EventSource(`/api/events?room=${session.room}&token=${session.token}`);
            events.onmessage=e=>{try{receive(JSON.parse(e.data));}catch(err){console.error('Snapshot error',err);}};
            events.onerror=()=>{$('connection').textContent='ВОССТАНАВЛИВАЕМ СВЯЗЬ';if(waiting())$('lobbyError').textContent='Связь прервалась. Переподключаемся…';};
        }
        if(!session)enter();
    }catch(e){$('error').textContent=e.message==='Failed to fetch'?'Сервер недоступен. Быстрая игра работает без подключения.':e.message;}
    finally{$('play').disabled=false;}
};
function enter() {
    $('lobbyError').textContent='';
    playing=true;paused=false;accum=predictionAccum=0;keys={};lastGoalTick=state.lastGoal?.tick??-1;lastInput='';lastNet=0;viewCars=[];viewBall={};
    document.body.classList.add('playing');$('menu').hidden=true;$('arenaTag').hidden=true;$('hud').hidden=false;$('overlay').hidden=true;$('results').hidden=true;$('roomBadge').hidden=!session;
    if(session)$('roomCode').textContent=session.room;
    $('matchType').textContent=`${state.n} НА ${state.n}`;$('playerTeam').textContent=state.cars[localId].team?'ОРАНЖЕВЫЕ':'СИНИЕ';$('playerTeam').style.color=state.cars[localId].team?'#ffc294':'#80d4ff';$('connection').textContent=session?'СЕРВЕРНАЯ КОМНАТА':'ЛОКАЛЬНАЯ АРЕНА';renderer.reset(state.cars[localId]);syncWaitingRoom();beep(400,.2);
}
function showOverlay(title,text) { $('results').hidden=true;$('overlayTitle').textContent=title;$('overlayText').textContent=text;$('overlay').hidden=false;$('resume').hidden=false; }
function togglePause() { if(!playing||waiting()||state.ended)return;paused=!paused;keys={};if(paused)showOverlay('ПАУЗА',session?'Матч в комнате продолжается.':'Моторы могут подождать.');else $('overlay').hidden=true; }
$('pause').onclick=togglePause;$('resume').onclick=togglePause;
function showResults() {
    paused=true;keys={};showOverlay('МАТЧ ЗАВЕРШЁН',state.score[0]===state.score[1]?'НИЧЬЯ':`ПОБЕДИЛИ ${state.score[0]>state.score[1]?'СИНИЕ':'ОРАНЖЕВЫЕ'}`);$('resume').hidden=true;$('results').hidden=false;$('finalScore').textContent=state.score.join(' : ');
    const rows=[...state.cars,...(state.participants||[])].sort((a,b)=>a.team-b.team||b.stats.goals-a.stats.goals||b.stats.assists-a.stats.assists||b.stats.touches-a.stats.touches);
    const points=c=>c.stats.goals*100+c.stats.assists*60+c.stats.shots*10+c.stats.touches-c.stats.ownGoals*50;
    const mvp=[...rows].sort((a,b)=>points(b)-points(a))[0];
    $('mvp').textContent=mvp&&points(mvp)>0?`ИГРОК МАТЧА · ${mvp.name}`:'';
    const body=$('statsBody');body.replaceChildren();
    for(const c of rows){const tr=document.createElement('tr');tr.dataset.team=c.team;if(c.human&&!c.disconnected&&c.id===localId)tr.className='you';
        const name=document.createElement('td');name.textContent=c.name;const badge=document.createElement('small');badge.textContent=c.disconnected?'ВЫШЕЛ':c.human?'ИГРОК':'БОТ';name.append(badge);if(c.stats.ownGoals){const own=document.createElement('small');own.textContent=`АВТОГОЛЫ: ${c.stats.ownGoals}`;name.append(own);}tr.append(name);
        for(const value of [c.team?'ОРАНЖ.':'СИНИЕ',c.stats.goals,c.stats.assists,c.stats.shots,c.stats.touches,`${Math.round(c.stats.distance)} м`,`${Math.round(c.stats.topSpeed*3.6)} км/ч`]){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);
    }
}
async function leave() {
    if(session){const old=session;session=null;events?.close();events=null;api('leave',old).catch(()=>{});}snapshots=[];timeline.reset();predictor.car=null;predicted=null;playing=false;paused=false;keys={};state=P.create(4,600);view=state;
    for(const el of labels.values())el.hidden=true;
    document.body.classList.remove('playing');$('menu').hidden=false;$('arenaTag').hidden=false;$('hud').hidden=true;$('overlay').hidden=true;$('results').hidden=true;$('waitingRoom').hidden=true;document.body.classList.remove('waiting');lobbySignature='';lobbyBusy=false;$('connection').textContent='ЛОКАЛЬНАЯ АРЕНА';
}
$('exit').onclick=leave;$('back').onclick=leave;
$('restart').onclick=async()=>{if(session){try{await api('restart',session);/* The next authoritative matchId closes the results for every player. */}catch(e){$('overlayText').textContent=e.message;}}else{const n=state.n,d=state.duration,name=state.cars[localId].name;state=P.create(n,d);state.matchId=1;P.namePlayer(state,localId,name);enter();}};
$('lobbyLeave').onclick=leave;
async function lobbyAction(action, data = {}) {
    if (lobbyBusy || !waiting()) return; lobbyBusy = true; $('lobbyError').textContent = ''; syncWaitingRoom();
    try { await api(action, { ...session, ...data }); } catch (e) { $('lobbyError').textContent = e.message; }
    finally { lobbyBusy = false; syncWaitingRoom(); }
}
$('lobbyReady').onclick=()=>lobbyAction('ready', { ready: !state.lobby?.players.find(p=>p.id===localId)?.ready });
$('lobbyStart').onclick=()=>lobbyAction('start');
$('lobbyCopy').onclick=()=> $('copy').onclick();
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(session.room);$('copy').textContent='СКОПИРОВАНО';$('lobbyCopy').textContent='СКОПИРОВАНО';setTimeout(()=>{$('copy').textContent='КОПИРОВАТЬ';$('lobbyCopy').textContent='КОПИРОВАТЬ КОД';},1600);}catch{prompt('Код комнаты',session.room);}};
$('sound').onclick=()=>{muted=!muted;$('sound').textContent=muted?'ЗВУК ВЫКЛ.':'ЗВУК ВКЛ.';if(!muted)beep();};
addEventListener('keydown',e=>{if(!playing||waiting()||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(k==='escape'&&!e.repeat)togglePause();if(k==='c'&&!e.repeat)follow=!follow;keys[k]=true;});
addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
addEventListener('blur',()=>{keys={};if(playing&&!session&&!paused&&!state.ended)togglePause();});
addEventListener('pagehide',()=>{if(session)navigator.sendBeacon('/api/leave',JSON.stringify(session));});
document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys[b.dataset.key]=true;};b.onpointerup=b.onpointercancel=()=>keys[b.dataset.key]=false;});
window.Boostball={get state(){return state;},get session(){return session;},get playing(){return playing;},get performance(){return{fps:renderer?.fps,drawMs:renderer?.gpuMs,uploadBytes:renderer?.uploadBytes,ping};},setSize};
