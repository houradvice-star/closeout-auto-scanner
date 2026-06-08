import { useState, useRef, useCallback } from "react";

const DATA_SOURCE = "AI";
const MODEL = "claude-sonnet-4-20250514";

const C = {
  bg:"#0A0A0A", surface:"#111111", card:"#161616", border:"#2A2A2A",
  gold:"#D4A843", green:"#22C55E", yellow:"#EAB308", red:"#EF4444",
  text:"#E8E8E8", muted:"#555555", sub:"#888888",
};
const FH = "'Barlow Condensed', sans-serif";
const FM = "'IBM Plex Mono', monospace";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:${C.bg};color:${C.text};font-family:${FM}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes fadein{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
  @keyframes sweep{0%{left:-60%}100%{left:110%}}
`;

// ── BACKEND CONFIG ────────────────────────────────────────────────────────────
const BACKEND_URL = "https://closeout-auto-backend.onrender.com";

function toB64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

async function scanCar(b64s) {
  const res = await fetch(`${BACKEND_URL}/api/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images: b64s }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Scan failed");
  const { success, ...result } = data;
  return result;
}

async function buildListings(vehicle, part) {
  const res = await fetch(`${BACKEND_URL}/api/listings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vehicle, part }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Listing generation failed");
  const { success, ...result } = data;
  return result;
}

// ── tiny components ───────────────────────────────────────────────────────────
const Pill = ({color,children}) => (
  <span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:2,padding:"2px 8px",fontSize:10,fontFamily:FM,letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>{children}</span>
);

const Btn = ({onClick,disabled,children,variant="gold",full=false,big=false}) => {
  const v = {
    gold:  {background:C.gold,color:"#000",border:"none"},
    ghost: {background:"transparent",color:C.sub,border:`1px solid ${C.border}`},
    green: {background:C.green+"22",color:C.green,border:`1px solid ${C.green}44`},
  }[variant]||{};
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...v, fontFamily:FH, fontWeight:800, fontSize:big?16:13, letterSpacing:2,
      textTransform:"uppercase", borderRadius:3, padding:big?"14px 20px":"10px 18px",
      cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.4:1,
      transition:"all 0.15s", width:full?"100%":"auto",
    }}>{children}</button>
  );
};

const Copy = ({text}) => {
  const [ok,setOk] = useState(false);
  return (
    <button onClick={()=>{navigator.clipboard.writeText(text);setOk(true);setTimeout(()=>setOk(false),1500)}} style={{
      background:ok?C.green+"22":C.border+"44", color:ok?C.green:C.sub,
      border:`1px solid ${ok?C.green+"44":C.border}`, borderRadius:2,
      padding:"3px 10px", fontSize:10, fontFamily:FM, cursor:"pointer", letterSpacing:1,
    }}>{ok?"✓ COPIED":"COPY"}</button>
  );
};

const Lbl = ({children}) => (
  <div style={{fontFamily:FH,fontSize:11,letterSpacing:3,color:C.muted,textTransform:"uppercase",marginBottom:6}}>{children}</div>
);

const Hr = () => <div style={{borderTop:`1px solid ${C.border}`,margin:"16px 0"}} />;

const ScoreColor = s => s==="GREEN"?C.green:s==="YELLOW"?C.yellow:C.red;

// ── SCAN SCREEN ───────────────────────────────────────────────────────────────
function ScanScreen({onDone}) {
  const [imgs,  setImgs]  = useState([]);
  const [prevs, setPrevs] = useState([]);
  const [busy,  setBusy]  = useState(false);
  const [stage, setStage] = useState("");
  const [err,   setErr]   = useState("");


  const addFiles = useCallback(async files => {
    const arr = Array.from(files).filter(f=>f.type.startsWith("image/"));
    const room = 6 - imgs.length;
    if (!room) return;
    const take = arr.slice(0,room);
    const b64s = await Promise.all(take.map(toB64));
    const urls = take.map(f=>URL.createObjectURL(f));
    setImgs(p=>[...p,...b64s].slice(0,6));
    setPrevs(p=>[...p,...urls].slice(0,6));
    setErr("");
  },[imgs.length]);

  const remove = i => {
    setImgs(p=>p.filter((_,j)=>j!==i));
    setPrevs(p=>p.filter((_,j)=>j!==i));
  };

  const scan = async () => {
    if(!imgs.length){setErr("Add at least one photo first.");return;}
    setBusy(true);setErr("");
    try {
      setStage("Reading vehicle...");
      await new Promise(r=>setTimeout(r,500));
      setStage("Scoring parts...");
      const result = await scanCar(imgs);
      setStage("Done.");
      onDone(result,prevs);
    } catch(e){ setErr("Scan failed: "+e.message); }
    finally{ setBusy(false);setStage(""); }
  };

  return (
    <div style={{maxWidth:680,margin:"0 auto"}}>
      <style>{css}</style>

      {/* Two big action labels — native browser tap, no JS ref needed */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        <label style={{
          background: imgs.length>=6||busy ? C.surface : C.gold,
          color: imgs.length>=6||busy ? C.sub : "#000",
          border: imgs.length>=6||busy ? `1px solid ${C.border}` : "none",
          borderRadius:4, padding:"18px 12px", fontFamily:FH, fontWeight:800,
          fontSize:16, letterSpacing:2, cursor:imgs.length>=6||busy?"not-allowed":"pointer",
          opacity:imgs.length>=6?0.4:1, display:"flex", alignItems:"center",
          justifyContent:"center", gap:8, transition:"all 0.2s", userSelect:"none",
        }}>
          📷 TAKE PHOTO
          <input
            type="file"
            accept="image/*"
            disabled={busy||imgs.length>=6}
            style={{display:"none"}}
            onChange={e=>addFiles(e.target.files)}
          />
        </label>
        <label style={{
          background:"transparent", color: imgs.length>=6||busy ? C.muted : C.text,
          border:`2px solid ${imgs.length>=6||busy?C.border:C.sub}`,
          borderRadius:4, padding:"18px 12px", fontFamily:FH, fontWeight:700,
          fontSize:16, letterSpacing:2, cursor:imgs.length>=6||busy?"not-allowed":"pointer",
          opacity:imgs.length>=6?0.4:1, display:"flex", alignItems:"center",
          justifyContent:"center", gap:8, transition:"all 0.2s", userSelect:"none",
        }}>
          🖼 UPLOAD
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={busy||imgs.length>=6}
            style={{display:"none"}}
            onChange={e=>addFiles(e.target.files)}
          />
        </label>
      </div>

      {/* Preview / drop zone */}
      <div
        onDrop={e=>{e.preventDefault();addFiles(e.dataTransfer.files)}}
        onDragOver={e=>e.preventDefault()}
        style={{
          border:`2px dashed ${imgs.length?C.gold+"55":C.border}`,
          borderRadius:4, padding:"24px 16px", textAlign:"center",
          background:imgs.length?C.gold+"08":"transparent",
          minHeight:110, position:"relative", overflow:"hidden",
          transition:"all 0.2s",
        }}>
        {busy && (
          <div style={{position:"absolute",top:0,left:"-60%",width:"60%",height:"2px",
            background:`linear-gradient(90deg,transparent,${C.gold},transparent)`,
            animation:"sweep 1.2s linear infinite"}} />
        )}
        {imgs.length===0 ? (
          <div style={{color:C.muted,fontSize:12,letterSpacing:1,paddingTop:12}}>
            DRAG &amp; DROP HERE · OR USE BUTTONS ABOVE
          </div>
        ) : (
          <>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center",marginBottom:10}}>
              {prevs.map((url,i)=>(
                <div key={i} style={{position:"relative"}}>
                  <img src={url} alt="" style={{width:88,height:66,objectFit:"cover",borderRadius:3,border:`1px solid ${C.border}`}} />
                  <button onClick={()=>remove(i)} style={{
                    position:"absolute",top:-7,right:-7,width:20,height:20,
                    borderRadius:"50%",background:C.red,color:"#fff",
                    border:"none",cursor:"pointer",fontSize:12,
                    display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,
                  }}>×</button>
                </div>
              ))}
            </div>
            <div style={{fontSize:10,color:C.sub,letterSpacing:1}}>
              {imgs.length}/6 PHOTOS · {imgs.length<6?"ADD MORE ABOVE":"LIMIT REACHED"}
            </div>
          </>
        )}
      </div>

      {/* Photo checklist */}
      <div style={{marginTop:12,padding:"12px 16px",background:C.surface,borderRadius:3,border:`1px solid ${C.border}`}}>
        <Lbl>📋 Better photos = better results</Lbl>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 16px"}}>
          {["Front 3/4","Rear 3/4","Driver side","Passenger side","VIN plate","Engine bay"].map(s=>(
            <div key={s} style={{fontSize:10,color:C.sub}}>· {s}</div>
          ))}
        </div>
      </div>

      {err && (
        <div style={{marginTop:12,padding:"10px 14px",background:C.red+"15",border:`1px solid ${C.red}44`,borderRadius:3,fontSize:11,color:C.red}}>
          ⚠ {err}
        </div>
      )}

      {/* Scan button */}
      <div style={{marginTop:14,display:"flex",gap:10}}>
        <button
          onClick={scan} disabled={busy||!imgs.length}
          style={{
            flex:1, background:busy?C.surface:C.gold, color:busy?C.sub:"#000",
            border:busy?`1px solid ${C.border}`:"none", borderRadius:3,
            padding:"16px 20px", fontFamily:FH, fontWeight:800, fontSize:16,
            letterSpacing:3, cursor:busy||!imgs.length?"not-allowed":"pointer",
            opacity:!imgs.length?0.4:1, transition:"all 0.2s", position:"relative",overflow:"hidden",
          }}>
          {busy ? `⟳  ${stage}` : imgs.length ? `SCAN ${imgs.length} PHOTO${imgs.length!==1?"S":""}` : "SCAN VEHICLE"}
        </button>
        {imgs.length>0&&!busy&&(
          <button onClick={()=>{setImgs([]);setPrevs([]);setErr("");}} style={{
            background:"transparent",color:C.sub,border:`1px solid ${C.border}`,
            borderRadius:3,padding:"16px 14px",fontFamily:FH,fontWeight:700,
            fontSize:12,letterSpacing:2,cursor:"pointer",
          }}>CLEAR</button>
        )}
      </div>
    </div>
  );
}

// ── RESULTS SCREEN ────────────────────────────────────────────────────────────
function ResultsScreen({result,prevs,onReset,onList}) {
  const {vehicle:v,parts,pullSummary} = result;
  const label = `${v.year} ${v.make} ${v.model}${v.trim?" "+v.trim:""}`;
  const greens = parts.filter(p=>p.score==="GREEN");
  const yellows = parts.filter(p=>p.score==="YELLOW");
  const reds = parts.filter(p=>p.score==="RED");

  return (
    <div style={{maxWidth:680,margin:"0 auto",animation:"fadein 0.3s ease"}}>
      {/* Vehicle card */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:20,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
          <div>
            <Lbl>Vehicle Identified</Lbl>
            <div style={{fontFamily:FH,fontSize:30,fontWeight:800,letterSpacing:2,color:C.gold,lineHeight:1}}>{label}</div>
            {v.notes&&<div style={{fontSize:11,color:C.sub,marginTop:6}}>{v.notes}</div>}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
            <Pill color={v.confidence==="HIGH"?C.green:v.confidence==="MEDIUM"?C.yellow:C.red}>{v.confidence} CONF</Pill>
            <Pill color={C.sub}>{v.condition}</Pill>
            <Pill color={C.gold}>{DATA_SOURCE==="AI"?"AI LAYER":"LIVE DATA"}</Pill>
          </div>
        </div>
        {prevs.length>0&&(
          <div style={{display:"flex",gap:6,marginTop:14}}>
            {prevs.slice(0,4).map((url,i)=>(
              <img key={i} src={url} alt="" style={{width:64,height:48,objectFit:"cover",borderRadius:2,border:`1px solid ${C.border}`}} />
            ))}
          </div>
        )}
        <Hr/>
        <div style={{fontSize:12,color:C.text,fontStyle:"italic"}}>📋 {pullSummary}</div>
      </div>

      {/* Score summary */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
        {[["LIST NOW",greens.length,C.green],["RESEARCH",yellows.length,C.yellow],["SKIP",reds.length,C.red]].map(([lbl,cnt,col])=>(
          <div key={lbl} style={{background:col+"11",border:`1px solid ${col}33`,borderRadius:3,padding:"12px 0",textAlign:"center"}}>
            <div style={{fontFamily:FH,fontSize:34,fontWeight:800,color:col,lineHeight:1}}>{cnt}</div>
            <div style={{fontSize:9,color:col,letterSpacing:1,marginTop:4}}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Parts list */}
      {parts.map((p,i)=>(
        <div key={i} style={{
          background:C.card, borderLeft:`3px solid ${ScoreColor(p.score)}`,
          border:`1px solid ${ScoreColor(p.score)}33`,
          borderRadius:3, padding:16, marginBottom:10,
          animation:`fadein 0.3s ease ${i*0.05}s both`,
        }}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:10}}>
            <div>
              <div style={{fontFamily:FH,fontSize:20,fontWeight:700,letterSpacing:1,color:C.text}}>{p.name}</div>
              {p.partNumber&&<div style={{fontSize:10,color:C.sub,marginTop:2}}>OEM: {p.partNumber}</div>}
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <Pill color={ScoreColor(p.score)}>{p.score==="GREEN"?"LIST NOW":p.score==="YELLOW"?"RESEARCH":"SKIP"}</Pill>
              <Pill color={C.gold}>{p.estResale}</Pill>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>
            {[["Demand",p.demand,{HIGH:C.green,MEDIUM:C.yellow,LOW:C.red}],
              ["Pull",p.pullDifficulty,{EASY:C.green,MEDIUM:C.yellow,HARD:C.red}],
              ["Ship",p.shipDifficulty,{EASY:C.green,MEDIUM:C.yellow,HARD:C.red}]
            ].map(([lbl,val,map])=>(
              <div key={lbl} style={{background:C.surface,borderRadius:2,padding:"8px 10px"}}>
                <div style={{fontSize:9,color:C.muted,letterSpacing:1,marginBottom:3}}>{lbl.toUpperCase()}</div>
                <div style={{fontSize:12,fontWeight:600,color:map[val]||C.text}}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
            <Pill color={C.sub}>Season: {p.seasonalRelevance}</Pill>
            <Pill color={C.sub}>{p.platformFit}</Pill>
          </div>
          {p.notes&&<div style={{fontSize:11,color:C.sub,marginBottom:10,lineHeight:1.6}}>{p.notes}</div>}
          {p.photoChecklist?.length>0&&(
            <div style={{background:C.surface,borderRadius:2,padding:"8px 12px",marginBottom:10}}>
              <div style={{fontSize:9,color:C.muted,letterSpacing:1,marginBottom:4}}>PHOTO CHECKLIST</div>
              {p.photoChecklist.map((item,j)=>(
                <div key={j} style={{fontSize:10,color:C.sub}}>□ {item}</div>
              ))}
            </div>
          )}
          {p.score!=="RED"&&(
            <Btn variant="green" full onClick={()=>onList(p)}>GENERATE LISTINGS →</Btn>
          )}
        </div>
      ))}

      <div style={{marginTop:20}}>
        <Btn variant="ghost" full onClick={onReset}>← SCAN NEW VEHICLE</Btn>
      </div>
    </div>
  );
}

// ── LISTINGS SCREEN ───────────────────────────────────────────────────────────
function ListingsScreen({vehicle,part,onBack}) {
  const [data,  setData]  = useState(null);
  const [busy,  setBusy]  = useState(true);
  const [err,   setErr]   = useState("");
  const [tab,   setTab]   = useState("ebay");

  // generate on mount
  useState(()=>{
    (async()=>{
      try { setData(await buildListings(vehicle,part)); }
      catch(e){ setErr("Failed: "+e.message); }
      finally{ setBusy(false); }
    })();
  });

  const vLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const cur = data?.[tab];
  const tabs = [{k:"ebay",l:"eBay Motors"},{k:"facebook",l:"Facebook"},{k:"craigslist",l:"Craigslist"}];

  if(busy) return (
    <div style={{textAlign:"center",padding:60}}>
      <div style={{width:32,height:32,border:`3px solid ${C.border}`,borderTopColor:C.gold,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 14px"}} />
      <div style={{fontFamily:FH,fontSize:14,letterSpacing:2,color:C.sub}}>GENERATING LISTINGS...</div>
    </div>
  );

  if(err) return (
    <div style={{maxWidth:680,margin:"0 auto"}}>
      <div style={{padding:16,background:C.red+"15",border:`1px solid ${C.red}44`,borderRadius:3,color:C.red,marginBottom:16}}>{err}</div>
      <Btn variant="ghost" full onClick={onBack}>← BACK</Btn>
    </div>
  );

  return (
    <div style={{maxWidth:680,margin:"0 auto",animation:"fadein 0.3s ease"}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:16,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div>
            <Lbl>Listings Ready</Lbl>
            <div style={{fontFamily:FH,fontSize:24,fontWeight:800,letterSpacing:2,color:C.gold}}>{part.name}</div>
            <div style={{fontSize:11,color:C.sub}}>{vLabel}</div>
          </div>
          <Pill color={C.green}>{part.estResale}</Pill>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",border:`1px solid ${C.border}`,borderRadius:3,overflow:"hidden",marginBottom:14}}>
        {tabs.map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{
            flex:1,padding:"10px 0",fontFamily:FH,fontSize:12,fontWeight:700,
            letterSpacing:2,textTransform:"uppercase",border:"none",cursor:"pointer",
            background:tab===t.k?C.gold:C.surface,color:tab===t.k?"#000":C.sub,
            borderRight:`1px solid ${C.border}`,transition:"all 0.15s",
          }}>{t.l}</button>
        ))}
      </div>

      {cur&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:4,padding:20,animation:"fadein 0.2s ease"}}>
          {/* Title */}
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <Lbl>Title</Lbl><Copy text={cur.title} />
            </div>
            <div style={{background:C.surface,borderRadius:2,padding:"10px 14px",fontSize:13,color:C.text,lineHeight:1.5,border:`1px solid ${C.border}`}}>
              {cur.title}
            </div>
            {tab==="ebay"&&<div style={{fontSize:9,color:cur.title.length>80?C.red:C.muted,marginTop:4,letterSpacing:1}}>{cur.title.length}/80 CHARS</div>}
          </div>

          {/* Price */}
          <div style={{marginBottom:16}}>
            <Lbl>Price</Lbl>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <div style={{fontFamily:FH,fontSize:30,fontWeight:800,color:C.gold}}>{cur.price}</div>
              {cur.priceRange&&<div style={{fontSize:11,color:C.sub}}>Range: {cur.priceRange}</div>}
            </div>
          </div>

          <Hr/>

          {/* Description */}
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <Lbl>Description</Lbl><Copy text={cur.description} />
            </div>
            <div style={{background:C.surface,borderRadius:2,padding:"12px 14px",fontSize:11,color:C.text,lineHeight:1.7,whiteSpace:"pre-wrap",border:`1px solid ${C.border}`,maxHeight:200,overflowY:"auto"}}>
              {cur.description}
            </div>
          </div>

          {/* eBay extras */}
          {tab==="ebay"&&data?.ebay&&(
            <>
              <Hr/>
              {data.ebay.conditionNotes&&(
                <div style={{marginBottom:14}}>
                  <Lbl>Condition Notes</Lbl>
                  <div style={{background:C.surface,borderRadius:2,padding:"10px 14px",fontSize:11,color:C.text,border:`1px solid ${C.border}`}}>{data.ebay.conditionNotes}</div>
                </div>
              )}
              {data.ebay.keywords?.length>0&&(
                <div style={{marginBottom:14}}>
                  <Lbl>Keywords</Lbl>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {data.ebay.keywords.map((k,i)=>(
                      <span key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:2,padding:"3px 8px",fontSize:10,color:C.sub}}>{k}</span>
                    ))}
                  </div>
                </div>
              )}
              {data.ebay.fitmentWarning&&(
                <div style={{background:C.yellow+"11",border:`1px solid ${C.yellow}33`,borderRadius:2,padding:"10px 14px",marginBottom:14}}>
                  <div style={{fontSize:9,color:C.yellow,letterSpacing:1,marginBottom:4}}>⚠ FITMENT DISCLAIMER</div>
                  <div style={{fontSize:11,color:C.text}}>{data.ebay.fitmentWarning}</div>
                </div>
              )}
              {data.ebay.photoChecklist?.length>0&&(
                <div style={{background:C.surface,borderRadius:2,padding:"10px 14px",border:`1px solid ${C.border}`,marginBottom:14}}>
                  <div style={{fontSize:9,color:C.muted,letterSpacing:1,marginBottom:6}}>📸 PHOTO CHECKLIST</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 16px"}}>
                    {data.ebay.photoChecklist.map((item,i)=>(
                      <div key={i} style={{fontSize:10,color:C.sub}}>□ {item}</div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <Hr/>
          <Btn variant="gold" full onClick={()=>{
            const full = tab==="ebay"
              ? `TITLE: ${cur.title}\n\nPRICE: ${cur.price}\n\nDESCRIPTION:\n${cur.description}\n\nCONDITION: ${cur.conditionNotes||""}\n\nKEYWORDS: ${cur.keywords?.join(", ")||""}\n\nFITMENT: ${cur.fitmentWarning||""}`
              : `TITLE: ${cur.title}\n\nPRICE: ${cur.price}\n\nDESCRIPTION:\n${cur.description}`;
            navigator.clipboard.writeText(full);
          }}>COPY FULL {tab.toUpperCase()} LISTING</Btn>
        </div>
      )}

      <div style={{marginTop:12}}>
        <Btn variant="ghost" full onClick={onBack}>← BACK TO PARTS LIST</Btn>
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("scan");
  const [result, setResult] = useState(null);
  const [prevs,  setPrevs]  = useState([]);
  const [part,   setPart]   = useState(null);

  const done  = (r,p) => { setResult(r); setPrevs(p); setScreen("results"); };
  const list  = p     => { setPart(p); setScreen("listings"); };
  const reset = ()    => { setResult(null); setPrevs([]); setPart(null); setScreen("scan"); };

  return (
    <div style={{minHeight:"100vh",background:C.bg}}>
      {/* HEADER */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:720,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
          <div>
            <div style={{fontFamily:FH,fontSize:20,fontWeight:800,color:C.gold,letterSpacing:4,lineHeight:1}}>CLOSEOUT AUTO</div>
            <div style={{fontSize:8,letterSpacing:3,color:C.muted,fontFamily:FM}}>
              {screen==="scan"?"CAMERA SCANNER":screen==="results"?"PARTS INTELLIGENCE":"LISTING GENERATOR"}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {screen!=="scan"&&(
              <button onClick={reset} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.sub,borderRadius:2,padding:"4px 10px",fontSize:9,fontFamily:FM,letterSpacing:1,cursor:"pointer"}}>
                NEW SCAN
              </button>
            )}
            <div style={{display:"flex",gap:4}}>
              {["scan","results","listings"].map(s=>(
                <div key={s} style={{width:6,height:6,borderRadius:"50%",background:screen===s?C.gold:C.border}} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{maxWidth:720,margin:"0 auto",padding:"24px 16px 80px"}}>
        {screen==="scan"    && <ScanScreen onDone={done} />}
        {screen==="results" && result && <ResultsScreen result={result} prevs={prevs} onReset={reset} onList={list} />}
        {screen==="listings"&& part && result && <ListingsScreen vehicle={result.vehicle} part={part} onBack={()=>setScreen("results")} />}
      </div>

      {/* FOOTER */}
      <div style={{textAlign:"center",padding:"16px",borderTop:`1px solid ${C.border}`}}>
        <div style={{fontSize:9,color:C.muted,letterSpacing:2,fontFamily:FM}}>
          CLOSEOUT AUTO · {DATA_SOURCE==="AI"?"AI LAYER · EBAY LIVE: PENDING":"EBAY LIVE: ACTIVE"}
        </div>
      </div>
    </div>
  );
}
