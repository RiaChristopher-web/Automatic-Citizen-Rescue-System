// ACRS V4 - Complete Interactive CPS Demo
const C=[25.2048,55.2708];
const shelters=[],stations=[],citizens=[],responders=[],sensors=[],roads=[];
let cm=[],sm=[],tm=[],rm=[],route=null,zone=null,incident=null,filter="all";
let crowdMap=null,crowdLayers=[],trainMarkers=[],trainTimer=null,trainsRunning=true,extraTrains=0;
let roadVisible=true,lastSelectedCitizen=null,evacMarker=null,evacAnimation=null;

const map=L.map("map").setView(C,11.8);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(map);

function ico(e,c=""){return L.divIcon({className:"custom-marker",html:`<div class="marker ${c}">${e}</div>`,iconSize:[32,32],iconAnchor:[16,16]})}
function toast(s){let x=document.getElementById("toast");x.textContent=s;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),2200)}
function log(s){let x=document.getElementById("log"),t=new Date().toLocaleTimeString();x.innerHTML=`<div class="log"><time>${t}</time>${s}</div>`+x.innerHTML}
function nearest(p,a){return a.map(x=>({x,d:map.distance(p,[x.lat,x.lng])/1000})).sort((a,b)=>a.d-b.d)[0]}
function landPoint(i){
 const A=[[25.276,55.332,.06,.09],[25.245,55.285,.055,.10],[25.215,55.255,.05,.10],[25.18,55.235,.045,.095],[25.145,55.205,.04,.09],[25.115,55.185,.035,.08],[25.285,55.245,.045,.065],[25.255,55.22,.04,.06],[25.205,55.315,.05,.08],[25.125,55.38,.035,.055],[25.08,55.145,.025,.06]];
 let a=A[i%A.length],r=Math.floor(i/A.length);
 return [a[0]+((r*.0037)%a[2])*.72,a[1]+((i*.0061)%a[3])*.72]
}

// 40 land-based bunkers
const bn=["Al Safa","Downtown","Business Bay","Jumeirah","Al Wasl","Satwa","Karama","Oud Metha","Al Jaddaf","Festival City","Garhoud","Deira","Al Qusais","Al Nahda","Mirdif","Silicon Oasis","Barsha","Al Quoz","Umm Suqeim","Marina","Jebel Ali","Discovery Gardens","International City","Rashidiya","Muhaisnah","Dubai Hills","Al Khawaneej","Nad Al Sheba","DIFC","Palm","Mina","Creek","Business Bay East","Jumeirah South","Barsha South","Dubai Hills East","Mirdif West","Deira East","Al Quoz South","Marina South"];
bn.forEach((n,i)=>{let p=landPoint(i);let cap=220+(i*47)%330;shelters.push({id:i+1,name:n+" Bunker",lat:p[0],lng:p[1],capacity:cap,occupancy:Math.floor(cap*(.15+((i*7)%35)/100))})});

// 30 rail stations
const sc=[[25.253,55.364],[25.245,55.335],[25.238,55.305],[25.218,55.285],[25.205,55.27],[25.195,55.25],[25.183,55.235],[25.168,55.225],[25.15,55.215],[25.13,55.205],[25.27,55.3],[25.285,55.275],[25.3,55.25],[25.23,55.24],[25.255,55.22],[25.205,55.315],[25.18,55.3],[25.155,55.285],[25.14,55.265],[25.125,55.245],[25.225,55.33],[25.205,55.35],[25.185,55.34],[25.165,55.325],[25.145,55.305],[25.115,55.38],[25.135,55.36],[25.155,55.345],[25.175,55.33],[25.195,55.315]];
sc.forEach((p,i)=>stations.push({id:i+1,name:"Rail Station "+String(i+1).padStart(2,"0"),lat:p[0],lng:p[1],load:30+(i*11)%60,status:"NORMAL",line:""}));

