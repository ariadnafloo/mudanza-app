import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const WALLAPOP_ACTOR = "LXTTfwN3etsoTkI2V";
const SHOPPING_ACTOR = "apify~google-search-scraper";
const CATEGORIES = ["Muebles", "Electrónica", "Electrodomésticos", "Ropa", "Libros", "Deporte", "Cocina", "Otro"];
const CATEGORY_IDS = {
  "Muebles": [12900], "Electrónica": [15000], "Electrodomésticos": [12500],
  "Ropa": [100], "Libros": [18900], "Deporte": [19000], "Cocina": [12465], "Otro": [],
};
const WALLAPOP_DISCOUNTS = {
  "Muebles": 0.35, "Electrónica": 0.40, "Electrodomésticos": 0.35,
  "Ropa": 0.50, "Libros": 0.60, "Deporte": 0.40, "Cocina": 0.45, "Otro": 0.35,
};


const CATEGORIES = ["Muebles", "Electrónica", "Electrodomésticos", "Ropa", "Libros", "Deporte", "Cocina", "Otro"];
const WALLAPOP_DISCOUNTS = {
  "Muebles": 0.35, "Electrónica": 0.40, "Electrodomésticos": 0.35,
  "Ropa": 0.50, "Libros": 0.60, "Deporte": 0.40, "Cocina": 0.45, "Otro": 0.35,
};
const formatEur = n => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);
const sf = "'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
const inputSt = { flex: "1 1 140px", border: "none", borderRadius: 10, padding: "10px 14px", fontFamily: sf, fontSize: 15, background: "rgba(118,118,128,0.12)", color: "#1c1c1e", outline: "none" };

const actCfg = {
  added:   { icon: "＋", color: "#007aff", bg: "rgba(0,122,255,0.1)",  label: "Añadido" },
  price:   { icon: "↕",  color: "#ff9500", bg: "rgba(255,149,0,0.1)",  label: "Precio" },
  sold:    { icon: "✓",  color: "#34c759", bg: "rgba(52,199,89,0.1)",  label: "Vendido" },
  deleted: { icon: "✕",  color: "#ff3b30", bg: "rgba(255,59,48,0.1)",  label: "Eliminado" },
};

const CHIPS = [
  { key: "all", label: "Todos" },
  { key: "added", label: "Añadidos" },
  { key: "price", label: "Modificados" },
  { key: "sold", label: "Vendidos" },
  { key: "deleted", label: "Eliminados" },
];

function relTime(d) {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff/3600000), days = Math.floor(diff/86400000);
  if (h < 1) return "Hace menos de 1h";
  if (h < 24) return `Hace ${h}h`;
  if (days === 1) return "Ayer";
  return `Hace ${days} días`;
}

const runApifyActor = async (actorId, input) => {
  const res = await fetch("/api/apify", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actorId, input }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  const items = await res.json();
  if (!Array.isArray(items) || items.length === 0) throw new Error("Sin resultados");
  return items;
};

const fetchGoogleShoppingPrice = async (query) => {
  const results = await runApifyActor(SHOPPING_ACTOR, {
    queries: query + " comprar precio", countryCode: "es", maxPagesPerQuery: 1, resultsPerPage: 10,
  });
  const priceItems = [];
  for (const page of results) {
    for (const item of (page.shoppingResults || [])) {
      const raw = item.price ?? item.currentPrice ?? item.extractedPrice;
      let p = typeof raw === "number" ? raw : parseFloat((raw || "").replace(/[^\d.,]/g, "").replace(",", "."));
      if (p > 0 && p < 100000) priceItems.push({ price: p, title: item.title || "Producto" });
    }
    for (const item of [...(page.organicResults || []), ...(page.paidResults || [])]) {
      const p = parsePriceFromText((item.description || "") + " " + (item.title || ""));
      if (p) priceItems.push({ price: p, title: item.title || "Resultado" });
    }
  }
  if (priceItems.length === 0) throw new Error("No se encontraron precios. Prueba con marca + modelo.");
  const vals = priceItems.map(r => r.price).sort((a, b) => a - b);
  const trimmed = vals.slice(Math.floor(vals.length * 0.1), Math.ceil(vals.length * 0.9));
  const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  return { avg: parseFloat(avg.toFixed(2)), min: Math.min(...vals), max: Math.max(...vals), count: priceItems.length, items: priceItems.slice(0, 5) };
};

