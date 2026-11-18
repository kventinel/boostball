'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
let handler,tick,clock=0;
vm.runInNewContext(fs.readFileSync(__dirname+'/server.cjs','utf8'),{
    require:name=>name==='node:http'?{createServer(fn){handler=fn;return{listen(port,host,fn){fn();}};}}:name==='node:perf_hooks'?{performance:{now:()=>clock}}:name==='./dist/physics.js'?require('./dist/physics.js'):require(name),
    __dirname,process:{env:{}},console:{log(){}},setInterval:fn=>{tick=fn;return{unref(){}};},URL,Date,Math,JSON,Number,Map,Set
});
async function request(url,data){let status;const chunks=[];await handler({url,method:data?'POST':'GET',async *[Symbol.asyncIterator](){if(data)yield JSON.stringify(data);},on(){},destroy(){}},{writeHead(code){status=code;},write(text){chunks.push(text);},end(text){if(text)chunks.push(text);}});return{status,chunks,body:chunks.join('')};}
const command=(action,player,data={})=>request('/api/'+action,{room:player.room,token:player.token,...data});
async function state(player){const stream=await request(`/api/events?room=${player.room}&token=${player.token}`);return JSON.parse(stream.chunks.find(c=>c.startsWith('data: ')).slice(6));}
async function create(data){return JSON.parse((await request('/api/create',{protocol:3,n:2,name:'Sam',...data})).body);}
async function join(host,data){return JSON.parse((await request('/api/join',{protocol:3,room:host.room,name:'Sam',...data})).body);}
(async()=>{
    const host=await create({team:0}),guest=await join(host,{team:0});
    assert.notEqual(host.playerId,guest.playerId);assert.equal(host.playerId.length,16);
    await command('ready',host,{ready:true});await command('ready',guest,{ready:true});
    const switched=await command('team',guest,{team:1});assert.equal(switched.status,200);assert.equal(JSON.parse(switched.body).id,2);
    let s=await state(host),own=s.lobby.players.find(p=>p.playerId===guest.playerId);
    assert.equal(own.name,'Sam (2)');assert.equal(own.team,1);assert.equal(own.ready,false);assert.equal(s.cars[1].human,false);assert.equal(s.cars[2].human,true);assert.equal(s.participants.length,0);
    assert(s.lobby.players.find(p=>p.playerId===host.playerId).ready);assert.equal((await command('start',host)).status,409);
    await command('ready',guest,{ready:true});await command('team',guest,{team:1});assert((await state(guest)).lobby.players.find(p=>p.playerId===guest.playerId).ready); // A no-op does not reset readiness.
    await command('team',host,{team:1});s=await state(host);assert.equal(s.lobby.hostId,3);assert.equal(s.lobby.players[0].playerId,host.playerId);assert.equal(s.lobby.players[0].ready,false);
    const third=await join(host,{team:0,name:'Third'});assert.equal((await command('team',third,{team:1})).status,409);assert.equal((await state(third)).lobby.players.find(p=>p.playerId===third.playerId).team,0);
    for(const team of [-1,2,'1',null,{},true])assert.equal((await command('team',third,{team})).status,400);
    assert.equal((await command('team',{room:host.room,token:'wrong'},{team:0})).status,403);
    await command('team',guest,{team:0});
    const racing=await Promise.all([command('team',guest,{team:1}),command('team',third,{team:1})]);assert.deepEqual(racing.map(r=>r.status).sort(),[200,409]);
    s=await state(host);assert.equal(s.lobby.players.filter(p=>p.team===1).length,2);assert.equal(new Set(s.lobby.players.map(p=>p.id)).size,3);assert.equal(s.lobby.hostId,3);
    for(const p of [host,guest,third])await command('ready',p,{ready:true});assert.equal((await command('start',guest)).status,403);assert.equal((await command('start',host)).status,200);
    assert.equal((await command('team',host,{team:0})).status,409);assert.equal((await command('team',guest,{team:0})).status,409);
    await command('input',host,{seq:42,keys:{w:true}});for(let i=0;i<400;i++){clock+=10;tick();}
    s=await state(host);const car=s.cars[s.lobby.hostId];assert.equal(car.name,'Sam');assert.equal(car.team,1);assert.equal(car.ack,42);assert(car.stats.distance>1);
    const one=await create({n:1,team:0}),opponent=await join(one,{team:1,name:'Opponent'});assert.equal((await command('team',one,{team:1})).status,409);assert.equal((await command('team',opponent,{team:0})).status,409);
    console.log('Teams: creator and guest switches, stable identity, names, bot seats, readiness reset/no-op, full teams, invalid requests, simultaneous last-seat requests, host rights and post-start input/statistics OK.');
})().catch(error=>{console.error(error);process.exitCode=1;});