// 300 citizens
for(let i=0;i<300;i++){let p=landPoint(i);citizens.push({id:i+1,name:"Citizen #"+String(i+1).padStart(3,"0"),lat:p[0],lng:p[1],status:"safe",priority:i%23===0,assigned:null,nearestRail:null,routeScore:null,gpsTrusted:true})}
for(let i=0;i<18;i++){let p=landPoint(i+4);responders.push({id:i+1,name:"Response Unit "+(i+1),lat:p[0],lng:p[1],status:"READY"})}
for(let i=0;i<180;i++){let p=landPoint(i+6);sensors.push({id:i+1,name:"IoT-"+String(i+1).padStart(4,"0"),lat:p[0],lng:p[1],value:30+i%8,status:"NORMAL",trusted:true})}

// road corridors
const rn=[[25.285,55.335],[25.255,55.315],[25.225,55.295],[25.195,55.275],[25.165,55.255],[25.135,55.235],[25.27,55.3],[25.24,55.28],[25.21,55.26],[25.18,55.24],[25.15,55.22],[25.205,55.315],[25.175,55.3],[25.145,55.285],[25.115,55.27],[25.205,55.35],[25.18,55.33],[25.155,55.31],[25.13,55.29]];
for(let i=0;i<rn.length-1;i++)roads.push({a:rn[i],b:rn[i+1],traffic:25+(i*17)%70});
for(let i=0;i<rn.length-4;i+=2)roads.push({a:rn[i],b:rn[i+4],traffic:20+(i*13)%75});

const metroLines=[
{id:"A",name:"Line A",emoji:"🔴",stations:[0,1,2,3,4,5,6,7,8,9]},
{id:"B",name:"Line B",emoji:"🔵",stations:[11,10,4,13,14,7,12]},
{id:"C",name:"Line C",emoji:"🟢",stations:[25,26,27,28,29,8,7,4,15,16]}];
metroLines.forEach(l=>l.stations.forEach(i=>stations[i].line+=(stations[i].line?", ":"")+l.name));
const trainState=metroLines.map((l,i)=>({line:i,segment:0,t:.15*i,direction:1}));