const fetchWallapopPrice = async (item) => {
  const results = await runApifyActor(WALLAPOP_ACTOR, {
    keywords: item.name, min_price: 0, max_price: (item.original_price || 500) * 1.5,
    category_ids: CATEGORY_IDS[item.category], latitude: 40.4168, longitude: -3.7038,
    distance_km: 50, shipping: true, sort_by: "relevance", max_items: 20,
  });
  const prices = results.map(r => r.price).filter(p => p > 0);
  if (!prices.length) return null;
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  return { avg, min: Math.min(...prices), max: Math.max(...prices), count: prices.length, items: results.slice(0, 5) };
};

function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState(""); const [err, setErr] = useState(false);
  const check = () => { if (pw === "mudanza2025") onLogin(); else { setErr(true); setTimeout(() => setErr(false), 1500); } };
  return (
    <div style={{ minHeight:"100vh", background:"#002FA7", fontFamily:sf, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"white", borderRadius:28, padding:"44px 36px", width:320, boxShadow:"0 24px 60px rgba(0,0,30,0.45)", textAlign:"center" }}>
        <div style={{ width:76, height:76, borderRadius:20, background:"#002FA7", display:"flex", alignItems:"center", justifyContent:"center", fontSize:42, margin:"0 auto 18px" }}>📦</div>
        <h1 style={{ fontSize:24, fontWeight:700, color:"#1c1c1e", margin:"0 0 6px" }}>Pin Pan Pun</h1>
        <p style={{ color:"#8e8e93", fontSize:14, marginBottom:28 }}>Introduce la contraseña para acceder</p>
        <input type="password" placeholder="Contraseña" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&check()}
          style={{ width:"100%", textAlign:"center", fontSize:16, letterSpacing:1, marginBottom:12, background:"rgba(118,118,128,0.12)", border:err?"1.5px solid #ff3b30":"none", borderRadius:12, padding:"12px 14px", fontFamily:sf, color:"#1c1c1e", outline:"none", boxSizing:"border-box" }} />
        {err && <div style={{ color:"#ff3b30", fontSize:13, marginBottom:8 }}>Contraseña incorrecta</div>}
        <button onClick={check} style={{ width:"100%", background:"#002FA7", color:"white", border:"none", borderRadius:12, padding:"13px", fontFamily:sf, fontSize:16, cursor:"pointer", fontWeight:700 }}>Entrar</button>
      </div>
    </div>
  );
}

