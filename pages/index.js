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

const formatEur = n => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);
const sf = `'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
const inputSt = {
  flex: "1 1 140px", border: "none", borderRadius: 10, padding: "10px 14px",
  fontFamily: sf, fontSize: 15, background: "rgba(118,118,128,0.12)", color: "#1c1c1e",
  outline: "none", WebkitAppearance: "none",
};

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

const parsePriceFromText = (text = "") => {
  const patterns = [/(\d{1,4}[.,]\d{2})\s*€/g, /€\s*(\d{1,4}[.,]\d{2})/g, /(\d{1,4})\s*€/g];
  for (const pat of patterns) {
    for (const m of [...text.matchAll(pat)]) {
      const n = parseFloat(m[1].replace(",", "."));
      if (!isNaN(n) && n > 5 && n < 50000) return n;
    }
  }
  return null;
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

// ── Login screen ──────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const check = () => {
    if (pw === (process.env.NEXT_PUBLIC_APP_PASSWORD || "mudanza2025")) { onLogin(); }
    else { setError(true); setTimeout(() => setError(false), 1500); }
  };
  return (
    <div style={{ minHeight: "100vh", background: "#f2f2f7", fontFamily: sf, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "white", borderRadius: 24, padding: "40px 36px", width: 320, boxShadow: "0 8px 40px rgba(0,0,0,0.12)", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏷️</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1c1c1e", margin: "0 0 6px" }}>Venta Mudanza</h1>
        <p style={{ color: "#8e8e93", fontSize: 14, marginBottom: 28 }}>Introduce la contraseña para acceder</p>
        <input
          type="password" placeholder="Contraseña" value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === "Enter" && check()}
          style={{ ...inputSt, width: "100%", flex: "none", textAlign: "center", fontSize: 18, letterSpacing: 4, marginBottom: 12, border: error ? "1.5px solid #ff3b30" : "none", transition: "border 0.2s" }}
        />
        {error && <div style={{ color: "#ff3b30", fontSize: 13, marginBottom: 8 }}>Contraseña incorrecta</div>}
        <button onClick={check} style={{ width: "100%", background: "#007aff", color: "white", border: "none", borderRadius: 12, padding: "13px", fontFamily: sf, fontSize: 16, cursor: "pointer", fontWeight: 600 }}>
          Entrar
        </button>
      </div>
    </div>
  );
}

// ── Main app ──────────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", category: "Muebles", originalPrice: "", condition: "Bueno" });
  const [adding, setAdding] = useState(false);
  const [fetchingFormPrice, setFetchingFormPrice] = useState(false);
  const [formPriceSuggestion, setFormPriceSuggestion] = useState(null);
  const [formPriceError, setFormPriceError] = useState(null);
  const [searching, setSearching] = useState(null);
  const [updatingAll, setUpdatingAll] = useState(false);
  const [updateProgress, setUpdateProgress] = useState({ current: 0, total: 0 });
  const [wallapopResults, setWallapopResults] = useState({});

const FILTER_CHIPS = [
  { key: "all", label: "Todos" },
  { key: "added", label: "Añadidos" },
  { key: "price", label: "Modificados" },
  { key: "sold", label: "Vendidos" },
  { key: "deleted", label: "Eliminados" },
];
const activityConfig = {
  added:   { icon: "＋", color: "#007aff", bg: "rgba(0,122,255,0.1)",  label: "Añadido" },
  price:   { icon: "↕",  color: "#ff9500", bg: "rgba(255,149,0,0.1)",  label: "Precio" },
  sold:    { icon: "✓",  color: "#34c759", bg: "rgba(52,199,89,0.1)",  label: "Vendido" },
  deleted: { icon: "✕",  color: "#ff3b30", bg: "rgba(255,59,48,0.1)",  label: "Eliminado" },
};
function formatRelTime(date) {
  const diff = Date.now() - new Date(date).getTime();
  const h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000);
  if (h < 1) return "Hace menos de 1h";
  if (h < 24) return `Hace ${h}h`;
  if (d === 1) return "Ayer";
  return `Hace ${d} días`;
}
function ActivityView({ activity }) {
  const [filter, setFilter] = React.useState("all");
  const filtered = filter === "all" ? activity : activity.filter(e => e.type === filter);
  const sf = "'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#8e8e93", marginBottom: 12, letterSpacing: 0.3 }}>HISTORIAL DE ACTIVIDAD</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {FILTER_CHIPS.map(chip => {
          const cfg = activityConfig[chip.key];
          const active = filter === chip.key;
          const count = chip.key === "all" ? activity.length : activity.filter(e => e.type === chip.key).length;
          return (
            <button key={chip.key} onClick={() => setFilter(chip.key)} style={{ display: "flex", alignItems: "center", gap: 5, background: active ? (cfg ? cfg.color : "#1c1c1e") : "white", color: active ? "white" : (cfg ? cfg.color : "#3a3a3c"), border: "1.5px solid " + (active ? "transparent" : (cfg ? cfg.color : "#e5e5ea")), borderRadius: 99, padding: "5px 12px", fontFamily: sf, fontSize: 12, fontWeight: 600, cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              {chip.label}
              <span style={{ background: active ? "rgba(255,255,255,0.25)" : (cfg ? cfg.bg : "#f2f2f7"), color: active ? "white" : (cfg ? cfg.color : "#8e8e93"), borderRadius: 99, padding: "0 6px", fontSize: 11, fontWeight: 700 }}>{count}</span>
            </button>
          );
        })}
      </div>
      <div style={{ background: "white", borderRadius: 20, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        {filtered.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#aeaeb2", fontSize: 14 }}>Sin actividad en esta categoría</div>}
        {filtered.map((ev, idx) => {
          const cfg = activityConfig[ev.type] || activityConfig.added;
          return (
            <div key={ev.id || idx} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 18px", borderTop: idx > 0 ? "1px solid #f2f2f7" : "none" }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: cfg.color, fontWeight: 700, flexShrink: 0 }}>{cfg.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1c1c1e" }}>{ev.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, borderRadius: 99, padding: "1px 7px" }}>{cfg.label}</span>
                </div>
                <div style={{ fontSize: 12, color: "#8e8e93" }}>{ev.detail}</div>
              </div>
              <div style={{ fontSize: 11, color: "#aeaeb2", whiteSpace: "nowrap", flexShrink: 0 }}>{formatRelTime(ev.created_at)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
  const [shoppingResults, setShoppingResults] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [editingId, setEditingId] = useState(null);

  // Load items from Supabase on login
  useEffect(() => {
    if (!authed) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("items").select("*").order("created_at", { ascending: true });
      setItems(data || []);
      setLoading(false);
    })();
  }, [authed]);

  const [activity, setActivity] = useState([]);
  const resetForm = () => {
    setForm({ name: "", category: "Muebles", originalPrice: "", condition: "Bueno" });
    setFormPriceSuggestion(null); setFormPriceError(null); setFetchingFormPrice(false);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(50);
      if (data) setActivity(data);
    })();
  }, []);

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
    };
    const { data } = await supabase.from("items").insert(newItem).select().single();
    if (data) setItems(prev => [...prev, data]);
    resetForm(); setAdding(false);
    await supabase.from("activity_log").insert({ type: "added",   name: newItem.name,                                       detail: "Añadido · precio de venta " + formatEur(newItem.suggested), created_at: new Date().toISOString() });
  };

  const handleDelete = async (id) => {
    await supabase.from("items").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
    await supabase.from("activity_log").insert({ type: "deleted", name: items.find(i => i.id === id)?.name || String(id), detail: "Artículo eliminado",                                           created_at: new Date().toISOString() });
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

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;

  const total = items.reduce((s, i) => s + (i.original_price || 0), 0);
  const totalSuggested = items.reduce((s, i) => s + (i.suggested || 0), 0);
  const totalSold = items.filter(i => i.sold).reduce((s, i) => s + (i.suggested || 0), 0);
  const activeItems = items.filter(i => !i.sold);

  return (
    <>
      <style>{`* { box-sizing: border-box; } body { margin: 0; background: #f2f2f7; } @keyframes spin { to { transform: rotate(360deg); } } input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }`}</style>
      <div style={{ minHeight: "100vh", background: "#f2f2f7", fontFamily: sf, padding: "32px 16px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>

          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#8e8e93", letterSpacing: 0.5, marginBottom: 4 }}>MUDANZA</div>
            <h1 style={{ fontSize: 34, fontWeight: 700, color: "#1c1c1e", margin: 0, letterSpacing: -0.5 }}>Venta de artículos</h1>
            <p style={{ color: "#8e8e93", marginTop: 6, fontSize: 15 }}>Compara precios de Wallapop y tiendas nuevas</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Artículos", value: items.length, sub: `${activeItems.length} activos`, color: "#1c1c1e" },
              { label: "Valor original", value: formatEur(total), sub: "precio de compra", color: "#1c1c1e" },
              { label: "Precio venta", value: formatEur(totalSuggested), sub: "estimado total", color: "#007aff" },
              { label: "Vendido", value: formatEur(totalSold), sub: `${items.filter(i => i.sold).length} artículos`, color: "#34c759" },
            ].map(s => (
              <div key={s.label} style={{ background: "white", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <div style={{ fontSize: 13, color: "#8e8e93", fontWeight: 500, marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color, letterSpacing: -0.3 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "#aeaeb2", marginTop: 3 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {items.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {updatingAll ? (
                <div style={{ background: "white", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontWeight: 600, color: "#1c1c1e", fontSize: 15 }}>Actualizando precios…</span>
                    <span style={{ fontSize: 13, color: "#8e8e93" }}>{updateProgress.current}/{updateProgress.total}</span>
                  </div>
                  <div style={{ background: "#f2f2f7", borderRadius: 99, height: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, background: "#007aff", width: `${(updateProgress.current / updateProgress.total) * 100}%`, transition: "width 0.5s ease" }} />
                  </div>
                  <div style={{ fontSize: 13, color: "#8e8e93", marginTop: 10 }}>
                    Buscando <strong style={{ color: "#1c1c1e" }}>{activeItems[updateProgress.current - 1]?.name || "…"}</strong>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={updateAllPrices} style={{ background: "#007aff", color: "white", border: "none", borderRadius: 12, padding: "12px 20px", fontFamily: sf, fontSize: 15, cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    ↺ Actualizar todos
                    <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 99, padding: "2px 9px", fontSize: 13, fontWeight: 700 }}>{activeItems.length}</span>
                  </button>
                  {lastUpdated && <span style={{ fontSize: 13, color: "#8e8e93" }}>Actualizado {lastUpdated.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>}
                </div>
              )}
            </div>
          )}
      <ActivityView activity={activity} />

          {!adding ? (
            <button onClick={() => setAdding(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#007aff", color: "white", border: "none", borderRadius: 12, padding: "13px", fontFamily: sf, fontSize: 16, cursor: "pointer", marginBottom: 20, fontWeight: 600, width: "100%" }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>+</span> Añadir artículo
            </button>
          ) : (
            <div style={{ background: "white", borderRadius: 20, padding: "22px", marginBottom: 20, boxShadow: "0 4px 24px rgba(0,0,0,0.10)" }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: "#1c1c1e", marginBottom: 16 }}>Nuevo artículo</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input placeholder="Nombre del artículo" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ ...inputSt, flex: "none" }} />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputSt}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} style={inputSt}>
                    {["Nuevo", "Como nuevo", "Bueno", "Aceptable", "Para piezas"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input placeholder="Precio original (€) — opcional" type="number" min="0" value={form.originalPrice} onChange={e => setForm(f => ({ ...f, originalPrice: e.target.value }))} style={{ ...inputSt, flex: "1 1 120px" }} />
                  {form.name.trim().length > 2 && (
                    <button onClick={handleSearchOnline} disabled={fetchingFormPrice} style={{ flexShrink: 0, background: "#f2f2f7", color: fetchingFormPrice ? "#8e8e93" : "#007aff", border: "1.5px solid #007aff", borderRadius: 10, padding: "10px 14px", fontFamily: sf, fontSize: 13, fontWeight: 600, cursor: fetchingFormPrice ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                      {fetchingFormPrice ? <><div style={{ width: 14, height: 14, border: "2px solid #007aff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Buscando…</> : <>🔍 Buscar online</>}
                    </button>
                  )}
                </div>
                {formPriceSuggestion && (
                  <div style={{ background: "rgba(0,122,255,0.07)", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: "#8e8e93", fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>Google Shopping — precio nuevo</div>
                    <div style={{ display: "flex", gap: 20, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
                      {[["Medio", formPriceSuggestion.avg, "#007aff"], ["Mínimo", formPriceSuggestion.min, "#34c759"], ["Máximo", formPriceSuggestion.max, "#ff3b30"]].map(([l, v, c]) => (
                        <div key={l}><div style={{ fontSize: 11, color: "#8e8e93", marginBottom: 2 }}>{l}</div><div style={{ fontSize: 18, fontWeight: 700, color: c }}>{formatEur(v)}</div></div>
                      ))}
                      <button onClick={() => setForm(f => ({ ...f, originalPrice: String(formPriceSuggestion.avg) }))} style={{ marginLeft: "auto", background: "#007aff", color: "white", border: "none", borderRadius: 10, padding: "8px 16px", fontFamily: sf, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                        Usar precio medio
                      </button>
                    </div>
                    {formPriceSuggestion.items.map((r, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid rgba(0,122,255,0.12)", fontSize: 13 }}>
                        <span style={{ color: "#3a3a3c", flex: 1, marginRight: 8 }}>{r.title}</span>
                        <span style={{ fontWeight: 700, color: "#007aff" }}>{formatEur(r.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {formPriceError && <div style={{ background: "rgba(255,59,48,0.07)", borderRadius: 12, padding: "12px 14px", fontSize: 13, color: "#ff3b30" }}>⚠️ {formPriceError}</div>}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                <button onClick={handleAdd} style={{ flex: 1, background: "#007aff", color: "white", border: "none", borderRadius: 12, padding: "13px", fontFamily: sf, fontSize: 16, cursor: "pointer", fontWeight: 600 }}>Añadir</button>
                <button onClick={() => { setAdding(false); resetForm(); }} style={{ flex: 1, background: "rgba(118,118,128,0.12)", color: "#1c1c1e", border: "none", borderRadius: 12, padding: "13px", fontFamily: sf, fontSize: 16, cursor: "pointer", fontWeight: 500 }}>Cancelar</button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#8e8e93" }}>Cargando…</div>
          ) : items.length === 0 ? (
            <div style={{ background: "white", borderRadius: 20, padding: "56px 24px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 48, marginBottom: 14 }}>📦</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: "#1c1c1e" }}>Sin artículos todavía</div>
              <div style={{ fontSize: 14, color: "#8e8e93", marginTop: 6 }}>Añade el primer artículo para empezar</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {items.map(item => {
                const wRes = wallapopResults[item.id];
                const sRes = shoppingResults[item.id];
                const isExpanded = expanded === item.id;
                const isSearchingWallapop = searching?.id === item.id && searching?.type === "wallapop";
                const isSearchingShopping = searching?.id === item.id && searching?.type === "shopping";
                const isSearchingAny = isSearchingWallapop || isSearchingShopping;
                return (
                  <div key={item.id} style={{ background: "white", borderRadius: 20, padding: "20px", boxShadow: isSearchingAny ? "0 0 0 2px #007aff" : "0 1px 3px rgba(0,0,0,0.08)", opacity: item.sold ? 0.65 : 1, transition: "all 0.25s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: "#1c1c1e", fontSize: 17, textDecoration: item.sold ? "line-through" : "none" }}>
                          {isSearchingAny && <span style={{ marginRight: 6 }}>⏳</span>}{item.name}
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                          <span style={{ background: "#f2f2f7", color: "#3a3a3c", borderRadius: 99, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{item.category}</span>
                          <span style={{ background: "#f2f2f7", color: "#8e8e93", borderRadius: 99, padding: "3px 10px", fontSize: 12 }}>{item.condition}</span>
                          {item.sold && <span style={{ background: "#d1fae5", color: "#059669", borderRadius: 99, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>Vendido</span>}
                        </div>
                      </div>
                      <button onClick={() => handleDelete(item.id)} style={{ background: "rgba(118,118,128,0.12)", border: "none", color: "#8e8e93", cursor: "pointer", fontSize: 16, borderRadius: 99, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>×</button>
                    </div>
                    <div style={{ display: "flex", marginTop: 18, background: "#f2f2f7", borderRadius: 14, overflow: "hidden" }}>
                      {[
                        { label: "Original", content: <input type="number" value={item.original_price} onChange={e => updateOriginalPrice(item.id, e.target.value)} style={{ width: "100%", border: "none", background: "transparent", fontFamily: sf, fontSize: 15, fontWeight: 600, color: "#1c1c1e", textAlign: "center", outline: "none", padding: 0 }} /> },
                        { label: "−30%", content: <span style={{ fontSize: 15, fontWeight: 600, color: "#ff3b30" }}>{formatEur(item.minus30)}</span> },
                        { label: "Wallapop", content: <span style={{ fontSize: 15, fontWeight: 600, color: "#34c759" }}>{formatEur(item.wallapop)}</span> },
                        { label: "Tu precio", content: (() => {
                          const editing = editingId === item.id;
                          return (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                              {editing ? (
                                <input autoFocus type="number" defaultValue={item.suggested}
                                  onBlur={e => { updateSuggested(item.id, e.target.value); setEditingId(null); }}
                                  onKeyDown={e => { if (e.key === "Enter") { updateSuggested(item.id, e.target.value); setEditingId(null); } if (e.key === "Escape") setEditingId(null); }}
                                  style={{ width: 70, border: "none", borderBottom: "2px solid #007aff", background: "transparent", fontFamily: sf, fontSize: 15, fontWeight: 700, color: "#007aff", textAlign: "center", outline: "none", padding: "0 0 2px 0" }}
                                />
                              ) : (
                                <>
                                  <span style={{ fontSize: 15, fontWeight: 700, color: "#007aff" }}>{formatEur(item.suggested)}</span>
                                  <button onClick={() => setEditingId(item.id)}
                                    style={{ background: "none", border: "none", cursor: "pointer", padding: "0 0 0 2px", display: "flex", alignItems: "center", color: "#8e8e93" }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                  </button>
                                </>
                              )}
                            </div>
                          );
                        })(), highlight: true },
                      ].map((col, idx) => (
                        <div key={col.label} style={{ flex: 1, padding: "12px 6px", textAlign: "center", borderRight: idx < 3 ? "1px solid #e5e5ea" : "none", background: col.highlight ? "rgba(0,122,255,0.07)" : "transparent" }}>
                          <div style={{ fontSize: 10, color: "#8e8e93", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{col.label}</div>
                          {col.content}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                      <button onClick={() => searchGoogleShoppingItem(item)} disabled={!!searching || updatingAll} style={{ flex: "1 1 auto", background: isSearchingShopping ? "#f2f2f7" : "#34c759", color: isSearchingShopping ? "#8e8e93" : "white", border: "none", borderRadius: 10, padding: "10px 12px", fontFamily: sf, fontSize: 13, cursor: (searching || updatingAll) ? "not-allowed" : "pointer", fontWeight: 600 }}>
                        {isSearchingShopping ? "Buscando…" : "🛍️ Precio nuevo"}
                      </button>
                      <button onClick={() => searchWallapop(item)} disabled={!!searching || updatingAll} style={{ flex: "1 1 auto", background: isSearchingWallapop ? "#f2f2f7" : "#007aff", color: isSearchingWallapop ? "#8e8e93" : "white", border: "none", borderRadius: 10, padding: "10px 12px", fontFamily: sf, fontSize: 13, cursor: (searching || updatingAll) ? "not-allowed" : "pointer", fontWeight: 600 }}>
                        {isSearchingWallapop ? "Buscando…" : "🔍 Wallapop"}
                      </button>
                      <button onClick={() => toggleSold(item.id)} style={{ flex: "1 1 auto", background: item.sold ? "#34c759" : "#f2f2f7", color: item.sold ? "white" : "#3a3a3c", border: "none", borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontSize: 13, fontFamily: sf, fontWeight: 600 }}>
                        {item.sold ? "✓ Vendido" : "Marcar vendido"}
                      </button>
                      {(wRes || sRes) && (
                        <button onClick={() => setExpanded(isExpanded ? null : item.id)} style={{ background: "#f2f2f7", color: "#3a3a3c", border: "none", borderRadius: 10, padding: "10px 14px", cursor: "pointer", fontSize: 13, fontFamily: sf, fontWeight: 500 }}>
                          {isExpanded ? "Ocultar" : "Ver datos"}
                        </button>
                      )}
                    </div>
                    {isExpanded && (
                      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                        {sRes && (
                          <div style={{ background: "#f2f2f7", borderRadius: 14, padding: "14px 16px" }}>
                            <div style={{ fontWeight: 700, color: "#34c759", fontSize: 13, marginBottom: 10 }}>🛍️ Google Shopping</div>
                            {sRes.error ? <div style={{ color: "#ff3b30", fontSize: 13 }}>{sRes.error}</div> : (
                              <>
                                <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
                                  {[["Media", sRes.avg, "#1c1c1e"], ["Mínimo", sRes.min, "#34c759"], ["Máximo", sRes.max, "#8e8e93"]].map(([l, v, c]) => (
                                    <div key={l}><div style={{ fontSize: 11, color: "#8e8e93", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>{l}</div><div style={{ fontWeight: 700, color: c, fontSize: 16 }}>{formatEur(v)}</div></div>
                                  ))}
                                </div>
                                {sRes.items.map((r, i) => (
                                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderTop: "1px solid #e5e5ea", fontSize: 13 }}>
                                    <span style={{ color: "#3a3a3c", flex: 1, marginRight: 8 }}>{r.title}</span>
                                    <span style={{ fontWeight: 700, color: "#34c759" }}>{formatEur(r.price)}</span>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                        {wRes && (
                          <div style={{ background: "#f2f2f7", borderRadius: 14, padding: "14px 16px" }}>
                            <div style={{ fontWeight: 700, color: "#007aff", fontSize: 13, marginBottom: 10 }}>🔍 Wallapop</div>
                            {wRes.error ? <div style={{ color: "#ff3b30", fontSize: 13 }}>{wRes.error}</div> : (
                              <>
                                <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
                                  {[["Media", wRes.avg, "#1c1c1e"], ["Mínimo", wRes.min, "#34c759"], ["Máximo", wRes.max, "#ff3b30"]].map(([l, v, c]) => (
                                    <div key={l}><div style={{ fontSize: 11, color: "#8e8e93", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>{l}</div><div style={{ fontWeight: 700, color: c, fontSize: 16 }}>{formatEur(v)}</div></div>
                                  ))}
                                </div>
                                {wRes.items.map((r, i) => (
                                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderTop: "1px solid #e5e5ea", fontSize: 13 }}>
                                    <span style={{ color: "#3a3a3c", flex: 1, marginRight: 8 }}>{r.title || r.name || "Artículo"}</span>
                                    <span style={{ fontWeight: 700, color: "#007aff" }}>{formatEur(r.price)}</span>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
