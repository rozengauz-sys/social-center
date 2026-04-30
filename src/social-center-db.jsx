import { useState, useEffect, useMemo } from "react";

const PASSWORD = "social2024";
const CRITERIA = ["Мобильность","Когнитивные функции","Социальная изоляция","Финансовое положение","Состояние здоровья"];
const MONTHS_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.ceil((new Date(dateStr) - today) / 86400000);
}
function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ru-RU");
}

const labelStyle = { display:"flex", flexDirection:"column", gap:5, fontSize:13, fontWeight:600, color:"#374151" };
const inputStyle = { padding:"9px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14, outline:"none", fontFamily:"inherit", width:"100%", boxSizing:"border-box", background:"#f8fafc" };
const btnPrimary = { background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff", border:"none", borderRadius:8, padding:"8px 18px", cursor:"pointer", fontWeight:700, fontSize:14 };
const btnSecondary = { background:"#fff", color:"#475569", border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 16px", cursor:"pointer", fontWeight:600, fontSize:14 };

function SectionToggle({ label, icon, children, defaultOpen=false, accent="#6366f1" }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderRadius:10, border:"1px solid #e2e8f0", overflow:"hidden" }}>
      <button onClick={() => setOpen(o=>!o)} style={{
        width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"10px 14px", background: open ? "#f5f3ff" : "#f8fafc",
        border:"none", cursor:"pointer", fontWeight:700, fontSize:13, color:accent,
        borderBottom: open ? "1px solid #e2e8f0" : "none"
      }}>
        <span>{icon} {label}</span>
        <span style={{ fontSize:11, opacity:0.7 }}>{open ? "▲ свернуть" : "▼ развернуть"}</span>
      </button>
      {open && <div style={{ padding:14 }}>{children}</div>}
    </div>
  );
}

function VisitBadge({ date }) {
  const days = daysUntil(date);
  if (!date) return <span style={{ color:"#94a3b8" }}>Не задано</span>;
  const isOverdue = days < 0, isRed = days <= 30;
  return (
    <span style={{
      background: isOverdue ? "#7f1d1d" : isRed ? "#fee2e2" : "#f0fdf4",
      color: isOverdue ? "#fca5a5" : isRed ? "#b91c1c" : "#166534",
      border:`1px solid ${isOverdue ? "#991b1b" : isRed ? "#fca5a5" : "#bbf7d0"}`,
      borderRadius:6, padding:"2px 8px", fontSize:13, fontWeight:600,
      display:"inline-flex", alignItems:"center", gap:4
    }}>
      {isOverdue ? "⚠ " : isRed ? "🔴 " : "🟢 "}
      {formatDate(date)}
      <span style={{ fontWeight:400, fontSize:11 }}>
        {isOverdue ? ` (просрочено ${Math.abs(days)} д.)` : ` (через ${days} д.)`}
      </span>
    </span>
  );
}

function CriteriaSliders({ value, onChange, readOnly }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {CRITERIA.map((name,i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ width:180, fontSize:13, color:"#475569" }}>{name}</span>
          <input type="range" min={0} max={5} value={value[i]??0}
            disabled={readOnly} onChange={e => onChange({...value,[i]:+e.target.value})}
            style={{ flex:1, accentColor:"#6366f1" }} />
          <span style={{ width:20, textAlign:"center", fontWeight:700, color:"#6366f1" }}>{value[i]??0}</span>
        </div>
      ))}
    </div>
  );
}

