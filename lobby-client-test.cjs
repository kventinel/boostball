'use strict';
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict'),P=require('./dist/physics.js');
async function setup(localId=0) {
    const elements=new Map(),callbacks=[],buttons=[{dataset:{mode:localId?'join':'host'},classList:{toggle(){}}}];
    function el(id){if(!elements.has(id))elements.set(id,{value:({size:'4',duration:'180',team:'0',quality:'auto',playerName:'Driver',roomInput:'ABC123'})[id]||'',hidden:['results','waitingRoom'].includes(id),textContent:'',dataset:{},style:{},children:[],classList:{add(){},remove(){},toggle(){}},setAttribute(k,v){this[k]=v;},append(...items){this.children.push(...items);},replaceChildren(){this.children=[];}});return elements.get(id);}
    let now=0,eventSource,remote=P.create(4,180),requests=[];
    remote.phase='lobby';remote.matchId=1;P.namePlayer(remote,0,'Host');P.namePlayer(remote,1,'Guest');remote.lobby={hostId:0,players:[{id:0,name:'Host',team:0,ready:false},{id:1,name:'Guest',team:0,ready:false}]};
    function emit(){eventSource.onmessage({data:JSON.stringify(remote)});}
    const env={Netcode:require('./dist/netcode.js'),Physics:P,ArenaRenderer:class {setQuality(){}reset(){}draw(){}project(){return{x:0,y:0,visible:true};}},document:{getElementById:el,createElement:()=>el('generated'+elements.size),querySelectorAll:selector=>selector==='[data-mode]'?buttons:[],body:{classList:{add(){},remove(){},toggle(){}}}},window:{},localStorage:{getItem(){},setItem(){}},performance:{now:()=>now},requestAnimationFrame:f=>callbacks.push(f),addEventListener(){},console,Math,Date,setTimeout,EventSource:class{constructor(){eventSource=this;}close(){}},fetch:async(url,options)=>{const action=url.split('/').pop(),data=JSON.parse(options.body);requests.push(action);if(action==='create'||action==='join')return{ok:true,json:async()=>({id:localId,token:'test-token',room:'ABC123',state:JSON.parse(JSON.stringify(remote))})};if(action==='ready'){remote.lobby.players.find(p=>p.id===localId).ready=data.ready;emit();}if(action==='start'){remote.phase='playing';remote.freeze=3;emit();}return{ok:true,json:async()=>({ok:true})};}};
    vm.createContext(env);vm.runInContext(fs.readFileSync(__dirname+'/dist/game.js','utf8'),env);
    buttons[0].onclick();await el('play').onclick();
    return{el,env,remote,emit,requests,frame(){now+=100;callbacks.shift()(now);}};
}
(async()=>{
    const host=await setup();assert.equal(host.env.window.Boostball.playing,false);assert.equal(host.el('waitingRoom').hidden,false);assert.equal(host.el('hud').hidden,true);assert.equal(host.el('lobbyStart').disabled,true);assert.equal(host.el('lobbyBlue').children.length,2);
    await host.el('lobbyReady').onclick();assert.equal(host.el('lobbyReady')['aria-pressed'],'true');assert.equal(host.el('lobbyStart').disabled,true);
    host.remote.lobby.players[1].ready=true;host.emit();assert.equal(host.el('lobbyStart').disabled,false);assert.equal(host.env.window.Boostball.state.phase,'lobby');
    host.frame();assert(!host.requests.includes('start'));await host.el('lobbyStart').onclick();assert.equal(host.el('waitingRoom').hidden,true);assert.equal(host.el('hud').hidden,false);assert.equal(host.env.window.Boostball.playing,true);
    const guest=await setup(1);assert.equal(guest.el('lobbyStart').hidden,true);assert.equal(guest.el('waitingRoom').hidden,false);
    guest.remote.lobby.hostId=1;guest.remote.lobby.players=guest.remote.lobby.players.slice(1);guest.emit();assert.equal(guest.el('lobbyStart').hidden,false);
    await guest.el('lobbyReady').onclick();assert.equal(guest.el('lobbyStart').disabled,false);
    guest.remote.phase='playing';guest.emit();guest.remote.ended=true;guest.remote.phase='ended';guest.emit();guest.frame();assert.equal(guest.el('results').hidden,false);
    Object.assign(guest.remote,P.create(4),{matchId:2,phase:'lobby',lobby:{hostId:1,players:[{id:1,name:'Guest',team:0,ready:false}]}});guest.emit();assert.equal(guest.el('waitingRoom').hidden,false);assert.equal(guest.el('results').hidden,true);assert.equal(guest.el('lobbyStart').disabled,true);
    console.log('Lobby client: roster, host/guest controls, ready toggles, no auto-start, shared start transition, host promotion and results→lobby OK.');
})().catch(e=>{console.error(e);process.exitCode=1;});
