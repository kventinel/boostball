const assert=require('node:assert/strict'),P=require('./dist/physics.js');
for(let n of [1,4,5,12]){let s=P.create(n);assert.equal(s.cars.length,2*n);for(let i=0;i<3600;i++)P.step(s,1/60);for(const c of [...s.cars,s.ball])for(const v of ['x','y','z','vx','vy','vz'])assert(Number.isFinite(c[v]),`${n}: ${v}`);assert(s.time<178&&s.time>100)}
let s=P.create(4);s.freeze=0;s.ball.x=43;s.ball.z=0;s.ball.y=2;P.step(s,1/60);assert.equal(s.score[0],1);assert.equal(s.ball.x,0);s.freeze=0;s.ball.x=-43;s.ball.z=0;s.ball.y=2;P.step(s,1/60);assert.equal(s.score[1],1);
let m=P.create(1);m.freeze=0;let x=m.cars[0].x;for(let i=0;i<30;i++)P.step(m,1/60,{0:{w:true,shift:true}});assert(m.cars[0].x>x+1);assert(m.cars[0].boost<100);console.log('Physics: 1×1, 4×4, 5×5, 12×12, goals, movement and boost OK');