// ── Relative Search (поиск по строке) ─────────────────────────────────────
function RelativeSearch({ formId, relatives, allClients, onToggle }) {
  const [q, setQ] = useState("");
  const others = allClients.filter(c => c.id !== formId);
  const matched = q.trim()
    ? others.filter(c => `${c.lastName} ${c.firstName}`.toLowerCase().includes(q.toLowerCase()))
    : others.filter(c => relatives.includes(c.id));

  return (
    <div>
      <input value={q} onChange={e => setQ(e.target.value)}
        placeholder="🔍 Введите имя для поиска родственника..."
        style={{ ...inputStyle, marginBottom:8 }} />
      {!q.trim() && relatives.length === 0 && (
        <div style={{ color:"#94a3b8", fontSize:13, padding:"6px 0" }}>
          Начните вводить имя для поиска среди клиентов базы
        </div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:5, maxHeight:200, overflow:"auto" }}>
        {matched.map(c => (
          <label key={c.id} style={{
            display:"flex", alignItems:"center", gap:10, cursor:"pointer",
            padding:"8px 12px", borderRadius:8,
            background: relatives.includes(c.id) ? "#ede9fe" : "#f8fafc",
            border:`1px solid ${relatives.includes(c.id) ? "#a78bfa" : "#e2e8f0"}`
          }}>
            <input type="checkbox" checked={relatives.includes(c.id)}
              onChange={() => onToggle(c.id)} style={{ accentColor:"#6366f1" }} />
            <span style={{ fontSize:14 }}>{c.lastName} {c.firstName}</span>
            {c.dob && <span style={{ fontSize:12, color:"#94a3b8" }}>{formatDate(c.dob)}</span>}
          </label>
        ))}
        {q.trim() && matched.length === 0 && (
          <div style={{ color:"#94a3b8", fontSize:13, padding:"6px 0" }}>Ничего не найдено</div>
        )}
      </div>
      {relatives.length > 0 && (
        <div style={{ marginTop:8, fontSize:12, color:"#6366f1", fontWeight:600 }}>
          Выбрано: {relatives.map(id => {
            const c = allClients.find(x => x.id === id);
            return c ? `${c.lastName} ${c.firstName}` : "";
          }).filter(Boolean).join(", ")}
        </div>
      )}
    </div>
  );
}

// ── Aid Section ────────────────────────────────────────────────────────────
function AidSection({ aid=[], onChange }) {
  const curYear = new Date().getFullYear();
  const years = useMemo(() => {
    const ys = new Set(aid.map(a=>a.year));
    for(let y=curYear-2;y<=curYear+1;y++) ys.add(y);
    return [...ys].sort((a,b)=>b-a);
  }, [aid, curYear]);
  const [filterYear, setFilterYear] = useState(curYear);
  const [nm, setNm] = useState(new Date().getMonth());
  const [ny, setNy] = useState(curYear);
  const [amt, setAmt] = useState("");

  const filtered = aid.filter(a => a.year === filterYear);
  const total = filtered.reduce((s,a) => s+(parseFloat(a.amount)||0), 0);

  const addEntry = () => {
    if (!amt || isNaN(amt)) return;
    const exists = aid.find(a => a.month===+nm && a.year===+ny);
    onChange(exists
      ? aid.map(a => a.month===+nm && a.year===+ny ? {...a,amount:parseFloat(amt)} : a)
      : [...aid, { id:Date.now(), month:+nm, year:+ny, amount:parseFloat(amt) }]
    );
    setAmt("");
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"flex-end" }}>
        <label style={{ ...labelStyle, flex:"0 0 auto" }}>Месяц
          <select value={nm} onChange={e=>setNm(+e.target.value)} style={{ ...inputStyle, width:130 }}>
            {MONTHS_RU.map((m,i) => <option key={i} value={i}>{m}</option>)}
          </select>
        </label>
        <label style={{ ...labelStyle, flex:"0 0 auto" }}>Год
          <select value={ny} onChange={e=>setNy(+e.target.value)} style={{ ...inputStyle, width:90 }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label style={{ ...labelStyle, flex:1, minWidth:100 }}>Сумма (€)
          <input type="number" min={0} step={0.01} value={amt}
            onChange={e=>setAmt(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addEntry()}
            placeholder="0.00" style={inputStyle} />
        </label>
        <button onClick={addEntry} style={{ ...btnPrimary, padding:"9px 16px", alignSelf:"flex-end" }}>➕ Добавить</button>
      </div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {years.map(y => (
          <button key={y} onClick={()=>setFilterYear(y)} style={{
            padding:"4px 12px", borderRadius:6, border:"1px solid", cursor:"pointer", fontSize:13, fontWeight:600,
            background: filterYear===y ? "#059669" : "#fff",
            color: filterYear===y ? "#fff" : "#475569",
            borderColor: filterYear===y ? "#059669" : "#e2e8f0"
          }}>{y}</button>
        ))}
      </div>
      {filtered.length===0
        ? <div style={{ color:"#94a3b8", fontSize:13, textAlign:"center", padding:"12px 0" }}>Нет записей за {filterYear} год</div>
        : <>
            {filtered.sort((a,b)=>a.month-b.month).map(a => (
              <div key={a.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", borderRadius:8, background:"#f8fafc", border:"1px solid #e2e8f0" }}>
                <span style={{ fontSize:14 }}>{MONTHS_RU[a.month]} {a.year}</span>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontWeight:700, color:"#059669", fontSize:15 }}>€{parseFloat(a.amount).toFixed(2)}</span>
                  <button onClick={()=>onChange(aid.filter(x=>x.id!==a.id))} style={{ background:"none", border:"none", cursor:"pointer", color:"#f87171", fontSize:16, padding:0 }}>✕</button>
                </div>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"flex-end", padding:"8px 12px", fontWeight:800, fontSize:15, color:"#059669", borderTop:"2px solid #d1fae5" }}>
              Итого {filterYear}: €{total.toFixed(2)}
            </div>
          </>
      }
    </div>
  );
}

