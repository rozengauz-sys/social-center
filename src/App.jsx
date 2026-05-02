import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabase";

// ── Constants ─────────────────────────────────────────────────────────────
const CRITERIA = ["Мобильность","Когнитивные функции","Социальная изоляция","Финансовое положение","Состояние здоровья"];
const MONTHS_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

// ── Helpers ───────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return "—";
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.ceil((new Date(dateStr) - today) / 86400000);
}
function calcAge(dob) {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth()===birth.getMonth() && today.getDate()<birth.getDate())) age--;
  return age;
}
function isMinor(dob) { const a = calcAge(dob); return a !== null && a < 18; }

// ── DB converters ─────────────────────────────────────────────────────────
function fromDB(row) {
  return {
    id: row.id,
    familyName: row.family_name || "",
    address: row.address || "",
    city: row.city || "",
    specialNeeds: row.special_needs || false,
    socialCenter: row.social_center || false,
    criteria: row.criteria || {0:0,1:0,2:0,3:0,4:0},
    comment: row.comment || "",
    nextVisit: row.next_visit || "",
    aid: row.aid || [],
    visits: row.visits || [],
    members: row.members || [],
    jccPrograms: row.jcc_programs || [],
  };
}
function toDB(form) {
  return {
    family_name: form.familyName,
    address: form.address,
    city: form.city,
    special_needs: form.specialNeeds,
    social_center: form.socialCenter,
    criteria: form.criteria,
    comment: form.comment,
    next_visit: form.nextVisit || null,
    aid: form.aid,
    visits: form.visits,
    members: form.members,
    jcc_programs: form.jccPrograms,
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
        padding:"10px 14px", background:open?"#f5f3ff":"#f8fafc",
        border:"none", cursor:"pointer", fontWeight:700, fontSize:13, color:accent,
        borderBottom:open?"1px solid #e2e8f0":"none"
      }}>
        <span style={{ display:"flex", alignItems:"center", gap:8 }}>
          {icon} {label}
          {badge!=null && <span style={{ background:accent, color:"#fff", borderRadius:10, padding:"1px 8px", fontSize:11 }}>{badge}</span>}
        </span>
        <span style={{ fontSize:11, opacity:0.7 }}>{open?"▲ свернуть":"▼ развернуть"}</span>
      </button>
      {open && <div style={{ padding:14 }}>{children}</div>}
    </div>
  );
}