function renderRoads(){
 roadLayers.forEach(x=>map.removeLayer(x));roadLayers=[];
 if(!roadVisible)return;
 roads.forEach(r=>{let col=r.traffic>80?"#e84d5b":r.traffic>60?"#f0a43c":"#36d49a";let l=L.polyline([r.a,r.b],{weight:5,opacity:.65,color:col,dashArray:r.traffic>80?"10 7":""}).addTo(map);l.bindTooltip(`Traffic ${r.traffic}% • ${r.traffic>80?"BLOCKED":"OPEN"}`);roadLayers.push(l)})
}
let roadLayers=[];
function render(){
 [...cm,...sm,...tm,...rm].forEach(x=>map.removeLayer(x));cm=[];sm=[];tm=[];rm=[];
 if(document.getElementById("citizens").checked) citizens.filter(c=>filter==="all"||filter==="priority"&&c.priority||filter===c.status).forEach(c=>{
  let e=c.priority?"⭐":c.status==="danger"?"⚠️":c.status==="evacuating"?"🏃":"👤";
  let m=L.marker([c.lat,c.lng],{icon:ico(e),draggable:true}).addTo(map);m.bindTooltip(c.name);
  m.on("click",()=>{lastSelectedCitizen=c;show(c)});
  m.on("dragend",ev=>{let p=ev.target.getLatLng();c.lat=p.lat;c.lng=p.lng;lastSelectedCitizen=c;calculateRoute(c,true);render()});cm.push(m)
 });
 shelters.forEach(s=>{let m=L.marker([s.lat,s.lng],{icon:ico("🏠","bunker-marker")}).addTo(map);m.bindTooltip(`${s.name} • ${Math.round(s.occupancy/s.capacity*100)}% occupied`);m.on("click",()=>showS(s));sm.push(m)});
 stations.forEach(s=>{let m=L.marker([s.lat,s.lng],{icon:ico("🚆","rail-marker")}).addTo(map);m.bindTooltip(`${s.name} • crowd ${s.load}%`);m.on("click",()=>showT(s));tm.push(m)});
 responders.forEach(r=>{let m=L.marker([r.lat,r.lng],{icon:ico("🚑")}).addTo(map);m.on("click",()=>showR(r));rm.push(m)});
 renderRoads()
}
function calculateRoute(c,drag=false){
 let rail=nearest([c.lat,c.lng],stations);
 let options=shelters.map(s=>{
  let free=(1-s.occupancy/s.capacity)*100;
  let road=nearest([c.lat,c.lng],roads.map(r=>({lat:(r.a[0]+r.b[0])/2,lng:(r.a[1]+r.b[1])/2,traffic:r.traffic}))).x;
  let danger=(incident&&zone&&zone.getBounds().contains([s.lat,s.lng]))?100:0;
  let score=Math.max(0,100-rail.d*10-(100-free)*.35-(road.traffic||40)*.22-danger);
  return {s,free,score,traffic:road.traffic||40}
 }).sort((a,b)=>b.score-a.score);
 let b=options[0];if(route)map.removeLayer(route);
 route=L.polyline([[c.lat,c.lng],[rail.x.lat,rail.x.lng],[b.s.lat,b.s.lng]],{weight:6,dashArray:"12 8"}).addTo(map);
 c.assigned=b.s.name;c.nearestRail=rail.x.name;c.railDistance=rail.d.toFixed(2);c.routeScore=Math.round(b.score);
 document.getElementById("best").textContent=b.s.name;document.getElementById("confidence").textContent=Math.max(60,Math.min(99,Math.round(b.score)))+"%";
 document.getElementById("decision").innerHTML=`<b>Safest route for ${c.name}</b><br>🚆 ${rail.x.name} — ${rail.d.toFixed(2)} km<br>🏠 ${b.s.name} — ${Math.round(b.free)}% free<br>🛣 Road congestion — ${Math.round(b.traffic)}%<br>🧠 Decision score — ${Math.round(b.score)}/100<br>✓ Danger and capacity considered`;
 show(c);if(drag)toast(`Route mapped: ${c.name} → ${rail.x.name} → ${b.s.name}`)
}
function show(c){document.getElementById("entity").innerHTML=`<b>${c.name}</b><br>Status: ${c.status.toUpperCase()}<br>Priority: ${c.priority?"ASSISTANCE REQUIRED":"NORMAL"}<br>GPS: ${c.gpsTrusted?"VERIFIED":"UNTRUSTED"}<br>Nearest rail: ${c.nearestRail||"Drag to calculate"}<br>Assigned bunker: ${c.assigned||"—"}<br>Route score: ${c.routeScore??"—"}/100`}
function showS(s){document.getElementById("entity").innerHTML=`<b>🏠 ${s.name}</b><br>Capacity: ${s.capacity}<br>Occupancy: ${s.occupancy}<br>Available: ${Math.max(0,s.capacity-s.occupancy)}<br>Status: ${s.occupancy>=s.capacity?"FULL":s.occupancy/s.capacity>=.8?"NEAR CAPACITY":"OPEN"}`}
function showT(s){document.getElementById("entity").innerHTML=`<b>🚆 ${s.name}</b><br>Lines: ${s.line}<br>Crowd: ${s.load}%<br>Status: ${s.status}<br>Recommendation: ${s.load>80?"DEPLOY EXTRA TRAIN":"NORMAL FREQUENCY"}`}
function showR(r){document.getElementById("entity").innerHTML=`<b>🚑 ${r.name}</b><br>Status: ${r.status}<br>Response readiness: HIGH`}

