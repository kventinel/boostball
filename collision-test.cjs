'use strict';
const assert=require('node:assert/strict'),P=require('./dist/physics.js'),C=require('./dist/collision.js');
function scene(n=1){const s=P.create(n);s.freeze=0;s.ball={x:0,y:1.45,z:22,vx:0,vy:0,vz:0};for(const c of s.cars){c.human=true;c.x=-25;c.z=15+c.id*3;c.a=0;c.vx=c.vy=c.vz=0;}return s;}
function run(s,n=1){for(let i=0;i<n;i++)P.step(s,1/60);}
let s=scene();Object.assign(s.cars[0],{x:-1.65,z:0});Object.assign(s.cars[1],{x:1.65,z:0});run(s,4);assert((C.carContact(...s.cars)?.depth||0)<.005,'long chassis must not overlap nose-to-nose');
s=scene();Object.assign(s.cars[0],{x:0,z:0,a:Math.PI/4});Object.assign(s.cars[1],{x:2,z:0,a:-Math.PI/4});run(s,8);assert((C.carContact(...s.cars)?.depth||0)<.005,'rotated corners separate');
s=scene();for(const c of s.cars)Object.assign(c,{x:0,z:0});run(s,20);assert((C.carContact(...s.cars)?.depth||0)<.005,'identical centers have a finite normal');
s=scene();Object.assign(s.cars[0],{x:-4,z:0,vx:30});Object.assign(s.cars[1],{x:4,z:0,vx:-30,a:Math.PI});for(let i=0;i<120;i++){run(s);assert(s.cars[0].x<s.cars[1].x,'head-on cars cannot swap sides through each other');assert(s.cars.every(c=>Math.hypot(c.vx,c.vz)<=30.01));}
s=scene();Object.assign(s.cars[0],{x:42,z:0,a:Math.PI/4});run(s);assert(s.cars[0].x+C.CAR.x*Math.abs(Math.cos(s.cars[0].a))+C.CAR.z*Math.abs(Math.sin(s.cars[0].a))<=43.00001,'rotated chassis stays inside the wall');
s=scene();Object.assign(s.cars[0],{x:0,z:0});s.ball={x:-5,y:1.45,z:0,vx:95,vy:0,vz:0};P.step(s,.05);assert(s.ball.x< -2.5&&s.ball.vx<0,'fast ball cannot tunnel through a stationary car');assert(s.cars[0].vx>0,'the car receives the opposite impulse');const energy=s.ball.vx**2+s.ball.vy**2+s.cars[0].vx**2/C.CAR.inverseMass;assert(energy<95**2*1.01,'collision must not create kinetic energy');
s=scene();Object.assign(s.cars[0],{x:0,z:0});s.ball={x:3.40,y:1.45,z:0,vx:0,vy:0,vz:0};run(s,300);assert(Math.abs(s.ball.vx)<.001&&Math.abs(s.ball.vz)<.001,'resting touch must not continuously kick the ball');assert(s.cars[0].stats.touches<=2,'resting contact is not counted every solver iteration');
s=scene();Object.assign(s.cars[0],{x:0,z:0});s.ball={x:0,y:3.2,z:0,vx:0,vy:0,vz:0};run(s,180);assert(Math.abs(s.ball.y-3.2)<.04&&Math.abs(s.ball.vy)<.3,'ball rests on the roof without being launched');
s=scene();Object.assign(s.cars[0],{x:0,z:0});Object.assign(s.cars[1],{x:0,z:0,y:2.3});run(s,120);assert(s.cars[1].y>2.3&&s.cars[0].y>=.65,'stacked cars have vertical separation');
for(const [z,y]of[[8.9,2],[0,7]]){s=scene();s.ball={x:40,y,z,vx:70,vy:0,vz:0};run(s,10);assert.equal(s.score[0],0,'posts/crossbar block the ball');assert(s.ball.vx<0,'goal frame reflects incoming motion');}
s=scene();s.ball={x:44,y:2,z:0,vx:0,vy:0,vz:0};run(s);assert.equal(s.score[0],0,'the whole ball must cross the goal plane');s.ball.x=45.1;run(s);assert.equal(s.score[0],1);
s=scene(12);s.ball.z=23;for(const c of s.cars){c.x=(c.id%6-2.5)*.8;c.z=(Math.floor(c.id/6)-1.5)*.8;}run(s,180);let overlap=0;for(let i=0;i<s.cars.length;i++)for(let j=i+1;j<s.cars.length;j++)overlap=Math.max(overlap,C.carContact(s.cars[i],s.cars[j])?.depth||0);assert(overlap<.04,'a dense 24-car pile settles');assert(s.cars.every(c=>[c.x,c.y,c.z,c.vx,c.vy,c.vz].every(Number.isFinite)));
const predicted={...P.create(1).cars[0],x:-1.7,z:0,a:0,vx:15},obstacle={...P.create(1).cars[1],x:1.7,z:0,a:Math.PI,vx:0};const unchanged=JSON.stringify(obstacle);P.predictDrive(predicted,1/60,{},[predicted,obstacle]);assert.equal(JSON.stringify(obstacle),unchanged);assert(predicted.vx<15);assert((C.carContact(predicted,obstacle)?.depth||0)<.5,'local prediction responds to contact before another snapshot');
// Grounded hits must lift the ball at every supported simulation rate.
for(const hz of [20,60,144]){
    s=scene();Object.assign(s.cars[0],{x:-5,z:0,vx:20});s.ball={x:0,y:C.R,z:0,vx:0,vy:0,vz:0};
    let peak=C.R,lifted=false,landed=false,rebounded=false;
    for(let i=0;i<hz*3;i++){
        P.step(s,1/hz);peak=Math.max(peak,s.ball.y);if(s.ball.vy>3)lifted=true;
        if(lifted&&s.ball.vy< -1)landed=true;
        if(landed&&s.ball.vy>1&&s.ball.y<C.R+.7)rebounded=true;
    }
    assert(peak>C.R+1,'driving into a grounded ball must send it airborne');
    assert(rebounded,'the airborne ball must bounce after landing');
}
s=scene();s.ball={x:0,y:8,z:15,vx:0,vy:0,vz:0};let bounced=false;
for(let i=0;i<120;i++){run(s);if(s.ball.vy>5)bounced=true;}assert(bounced,'a falling ball rebounds from the field');
console.log('Collisions: chassis SAT, rotated corners, coincident centers, head-on impacts, walls, fast ball, energy bounds, resting roof contacts, stacking, goal frame and a 24-car pile OK.');

const missingVelocity={...P.create(1).cars[0],x:0,z:0,vx:10,a:0};P.predictDrive(missingVelocity,1/60,{w:true},[missingVelocity],{x:3.3,y:1.45,z:0});assert(Number.isFinite(missingVelocity.vx),'missing optional ball velocity cannot corrupt the car');