// ── Visit History ──────────────────────────────────────────────────────────
function VisitHistory({ visits=[], onChange }) {
  const addVisit = () => onChange([...visits, {
    id:Date.now(), date:new Date().toISOString().split("T")[0], notes:"", worker:""
  }]);
  const upd = (id,field,val) => onChange(visits.map(v => v.id===id ? {...v,[field]:val} : v));
  const del = (id) => { if(confirm("Удалить запись о визите?")) onChange(visits.filter(v=>v.id!==id)); };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      <button onClick={addVisit} style={{ ...btnSecondary, alignSelf:"flex-start", fontSize:13 }}>➕ Добавить запись о визите</button>
      {visits.length===0
        ? <div style={{ color:"#94a3b8", fontSize:13 }}>История визитов пуста</div>
        : [...visits].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(v => (
          <div key={v.id} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:12, display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              <input type="date" value={v.date} onChange={e=>upd(v.id,"date",e.target.value)} style={{ ...inputStyle, width:160 }} />
              <input value={v.worker} placeholder="Сотрудник" onChange={e=>upd(v.id,"worker",e.target.value)} style={{ ...inputStyle, flex:1, minWidth:120 }} />
              <button onClick={()=>del(v.id)} style={{ background:"none", border:"1px solid #fca5a5", borderRadius:6, color:"#f87171", cursor:"pointer", padding:"4px 10px", fontSize:13 }}>🗑</button>
            </div>
            <textarea value={v.notes} placeholder="Заметки о визите..." onChange={e=>upd(v.id,"notes",e.target.value)} style={{ ...inputStyle, height:64, resize:"vertical" }} />
          </div>
        ))
      }
    </div>
  );
}

// read-only views for card
function AidReadOnly({ aid }) {
  const years = [...new Set(aid.map(a=>a.year))].sort((a,b)=>b-a);
  const [yr, setYr] = useState(years[0]||new Date().getFullYear());
  const filtered = aid.filter(a=>a.year===yr);
  const total = filtered.reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ display:"flex", gap:6 }}>
        {years.map(y=>(
          <button key={y} onClick={()=>setYr(y)} style={{
            padding:"3px 10px", borderRadius:6, border:"1px solid", cursor:"pointer", fontSize:12,
            background: yr===y?"#059669":"#fff", color: yr===y?"#fff":"#475569", borderColor: yr===y?"#059669":"#e2e8f0"
          }}>{y}</button>
        ))}
      </div>
      {filtered.sort((a,b)=>a.month-b.month).map(a=>(
        <div key={a.id} style={{ display:"flex", justifyContent:"space-between", padding:"6px 10px", background:"#f0fdf4", borderRadius:7 }}>
          <span style={{ fontSize:13 }}>{MONTHS_RU[a.month]} {a.year}</span>
          <span style={{ fontWeight:700, color:"#059669" }}>€{parseFloat(a.amount).toFixed(2)}</span>
        </div>
      ))}
      <div style={{ fontWeight:800, color:"#059669", textAlign:"right", fontSize:14, borderTop:"1px solid #bbf7d0", paddingTop:6 }}>
        Итого {yr}: €{total.toFixed(2)}
      </div>
    </div>
  );
}