function activateIncident(type){
 incident=type;let centers={fire:[25.205,55.27],flood:[25.25,55.30],chemical:[25.19,55.25],infra:[25.22,55.32]};let center=centers[type];
 if(zone)map.removeLayer(zone);zone=L.circle(center,{radius:type==="flood"?4200:2600,fillOpacity:.16,weight:2}).addTo(map);
 citizens.forEach(c=>{if(map.distance([c.lat,c.lng],center)<(type==="flood"?4200:2600))c.status="danger"});
 roads.forEach(r=>r.traffic=Math.min(99,r.traffic+20));stations.forEach(s=>s.load=Math.min(99,s.load+10));
 document.getElementById("system").textContent="EMERGENCY ACTIVE";document.getElementById("threat").textContent="CRITICAL";document.getElementById("nAlerts").textContent="1";
 log(`⚠️ ${type.toUpperCase()} incident detected and verified`);log("📡 Road, rail and shelter conditions recalculated");render();renderShelters();renderStations();stats();updatePhone()
}
function evacuate(){
 if(!incident){
  toast("⚠️ Activate an emergency first");
  log("⚠️ Evacuation requested but no emergency is active");
  return;
 }
 let c=lastSelectedCitizen||citizens.find(x=>x.status==="danger")||citizens[0];
 if(!c){toast("No citizen available");return;}
 calculateRoute(c);
 let rail=stations.find(x=>x.name===c.nearestRail);
 let sh=shelters.find(x=>x.name===c.assigned);
 if(!rail||!sh){toast("Route could not be calculated");return;}
 if(evacAnimation)cancelAnimationFrame(evacAnimation);
 if(evacMarker){map.removeLayer(evacMarker);evacMarker=null;}
 c.status="evacuating";
 document.getElementById("mstatus").textContent="EVACUATING";
 document.getElementById("evacuate").disabled=true;
 document.getElementById("evacuate").textContent="🚶 MOVING TO RAIL…";
 document.getElementById("s1").classList.add("current");
 document.getElementById("s2").classList.remove("current","done");
 render();stats();
 evacMarker=L.marker([c.lat,c.lng],{icon:ico("🏃","priority-marker"),zIndexOffset:1000}).addTo(map);
 evacMarker.bindTooltip(`${c.name} • LIVE EVACUATION`).openTooltip();
 log(`🚶 ${c.name} started evacuation → 🚆 ${c.nearestRail} → 🏠 ${c.assigned}`);
 toast(`🚨 LIVE: ${c.name} is evacuating`);
 animateEvacuation(c,rail,sh);
}
function animateEvacuation(c,rail,sh){
 const start=[c.lat,c.lng],mid=[rail.lat,rail.lng],end=[sh.lat,sh.lng];
 const duration1=2200,duration2=2600,t0=performance.now();
 function step(now){
  let elapsed=now-t0;
  let p=Math.min(1,elapsed/duration1);
  let lat=start[0]+(mid[0]-start[0])*p,lng=start[1]+(mid[1]-start[1])*p;
  c.lat=lat;c.lng=lng;
  if(evacMarker)evacMarker.setLatLng([lat,lng]);
  if(p<1){evacAnimation=requestAnimationFrame(step);return;}
  document.getElementById("evacuate").textContent="🚆 ON METRO → SHELTER…";
  document.getElementById("s1").classList.remove("current");
  document.getElementById("s1").classList.add("done");
  document.getElementById("s2").classList.add("current");
  log(`🚆 ${c.name} reached ${c.nearestRail} — boarding emergency metro`);
  const t1=performance.now();
  function step2(now2){
   let q=Math.min(1,(now2-t1)/duration2);
   let a=q*q*(3-2*q);
   let la=mid[0]+(end[0]-mid[0])*a,lo=mid[1]+(end[1]-mid[1])*a;
   c.lat=la;c.lng=lo;
   if(evacMarker)evacMarker.setLatLng([la,lo]);
   if(q<1){evacAnimation=requestAnimationFrame(step2);return;}
   let sh2=shelters.find(x=>x.name===c.assigned);
   if(sh2&&sh2.occupancy<sh2.capacity){
    sh2.occupancy++;c.status="shelter";
    document.getElementById("mstatus").textContent="SAFE — AT SHELTER";
    document.getElementById("s2").classList.remove("current");
    document.getElementById("s2").classList.add("done");
    log(`🏠 ${c.name} arrived safely at ${sh2.name}`);
    toast(`✓ ${c.name} reached safety`);
   }else{
    c.status="danger";
    document.getElementById("mstatus").textContent="REROUTING REQUIRED";
    log(`⚠️ ${c.name} could not enter assigned shelter — capacity reached`);
    toast("Shelter full — rerouting");
   }
   if(evacMarker){map.removeLayer(evacMarker);evacMarker=null;}
   document.getElementById("evacuate").disabled=false;
   document.getElementById("evacuate").textContent="START EVACUATION";
   render();renderShelters();renderStations();stats();updatePhone();
  }
  evacAnimation=requestAnimationFrame(step2);
 }
 evacAnimation=requestAnimationFrame(step);
}

