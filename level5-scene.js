/* Stacie's river: local Three.js renderer. Gameplay remains in level5.html. */
(function(){
'use strict';
const T=window.THREE,api=window.__RAFT,canvas=document.getElementById('scene');
if(!T){document.getElementById('description').textContent='The 3D renderer could not load. Reload the page to try again.';return}
let renderer;try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'})}catch(e){document.getElementById('description').textContent='This level needs WebGL. Please open it in a browser with hardware acceleration enabled.';return}
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
const scene=new T.Scene();scene.background=new T.Color('#b8cfce');scene.fog=new T.FogExp2('#c2b7a1',.00068);
const FALL=api.fall;const riverY=d=>d>FALL.at?-FALL.drop:0;
const camera=new T.PerspectiveCamera(62,1,1,6500);
scene.add(new T.HemisphereLight('#d0eeff','#9b4e28',2));
const sun=new T.DirectionalLight('#fff0c8',3.2);sun.position.set(-350,650,200);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-330,right:330,top:400,bottom:-400,near:1,far:1600});sun.shadow.bias=-.0007;sun.shadow.normalBias=1.2;scene.add(sun);scene.add(sun.target);
const mat=(color,roughness=.85)=>new T.MeshStandardMaterial({color,roughness});
const sandstone=['#b76c43','#c88755','#9e5138','#d79d68','#ae6544','#e0ab75'].map(c=>mat(c));
// Fine sandstone grain and erosion seams, generated once and kept on the GPU.
const grainCanvas=document.createElement('canvas');grainCanvas.width=256;grainCanvas.height=256;const grain=grainCanvas.getContext('2d');let seed=51;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}const pixels=grain.createImageData(256,256);for(let y=0;y<256;y++)for(let x=0;x<256;x++){const v=150+random()*55+Math.sin(y*.22+Math.sin(x*.024)*1.6)*18+Math.sin(y*1.2)*8;const i=(y*256+x)*4;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;pixels.data[i+3]=255}grain.putImageData(pixels,0,0);const stoneTexture=new T.CanvasTexture(grainCanvas);stoneTexture.wrapS=stoneTexture.wrapT=T.RepeatWrapping;stoneTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
const dark=mat('#253d3e'),skin=mat('#e4a978'),hair=mat('#623721'),jacket=mat('#bd4b50'),yellow=mat('#eecb7f'),orange=mat('#ef9533',.4),ropeMat=mat('#eddfb2');
function center(d){return 210+38*Math.sin(d/710)+17*Math.sin(d/293)}function width(d){return 254-18*Math.sin(d/523)}function bank(d,s){return center(d)+s*width(d)/2}
function mesh(geo,m,parent=scene){const o=new T.Mesh(geo,m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function ell(parent,m,x,y,z,rx,ry,rz){const o=mesh(new T.SphereGeometry(1,20,14),m,parent);o.position.set(x,y,z);o.scale.set(rx,ry,rz);return o}
function rod(parent,m,a,b,r=2){const dir=new T.Vector3().subVectors(new T.Vector3(...b),new T.Vector3(...a));const o=mesh(new T.CylinderGeometry(r,r,dir.length(),10),m,parent);o.position.copy(new T.Vector3(...a).add(new T.Vector3(...b)).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());return o}
function ribbon(side,tier){const verts=[],colors=[],indices=[],uvs=[],col=new T.Color();const offsets=[0,14,27,55,95,160,260,400],heights=[0,5,42,90,150,230,320,430];for(let i=0;i<=530;i++){const d=i*28-400;for(let j=0;j<2;j++){let k=tier+j,noise=Math.sin(d*.012+side)*8+Math.sin(d*.047)*4;const x=bank(d,side)+side*(offsets[k]+(k?noise*(k*.4):0));const y=heights[k]+(k>1?(Math.sin(d*.005+k)*13+Math.sin(d*.023)*7)*k*.35:0);verts.push(x,y-FALL.drop*T.MathUtils.smoothstep(d,FALL.at-10,FALL.at+60),-d);uvs.push(d/95,y/60);col.set(sandstone[tier%6].color);col.multiplyScalar(.88+.12*Math.sin(i*.8+tier));colors.push(col.r,col.g,col.b)}if(i<530){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2)}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();const material=sandstone[tier%6].clone();material.color.set('#ffffff');material.vertexColors=true;material.bumpMap=stoneTexture;material.bumpScale=2.1;material.roughnessMap=stoneTexture;material.side=T.DoubleSide;mesh(g,material);}
for(const side of [-1,1])for(let tier=0;tier<7;tier++)ribbon(side,tier);
const waterUniforms={time:{value:0},raft:{value:new T.Vector2()},speed:{value:0}};
const waterMat=new T.ShaderMaterial({uniforms:waterUniforms,vertexShader:`varying vec3 world; uniform float time; void main(){vec3 p=position;p.y+=sin(p.z*.075+time*2.8)*.55+sin(p.x*.13+p.z*.027-time*1.8)*.4;world=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`varying vec3 world; uniform float time; uniform vec2 raft; uniform float speed; void main(){float wave=sin(world.z*.21+sin(world.x*.12)*2.+time*4.)*sin(world.x*.22-world.z*.045+time);float broad=sin(world.x*.04+world.z*.018+time*.6);vec3 col=mix(vec3(.035,.22,.23),vec3(.12,.43,.40),broad*.5+.5);float shine=pow(max(0.,wave),16.);col+=vec3(.65,.78,.59)*shine*.52;vec2 rel=vec2(world.x,world.z)-raft;float wake=exp(-abs(abs(rel.x)-max(0.,rel.y)*.22-18.)*.32)*step(0.,rel.y)*exp(-rel.y*.013);col=mix(col,vec3(.7,.84,.72),wake*(.38+speed*.001));float fog=1.-exp(-length(cameraPosition-world)*.00068);gl_FragColor=vec4(mix(col,vec3(.76,.72,.63),fog),1.);}`});
function waterSection(start,end,y){const g=new T.PlaneGeometry(1400,end-start,35,Math.ceil((end-start)/24));g.rotateX(-Math.PI/2);g.translate(210,y-1,-(start+end)/2);const o=mesh(g,waterMat);o.castShadow=false;}
waterSection(-1000,FALL.at,0);waterSection(FALL.at,15000,-FALL.drop);
// The falling sheet is a real vertical surface joining the two river elevations.
const fallUniforms={time:{value:0}};
const fallMat=new T.ShaderMaterial({side:T.DoubleSide,uniforms:fallUniforms,vertexShader:`varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.z+=sin(p.x*.25)*2.;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`varying vec2 vUv;uniform float time;void main(){float streak=sin(vUv.x*210.+sin(vUv.y*19.+time*7.))*0.5+0.5;float rush=sin(vUv.y*80.+time*18.+vUv.x*20.)*.5+.5;vec3 col=mix(vec3(.12,.47,.46),vec3(.87,.97,.88),pow(streak,3.)*.7+rush*.2);gl_FragColor=vec4(col,1.);}`});
const waterfall=mesh(new T.PlaneGeometry(width(FALL.at)+14,FALL.drop,50,32),fallMat);waterfall.position.set(center(FALL.at),-FALL.drop/2,-FALL.at);waterfall.castShadow=false;
const foamMat=new T.MeshBasicMaterial({color:'#d8f4e7',transparent:true,opacity:.66,depthWrite:false});
const lip=ell(scene,foamMat,center(FALL.at),0,-FALL.at,width(FALL.at)/2,2.5,9);
const pool=ell(scene,foamMat,center(FALL.at),-FALL.drop+1,-FALL.at-40,width(FALL.at)*.6,1.2,70);
const mistCanvas=document.createElement('canvas');mistCanvas.width=mistCanvas.height=32;const mistCtx=mistCanvas.getContext('2d'),mistGradient=mistCtx.createRadialGradient(16,16,0,16,16,16);mistGradient.addColorStop(0,'rgba(255,255,255,1)');mistGradient.addColorStop(1,'rgba(255,255,255,0)');mistCtx.fillStyle=mistGradient;mistCtx.fillRect(0,0,32,32);const mistTexture=new T.CanvasTexture(mistCanvas);
const sprayGeometry=new T.BufferGeometry(),sprayPositions=new Float32Array(180*3);sprayGeometry.setAttribute('position',new T.BufferAttribute(sprayPositions,3));const spray=new T.Points(sprayGeometry,new T.PointsMaterial({color:'#e9fff5',map:mistTexture,size:8,transparent:true,opacity:.55,depthWrite:false}));spray.frustumCulled=false;scene.add(spray);
const raft=new T.Group();scene.add(raft);
// A continuous inflated oval tube, with a recessed floor and tied-down bow bag.
const tube=new T.TorusGeometry(17,5.5,14,64);tube.rotateX(Math.PI/2);const hull=mesh(tube,orange,raft);hull.scale.set(1,1,1.8);hull.position.y=7;
ell(raft,dark,0,5,0,15,3,28);ell(raft,mat('#e4ad45'),0,7,-27,15,4,9);ell(raft,mat('#66866e'),0,13,-22,11,7,8);
rod(raft,ropeMat,[-9,18,-27],[9,18,-18],.7);rod(raft,ropeMat,[9,18,-27],[-9,18,-18],.7);
// Stacie faces downstream; the camera sits just behind her right shoulder.
const stacie=new T.Group();raft.add(stacie);
ell(stacie,dark,-5,12,-9,4,4,13);ell(stacie,dark,5,12,-9,4,4,13);
ell(stacie,jacket,0,24,5,10,13,7);rod(stacie,orange,[-7,18,11],[7,18,11],1.6);rod(stacie,orange,[-7,29,11],[7,29,11],1.6);
ell(stacie,skin,0,42,4,6.3,8,6);ell(stacie,hair,0,45,6,7,6.8,6.5);ell(stacie,hair,3,37,12,3.2,10,3.5);
ell(stacie,yellow,0,48,4,11,1.5,10);ell(stacie,yellow,0,51,4,6.5,3.4,6);
const paddles={};for(const side of ['left','right']){const sign=side==='left'?-1:1,g=new T.Group();raft.add(g);g.position.set(sign*7,27,3);rod(g,skin,[0,0,0],[sign*8,-4,-3],2.4);rod(g,ropeMat,[sign*8,-4,-3],[sign*27,-25,-3],1.1);ell(g,mat('#e6dba9'),sign*27,-27,-3,4.5,10,1.5);paddles[side]=g}
const decor=new T.Group();scene.add(decor);let previous=null,obstacleMeshes=[],people=[];
function disposeGroup(){for(const o of [...decor.children]){o.traverse(n=>{if(n.geometry)n.geometry.dispose()});decor.remove(o)}obstacleMeshes=[];people=[]}
function createMan(m){const root=new T.Group();root.position.set(m.x,24+riverY(m.d),-m.d);decor.add(root);const body=new T.Group();root.add(body);rod(body,dark,[-3,0,0],[-3,14,0],2);rod(body,dark,[3,0,0],[3,14,0],2);ell(body,yellow,0,22,0,6,9,4);ell(body,skin,0,35,0,4,5,4);ell(body,yellow,0,39,0,7,1,6);ell(body,yellow,0,41,0,4,2,4);rod(body,skin,[-5,27,0],[-10,19,0],1.8);const arm=rod(body,skin,[5,27,0],[10,35,0],1.8);root.userData.man=m;people.push({root,body,arm,m});return root}
function build(){disposeGroup();for(const o of api.objects()){const g=new T.Group();g.position.set(o.x,riverY(o.d),-o.d);decor.add(g);if(o.type==='log'){const log=rod(g,mat('#725039'),[-36,8,0],[36,8,0],7);log.rotation.y=.15;rod(g,mat('#8c6c45'),[8,8,0],[19,19,-4],3)}else{const rock=mesh(new T.DodecahedronGeometry(o.r,1),mat('#777966'),g);rock.scale.set(1,.68,.85);rock.position.y=o.r*.3;rock.rotation.set(.15,o.d,.25)}obstacleMeshes.push({g,o})}api.men().forEach(createMan);}
const projectile=ell(scene,mat('#aaa58a'),0,-100,0,3,3,3);projectile.castShadow=true;
const starMat=new T.MeshBasicMaterial({color:'#ffdf6a'});const stars=[];for(let i=0;i<6;i++){const star=mesh(new T.OctahedronGeometry(1.5),starMat);stars.push(star)}
const raycaster=new T.Raycaster();window.__pickShore=(x,y)=>{raycaster.setFromCamera(new T.Vector2(x*2-1,1-y*2),camera);const hits=raycaster.intersectObjects(people.filter(p=>!p.m.down&&!p.m.targeted).map(p=>p.root),true);if(hits.length){let o=hits[0].object;while(o&&!o.userData.man)o=o.parent;return o&&o.userData.man}return null};
let cw=0,ch=0;const look=new T.Vector3();
window.__renderRaft=function(){const s=api.state();if(previous!==s){previous=s;build()}const rect=canvas.getBoundingClientRect();if(rect.width!==cw||rect.height!==ch){cw=rect.width;ch=rect.height;renderer.setSize(cw,ch,false);camera.aspect=cw/ch;camera.updateProjectionMatrix()}
fallUniforms.time.value=s.time;
for(let i=0;i<180;i++){const p=((s.time*.5+i*.037)%1),j=i*3;sprayPositions[j]=center(FALL.at)+Math.sin(i*13.7)*width(FALL.at)*.55;sprayPositions[j+1]=-FALL.drop+Math.sin(p*Math.PI)*(18+(i%7)*3);sprayPositions[j+2]=-FALL.at-10-p*110-(i%9)*2;if(i>110&&s.fallTime>3.5&&s.fallTime<4.6){const burst=(s.fallTime-3.5)/1.1,angle=i*2.4;sprayPositions[j]=s.x+Math.cos(angle)*(18+burst*65);sprayPositions[j+1]=-FALL.drop+Math.sin(burst*Math.PI)*(25+i%17);sprayPositions[j+2]=-s.d+Math.sin(angle)*(18+burst*65);}}sprayGeometry.attributes.position.needsUpdate=true;
const cinematic=!s.waterfallDone&&(api.mode()==='cinematic'||(api.mode()==='pause'&&s.fallTime>0));const elevation=cinematic?s.fallY:riverY(s.d);
waterUniforms.time.value=s.time*s.current;waterUniforms.raft.value.set(s.x,-s.d);waterUniforms.speed.value=s.speed;
raft.position.set(s.x,elevation+Math.sin(s.time*2.5)*.6,-s.d);raft.rotation.set(Math.sin(s.time*2)*.012,-s.angle,Math.sin(s.time*2.7)*.018+s.angle*.035);
for(const side of ['left','right']){const p=api.input()[side],g=paddles[side],sign=side==='left'?-1:1;g.rotation.x=p.down&&p.time>=.22?-.48:Math.sin(p.stroke/.3*Math.PI)*.9;g.rotation.z=sign*(p.down?-.12:.08)}
camera.position.set(s.x+15,elevation+63+Math.sin(s.time*1.4)*.25,-s.d+108);look.set(s.x+Math.sin(s.angle)*50,elevation+19,-s.d-210);
if(cinematic){const t=s.fallTime;const normalPos=camera.position.clone(),normalLook=look.clone();
// Track from within the canyon, beside and downstream of the falling raft.
const cinemaPos=new T.Vector3(center(FALL.at)+90,elevation+82,-s.d-175);
const cinemaLook=new T.Vector3(s.x,elevation+18,-s.d);
const blend=t<.8?T.MathUtils.smoothstep(t,0,.8):t>4.8?1-T.MathUtils.smoothstep(t,4.8,6):1;
camera.position.copy(normalPos).lerp(cinemaPos,blend);look.copy(normalLook).lerp(cinemaLook,blend);
raft.rotation.x=t<1.5?-.12*T.MathUtils.smoothstep(t,.8,1.5):t<3.5?-.9*Math.sin((t-1.5)/2*Math.PI):Math.sin((t-3.5)*7)*.16*Math.max(0,1-(t-3.5)/2.5);
}
camera.lookAt(look);
sun.position.set(s.x-350,650+elevation,-s.d+200);sun.target.position.set(s.x,elevation,-s.d-140);
for(const p of people){p.body.rotation.z=p.m.down?Math.PI/2:0;p.body.position.y=p.m.down?4:0;p.arm.rotation.z=p.m.down?0:Math.sin(s.time*5)*.15;}
const thrown=api.rocks()[0];projectile.visible=!!thrown;if(thrown){const t=Math.min(1,thrown.t/.5);projectile.position.set(thrown.x+(thrown.m.x-thrown.x)*t,35+riverY(thrown.d)+(24+riverY(thrown.m.d)-riverY(thrown.d))*t+Math.sin(t*Math.PI)*45,-(thrown.d+(thrown.m.d-thrown.d)*t));}
const knocked=api.men().find(m=>m.down&&m.speech>0);stars.forEach((o,i)=>{o.visible=!!knocked;if(knocked)o.position.set(knocked.x+Math.cos(s.time*4+i)*9,35+riverY(knocked.d)+Math.sin(s.time*3+i)*3,-knocked.d+Math.sin(s.time*4+i)*7)});
const speech=document.getElementById('speech'),m=api.activeMan();if(api.mode()==='play'&&m&&m.speech>0){const p=new T.Vector3(m.x,74+riverY(m.d),-m.d).project(camera);speech.hidden=p.z>1||Math.abs(p.x)>1.1||Math.abs(p.y)>1; speech.textContent=m.down?'…':m.text;speech.style.left=Math.max(3,Math.min(48,(p.x+1)*50-20))+'%';speech.style.top=Math.max(18,Math.min(70,(1-p.y)*50-10))+'%'}else speech.hidden=true;
renderer.render(scene,camera);
};
})();
