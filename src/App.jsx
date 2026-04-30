import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase";

const CRITERIA = ["Мобильность","Когнитивные функции","Социальная изоляция","Финансовое положение","Состояние здоровья"];
const MONTHS_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const MONTHS_SHORT = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];

// ── Date helpers ─────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return "—";
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.ceil((new Date(dateStr) - today) / 86400000);
}

// ── DB converters ─────────────────────────────────────────────────────────
function fromDB(row) {
  return {
    id: row.id,
    familyName: row.family_name || "",
    address: row.address || "",
    specialNeeds: row.special_needs || false,
    criteria: row.criteria || {0:0,1:0,2:0,3:0,4:0},
    comment: row.comment || "",
    nextVisit: row.next_visit || "",
    aid: row.aid || [],
    visits: row.visits || [],
    members: row.members || [],
  };
}
function toDB(form) {
  return {
    family_name: form.familyName,
    address: form.address,
    special_needs: form.specialNeeds,
    criteria: form.criteria,
    comment: form.comment,
    next_visit: form.nextVisit || null,
    aid: form.aid,
    visits: form.visits,
    members: form.members,
  };
}

// ── Styles ────────────────────────────────────────────────────────────────
const labelStyle = { display:"flex", flexDirection:"column", gap:5, fontSize:13, fontWeight:600, color:"#374151" };
const inputStyle = { padding:"9px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14, outline:"none", fontFamily:"inherit", width:"100%", boxSizing:"border-box", background:"#f8fafc" };
const btnPrimary = { background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff", border:"none", borderRadius:8, padding:"8px 18px", cursor:"pointer", fontWeight:700, fontSize:14 };
const btnSecondary = { background:"#fff", color:"#475569", border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 16px", cursor:"pointer", fontWeight:600, fontSize:14 };
const btnDanger = { background:"#fff", color:"#dc2626", border:"1px solid #fca5a5", borderRadius:8, padding:"8px 16px", cursor:"pointer", fontWeight:600, fontSize:14 };

// ── Section Toggle ────────────────────────────────────────────────────────
function SectionToggle({ label, icon, children, defaultOpen=false, accent="#6366f1", badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderRadius:10, border:"1px solid #e2e8f0", overflow:"hidden" }}>
      <button onClick={() => setOpen(o=>!o)} style={{
        width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"10px 14px", background: open ? "#f5f3ff" : "#f8fafc",
        border:"none", cursor:"pointer", fontWeight:700, fontSize:13, color:accent,
        borderBottom: open ? "1px solid #e2e8f0" : "none"
      }}>
        <span style={{ display:"flex", alignItems:"center", gap:8 }}>
          {icon} {label}
          {badge && <span style={{ background:accent, color:"#fff", borderRadius:10, padding:"1px 8px", fontSize:11 }}>{badge}</span>}
        </span>
        <span style={{ fontSize:11, opacity:0.7 }}>{open ? "▲ свернуть" : "▼ развернуть"}</span>
      </button>
      {open && <div style={{ padding:14 }}>{children}</div>}
    </div>
  );
}

// ── Visit Badge ───────────────────────────────────────────────────────────
function VisitBadge({ date }) {
  const days = daysUntil(date);
  if (!date) return <span style={{ color:"#94a3b8", fontSize:13 }}>Не задано</span>;
  const isOverdue = days < 0, isRed = days <= 30;
  return (
    <span style={{
      background: isOverdue?"#7f1d1d":isRed?"#fee2e2":"#f0fdf4",
      color: isOverdue?"#fca5a5":isRed?"#b91c1c":"#166534",
      border:`1px solid ${isOverdue?"#991b1b":isRed?"#fca5a5":"#bbf7d0"}`,
      borderRadius:6, padding:"2px 8px", fontSize:13, fontWeight:600,
      display:"inline-flex", alignItems:"center", gap:4
    }}>
      {isOverdue?"⚠ ":isRed?"🔴 ":"🟢 "}{formatDate(date)}
      <span style={{ fontWeight:400, fontSize:11 }}>
        {isOverdue?` (просрочено ${Math.abs(days)} д.)`:` (через ${days} д.)`}
      </span>
    </span>
  );
}

// ── Criteria Sliders ──────────────────────────────────────────────────────
function CriteriaSliders({ value, onChange, readOnly }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {CRITERIA.map((name,i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ width:180, fontSize:13, color:"#475569", flexShrink:0 }}>{name}</span>
          <input type="range" min={0} max={5} value={value[i]??0}
            disabled={readOnly} onChange={e => onChange({...value,[i]:+e.target.value})}
            style={{ flex:1, accentColor:"#6366f1" }} />
          <span style={{ width:20, textAlign:"center", fontWeight:700, color:"#6366f1" }}>{value[i]??0}</span>
        </div>
      ))}
    </div>
  );
}