function stats(){
 let r=citizens.filter(c=>["danger","evacuating","shelter"].includes(c.status)).length,s=citizens.filter(c=>c.status==="shelter").length;
 document.getElementById("nEvac").textContent=r?Math.round(s/r*100)+"%":"0%";document.getElementById("nShel").textContent=Math.round(shelters.filter(s=>s.occupancy<s.capacity).length/shelters.length*100)+"%";
 document.getElementById("nMetro").textContent=incident?"EVACUATION":"NORMAL";document.getElementById("nPriority").textContent=citizens.filter(c=>c.priority&&c.status!=="shelter").length;document.getElementById("nAlerts").textContent=incident?"1":"0"
}
function updatePhone(){
 let a=document.getElementById("alert"),b=document.getElementById("evacuate");if(!incident){a.className="safe";a.innerHTML="<div>✓</div><h2>You are safe</h2><p>No active emergency.</p>";b.disabled=true;return}
 a.className="emergency";a.innerHTML="<div>⚠️</div><h2>Emergency detected</h2><p>ACRS generated a location-aware route.</p>";b.disabled=false;let c=lastSelectedCitizen||citizens[0];calculateRoute(c);document.getElementById("mshel").textContent=c.assigned;document.getElementById("mdist").textContent=`Via ${c.nearestRail} • ${c.railDistance||""} km`;document.getElementById("mstatus").textContent="EVACUATION ADVISED"
}

// Planner
function setupCrowdMap(){if(crowdMap)return;crowdMap=L.map("crowdMap").setView(C,11.8);L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(crowdMap);drawPlanner();startTrains()}
function drawPlanner(){
 if(!crowdMap)return;crowdLayers.forEach(x=>crowdMap.removeLayer(x));crowdLayers=[];
 const hs=[["Deira",25.27,55.325,91,2100],["Marina",25.08,55.145,88,1900],["Downtown",25.205,55.27,82,1800],["Silicon Oasis",25.125,55.38,73,1700],["Business Bay",25.185,55.265,66,1500],["Jumeirah",25.215,55.25,54,1300]];
 hs.forEach(h=>{let x=L.circle([h[1],h[2]],{radius:h[4],fillOpacity:.2,weight:2}).addTo(crowdMap);x.bindTooltip(`${h[0]} • ${h[3]}% crowd`);crowdLayers.push(x)});
 metroLines.forEach(l=>{let x=L.polyline(l.stations.map(i=>[stations[i].lat,stations[i].lng]),{weight:6,opacity:.85}).addTo(crowdMap);x.bindTooltip(`${l.emoji} ${l.name}`);crowdLayers.push(x)});
 trainMarkers.forEach(x=>crowdMap.removeLayer(x));trainMarkers=[];
 trainState.forEach(t=>{let l=metroLines[t.line],a=stations[l.stations[t.segment]],b=stations[l.stations[Math.min(t.segment+1,l.stations.length-1)]],m=L.marker([a.lat+(b.lat-a.lat)*t.t,a.lng+(b.lng-a.lng)*t.t],{icon:ico("🚇","train-marker")}).addTo(crowdMap);m.bindTooltip(`${l.emoji} ${l.name} TRAIN`);trainMarkers.push(m)})
}
function recalculateMetro(){
 extraTrains=Math.max(extraTrains,2);document.getElementById("extraTrains").textContent=extraTrains;
 document.getElementById("routeDecision").innerHTML=`<b>Demand assessment complete.</b><br>🔴 Deira 91% • 🔴 Marina 88% • 🟠 Downtown 82%<br><br><b>Recommended:</b> Line A Airport-side ↔ Downtown ↔ Marina; Line B Deira ↔ Downtown ↔ Jumeirah; Line C Silicon Oasis ↔ Downtown ↔ Marina.<br><br>🔁 Interchanges reduce crowd pressure. Demand above 85% triggers extra trains.`;
 log("🧭 Crowd analysis complete — metro routes recalculated");toast("Metro routes recalculated");drawPlanner()
}
function startTrains(){trainTimer=setInterval(()=>{if(!trainsRunning)return;trainState.forEach(t=>{t.t+=.035;if(t.t>=1){t.t=0;t.segment+=t.direction;let n=metroLines[t.line].stations.length;if(t.segment>=n-1){t.segment=n-2;t.direction=-1}if(t.segment<=0){t.segment=0;t.direction=1}}});drawPlanner()},300)}

