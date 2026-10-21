'use strict';
const vm = require('node:vm'), fs = require('node:fs'), assert = require('node:assert/strict');
const elements = new Map(), storage = new Map();
function element(id) {
    if (!elements.has(id)) elements.set(id, { value: ({ size:'4',duration:'180',team:'0',quality:'auto',playerName:'<Alex & team>' })[id] || '', hidden: ['results','waitingRoom'].includes(id), textContent:'', dataset:{}, style:{}, children:[], classList:{add(){},remove(){},toggle(){}}, setAttribute(key,value){this[key]=value;}, append(...values){this.children.push(...values);}, replaceChildren(){this.children=[];} });
    return elements.get(id);
}
let frames = [], now = 0;
class Renderer { constructor(){this.fps=60;this.gpuMs=.4;}setQuality(){}reset(){}draw(){}project(){return{x:100,y:100,visible:true};} }
const env={Netcode:require('./dist/netcode.js'),Physics:require('./dist/physics.js'),ArenaRenderer:Renderer,document:{getElementById:element,createElement:()=>element('generated'+elements.size),querySelectorAll:()=>[],body:{classList:{add(){},remove(){},toggle(){}}}},window:{},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},performance:{now:()=>now},addEventListener(){},requestAnimationFrame:f=>frames.push(f),console,Math,Date,setTimeout,fetch:()=>{throw Error('Unexpected request');}};
vm.createContext(env);vm.runInContext(fs.readFileSync(__dirname+'/dist/game.js','utf8'),env);
function frame(){now+=17;frames.shift()(now);}
(async()=>{
    frame();env.window.Boostball.setSize(12);element('playerName').value='<Alex & team>';
    await element('play').onclick();assert.equal(env.window.Boostball.state.cars.length,24);assert.equal(env.window.Boostball.playing,true);
    for(let i=0;i<10;i++)frame();assert.equal(element('matchType').textContent,'12 НА 12');
    assert.equal(element('playerLogin').textContent,'<Alex & team>');assert.equal(storage.get('boostball.name'),'<Alex & team>');
    const s=env.window.Boostball.state;s.ended=true;s.score=[2,1];s.cars[0].stats.goals=2;s.cars[0].stats.touches=4;
    for(let i=0;i<10;i++)frame();assert.equal(element('overlay').hidden,false);assert.equal(element('results').hidden,false);assert.equal(element('finalScore').textContent,'2 : 1');assert.equal(element('statsBody').children.length,24);
    assert.equal(element('statsBody').children[0].children[0].textContent,'<Alex & team>');
    await element('restart').onclick();assert.equal(element('results').hidden,true);assert.equal(env.window.Boostball.state.cars[0].name,'<Alex & team>');assert.equal(env.window.Boostball.state.cars[0].stats.goals,0);
    console.log('Client: nickname persistence, 12×12, safe text rendering, automatic results, 24 player rows and restart reset OK.');
})().catch(e=>{console.error(e);process.exitCode=1;});
