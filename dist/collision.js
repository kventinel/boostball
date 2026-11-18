/* Collision shapes match the visible chassis and ball; impulses never add resting-contact energy. */
(function(root){
'use strict';
const CAR={x:1.98,y:.85,z:1.24,offsetY:.25,inverseMass:.18},R=1.45;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function carBounds(c){
    const co=Math.abs(Math.cos(c.a)),si=Math.abs(Math.sin(c.a));
    const x=43-(CAR.x*co+CAR.z*si),z=28-(CAR.x*si+CAR.z*co);
    if(c.x>x){c.x=x;if(c.vx>0)c.vx*= -.22;}if(c.x< -x){c.x=-x;if(c.vx<0)c.vx*= -.22;}
    if(c.z>z){c.z=z;if(c.vz>0)c.vz*= -.22;}if(c.z< -z){c.z=-z;if(c.vz<0)c.vz*= -.22;}
    if(c.y<.65){c.y=.65;if(c.vy<0)c.vy=0;}if(c.y>15.3){c.y=15.3;if(c.vy>0)c.vy*= -.2;}
}
function carContact(a,b){
    const dx=b.x-a.x,dz=b.z-a.z,dy=b.y-a.y;
    if(dx*dx+dz*dz>22||Math.abs(dy)>=CAR.y*2)return null;
    const ac=Math.cos(a.a),as=Math.sin(a.a),bc=Math.cos(b.a),bs=Math.sin(b.a),axes=[[ac,as],[-as,ac],[bc,bs],[-bs,bc]];
    let depth=Infinity,nx=0,nz=0;
    for(const [x,z]of axes){const ra=CAR.x*Math.abs(x*ac+z*as)+CAR.z*Math.abs(-x*as+z*ac),rb=CAR.x*Math.abs(x*bc+z*bs)+CAR.z*Math.abs(-x*bs+z*bc),d=dx*x+dz*z,overlap=ra+rb-Math.abs(d);if(overlap<=0)return null;if(overlap<depth){depth=overlap;const sign=d<0?-1:1;nx=x*sign;nz=z*sign;}}
    const vertical=CAR.y*2-Math.abs(dy);
    if(vertical<depth&&(a.y>.7||b.y>.7))return{nx:0,ny:dy<0?-1:1,nz:0,depth:vertical};
    return{nx,ny:0,nz,depth};
}
function impulse(a,b,contact,invA,invB,restitution,friction){
    const {nx,ny,nz,depth}=contact,total=invA+invB,correction=Math.max(0,depth-.001)*.82/total;
    a.x-=nx*correction*invA;a.y-=ny*correction*invA;a.z-=nz*correction*invA;b.x+=nx*correction*invB;b.y+=ny*correction*invB;b.z+=nz*correction*invB;
    const dx=b.vx-a.vx,dy=b.vy-a.vy,dz=b.vz-a.vz,vn=dx*nx+dy*ny+dz*nz;
    if(vn>=0)return 0;
    const j=-(1+(vn<-.6?restitution:0))*vn/total;
    a.vx-=nx*j*invA;a.vy-=ny*j*invA;a.vz-=nz*j*invA;b.vx+=nx*j*invB;b.vy+=ny*j*invB;b.vz+=nz*j*invB;
    const tx=dx-vn*nx,ty=dy-vn*ny,tz=dz-vn*nz,t=Math.hypot(tx,ty,tz);
    if(t>.001){const jt=Math.min(t/total,friction*j)/t;a.vx+=tx*jt*invA;a.vy+=ty*jt*invA;a.vz+=tz*jt*invA;b.vx-=tx*jt*invB;b.vy-=ty*jt*invB;b.vz-=tz*jt*invB;}
    return -vn;
}
function resolveCars(a,b){const contact=carContact(a,b);if(contact)impulse(a,b,contact,CAR.inverseMass,CAR.inverseMass,.15,.22);return contact;}
function sphereBox(ball,x,y,z,hx,hy,hz,angle=0){
    const co=Math.cos(angle),si=Math.sin(angle),dx=ball.x-x,dz=ball.z-z,lx=dx*co+dz*si,ly=ball.y-y,lz=-dx*si+dz*co;
    let nx=lx-clamp(lx,-hx,hx),ny=ly-clamp(ly,-hy,hy),nz=lz-clamp(lz,-hz,hz),d=Math.hypot(nx,ny,nz),depth;
    if(d>=R)return null;
    if(d>.00001){depth=R-d;nx/=d;ny/=d;nz/=d;}
    else{const faces=[hx-Math.abs(lx),hy-Math.abs(ly),hz-Math.abs(lz)],index=faces.indexOf(Math.min(...faces));nx=ny=nz=0;if(index===0)nx=lx<0?-1:1;else if(index===1)ny=ly<0?-1:1;else nz=lz<0?-1:1;depth=R+faces[index];}
    return{nx:nx*co-nz*si,ny,nz:nx*si+nz*co,depth};
}
function resolveCarBall(car,ball){
    if((car.x-ball.x)**2+(car.z-ball.z)**2>18||Math.abs(ball.y-car.y-CAR.offsetY)>R+CAR.y)return null;
    const contact=sphereBox(ball,car.x,car.y+CAR.offsetY,car.z,CAR.x,CAR.y,CAR.z,car.a);
    if(!contact)return null;
    const before={vx:ball.vx,vz:ball.vz};const impact=impulse(car,ball,contact,CAR.inverseMass,1,.67,.08);
    // Low chassis hits scoop the ball upward. Redirect speed rather than adding
    // energy, and leave resting contacts and roof collisions to the normal solver.
    if(impact>2&&contact.ny>=0&&contact.ny<.5&&ball.y<R+.65){
        const horizontal=Math.hypot(ball.vx,ball.vz),speed=Math.hypot(horizontal,ball.vy);
        const lift=Math.min(10,impact*.5,speed*.55);
        if(lift>ball.vy&&horizontal>.001){
            const scale=Math.sqrt(Math.max(0,speed*speed-lift*lift))/horizontal;
            ball.vx*=scale;ball.vz*=scale;ball.vy=lift;
        }
    }
    return{...contact,impact,before};
}
function goalFrame(ball){
    for(const sign of [-1,1]){
        if(Math.abs(ball.x-sign*43.5)>R+.22)continue;
        for(const z of [-9,9])staticBox(sign*43.5,3.5,z,.2,3.5,.2);
        staticBox(sign*43.5,7,0,.2,.2,9.2);
    }
    function staticBox(x,y,z,hx,hy,hz){const contact=sphereBox(ball,x,y,z,hx,hy,hz);if(!contact)return;const {nx,ny,nz,depth}=contact;ball.x+=nx*(depth+.001);ball.y+=ny*(depth+.001);ball.z+=nz*(depth+.001);const v=ball.vx*nx+ball.vy*ny+ball.vz*nz;if(v<0){ball.vx-=1.7*v*nx;ball.vy-=1.7*v*ny;ball.vz-=1.7*v*nz;}}
}
const api={CAR,R,carBounds,carContact,resolveCars,resolveCarBall,sphereBox,goalFrame};if(typeof module!=='undefined')module.exports=api;else root.Collision=api;
})(typeof globalThis!=='undefined'?globalThis:this);
