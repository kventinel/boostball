'use strict';
const assert=require('node:assert/strict'),P=require('./dist/physics.js'),{SnapshotBuffer,CarPrediction}=require('./dist/netcode.js');
const timeline=new SnapshotBuffer();
for(let i=0;i<8;i++)timeline.push({tick:i*3,cars:[]},i*50+(i%2?12:0));
let last=-1;for(let now=350;now<700;now+=1000/60){const sample=timeline.sample(now);assert(timeline.renderTick>=last);last=timeline.renderTick;assert(sample.alpha>=0&&sample.alpha<=1);assert(sample.extrapolate<=.05);}
assert(timeline.sample(1000).stale);timeline.reset();timeline.push({tick:0},1001);assert.equal(timeline.sample(1001).a.tick,0);
const predictor=new CarPrediction(P.drive),start={...P.create(1).cars[0]};predictor.reset(start);const authoritative={...start},packets=[];
let previousX=start.x,maxJump=0,minJump=0;
for(let i=1;i<=600;i++){
 const now=i*1000/60,keys=i<400?{w:true,shift:true}:{};P.drive(authoritative,1/60,keys);predictor.step(1/60,keys,now);
 if(i%3===0)packets.push({at:now+50+(i%2?10:0),car:{...authoritative}});
 while(packets.length&&packets[0].at<=now){const packet=packets.shift();const before=predictor.view();predictor.accept(packet.car,now,100,false);assert(Math.abs(predictor.view().x-before.x)<1e-8);}
 const x=predictor.view().x;maxJump=Math.max(maxJump,Math.abs(x-previousX));minJump=Math.min(minJump,x-previousX);previousX=x;
}
assert(maxJump<1,'prediction should not snap on authoritative updates');
const teleported={...start,x:30,z:10};predictor.accept(teleported,11000,50,true);assert.equal(predictor.view().x,30);assert.equal(predictor.error.x,0);
console.log('Netcode: monotonic render clock under jitter, bounded extrapolation, stale packets, immediate input, continuous corrections and teleport reset OK.');
