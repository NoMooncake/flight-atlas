'use strict';
const $=id=>document.getElementById(id);
let map,data,selected=null,routeLayers=[],airportsLayer,waypointsLayer;
const palette=['#b56b12','#00868c','#7350b2'];
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const coordinates=f=>f.points.map(p=>[p.lat,p.lng]);
const fit=points=>{const size=map.getSize(),compact=size.y<450||size.x<500;map.fitBounds(L.latLngBounds(points),{paddingTopLeft:compact?[24,58]:[45,80],paddingBottomRight:compact?[48,90]:[65,115],maxZoom:9,animate:false});};
function mode(id){['overview','world'].forEach(k=>$(k).classList.toggle('active',k===id));}
function selectFlight(id){
 selected=id;document.querySelectorAll('.flight').forEach(b=>{b.classList.toggle('selected',b.dataset.id===id);b.setAttribute('aria-pressed',String(b.dataset.id===id));});
 const f=data.flights.find(f=>f.id===id);$('route-details').hidden=!f;$('route-details').open=false;
 $('detail-caption').textContent=f?`航段 ${String(data.flights.indexOf(f)+1).padStart(2,'0')}`:'旅程进度';
 $('detail-count').textContent=f?`${f.points.length} 个航点`:`${String(data.flights.length).padStart(2,'0')} / 已抵达`;
 $('detail-title').textContent=f?`${f.fromCity} → ${f.toCity}`:`此刻，${data.flights.at(-1).toCity}。`;
 $('detail-description').textContent=f?`${f.from} / ${f.departureRunway} → ${f.to} / ${f.arrivalRunway} · 航路约 ${f.distanceNm.toLocaleString()} 海里`:[data.flights[0].fromCity,...data.flights.map(f=>f.toCity)].join(' → ');
 $('route-notes').textContent=f?f.notes.join(' '):'';
 if(f){$('raw-route').textContent=f.route;$('waypoint-chain').textContent=f.points.map(p=>p.name).join(' → ');mode('flight');fit(coordinates(f));}
 routeLayers.forEach(({layer,flight,halo})=>{const active=!selected||selected===flight;layer.setStyle({opacity:active?(halo?.85:1):.24,weight:halo?7:(selected===flight?4:3)});if(selected===flight)layer.bringToFront();});updateLabels();
}
function renderList(){
 document.querySelector('.intro .eyebrow').textContent=`我的世界航迹 / 001—${String(data.flights.length).padStart(3,'0')}`;
 $('flight-count').textContent=data.flights.length;$('airport-count').textContent=data.airports.length;$('total-distance').textContent=data.flights.reduce((s,f)=>s+f.distanceNm,0).toLocaleString();
 data.flights.forEach((f,i)=>{const b=document.createElement('button');b.type='button';b.className='flight';b.dataset.id=f.id;b.style.setProperty('--flight-color',f.color);b.setAttribute('aria-pressed','false');
 b.innerHTML=`<span class="number">${String(i+1).padStart(2,'0')}</span><span><span class="city-pair">${esc(f.fromCity)}<span class="arrow">→</span>${esc(f.toCity)}</span><span class="route-airports" style="display:block">${esc(f.from)} — ${esc(f.to)}</span><span class="metadata"><span>${esc(f.date.replaceAll('-','.'))}</span><span>约 ${f.distanceNm} 海里</span></span></span><span class="chevron">›</span>`;b.onclick=()=>selectFlight(f.id);$('flights').append(b);});
}
function updateLabels(){
 if(!map||!data)return;airportsLayer.clearLayers();waypointsLayer.clearLayers();const zoom=map.getZoom(),occupied=[];
 // Place fixed-size labels in projected screen space, with collision checks.
 const place=(ll,text,isAirport)=>{if(!map.getBounds().contains(ll))return null;const p=map.latLngToContainerPoint(ll),w=text.length*(isAirport?9:7)+16,h=24;
 for(const dir of ['right','left','top','bottom']){const x=dir==='right'?p.x+12:dir==='left'?p.x-w-12:p.x-w/2,y=dir==='top'?p.y-h-12:dir==='bottom'?p.y+12:p.y-h/2;
 const r={x,y,w,h};if(x<4||y<70||x+w>map.getSize().x-8||y+h>map.getSize().y-100)continue;
 if(occupied.some(o=>r.x<o.x+o.w+8&&r.x+r.w+8>o.x&&r.y<o.y+o.h+6&&r.y+r.h+6>o.y))continue;occupied.push(r);return dir;}return null;};
 data.airports.forEach(a=>{const related=data.flights.find(f=>f.to===a.name)||data.flights.find(f=>f.from===a.name),city=data.flights.find(f=>f.to===a.name)?.toCity||data.flights.find(f=>f.from===a.name)?.fromCity||a.title,text=`${city} · ${a.name}`,ll=[a.lat,a.lng];
 const marker=L.circleMarker(ll,{radius:5,color:'#263c43',weight:2,fillColor:'#fff',fillOpacity:1,pane:'airports'}).addTo(airportsLayer),direction=zoom>=4?place(ll,text,true):null;
 marker.bindTooltip(esc(text),{permanent:!!direction,direction:direction||'auto',className:'airport-tooltip'});marker.on('click',()=>selectFlight(related.id));});
 if(!$('show-waypoints').checked)return;const seen=new Set();
 for(const f of data.flights.filter(f=>!selected||selected===f.id))for(const p of f.points){const key=p.name+':'+p.lat+':'+p.lng;if(seen.has(key)||p.name.startsWith('RW'))continue;seen.add(key);const ll=[p.lat,p.lng];
 const marker=L.circleMarker(ll,{radius:zoom<7?2.5:3.5,color:f.mapColor,weight:1.4,fillColor:'#fff',fillOpacity:1}).addTo(waypointsLayer),direction=zoom>=6?place(ll,p.name,false):null;
 marker.bindTooltip(esc(p.name),{permanent:!!direction,direction:direction||'auto',className:'waypoint-tooltip'});marker.bindPopup(`<strong>${esc(p.name)}</strong><br>${esc(p.via)}<br>${p.lat.toFixed(4)}°, ${p.lng.toFixed(4)}°`);}
}
function drawRoutes(){for(const f of data.flights)for(let i=1;i<f.points.length;i++){const a=f.points[i-1],b=f.points[i],ll=[[a.lat,a.lng],[b.lat,b.lng]];
 const halo=L.polyline(ll,{color:'#fff',weight:7,opacity:.85,interactive:false,lineCap:'round',pane:'routeHalo'}).addTo(map),line=L.polyline(ll,{color:f.mapColor,weight:3,opacity:1,dashArray:b.approxFromPrevious?'5 7':null,lineCap:'round',pane:'routes'}).addTo(map);
 line.bindTooltip(`${esc(f.fromCity)} → ${esc(f.toCity)}<br>${esc(a.name)} → ${esc(b.name)}${b.approxFromPrevious?' · 示意连接':''}`,{sticky:true});line.on('click',()=>selectFlight(f.id));routeLayers.push({layer:halo,flight:f.id,halo:true},{layer:line,flight:f.id,halo:false});}}