// Cyber
function clog(s){let x=document.getElementById("console");x.innerHTML+=`<div>${new Date().toLocaleTimeString()} — ${s}</div>`;x.scrollTop=x.scrollHeight}
function gpsAttack(){let c=citizens[Math.floor(Math.random()*citizens.length)];c.gpsTrusted=false;c.lat+=.08;c.lng+=.12;document.getElementById("gp").textContent="ANOMALY DETECTED";document.getElementById("secBadge").textContent="🟠 THREAT DETECTED";clog(`⚠ GPS spoofing detected for ${c.name}`);clog("→ Untrusted coordinate rejected");document.getElementById("attackImpact").innerHTML=`<b>Cyber → Physical:</b> ${c.name} was given a false GPS position; ACRS rejects it and restores trusted location.`;render();setTimeout(()=>{c.lat-=.08;c.lng-=.12;c.gpsTrusted=true;document.getElementById("gp").textContent="PROTECTED";document.getElementById("secBadge").textContent="🟢 SECURE";clog("✓ Trusted location restored");render()},1600)}
function sensorAttack(){let s=sensors[Math.floor(Math.random()*sensors.length)];s.value=99;s.trusted=false;s.status="ANOMALOUS";document.getElementById("sp").textContent="ANOMALY";clog(`⚠ False sensor data: ${s.name}=99%`);clog("→ Neighbouring readings cross-checked");document.getElementById("attackImpact").innerHTML=`<b>Sensor integrity:</b> ${s.name} quarantined while trusted neighbouring data is used.`;setTimeout(()=>{s.value=42;s.trusted=true;s.status="NORMAL";document.getElementById("sp").textContent="ACTIVE";clog("✓ Sensor restored")},1600)}
function ddosAttack(){document.getElementById("dp").textContent="MITIGATING";document.getElementById("secBadge").textContent="🟠 THREAT DETECTED";clog("⚠ Abnormal traffic spike");clog("→ Emergency traffic prioritised");document.getElementById("attackImpact").innerHTML="<b>Availability protection:</b> emergency control traffic is prioritised while attack traffic is rate-limited.";setTimeout(()=>{document.getElementById("dp").textContent="NORMAL";document.getElementById("secBadge").textContent="🟢 SECURE";clog("✓ DDoS contained")},1600)}