// ── Members Editor ────────────────────────────────────────────────────────
const emptyMember = () => ({
  id: Date.now() + Math.random(),
  lastName:"", firstName:"", dob:"", relation:"", misCode:"", phone:"", email:""
});

function MembersEditor({ members, onChange }) {
  const add = () => onChange([...members, emptyMember()]);
  const upd = (id, field, val) => onChange(members.map(m => m.id===id ? {...m,[field]:val} : m));
  const del = (id) => { if(confirm("Удалить члена семьи?")) onChange(members.filter(m => m.id!==id)); };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {members.map((m, idx) => (
        <div key={m.id} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:12, padding:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontWeight:700, fontSize:13, color:"#6366f1" }}>👤 Член семьи #{idx+1}</span>
            <button onClick={()=>del(m.id)} style={{ background:"none", border:"1px solid #fca5a5", borderRadius:6, color:"#f87171", cursor:"pointer", padding:"3px 10px", fontSize:12 }}>Удалить</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <label style={labelStyle}>Фамилия *
              <input style={inputStyle} value={m.lastName} onChange={e=>upd(m.id,"lastName",e.target.value)} placeholder="Иванов" />
            </label>
            <label style={labelStyle}>Имя *
              <input style={inputStyle} value={m.firstName} onChange={e=>upd(m.id,"firstName",e.target.value)} placeholder="Иван" />
            </label>
            <label style={labelStyle}>Дата рождения
              <input type="date" style={inputStyle} value={m.dob} onChange={e=>upd(m.id,"dob",e.target.value)} />
            </label>
            <label style={labelStyle}>Степень родства
              <input style={inputStyle} value={m.relation} onChange={e=>upd(m.id,"relation",e.target.value)} placeholder="Муж, жена, сын..." />
            </label>
            <label style={labelStyle}>Код MIS
              <input style={inputStyle} value={m.misCode} onChange={e=>upd(m.id,"misCode",e.target.value)} placeholder="MIS-001" />
            </label>
            <label style={labelStyle}>Телефон
              <input style={inputStyle} value={m.phone} onChange={e=>upd(m.id,"phone",e.target.value)} placeholder="+972-50-000-0000" />
            </label>
            <label style={{ ...labelStyle, gridColumn:"1/-1" }}>Email
              <input type="email" style={inputStyle} value={m.email} onChange={e=>upd(m.id,"email",e.target.value)} placeholder="ivan@example.com" />
            </label>
          </div>
        </div>
      ))}
      <button onClick={add} style={{ ...btnSecondary, alignSelf:"flex-start", fontSize:13 }}>
        ➕ Добавить члена семьи
      </button>
    </div>
  );
}

// ── Aid Section ───────────────────────────────────────────────────────────
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
  const filtered = aid.filter(a => a.year===filterYear);
  const total = filtered.reduce((s,a) => s+(parseFloat(a.amount)||0), 0);
  const addEntry = () => {
    if (!amt||isNaN(amt)) return;
    const exists = aid.find(a => a.month===+nm && a.year===+ny);
    onChange(exists
      ? aid.map(a => a.month===+nm&&a.year===+ny ? {...a,amount:parseFloat(amt)} : a)
      : [...aid, {id:Date.now(), month:+nm, year:+ny, amount:parseFloat(amt)}]
    );
    setAmt("");
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
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
            onChange={e=>setAmt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addEntry()}
            placeholder="0.00" style={inputStyle} />
        </label>
        <button onClick={addEntry} style={{ ...btnPrimary, padding:"9px 14px", alignSelf:"flex-end", fontSize:13 }}>➕</button>
      </div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {years.map(y => (
          <button key={y} onClick={()=>setFilterYear(y)} style={{
            padding:"4px 10px", borderRadius:6, border:"1px solid", cursor:"pointer", fontSize:12, fontWeight:600,
            background:filterYear===y?"#059669":"#fff", color:filterYear===y?"#fff":"#475569", borderColor:filterYear===y?"#059669":"#e2e8f0"
          }}>{y}</button>
        ))}
      </div>
      {filtered.length===0
        ? <div style={{ color:"#94a3b8", fontSize:13, textAlign:"center", padding:"8px 0" }}>Нет записей за {filterYear} год</div>
        : <>
            {filtered.sort((a,b)=>a.month-b.month).map(a => (
              <div key={a.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 12px", borderRadius:8, background:"#f8fafc", border:"1px solid #e2e8f0" }}>
                <span style={{ fontSize:14 }}>{MONTHS_RU[a.month]} {a.year}</span>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontWeight:700, color:"#059669" }}>€{parseFloat(a.amount).toFixed(2)}</span>
                  <button onClick={()=>onChange(aid.filter(x=>x.id!==a.id))} style={{ background:"none", border:"none", cursor:"pointer", color:"#f87171", fontSize:15, padding:0 }}>✕</button>
                </div>
              </div>
            ))}
            <div style={{ fontWeight:800, color:"#059669", textAlign:"right", fontSize:14, borderTop:"2px solid #d1fae5", paddingTop:6 }}>
              Итого {filterYear}: €{total.toFixed(2)}
            </div>
          </>
      }
    </div>
  );
}