async function init(){try{
 const response=await fetch('./routes.json');if(!response.ok)throw Error('Route data unavailable');data=await response.json();data.flights.forEach((f,i)=>f.mapColor=palette[i%palette.length]);renderList();
 map=L.map('map',{zoomControl:false,zoomAnimation:false,fadeAnimation:false,minZoom:2,maxZoom:18,zoomSnap:1,worldCopyJump:false,maxBounds:[[-85,-180],[85,180]],maxBoundsViscosity:1,attributionControl:true});
 for(const [name,z] of [['routeHalo',410],['routes',420],['airports',440]])map.createPane(name).style.zIndex=z;
 airportsLayer=L.layerGroup().addTo(map);waypointsLayer=L.layerGroup().addTo(map);const root='https://server.arcgisonline.com/ArcGIS/rest/services/';
 // Colored regional relief at z2–11; native detailed topography at z12–18.
 const terrain=L.tileLayer(root+'NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',{minZoom:2,maxZoom:11,maxNativeZoom:11,noWrap:true,attribution:'© <a href="https://www.arcgis.com/home/item.html?id=b9b1b422198944fbbd5250b3241691b6" target="_blank">National Geographic, Esri</a> · Garmin, HERE, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, increment P'});
 const detail=L.tileLayer(root+'World_Topo_Map/MapServer/tile/{z}/{y}/{x}',{minZoom:12,maxZoom:18,maxNativeZoom:18,noWrap:true,attribution:'© <a href="https://www.arcgis.com/home/item.html?id=30e5fe3149c34df1ba922e6f5bbf808f" target="_blank">Esri & contributors</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'});
 let successfulTiles=0,failedTiles=0;[terrain,detail].forEach(layer=>{layer.on('tileload',()=>{successfulTiles++;$('loading').hidden=true;$('error').hidden=true;});layer.on('tileerror',()=>{failedTiles++;if(failedTiles>=3){$('loading').hidden=true;$('error').hidden=false;$('error').textContent='部分底图未能加载，请检查网络或稍后刷新。航程记录已保留。';}});layer.on('loading',()=>{failedTiles=0;});});
 function baseForZoom(){const detailed=map.getZoom()>=12,add=detailed?detail:terrain,remove=detailed?terrain:detail;if(map.hasLayer(remove))map.removeLayer(remove);if(!map.hasLayer(add))add.addTo(map);$('map-level').textContent=detailed?'城市地形':'地形 · 国家边界 · 城市';}
 map.on('zoomend',baseForZoom);map.on('zoomend moveend',updateLabels);L.control.scale({imperial:false,position:'bottomleft',maxWidth:130}).addTo(map);
 drawRoutes();fit(data.flights.flatMap(coordinates));baseForZoom();selectFlight(null);
 $('overview').onclick=()=>{selectFlight(null);mode('overview');fit(data.flights.flatMap(coordinates));};$('world').onclick=()=>{selectFlight(null);mode('world');map.fitBounds([[-60,-170],[75,175]],{padding:[15,65],animate:false});};
 $('zoom-in').onclick=()=>map.zoomIn();$('zoom-out').onclick=()=>map.zoomOut();$('show-waypoints').onchange=updateLabels;
 map.on('zoomend',()=>{$('zoom-in').disabled=map.getZoom()>=18;$('zoom-out').disabled=map.getZoom()<=2;});new ResizeObserver(()=>{map.invalidateSize({pan:false});updateLabels();}).observe($('map'));
 setTimeout(()=>{if(!successfulTiles){$('loading').hidden=true;$('error').hidden=false;}},15000);
 }catch(error){console.error(error);$('loading').hidden=true;$('error').hidden=false;}}
init();
