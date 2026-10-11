'use strict';
const $ = id => document.getElementById(id);
const C = window.Cesium;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let viewer, data, selected = null;
let cameraMoving=false, settleTimer, lastHudUpdate=0;
const restingScale=Math.min(devicePixelRatio,1.25);
const routeEntities = [], airportEntities = [], waypointEntities = [];
const esc = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const position = p => C.Cartesian3.fromDegrees(p.lng, p.lat, 15);
function mode(id) {
  for (const key of ['overview','world']) {
    $(key).classList.toggle('active', key === id);
    $(key).setAttribute('aria-pressed', String(key === id));
  }
}
function message(text) { $('error').textContent = text; $('error').hidden = !text; }
function renderList() {
  document.querySelector('.intro .eyebrow').textContent = `我的世界航迹 / 001—${String(data.flights.length).padStart(3,'0')}`;
  $('flight-count').textContent = data.flights.length;
  $('airport-count').textContent = data.airports.length;
  $('total-distance').textContent = data.flights.reduce((s,f) => s + f.distanceNm, 0).toLocaleString();
  data.flights.forEach((f,i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'flight'; b.dataset.id = f.id;
    b.style.setProperty('--flight-color', f.color); b.setAttribute('aria-pressed','false');
    b.innerHTML = `<span class="number">${String(i+1).padStart(2,'0')}</span><span><span class="city-pair">${esc(f.fromCity)}<span class="arrow">→</span>${esc(f.toCity)}</span><span class="route-airports" style="display:block">${esc(f.from)} — ${esc(f.to)}</span><span class="metadata"><span>${esc(f.date.replaceAll('-','.'))}</span><span>约 ${f.distanceNm} 海里</span></span></span><span class="chevron">›</span>`;
    b.onclick = () => selectFlight(f.id); $('flights').append(b);
  });
}
function selectFlight(id) {
  selected = id;
  $('waypoint-card').hidden=true;
  document.querySelectorAll('.flight').forEach(b => {
    b.classList.toggle('selected', b.dataset.id === id);
    b.setAttribute('aria-pressed', String(b.dataset.id === id));
  });
  const f = data.flights.find(f => f.id === id);
  $('route-details').hidden = !f; $('route-details').open = false;
  $('detail-caption').textContent = f ? `航段 ${String(data.flights.indexOf(f)+1).padStart(2,'0')}` : '旅程进度';
  $('detail-count').textContent = f ? `${f.points.length} 个航点` : `${String(data.flights.length).padStart(2,'0')} / 已抵达`;
  $('detail-title').textContent = f ? `${f.fromCity} → ${f.toCity}` : `此刻，${data.flights.at(-1).toCity}。`;
  $('detail-description').textContent = f ? `${f.from} / ${f.departureRunway} → ${f.to} / ${f.arrivalRunway} · 航路约 ${f.distanceNm.toLocaleString()} 海里` : [data.flights[0].fromCity,...data.flights.map(f=>f.toCity)].join(' → ');
  $('route-notes').textContent = f ? f.notes.join(' ') : '';
  if (f) {
    $('raw-route').textContent = f.route;
    $('waypoint-chain').textContent = f.points.map(p=>p.name).join(' → ');
    mode('flight'); if (viewer) fitFlightPoints(f.points);
  }
  for (const item of routeEntities) {
    const active = !id || item.flightId === id;
    const color = C.Color.fromCssColorString(item.color).withAlpha(active ? 1 : .22);
    item.entity.polyline.width = id === item.flightId ? 4 : 3;
    item.entity.polyline.material = item.approx ? new C.PolylineDashMaterialProperty({color,dashLength:14}) : new C.PolylineOutlineMaterialProperty({color,outlineColor:C.Color.BLACK.withAlpha(.55),outlineWidth:1.5});
  }
  if (viewer) { updateLabels(); viewer.scene.requestRender(); }
}
function moveCamera(destination) {
  viewer.camera.cancelFlight();
  viewer.camera.flyTo({destination,orientation:{heading:0,pitch:-C.Math.PI_OVER_TWO,roll:0},duration:reducedMotion?0:1.2,complete:updateLabels});
}
function worldView() {
  selectFlight(null); mode('world');
  const last = data.flights.at(-1).points.at(-1);
  moveCamera(C.Cartesian3.fromDegrees(last.lng,last.lat,18000000));
}
function fitFlightPoints(points) {
  const rectangle = C.Rectangle.fromCartesianArray(points.map(position));
  let destination = viewer.camera.getRectangleCameraCoordinates(rectangle);
  const cartographic = C.Cartographic.fromCartesian(destination);
  // Leave room for fixed controls, including in narrow or short map panels.
  const h = viewer.canvas.clientHeight;
  cartographic.height = Math.max(cartographic.height * Math.max(1.3,h/Math.max(100,h-180)),150000);
  moveCamera(C.Cartesian3.fromRadians(cartographic.longitude,cartographic.latitude,cartographic.height));
}
function showOverview() {
  selectFlight(null); mode('overview'); fitFlightPoints(data.flights.flatMap(f=>f.points));
}
function label(text,airport) {
  return {text,font:airport?'12px "Microsoft YaHei", sans-serif':'11px Consolas, monospace',fillColor:C.Color.WHITE,outlineColor:C.Color.BLACK,outlineWidth:2,style:C.LabelStyle.FILL_AND_OUTLINE,showBackground:true,backgroundColor:C.Color.fromCssColorString('#10212ce6'),backgroundPadding:new C.Cartesian2(6,4),horizontalOrigin:C.HorizontalOrigin.LEFT,verticalOrigin:C.VerticalOrigin.CENTER,pixelOffset:new C.Cartesian2(12,0),disableDepthTestDistance:Number.POSITIVE_INFINITY,show:false};
}
function routeRuns(f) {
  const runs=[];
  for(let i=1;i<f.points.length;i++) {
    const approx=!!f.points[i].approxFromPrevious;
    const last=runs.at(-1);
    if(last&&last.approx===approx)last.points.push(f.points[i]);
    else runs.push({approx,points:[f.points[i-1],f.points[i]]});
  }
  return runs;
}
function drawRoutes() {
  for (const f of data.flights) {
    for (const run of routeRuns(f)) {
      const entity=viewer.entities.add({name:`${f.fromCity} → ${f.toCity}`,properties:{flightId:f.id},polyline:{positions:run.points.map(position),clampToGround:true,width:3,arcType:C.ArcType.GEODESIC,material:C.Color.fromCssColorString(f.color)}});
      routeEntities.push({entity,flightId:f.id,color:f.color,approx:run.approx});
    }
  }
  for (const a of data.airports) {
    const f=data.flights.find(f=>f.to===a.name)||data.flights.find(f=>f.from===a.name);
    const city=f.to===a.name?f.toCity:f.fromCity;
    const point=position(a),text=`${city} · ${a.name}`;
    const entity=viewer.entities.add({position:point,name:text,properties:{flightId:f.id},point:{pixelSize:9,color:C.Color.WHITE,outlineColor:C.Color.fromCssColorString('#162a36'),outlineWidth:2},label:label(text,true)});
    airportEntities.push({entity,point,text});
  }
  const seen=new Set();
  for (const f of data.flights) for (const p of f.points) {
    const key=`${f.id}:${p.name}:${p.lat}:${p.lng}`;
    if(seen.has(key)||p.name.startsWith('RW')||data.airports.some(a=>a.name===p.name))continue;
    seen.add(key);const point=position(p);
    const entity=viewer.entities.add({position:point,name:p.name,properties:{flightId:f.id,waypoint:p.name,via:p.via||'',lat:p.lat,lng:p.lng},show:false,point:{pixelSize:5,color:C.Color.fromCssColorString(f.color),outlineColor:C.Color.BLACK,outlineWidth:1},label:label(p.name,false)});
    waypointEntities.push({entity,point,text:p.name,flightId:f.id});
  }
}
function updateLabels() {
  if(!viewer)return;
  updateCameraReadout();
  // Points and routes keep moving with the globe; text is placed once it settles.
  if(cameraMoving)return;
  const scene=viewer.scene, canvas=viewer.canvas, occupied=[];
  const occluder=new C.EllipsoidalOccluder(C.Ellipsoid.WGS84,viewer.camera.positionWC);
  const altitude=viewer.camera.positionCartographic.height;
  const place=(item,airport)=>{
    const enabled=airport||($('show-waypoints').checked&&(!selected||selected===item.flightId));
    const visible=enabled&&occluder.isPointVisible(item.point);
    item.entity.show=visible;item.entity.label.show=false;
    if(!visible||altitude>(airport?32000000:1400000))return;
    const p=C.SceneTransforms.worldToWindowCoordinates(scene,item.point);
    if(!p)return;
    const w=Array.from(item.text).reduce((n,c)=>n+(c.charCodeAt(0)>255?12:7),0)+14,h=26;
    for(const direction of ['right','left','top','bottom']) {
      const x=direction==='right'?p.x+12:direction==='left'?p.x-w-12:p.x-w/2;
      const y=direction==='top'?p.y-h-12:direction==='bottom'?p.y+12:p.y-h/2;
      const r={x,y,w,h};
      if(x<8||y<70||x+w>canvas.clientWidth-10||y+h>canvas.clientHeight-95)continue;
      if(occupied.some(o=>x<o.x+o.w+8&&x+w+8>o.x&&y<o.y+o.h+5&&y+h+5>o.y))continue;
      occupied.push(r);item.entity.label.pixelOffset=new C.Cartesian2(x-p.x,y-p.y+h/2);item.entity.label.show=true;break;
    }
  };
  airportEntities.forEach(i=>place(i,true)); waypointEntities.forEach(i=>place(i,false));
  scene.requestRender();
}
function updateCameraReadout() {
  const altitude=viewer.camera.positionCartographic.height;
  const text=altitude>=1000000?`${(altitude/1000000).toFixed(1)} 千公里`: `${Math.round(altitude/1000).toLocaleString()} 公里`;
  if($('camera-distance').textContent!==text)$('camera-distance').textContent=text;
  $('zoom-in').disabled=altitude<=210; $('zoom-out').disabled=altitude>=39000000;
}
function beginCameraMotion() {
  clearTimeout(settleTimer);
  if(cameraMoving)return;
  cameraMoving=true;
  viewer.resolutionScale=.75;
  viewer.scene.globe.maximumScreenSpaceError=3;
  $('map').dataset.renderQuality='moving';
  for(const item of [...airportEntities,...waypointEntities])item.entity.label.show=false;
  viewer.scene.requestRender();
}
function endCameraMotion() {
  clearTimeout(settleTimer);
  settleTimer=setTimeout(()=>{
    cameraMoving=false;
    viewer.resolutionScale=restingScale;
    viewer.scene.globe.maximumScreenSpaceError=1.5;
    $('map').dataset.renderQuality='resting';
    updateLabels();
  },180);
}
function zoom(factor) {
  const camera=viewer.camera;camera.cancelFlight();
  const height=camera.positionCartographic.height;
  if(factor<1)camera.zoomIn(height*(1-factor));else camera.zoomOut(height*(factor-1));
  updateLabels();viewer.scene.requestRender();
}
async function loadImagery() {
  let config;
  try {
    const response=await fetch('./imagery-config.json',{cache:'no-cache'});
    if(!response.ok)throw Error('Missing imagery configuration');
    config=await response.json();
    if(!config.accessToken)throw Error('Missing imagery token');
    const provider=await C.IonImageryProvider.fromAssetId(config.assetId,{accessToken:config.accessToken});
    $('map').dataset.imageryMaxLevel=String(provider.maximumLevel);
    const layer=viewer.imageryLayers.addImageryProvider(provider);
    layer.errorEvent?.addEventListener(()=>message('卫星影像暂时无法加载。请检查网络，稍后重试。'));
    let imageryFailed=false;
    provider.errorEvent.addEventListener(()=>{imageryFailed=true;message('部分卫星影像未能加载，请稍后刷新重试。');});
    $('map-level').textContent='卫星影像 · 地名';
    viewer.scene.globe.tileLoadProgressEvent.addEventListener(pending=>{
      $('map').dataset.pendingTiles=String(pending);
      $('tile-status').hidden=pending===0;
      if(pending===0){$('loading').hidden=true;if(!imageryFailed)message('');}
    });
    viewer.scene.requestRender();
  } catch {
    // Local bundled overview remains usable during setup or a service outage.
    const fallback=await C.TileMapServiceImageryProvider.fromUrl(C.buildModuleUrl('Assets/Textures/NaturalEarthII'));
    viewer.imageryLayers.addImageryProvider(fallback);
    $('loading').hidden=true;$('map-level').textContent='基础地球';
    message(config?.accessToken?'卫星影像连接失败，暂时显示基础地球。请稍后刷新重试。':'地球仪已就绪，卫星影像待连接。');
  }
}
async function init() {
  try {
    const response=await fetch('./routes.json');if(!response.ok)throw Error('Route data unavailable');
    data=await response.json();renderList();
    if(!C)throw Error('Cesium unavailable');
    C.Ion.defaultAccessToken='';
    viewer=new C.Viewer('map',{baseLayer:false,terrainProvider:new C.EllipsoidTerrainProvider(),animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,scene3DOnly:true,requestRenderMode:true,maximumRenderTimeChange:Infinity,creditContainer:$('map-credits'),showRenderLoopErrors:false});
    viewer.scene.backgroundColor=C.Color.fromCssColorString('#07111b');
    viewer.scene.globe.baseColor=C.Color.fromCssColorString('#163147');
    viewer.scene.globe.enableLighting=false;
    viewer.scene.globe.maximumScreenSpaceError=1.5;
    viewer.scene.skyAtmosphere.show=true;
    viewer.useBrowserRecommendedResolution=true;
    viewer.resolutionScale=restingScale;
    $('map').dataset.renderQuality='resting';
    const controls=viewer.scene.screenSpaceCameraController;
    controls.enableTilt=false;controls.enableLook=false;
    controls.minimumZoomDistance=200;controls.maximumZoomDistance=40000000;
    controls.inertiaSpin=.8;controls.inertiaZoom=.7;
    viewer.camera.percentageChanged=.01;
    viewer.canvas.tabIndex=0;
    viewer.canvas.setAttribute('aria-label','互动地球仪。方向键旋转，加减键缩放。');
    viewer.canvas.addEventListener('keydown',event=>{
      const angle=C.Math.toRadians(4);
      const actions={ArrowLeft:()=>viewer.camera.rotateLeft(angle),ArrowRight:()=>viewer.camera.rotateRight(angle),ArrowUp:()=>viewer.camera.rotateUp(angle),ArrowDown:()=>viewer.camera.rotateDown(angle),'+':()=>zoom(.65),'=':()=>zoom(.65),'-':()=>zoom(1.5)};
      if(actions[event.key]){event.preventDefault();actions[event.key]();updateLabels();}
    });
    // Track actual pose, since canvas resizing also raises camera movement events.
    const sampledPosition=C.Cartesian3.clone(viewer.camera.positionWC),sampledDirection=C.Cartesian3.clone(viewer.camera.directionWC),sampledUp=C.Cartesian3.clone(viewer.camera.upWC);
    viewer.scene.postUpdate.addEventListener(()=>{
      const camera=viewer.camera;
      if(C.Cartesian3.equalsEpsilon(camera.positionWC,sampledPosition,1e-9)&&C.Cartesian3.equalsEpsilon(camera.directionWC,sampledDirection,1e-9)&&C.Cartesian3.equalsEpsilon(camera.upWC,sampledUp,1e-9))return;
      C.Cartesian3.clone(camera.positionWC,sampledPosition);C.Cartesian3.clone(camera.directionWC,sampledDirection);C.Cartesian3.clone(camera.upWC,sampledUp);
      beginCameraMotion();endCameraMotion();
    });
    viewer.camera.changed.addEventListener(()=>{
      const now=performance.now();
      if(now-lastHudUpdate>120){lastHudUpdate=now;updateCameraReadout();}
    });
    viewer.scene.renderError.addEventListener(()=>{ $('loading').hidden=true;message('地球渲染中断，请刷新页面，并确认浏览器已启用硬件加速。'); });
    drawRoutes();selectFlight(null);mode('world');
    const last=data.flights.at(-1).points.at(-1);
    viewer.camera.setView({destination:C.Cartesian3.fromDegrees(last.lng,last.lat,18000000)});
    $('overview').onclick=showOverview;$('world').onclick=worldView;
    $('zoom-in').onclick=()=>zoom(.65);$('zoom-out').onclick=()=>zoom(1.5);
    $('north').onclick=()=>viewer.camera.flyTo({destination:viewer.camera.positionWC,orientation:{heading:0,pitch:-C.Math.PI_OVER_TWO,roll:0},duration:reducedMotion?0:.6});
    $('show-waypoints').onchange=updateLabels;
    $('close-waypoint').onclick=()=>{$('waypoint-card').hidden=true;};
    viewer.screenSpaceEventHandler.setInputAction(click=>{
      const entity=viewer.scene.pick(click.position)?.id;
      if(!entity?.properties){$('waypoint-card').hidden=true;return;}
      const properties=entity.properties.getValue(viewer.clock.currentTime);
      if(properties.waypoint){
        $('waypoint-name').textContent=properties.waypoint;
        $('waypoint-info').textContent=`${properties.via} · ${properties.lat.toFixed(4)}°, ${properties.lng.toFixed(4)}°`;
        $('waypoint-card').hidden=false;
      }else if(properties.flightId)selectFlight(properties.flightId);
    },C.ScreenSpaceEventType.LEFT_CLICK);
    viewer.screenSpaceEventHandler.removeInputAction(C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    new ResizeObserver(()=>{viewer.resize();updateLabels();}).observe($('map'));
    updateLabels();await loadImagery();
    setTimeout(()=>{if(!$('loading').hidden){$('loading').hidden=true;message('卫星影像加载较慢，请检查网络。你仍可旋转地球或选择航程。');}},20000);
  } catch {
    $('loading').hidden=true;message('地球仪未能启动，请刷新页面并确认浏览器支持 WebGL。航程记录仍可查看。');
  }
}
init();
