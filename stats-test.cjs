'use strict';
const assert=require('node:assert/strict'),P=require('./dist/physics.js');
const s=P.create(2);P.namePlayer(s,0,'Alex\u202e\n');P.namePlayer(s,1,'Alex');assert.equal(s.cars[0].name,'Alex');assert.equal(s.cars[1].name,'Alex (2)');
function touch(id){s.freeze=0;s.contacts=[];for(const c of s.cars){c.x=-30;c.z=15+c.id*3;c.vx=c.vy=c.vz=0;}const c=s.cars[id];c.x=-1.7;c.y=.65;c.z=0;c.vx=12;s.ball={x:0,y:1.45,z:0,vx:0,vy:0,vz:0};P.step(s,1/60,Object.fromEntries(s.cars.map(c=>[c.id,{}])));}
touch(0);assert.equal(s.cars[0].stats.touches,1);assert.equal(s.cars[0].stats.shots,1);touch(1);assert.equal(s.lastTouch.id,1);assert.equal(s.previousTouch.id,0);
function goal(x){s.freeze=0;for(const c of s.cars){c.x=-30;c.z=20;}s.ball={x,y:2,z:0,vx:0,vy:0,vz:0};P.step(s,1/60);}
goal(43);assert.equal(s.cars[1].stats.goals,1);assert.equal(s.cars[0].stats.assists,1);assert.equal(s.lastGoal.scorer,'Alex (2)');assert.equal(s.lastTouch,null);
touch(2);goal(43);assert.equal(s.cars[2].stats.ownGoals,1);assert.equal(s.score[0],2);assert.equal(s.cars[0].stats.assists,1);
// An opponent's touch breaks the assist chain.
touch(0);touch(2);touch(1);goal(43);assert.equal(s.cars[0].stats.assists,1);
// A pass more than ten seconds before the goal does not earn an assist.
touch(0);s.elapsed+=11;touch(1);goal(43);assert.equal(s.cars[0].stats.assists,1);
// A shot deflected by a defender is credited to the shooter, rather than an own goal.
const deflection=P.create(1);deflection.freeze=0;deflection.lastShot={id:0,team:0,at:0,pass:null};deflection.lastTouch={id:1,team:1,at:0,deflectedShot:deflection.lastShot};deflection.cars[0].x=-30;deflection.cars[1].x=-25;deflection.ball={x:43,y:2,z:0,vx:1,vy:0,vz:0};P.step(deflection,1/60);assert.equal(deflection.cars[0].stats.goals,1);assert.equal(deflection.cars[1].stats.ownGoals,0);
const m=P.create(1);P.namePlayer(m,0,'Driver');m.freeze=0;for(let i=0;i<100;i++)P.step(m,1/60,{0:{w:true,shift:true}});assert(m.cars[0].stats.distance>10);assert(m.cars[0].stats.boostTime>1);assert(m.cars[0].stats.topSpeed>10);
P.releasePlayer(m,0);assert.equal(m.participants[0].name,'Driver');assert(m.participants[0].stats.distance>10);assert.equal(m.cars[0].stats.distance,0);
const ended=P.create(1,.05);ended.freeze=0;for(let i=0;i<10;i++)P.step(ended,1/60);assert(ended.ended);const saved=JSON.stringify(ended);P.step(ended,1);assert.equal(JSON.stringify(ended),saved);
console.log('Statistics: names, duplicates, touches, shots, goals, assists, interception, assist timeout, own goals, driving, departed players and final freeze OK.');
