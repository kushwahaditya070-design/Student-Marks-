(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const toast = (message) => { const el=$("#toast"); el.textContent=message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove("show"),2600); };

  // Pixel grid: only nearby cells receive a soft color pulse.
  const grid=$("#gridField");
  const palette=["#ff5739","#ffd600","#00a84f","#a14cff","#22b9ed"];
  const tiles=[];
  const buildGrid=()=>{
    grid.innerHTML=""; tiles.length=0;
    const cols=Math.ceil(innerWidth/30)+1, rows=Math.ceil(innerHeight/30)+1;
    grid.style.gridTemplateColumns=`repeat(${cols},30px)`;
    for(let i=0;i<cols*rows;i++){const tile=document.createElement("i");tile.className="grid-tile";grid.appendChild(tile);tiles.push(tile);}
  };
  buildGrid(); let gridResize; addEventListener("resize",()=>{clearTimeout(gridResize);gridResize=setTimeout(buildGrid,150);});
  let lastCell=-1;
  addEventListener("pointermove",e=>{
    if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const cols=Math.ceil(innerWidth/30)+1, cx=Math.floor(e.clientX/30), cy=Math.floor(e.clientY/30);
    const cell=cy*cols+cx;if(cell===lastCell)return;lastCell=cell;
    for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++){
      const idx=(cy+y)*cols+(cx+x), tile=tiles[idx], distance=Math.hypot(x,y);
      if(!tile||distance>3)continue;
      const color=palette[(Math.abs(x*3+y*5)+Math.floor(Math.random()*2))%palette.length];
      tile.style.background=color;tile.style.opacity=String(Math.max(.12,.64-distance*.16));tile.classList.add("hot");
      clearTimeout(tile.fadeTimer);tile.fadeTimer=setTimeout(()=>{tile.style.background="";tile.style.opacity="";tile.classList.remove("hot");},420+distance*130);
    }
  });

  // Custom cursor and hero parallax.
  const cursor=$("#cursor"), aura=$("#cursorAura");
  let px=innerWidth/2,py=innerHeight/2,ax=px,ay=py;
  addEventListener("pointermove",e=>{px=e.clientX;py=e.clientY;cursor.style.left=px+"px";cursor.style.top=py+"px";});
  const cursorLoop=()=>{ax+=(px-ax)*.16;ay+=(py-ay)*.16;aura.style.left=ax+"px";aura.style.top=ay+"px";requestAnimationFrame(cursorLoop);};cursorLoop();
  $$("a,button,input,select").forEach(el=>{el.addEventListener("pointerenter",()=>aura.classList.add("hover"));el.addEventListener("pointerleave",()=>aura.classList.remove("hover"));});
  const heroArt=$("#heroArt");
  heroArt?.addEventListener("pointermove",e=>{const r=heroArt.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;heroArt.style.transform=`perspective(600px) rotateY(${x*9}deg) rotateX(${-y*8}deg)`;});
  heroArt?.addEventListener("pointerleave",()=>heroArt.style.transform="");

  // Small-screen navigation.
  $("#menuToggle").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
  $$("#sidebar a").forEach(a=>a.addEventListener("click",()=>{$$("#sidebar a").forEach(x=>x.classList.remove("active"));a.classList.add("active");$("#sidebar").classList.remove("open");}));
  const sections=$$(".content section[id],.footer[id]");
  if("IntersectionObserver" in window){const io=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){const link=$(`#sidebar a[href="#${entry.target.id}"]`);if(link){ $$("#sidebar a").forEach(a=>a.classList.remove("active"));link.classList.add("active");}}}),{rootMargin:"-35% 0px -55% 0px"});sections.forEach(s=>io.observe(s));}

  // Optional ambient tone: generated locally and started only on explicit click.
  let audioCtx=null,oscillators=[],gain=null,soundOn=false;
  const soundButton=$("#soundToggle");
  soundButton.addEventListener("click",async()=>{
    try{
      if(!audioCtx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC){toast("Audio is not supported in this browser.");return;}audioCtx=new AC();gain=audioCtx.createGain();gain.gain.value=0;gain.connect(audioCtx.destination);
        [110,164.81,220].forEach((freq,i)=>{const osc=audioCtx.createOscillator(),g=audioCtx.createGain();osc.type="sine";osc.frequency.value=freq;g.gain.value=[.13,.07,.045][i];osc.connect(g);g.connect(gain);osc.start();oscillators.push(osc);});
      }
      await audioCtx.resume();soundOn=!soundOn;gain.gain.setTargetAtTime(soundOn?.035:0,audioCtx.currentTime,.3);
      soundButton.classList.toggle("on",soundOn);$("b",soundButton).textContent=soundOn?"SOUND ON":"SOUND OFF";
    }catch(e){toast("Could not start ambient sound.");}
  });

  // Tunnel responds to pointer position without a heavyweight 3D engine.
  const stage=$("#tunnelStage"),tunnel=$("#tunnel");
  stage.addEventListener("pointermove",e=>{if(innerWidth<650)return;const r=stage.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;tunnel.style.transform=`rotateX(${-y*9}deg) rotateY(${x*11}deg)`;});
  stage.addEventListener("pointerleave",()=>tunnel.style.transform="");

  // Charts and statistics are populated only from the Flask dataset endpoint.
  let charts=[];
  const chartDefaults={responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:"#111",padding:12,titleFont:{family:"DM Mono"},bodyFont:{family:"DM Sans"}}},scales:{x:{grid:{display:false},ticks:{color:"#888",font:{family:"DM Mono",size:9},maxRotation:0}},y:{grid:{color:"#1111"},ticks:{color:"#888",font:{family:"DM Mono",size:9}}}}};
  const makeChart=(id,type,labels,values,color,extra={})=>{
    const canvas=$("#"+id);if(!canvas||!window.Chart)return;
    const cfg={type,data:{labels,datasets:[{data:values,backgroundColor:color,borderColor:color,borderWidth:2,borderRadius:type==="bar"?5:0,tension:.35,fill:type==="line"?{target:"origin",above:color+"22"}:false,pointRadius:3,pointHoverRadius:6}]},options:{...chartDefaults,...extra}};
    charts.push(new Chart(canvas,cfg));
  };
  const loadOverview=async()=>{
    try{
      const res=await fetch("/api/overview");if(!res.ok)throw new Error("overview");const d=await res.json();
      $("#statRecords").textContent=d.records.toLocaleString("en-IN");$("#statAverage").textContent=d.average.toFixed(2);$("#statRange").textContent=`${d.minimum}–${d.maximum}`;$("#statFeatures").textContent=d.features;
      makeChart("scoreChart","bar",d.score_histogram.map(x=>x.range),d.score_histogram.map(x=>x.count),"#0875e8");
      makeChart("studyChart","line",d.study_hours.labels,d.study_hours.values,"#ff5739",{scales:{...chartDefaults.scales,y:{...chartDefaults.scales.y,min:55}}});
      makeChart("attendanceChart","line",d.attendance.labels,d.attendance.values,"#00a84f",{scales:{...chartDefaults.scales,y:{...chartDefaults.scales.y,min:55}}});
      makeChart("correlationChart","bar",d.correlations.labels.map(x=>x.replaceAll("_"," ")),d.correlations.values,d.correlations.values.map(v=>v>=0?"#a14cff":"#ff5739"),{indexAxis:"y",scales:{x:{...chartDefaults.scales.x,min:-1,max:1},y:{...chartDefaults.scales.y}}});
    }catch(e){toast("Dataset analytics could not be loaded. Check that Flask is running.");}
  };
  const form=$("#predictionForm"),button=$("#predictButton");
  form.addEventListener("submit",async e=>{
    e.preventDefault();if(!form.reportValidity())return;
    const payload=Object.fromEntries(new FormData(form).entries());
    for(const key of ["Hours_Studied","Attendance","Sleep_Hours","Previous_Scores","Tutoring_Sessions"])payload[key]=Number(payload[key]);
    button.disabled=true;button.innerHTML="CALCULATING <span>…</span>";$("#resultStatus").textContent="PROCESSING";
    try{
      const response=await fetch("/api/predict",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Prediction failed");
      $("#resultValue").innerHTML=`${data.prediction.toFixed(2)}<small> / model estimate</small>`;
      $("#resultMessage").textContent=data.note;$("#resultStatus").textContent="PREDICTION COMPLETE";
      const panel=$("#resultPanel");panel.classList.remove("success");void panel.offsetWidth;panel.classList.add("success");
    }catch(err){$("#resultStatus").textContent="NEEDS ATTENTION";toast(err.message);}
    finally{button.disabled=false;button.innerHTML='PREDICT MY MARKS <span>↗</span>';}
  });

  // Motion enhancement, gracefully skipped if libraries are unavailable or reduced motion is requested.
  const reveal=()=>{
    if(!window.gsap||!window.ScrollTrigger||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    gsap.registerPlugin(ScrollTrigger);
    gsap.utils.toArray(".about-grid h2,.analytics-title h2,.predict-intro h2,.experience-heading h2,.model-grid h2").forEach(el=>gsap.from(el,{y:35,opacity:0,duration:.8,ease:"power3.out",scrollTrigger:{trigger:el,start:"top 88%"}}));
    gsap.utils.toArray(".stat-card,.chart-card,.principles article").forEach((el,i)=>gsap.from(el,{y:24,opacity:0,duration:.55,delay:(i%4)*.06,scrollTrigger:{trigger:el,start:"top 92%"}}));
  };
  loadOverview();
  window.addEventListener("load",()=>{setTimeout(()=>$("#loader").classList.add("done"),500);reveal();});
  setTimeout(()=>$("#loader").classList.add("done"),2600);
})();