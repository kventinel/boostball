/* Depth-tested GPU geometry. Arena meshes are built once, rather than sorted every frame. */
(function (root) {
'use strict';
const TAU = Math.PI * 2;
const rgb = hex => [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255];
class Mesh {
    constructor(capacity = 350000) { this.data = new Float32Array(capacity); this.length = 0; this.color = [1, 1, 1]; this.material = 0; }
    paint(hex) { this.color = rgb(hex); return this; }
    vertex(p, shade = 1) { const a = this.data; let i = this.length; a[i++] = p[0]; a[i++] = p[1]; a[i++] = p[2]; for (const c of this.color) a[i++] = c * shade; a[i++] = this.material; this.length = i; }
    tri(a, b, c, shade = 1) { this.vertex(a, shade); this.vertex(b, shade); this.vertex(c, shade); }
    quad(a, b, c, d, shade = 1) { this.tri(a, b, c, shade); this.tri(a, c, d, shade); }
    box(x, y, z, w, h, depth) {
        const a = [x-w/2,y,z-depth/2], b = [x+w/2,y,z-depth/2], c = [x+w/2,y,z+depth/2], d = [x-w/2,y,z+depth/2];
        const e = [a[0],y+h,a[2]], f = [b[0],y+h,b[2]], g = [c[0],y+h,c[2]], j = [d[0],y+h,d[2]];
        this.quad(a,b,f,e,.65); this.quad(b,c,g,f,.78); this.quad(c,d,j,g,.72); this.quad(d,a,e,j,.58); this.quad(e,f,g,j,1);
    }
    ring(x, y, z, radius, width, segments = 48) {
        for (let i = 0; i < segments; i++) { const a = i / segments * TAU, b = (i+1) / segments * TAU, r = radius-width/2, s = radius+width/2; this.quad([x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(a)*s,y,z+Math.sin(a)*s],[x+Math.cos(b)*s,y,z+Math.sin(b)*s],[x+Math.cos(b)*r,y,z+Math.sin(b)*r]); }
    }
    disc(x,y,z,rx,rz) { for(let i=0;i<24;i++){const a=i/24*TAU,b=(i+1)/24*TAU;this.tri([x,y,z],[x+Math.cos(a)*rx,y,z+Math.sin(a)*rz],[x+Math.cos(b)*rx,y,z+Math.sin(b)*rz]);} }

}
function arena() {
    const m = new Mesh();
    m.paint(0x0a1b24).box(0,-1.2,0,114,1,82);
    m.paint(0x215e45); m.material = 1; m.quad([-43,0,-27],[43,0,-27],[43,0,27],[-43,0,27]); m.material = 0;
    m.paint(0xc6ddd1);
    const line = (x,z,w,d) => m.box(x,.025,z,w,.018,d);
    line(0,-26.7,85.4,.13); line(0,26.7,85.4,.13); line(-42.7,0,.13,53.4); line(42.7,0,.13,53.4); line(0,0,.14,53.4);
    m.ring(0,.05,0,9,.14); m.disc(0,.05,0,.32,.32);
    for(const sign of [-1,1]) { line(sign*31,0,.13,28); line(sign*36.9,-14,11.8,.13); line(sign*36.9,14,11.8,.13); }
    for(const sign of [-1,1]) {
        m.paint(sign<0?0x32b6ef:0xff9751);
        m.box(sign*43.5,0,-9,.38,7.1,.38);m.box(sign*43.5,0,9,.38,7.1,.38);m.box(sign*43.5,7,0,.38,.38,18.4);
        m.paint(sign<0?0x164c68:0x6c3a23).box(sign*46.5,-.1,0,6.4,.1,18);
        m.paint(0x5e8682);
        for(let z=-9;z<=9;z+=1.5)m.box(sign*49.3,0,z,.055,7,.055);
        for(let y=1;y<=7;y+=1)m.box(sign*49.3,y,0,.055,.055,18);
        for(let z of [-9,9])for(let y=1;y<=7;y+=1)m.box(sign*46.4,y,z,6,.045,.045);
        for(let z=-9;z<=9;z+=1.5)m.box(sign*46.4,7,z,6,.045,.045);
        m.paint(0x263f50).box(sign*44,0,-18.5,1.2,1.8,19);m.box(sign*44,0,18.5,1.2,1.8,19);
        m.paint(sign<0?0x32b6ef:0xff9751).box(sign*43.3,1.8,-18.5,.13,.13,19);m.box(sign*43.3,1.8,18.5,.13,.13,19);
    }
    for(const z of [-28.5,28.5]) {
        m.paint(0x263f50).box(0,0,z,89,1.8,1);
        m.paint(0x46c9fa).box(-22,1.8,z-Math.sign(z)*.52,44,.13,.08);
        m.paint(0xffa465).box(22,1.8,z-Math.sign(z)*.52,44,.13,.08);
        for(let i=0;i<4;i++)m.paint(i%2?0x182f42:0x233f50).box(0,-.1,z+Math.sign(z)*(3+i*2.7),103+i*2,2.8+i*1.7,2.8);
        for(let x=-46;x<=46;x+=3.3)m.paint(x<0?0x3f718b:0x94694a).box(x,4,z+Math.sign(z)*6,.9,.5,.8);
    }
    for(const x of [-48,48])for(const z of [-32,32]){m.paint(0x425765).box(x,0,z,.35,22,.35);m.paint(0xe5f8ef).box(x,21.5,z,3.6,.45,1.1);}
    for(const x of [-27,0,27])for(const z of [-18,18]){m.paint(0xb0cd54).ring(x,.035,z,1.15,.12);m.paint(0xe4f990).disc(x,.05,z,.3,.3);}
    return m;
}
function carMesh(team) {
    const m = new Mesh(14000);
    m.paint(team?0xf39a4d:0x40b9e5).box(0,.35,0,3.8,.7,1.95);
    m.paint(team?0xfbc282:0x90e0f5).box(-.25,1.05,0,1.8,.65,1.55);
    m.paint(0x14313f).box(.61,1.14,0,.07,.46,1.38);
    m.paint(0x204351).box(-1.13,1.15,0,.06,.36,1.35);
    m.paint(0x12202b);for(const x of [-1.12,1.12])for(const z of [-1.02,1.02])m.box(x,.1,z,.88,.78,.4);
    m.paint(0x9cadb1);for(const x of [-1.12,1.12])for(const z of [-1.24,1.24])m.box(x,.3,z,.35,.35,.045);
    m.paint(0xf3ffd3);for(const z of [-.65,.65])m.box(1.91,.66,z,.045,.18,.43);
    m.paint(0xff4a4a);for(const z of [-.65,.65])m.box(-1.91,.66,z,.045,.14,.35);
    m.paint(0x101d29).box(-1.55,1.03,0,.26,.18,2.1);
    m.paint(0xe2f3ea).box(-.15,1.715,0,1.5,.018,.15);
    return m;
}
function ballMesh() {
    const m = new Mesh(18000), rows=10, cols=16, r=1.45;
    const point=(row,col)=>{const a=row/rows*Math.PI,b=col/cols*TAU;return[r*Math.sin(a)*Math.cos(b),r*Math.cos(a),r*Math.sin(a)*Math.sin(b)];};
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++) {m.paint((row+Math.floor(col/2))%3===0?0x233b4b:0xeff2dd);m.quad(point(row,col),point(row+1,col),point(row+1,col+1),point(row,col+1),.6+.4*Math.cos(row/rows*Math.PI/2));}
    return m;
}
function multiply(a,b) {const o=new Float32Array(16);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)o[col*4+row]+=a[k*4+row]*b[col*4+k];return o;}
const unit = a => {const l=Math.hypot(...a)||1;return a.map(x=>x/l);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
class ArenaRenderer {
    constructor(canvas) {
        this.canvas=canvas;this.quality='auto';this.scale=1;this.camera=[64,60,72];this.target=[0,0,0];this.fps=60;this.gpuMs=0;this.lost=false;this.frames=0;this.seconds=0;this.adjustAt=0;this.fpsStart=0;this.uploadBytes=0;this.drawCalls=0;
        this.gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'high-performance',depth:true});
        if(!this.gl)throw new Error('Для игры нужен WebGL. Включите аппаратное ускорение в настройках браузера.');
        this.init();
        canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;});
        canvas.addEventListener('webglcontextrestored',()=>{this.init();this.lost=false;});
    }
    init() {
        const gl=this.gl;
        const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
        const vs=compile(gl.VERTEX_SHADER,`attribute vec3 aPosition;attribute vec3 aColor;attribute float aMaterial;attribute vec4 aInstance;uniform mat4 uVP;uniform vec3 uCamera;varying vec3 vColor;varying vec3 vWorld;varying float vMaterial;varying float vDistance;void main(){float co=cos(aInstance.w),si=sin(aInstance.w);vec3 world=vec3(aPosition.x*co-aPosition.z*si,aPosition.y,aPosition.x*si+aPosition.z*co)+aInstance.xyz;gl_Position=uVP*vec4(world,1.0);vColor=aColor;vWorld=world;vMaterial=aMaterial;vDistance=distance(world,uCamera);}`);
        const fs=compile(gl.FRAGMENT_SHADER,`precision mediump float;varying vec3 vColor;varying vec3 vWorld;varying float vMaterial;varying float vDistance;void main(){vec3 color=vColor;if(vMaterial>0.5){float stripe=0.95+0.05*sin(vWorld.x*0.78);float grain=0.985+0.015*sin(vWorld.z*7.0+sin(vWorld.x*3.0));color*=stripe*grain;}float fog=smoothstep(65.0,175.0,vDistance)*0.65;gl_FragColor=vec4(mix(color,vec3(0.035,0.075,0.11),fog),1.0);}`);
        this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.deleteShader(vs);gl.deleteShader(fs);
        gl.useProgram(this.program);this.position=gl.getAttribLocation(this.program,'aPosition');this.color=gl.getAttribLocation(this.program,'aColor');this.material=gl.getAttribLocation(this.program,'aMaterial');this.instance=gl.getAttribLocation(this.program,'aInstance');this.instancing=gl.getExtension('ANGLE_instanced_arrays');this.vp=gl.getUniformLocation(this.program,'uVP');this.eye=gl.getUniformLocation(this.program,'uCamera');
        gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(.035,.075,.11,1);
        const mesh=arena();this.staticBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.staticBuffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.data.subarray(0,mesh.length),gl.STATIC_DRAW);this.staticCount=mesh.length/7;
        const upload=mesh=>{const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.data.subarray(0,mesh.length),gl.STATIC_DRAW);return{buffer,count:mesh.length/7};};
        this.cars=[upload(carMesh(0)),upload(carMesh(1))];this.ball=upload(ballMesh());
        const shadow=new Mesh(1000);shadow.paint(0x12372e).disc(0,.06,0,2.3,1.65);this.shadow=upload(shadow);
        const ballShadow=new Mesh(1000);ballShadow.paint(0x12372e).disc(0,.07,0,1.6,1.6);this.ballShadow=upload(ballShadow);
        const ring=new Mesh(1600);ring.paint(0xe2ff82).ring(0,.09,0,2.5,.09,32);this.selection=upload(ring);
        const flame=new Mesh(1000);flame.paint(0xdfff7a).box(-2.5,.55,0,.7,.4,.7);flame.paint(0x81e7cd).box(-3.2,.62,0,.5,.25,.5);this.flame=upload(flame);
        this.transforms=[new Float32Array(96),new Float32Array(96)];this.shadows=new Float32Array(96);this.flames=new Float32Array(96);this.single=new Float32Array(4);
        this.instanceBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.instanceBuffer);gl.bufferData(gl.ARRAY_BUFFER,96*4,gl.DYNAMIC_DRAW);
    }
    setQuality(value) {this.quality=value;this.scale=value==='low'?.7:value==='high'?Math.min(devicePixelRatio||1,1.5):Math.min(devicePixelRatio||1,1);}
    reset(c) {this.camera=[c.x-Math.cos(c.a)*18,12,c.z-Math.sin(c.a)*18];this.target=[c.x+Math.cos(c.a)*7,1,c.z+Math.sin(c.a)*7];}
    project(x,y,z) {const m=this.matrix,w=m[3]*x+m[7]*y+m[11]*z+m[15];if(w<.5)return null;const sx=(m[0]*x+m[4]*y+m[8]*z+m[12])/w,sy=(m[1]*x+m[5]*y+m[9]*z+m[13])/w;return {x:(sx+1)*this.width/2,y:(1-sy)*this.height/2,visible:Math.abs(sx)<1.1&&Math.abs(sy)<1.1};}
    draw(state,playing,localId,follow,now,dt) {
        if(this.lost)return;
        const start=performance.now(),gl=this.gl,w=innerWidth,h=innerHeight;
        this.width=w;this.height=h;
        if(!this.fpsStart)this.fpsStart=now;this.frames++;
        if(now-this.fpsStart>=1000){this.fps=this.frames*1000/(now-this.fpsStart);this.frames=0;this.fpsStart=now;if(playing&&this.quality==='auto'&&now-this.adjustAt>4000){if(this.fps<45&&this.scale>.6)this.scale=Math.max(.6,this.scale-.1);else if(this.fps>57&&this.scale<1)this.scale=Math.min(1,this.scale+.05);this.adjustAt=now;}}
        const cw=Math.round(w*this.scale),ch=Math.round(h*this.scale);
        if(this.canvas.width!==cw||this.canvas.height!==ch){this.canvas.width=cw;this.canvas.height=ch;gl.viewport(0,0,cw,ch);}
        const c=state.cars[localId]||state.cars[0];
        const desired=playing?(follow?[c.x-Math.cos(c.a)*18,12,c.z-Math.sin(c.a)*18]:[-31,62,66]):[64+Math.sin(now*.00004)*6,64,72];
        const aim=playing&&follow?[c.x+Math.cos(c.a)*7,1.5,c.z+Math.sin(c.a)*7]:[playing?0:-14,0,0];
        const ca=1-Math.exp(-5*dt),ta=1-Math.exp(-8*dt);
        for(let i=0;i<3;i++){this.camera[i]+=(desired[i]-this.camera[i])*ca;this.target[i]+=(aim[i]-this.target[i])*ta;}
        const z=unit(this.camera.map((v,i)=>v-this.target[i])),x=unit(cross([0,1,0],z)),y=cross(z,x),view=new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,this.camera),-dot(y,this.camera),-dot(z,this.camera),1]);
        const f=1/Math.tan(58*Math.PI/360),near=.25,far=260,projection=new Float32Array([f/(w/h),0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
        this.matrix=multiply(projection,view);
        gl.useProgram(this.program);gl.uniformMatrix4fv(this.vp,false,this.matrix);gl.uniform3fv(this.eye,this.camera);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        this.uploadBytes=0;this.drawCalls=0;
        gl.disableVertexAttribArray(this.instance);gl.vertexAttrib4f(this.instance,0,0,0,0);
        this.bind(this.staticBuffer);gl.drawArrays(gl.TRIANGLES,0,this.staticCount);this.drawCalls++;
        const count=[0,0];let flames=0,shadows=0;
        for(const car of state.cars){const i=count[car.team]++*4,a=this.transforms[car.team];a[i]=car.x;a[i+1]=car.y-.65;a[i+2]=car.z;a[i+3]=car.a;
            const j=shadows++*4;this.shadows[j]=car.x;this.shadows[j+1]=0;this.shadows[j+2]=car.z;this.shadows[j+3]=0;
            if(car.boosting){const k=flames++*4;this.flames[k]=car.x;this.flames[k+1]=car.y-.65;this.flames[k+2]=car.z;this.flames[k+3]=car.a;}}
        this.drawInstances(this.shadow,this.shadows,shadows);
        for(let team=0;team<2;team++)this.drawInstances(this.cars[team],this.transforms[team],count[team]);
        if(flames)this.drawInstances(this.flame,this.flames,flames);
        const one=this.single;
        if(playing){one[0]=c.x;one[1]=0;one[2]=c.z;one[3]=0;this.drawInstances(this.selection,one,1);}
        one[0]=state.ball.x;one[1]=0;one[2]=state.ball.z;one[3]=0;this.drawInstances(this.ballShadow,one,1);
        one[1]=state.ball.y;one[3]=state.ball.x*.16;this.drawInstances(this.ball,one,1);
        this.gpuMs=performance.now()-start;
    }
    drawInstances(mesh,transforms,count) {
        if(!count)return;const gl=this.gl;this.bind(mesh.buffer);
        if(this.instancing){gl.bindBuffer(gl.ARRAY_BUFFER,this.instanceBuffer);const data=transforms.subarray(0,count*4);gl.bufferSubData(gl.ARRAY_BUFFER,0,data);this.uploadBytes+=data.byteLength;
            gl.enableVertexAttribArray(this.instance);gl.vertexAttribPointer(this.instance,4,gl.FLOAT,false,16,0);this.instancing.vertexAttribDivisorANGLE(this.instance,1);
            this.instancing.drawArraysInstancedANGLE(gl.TRIANGLES,0,mesh.count,count);this.drawCalls++;this.instancing.vertexAttribDivisorANGLE(this.instance,0);gl.disableVertexAttribArray(this.instance);
        }else{gl.disableVertexAttribArray(this.instance);for(let i=0;i<count;i++){const j=i*4;gl.vertexAttrib4f(this.instance,transforms[j],transforms[j+1],transforms[j+2],transforms[j+3]);gl.drawArrays(gl.TRIANGLES,0,mesh.count);this.drawCalls++;}}
    }
    bind(buffer) {const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);for(const index of [this.position,this.color,this.material])gl.enableVertexAttribArray(index);gl.vertexAttribPointer(this.position,3,gl.FLOAT,false,28,0);gl.vertexAttribPointer(this.color,3,gl.FLOAT,false,28,12);gl.vertexAttribPointer(this.material,1,gl.FLOAT,false,28,24);}
}
root.ArenaRenderer=ArenaRenderer;
})(typeof globalThis!=='undefined'?globalThis:this);