// ── Visit History ─────────────────────────────────────────────────────────
function VisitHistory({ visits=[], onChange }) {
  const add = () => onChange([...visits, {id:Date.now(), date:new Date().toISOString().split("T")[0], notes:"", worker:""}]);
  const upd = (id,f,v) => onChange(visits.map(x => x.id===id ? {...x,[f]:v} : x));
  const del = (id) => { if(confirm("Удалить запись о визите?")) onChange(visits.filter(x=>x.id!==id)); };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      <button onClick={add} style={{ ...btnSecondary, alignSelf:"flex-start", fontSize:13 }}>➕ Добавить запись</button>
      {visits.length===0
        ? <div style={{ color:"#94a3b8", fontSize:13 }}>История визитов пуста</div>
        : [...visits].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(v => (
          <div key={v.id} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:12, display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              <input type="date" value={v.date} onChange={e=>upd(v.id,"date",e.target.value)} style={{ ...inputStyle, width:160 }} />
              <input value={v.worker} placeholder="Сотрудник" onChange={e=>upd(v.id,"worker",e.target.value)} style={{ ...inputStyle, flex:1, minWidth:120 }} />
              <button onClick={()=>del(v.id)} style={{ background:"none", border:"1px solid #fca5a5", borderRadius:6, color:"#f87171", cursor:"pointer", padding:"4px 10px", fontSize:12 }}>🗑</button>
            </div>
            <textarea value={v.notes} placeholder="Заметки о визите..." onChange={e=>upd(v.id,"notes",e.target.value)} style={{ ...inputStyle, height:64, resize:"vertical" }} />
          </div>
        ))
      }
    </div>
  );
}