function VisitBadge({ date }) {
  const days = daysUntil(date);
  if (!date) return <span style={{ color:"#94a3b8", fontSize:13 }}>Не задано</span>;
  const isOverdue = days < 0, isRed = days <= 30;
  return (
    <span style={{
      background:isOverdue?"#7f1d1d":isRed?"#fee2e2":"#f0fdf4",
      color:isOverdue?"#fca5a5":isRed?"#b91c1c":"#166534",
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

function CriteriaSliders({ value, onChange, readOnly }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {CRITERIA.map((name,i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ width:180, fontSize:13, color:"#475569", flexShrink:0 }}>{name}</span>
          <input type="range" min={0} max={5} value={value[i]??0}
            disabled={readOnly} onChange={e=>onChange({...value,[i]:+e.target.value})}
            style={{ flex:1, accentColor:"#6366f1" }} />
          <span style={{ width:20, textAlign:"center", fontWeight:700, color:"#6366f1" }}>{value[i]??0}</span>
        </div>
      ))}
    </div>
  );
}

// ── JCC Programs Manager ──────────────────────────────────────────────────
function JCCProgramsManager({ allPrograms, onProgramsChange }) {
  const [newName, setNewName] = useState("");
  const add = async () => {
    if (!newName.trim()) return;
    const { data, error } = await supabase.from("jcc_programs").insert({ name: newName.trim() }).select();
    if (!error && data) { onProgramsChange([...allPrograms, data[0]]); setNewName(""); }
    else alert("Программа с таким названием уже существует");
  };
  const del = async (id) => {
    if (!confirm("Удалить программу из справочника?")) return;
    await supabase.from("jcc_programs").delete().eq("id", id);
    onProgramsChange(allPrograms.filter(p=>p.id!==id));
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {allPrograms.map(p => (
        <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 10px", background:"#f8fafc", borderRadius:7, border:"1px solid #e2e8f0" }}>
          <span style={{ fontSize:13, fontWeight:600 }}>{p.name}</span>
          <button onClick={()=>del(p.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#f87171", fontSize:14, padding:0 }}>✕</button>
        </div>
      ))}
      <div style={{ display:"flex", gap:8 }}>
        <input value={newName} onChange={e=>setNewName(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&add()}
          placeholder="Название новой программы..." style={{ ...inputStyle, flex:1 }} />
        <button onClick={add} style={{ ...btnPrimary, padding:"8px 14px", fontSize:13 }}>➕</button>
      </div>
    </div>
  );
}

// ── Member JCC Section ────────────────────────────────────────────────────
function MemberJCC({ member, allPrograms, onChange }) {
  const jcc = member.jcc || { active: false, programs: [] };
  const setJcc = (val) => onChange({ ...member, jcc: val });

  const toggleProgram = (progId) => {
    const exists = jcc.programs.find(p=>p.id===progId);
    if (exists) {
      setJcc({ ...jcc, programs: jcc.programs.filter(p=>p.id!==progId) });
    } else {
      const prog = allPrograms.find(p=>p.id===progId);
      setJcc({ ...jcc, programs: [...jcc.programs, { id:progId, name:prog.name, notes:"" }] });
    }
  };

  const updateNotes = (progId, notes) => {
    setJcc({ ...jcc, programs: jcc.programs.map(p=>p.id===progId?{...p,notes}:p) });
  };

  return (
    <div style={{ marginTop:8 }}>
      <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginBottom:8 }}>
        <input type="checkbox" checked={jcc.active} onChange={e=>setJcc({...jcc,active:e.target.checked})} style={{ accentColor:"#0284c7", width:16, height:16 }} />
        <span style={{ fontSize:13, fontWeight:700, color:"#0284c7" }}>🏛 Участвует в JCC</span>
      </label>
      {jcc.active && (
        <div style={{ paddingLeft:24, display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:0.5 }}>Программы:</div>
          {allPrograms.map(prog => {
            const selected = jcc.programs.find(p=>p.id===prog.id);
            return (
              <div key={prog.id}>
                <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginBottom: selected?4:0 }}>
                  <input type="checkbox" checked={!!selected} onChange={()=>toggleProgram(prog.id)} style={{ accentColor:"#0284c7" }} />
                  <span style={{ fontSize:13, fontWeight:600 }}>{prog.name}</span>
                </label>
                {selected && (
                  <textarea
                    value={selected.notes||""}
                    onChange={e=>updateNotes(prog.id,e.target.value)}
                    placeholder={`Заметки об участии (например: Оламейну 2025, 22.02, 15.03...)`}
                    style={{ ...inputStyle, height:56, resize:"vertical", marginLeft:24, width:"calc(100% - 24px)", fontSize:12 }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Members Editor ────────────────────────────────────────────────────────
const emptyMember = () => ({
  id: Date.now() + Math.random(),
  lastName:"", firstName:"", dob:"", relation:"", misCode:"", phone:"", email:"",
  isMadrich: false, isVolunteer: false,
  jcc: { active: false, programs: [] }
});

function MembersEditor({ members, onChange, allPrograms, isHesed }) {
  const add = () => onChange([...members, emptyMember()]);
  const upd = (id, field, val) => onChange(members.map(m=>m.id===id?{...m,[field]:val}:m));
  const updMember = (id, updated) => onChange(members.map(m=>m.id===id?updated:m));
  const del = (id) => { if(confirm("Удалить члена семьи?")) onChange(members.filter(m=>m.id!==id)); };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {members.map((m,idx) => (
        <div key={m.id} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:12, padding:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontWeight:700, fontSize:13, color:"#6366f1" }}>
              👤 Член семьи #{idx+1}
              {isMinor(m.dob) && <span style={{ marginLeft:8, background:"#fef3c7", color:"#92400e", border:"1px solid #fcd34d", borderRadius:4, padding:"1px 6px", fontSize:11 }}>👶 несовершеннолетний</span>}
            </span>
            <button onClick={()=>del(m.id)} style={{ background:"none", border:"1px solid #fca5a5", borderRadius:6, color:"#f87171", cursor:"pointer", padding:"3px 10px", fontSize:12 }}>Удалить</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <label style={labelStyle}>Фамилия *<input style={inputStyle} value={m.lastName} onChange={e=>upd(m.id,"lastName",e.target.value)} placeholder="Иванов" /></label>
            <label style={labelStyle}>Имя *<input style={inputStyle} value={m.firstName} onChange={e=>upd(m.id,"firstName",e.target.value)} placeholder="Иван" /></label>
            <label style={labelStyle}>Дата рождения<input type="date" style={inputStyle} value={m.dob} onChange={e=>upd(m.id,"dob",e.target.value)} /></label>
            <label style={labelStyle}>Степень родства<input style={inputStyle} value={m.relation} onChange={e=>upd(m.id,"relation",e.target.value)} placeholder="Муж, жена, сын..." /></label>
            <label style={labelStyle}>Код MIS<input style={inputStyle} value={m.misCode} onChange={e=>upd(m.id,"misCode",e.target.value)} placeholder="MIS-001" /></label>
            <label style={labelStyle}>Телефон<input style={inputStyle} value={m.phone} onChange={e=>upd(m.id,"phone",e.target.value)} placeholder="+972-50-000-0000" /></label>
            <label style={{ ...labelStyle, gridColumn:"1/-1" }}>Email<input type="email" style={inputStyle} value={m.email} onChange={e=>upd(m.id,"email",e.target.value)} placeholder="ivan@example.com" /></label>
          </div>
          <div style={{ display:"flex", gap:20, marginTop:10, flexWrap:"wrap" }}>
            <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
              <input type="checkbox" checked={!!m.isMadrich} onChange={e=>upd(m.id,"isMadrich",e.target.checked)} style={{ accentColor:"#7c3aed", width:16, height:16 }} />
              <span style={{ fontSize:13, fontWeight:700, color:"#7c3aed" }}>&#127891; Мадрих</span>
            </label>
            <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
              <input type="checkbox" checked={!!m.isVolunteer} onChange={e=>upd(m.id,"isVolunteer",e.target.checked)} style={{ accentColor:"#0891b2", width:16, height:16 }} />
              <span style={{ fontSize:13, fontWeight:700, color:"#0891b2" }}>&#129309; Волонтёр</span>
            </label>
          </div>
          {!isHesed && <MemberJCC member={m} allPrograms={allPrograms} onChange={updated=>updMember(m.id,updated)} />}
        </div>
      ))}
      <button onClick={add} style={{ ...btnSecondary, alignSelf:"flex-start", fontSize:13 }}>➕ Добавить члена семьи</button>
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
  const filtered = aid.filter(a=>a.year===filterYear);
  const total = filtered.reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
  const addEntry = () => {
    if (!amt||isNaN(amt)) return;
    const exists = aid.find(a=>a.month===+nm&&a.year===+ny);
    onChange(exists ? aid.map(a=>a.month===+nm&&a.year===+ny?{...a,amount:parseFloat(amt)}:a)
      : [...aid,{id:Date.now(),month:+nm,year:+ny,amount:parseFloat(amt)}]);
    setAmt("");
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"flex-end" }}>
        <label style={{ ...labelStyle, flex:"0 0 auto" }}>Месяц
          <select value={nm} onChange={e=>setNm(+e.target.value)} style={{ ...inputStyle, width:130 }}>
            {MONTHS_RU.map((m,i)=><option key={i} value={i}>{m}</option>)}
          </select>
        </label>
        <label style={{ ...labelStyle, flex:"0 0 auto" }}>Год
          <select value={ny} onChange={e=>setNy(+e.target.value)} style={{ ...inputStyle, width:90 }}>
            {years.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label style={{ ...labelStyle, flex:1, minWidth:100 }}>Сумма (€)
          <input type="number" min={0} step={0.01} value={amt} onChange={e=>setAmt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addEntry()} placeholder="0.00" style={inputStyle} />
        </label>
        <button onClick={addEntry} style={{ ...btnPrimary, padding:"9px 14px", alignSelf:"flex-end", fontSize:13 }}>➕</button>
      </div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {years.map(y=><button key={y} onClick={()=>setFilterYear(y)} style={{ padding:"4px 10px", borderRadius:6, border:"1px solid", cursor:"pointer", fontSize:12, fontWeight:600, background:filterYear===y?"#059669":"#fff", color:filterYear===y?"#fff":"#475569", borderColor:filterYear===y?"#059669":"#e2e8f0" }}>{y}</button>)}
      </div>
      {filtered.length===0 ? <div style={{ color:"#94a3b8", fontSize:13, textAlign:"center" }}>Нет записей за {filterYear}</div> : <>
        {filtered.sort((a,b)=>a.month-b.month).map(a=>(
          <div key={a.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 12px", borderRadius:8, background:"#f8fafc", border:"1px solid #e2e8f0" }}>
            <span style={{ fontSize:14 }}>{MONTHS_RU[a.month]} {a.year}</span>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontWeight:700, color:"#059669" }}>€{parseFloat(a.amount).toFixed(2)}</span>
              <button onClick={()=>onChange(aid.filter(x=>x.id!==a.id))} style={{ background:"none", border:"none", cursor:"pointer", color:"#f87171", fontSize:15, padding:0 }}>✕</button>
            </div>
          </div>
        ))}
        <div style={{ fontWeight:800, color:"#059669", textAlign:"right", fontSize:14, borderTop:"2px solid #d1fae5", paddingTop:6 }}>Итого {filterYear}: €{total.toFixed(2)}</div>
      </>}
    </div>
  );
}

function VisitHistory({ visits=[], onChange }) {
  const add = () => onChange([...visits,{id:Date.now(),date:new Date().toISOString().split("T")[0],notes:"",worker:""}]);
  const upd = (id,f,v) => onChange(visits.map(x=>x.id===id?{...x,[f]:v}:x));
  const del = (id) => { if(confirm("Удалить запись?")) onChange(visits.filter(x=>x.id!==id)); };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      <button onClick={add} style={{ ...btnSecondary, alignSelf:"flex-start", fontSize:13 }}>➕ Добавить запись</button>
      {visits.length===0 ? <div style={{ color:"#94a3b8", fontSize:13 }}>История визитов пуста</div>
        : [...visits].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(v=>(
        <div key={v.id} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:12, display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <input type="date" value={v.date} onChange={e=>upd(v.id,"date",e.target.value)} style={{ ...inputStyle, width:160 }} />
            <input value={v.worker} placeholder="Сотрудник" onChange={e=>upd(v.id,"worker",e.target.value)} style={{ ...inputStyle, flex:1, minWidth:120 }} />
            <button onClick={()=>del(v.id)} style={{ background:"none", border:"1px solid #fca5a5", borderRadius:6, color:"#f87171", cursor:"pointer", padding:"4px 10px", fontSize:12 }}>🗑</button>
          </div>
          <textarea value={v.notes} placeholder="Заметки..." onChange={e=>upd(v.id,"notes",e.target.value)} style={{ ...inputStyle, height:60, resize:"vertical" }} />
        </div>
      ))}
    </div>
  );
}

// ── Read-only subcomponents ───────────────────────────────────────────────
function AidReadOnly({ aid }) {
  const years = [...new Set(aid.map(a=>a.year))].sort((a,b)=>b-a);
  const [yr, setYr] = useState(years[0]||new Date().getFullYear());
  const filtered = aid.filter(a=>a.year===yr);
  const total = filtered.reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <div style={{ display:"flex", gap:6 }}>{years.map(y=><button key={y} onClick={()=>setYr(y)} style={{ padding:"3px 10px", borderRadius:6, border:"1px solid", cursor:"pointer", fontSize:12, background:yr===y?"#059669":"#fff", color:yr===y?"#fff":"#475569", borderColor:yr===y?"#059669":"#e2e8f0" }}>{y}</button>)}</div>
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
function VisitsReadOnly({ visits }) {
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

// ── Excel Export ──────────────────────────────────────────────────────────
function exportExcel(families) {
  const headers = ["Семья","Фамилия","Имя","Дата рождения","Возраст","Несовершеннолетний","Степень родства","Код MIS","Телефон","Email","Мадрих","Волонтёр","Город","Адрес","Special Needs","Социальный центр","JCC","Программы JCC","Следующий визит","Помощь итого (€)","Комментарий"];
  const rows = [headers];
  families.forEach(f => {
    const totalAid = (f.aid||[]).reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
    const members = f.members||[];
    const makeRow = (m) => {
      const age = m ? calcAge(m.dob) : null;
      const jccProgs = m?.jcc?.active ? (m.jcc.programs||[]).map(p=>p.name).join(", ") : "";
      return [
        f.familyName,
        m?.lastName||"", m?.firstName||"",
        m?.dob ? formatDate(m.dob) : "—",
        age !== null ? age : "—",
        m?.dob ? (isMinor(m.dob)?"Да":"Нет") : "—",
        m?.relation||"", m?.misCode||"", m?.phone||"", m?.email||"",
        m?.isMadrich?"Да":"Нет",
        m?.isVolunteer?"Да":"Нет",
        f.city||"", f.address||"",
        f.specialNeeds?"Да":"Нет",
        f.socialCenter?"Да":"Нет",
        m?.jcc?.active?"Да":"Нет",
        jccProgs,
        formatDate(f.nextVisit),
        totalAid.toFixed(2),
        f.comment||""
      ];
    };
    if (members.length===0) rows.push(makeRow(null));
    else members.forEach(m => rows.push(makeRow(m)));
  });
  const csv = rows.map(r=>r.map(c=>`"${String(c||"").replace(/"/g,'""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download="clients_export.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── PDF Export ────────────────────────────────────────────────────────────
function exportPDF(families) {
  const totalAidAll = (f) => (f.aid||[]).reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
  const avgCrit = (f) => Object.values(f.criteria||{}).reduce((a,b)=>a+b,0)/CRITERIA.length;

  const familyHTML = (f) => `
    <div class="family">
      <h2>${f.familyName||"Без названия"} ${f.specialNeeds?'<span class="badge sn">⭐ Special Needs</span>':""} ${f.socialCenter?'<span class="badge sc">🏥 Соц. центр</span>':""}</h2>
      <div class="meta">${f.city?f.city+", ":""}${f.address||""} · Визит: ${formatDate(f.nextVisit)}</div>
      ${f.comment?`<div class="comment">💬 ${f.comment}</div>`:""}
      <h3>👥 Члены семьи</h3>
      ${(f.members||[]).map(m=>`
        <div class="member">
          <div class="mname">${m.lastName} ${m.firstName}${m.relation?` <span class="rel">(${m.relation})</span>`:""} ${isMinor(m.dob)?'<span class="badge minor">👶 несовершеннолетний</span>':""}</div>
          <div class="mgrid">
            <div class="f"><div class="fl">Дата рождения</div><div class="fv">${formatDate(m.dob)}</div></div>
            <div class="f"><div class="fl">Возраст</div><div class="fv">${calcAge(m.dob)??'—'} лет</div></div>
            <div class="f"><div class="fl">Код MIS</div><div class="fv">${m.misCode||"—"}</div></div>
            <div class="f"><div class="fl">Телефон</div><div class="fv">${m.phone||"—"}</div></div>
            <div class="f"><div class="fl">Email</div><div class="fv">${m.email||"—"}</div></div>
            ${m.jcc?.active?`<div class="f" style="grid-column:1/-1"><div class="fl">JCC программы</div><div class="fv">${(m.jcc.programs||[]).map(p=>`${p.name}${p.notes?` (${p.notes})`:""}`).join("; ")||"—"}</div></div>`:""}
          </div>
        </div>
      `).join("")}
      <h3>📊 Критерии (среднее: ${avgCrit(f).toFixed(1)}/5)</h3>
      ${CRITERIA.map((n,i)=>`<div class="cr"><span class="crl">${n}</span><div class="crb"><div class="crf" style="width:${((f.criteria[i]||0)/5)*100}%"></div></div><span class="crv">${f.criteria[i]||0}</span></div>`).join("")}
      ${f.socialCenter && (f.aid||[]).length>0?`<h3>💶 Помощь — €${totalAidAll(f).toFixed(2)}</h3>${(f.aid||[]).sort((a,b)=>b.year-a.year||(a.month-b.month)).map(a=>`<div class="aid"><span>${MONTHS_RU[a.month]} ${a.year}</span><span>€${parseFloat(a.amount).toFixed(2)}</span></div>`).join("")}`:""}
      ${f.socialCenter && (f.visits||[]).length>0?`<h3>📅 Визиты (${f.visits.length})</h3>${[...f.visits].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(v=>`<div class="visit"><div class="vh"><span>${formatDate(v.date)}</span>${v.worker?`<span>👤 ${v.worker}</span>`:""}</div>${v.notes?`<div class="vn">${v.notes}</div>`:""}</div>`).join("")}`:""}
    </div>
  `;

  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"/>
  <style>
    body{font-family:Arial,sans-serif;color:#1e293b;padding:24px;font-size:12px}
    .family{margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #e2e8f0;page-break-inside:avoid}
    h1{font-size:20px;color:#4f46e5;margin-bottom:4px} h2{font-size:16px;color:#4f46e5;margin:0 0 4px} h3{font-size:12px;color:#4f46e5;margin:12px 0 6px;border-bottom:1px solid #e0e7ff;padding-bottom:3px}
    .meta{color:#64748b;font-size:11px;margin-bottom:8px}
    .badge{display:inline-block;border-radius:4px;padding:1px 7px;font-size:10px;font-weight:700;margin-left:6px}
    .badge.sn{background:#fef3c7;color:#92400e;border:1px solid #fcd34d}
    .badge.sc{background:#d1fae5;color:#065f46;border:1px solid #6ee7b7}
    .badge.minor{background:#fef9c3;color:#713f12;border:1px solid #fde047}
    .comment{background:#f8fafc;border-left:3px solid #6366f1;padding:6px 10px;margin-bottom:8px;font-style:italic;color:#475569}
    .member{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:6px}
    .mname{font-weight:700;font-size:13px;margin-bottom:6px} .rel{font-weight:400;color:#6366f1;font-size:12px}
    .mgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px}
    .f{background:#fff;border-radius:4px;padding:5px 7px} .fl{font-size:9px;color:#94a3b8;font-weight:700;text-transform:uppercase} .fv{font-size:12px;font-weight:600}
    .cr{display:flex;align-items:center;gap:8px;margin-bottom:3px} .crl{font-size:11px;color:#475569;width:160px} .crb{flex:1;height:7px;background:#e2e8f0;border-radius:3px;overflow:hidden} .crf{height:100%;background:#6366f1;border-radius:3px} .crv{font-size:11px;font-weight:700;color:#6366f1;width:14px;text-align:right}
    .aid{display:flex;justify-content:space-between;padding:4px 8px;background:#f0fdf4;border-radius:4px;margin-bottom:3px;font-size:11px}
    .visit{background:#f0f9ff;border:1px solid #bae6fd;border-radius:5px;padding:7px;margin-bottom:4px} .vh{display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:#0369a1;margin-bottom:2px} .vn{font-size:11px;color:#475569}
    .footer{text-align:center;color:#94a3b8;font-size:10px;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:10px}
    @media print{.family{page-break-inside:avoid}}
  </style></head><body>
  <h1>🏥 База клиентов социального центра</h1>
  <div class="meta">Дата печати: ${formatDate(new Date().toISOString())} · Записей: ${families.length}</div>
  ${families.map(familyHTML).join("")}
  <div class="footer">База клиентов социального центра · ${new Date().toLocaleDateString("ru-RU")}</div>
  </body></html>`;

  const win = window.open("","_blank");
  win.document.write(html); win.document.close();
  setTimeout(()=>win.print(), 600);
}

// ── Family Modal ──────────────────────────────────────────────────────────
const emptyFamily = () => ({
  id:"new", familyName:"", address:"", city:"", specialNeeds:false, socialCenter:false,
  criteria:{0:0,1:0,2:0,3:0,4:0}, comment:"", nextVisit:"",
  aid:[], visits:[], members:[emptyMember()], jccPrograms:[]
});

function FamilyModal({ family, onSave, onClose, allPrograms, isHesed }) {
  const [form, setForm] = useState(family ? {...family} : emptyFamily());
  const [saving, setSaving] = useState(false);
  const set = (f,v) => setForm(x=>({...x,[f]:v}));

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.75)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:720, maxHeight:"93vh", overflow:"auto", boxShadow:"0 25px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ padding:"20px 28px", display:"flex", justifyContent:"space-between", alignItems:"center", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:"16px 16px 0 0", position:"sticky", top:0, zIndex:10 }}>
          <h2 style={{ margin:0, color:"#fff", fontSize:20 }}>{family?"✏️ Редактировать":"➕ Новая семья"}</h2>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff", borderRadius:8, padding:"4px 12px", cursor:"pointer", fontSize:18 }}>✕</button>
        </div>
        <div style={{ padding:28, display:"flex", flexDirection:"column", gap:20 }}>
          <label style={labelStyle}>Название семьи *
            <input style={inputStyle} value={form.familyName} onChange={e=>set("familyName",e.target.value)} placeholder="Семья Соколовых" />
          </label>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <label style={labelStyle}>Город<input style={inputStyle} value={form.city} onChange={e=>set("city",e.target.value)} placeholder="Тель-Авив" /></label>
            <label style={labelStyle}>Адрес<input style={inputStyle} value={form.address} onChange={e=>set("address",e.target.value)} placeholder="ул. Герцля, 5" /></label>
            <label style={labelStyle}>Дата следующего визита<input type="date" style={inputStyle} value={form.nextVisit} onChange={e=>set("nextVisit",e.target.value)} /></label>
          </div>
          <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
            <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
              <input type="checkbox" checked={form.specialNeeds} onChange={e=>set("specialNeeds",e.target.checked)} style={{ width:18,height:18,accentColor:"#6366f1" }} />
              <span style={{ fontSize:14, fontWeight:600 }}>🌟 Special Needs</span>
            </label>
            <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
              <input type="checkbox" checked={form.socialCenter} onChange={e=>set("socialCenter",e.target.checked)} style={{ width:18,height:18,accentColor:"#059669" }} />
              <span style={{ fontSize:14, fontWeight:600, color:"#059669" }}>🏥 Участвует в соц. центре</span>
            </label>
          </div>
          <label style={labelStyle}>Комментарий
            <textarea style={{ ...inputStyle, height:72, resize:"vertical" }} value={form.comment} onChange={e=>set("comment",e.target.value)} placeholder="Дополнительные заметки..." />
          </label>
          <SectionToggle label="Члены семьи" icon="👥" defaultOpen={true} badge={form.members.length}>
            <MembersEditor members={form.members} onChange={v=>set("members",v)} allPrograms={allPrograms} isHesed={isHesed} />
          </SectionToggle>
          <SectionToggle label="Оценка критериев (0–5)" icon="📊" defaultOpen={false}>
            <CriteriaSliders value={form.criteria} onChange={v=>set("criteria",v)} />
          </SectionToggle>
          {form.socialCenter && <>
            <SectionToggle label="Оказанная помощь (€)" icon="💶" defaultOpen={false} accent="#059669">
              <AidSection aid={form.aid} onChange={v=>set("aid",v)} />
            </SectionToggle>
            <SectionToggle label="История визитов" icon="📅" defaultOpen={false} accent="#0284c7">
              <VisitHistory visits={form.visits} onChange={v=>set("visits",v)} />
            </SectionToggle>
          </>}
        </div>
        <div style={{ padding:"16px 28px", borderTop:"1px solid #e2e8f0", display:"flex", justifyContent:"flex-end", gap:12, position:"sticky", bottom:0, background:"#fff" }}>
          <button onClick={onClose} style={btnSecondary}>Отмена</button>
          <button disabled={saving} onClick={async()=>{
            if(!form.familyName) return alert("Введите название семьи");
            if(form.members.length===0) return alert("Добавьте хотя бы одного члена семьи");
            if(form.members.find(m=>!m.lastName||!m.firstName)) return alert("Заполните фамилию и имя для каждого члена семьи");
            setSaving(true); await onSave(form); setSaving(false);
          }} style={{ ...btnPrimary, opacity:saving?0.7:1 }}>
            {saving?"Сохранение...":"💾 Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Family Card ───────────────────────────────────────────────────────────
function FamilyCard({ family, onEdit, onDelete, isJCC, isHesed }) {
  const [expanded, setExpanded] = useState(false);
  const totalAid = (family.aid||[]).reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
  const visitCount = (family.visits||[]).length;
  const avgCriteria = Object.values(family.criteria||{}).reduce((a,b)=>a+b,0)/CRITERIA.length;
  const members = family.members||[];
  const hasMinors = members.some(m=>isMinor(m.dob));
  const hasJCC = members.some(m=>m.jcc?.active);

  return (
    <div style={{ background:"#fff", borderRadius:12, border:"1px solid #e2e8f0", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", overflow:"hidden" }}>
      <div style={{ padding:"16px 20px", display:"flex", alignItems:"flex-start", gap:14, cursor:"pointer" }} onClick={()=>setExpanded(e=>!e)}>
        <div style={{ width:50,height:50,borderRadius:12,flexShrink:0,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:22 }}>🏠</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
            <span style={{ fontWeight:800, fontSize:16, color:"#1e293b" }}>{family.familyName||"Без названия"}</span>
            {family.specialNeeds && <span style={{ background:"#fef3c7",color:"#92400e",border:"1px solid #fcd34d",borderRadius:5,padding:"1px 7px",fontSize:11,fontWeight:700 }}>⭐ Special Needs</span>}
            {family.socialCenter && <span style={{ background:"#d1fae5",color:"#065f46",border:"1px solid #6ee7b7",borderRadius:5,padding:"1px 7px",fontSize:11,fontWeight:700 }}>🏥 Соц.центр</span>}
            {hasJCC && <span style={{ background:"#e0f2fe",color:"#0369a1",border:"1px solid #7dd3fc",borderRadius:5,padding:"1px 7px",fontSize:11,fontWeight:700 }}>🏛 JCC</span>}
            {hasMinors && <span style={{ background:"#fef9c3",color:"#713f12",border:"1px solid #fde047",borderRadius:5,padding:"1px 7px",fontSize:11,fontWeight:700 }}>👶 Дети</span>}
            {members.some(m=>m.isMadrich) && <span style={{ background:"#ede9fe",color:"#6d28d9",border:"1px solid #c4b5fd",borderRadius:5,padding:"1px 7px",fontSize:11,fontWeight:700 }}>🎓 Мадрих</span>}
            {members.some(m=>m.isVolunteer) && <span style={{ background:"#cffafe",color:"#0e7490",border:"1px solid #67e8f9",borderRadius:5,padding:"1px 7px",fontSize:11,fontWeight:700 }}>🤝 Волонтёр</span>}
          </div>
          <div style={{ fontSize:13, color:"#64748b", marginTop:2 }}>
            {members.map(m=>`${m.firstName} ${m.lastName}`).join(", ")||"Нет членов"}
          </div>
          <div style={{ fontSize:12, color:"#94a3b8" }}>{[family.city,family.address].filter(Boolean).join(", ")||"Адрес не указан"}</div>
          <div style={{ marginTop:6, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <VisitBadge date={family.nextVisit} />
            {!isJCC && totalAid>0 && <span style={{ background:"#d1fae5",color:"#065f46",border:"1px solid #6ee7b7",borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:600 }}>💶 €{totalAid.toFixed(0)}</span>}
            {!isJCC && visitCount>0 && <span style={{ background:"#e0f2fe",color:"#0369a1",border:"1px solid #7dd3fc",borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:600 }}>📅 {visitCount} виз.</span>}
            <span style={{ background:"#f3f4f6",color:"#6b7280",border:"1px solid #e5e7eb",borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:600 }}>👥 {members.length} чел.</span>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
          {!isJCC && <div style={{ width:44,height:44,borderRadius:"50%",background:`conic-gradient(#6366f1 ${avgCriteria/5*100}%,#e2e8f0 0)`,display:"flex",alignItems:"center",justifyContent:"center" }}>
            <div style={{ width:32,height:32,borderRadius:"50%",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#6366f1" }}>{avgCriteria.toFixed(1)}</div>
          </div>}
          <span style={{ fontSize:16, color:"#94a3b8" }}>{expanded?"▲":"▼"}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding:"0 20px 20px", borderTop:"1px solid #f1f5f9", display:"flex", flexDirection:"column", gap:12 }}>
          <SectionToggle label="Члены семьи" icon="👥" defaultOpen={true} badge={members.length}>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {members.map((m,i)=>(
                <div key={m.id||i} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:"10px 14px" }}>
                  <div style={{ fontWeight:700, fontSize:14, color:"#1e293b", marginBottom:6, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    {m.lastName} {m.firstName}
                    {m.relation && <span style={{ fontWeight:400, color:"#6366f1", fontSize:13 }}>· {m.relation}</span>}
                    {isMinor(m.dob) && <span style={{ background:"#fef9c3",color:"#713f12",border:"1px solid #fde047",borderRadius:4,padding:"1px 6px",fontSize:11,fontWeight:700 }}>👶 несовершеннолетний</span>}
                    {m.jcc?.active && <span style={{ background:"#e0f2fe",color:"#0369a1",border:"1px solid #7dd3fc",borderRadius:4,padding:"1px 6px",fontSize:11,fontWeight:700 }}>🏛 JCC</span>}
                    {m.isMadrich && <span style={{ background:"#ede9fe",color:"#6d28d9",border:"1px solid #c4b5fd",borderRadius:4,padding:"1px 6px",fontSize:11,fontWeight:700 }}>🎓 Мадрих</span>}
                    {m.isVolunteer && <span style={{ background:"#cffafe",color:"#0e7490",border:"1px solid #67e8f9",borderRadius:4,padding:"1px 6px",fontSize:11,fontWeight:700 }}>🤝 Волонтёр</span>}
                  </div>
                  <div style={{ display:"flex", gap:12, flexWrap:"wrap", fontSize:13, color:"#64748b" }}>
                    {m.dob && <span>📅 {formatDate(m.dob)}{calcAge(m.dob)!==null?` (${calcAge(m.dob)} лет)`:""}</span>}
                    {m.misCode && <span>🔢 {m.misCode}</span>}
                    {m.phone && <span>📞 {m.phone}</span>}
                    {m.email && <span>✉️ {m.email}</span>}
                  </div>
                  {m.jcc?.active && (m.jcc.programs||[]).length>0 && !isHesed && (
                    <div style={{ marginTop:6, paddingTop:6, borderTop:"1px solid #e2e8f0" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#0284c7", marginBottom:4 }}>Программы JCC:</div>
                      {m.jcc.programs.map(p=>(
                        <div key={p.id} style={{ fontSize:12, color:"#374151", marginBottom:2 }}>
                          <span style={{ fontWeight:600 }}>{p.name}</span>
                          {p.notes && <span style={{ color:"#64748b" }}> — {p.notes}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SectionToggle>

          {family.comment && <div style={{ background:"#f8fafc", borderRadius:8, padding:"10px 14px", fontSize:14, color:"#475569" }}>💬 {family.comment}</div>}

          {!isJCC && <SectionToggle label="Оценка критериев" icon="📊" defaultOpen={false}>
            <CriteriaSliders value={family.criteria||{}} onChange={()=>{}} readOnly />
          </SectionToggle>}

          {!isJCC && family.socialCenter && (family.aid||[]).length>0 && (
            <SectionToggle label={`Помощь — €${totalAid.toFixed(2)}`} icon="💶" defaultOpen={false} accent="#059669">
              <AidReadOnly aid={family.aid} />
            </SectionToggle>
          )}
          {!isJCC && family.socialCenter && visitCount>0 && (
            <SectionToggle label={`История визитов (${visitCount})`} icon="📅" defaultOpen={false} accent="#0284c7">
              <VisitsReadOnly visits={family.visits} />
            </SectionToggle>
          )}

          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", flexWrap:"wrap" }}>
            <button onClick={()=>exportPDF([family])} style={{ ...btnSecondary,color:"#7c3aed",borderColor:"#c4b5fd",fontSize:13 }}>📄 PDF</button>
            <button onClick={()=>onEdit(family)} style={btnSecondary}>✏️ Изменить</button>
            <button onClick={()=>{if(confirm(`Удалить "${family.familyName}"?`))onDelete(family.id);}} style={btnDanger}>🗑️ Удалить</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Person Card (individual view) ─────────────────────────────────────────
function PersonCard({ member, family, isJCC }) {
  const [expanded, setExpanded] = useState(false);
  const age = calcAge(member.dob);
  const familyMembers = (family.members||[]).filter(m=>m.id!==member.id);

  return (
    <div style={{ background:"#fff", borderRadius:12, border:"1px solid #e2e8f0", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", overflow:"hidden" }}>
      <div style={{ padding:"14px 20px", display:"flex", alignItems:"flex-start", gap:14, cursor:"pointer" }} onClick={()=>setExpanded(e=>!e)}>
        <div style={{ width:46,height:46,borderRadius:"50%",flexShrink:0,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:18 }}>
          {member.firstName?.[0]}{member.lastName?.[0]}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
            <span style={{ fontWeight:700, fontSize:15, color:"#1e293b" }}>{member.lastName} {member.firstName}</span>
            {member.relation && <span style={{ fontSize:12, color:"#6366f1", fontWeight:600 }}>{member.relation}</span>}
            {isMinor(member.dob) && <span style={{ background:"#fef9c3",color:"#713f12",border:"1px solid #fde047",borderRadius:4,padding:"1px 6px",fontSize:11,fontWeight:700 }}>👶</span>}
            {member.jcc?.active && <span style={{ background:"#e0f2fe",color:"#0369a1",border:"1px solid #7dd3fc",borderRadius:4,padding:"1px 6px",fontSize:11,fontWeight:700 }}>🏛 JCC</span>}
            {member.isMadrich && <span style={{ background:"#ede9fe",color:"#6d28d9",border:"1px solid #c4b5fd",borderRadius:4,padding:"1px 6px",fontSize:11,fontWeight:700 }}>🎓 Мадрих</span>}
            {member.isVolunteer && <span style={{ background:"#cffafe",color:"#0e7490",border:"1px solid #67e8f9",borderRadius:4,padding:"1px 6px",fontSize:11,fontWeight:700 }}>🤝 Волонтёр</span>}
          </div>
          <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>
            🏠 {family.familyName} · {member.dob?`${formatDate(member.dob)}${age!==null?` (${age} лет)`:""}`:""} {member.phone?`· 📞 ${member.phone}`:""}
          </div>
          {family.specialNeeds && <span style={{ background:"#fef3c7",color:"#92400e",border:"1px solid #fcd34d",borderRadius:4,padding:"1px 6px",fontSize:11,fontWeight:700,marginTop:4,display:"inline-block" }}>⭐ Special Needs</span>}
        </div>
        <span style={{ fontSize:16, color:"#94a3b8" }}>{expanded?"▲":"▼"}</span>
      </div>

      {expanded && (
        <div style={{ padding:"0 20px 16px", borderTop:"1px solid #f1f5f9", display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8 }}>
            {member.misCode && <div style={{ background:"#f8fafc",borderRadius:7,padding:"7px 10px" }}><div style={{ fontSize:10,color:"#94a3b8",fontWeight:700,textTransform:"uppercase" }}>Код MIS</div><div style={{ fontSize:13,fontWeight:600 }}>{member.misCode}</div></div>}
            {member.email && <div style={{ background:"#f8fafc",borderRadius:7,padding:"7px 10px" }}><div style={{ fontSize:10,color:"#94a3b8",fontWeight:700,textTransform:"uppercase" }}>Email</div><div style={{ fontSize:13,fontWeight:600 }}>{member.email}</div></div>}
            {family.city && <div style={{ background:"#f8fafc",borderRadius:7,padding:"7px 10px" }}><div style={{ fontSize:10,color:"#94a3b8",fontWeight:700,textTransform:"uppercase" }}>Город</div><div style={{ fontSize:13,fontWeight:600 }}>{family.city}</div></div>}
            {family.address && <div style={{ background:"#f8fafc",borderRadius:7,padding:"7px 10px" }}><div style={{ fontSize:10,color:"#94a3b8",fontWeight:700,textTransform:"uppercase" }}>Адрес</div><div style={{ fontSize:13,fontWeight:600 }}>{family.address}</div></div>}
          </div>

          {familyMembers.length>0 && (
            <div>
              <div style={{ fontSize:12,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.5,marginBottom:6 }}>Члены семьи</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {familyMembers.map(r=>(
                  <span key={r.id} style={{ background:"#ede9fe",color:"#5b21b6",border:"1px solid #a78bfa",borderRadius:16,padding:"3px 10px",fontSize:12,fontWeight:600 }}>
                    {r.lastName} {r.firstName}{r.relation?` (${r.relation})`:""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {member.jcc?.active && (member.jcc.programs||[]).length>0 && (
            <div>
              <div style={{ fontSize:12,fontWeight:700,color:"#0284c7",textTransform:"uppercase",letterSpacing:0.5,marginBottom:6 }}>Программы JCC</div>
              {member.jcc.programs.map(p=>(
                <div key={p.id} style={{ background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:7,padding:"7px 10px",marginBottom:4 }}>
                  <div style={{ fontWeight:700,fontSize:13,color:"#0369a1" }}>{p.name}</div>
                  {p.notes && <div style={{ fontSize:12,color:"#475569",marginTop:2 }}>{p.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Template Download ─────────────────────────────────────────────────────
function downloadTemplate() {
  const headers = [
    "Название семьи *",
    "Фамилия *",
    "Имя *",
    "Дата рождения (ДД.ММ.ГГГГ)",
    "Степень родства",
    "Код MIS",
    "Телефон",
    "Email",
    "Город",
    "Адрес (общий для семьи)",
    "Special Needs (Да/Нет)",
    "Социальный центр (Да/Нет)",
    "Мадрих (Да/Нет)",
    "Волонтёр (Да/Нет)",
    "JCC (Да/Нет)",
    "Программы JCC (через запятую)"
  ];
  const example1 = ["Семья Иванов","Иванов","Иван","15.03.1942","Глава семьи","MIS-001","+972501234567","ivan@example.com","Тель-Авив","ул. Герцля 5","Нет","Да","Нет","Нет","Да","Беяхад Кидс, Лекции"];
  const example2 = ["Семья Иванов","Иванова","Сара","22.07.1945","Супруга","MIS-002","+972501234568","","Тель-Авив","ул. Герцля 5","Да","Да","Нет","Нет","Нет",""];
  const example3 = ["Семья Коэн","Коэн","Давид","01.01.1938","","MIS-003","","","Хайфа","пр. Мира 12","Нет","Нет","Нет","Да","Да","Лагеря"];

  const rows = [headers, example1, example2, example3];
  const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download="import_template.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── Parse date from DD.MM.YYYY or YYYY-MM-DD ──────────────────────────────
function parseImportDate(str) {
  if (!str) return "";
  str = str.trim();
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(str)) {
    const [d,m,y] = str.split(".");
    return `${y}-${m}-${d}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return "";
}

function parseBool(str) {
  if (!str) return false;
  return str.trim().toLowerCase() === "да" || str.trim().toLowerCase() === "yes";
}

// ── Import Modal ──────────────────────────────────────────────────────────
function ImportModal({ onClose, allPrograms, families, setFamilies, session }) {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState(null);

  const handleFile = (e) => setFile(e.target.files[0]);

  const runImport = async () => {
    if (!file) return;
    setImporting(true);

    const text = await file.text();
    const lines = text.split("\n").filter(l=>l.trim());
    // Skip header row
    const dataLines = lines.slice(1);

    // Parse CSV respecting quoted fields
    const parseCSVLine = (line) => {
      const result = [];
      let cur = "", inQ = false;
      for (let i=0; i<line.length; i++) {
        const c = line[i];
        if (c==='"') { inQ = !inQ; }
        else if ((c===";"||c===",") && !inQ) { result.push(cur.trim()); cur=""; }
        else { cur += c; }
      }
      result.push(cur.trim());
      return result.map(s=>s.replace(/^"|"$/g,"").replace(/""/g,'"').trim());
    };

    const rows = dataLines.map(parseCSVLine).filter(r=>r[0]||r[1]);

    // Group rows by family name
    const familyMap = {};
    rows.forEach(r => {
      const familyName = r[0]?.trim();
      if (!familyName) return;
      if (!familyMap[familyName]) familyMap[familyName] = [];
      familyMap[familyName].push(r);
    });

    const created = [];
    const updated = [];
    const errors = [];

    // Load fresh families from DB
    const { data: dbFamilies } = await supabase.from("families").select("*").order("family_name");
    const currentFamilies = (dbFamilies||[]).map(fromDB);

    for (const [familyName, rows] of Object.entries(familyMap)) {
      try {
        const existingFamily = currentFamilies.find(f=>f.familyName.trim().toLowerCase()===familyName.toLowerCase());

        const newMembers = rows.map(r => {
          const jccActive = parseBool(r[14]);
          const jccProgramNames = (r[15]||"").split(",").map(s=>s.trim()).filter(Boolean);
          const jccPrograms = jccProgramNames.map(name => {
            const prog = allPrograms.find(p=>p.name.toLowerCase()===name.toLowerCase());
            return prog ? { id:prog.id, name:prog.name, notes:"" } : { id:Date.now()+Math.random(), name, notes:"" };
          });
          return {
            id: Date.now() + Math.random(),
            lastName: r[1]?.trim()||"",
            firstName: r[2]?.trim()||"",
            dob: parseImportDate(r[3]),
            relation: r[4]?.trim()||"",
            misCode: r[5]?.trim()||"",
            phone: r[6]?.trim()||"",
            email: r[7]?.trim()||"",
            isMadrich: parseBool(r[12]),
            isVolunteer: parseBool(r[13]),
            jcc: { active: jccActive, programs: jccPrograms }
          };
        }).filter(m=>m.lastName&&m.firstName);

        if (!existingFamily) {
          // Create new family
          const firstRow = rows[0];
          const newFamily = {
            familyName,
            city: firstRow[8]?.trim()||"",
            address: firstRow[9]?.trim()||"",
            specialNeeds: parseBool(firstRow[10]),
            socialCenter: parseBool(firstRow[11]),
            criteria: {0:0,1:0,2:0,3:0,4:0},
            comment: "",
            nextVisit: "",
            aid: [],
            visits: [],
            members: newMembers,
            jccPrograms: []
          };
          const { data, error } = await supabase.from("families").insert(toDB(newFamily)).select();
          if (error) { errors.push({ family:familyName, error:error.message }); continue; }
          const saved = fromDB(data[0]);
          setFamilies(prev=>[...prev, saved]);
          created.push({ family:familyName, members:newMembers.map(m=>`${m.lastName} ${m.firstName}`) });
        } else {
          // Update existing family — match members by lastName+firstName+dob
          const changes = [];
          const updatedMembers = [...existingFamily.members];

          for (const newM of newMembers) {
            const key = `${newM.lastName}|${newM.firstName}|${newM.dob}`.toLowerCase();
            const existIdx = updatedMembers.findIndex(m=>
              `${m.lastName}|${m.firstName}|${m.dob}`.toLowerCase() === key
            );
            if (existIdx >= 0) {
              // Update existing member — track changes
              const old = updatedMembers[existIdx];
              const fieldChanges = [];
              const checkField = (label, oldVal, newVal) => {
                if (newVal && String(newVal).trim() !== String(oldVal||"").trim()) {
                  fieldChanges.push({ field:label, was:oldVal||"(пусто)", became:newVal });
                }
              };
              checkField("Телефон", old.phone, newM.phone);
              checkField("Email", old.email, newM.email);
              checkField("Код MIS", old.misCode, newM.misCode);
              checkField("Степень родства", old.relation, newM.relation);
              checkField("Мадрих", old.isMadrich?"Да":"Нет", newM.isMadrich?"Да":"Нет");
              checkField("Волонтёр", old.isVolunteer?"Да":"Нет", newM.isVolunteer?"Да":"Нет");
              const oldJCC = old.jcc?.active?"Да":"Нет";
              const newJCC = newM.jcc?.active?"Да":"Нет";
              checkField("JCC", oldJCC, newJCC);
              if (newM.jcc?.active) {
                const oldProgs = (old.jcc?.programs||[]).map(p=>p.name).join(", ");
                const newProgs = (newM.jcc?.programs||[]).map(p=>p.name).join(", ");
                checkField("Программы JCC", oldProgs, newProgs);
              }
              if (fieldChanges.length>0) {
                changes.push({ person:`${newM.lastName} ${newM.firstName}`, fields:fieldChanges });
              }
              updatedMembers[existIdx] = { ...old, ...newM, id:old.id };
            } else {
              // New person in existing family
              updatedMembers.push(newM);
              changes.push({ person:`${newM.lastName} ${newM.firstName}`, fields:[{ field:"Статус", was:"", became:"Новый участник добавлен в семью" }] });
            }
          }

          // Update family-level fields
          const firstRow = rows[0];
          const familyChanges = [];
          const checkFam = (label, oldVal, newVal) => {
            if (newVal && String(newVal).trim()!==String(oldVal||"").trim()) {
              familyChanges.push({ field:label, was:oldVal||"(пусто)", became:newVal });
            }
          };
          const newCity = firstRow[8]?.trim()||"";
          const newAddress = firstRow[9]?.trim()||"";
          const newSN = parseBool(firstRow[10]);
          const newSC = parseBool(firstRow[11]);
          checkFam("Город", existingFamily.city, newCity);
          checkFam("Адрес", existingFamily.address, newAddress);
          checkFam("Special Needs", existingFamily.specialNeeds?"Да":"Нет", newSN?"Да":"Нет");
          checkFam("Соц. центр", existingFamily.socialCenter?"Да":"Нет", newSC?"Да":"Нет");
          if (familyChanges.length>0) changes.push({ person:"[Семья]", fields:familyChanges });

          const updatedFamily = {
            ...existingFamily,
            city: newCity||existingFamily.city,
            address: newAddress||existingFamily.address,
            specialNeeds: newSN||existingFamily.specialNeeds,
            socialCenter: newSC||existingFamily.socialCenter,
            members: updatedMembers
          };

          const { error } = await supabase.from("families").update(toDB(updatedFamily)).eq("id", existingFamily.id);
          if (error) { errors.push({ family:familyName, error:error.message }); continue; }
          setFamilies(prev=>prev.map(f=>f.id===existingFamily.id?updatedFamily:f));
          if (changes.length>0) updated.push({ family:familyName, changes });
        }
      } catch(e) {
        errors.push({ family:familyName, error:e.message });
      }
    }

    // Save log to Supabase
    const summary = { created, updated, errors, total_rows:rows.length, filename:file.name };
    await supabase.from("import_logs").insert({
      imported_by: session.user.email,
      summary,
      filename: file.name
    });

    setReport(summary);
    setImporting(false);
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(15,23,42,0.75)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:"#fff",borderRadius:16,width:"100%",maxWidth:680,maxHeight:"90vh",overflow:"auto",boxShadow:"0 25px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ padding:"20px 28px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"linear-gradient(135deg,#059669,#0d9488)",borderRadius:"16px 16px 0 0",position:"sticky",top:0,zIndex:10 }}>
          <h2 style={{ margin:0,color:"#fff",fontSize:20 }}>📥 Импорт из CSV</h2>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)",border:"none",color:"#fff",borderRadius:8,padding:"4px 12px",cursor:"pointer",fontSize:18 }}>✕</button>
        </div>

        <div style={{ padding:28,display:"flex",flexDirection:"column",gap:20 }}>
          {!report ? <>
            <div style={{ background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:16 }}>
              <div style={{ fontWeight:700,fontSize:14,color:"#065f46",marginBottom:8 }}>Инструкция</div>
              <div style={{ fontSize:13,color:"#374151",lineHeight:1.6 }}>
                1. Скачайте шаблон CSV<br/>
                2. Заполните данные (не удаляйте строку заголовка)<br/>
                3. Сохраните файл и загрузите его ниже<br/>
                4. Нажмите «Запустить импорт»
              </div>
            </div>

            <button onClick={downloadTemplate} style={{ ...btnSecondary,alignSelf:"flex-start",color:"#059669",borderColor:"#6ee7b7",fontWeight:700 }}>
              📄 Скачать шаблон CSV
            </button>

            <label style={{ display:"flex",flexDirection:"column",gap:8,border:"2px dashed #e2e8f0",borderRadius:12,padding:24,textAlign:"center",cursor:"pointer",background:"#f8fafc" }}>
              <span style={{ fontSize:32 }}>📂</span>
              <span style={{ fontSize:14,fontWeight:600,color:"#374151" }}>{file ? file.name : "Выберите CSV файл"}</span>
              <span style={{ fontSize:12,color:"#94a3b8" }}>Нажмите чтобы выбрать файл</span>
              <input type="file" accept=".csv" onChange={handleFile} style={{ display:"none" }} />
            </label>

            <button onClick={runImport} disabled={!file||importing}
              style={{ ...btnPrimary,padding:"12px",fontSize:15,opacity:(!file||importing)?0.6:1 }}>
              {importing ? "⏳ Импортируется..." : "🚀 Запустить импорт"}
            </button>
          </> : (
            <ImportReport report={report} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Import Report ─────────────────────────────────────────────────────────
function ImportReport({ report, onClose }) {
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10 }}>
        <div style={{ background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:14,textAlign:"center" }}>
          <div style={{ fontSize:28,fontWeight:800,color:"#059669" }}>{report.created.length}</div>
          <div style={{ fontSize:12,color:"#065f46",fontWeight:600 }}>Новых семей</div>
        </div>
        <div style={{ background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:14,textAlign:"center" }}>
          <div style={{ fontSize:28,fontWeight:800,color:"#2563eb" }}>{report.updated.length}</div>
          <div style={{ fontSize:12,color:"#1e40af",fontWeight:600 }}>Обновлено</div>
        </div>
        <div style={{ background:report.errors.length>0?"#fef2f2":"#f8fafc",border:`1px solid ${report.errors.length>0?"#fecaca":"#e2e8f0"}`,borderRadius:10,padding:14,textAlign:"center" }}>
          <div style={{ fontSize:28,fontWeight:800,color:report.errors.length>0?"#dc2626":"#94a3b8" }}>{report.errors.length}</div>
          <div style={{ fontSize:12,color:report.errors.length>0?"#991b1b":"#64748b",fontWeight:600 }}>Ошибок</div>
        </div>
      </div>

      {report.created.length>0 && (
        <div>
          <div style={{ fontWeight:700,fontSize:14,color:"#059669",marginBottom:8 }}>✅ Созданы новые записи</div>
          {report.created.map((c,i)=>(
            <div key={i} style={{ background:"#f0fdf4",borderRadius:8,padding:"8px 12px",marginBottom:6,fontSize:13 }}>
              <span style={{ fontWeight:700 }}>🏠 {c.family}</span>
              <span style={{ color:"#64748b" }}> — {c.members.join(", ")}</span>
            </div>
          ))}
        </div>
      )}

      {report.updated.length>0 && (
        <div>
          <div style={{ fontWeight:700,fontSize:14,color:"#2563eb",marginBottom:8 }}>🔄 Обновлены данные</div>
          {report.updated.map((u,i)=>(
            <div key={i} style={{ background:"#eff6ff",borderRadius:8,padding:"10px 12px",marginBottom:8,fontSize:13 }}>
              <div style={{ fontWeight:700,marginBottom:6 }}>🏠 {u.family}</div>
              {u.changes.map((ch,j)=>(
                <div key={j} style={{ marginBottom:4 }}>
                  <span style={{ fontWeight:600,color:"#374151" }}>👤 {ch.person}: </span>
                  {ch.fields.map((f,k)=>(
                    <span key={k} style={{ fontSize:12 }}>
                      <span style={{ color:"#64748b" }}>{f.field}: </span>
                      <span style={{ color:"#dc2626",textDecoration:"line-through" }}>{f.was}</span>
                      <span style={{ color:"#64748b" }}> → </span>
                      <span style={{ color:"#059669",fontWeight:600 }}>{f.became}</span>
                      {k<ch.fields.length-1?", ":""}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {report.errors.length>0 && (
        <div>
          <div style={{ fontWeight:700,fontSize:14,color:"#dc2626",marginBottom:8 }}>❌ Ошибки</div>
          {report.errors.map((e,i)=>(
            <div key={i} style={{ background:"#fef2f2",borderRadius:8,padding:"8px 12px",marginBottom:6,fontSize:13,color:"#991b1b" }}>
              <span style={{ fontWeight:700 }}>{e.family}: </span>{e.error}
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize:12,color:"#94a3b8",borderTop:"1px solid #e2e8f0",paddingTop:12 }}>
        Файл: {report.filename} · Строк обработано: {report.total_rows} · Отчёт сохранён в логах
      </div>

      <button onClick={onClose} style={{ ...btnPrimary,padding:"10px" }}>✓ Закрыть</button>
    </div>
  );
}

// ── Logs Modal ────────────────────────────────────────────────────────────
const ACTION_LABELS = { create:"Создан", update:"Изменён", delete:"Удалён" };
const ACTION_COLORS = { create:"#059669", update:"#2563eb", delete:"#dc2626" };
const ACTION_BG = { create:"#d1fae5", update:"#dbeafe", delete:"#fee2e2" };
const OBJECT_LABELS = { family:"Семья", member:"Участник", aid:"Помощь", visit:"Визит" };

function ChangesTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [filterAction, setFilterAction] = useState("all");

  useEffect(() => {
    supabase.from("change_logs").select("*").order("changed_at",{ascending:false}).limit(200)
      .then(({data})=>{ if(data) setLogs(data); setLoading(false); });
  }, []);

  const filtered = filterAction==="all" ? logs : logs.filter(l=>l.action===filterAction);

  if (loading) return <div style={{ textAlign:"center",color:"#94a3b8",padding:40 }}>Загрузка...</div>;
  if (logs.length===0) return <div style={{ textAlign:"center",color:"#94a3b8",padding:40 }}>Изменений пока нет</div>;

  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap" }}>
        {[["all","Все"],["create","Создание"],["update","Изменение"],["delete","Удаление"]].map(([k,l])=>(
          <button key={k} onClick={()=>setFilterAction(k)} style={{ padding:"4px 12px",borderRadius:6,border:"1px solid",cursor:"pointer",fontSize:12,fontWeight:600,
            background:filterAction===k?"#6366f1":"#fff",color:filterAction===k?"#fff":"#475569",borderColor:filterAction===k?"#6366f1":"#e2e8f0" }}>{l}</button>
        ))}
        <span style={{ fontSize:12,color:"#94a3b8",alignSelf:"center",marginLeft:4 }}>{filtered.length} записей</span>
      </div>
      {filtered.map(log=>(
        <div key={log.id} style={{ background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,marginBottom:8,overflow:"hidden" }}>
          <div style={{ padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer" }}
            onClick={()=>setExpanded(expanded===log.id?null:log.id)}>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <span style={{ background:ACTION_BG[log.action],color:ACTION_COLORS[log.action],borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700 }}>
                {ACTION_LABELS[log.action]||log.action}
              </span>
              <span style={{ background:"#f3f4f6",color:"#374151",borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:600 }}>
                {OBJECT_LABELS[log.object_type]||log.object_type}
              </span>
              <span style={{ fontWeight:700,fontSize:13,color:"#1e293b" }}>{log.family_name}</span>
              {log.object_name && <span style={{ fontSize:12,color:"#6366f1",fontWeight:600 }}>→ {log.object_name}</span>}
            </div>
            <div style={{ display:"flex",alignItems:"center",gap:8,flexShrink:0 }}>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:11,color:"#64748b" }}>{new Date(log.changed_at).toLocaleString("ru-RU")}</div>
                <div style={{ fontSize:11,color:"#94a3b8" }}>{log.changed_by}</div>
              </div>
              <span style={{ fontSize:14,color:"#94a3b8" }}>{expanded===log.id?"▲":"▼"}</span>
            </div>
          </div>
          {expanded===log.id && (
            <div style={{ padding:"0 14px 12px",borderTop:"1px solid #e2e8f0" }}>
              {Array.isArray(log.changes) ? (
                <div style={{ display:"flex",flexDirection:"column",gap:4,marginTop:8 }}>
                  {log.changes.map((c,i)=>(
                    <div key={i} style={{ fontSize:12,display:"flex",gap:6,flexWrap:"wrap",alignItems:"baseline" }}>
                      <span style={{ fontWeight:700,color:"#374151",minWidth:120 }}>{c.field}:</span>
                      {c.was && <><span style={{ color:"#dc2626",textDecoration:"line-through" }}>{String(c.was)}</span>
                      <span style={{ color:"#94a3b8" }}>→</span></>}
                      <span style={{ color:"#059669",fontWeight:600 }}>{String(c.became)}</span>
                    </div>
                  ))}
                </div>
              ) : log.changes?.snapshot ? (
                <div style={{ marginTop:8,fontSize:12,color:"#475569" }}>
                  {Object.entries(log.changes.snapshot).map(([k,v])=>(
                    <div key={k}><span style={{ fontWeight:600 }}>{k}:</span> {Array.isArray(v)?v.join(", "):String(v)}</div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ImportTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    supabase.from("import_logs").select("*").order("imported_at",{ascending:false}).limit(50)
      .then(({data})=>{ if(data) setLogs(data); setLoading(false); });
  }, []);

  if (loading) return <div style={{ textAlign:"center",color:"#94a3b8",padding:40 }}>Загрузка...</div>;
  if (logs.length===0) return <div style={{ textAlign:"center",color:"#94a3b8",padding:40 }}>Импортов пока не было</div>;

  return (
    <div>
      {logs.map(log=>(
        <div key={log.id} style={{ background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,marginBottom:10,overflow:"hidden" }}>
          <div style={{ padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer" }}
            onClick={()=>setExpanded(expanded===log.id?null:log.id)}>
            <div>
              <div style={{ fontWeight:700,fontSize:14,color:"#1e293b" }}>{log.filename||"Без названия"}</div>
              <div style={{ fontSize:12,color:"#64748b",marginTop:2 }}>{new Date(log.imported_at).toLocaleString("ru-RU")} · {log.imported_by}</div>
            </div>
            <div style={{ display:"flex",gap:8,alignItems:"center" }}>
              <span style={{ background:"#d1fae5",color:"#065f46",borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:700 }}>+{log.summary.created?.length||0}</span>
              <span style={{ background:"#dbeafe",color:"#1e40af",borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:700 }}>↻{log.summary.updated?.length||0}</span>
              {(log.summary.errors?.length||0)>0 && <span style={{ background:"#fee2e2",color:"#991b1b",borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:700 }}>✕{log.summary.errors.length}</span>}
              <span style={{ fontSize:14,color:"#94a3b8" }}>{expanded===log.id?"▲":"▼"}</span>
            </div>
          </div>
          {expanded===log.id && (
            <div style={{ padding:"0 16px 16px",borderTop:"1px solid #e2e8f0" }}>
              <ImportReport report={log.summary} onClose={()=>{}} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function LogsModal({ onClose }) {
  const [tab, setTab] = useState("changes");
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(15,23,42,0.75)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:"#fff",borderRadius:16,width:"100%",maxWidth:720,maxHeight:"92vh",overflow:"auto",boxShadow:"0 25px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ padding:"20px 28px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"linear-gradient(135deg,#374151,#1f2937)",borderRadius:"16px 16px 0 0",position:"sticky",top:0,zIndex:10 }}>
          <h2 style={{ margin:0,color:"#fff",fontSize:20 }}>📋 Логи</h2>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)",border:"none",color:"#fff",borderRadius:8,padding:"4px 12px",cursor:"pointer",fontSize:18 }}>✕</button>
        </div>
        <div style={{ padding:"16px 24px 0" }}>
          <div style={{ display:"flex", gap:8, borderBottom:"2px solid #e2e8f0", marginBottom:16 }}>
            {[["changes","🔄 Изменения в базе"],["import","📥 Импорт"]].map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)} style={{
                padding:"8px 16px",background:"none",border:"none",cursor:"pointer",fontWeight:700,fontSize:13,
                color:tab===k?"#6366f1":"#94a3b8",
                borderBottom:tab===k?"2px solid #6366f1":"2px solid transparent",
                marginBottom:-2
              }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ padding:"0 24px 24px" }}>
          {tab==="changes" ? <ChangesTab /> : <ImportTab />}
        </div>
      </div>
    </div>
  );
}

// ── Excel Dropdown ────────────────────────────────────────────────────────
function ExcelDropdown({ families, filtered, hasFilters }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position:"relative" }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ ...btnSecondary,background:"rgba(255,255,255,0.15)",color:"#fff",borderColor:"rgba(255,255,255,0.3)",fontSize:13,display:"flex",alignItems:"center",gap:6 }}>
        📤 Экспорт ▾
      </button>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 6px)", right:0, background:"#fff", borderRadius:10, boxShadow:"0 8px 24px rgba(0,0,0,0.15)", border:"1px solid #e2e8f0", zIndex:50, minWidth:200, overflow:"hidden" }}
          onMouseLeave={()=>setOpen(false)}>
          <button onClick={()=>{exportExcel(families);setOpen(false);}} style={{ width:"100%",padding:"11px 16px",background:"none",border:"none",cursor:"pointer",textAlign:"left",fontSize:13,fontWeight:600,color:"#374151",borderBottom:"1px solid #f1f5f9" }}>
            📊 Экспорт всех ({families.length} семей)
          </button>
          <button onClick={()=>{exportExcel(filtered);setOpen(false);}} style={{ width:"100%",padding:"11px 16px",background:"none",border:"none",cursor:"pointer",textAlign:"left",fontSize:13,fontWeight:600,color:hasFilters?"#6366f1":"#94a3b8" }}>
            🔍 Экспорт отфильтрованных ({filtered.length})
          </button>
        </div>
      )}
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────
function LoginScreen() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const [resetSent, setResetSent] = useState(false);
  const handleLogin = async () => { setLoading(true); setError(""); const {error} = await supabase.auth.signInWithPassword({email,password}); if(error) setError("Неверный email или пароль"); setLoading(false); };
  const handleReset = async () => { if(!email) return setError("Введите email"); await supabase.auth.resetPasswordForEmail(email); setResetSent(true); };
  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1e1b4b,#312e81,#4c1d95)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"rgba(255,255,255,0.05)", backdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:20, padding:48, width:380, textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:8 }}>🏥</div>
        <h1 style={{ color:"#fff", fontSize:22, marginBottom:4 }}>База клиентов</h1>
        <p style={{ color:"#a5b4fc", fontSize:14, marginBottom:28 }}>Социальный центр</p>
        <input type="email" placeholder="Email" value={email} onChange={e=>{setEmail(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&handleLogin()} style={{ width:"100%",padding:"12px 16px",borderRadius:10,fontSize:15,border:error?"2px solid #f87171":"2px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.1)",color:"#fff",outline:"none",boxSizing:"border-box",marginBottom:10 }} />
        <input type="password" placeholder="Пароль" value={password} onChange={e=>{setPassword(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&handleLogin()} style={{ width:"100%",padding:"12px 16px",borderRadius:10,fontSize:15,border:error?"2px solid #f87171":"2px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.1)",color:"#fff",outline:"none",boxSizing:"border-box",marginBottom:8 }} />
        {error && <p style={{ color:"#f87171",fontSize:13,marginBottom:8 }}>{error}</p>}
        {resetSent && <p style={{ color:"#86efac",fontSize:13,marginBottom:8 }}>Письмо отправлено</p>}
        <button onClick={handleLogin} disabled={loading} style={{ ...btnPrimary,width:"100%",padding:"12px",fontSize:15,marginBottom:12,opacity:loading?0.7:1 }}>{loading?"Вход...":"Войти"}</button>
        <button onClick={handleReset} style={{ background:"none",border:"none",color:"#a5b4fc",fontSize:13,cursor:"pointer",textDecoration:"underline" }}>Забыли пароль?</button>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState("admin"); // "admin" | "jcc"
  const [families, setFamilies] = useState([]);
  const [allPrograms, setAllPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [showPrograms, setShowPrograms] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | specialNeeds | urgent | jcc | children
  const [viewMode, setViewMode] = useState("family"); // family | person

  const isJCC = userRole === "jcc";
  const isHesed = userRole === "hesed";

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => {
      setSession(data.session);
      if (data.session) {
        const role = data.session.user?.user_metadata?.role || "admin";
        setUserRole(role);
      }
    });
    const {data:listener} = supabase.auth.onAuthStateChange((_e,s) => {
      setSession(s);
      if (s) setUserRole(s.user?.user_metadata?.role || "admin");
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      supabase.from("families").select("*").order("family_name"),
      supabase.from("jcc_programs").select("*").order("name")
    ]).then(([{data:fam},{data:prog}]) => {
      if (fam) setFamilies(fam.map(fromDB));
      if (prog) setAllPrograms(prog);
      setLoading(false);
    });
  }, [session]);

  const hasFilters = search || filter !== "all";

  const filtered = useMemo(() => {
    return families.filter(f => {
      const name = f.familyName.toLowerCase();
      const memberNames = (f.members||[]).map(m=>`${m.lastName} ${m.firstName}`.toLowerCase()).join(" ");
      if (search && !name.includes(search.toLowerCase()) && !memberNames.includes(search.toLowerCase())) return false;
      if (filter==="specialNeeds" && !f.specialNeeds) return false;
      if (filter==="urgent") { const d=daysUntil(f.nextVisit); if(d===null||d>30) return false; }
      if (filter==="jcc" && !(f.members||[]).some(m=>m.jcc?.active)) return false;
      if (filter==="children" && !(f.members||[]).some(m=>isMinor(m.dob))) return false;
      if (filter==="madrich" && !(f.members||[]).some(m=>m.isMadrich)) return false;
      if (filter==="volunteer" && !(f.members||[]).some(m=>m.isVolunteer)) return false;
      return true;
    });
  }, [families, search, filter]);

  // Flat list for person view
  const allPersons = useMemo(() => {
    const persons = [];
    filtered.forEach(f => {
      (f.members||[]).forEach(m => {
        if (filter==="children" && !isMinor(m.dob)) return;
        if (filter==="jcc" && !m.jcc?.active) return;
        if (filter==="madrich" && !m.isMadrich) return;
        if (filter==="volunteer" && !m.isVolunteer) return;
        persons.push({ member:m, family:f });
      });
    });
    return persons.sort((a,b)=>`${a.member.lastName}${a.member.firstName}`.localeCompare(`${b.member.lastName}${b.member.firstName}`));
  }, [filtered, filter]);

  // ── Change logging helper ──────────────────────────────────────────────
  const logChange = async (action, objectType, familyName, objectName, changes) => {
    try {
      await supabase.from("change_logs").insert({
        changed_by: session.user.email,
        action,
        object_type: objectType,
        family_name: familyName,
        object_name: objectName || "",
        changes
      });
    } catch(e) { console.error("Log error:", e); }
  };

  // ── Diff helpers ───────────────────────────────────────────────────────
  const diffFields = (oldObj, newObj, fields) => {
    const changes = [];
    fields.forEach(([key, label]) => {
      const oldVal = String(oldObj[key]??"-");
      const newVal = String(newObj[key]??"-");
      if (oldVal !== newVal) changes.push({ field:label, was:oldVal, became:newVal });
    });
    return changes;
  };

  const diffMembers = async (oldMembers, newMembers, familyName) => {
    const MEMBER_FIELDS = [
      ["lastName","Фамилия"],["firstName","Имя"],["dob","Дата рождения"],
      ["relation","Степень родства"],["misCode","Код MIS"],["phone","Телефон"],
      ["email","Email"],["isMadrich","Мадрих"],["isVolunteer","Волонтёр"]
    ];
    for (const nm of newMembers) {
      const om = oldMembers.find(m=>m.id===nm.id);
      if (!om) {
        await logChange("create","member",familyName,`${nm.lastName} ${nm.firstName}`,[{field:"Статус",was:"",became:"Новый член семьи добавлен"}]);
      } else {
        const changes = diffFields(om, nm, MEMBER_FIELDS);
        // JCC diff
        const oldJCC = om.jcc?.active?"Да":"Нет";
        const newJCC = nm.jcc?.active?"Да":"Нет";
        if (oldJCC!==newJCC) changes.push({field:"JCC",was:oldJCC,became:newJCC});
        if (nm.jcc?.active) {
          const oldP = (om.jcc?.programs||[]).map(p=>p.name).sort().join(", ");
          const newP = (nm.jcc?.programs||[]).map(p=>p.name).sort().join(", ");
          if (oldP!==newP) changes.push({field:"Программы JCC",was:oldP||"-",became:newP||"-"});
          // notes diff per program
          (nm.jcc.programs||[]).forEach(np=>{
            const op = (om.jcc?.programs||[]).find(p=>p.id===np.id);
            if (op && op.notes!==np.notes) changes.push({field:`Заметки JCC (${np.name})`,was:op.notes||"-",became:np.notes||"-"});
          });
        }
        if (changes.length>0) await logChange("update","member",familyName,`${nm.lastName} ${nm.firstName}`,changes);
      }
    }
    for (const om of oldMembers) {
      if (!newMembers.find(m=>m.id===om.id)) {
        await logChange("delete","member",familyName,`${om.lastName} ${om.firstName}`,[{field:"Статус",was:"Член семьи",became:"Удалён"}]);
      }
    }
  };

  const diffAid = async (oldAid, newAid, familyName) => {
    const MONTHS_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
    for (const na of newAid) {
      const oa = oldAid.find(a=>a.id===na.id);
      const label = `${MONTHS_RU[na.month]} ${na.year}`;
      if (!oa) await logChange("create","aid",familyName,label,[{field:"Сумма помощи",was:"",became:`€${parseFloat(na.amount).toFixed(2)}`}]);
      else if (String(oa.amount)!==String(na.amount)) await logChange("update","aid",familyName,label,[{field:"Сумма",was:`€${parseFloat(oa.amount).toFixed(2)}`,became:`€${parseFloat(na.amount).toFixed(2)}`}]);
    }
    for (const oa of oldAid) {
      if (!newAid.find(a=>a.id===oa.id)) {
        const MONTHS_RU2=["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
        await logChange("delete","aid",familyName,`${MONTHS_RU2[oa.month]} ${oa.year}`,[{field:"Сумма помощи",was:`€${parseFloat(oa.amount).toFixed(2)}`,became:"Удалено"}]);
      }
    }
  };

  const diffVisits = async (oldVisits, newVisits, familyName) => {
    for (const nv of newVisits) {
      const ov = oldVisits.find(v=>v.id===nv.id);
      if (!ov) await logChange("create","visit",familyName,formatDate(nv.date),[{field:"Визит",was:"",became:`${formatDate(nv.date)}${nv.worker?" — "+nv.worker:""}`}]);
      else {
        const changes = [];
        if (ov.date!==nv.date) changes.push({field:"Дата",was:formatDate(ov.date),became:formatDate(nv.date)});
        if (ov.worker!==nv.worker) changes.push({field:"Сотрудник",was:ov.worker||"-",became:nv.worker||"-"});
        if (ov.notes!==nv.notes) changes.push({field:"Заметки",was:ov.notes||"-",became:nv.notes||"-"});
        if (changes.length>0) await logChange("update","visit",familyName,formatDate(nv.date),changes);
      }
    }
    for (const ov of oldVisits) {
      if (!newVisits.find(v=>v.id===ov.id)) await logChange("delete","visit",familyName,formatDate(ov.date),[{field:"Визит",was:formatDate(ov.date),became:"Удалён"}]);
    }
  };

  const saveFamily = async (form) => {
    const row = toDB(form);
    const isNew = form.id==="new"||!families.find(f=>f.id===form.id);
    if (isNew) {
      const {data,error} = await supabase.from("families").insert(row).select();
      if (error) { alert("Ошибка: "+error.message); return; }
      const saved = fromDB(data[0]);
      setFamilies(prev=>[...prev, saved]);
      // Log: new family + all members
      await logChange("create","family",form.familyName,"",{snapshot:{
        familyName:form.familyName, city:form.city, address:form.address,
        specialNeeds:form.specialNeeds, socialCenter:form.socialCenter,
        members:(form.members||[]).map(m=>`${m.lastName} ${m.firstName}`)
      }});
    } else {
      const old = families.find(f=>f.id===form.id);
      const {error} = await supabase.from("families").update(row).eq("id",form.id);
      if (error) { alert("Ошибка: "+error.message); return; }
      setFamilies(prev=>prev.map(f=>f.id===form.id?{...fromDB({...row,id:form.id}),id:form.id}:f));
      // Log family-level field changes
      if (old) {
        const FAM_FIELDS = [
          ["familyName","Название семьи"],["city","Город"],["address","Адрес"],
          ["comment","Комментарий"],["nextVisit","Дата визита"],
          ["specialNeeds","Special Needs"],["socialCenter","Соц. центр"]
        ];
        const famChanges = diffFields(old, form, FAM_FIELDS);
        if (famChanges.length>0) await logChange("update","family",form.familyName,"",famChanges);
        // Log member changes
        await diffMembers(old.members||[], form.members||[], form.familyName);
        // Log aid changes
        await diffAid(old.aid||[], form.aid||[], form.familyName);
        // Log visit changes
        await diffVisits(old.visits||[], form.visits||[], form.familyName);
      }
    }
    setModal(null);
  };

  const deleteFamily = async (id) => {
    const family = families.find(f=>f.id===id);
    const {error} = await supabase.from("families").delete().eq("id",id);
    if (error) { alert("Ошибка: "+error.message); return; }
    setFamilies(prev=>prev.filter(f=>f.id!==id));
    if (family) await logChange("delete","family",family.familyName,"",{snapshot:{
      familyName:family.familyName, city:family.city, address:family.address,
      members:(family.members||[]).map(m=>`${m.lastName} ${m.firstName}`),
      totalAid:(family.aid||[]).reduce((s,a)=>s+(parseFloat(a.amount)||0),0)
    }});
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setSession(null); setFamilies([]); };
  const resetFilters = () => { setSearch(""); setFilter("all"); };

  if (!session) return <LoginScreen />;

  if (loading) return (
    <div style={{ minHeight:"100vh",background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ textAlign:"center",color:"#6366f1" }}><div style={{ fontSize:40,marginBottom:12 }}>⏳</div><div style={{ fontSize:16,fontWeight:600 }}>Загрузка...</div></div>
    </div>
  );

  const urgentCount = families.filter(f=>{const d=daysUntil(f.nextVisit);return d!==null&&d<=30;}).length;
  const totalMembers = families.reduce((s,f)=>s+(f.members||[]).length,0);

  return (
    <div style={{ minHeight:"100vh", background:"#f1f5f9", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#4f46e5,#7c3aed)", padding:"20px 24px", color:"#fff", boxShadow:"0 4px 20px rgba(79,70,229,0.4)" }}>
        <div style={{ maxWidth:940, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800 }}>🏥 База клиентов</h1>
            <div style={{ fontSize:13, opacity:0.8, marginTop:2 }}>
              {session.user.email} {isJCC?'· <span style="color:#7dd3fc">JCC</span>':''} · Семей: {families.length} · Человек: {totalMembers}
              {!isJCC && <span style={{ color:"#fca5a5",fontWeight:700 }}> · Срочно: {urgentCount}</span>}
            </div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {!isJCC && <ExcelDropdown families={families} filtered={filtered} hasFilters={hasFilters} />}
            {!isJCC && <button onClick={()=>setShowImport(true)} style={{ ...btnSecondary,background:"rgba(255,255,255,0.15)",color:"#fff",borderColor:"rgba(255,255,255,0.3)",fontSize:13 }}>📥 Импорт</button>}
            {!isJCC && !isHesed && <button onClick={()=>setShowPrograms(true)} style={{ ...btnSecondary,background:"rgba(255,255,255,0.15)",color:"#fff",borderColor:"rgba(255,255,255,0.3)",fontSize:13 }}>🏛 Программы JCC</button>}
            <button onClick={()=>setShowLogs(true)} style={{ ...btnSecondary,background:"rgba(255,255,255,0.15)",color:"#fff",borderColor:"rgba(255,255,255,0.3)",fontSize:13 }}>📋 Логи</button>
            <button onClick={()=>setModal("new")} style={{ ...btnPrimary,background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.4)" }}>➕ Новая семья</button>
            <button onClick={handleLogout} style={{ ...btnSecondary,background:"transparent",color:"#fff",borderColor:"rgba(255,255,255,0.3)" }}>🚪</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:940, margin:"0 auto", padding:"20px 16px" }}>
        {/* View mode toggle */}
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          {["family","person"].map(m=>(
            <button key={m} onClick={()=>setViewMode(m)} style={{
              padding:"7px 16px", borderRadius:8, border:"1px solid", cursor:"pointer", fontWeight:700, fontSize:13,
              background:viewMode===m?"#6366f1":"#fff", color:viewMode===m?"#fff":"#475569", borderColor:viewMode===m?"#6366f1":"#e2e8f0"
            }}>{m==="family"?"🏠 По семьям":"👤 По людям"}</button>
          ))}
        </div>

        {/* Search & filters */}
        <div style={{ display:"flex", gap:8, marginBottom:hasFilters?8:14, flexWrap:"wrap", alignItems:"center" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="🔍 Поиск по семье или имени..."
            style={{ flex:1, minWidth:180, ...inputStyle, margin:0 }} />
          {[
            {k:"all",l:"Все"},
            {k:"specialNeeds",l:"⭐ Special Needs"},
            {k:"urgent",l:"🔴 Срочные"},
            {k:"jcc",l:"🏛 JCC"},
            {k:"children",l:"👶 Дети"},
            {k:"madrich",l:"🎓 Мадрихи"},
            {k:"volunteer",l:"🤝 Волонтёры"},
          ].map(({k,l})=>(
            <button key={k} onClick={()=>setFilter(k)} style={{
              padding:"7px 12px", borderRadius:8, border:"1px solid", cursor:"pointer", fontWeight:600, fontSize:12,
              background:filter===k?"#6366f1":"#fff", color:filter===k?"#fff":"#475569", borderColor:filter===k?"#6366f1":"#e2e8f0"
            }}>{l}</button>
          ))}
          {hasFilters && <button onClick={resetFilters} style={{ ...btnSecondary,color:"#dc2626",borderColor:"#fca5a5",fontSize:13 }}>✕ Сбросить</button>}
        </div>

        {hasFilters && <div style={{ fontSize:13, color:"#64748b", marginBottom:12 }}>
          Показано: {viewMode==="family"?filtered.length+" семей":allPersons.length+" человек"} из {viewMode==="family"?families.length+" семей":totalMembers+" человек"}
        </div>}

        {/* Cards */}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {viewMode==="family" ? <>
            {filtered.length===0 && <EmptyState hasFilters={hasFilters} onReset={resetFilters} />}
            {filtered.map(f=><FamilyCard key={f.id} family={f} onEdit={setModal} onDelete={deleteFamily} isJCC={isJCC} isHesed={isHesed} />)}
          </> : <>
            {allPersons.length===0 && <EmptyState hasFilters={hasFilters} onReset={resetFilters} />}
            {allPersons.map(({member,family})=><PersonCard key={`${family.id}-${member.id}`} member={member} family={family} isJCC={isJCC} />)}
          </>}
        </div>
      </div>

      {/* Modals */}
      {modal && <FamilyModal family={modal==="new"?null:modal} onSave={saveFamily} onClose={()=>setModal(null)} allPrograms={allPrograms} isHesed={isHesed} />}

      {showImport && <ImportModal onClose={()=>setShowImport(false)} allPrograms={allPrograms} families={families} setFamilies={setFamilies} session={session} />}

      {showLogs && <LogsModal onClose={()=>setShowLogs(false)} />}

      {showPrograms && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.75)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:480, boxShadow:"0 25px 60px rgba(0,0,0,0.35)" }}>
            <div style={{ padding:"20px 28px", display:"flex", justifyContent:"space-between", alignItems:"center", background:"linear-gradient(135deg,#0284c7,#0369a1)", borderRadius:"16px 16px 0 0" }}>
              <h2 style={{ margin:0, color:"#fff", fontSize:18 }}>🏛 Программы JCC</h2>
              <button onClick={()=>setShowPrograms(false)} style={{ background:"rgba(255,255,255,0.2)",border:"none",color:"#fff",borderRadius:8,padding:"4px 12px",cursor:"pointer",fontSize:18 }}>✕</button>
            </div>
            <div style={{ padding:24 }}>
              <JCCProgramsManager allPrograms={allPrograms} onProgramsChange={setAllPrograms} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasFilters, onReset }) {
  return (
    <div style={{ textAlign:"center", padding:60, color:"#94a3b8" }}>
      <div style={{ fontSize:48 }}>📋</div>
      <div style={{ fontSize:16, marginTop:8 }}>Ничего не найдено</div>
      {hasFilters && <button onClick={onReset} style={{ ...{background:"#fff",color:"#6366f1",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontWeight:600,fontSize:14},marginTop:12 }}>Сбросить фильтры</button>}
    </div>
  );
}
