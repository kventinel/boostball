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
    bevel(x,y,z,w,h,d,b=.16) {
        const outline=(W,D,B,Y)=>[[-W/2+B,Y,-D/2],[W/2-B,Y,-D/2],[W/2,Y,-D/2+B],[W/2,Y,D/2-B],[W/2-B,Y,D/2],[-W/2+B,Y,D/2],[-W/2,Y,D/2-B],[-W/2,Y,-D/2+B]].map(p=>[p[0]+x,p[1],p[2]+z]);
        const bottom=outline(w,d,b,y),shoulder=outline(w,d,b,y+h-b),top=outline(w-b*2,d-b*2,b*.6,y+h);
        for(let i=0;i<8;i++){const j=(i+1)%8;this.quad(bottom[i],bottom[j],shoulder[j],shoulder[i],.59+.12*Math.cos(i*.78));this.quad(shoulder[i],shoulder[j],top[j],top[i],.88);this.tri([x,y+h,z],top[i],top[j]);}
    }
    wheel(x,y,z,r,width) {
        const color=this.color,segments=16;
        for(let i=0;i<segments;i++){const a=i/segments*TAU,b=(i+1)/segments*TAU,p=[x+Math.cos(a)*r,y+Math.sin(a)*r],q=[x+Math.cos(b)*r,y+Math.sin(b)*r];this.paint(0x101622).quad([p[0],p[1],z-width/2],[q[0],q[1],z-width/2],[q[0],q[1],z+width/2],[p[0],p[1],z+width/2],.75);for(const sign of[-1,1]){this.paint(0x192334).tri([x,y,z+sign*width/2],[p[0],p[1],z+sign*width/2],[q[0],q[1],z+sign*width/2]);this.paint(0xaec5d6).tri([x,y,z+sign*(width/2+.004)],[x+Math.cos(a)*r*.62,y+Math.sin(a)*r*.62,z+sign*(width/2+.004)],[x+Math.cos(b)*r*.62,y+Math.sin(b)*r*.62,z+sign*(width/2+.004)]);}}this.color=color;
    }
    ring(x, y, z, radius, width, segments = 48) {
        for (let i = 0; i < segments; i++) { const a = i / segments * TAU, b = (i+1) / segments * TAU, r = radius-width/2, s = radius+width/2; this.quad([x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(a)*s,y,z+Math.sin(a)*s],[x+Math.cos(b)*s,y,z+Math.sin(b)*s],[x+Math.cos(b)*r,y,z+Math.sin(b)*r]); }
    }
    disc(x,y,z,rx,rz) { for(let i=0;i<24;i++){const a=i/24*TAU,b=(i+1)/24*TAU;this.tri([x,y,z],[x+Math.cos(a)*rx,y,z+Math.sin(a)*rz],[x+Math.cos(b)*rx,y,z+Math.sin(b)*rz]);} }

}
function arena() {
    const m = new Mesh();
    m.paint(0x0a1b24).box(0,-1.2,0,114,1,82);
    m.paint(0x1c634d); m.material = 1; m.quad([-43,0,-27],[43,0,-27],[43,0,27],[-43,0,27]); m.material = 0;
    m.paint(0xc8eee4);
    const line = (x,z,w,d) => m.box(x,.025,z,w,.018,d);
    line(0,-26.7,85.4,.13); line(0,26.7,85.4,.13); line(-42.7,0,.13,53.4); line(42.7,0,.13,53.4); line(0,0,.14,53.4);
    m.ring(0,.05,0,9,.14); m.disc(0,.05,0,.32,.32);
    for(const sign of [-1,1]) { line(sign*31,0,.13,28); line(sign*36.9,-14,11.8,.13); line(sign*36.9,14,11.8,.13); }
    for(const sign of [-1,1]) {
        m.paint(sign<0?0x32b6ef:0xff9751);
        m.box(sign*43.5,0,-9,.38,7.1,.38);m.box(sign*43.5,0,9,.38,7.1,.38);m.box(sign*43.5,7,0,.38,.38,18.4);
        m.paint(sign<0?0x164c68:0x6c3a23).box(sign*46.5,-.1,0,6.4,.1,18);
        m.paint(0x7c9fae);
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
        for(let i=0;i<4;i++)m.paint(i%2?0x121b34:0x1e2a45).box(0,-.1,z+Math.sign(z)*(3+i*2.7),103+i*2,2.8+i*1.7,2.8);
        for(let x=-46;x<=46;x+=3.3)m.paint(x<0?0x3f718b:0x94694a).box(x,4,z+Math.sign(z)*6,.9,.5,.8);
    }
    for(const x of [-48,48])for(const z of [-32,32]){m.paint(0x425765).box(x,0,z,.35,22,.35);m.paint(0xe5f8ef).box(x,21.5,z,3.6,.45,1.1);}
    for(const x of [-27,0,27])for(const z of [-18,18]){m.paint(0xb0cd54).ring(x,.035,z,1.15,.12);m.paint(0xe4f990).disc(x,.05,z,.3,.3);}
    // Cached skyline, roof rails and light panels preserve the low per-frame upload cost.
    for(const sign of[-1,1]){
        m.material=3;m.paint(0x7188ff).box(0,12,sign*40,110,.12,.12);m.paint(0x39dce0).box(-26,2,sign*28.05,34,.11,.08);m.paint(0xffaa66).box(26,2,sign*28.05,34,.11,.08);m.material=0;
        for(let i=0;i<17;i++){const x=-72+i*9,h=11+(i*7%19);m.paint(i%2?0x101a32:0x17213b).box(x,0,sign*54,7,h,6);m.material=3;for(let row=3;row<h-1;row+=3)for(let col=-1;col<=1;col++)if((i+row+col)%3)m.paint((i+col)%2?0x5e8dbe:0xb99577).box(x+col*1.6,row,sign*50.95,.65,.65,.03);m.material=0;}
        for(let x=-42;x<=42;x+=7){m.material=3;m.paint(x<0?0x3dcdea:0xffa266).box(x,2.6,sign*28.1,3,.22,.08);m.material=0;}
    }
    return m;
}
function carMesh(team) {
    const m=new Mesh(50000),body=team?0xf17b35:0x2687e0,accent=team?0xffc282:0x64e1ff;
    m.paint(0x0b1624).bevel(0,.2,0,4.04,.48,2.08,.18);
    m.paint(body).bevel(0,.48,0,3.98,.56,2.08,.18);
    m.paint(accent).bevel(.9,.98,0,1.5,.08,1.75,.06);
    m.paint(0x142a42).quad([-.98,1.03,-.82],[.87,1.03,-.82],[.37,1.68,-.66],[-.7,1.68,-.66],.9);
    m.quad([.87,1.03,.82],[-.98,1.03,.82],[-.7,1.68,.66],[.37,1.68,.66],.8);
    m.paint(0x6fc6df).quad([.87,1.03,-.82],[.87,1.03,.82],[.37,1.68,.66],[.37,1.68,-.66],.8);
    m.paint(0x284766).quad([-.98,1.03,.82],[-.98,1.03,-.82],[-.7,1.68,-.66],[-.7,1.68,.66]);
    m.paint(body).bevel(-.17,1.66,0,1.18,.07,1.39,.04);
    m.paint(accent).box(.12,1.735,0,.08,.015,1.12);
    for(const x of[-1.19,1.18])for(const z of[-1.08,1.08])m.wheel(x,.45,z,.43,.32);
    m.paint(0x0b1725).box(-1.68,1.11,0,.28,.13,2.18);for(const z of[-.7,.7])m.box(-1.68,.82,z,.12,.32,.12);
    m.material=3;m.paint(0xe0fff2);for(const z of[-.66,.66])m.box(2.005,.78,z,.055,.12,.52);
    m.paint(0xff5256);for(const z of[-.67,.67])m.box(-2.005,.68,z,.055,.1,.45);
    m.paint(accent);for(const z of[-1.055,1.055])m.box(0,.55,z,2.3,.045,.025);m.material=0;
    return m;
}
function ballMesh() {
    const m=new Mesh(50000),g=(1+Math.sqrt(5))/2,r=1.45;
    const vertices=[[-1,g,0],[1,g,0],[-1,-g,0],[1,-g,0],[0,-1,g],[0,1,g],[0,-1,-g],[0,1,-g],[g,0,-1],[g,0,1],[-g,0,-1],[-g,0,1]].map(v=>{const l=Math.hypot(...v);return v.map(n=>n/l);});
    const faces=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
    const midpoint=(a,b)=>{const v=a.map((x,i)=>x+b[i]),l=Math.hypot(...v);return v.map(x=>x/l);};
    function triangle(a,b,c,depth){if(depth){const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);triangle(a,ab,ca,depth-1);triangle(ab,b,bc,depth-1);triangle(ca,bc,c,depth-1);triangle(ab,bc,ca,depth-1);return;}let center=a.map((x,i)=>(x+b[i]+c[i])/3),l=Math.hypot(...center);center=center.map(x=>x/l);const dark=vertices.some(v=>v.reduce((sum,x,i)=>sum+x*center[i],0)>.94);m.paint(dark?0x173243:0xe1f0e8).tri(a.map(x=>x*r),b.map(x=>x*r),c.map(x=>x*r),.73+.25*Math.max(0,center[1]));}
    for(const f of faces)triangle(...f.map(i=>vertices[i]),2);
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
        const fs=compile(gl.FRAGMENT_SHADER,`precision mediump float;varying vec3 vColor;varying vec3 vWorld;varying float vMaterial;varying float vDistance;void main(){vec3 color=vColor;if(vMaterial>0.5){float stripe=mix(0.86,1.02,smoothstep(-0.12,0.12,sin(vWorld.x*0.7)));float grain=0.99+0.01*sin(vWorld.z*5.0+sin(vWorld.x*3.0));float light=1.0-0.12*min(1.0,dot(vWorld.xz,vWorld.xz)/2600.0);color*=stripe*grain*light;float glow=exp(-abs(abs(vWorld.x)-41.0)*0.65)*0.15;color+=mix(vec3(0.1,0.45,0.8),vec3(0.8,0.3,0.08),step(0.0,vWorld.x))*glow;}if(vMaterial>2.5)color*=1.3;float fog=smoothstep(75.0,190.0,vDistance)*0.5;gl_FragColor=vec4(mix(color,vec3(0.035,0.045,0.095),fog),1.0);}`);
        this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.deleteShader(vs);gl.deleteShader(fs);
        gl.useProgram(this.program);this.position=gl.getAttribLocation(this.program,'aPosition');this.color=gl.getAttribLocation(this.program,'aColor');this.material=gl.getAttribLocation(this.program,'aMaterial');this.instance=gl.getAttribLocation(this.program,'aInstance');this.instancing=gl.getExtension('ANGLE_instanced_arrays');this.vp=gl.getUniformLocation(this.program,'uVP');this.eye=gl.getUniformLocation(this.program,'uCamera');
        gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(.035,.045,.095,1);
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
    reset(c) {this.fpsStart=0;this.frames=0;this.fps=60;this.camera=[c.x-Math.cos(c.a)*17,10.5,c.z-Math.sin(c.a)*17];this.target=[c.x+Math.cos(c.a)*7,1,c.z+Math.sin(c.a)*7];}
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
        const desired=playing?(follow?[c.x-Math.cos(c.a)*17,10.5,c.z-Math.sin(c.a)*17]:[-31,62,66]):[64+Math.sin(now*.00004)*6,64,72];
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