// ── PDF Export ────────────────────────────────────────────────────────────
function exportPDF(family) {
  const totalAid = (family.aid||[]).reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
  const avgCriteria = Object.values(family.criteria||{}).reduce((a,b)=>a+b,0)/CRITERIA.length;

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'IBM Plex Sans',sans-serif; color:#1e293b; padding:32px; font-size:13px; }
  h1 { font-size:22px; font-weight:700; color:#4f46e5; margin-bottom:4px; }
  h2 { font-size:14px; font-weight:700; color:#4f46e5; margin:18px 0 8px; border-bottom:2px solid #e0e7ff; padding-bottom:4px; }
  .meta { color:#64748b; font-size:12px; margin-bottom:20px; }
  .badge { display:inline-block; background:#fef3c7; color:#92400e; border:1px solid #fcd34d; border-radius:4px; padding:1px 8px; font-size:11px; font-weight:700; margin-left:8px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; }
  .field { background:#f8fafc; border-radius:6px; padding:8px 10px; }
  .field-label { font-size:10px; color:#94a3b8; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px; }
  .field-value { font-size:13px; color:#1e293b; font-weight:600; }
  .member { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:8px; }
  .member-name { font-weight:700; font-size:14px; color:#1e293b; margin-bottom:6px; }
  .member-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; }
  .criteria-row { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
  .criteria-bar { flex:1; height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden; }
  .criteria-fill { height:100%; background:#6366f1; border-radius:4px; }
  .criteria-label { font-size:12px; color:#475569; width:170px; }
  .criteria-val { font-size:12px; font-weight:700; color:#6366f1; width:16px; text-align:right; }
  .aid-row { display:flex; justify-content:space-between; padding:5px 8px; border-radius:5px; background:#f0fdf4; margin-bottom:4px; }
  .visit { background:#f0f9ff; border:1px solid #bae6fd; border-radius:7px; padding:10px; margin-bottom:6px; }
  .visit-header { display:flex; justify-content:space-between; margin-bottom:4px; font-weight:600; font-size:12px; color:#0369a1; }
  .comment { background:#f8fafc; border-left:3px solid #6366f1; padding:8px 12px; border-radius:0 6px 6px 0; font-style:italic; color:#475569; margin-bottom:12px; }
  .total { font-weight:700; color:#059669; text-align:right; border-top:2px solid #d1fae5; padding-top:6px; margin-top:4px; }
  .footer { margin-top:32px; padding-top:12px; border-top:1px solid #e2e8f0; color:#94a3b8; font-size:11px; text-align:center; }
  @media print { body { padding:16px; } }
</style>
</head>
<body>
  <h1>🏥 ${family.familyName || "Без названия"} ${family.specialNeeds?'<span class="badge">⭐ Special Needs</span>':''}</h1>
  <div class="meta">Дата печати: ${formatDate(new Date().toISOString())} · Следующий визит: ${formatDate(family.nextVisit)}</div>

  <div class="grid">
    <div class="field"><div class="field-label">Адрес</div><div class="field-value">${family.address||"—"}</div></div>
    <div class="field"><div class="field-label">Следующий визит</div><div class="field-value">${formatDate(family.nextVisit)}</div></div>
  </div>

  ${family.comment ? `<div class="comment">💬 ${family.comment}</div>` : ""}

  <h2>👥 Члены семьи</h2>
  ${(family.members||[]).map(m => `
    <div class="member">
      <div class="member-name">${m.lastName} ${m.firstName}${m.relation?` <span style="font-weight:400;color:#64748b;font-size:12px;">(${m.relation})</span>`:""}</div>
      <div class="member-grid">
        <div class="field"><div class="field-label">Дата рождения</div><div class="field-value">${formatDate(m.dob)}</div></div>
        <div class="field"><div class="field-label">Код MIS</div><div class="field-value">${m.misCode||"—"}</div></div>
        <div class="field"><div class="field-label">Телефон</div><div class="field-value">${m.phone||"—"}</div></div>
        <div class="field"><div class="field-label">Email</div><div class="field-value">${m.email||"—"}</div></div>
      </div>
    </div>
  `).join("")}

  <h2>📊 Оценка критериев (среднее: ${avgCriteria.toFixed(1)}/5)</h2>
  ${CRITERIA.map((name,i) => `
    <div class="criteria-row">
      <span class="criteria-label">${name}</span>
      <div class="criteria-bar"><div class="criteria-fill" style="width:${((family.criteria[i]||0)/5)*100}%"></div></div>
      <span class="criteria-val">${family.criteria[i]||0}</span>
    </div>
  `).join("")}

  ${(family.aid||[]).length > 0 ? `
  <h2>💶 Оказанная помощь — итого €${totalAid.toFixed(2)}</h2>
  ${[...new Set((family.aid||[]).map(a=>a.year))].sort((a,b)=>b-a).map(yr => {
    const items = (family.aid||[]).filter(a=>a.year===yr).sort((a,b)=>a.month-b.month);
    const t = items.reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
    return `<div style="margin-bottom:10px">
      <div style="font-weight:700;font-size:12px;color:#059669;margin-bottom:4px">${yr}</div>
      ${items.map(a=>`<div class="aid-row"><span>${MONTHS_RU[a.month]}</span><span style="font-weight:700;color:#059669">€${parseFloat(a.amount).toFixed(2)}</span></div>`).join("")}
      <div class="total">Итого ${yr}: €${t.toFixed(2)}</div>
    </div>`;
  }).join("")}` : ""}

  ${(family.visits||[]).length > 0 ? `
  <h2>📅 История визитов (${family.visits.length})</h2>
  ${[...family.visits].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(v=>`
    <div class="visit">
      <div class="visit-header"><span>${formatDate(v.date)}</span>${v.worker?`<span>👤 ${v.worker}</span>`:""}</div>
      ${v.notes?`<div style="color:#475569;font-size:12px">${v.notes}</div>`:""}
    </div>
  `).join("")}` : ""}

  <div class="footer">База клиентов социального центра · Распечатано: ${new Date().toLocaleDateString("ru-RU")}</div>
</body>
</html>`;

  const win = window.open("","_blank");
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

// ── Excel Export ──────────────────────────────────────────────────────────
function exportExcel(families) {
  const rows = [["Семья","Фамилия","Имя","Дата рождения","Степень родства","Код MIS","Телефон","Email","Адрес","Special Needs","Следующий визит","Помощь итого (€)","Комментарий"]];
  families.forEach(f => {
    const totalAid = (f.aid||[]).reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
    const members = f.members||[];
    if (members.length === 0) {
      rows.push([f.familyName,"","","","","","","",f.address,f.specialNeeds?"Да":"Нет",formatDate(f.nextVisit),totalAid.toFixed(2),f.comment]);
    } else {
      members.forEach(m => {
        rows.push([f.familyName,m.lastName,m.firstName,formatDate(m.dob),m.relation||"",m.misCode||"",m.phone||"",m.email||"",f.address,f.specialNeeds?"Да":"Нет",formatDate(f.nextVisit),totalAid.toFixed(2),f.comment]);
      });
    }
  });

  const csv = rows.map(r => r.map(c => `"${String(c||"").replace(/"/g,'""')}"`).join(";")).join("\n");
  const BOM = "\uFEFF";
  const blob = new Blob([BOM+csv], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "clients_export.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── Family Modal ──────────────────────────────────────────────────────────
const emptyFamily = () => ({
  id:"new", familyName:"", address:"", specialNeeds:false,
  criteria:{0:0,1:0,2:0,3:0,4:0}, comment:"", nextVisit:"",
  aid:[], visits:[], members:[emptyMember()]
});

function FamilyModal({ family, onSave, onClose }) {
  const [form, setForm] = useState(family ? {...family} : emptyFamily());
  const [saving, setSaving] = useState(false);
  const set = (f,v) => setForm(x=>({...x,[f]:v}));

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.75)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:720, maxHeight:"93vh", overflow:"auto", boxShadow:"0 25px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ padding:"20px 28px", display:"flex", justifyContent:"space-between", alignItems:"center", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:"16px 16px 0 0", position:"sticky", top:0, zIndex:10 }}>
          <h2 style={{ margin:0, color:"#fff", fontSize:20 }}>{family ? "✏️ Редактировать семью" : "➕ Новая семья"}</h2>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff", borderRadius:8, padding:"4px 12px", cursor:"pointer", fontSize:18 }}>✕</button>
        </div>

        <div style={{ padding:28, display:"flex", flexDirection:"column", gap:20 }}>
          {/* Family name & address */}
          <label style={labelStyle}>Название семьи *
            <input style={inputStyle} value={form.familyName} onChange={e=>set("familyName",e.target.value)} placeholder="Семья Соколовых" />
          </label>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <label style={labelStyle}>Адрес
              <input style={inputStyle} value={form.address} onChange={e=>set("address",e.target.value)} placeholder="ул. Ленина, 5, кв. 12" />
            </label>
            <label style={labelStyle}>Дата следующего визита
              <input type="date" style={inputStyle} value={form.nextVisit} onChange={e=>set("nextVisit",e.target.value)} />
            </label>
          </div>
          <label style={{ ...labelStyle, flexDirection:"row", alignItems:"center", gap:10, cursor:"pointer" }}>
            <input type="checkbox" checked={form.specialNeeds} onChange={e=>set("specialNeeds",e.target.checked)} style={{ width:18,height:18,accentColor:"#6366f1" }} />
            <span style={{ fontSize:14, fontWeight:600 }}>🌟 Статус «Special Needs»</span>
          </label>
          <label style={labelStyle}>Комментарий
            <textarea style={{ ...inputStyle, height:72, resize:"vertical" }} value={form.comment} onChange={e=>set("comment",e.target.value)} placeholder="Дополнительные заметки..." />
          </label>

          {/* Members */}
          <SectionToggle label="Члены семьи" icon="👥" defaultOpen={true} badge={form.members.length}>
            <MembersEditor members={form.members} onChange={v=>set("members",v)} />
          </SectionToggle>

          {/* Criteria */}
          <SectionToggle label="Оценка критериев (0–5)" icon="📊" defaultOpen={false}>
            <CriteriaSliders value={form.criteria} onChange={v=>set("criteria",v)} />
          </SectionToggle>

          {/* Aid */}
          <SectionToggle label="Оказанная помощь (€)" icon="💶" defaultOpen={false} accent="#059669">
            <AidSection aid={form.aid} onChange={v=>set("aid",v)} />
          </SectionToggle>

          {/* Visits */}
          <SectionToggle label="История визитов" icon="📅" defaultOpen={false} accent="#0284c7">
            <VisitHistory visits={form.visits} onChange={v=>set("visits",v)} />
          </SectionToggle>
        </div>

        <div style={{ padding:"16px 28px", borderTop:"1px solid #e2e8f0", display:"flex", justifyContent:"flex-end", gap:12, position:"sticky", bottom:0, background:"#fff" }}>
          <button onClick={onClose} style={btnSecondary}>Отмена</button>
          <button disabled={saving} onClick={async () => {
            if (!form.familyName) return alert("Введите название семьи");
            if (form.members.length===0) return alert("Добавьте хотя бы одного члена семьи");
            const invalid = form.members.find(m=>!m.lastName||!m.firstName);
            if (invalid) return alert("Заполните фамилию и имя для каждого члена семьи");
            setSaving(true);
            await onSave(form);
            setSaving(false);
          }} style={{ ...btnPrimary, opacity:saving?0.7:1 }}>
            {saving ? "Сохранение..." : "💾 Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Family Card ───────────────────────────────────────────────────────────
function FamilyCard({ family, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const totalAid = (family.aid||[]).reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
  const visitCount = (family.visits||[]).length;
  const avgCriteria = Object.values(family.criteria||{}).reduce((a,b)=>a+b,0)/CRITERIA.length;
  const members = family.members||[];

  return (
    <div style={{ background:"#fff", borderRadius:12, border:"1px solid #e2e8f0", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"16px 20px", display:"flex", alignItems:"flex-start", gap:14, cursor:"pointer" }} onClick={()=>setExpanded(e=>!e)}>
        <div style={{ width:50,height:50,borderRadius:12,flexShrink:0,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:20 }}>
          🏠
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <span style={{ fontWeight:800, fontSize:16, color:"#1e293b" }}>{family.familyName||"Без названия"}</span>
            {family.specialNeeds && <span style={{ background:"#fef3c7",color:"#92400e",border:"1px solid #fcd34d",borderRadius:6,padding:"1px 7px",fontSize:11,fontWeight:700 }}>⭐ Special Needs</span>}
          </div>
          <div style={{ fontSize:13, color:"#64748b", marginTop:2 }}>
            {members.length > 0
              ? members.map(m=>`${m.firstName} ${m.lastName}`).join(", ")
              : "Нет членов семьи"}
          </div>
          <div style={{ fontSize:12, color:"#94a3b8", marginTop:2 }}>{family.address||"Адрес не указан"}</div>
          <div style={{ marginTop:6, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <VisitBadge date={family.nextVisit} />
            {totalAid>0 && <span style={{ background:"#d1fae5",color:"#065f46",border:"1px solid #6ee7b7",borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:600 }}>💶 €{totalAid.toFixed(0)}</span>}
            {visitCount>0 && <span style={{ background:"#e0f2fe",color:"#0369a1",border:"1px solid #7dd3fc",borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:600 }}>📅 {visitCount} виз.</span>}
            <span style={{ background:"#f3f4f6",color:"#6b7280",border:"1px solid #e5e7eb",borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:600 }}>👥 {members.length} чел.</span>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
          <div style={{ width:44,height:44,borderRadius:"50%",background:`conic-gradient(#6366f1 ${avgCriteria/5*100}%,#e2e8f0 0)`,display:"flex",alignItems:"center",justifyContent:"center" }}>
            <div style={{ width:32,height:32,borderRadius:"50%",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#6366f1" }}>{avgCriteria.toFixed(1)}</div>
          </div>
          <span style={{ fontSize:16, color:"#94a3b8" }}>{expanded?"▲":"▼"}</span>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ padding:"0 20px 20px", borderTop:"1px solid #f1f5f9", display:"flex", flexDirection:"column", gap:12 }}>

          {/* Members detail */}
          <SectionToggle label="Члены семьи" icon="👥" defaultOpen={true} badge={members.length}>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {members.map((m,i) => (
                <div key={m.id||i} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:"10px 14px" }}>
                  <div style={{ fontWeight:700, fontSize:14, color:"#1e293b", marginBottom:6 }}>
                    {m.lastName} {m.firstName}
                    {m.relation && <span style={{ fontWeight:400, color:"#6366f1", fontSize:13 }}> · {m.relation}</span>}
                  </div>
                  <div style={{ display:"flex", gap:12, flexWrap:"wrap", fontSize:13, color:"#64748b" }}>
                    {m.dob && <span>📅 {formatDate(m.dob)}</span>}
                    {m.misCode && <span>🔢 {m.misCode}</span>}
                    {m.phone && <span>📞 {m.phone}</span>}
                    {m.email && <span>✉️ {m.email}</span>}
                  </div>
                </div>
              ))}
            </div>
          </SectionToggle>

          {family.comment && <div style={{ background:"#f8fafc", borderRadius:8, padding:"10px 14px", fontSize:14, color:"#475569" }}>💬 {family.comment}</div>}

          <SectionToggle label="Оценка критериев" icon="📊" defaultOpen={false}>
            <CriteriaSliders value={family.criteria||{}} onChange={()=>{}} readOnly />
          </SectionToggle>

          {(family.aid||[]).length>0 && (
            <SectionToggle label={`Оказанная помощь — €${totalAid.toFixed(2)}`} icon="💶" defaultOpen={false} accent="#059669">
              <AidReadOnly aid={family.aid} />
            </SectionToggle>
          )}

          {visitCount>0 && (
            <SectionToggle label={`История визитов (${visitCount})`} icon="📅" defaultOpen={false} accent="#0284c7">
              <VisitHistoryReadOnly visits={family.visits} />
            </SectionToggle>
          )}

          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", flexWrap:"wrap" }}>
            <button onClick={()=>exportPDF(family)} style={{ ...btnSecondary, color:"#7c3aed", borderColor:"#c4b5fd", fontSize:13 }}>📄 PDF</button>
            <button onClick={()=>onEdit(family)} style={btnSecondary}>✏️ Изменить</button>
            <button onClick={()=>{if(confirm(`Удалить семью "${family.familyName}"?`))onDelete(family.id);}} style={btnDanger}>🗑️ Удалить</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AidReadOnly({ aid }) {
  const years = [...new Set(aid.map(a=>a.year))].sort((a,b)=>b-a);
  const [yr, setYr] = useState(years[0]||new Date().getFullYear());
  const filtered = aid.filter(a=>a.year===yr);
  const total = filtered.reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <div style={{ display:"flex", gap:6 }}>
        {years.map(y=>(
          <button key={y} onClick={()=>setYr(y)} style={{ padding:"3px 10px", borderRadius:6, border:"1px solid", cursor:"pointer", fontSize:12, background:yr===y?"#059669":"#fff", color:yr===y?"#fff":"#475569", borderColor:yr===y?"#059669":"#e2e8f0" }}>{y}</button>
        ))}
      </div>
      {filtered.sort((a,b)=>a.month-b.month).map(a=>(
        <div key={a.id} style={{ display:"flex", justifyContent:"space-between", padding:"6px 10px", background:"#f0fdf4", borderRadius:7 }}>
          <span style={{ fontSize:13 }}>{MONTHS_RU[a.month]} {a.year}</span>
          <span style={{ fontWeight:700, color:"#059669" }}>€{parseFloat(a.amount).toFixed(2)}</span>
        </div>
      ))}
      <div style={{ fontWeight:800, color:"#059669", textAlign:"right", fontSize:14, borderTop:"1px solid #bbf7d0", paddingTop:6 }}>Итого {yr}: €{total.toFixed(2)}</div>
    </div>
  );
}

function VisitHistoryReadOnly({ visits }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
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

// ── Login ─────────────────────────────────────────────────────────────────
function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async () => {
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError("Неверный email или пароль");
    setLoading(false);
  };
  const handleReset = async () => {
    if (!email) return setError("Введите email для сброса пароля");
    await supabase.auth.resetPasswordForEmail(email);
    setResetSent(true);
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1e1b4b,#312e81,#4c1d95)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"rgba(255,255,255,0.05)", backdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:20, padding:48, width:380, textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:8 }}>🏥</div>
        <h1 style={{ color:"#fff", fontSize:22, marginBottom:4 }}>База клиентов</h1>
        <p style={{ color:"#a5b4fc", fontSize:14, marginBottom:28 }}>Социальный центр</p>
        <input type="email" placeholder="Email" value={email}
          onChange={e=>{setEmail(e.target.value);setError("");}}
          onKeyDown={e=>e.key==="Enter"&&handleLogin()}
          style={{ width:"100%",padding:"12px 16px",borderRadius:10,fontSize:15,border:error?"2px solid #f87171":"2px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.1)",color:"#fff",outline:"none",boxSizing:"border-box",marginBottom:10 }} />
        <input type="password" placeholder="Пароль" value={password}
          onChange={e=>{setPassword(e.target.value);setError("");}}
          onKeyDown={e=>e.key==="Enter"&&handleLogin()}
          style={{ width:"100%",padding:"12px 16px",borderRadius:10,fontSize:15,border:error?"2px solid #f87171":"2px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.1)",color:"#fff",outline:"none",boxSizing:"border-box",marginBottom:8 }} />
        {error && <p style={{ color:"#f87171",fontSize:13,marginBottom:8 }}>{error}</p>}
        {resetSent && <p style={{ color:"#86efac",fontSize:13,marginBottom:8 }}>Письмо отправлено — проверьте почту</p>}
        <button onClick={handleLogin} disabled={loading}
          style={{ ...btnPrimary,width:"100%",padding:"12px",fontSize:15,marginBottom:12,opacity:loading?0.7:1 }}>
          {loading?"Вход...":"Войти"}
        </button>
        <button onClick={handleReset} style={{ background:"none",border:"none",color:"#a5b4fc",fontSize:13,cursor:"pointer",textDecoration:"underline" }}>Забыли пароль?</button>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => setSession(data.session));
    const {data:listener} = supabase.auth.onAuthStateChange((_e,s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    setLoading(true);
    supabase.from("families").select("*").order("family_name")
      .then(({data,error}) => {
        if (data) setFamilies(data.map(fromDB));
        if (error) console.error(error);
        setLoading(false);
      });
  }, [session]);

  const hasFilters = search || filter !== "all";

  const filtered = useMemo(() => families.filter(f => {
    const name = f.familyName.toLowerCase();
    const members = (f.members||[]).map(m=>`${m.lastName} ${m.firstName}`.toLowerCase()).join(" ");
    if (search && !name.includes(search.toLowerCase()) && !members.includes(search.toLowerCase())) return false;
    if (filter==="specialNeeds" && !f.specialNeeds) return false;
    if (filter==="urgent") { const d=daysUntil(f.nextVisit); if(d===null||d>30) return false; }
    return true;
  }), [families, search, filter]);

  const saveFamily = async (form) => {
    const row = toDB(form);
    const isNew = form.id==="new" || !families.find(f=>f.id===form.id);
    if (isNew) {
      const {data,error} = await supabase.from("families").insert(row).select();
      if (error) { alert("Ошибка: "+error.message); return; }
      setFamilies(prev => [...prev, fromDB(data[0])]);
    } else {
      const {error} = await supabase.from("families").update(row).eq("id",form.id);
      if (error) { alert("Ошибка: "+error.message); return; }
      setFamilies(prev => prev.map(f => f.id===form.id ? {...fromDB({...row,id:form.id}), id:form.id} : f));
    }
    setModal(null);
  };

  const deleteFamily = async (id) => {
    const {error} = await supabase.from("families").delete().eq("id",id);
    if (error) { alert("Ошибка: "+error.message); return; }
    setFamilies(prev => prev.filter(f=>f.id!==id));
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setSession(null); setFamilies([]); };
  const resetFilters = () => { setSearch(""); setFilter("all"); };

  if (!session) return <LoginScreen />;

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", color:"#6366f1" }}>
        <div style={{ fontSize:40, marginBottom:12 }}>⏳</div>
        <div style={{ fontSize:16, fontWeight:600 }}>Загрузка данных...</div>
      </div>
    </div>
  );

  const urgentCount = families.filter(f=>{const d=daysUntil(f.nextVisit);return d!==null&&d<=30;}).length;
  const totalMembers = families.reduce((s,f)=>s+(f.members||[]).length,0);

  return (
    <div style={{ minHeight:"100vh", background:"#f1f5f9", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ background:"linear-gradient(135deg,#4f46e5,#7c3aed)", padding:"20px 24px", color:"#fff", boxShadow:"0 4px 20px rgba(79,70,229,0.4)" }}>
        <div style={{ maxWidth:920, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800 }}>🏥 База клиентов</h1>
            <div style={{ fontSize:13, opacity:0.8, marginTop:2 }}>
              {session.user.email} · Семей: {families.length} · Человек: {totalMembers} ·
              <span style={{ color:"#fca5a5",fontWeight:700 }}> Срочно: {urgentCount}</span>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button onClick={()=>exportExcel(families)} style={{ ...btnSecondary,background:"rgba(255,255,255,0.15)",color:"#fff",borderColor:"rgba(255,255,255,0.3)",fontSize:13 }}>
              📊 Экспорт CSV
            </button>
            <button onClick={()=>setModal("new")} style={{ ...btnPrimary,background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.4)" }}>
              ➕ Новая семья
            </button>
            <button onClick={handleLogout} style={{ ...btnSecondary,background:"transparent",color:"#fff",borderColor:"rgba(255,255,255,0.3)" }}>
              🚪 Выйти
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:920, margin:"0 auto", padding:"24px 16px" }}>
        <div style={{ display:"flex", gap:10, marginBottom:hasFilters?8:16, flexWrap:"wrap", alignItems:"center" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="🔍 Поиск по названию семьи или имени..."
            style={{ flex:1, minWidth:200, ...inputStyle, margin:0 }} />
          {["all","specialNeeds","urgent"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{
              padding:"8px 14px", borderRadius:8, border:"1px solid", cursor:"pointer", fontWeight:600, fontSize:13,
              background:filter===f?"#6366f1":"#fff", color:filter===f?"#fff":"#475569", borderColor:filter===f?"#6366f1":"#e2e8f0"
            }}>{f==="all"?"Все":f==="specialNeeds"?"⭐ Special Needs":"🔴 Срочные"}</button>
          ))}
          {hasFilters && (
            <button onClick={resetFilters} style={{ ...btnSecondary,color:"#dc2626",borderColor:"#fca5a5",fontSize:13 }}>✕ Сбросить</button>
          )}
        </div>

        {hasFilters && <div style={{ fontSize:13, color:"#64748b", marginBottom:12 }}>Показано: {filtered.length} из {families.length}</div>}

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {filtered.length===0 && (
            <div style={{ textAlign:"center", padding:60, color:"#94a3b8" }}>
              <div style={{ fontSize:48 }}>📋</div>
              <div style={{ fontSize:16, marginTop:8 }}>Семей не найдено</div>
              {hasFilters && <button onClick={resetFilters} style={{ ...btnSecondary,marginTop:12,color:"#6366f1" }}>Сбросить фильтры</button>}
            </div>
          )}
          {filtered.map(f=>(
            <FamilyCard key={f.id} family={f} onEdit={setModal} onDelete={deleteFamily} />
          ))}
        </div>
      </div>

      {modal && (
        <FamilyModal family={modal==="new"?null:modal} onSave={saveFamily} onClose={()=>setModal(null)} />
      )}
    </div>
  );
}