function ActivityView({ activity }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? activity : activity.filter(e => e.type === filter);
  return (
    <div>
      <div style={{ fontSize:13, fontWeight:600, color:"#8e8e93", marginBottom:12, letterSpacing:0.3 }}>HISTORIAL DE ACTIVIDAD</div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
        {CHIPS.map(chip => {
          const cfg = actCfg[chip.key];
          const active = filter === chip.key;
          const count = chip.key === "all" ? activity.length : activity.filter(e => e.type === chip.key).length;
          return (
            <button key={chip.key} onClick={() => setFilter(chip.key)} style={{ display:"flex", alignItems:"center", gap:5, background:active?(cfg?cfg.color:"#1c1c1e"):"white", color:active?"white":(cfg?cfg.color:"#3a3a3c"), border:"1.5px solid "+(active?"transparent":(cfg?cfg.color:"#e5e5ea")), borderRadius:99, padding:"5px 12px", fontFamily:sf, fontSize:12, fontWeight:600, cursor:"pointer", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>
              {chip.label}
              <span style={{ background:active?"rgba(255,255,255,0.25)":(cfg?cfg.bg:"#f2f2f7"), color:active?"white":(cfg?cfg.color:"#8e8e93"), borderRadius:99, padding:"0 6px", fontSize:11, fontWeight:700 }}>{count}</span>
            </button>
          );
        })}
      </div>
      <div style={{ background:"white", borderRadius:20, overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
        {filtered.length === 0 && <div style={{ padding:32, textAlign:"center", color:"#aeaeb2", fontSize:14 }}>Sin actividad en esta categoría</div>}
        {filtered.map((ev, idx) => {
          const cfg = actCfg[ev.type] || actCfg.added;
          return (
            <div key={ev.id||idx} style={{ display:"flex", alignItems:"flex-start", gap:14, padding:"14px 18px", borderTop:idx>0?"1px solid #f2f2f7":"none" }}>
              <div style={{ width:34, height:34, borderRadius:10, background:cfg.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, color:cfg.color, fontWeight:700, flexShrink:0 }}>{cfg.icon}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:"#1c1c1e" }}>{ev.name}</span>
                  <span style={{ fontSize:11, fontWeight:600, color:cfg.color, background:cfg.bg, borderRadius:99, padding:"1px 7px" }}>{cfg.label}</span>
                </div>
                <div style={{ fontSize:12, color:"#8e8e93" }}>{ev.detail}</div>
              </div>
              <div style={{ fontSize:11, color:"#aeaeb2", whiteSpace:"nowrap", flexShrink:0 }}>{relTime(ev.created_at)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const IconGrid     = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>;
const IconTable    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
const IconActivity = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
const IconPencil   = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;

export default function App() {
  const [authed, setAuthed]               = useState(false);
  const [items, setItems]                 = useState([]);
  const [activity, setActivity]           = useState([]);
  const [loading, setLoading]             = useState(false);
  const [view, setView]                   = useState("cards");
  const [adding, setAdding]               = useState(false);
  const [editingId, setEditingId]         = useState(null);
  const [lastUpdated, setLastUpdated]     = useState(null);
  const [updating, setUpdating]           = useState(false);
  const [form, setForm]                   = useState({ name:"", category:"Muebles", originalPrice:"", condition:"Bueno" });
  const [priceRef, setPriceRef]           = useState(null);
  const [loadingRef, setLoadingRef]       = useState(false);
  const [searching, setSearching]         = useState(false);
  const [updatingAll, setUpdatingAll]     = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [wallapopResults, setWallapopResults] = useState({});
  const [shoppingResults, setShoppingResults] = useState({});
  const [expanded, setExpanded]           = useState({});
  const [fetchingFormPrice, setFetchingFormPrice] = useState(false);
  const [formPriceSuggestion, setFormPriceSuggestion] = useState(null);
  const [formPriceError, setFormPriceError] = useState(null);

  useEffect(() => {
    if (!authed) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("items").select("*").order("created_at", { ascending: false });
      if (data) setItems(data);
      setLoading(false);
      setLastUpdated(new Date());
    })();
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    (async () => {
      const { data } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(50);
      if (data) setActivity(data);
    })();
  }, [authed]);

    const handleSearchOnline = async () => {
    if (!form.name.trim()) return;
    setFetchingFormPrice(true); setFormPriceSuggestion(null); setFormPriceError(null);
    try { setFormPriceSuggestion(await fetchGoogleShoppingPrice(form.name)); }
    catch (e) { setFormPriceError(e.message); }
    setFetchingFormPrice(false);
  };

    const handleAdd = async () => {
    if (!form.name) return;
    const orig = parseFloat(form.originalPrice) || 0;
    const discount = WALLAPOP_DISCOUNTS[form.category];
    const newItem = {
      name: form.name, category: form.category, condition: form.condition,
      original_price: orig,
      minus30: parseFloat((orig * 0.70).toFixed(2)),
      wallapop: parseFloat((orig * (1 - discount)).toFixed(2)),
      suggested: parseFloat((orig * (1 - discount)).toFixed(2)),
      sold: false,
      published: false,
    };
    const { data } = await supabase.from("items").insert(newItem).select().single();
    if (data) setItems(prev => [...prev, data]);
    resetForm(); setAdding(false);
    await supabase.from("activity_log").insert({ type: "added",   name: newItem.name,                                       detail: "Añadido · precio de venta " + formatEur(newItem.suggested), created_at: new Date().toISOString() });
  };

    const handleDelete = async (id) => {

  const togglePublished = async (id) => {
    const item = items.find(i => i.id === id);
    const newVal = !item.published;
    await supabase.from("items").update({ published: newVal }).eq("id", id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, published: newVal } : i));
  };

    await supabase.from("items").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
    await supabase.from("activity_log").insert({ type: "deleted", name: items.find(i => i.id === id)?.name || String(id), detail: "Artículo eliminado",                                           created_at: new Date().toISOString() });
  };

    const togglePublished = async (id) => {
    const item = items.find(i => i.id === id);
    const newVal = !item.published;
    await supabase.from("items").update({ published: newVal }).eq("id", id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, published: newVal } : i));
  };

    const toggleSold = async (id) => {
    const item = items.find(i => i.id === id);
    const newVal = !item.sold;
    await supabase.from("items").update({ sold: newVal }).eq("id", id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, sold: newVal } : i));
    await supabase.from("activity_log").insert({ type: "sold",    name: items.find(i => i.id === id)?.name || String(id), detail: "Vendido por " + formatEur(items.find(i => i.id === id)?.suggested || 0), created_at: new Date().toISOString() });
  };

    const updateSuggested = async (id, val) => {
    const v = parseFloat(val) || 0;
    await supabase.from("items").update({ suggested: v }).eq("id", id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, suggested: v } : i));
    await supabase.from("activity_log").insert({ type: "price",   name: items.find(i => i.id === id)?.name || String(id), detail: "Precio actualizado → " + formatEur(parseFloat(val) || 0),         created_at: new Date().toISOString() });
  };

    const updateOriginalPrice = async (id, val) => {
    const orig = parseFloat(val) || 0;
    const item = items.find(i => i.id === id);
    if (!item) return;
    const discount = WALLAPOP_DISCOUNTS[item.category];
    const updates = {
      original_price: orig,
      minus30: parseFloat((orig * 0.70).toFixed(2)),
      wallapop: parseFloat((orig * (1 - discount)).toFixed(2)),
      suggested: parseFloat((orig * (1 - discount)).toFixed(2)),
    };
    await supabase.from("items").update(updates).eq("id", id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  };

    const searchWallapop = async (item) => {
    setSearching({ id: item.id, type: "wallapop" });
    try {
      const result = await fetchWallapopPrice(item);
      if (result) {
        setWallapopResults(prev => ({ ...prev, [item.id]: result }));
        const s = parseFloat(result.avg.toFixed(2));
        await supabase.from("items").update({ suggested: s }).eq("id", item.id);
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, suggested: s } : i));
        setExpanded(item.id);
      } else setWallapopResults(prev => ({ ...prev, [item.id]: { error: "Sin resultados." } }));
    } catch (e) { setWallapopResults(prev => ({ ...prev, [item.id]: { error: e.message } })); }
    setSearching(null);
  };

    const searchGoogleShoppingItem = async (item) => {
    setSearching({ id: item.id, type: "shopping" });
    try {
      const result = await fetchGoogleShoppingPrice(item.name);
      setShoppingResults(prev => ({ ...prev, [item.id]: result }));
      await updateOriginalPrice(item.id, result.avg);
      setExpanded(item.id);
    } catch (e) { setShoppingResults(prev => ({ ...prev, [item.id]: { error: e.message } })); }
    setSearching(null);
  };

    const updateAllPrices = async () => {
    const active = items.filter(i => !i.sold);
    if (!active.length) return;
    setUpdatingAll(true); setUpdateProgress({ current: 0, total: active.length });
    for (let idx = 0; idx < active.length; idx++) {
      setUpdateProgress({ current: idx + 1, total: active.length });
      try {
        const result = await fetchWallapopPrice(active[idx]);
        if (result) {
          setWallapopResults(prev => ({ ...prev, [active[idx].id]: result }));
          const s = parseFloat(result.avg.toFixed(2));
          await supabase.from("items").update({ suggested: s }).eq("id", active[idx].id);
          setItems(prev => prev.map(i => i.id === active[idx].id ? { ...i, suggested: s } : i));
        }
      } catch (_) {}
    }
    setLastUpdated(new Date()); setUpdatingAll(false); setUpdateProgress({ current: 0, total: 0 });
  };

  const total          = items.reduce((s,i) => s+(i.original_price||0), 0);
  const totalSuggested = items.reduce((s,i) => s+(i.suggested||0), 0);
  const totalSold      = items.filter(i=>i.sold).reduce((s,i) => s+(i.suggested||0), 0);
  const pct            = total > 0 ? Math.round(((totalSuggested-total)/total)*100) : 0;

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;

  const ViewBtn = ({ v, Icon }) => (
    <button onClick={() => setView(v)} style={{ background:view===v?"#007aff":"transparent", color:view===v?"white":"#8e8e93", border:"none", borderRadius:8, width:34, height:30, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
      <Icon />
    </button>
  );

  const PriceRow = ({ item }) => (
    <div style={{ display:"flex", background:"#f2f2f7", borderRadius:14, overflow:"hidden", marginBottom:12 }}>
      {[
        { label:"Original",  content:<span style={{ fontSize:14, fontWeight:600, color:"#1c1c1e" }}>{formatEur(item.original_price)}</span> },
        { label:"−30%",      content:<span style={{ fontSize:14, fontWeight:600, color:"#ff3b30" }}>{formatEur(item.minus30)}</span> },
        { label:"Wallapop",  content:<span style={{ fontSize:14, fontWeight:600, color:"#34c759" }}>{formatEur(item.wallapop)}</span> },
        { label:"Tu precio", highlight:true, content: editingId===item.id ? (
          <input autoFocus type="number" defaultValue={item.suggested}
            onBlur={e => { updateSuggested(item.id, e.target.value); setEditingId(null); }}
            onKeyDown={e => { if(e.key==="Enter"){updateSuggested(item.id,e.target.value);setEditingId(null);} if(e.key==="Escape")setEditingId(null); }}
            style={{ width:65, border:"none", borderBottom:"2px solid #007aff", background:"transparent", fontFamily:sf, fontSize:14, fontWeight:700, color:"#007aff", textAlign:"center", outline:"none", padding:"0 0 2px 0" }} />
        ) : (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
            <span style={{ fontSize:14, fontWeight:700, color:"#007aff" }}>{formatEur(item.suggested)}</span>
            <button onClick={() => setEditingId(item.id)} style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", color:"#8e8e93" }}><IconPencil /></button>
          </div>
        )},
      ].map((col, idx) => (
        <div key={col.label} style={{ flex:1, padding:"10px 4px", textAlign:"center", borderRight:idx<3?"1px solid #e5e5ea":"none", background:col.highlight?"rgba(0,122,255,0.07)":"transparent" }}>
          <div style={{ fontSize:9, color:"#8e8e93", fontWeight:600, textTransform:"uppercase", letterSpacing:0.4, marginBottom:4 }}>{col.label}</div>
          {col.content}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#f2f2f7", fontFamily:sf, padding:"24px 16px 120px" }}>
      <div style={{ maxWidth:680, margin:"0 auto" }}>

        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"#8e8e93", letterSpacing:0.5, marginBottom:4 }}>PIN PAN PUN</div>
          <h1 style={{ fontSize:32, fontWeight:700, color:"#1c1c1e", margin:0, letterSpacing:-0.5 }}>Tus artículos en venta</h1>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:8 }}>
            {updating
              ? <><div style={{ width:12, height:12, border:"2px solid #007aff", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/><span style={{ fontSize:12, color:"#007aff", fontWeight:500 }}>Actualizando precios Wallapop…</span></>
              : lastUpdated
                ? <><div style={{ width:8, height:8, borderRadius:"50%", background:"#34c759" }}/><span style={{ fontSize:12, color:"#8e8e93" }}>Precios actualizados · {lastUpdated.toLocaleDateString("es-ES",{day:"numeric",month:"short"})} {lastUpdated.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}</span></>
                : null}
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12, marginBottom:20 }}>
          {[
            { label:"Artículos",      value:<span style={{ fontSize:20, fontWeight:700, color:"#1c1c1e" }}>{items.length}</span>, sub:`${items.filter(i=>!i.sold).length} activos` },
            { label:"Valor original", value:<span style={{ fontSize:20, fontWeight:700, color:"#1c1c1e" }}>{formatEur(total)}</span>, sub:"precio de compra" },
            { label:"Precio venta",   value:(
              <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                <span style={{ fontSize:20, fontWeight:700, color:"#007aff" }}>{formatEur(totalSuggested)}</span>
                <span style={{ display:"flex", alignItems:"center", gap:2, fontSize:12, fontWeight:700, color:pct>=0?"#34c759":"#ff3b30" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform:pct>=0?"none":"rotate(180deg)" }}><polyline points="18 15 12 9 6 15"/></svg>
                  {Math.abs(pct)}%
                </span>
              </div>
            ), sub:"vs. valor original" },
            { label:"Vendido", value:<span style={{ fontSize:20, fontWeight:700, color:"#34c759" }}>{formatEur(totalSold)}</span>, sub:`${items.filter(i=>i.sold).length} artículos` },
          ].map(s => (
            <div key={s.label} style={{ background:"white", borderRadius:16, padding:"16px 18px", boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ fontSize:13, color:"#8e8e93", fontWeight:500, marginBottom:4 }}>{s.label}</div>
              {s.value}
              <div style={{ fontSize:11, color:"#aeaeb2", marginTop:2 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
          <div style={{ background:"white", borderRadius:10, padding:3, display:"flex", gap:2, boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
            <ViewBtn v="cards"    Icon={IconGrid} />
            <ViewBtn v="table"    Icon={IconTable} />
            <ViewBtn v="activity" Icon={IconActivity} />
          </div>
        </div>

        {loading && <div style={{ textAlign:"center", padding:40, color:"#8e8e93", fontSize:14 }}>Cargando artículos…</div>}

        {!loading && view === "cards" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {[...items].sort((a,b) => { const r = i => i.sold?2:i.published?1:0; return r(a)-r(b); }).map(item => (
              <div key={item.id} style={{ background:"white", borderRadius:20, padding:"18px", boxShadow:"0 1px 3px rgba(0,0,0,0.08)", opacity:item.sold?0.65:1 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <span style={{ fontWeight:700, color:"#1c1c1e", fontSize:16, textDecoration:item.sold?"line-through":"none" }}>{item.name}</span>
                      {item.published && !item.sold && <span style={{ background:"rgba(0,122,255,0.1)", color:"#007aff", borderRadius:99, padding:"2px 9px", fontSize:11, fontWeight:600 }}>Publicado</span>}
                      {item.sold && <span style={{ background:"#d1fae5", color:"#059669", borderRadius:99, padding:"2px 9px", fontSize:11, fontWeight:600 }}>Vendido</span>}
                    </div>
                    <div style={{ display:"flex", gap:6, marginTop:5 }}>
                      <span style={{ background:"#f2f2f7", color:"#3a3a3c", borderRadius:99, padding:"2px 9px", fontSize:11, fontWeight:600 }}>{item.category}</span>
                      <span style={{ background:"#f2f2f7", color:"#8e8e93", borderRadius:99, padding:"2px 9px", fontSize:11 }}>{item.condition}</span>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(item.id)} style={{ background:"rgba(118,118,128,0.12)", border:"none", color:"#8e8e93", cursor:"pointer", borderRadius:99, width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:16, flexShrink:0 }}>×</button>
                </div>
                <PriceRow item={item} />
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                  <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", fontSize:12, fontFamily:sf, color:"#3a3a3c", fontWeight:600, userSelect:"none" }}>
                    <input type="checkbox" checked={!!item.published} onChange={() => togglePublished(item.id)} style={{ width:15, height:15, accentColor:"#007aff", cursor:"pointer" }} />
                    Publicado
                  </label>
                  <button onClick={() => toggleSold(item.id)} style={{ width:200, background:item.sold?"#34c759":"#f2f2f7", color:item.sold?"white":"#3a3a3c", border:"none", borderRadius:10, padding:"8px 12px", cursor:"pointer", fontSize:12, fontFamily:sf, fontWeight:600 }}>
                    {item.sold ? "✓ Vendido" : "Marcar como vendido"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && view === "table" && (
          <div style={{ background:"white", borderRadius:20, overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:sf }}>
                <thead>
                  <tr style={{ background:"#f2f2f7" }}>
                    {["Artículo","Original","−30%","Wallapop","Tu precio","Estado"].map(h => (
                      <th key={h} style={{ padding:"10px 12px", fontSize:11, fontWeight:600, color:"#8e8e93", textTransform:"uppercase", letterSpacing:0.4, textAlign:"left", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} style={{ borderTop:"1px solid #f2f2f7", opacity:item.sold?0.65:1 }}>
                      <td style={{ padding:"12px", fontSize:14, fontWeight:600, color:"#1c1c1e", textDecoration:item.sold?"line-through":"none", whiteSpace:"nowrap" }}>{item.name}</td>
                      <td style={{ padding:"12px", fontSize:13, color:"#8e8e93", whiteSpace:"nowrap" }}>{formatEur(item.original_price)}</td>
                      <td style={{ padding:"12px", fontSize:13, color:"#ff3b30", fontWeight:600, whiteSpace:"nowrap" }}>{formatEur(item.minus30)}</td>
                      <td style={{ padding:"12px", fontSize:13, color:"#34c759", fontWeight:600, whiteSpace:"nowrap" }}>{formatEur(item.wallapop)}</td>
                      <td style={{ padding:"12px", whiteSpace:"nowrap" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                          {editingId===item.id ? (
                            <input autoFocus type="number" defaultValue={item.suggested}
                              onBlur={e=>{updateSuggested(item.id,e.target.value);setEditingId(null);}}
                              onKeyDown={e=>{if(e.key==="Enter"){updateSuggested(item.id,e.target.value);setEditingId(null);}if(e.key==="Escape")setEditingId(null);}}
                              style={{ width:70, border:"none", borderBottom:"2px solid #007aff", background:"transparent", fontFamily:sf, fontSize:14, fontWeight:700, color:"#007aff", outline:"none", padding:"0 0 2px 0" }} />
                          ) : (
                            <>
                              <span style={{ fontSize:14, fontWeight:700, color:"#007aff" }}>{formatEur(item.suggested)}</span>
                              <button onClick={()=>setEditingId(item.id)} style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", color:"#8e8e93" }}><IconPencil /></button>
                            </>
                          )}
                        </div>
                      </td>
                      <td style={{ padding:"12px", whiteSpace:"nowrap" }}>
                        <button onClick={()=>toggleSold(item.id)} style={{ background:item.sold?"#34c759":"#f2f2f7", color:item.sold?"white":"#3a3a3c", border:"none", borderRadius:8, padding:"5px 12px", cursor:"pointer", fontSize:12, fontFamily:sf, fontWeight:600 }}>
                          {item.sold?"✓":"Marcar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && view === "activity" && <ActivityView activity={activity} />}

      </div>

      <div style={{ position:"fixed", bottom:0, left:0, right:0, padding:"12px 16px 28px", background:"linear-gradient(to top,#f2f2f7 60%,transparent)", zIndex:100 }}>
        <div style={{ maxWidth:680, margin:"0 auto" }}>
          {!adding ? (
            <button onClick={()=>setAdding(true)} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, background:"#007aff", color:"white", border:"none", borderRadius:99, padding:"15px", fontFamily:sf, fontSize:16, cursor:"pointer", fontWeight:600, width:"100%", boxShadow:"0 4px 20px rgba(0,122,255,0.4)" }}>
              <span style={{ fontSize:20, lineHeight:1 }}>+</span> Añadir artículo
            </button>
          ) : (
            <div style={{ background:"white", borderRadius:20, padding:"20px", boxShadow:"0 -4px 30px rgba(0,0,0,0.12)" }}>
              <div style={{ fontWeight:700, fontSize:17, color:"#1c1c1e", marginBottom:14 }}>Nuevo artículo</div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <input placeholder="Nombre del artículo" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={{ ...inputSt, flex:"none" }} />
                <div style={{ display:"flex", gap:10 }}>
                  <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={inputSt}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
                  <select value={form.condition} onChange={e=>setForm(f=>({...f,condition:e.target.value}))} style={inputSt}>{["Nuevo","Como nuevo","Bueno","Aceptable","Para piezas"].map(c=><option key={c}>{c}</option>)}</select>
                </div>
                <input placeholder="Precio original (€) — opcional" type="number" min="0" value={form.originalPrice} onChange={e=>setForm(f=>({...f,originalPrice:e.target.value}))} style={{ ...inputSt, flex:"none" }} />
                <button onClick={handleSearchOnline} disabled={!form.name||loadingRef} style={{ background:"#f2f2f7", border:"none", borderRadius:12, padding:"11px", fontFamily:sf, fontSize:13, fontWeight:600, color:form.name?"#3a3a3c":"#aeaeb2", cursor:form.name?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                  {loadingRef ? <><div style={{ width:12, height:12, border:"2px solid #8e8e93", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/> Buscando precios…</> : "🔍 Ver referencias de precio"}
                </button>
                {formPriceSuggestion && (
                  <div style={{ background:"#f9f9fb", borderRadius:12, padding:"10px 12px", border:"1px solid #e5e5ea" }}>
                    <div style={{ fontSize:10, color:"#8e8e93", fontWeight:600, textTransform:"uppercase", letterSpacing:0.4, marginBottom:8 }}>Google Shopping — precio nuevo</div>
                    {formPriceSuggestion.items?.map((r,i) => (
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderTop:i>0?"1px solid #e5e5ea":"none" }}>
                        <span style={{ fontSize:12, color:"#3a3a3c", flex:1, marginRight:8 }}>{r.title||r.name||"Artículo"}</span>
                        <span style={{ fontSize:12, fontWeight:700, color:"#34c759" }}>{formatEur(r.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display:"flex", gap:10, marginTop:14 }}>
                <button onClick={handleAdd} style={{ flex:1, background:"#007aff", color:"white", border:"none", borderRadius:12, padding:"13px", fontFamily:sf, fontSize:15, cursor:"pointer", fontWeight:600 }}>Añadir</button>
                <button onClick={()=>{ setAdding(false); setFormPriceSuggestion(null); }} style={{ flex:1, background:"rgba(118,118,128,0.12)", color:"#1c1c1e", border:"none", borderRadius:12, padding:"13px", fontFamily:sf, fontSize:15, cursor:"pointer", fontWeight:500 }}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );
}