function resetSystem(){
 if(zone)map.removeLayer(zone);if(route)map.removeLayer(route);zone=null;route=null;incident=null;extraTrains=0;trainsRunning=true;
 citizens.forEach(c=>{c.status="safe";c.assigned=null;c.nearestRail=null;c.railDistance=null;c.routeScore=null;c.gpsTrusted=true});
 shelters.forEach((s,i)=>s.occupancy=Math.floor(s.capacity*(.15+((i*7)%35)/100)));stations.forEach((s,i)=>{s.load=30+(i*11)%60;s.status="NORMAL"});roads.forEach((r,i)=>r.traffic=25+(i*17)%70);
 document.getElementById("system").textContent="SYSTEM NORMAL";document.getElementById("threat").textContent="LOW";document.getElementById("best").textContent="—";document.getElementById("confidence").textContent="—";document.getElementById("decision").textContent="No emergency is active.";document.getElementById("extraTrains").textContent="0";document.getElementById("secBadge").textContent="🟢 SECURE";render();renderShelters();renderStations();stats();updatePhone();log("System reset — all services normal")
}
function fullScenario(){
 resetSystem();setTimeout(()=>activateIncident("flood"),300);setTimeout(recalculateMetro,1800);setTimeout(evacuate,3200);setTimeout(sensorAttack,5000);setTimeout(gpsAttack,6800);setTimeout(ddosAttack,8600);setTimeout(()=>log("✅ FULL SCENARIO COMPLETE — system stabilised"),10500);toast("Full scenario started")
}


function renderShelters(){
 const el=document.getElementById("shelterGrid");
 if(!el)return;
 el.innerHTML=shelters.map(s=>{
   const pct=Math.min(100,Math.round(s.occupancy/s.capacity*100));
   const free=Math.max(0,s.capacity-s.occupancy);
   const cls=pct>=90?"full":pct>=75?"warn":"";
   return `<div><h2>🏠 ${s.name}</h2><div class="capacity"><div class="fill ${cls}" style="width:${pct}%"></div></div><div class="meta"><span><b>${s.occupancy}/${s.capacity}</b> occupied (${pct}%)</span><span>${free} spaces free</span></div><div class="meta"><span>${pct>=100?"FULL":pct>=90?"NEAR CAPACITY":"ACCEPTING"}</span><span>Dynamic capacity</span></div></div>`;
 }).join("");
}
function renderStations(){
 const el=document.getElementById("stationGrid");
 if(!el)return;
 el.innerHTML=stations.map(s=>{
   const pct=Math.min(100,Math.round(s.load));
   const cls=pct>=85?"full":pct>=70?"warn":"";
   return `<div><h2>🚆 ${s.name}</h2><div class="capacity"><div class="fill ${cls}" style="width:${pct}%"></div></div><div class="meta"><span><b>${pct}%</b> passenger occupancy</span><span>${s.status}</span></div><div class="meta"><span>${s.line||"Metro network"}</span><span>${pct>=85?"ADD TRAIN":"NORMAL"}</span></div></div>`;
 }).join("");
}

// UI
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.getElementById(b.dataset.v).classList.add("active");if(b.dataset.v==="command")setTimeout(()=>map.invalidateSize(),100);if(b.dataset.v==="planner")setTimeout(()=>{setupCrowdMap();crowdMap.invalidateSize()},150);if(b.dataset.v==="citizen")updatePhone()});
document.getElementById("citizens").onchange=render;document.getElementById("roads").onchange=e=>{roadVisible=e.target.checked;renderRoads()};
document.querySelectorAll(".filters button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".filters button").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");filter=b.dataset.filter;render()});
document.getElementById("activate").onclick=()=>activateIncident(document.getElementById("incident").value);
document.getElementById("reset").onclick=resetSystem;document.getElementById("evacuate").onclick=evacuate;document.getElementById("scenarioBtn").onclick=fullScenario;
document.getElementById("recalcLines").onclick=()=>{setupCrowdMap();recalculateMetro()};document.getElementById("toggleTrains").onclick=()=>{trainsRunning=!trainsRunning;document.getElementById("toggleTrains").textContent=trainsRunning?"⏸ PAUSE TRAINS":"▶ RESUME TRAINS";document.getElementById("trainStatus").textContent=trainsRunning?"RUNNING":"PAUSED"};
document.getElementById("deployTrain").onclick=()=>{extraTrains++;document.getElementById("extraTrains").textContent=extraTrains;toast("Extra train deployed");drawPlanner()};
document.getElementById("gpsAttack").onclick=gpsAttack;document.getElementById("sensorAttack").onclick=sensorAttack;document.getElementById("ddosAttack").onclick=ddosAttack;
render();renderShelters();renderStations();stats();updatePhone();log("ACRS digital twin online — ready");
