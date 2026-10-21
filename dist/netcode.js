(function(root){
'use strict';
class SnapshotBuffer {
    constructor(){this.reset();}
    reset(){this.frames=[];this.lastAt=0;this.jitter=0;this.delay=70;this.renderTick=0;}
    push(state,now){
        if(this.lastAt){const variation=Math.abs(now-this.lastAt-50);this.jitter=this.jitter*.9+Math.min(variation,150)*.1;}
        this.lastAt=now;this.delay=Math.max(60,Math.min(140,60+this.jitter*2));
        this.frames.push({state,at:now});if(this.frames.length>16)this.frames.shift();
    }
    sample(now){
        if(!this.frames.length)return null;
        const latest=this.frames[this.frames.length-1],first=this.frames[0];
        const target=latest.state.tick+(now-latest.at-this.delay)*.06;
        this.renderTick=Math.max(this.renderTick,Math.max(first.state.tick,Math.min(latest.state.tick+3,target)));
        while(this.frames.length>2&&this.frames[1].state.tick<=this.renderTick)this.frames.shift();
        const a=this.frames[0],b=this.frames[1]||a,span=b.state.tick-a.state.tick;
        const alpha=span>0?Math.max(0,Math.min(1,(this.renderTick-a.state.tick)/span)):1;
        return{a:a.state,b:b.state,alpha,extrapolate:Math.max(0,Math.min(.05,(this.renderTick-latest.state.tick)/60)),stale:now-latest.at>500};
    }
}
class CarPrediction {
    constructor(drive){this.drive=drive;this.car=null;this.error={x:0,y:0,z:0,a:0};this.history=[];}
    reset(car){this.car={...car};this.error={x:0,y:0,z:0,a:0};this.history=[];}
    step(dt,keys,now){
        if(!this.car)return;this.history.push({at:now,keys});while(this.history.length>120)this.history.shift();
        this.drive(this.car,dt,keys);const decay=Math.exp(-18*dt);for(const k of ['x','y','z','a'])this.error[k]*=decay;
    }
    accept(car,now,ping,teleport){
        if(!this.car||teleport||Math.hypot(this.car.x-car.x,this.car.z-car.z)>6){this.reset(car);return;}
        const old={x:this.car.x+this.error.x,y:this.car.y+this.error.y,z:this.car.z+this.error.z,a:this.car.a+this.error.a};
        const age=Math.min(.15,Math.max(0,ping/2000)+1/120),from=now-age*1000,next={...car};
        for(let t=0;t<age;t+=1/60){let keys={};for(let i=this.history.length-1;i>=0;i--)if(this.history[i].at<=from+t*1000){keys=this.history[i].keys;break;}this.drive(next,Math.min(1/60,age-t),keys);}
        this.car=next;for(const k of ['x','y','z'])this.error[k]=old[k]-next[k];this.error.a=Math.atan2(Math.sin(old.a-next.a),Math.cos(old.a-next.a));
    }
    view(){return{...this.car,x:this.car.x+this.error.x,y:this.car.y+this.error.y,z:this.car.z+this.error.z,a:this.car.a+this.error.a};}
}
const api={SnapshotBuffer,CarPrediction};if(typeof module!=='undefined')module.exports=api;else root.Netcode=api;
})(typeof globalThis!=='undefined'?globalThis:this);