function VisitHistoryReadOnly({ visits }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {[...visits].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(v=>(
        <div key={v.id} style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:9, padding:"10px 12px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <span style={{ fontWeight:700, fontSize:13, color:"#0369a1" }}>{formatDate(v.date)}</span>
            {v.worker && <span style={{ fontSize:12, color:"#64748b" }}>👤 {v.worker}</span>}
          </div>
          {v.notes && <div style={{ fontSize:13, color:"#475569" }}>{v.notes}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Client Modal ───────────────────────────────────────────────────────────
const emptyClient = {
  id:null, lastName:"", firstName:"", dob:"", address:"",
  specialNeeds:false, criteria:{0:0,1:0,2:0,3:0,4:0},
  comment:"", relatives:[], nextVisit:"", aid:[], visits:[]
};

function ClientModal({ client, allClients, onSave, onClose }) {
  const [form, setForm] = useState(client ? {aid:[],visits:[],...client} : {...emptyClient, id:Date.now()});
  const set = (field,val) => setForm(f=>({...f,[field]:val}));

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.75)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:700, maxHeight:"92vh", overflow:"auto", boxShadow:"0 25px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ padding:"20px 28px", display:"flex", justifyContent:"space-between", alignItems:"center", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:"16px 16px 0 0", position:"sticky", top:0, zIndex:10 }}>
          <h2 style={{ margin:0, color:"#fff", fontSize:20 }}>{client ? "✏️ Редактировать клиента" : "➕ Новый клиент"}</h2>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff", borderRadius:8, padding:"4px 12px", cursor:"pointer", fontSize:18 }}>✕</button>
        </div>

        <div style={{ padding:28, display:"flex", flexDirection:"column", gap:20 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <label style={labelStyle}>Фамилия *
              <input style={inputStyle} value={form.lastName} onChange={e=>set("lastName",e.target.value)} placeholder="Иванов" />
            </label>
            <label style={labelStyle}>Имя *
              <input style={inputStyle} value={form.firstName} onChange={e=>set("firstName",e.target.value)} placeholder="Иван" />
            </label>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <label style={labelStyle}>Дата рождения
              <input type="date" style={inputStyle} value={form.dob} onChange={e=>set("dob",e.target.value)} />
            </label>
            <label style={labelStyle}>Дата следующего визита
              <input type="date" style={inputStyle} value={form.nextVisit} onChange={e=>set("nextVisit",e.target.value)} />
            </label>
          </div>
          <label style={labelStyle}>Адрес
            <input style={inputStyle} value={form.address} onChange={e=>set("address",e.target.value)} placeholder="ул. Ленина, 5, кв. 12" />
          </label>
          <label style={{ ...labelStyle, flexDirection:"row", alignItems:"center", gap:10, cursor:"pointer" }}>
            <input type="checkbox" checked={form.specialNeeds} onChange={e=>set("specialNeeds",e.target.checked)} style={{ width:18,height:18,accentColor:"#6366f1" }} />
            <span style={{ fontSize:14, fontWeight:600, color:"#374151" }}>🌟 Статус «Special Needs»</span>
          </label>

          <SectionToggle label="Оценка критериев (0–5)" icon="📊" defaultOpen={true}>
            <CriteriaSliders value={form.criteria} onChange={v=>set("criteria",v)} />
          </SectionToggle>

          <label style={labelStyle}>Комментарий
            <textarea style={{ ...inputStyle, height:80, resize:"vertical" }} value={form.comment} onChange={e=>set("comment",e.target.value)} placeholder="Дополнительные заметки..." />
          </label>

          {allClients.filter(c=>c.id!==form.id).length > 0 && (
            <SectionToggle label="Родственники" icon="🔗" defaultOpen={true}>
              <RelativeSearch
                formId={form.id} relatives={form.relatives} allClients={allClients}
                onToggle={id => set("relatives", form.relatives.includes(id) ? form.relatives.filter(r=>r!==id) : [...form.relatives,id])}
              />
            </SectionToggle>
          )}

          <SectionToggle label="Оказанная помощь (€)" icon="💶" defaultOpen={false} accent="#059669">
            <AidSection aid={form.aid||[]} onChange={v=>set("aid",v)} />
          </SectionToggle>

          <SectionToggle label="История визитов" icon="📅" defaultOpen={false} accent="#0284c7">
            <VisitHistory visits={form.visits||[]} onChange={v=>set("visits",v)} />
          </SectionToggle>
        </div>

        <div style={{ padding:"16px 28px", borderTop:"1px solid #e2e8f0", display:"flex", justifyContent:"flex-end", gap:12, position:"sticky", bottom:0, background:"#fff" }}>
          <button onClick={onClose} style={btnSecondary}>Отмена</button>
          <button onClick={() => { if(!form.lastName||!form.firstName) return alert("Заполните фамилию и имя"); onSave(form); }} style={btnPrimary}>💾 Сохранить</button>
        </div>
      </div>
    </div>
  );
}

// ── Client Card ────────────────────────────────────────────────────────────
function ClientCard({ client, allClients, onEdit, onDelete, onViewRelative }) {
  const [expanded, setExpanded] = useState(false);
  const relatives = allClients.filter(c => client.relatives?.includes(c.id));
  const avgCriteria = Object.values(client.criteria||{}).reduce((a,b)=>a+b,0)/CRITERIA.length;
  const totalAid = (client.aid||[]).reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
  const visitCount = (client.visits||[]).length;

  return (
    <div style={{ background:"#fff", borderRadius:12, border:"1px solid #e2e8f0", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", overflow:"hidden" }}>
      <div style={{ padding:"16px 20px", display:"flex", alignItems:"flex-start", gap:16, cursor:"pointer" }} onClick={()=>setExpanded(e=>!e)}>
        <div style={{ width:48,height:48,borderRadius:"50%",flexShrink:0,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:18 }}>
          {client.firstName?.[0]}{client.lastName?.[0]}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <span style={{ fontWeight:700, fontSize:16, color:"#1e293b" }}>{client.lastName} {client.firstName}</span>
            {client.specialNeeds && <span style={{ background:"#fef3c7",color:"#92400e",border:"1px solid #fcd34d",borderRadius:6,padding:"1px 7px",fontSize:11,fontWeight:700 }}>⭐ Special Needs</span>}
          </div>
          <div style={{ fontSize:13, color:"#64748b", marginTop:2 }}>
            {client.dob && <>Д.р.: {formatDate(client.dob)} · </>}{client.address||"Адрес не указан"}
          </div>
          <div style={{ marginTop:6, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <VisitBadge date={client.nextVisit} />
            {totalAid>0 && <span style={{ background:"#d1fae5",color:"#065f46",border:"1px solid #6ee7b7",borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:600 }}>💶 €{totalAid.toFixed(0)}</span>}
            {visitCount>0 && <span style={{ background:"#e0f2fe",color:"#0369a1",border:"1px solid #7dd3fc",borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:600 }}>📅 {visitCount} виз.</span>}
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
          <div style={{ width:44,height:44,borderRadius:"50%",background:`conic-gradient(#6366f1 ${avgCriteria/5*100}%,#e2e8f0 0)`,display:"flex",alignItems:"center",justifyContent:"center" }}>
            <div style={{ width:32,height:32,borderRadius:"50%",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#6366f1" }}>{avgCriteria.toFixed(1)}</div>
          </div>
          <span style={{ fontSize:16, color:"#94a3b8" }}>{expanded?"▲":"▼"}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding:"0 20px 20px", borderTop:"1px solid #f1f5f9", display:"flex", flexDirection:"column", gap:12 }}>
          <SectionToggle label="Оценка критериев" icon="📊" defaultOpen={false}>
            <CriteriaSliders value={client.criteria||{}} onChange={()=>{}} readOnly />
          </SectionToggle>

          {client.comment && <div style={{ background:"#f8fafc", borderRadius:8, padding:"10px 14px", fontSize:14, color:"#475569" }}>💬 {client.comment}</div>}

          {relatives.length>0 && (
            <div>
              <div style={{ fontSize:12,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.5,marginBottom:6 }}>Родственники</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {relatives.map(r=>(
                  <button key={r.id} onClick={()=>onViewRelative(r.id)} style={{ background:"#ede9fe",color:"#5b21b6",border:"1px solid #a78bfa",borderRadius:20,padding:"4px 12px",fontSize:13,cursor:"pointer",fontWeight:600 }}>
                    🔗 {r.lastName} {r.firstName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(client.aid||[]).length>0 && (
            <SectionToggle label={`Оказанная помощь — итого €${totalAid.toFixed(2)}`} icon="💶" defaultOpen={false} accent="#059669">
              <AidReadOnly aid={client.aid} />
            </SectionToggle>
          )}

          {visitCount>0 && (
            <SectionToggle label={`История визитов (${visitCount})`} icon="📅" defaultOpen={false} accent="#0284c7">
              <VisitHistoryReadOnly visits={client.visits} />
            </SectionToggle>
          )}

          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button onClick={()=>onEdit(client)} style={btnSecondary}>✏️ Изменить</button>
            <button onClick={()=>{if(confirm(`Удалить ${client.lastName} ${client.firstName}?`))onDelete(client.id);}} style={{ ...btnSecondary,color:"#dc2626",borderColor:"#fca5a5" }}>🗑️ Удалить</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [clients, setClients] = useState(() => {
    try { return JSON.parse(localStorage.getItem("socialCenterClients")) || DEMO_DATA; }
    catch { return DEMO_DATA; }
  });
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [highlightId, setHighlightId] = useState(null);

  useEffect(() => {
    try { localStorage.setItem("socialCenterClients", JSON.stringify(clients)); } catch {}
  }, [clients]);

  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`client-${highlightId}`);
    if (el) el.scrollIntoView({ behavior:"smooth", block:"center" });
    const t = setTimeout(() => setHighlightId(null), 2000);
    return () => clearTimeout(t);
  }, [highlightId]);

  const hasFilters = search || filter !== "all";
  const filtered = useMemo(() => clients.filter(c => {
    const name = `${c.lastName} ${c.firstName}`.toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    if (filter==="specialNeeds" && !c.specialNeeds) return false;
    if (filter==="urgent") { const d=daysUntil(c.nextVisit); if(d===null||d>30) return false; }
    return true;
  }), [clients, search, filter]);

  const saveClient = (form) => {
    setClients(prev => {
      const exists = prev.find(c=>c.id===form.id);
      return exists ? prev.map(c=>c.id===form.id?form:c) : [...prev,form];
    });
    setModal(null);
  };
  const deleteClient = (id) => {
    setClients(prev => prev.filter(c=>c.id!==id).map(c=>({...c,relatives:(c.relatives||[]).filter(r=>r!==id)})));
  };
  const resetFilters = () => { setSearch(""); setFilter("all"); };

  if (!authed) return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1e1b4b,#312e81,#4c1d95)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"rgba(255,255,255,0.05)", backdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:20, padding:48, width:360, textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:8 }}>🏥</div>
        <h1 style={{ color:"#fff", fontSize:22, marginBottom:4 }}>База клиентов</h1>
        <p style={{ color:"#a5b4fc", fontSize:14, marginBottom:28 }}>Социальный центр</p>
        <input type="password" placeholder="Введите пароль" value={pwInput}
          onChange={e=>{setPwInput(e.target.value);setPwError(false);}}
          onKeyDown={e=>e.key==="Enter"&&(pwInput===PASSWORD?setAuthed(true):setPwError(true))}
          style={{ width:"100%",padding:"12px 16px",borderRadius:10,fontSize:16,border:pwError?"2px solid #f87171":"2px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.1)",color:"#fff",outline:"none",boxSizing:"border-box",marginBottom:8 }} />
        {pwError && <p style={{ color:"#f87171",fontSize:13,marginBottom:8 }}>Неверный пароль</p>}
        <button onClick={()=>pwInput===PASSWORD?setAuthed(true):setPwError(true)} style={{ ...btnPrimary,width:"100%",padding:"12px",fontSize:15,marginTop:4 }}>Войти</button>
        <p style={{ color:"#6366f1",fontSize:12,marginTop:16 }}>Демо-пароль: social2024</p>
      </div>
    </div>
  );

  const urgentCount = clients.filter(c=>{const d=daysUntil(c.nextVisit);return d!==null&&d<=30;}).length;

  return (
    <div style={{ minHeight:"100vh", background:"#f1f5f9", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ background:"linear-gradient(135deg,#4f46e5,#7c3aed)", padding:"20px 24px", color:"#fff", boxShadow:"0 4px 20px rgba(79,70,229,0.4)" }}>
        <div style={{ maxWidth:900, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800 }}>🏥 База клиентов</h1>
            <div style={{ fontSize:13, opacity:0.8, marginTop:2 }}>
              Всего: {clients.length} · Special Needs: {clients.filter(c=>c.specialNeeds).length} ·
              <span style={{ color:"#fca5a5",fontWeight:700 }}> Срочно: {urgentCount}</span>
            </div>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>setModal("new")} style={{ ...btnPrimary,background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.4)" }}>➕ Новый клиент</button>
            <button onClick={()=>{setAuthed(false);setPwInput("");}} style={{ ...btnSecondary,background:"transparent",color:"#fff",borderColor:"rgba(255,255,255,0.3)" }}>🚪 Выйти</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:900, margin:"0 auto", padding:"24px 16px" }}>
        <div style={{ display:"flex", gap:10, marginBottom:hasFilters?8:16, flexWrap:"wrap", alignItems:"center" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="🔍 Поиск по имени..."
            style={{ flex:1, minWidth:200, ...inputStyle, margin:0 }} />
          {["all","specialNeeds","urgent"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{
              padding:"8px 14px", borderRadius:8, border:"1px solid", cursor:"pointer", fontWeight:600, fontSize:13,
              background: filter===f?"#6366f1":"#fff", color: filter===f?"#fff":"#475569", borderColor: filter===f?"#6366f1":"#e2e8f0"
            }}>{f==="all"?"Все":f==="specialNeeds"?"⭐ Special Needs":"🔴 Срочные"}</button>
          ))}
          {hasFilters && (
            <button onClick={resetFilters} style={{ ...btnSecondary,color:"#dc2626",borderColor:"#fca5a5",display:"flex",alignItems:"center",gap:4,fontSize:13 }}>
              ✕ Сбросить фильтры
            </button>
          )}
        </div>

        {hasFilters && <div style={{ fontSize:13, color:"#64748b", marginBottom:12 }}>Показано: {filtered.length} из {clients.length}</div>}

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {filtered.length===0 && (
            <div style={{ textAlign:"center", padding:60, color:"#94a3b8" }}>
              <div style={{ fontSize:48 }}>📋</div>
              <div style={{ fontSize:16, marginTop:8 }}>Клиентов не найдено</div>
              {hasFilters && <button onClick={resetFilters} style={{ ...btnSecondary,marginTop:12,color:"#6366f1" }}>Сбросить фильтры</button>}
            </div>
          )}
          {filtered.map(c=>(
            <div key={c.id} id={`client-${c.id}`}
              style={{ transition:"box-shadow 0.4s", boxShadow:highlightId===c.id?"0 0 0 3px #6366f1":"none", borderRadius:12 }}>
              <ClientCard client={c} allClients={clients} onEdit={setModal} onDelete={deleteClient}
                onViewRelative={id=>{setSearch("");setFilter("all");setHighlightId(id);}} />
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <ClientModal client={modal==="new"?null:modal} allClients={clients} onSave={saveClient} onClose={()=>setModal(null)} />
      )}
    </div>
  );
}

// ── Demo Data ──────────────────────────────────────────────────────────────
const DEMO_DATA = [
  {
    id:1, lastName:"Соколова", firstName:"Мария", dob:"1942-03-15",
    address:"ул. Пушкина, 12, кв. 4", specialNeeds:true,
    criteria:{0:3,1:2,2:4,3:3,4:4},
    comment:"Нуждается в еженедельных визитах. Дочь живёт в другом городе.",
    relatives:[2], nextVisit:new Date(Date.now()+15*86400000).toISOString().split("T")[0],
    aid:[{id:101,month:0,year:2025,amount:120},{id:102,month:1,year:2025,amount:95},{id:103,month:2,year:2025,amount:110}],
    visits:[{id:201,date:"2025-03-10",worker:"Анна К.",notes:"Проверка состояния здоровья. Жалуется на давление."},{id:202,date:"2025-02-15",worker:"Анна К.",notes:"Плановый визит. Состояние стабильное."}]
  },
  {
    id:2, lastName:"Соколов", firstName:"Андрей", dob:"1970-07-22",
    address:"ул. Пушкина, 12, кв. 4", specialNeeds:false,
    criteria:{0:1,1:0,2:2,3:1,4:0},
    comment:"Сын Марии Соколовой. Помогает с транспортом.",
    relatives:[1], nextVisit:new Date(Date.now()+45*86400000).toISOString().split("T")[0],
    aid:[], visits:[]
  },
  {
    id:3, lastName:"Левин", firstName:"Яков", dob:"1938-11-08",
    address:"пр. Мира, 33, кв. 17", specialNeeds:true,
    criteria:{0:4,1:3,2:5,3:4,4:3},
    comment:"Ветеран. Полная социальная изоляция. Приоритетный клиент.",
    relatives:[], nextVisit:new Date(Date.now()-5*86400000).toISOString().split("T")[0],
    aid:[{id:301,month:0,year:2025,amount:200},{id:302,month:1,year:2025,amount:200}],
    visits:[{id:401,date:"2025-01-20",worker:"Давид М.",notes:"Первый визит. Крайне замкнут. Требует деликатного подхода."}]
  }
];
