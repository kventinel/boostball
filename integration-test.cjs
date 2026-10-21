'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
let handler,tick,clock=0;
const fakeHttp={createServer(fn){handler=fn;return{listen(port,host,cb){cb();}};}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'server.cjs'),'utf8'),{require:n=>n==='node:http'?fakeHttp:n==='node:perf_hooks'?{performance:{now:()=>clock}}:n==='./dist/physics.js'?require('./dist/physics.js'):require(n),__dirname,process:{env:{}},console:{log(){}},setInterval:fn=>{tick=fn;return{unref(){}};},URL,Date,Math,JSON,Number,Map,Set});
async function request(route,data){if(data&&['/api/create','/api/join'].includes(route)&&!('protocol' in data))data={...data,protocol:3};const chunks=[];let status,headers;const req={url:route,method:data?'POST':'GET',async *[Symbol.asyncIterator](){if(data)yield JSON.stringify(data);},on(){},destroy(){}};const res={writeHead(s,h){status=s;headers=h;},write(s){chunks.push(s);},end(s){if(s)chunks.push(s);}};await handler(req,res);return{status,headers,body:chunks.join(''),chunks};}
const readers=new WeakMap();
function snapshot(stream){let reader=readers.get(stream);if(!reader){reader={index:0,state:null};readers.set(stream,reader);}while(reader.index<stream.chunks.length){const message=stream.chunks[reader.index++];if(!message.startsWith('data: '))continue;const data=JSON.parse(message.slice(6));reader.state=data.partial?{...reader.state,...data,cars:data.cars.map(c=>({...reader.state.cars[c.id],...c}))}:data;}return reader.state;}
function advance(ms){for(let i=0;i<ms/10;i++){clock+=10;tick();}}
const command=(action,p,data={})=>request('/api/'+action,{room:p.room,token:p.token,...data});
(async()=>{
    assert.equal((await request('/api/create',{protocol:2,n:4})).status,426);
    const a=await request('/api/create',{n:5,duration:180,team:0,name:'Driver'});assert.equal(a.status,200);const host=JSON.parse(a.body);assert.equal(host.state.phase,'lobby');const players=[host];
    for(let i=0;i<9;i++){const r=await request('/api/join',{room:host.room,team:i%2,name:i===0?'Driver':'Guest '+i});assert.equal(r.status,200);players.push(JSON.parse(r.body));}
    assert.equal(players[1].state.cars[players[1].id].name,'Driver (2)');assert.equal(new Set(players.map(p=>p.id)).size,10);
    assert.equal((await request('/api/join',{room:host.room})).status,409);assert.equal((await request('/api/input',{room:host.room,token:'fake'})).status,403);
    const stream=await request(`/api/events?room=${host.room}&token=${host.token}`);assert.equal(stream.headers['Content-Type'],'text/event-stream');
    await command('input',host,{seq:7,keys:{w:true,shift:true}});advance(30000);
    const waiting=snapshot(stream);assert.equal(waiting.tick,0);assert.equal(waiting.time,180);assert.equal(waiting.cars[0].stats.distance,0);assert.equal(waiting.score.join(','),'0,0');
    assert.equal((await command('start',players[1])).status,403);assert.equal((await command('start',host)).status,409);
    for(const p of players)await command('ready',p,{ready:true});
    await command('ready',players[1],{ready:false});assert.equal((await command('start',host)).status,409);await command('ready',players[1],{ready:true});
    advance(1000);assert.equal(snapshot(stream).tick,0); // Ready never starts the room automatically.
    assert.equal((await command('start',host)).status,200);assert.equal((await command('start',host)).status,409);assert.equal((await command('ready',players[1],{ready:false})).status,409);
    assert.equal((await request('/api/join',{room:host.room,name:'Late player'})).status,409);
    await command('input',host,{seq:8,keys:{w:true,shift:true}});advance(5000);
    const active=snapshot(stream);assert.equal(active.phase,'playing');assert(active.tick>=299&&active.tick<=301);assert(active.cars[host.id].stats.distance>10);assert.equal(active.cars[host.id].ack,8);assert(active.time<179);
    const before=stream.chunks.length;clock+=5000;tick();assert(snapshot(stream).tick-active.tick<=15);assert.equal(stream.chunks.length,before+1);
    assert.equal((await command('restart',players[1])).status,403);assert.equal((await command('restart',host)).status,409);
    for(let i=0;i<24000&&!snapshot(stream).ended;i++){clock+=10;tick();}
    const final=snapshot(stream);assert(final.ended);assert.equal(final.phase,'ended');const frozen=JSON.stringify(final.cars.map(c=>c.stats));advance(1000);assert.equal(JSON.stringify(snapshot(stream).cars.map(c=>c.stats)),frozen);
    assert.equal((await command('restart',host)).status,200);advance(100);const restarted=snapshot(stream);assert.equal(restarted.phase,'lobby');assert.equal(restarted.matchId,2);assert.equal(restarted.cars[host.id].stats.distance,0);assert.equal(restarted.cars[host.id].name,'Driver');assert(restarted.lobby.players.every(p=>!p.ready));
    const replacement=await request(`/api/events?room=${host.room}&token=${players[1].token}`);
    await command('leave',host);advance(100);const promoted=snapshot(replacement);assert.equal(promoted.lobby.hostId,players[1].id);assert.equal(promoted.lobby.players.length,9);
    assert.equal((await command('start',host)).status,403);assert.equal((await command('start',players[1])).status,409);
    for(const p of players.slice(1))await command('ready',p,{ready:true});assert.equal((await command('start',players[1])).status,200);
    assert.equal(JSON.parse((await request('/health')).body).version,'2.2.0');
    console.log('Server: lobby freezes time and input, readiness toggles, host-only manual start, late joins rejected, 10 players, SSE, stats, results→lobby, readiness reset, host transfer and restart OK.');
})().catch(e=>{console.error(e);process.exitCode=1;});
