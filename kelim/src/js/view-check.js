// טופס הבדיקה השבועית (ממלאים בטלפון): בחירת כלי → כותרת → סעיפים V/X → סיכום → חתימה וצילומים → שמירה
import { state, saveCheck, saveDefect, saveEquipment, eqById } from "./store.js";
import { esc, isoDate, fmtDate, fmtNum, toast, el } from "./util.js";
import { KINDS, SUMMARY, allItems } from "./forms.js";
import { equipmentStatus, serviceState, defectsFromCheck, suggestSummary, countItems } from "./logic.js";
import { openSheet, closeSheet } from "./sheet.js";
import { showCheck } from "./view-history.js";

const LS = { get: k => { try { return localStorage.getItem("kelim." + k) || ""; } catch { return ""; } }, set: (k, v) => { try { localStorage.setItem("kelim." + k, v); } catch {} } };

// בחירת הכלי: קודם מה שעוד לא נבדק השבוע
export function openCheckChooser(eqId){
  if (eqId && eqById(eqId)) return openCheckForm(eqById(eqId));
  const st = state.equipment.filter(e => e.active !== false).map(e => equipmentStatus(e, state.checks, state.defects)).sort((a, b) => (a.checkedThisWeek - b.checkedThisWeek) || a.eq.name.localeCompare(b.eq.name, "he"));
  if (!st.length){ toast("קודם מוסיפים כלי או נגרר בלשונית «כלים»", "bad"); return; }
  const sh = openSheet(`<h2>בדיקה שבועית · איזה כלי?</h2><div class="list">${st.map(s => `<button type="button" class="rec ${s.level}" data-pick="${s.eq.id}"><div class="ttl">${esc(s.eq.name)}</div><div class="meta"><span>${KINDS[s.eq.kind].label}${s.eq.plate ? " · <span class=num>" + esc(s.eq.plate) + "</span>" : ""}</span>${s.last ? `<span>נבדק ${fmtDate(s.last.date)}</span>` : "<span>עוד לא נבדק</span>"}</div><div class="side"><span class="chip ${s.checkedThisWeek ? "c-ok" : "c-warn"}">${s.checkedThisWeek ? "נבדק השבוע" : "לבדוק"}</span></div></button>`).join("")}</div>`);
  sh.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => openCheckForm(eqById(b.dataset.pick)));
}

export function openCheckForm(eq){
  if (!state.canWrite){ toast("אין לך הרשאת כתיבה במאגר", "bad"); return; }
  const k = KINDS[eq.kind]; const items = allItems(eq.kind);
  const svc = serviceState(eq, state.checks);
  const me = (state.me && state.me.name) || "";
  const data = { items: {}, notes: {}, summary: "", photos: [] };
  let h = `<h2>${esc(k.formTitle)}</h2>
    <p class="note" style="margin-bottom:12px"><b>${esc(eq.name)}</b>${eq.plate ? " · מס׳ רישוי <span class=num>" + esc(eq.plate) + "</span>" : ""}${eq.model ? " · " + esc(eq.model) : ""}</p>
    <div class="grid2">
      <div class="f"><label>תאריך</label><input type="date" id="cDate" value="${isoDate()}"></div>
      <div class="f"><label>אתר</label><input type="text" id="cSite" value="${esc(state.settings.site || "")}"></div>
      <div class="f"><label>שם הבודק</label><input type="text" id="cName" value="${esc(LS.get("name") || me)}" autocomplete="name"></div>
      <div class="f"><label>תפקיד הבודק</label><input type="text" id="cRole" value="${esc(LS.get("role") || "לוגיסטיקה")}" list="roles"><datalist id="roles"><option value="לוגיסטיקה"><option value="מנהל אתר"><option value="מפעיל"></datalist></div>
      ${k.hasHours ? `<div class="f"><label>שעות מנוע</label><input type="number" id="cHours" inputmode="numeric" value="${svc ? svc.hours || "" : ""}" min="0"><div class="hint">קודם: <span class="num">${svc ? fmtNum(svc.hours) : "—"}</span> · טיפול הבא ב-<span class="num">${svc ? fmtNum(svc.next) : "—"}</span></div></div>` : ""}
      ${!eq.plate ? `<div class="f"><label>מס׳ רישוי</label><input type="text" id="cPlate" value="" style="direction:ltr"></div>` : ""}
    </div>
    <div class="prog" id="prog"><span id="progT">0/${items.length} סומנו</span><i><b id="progB"></b></i></div>
    <p class="note" style="margin:0 0 8px">סמן V או X לפי הממצאים. X = לא תקין, חובה לפרט בהערות.</p>
    <div class="allok"><button type="button" class="ghost small" id="allOk">✓ הכול תקין</button></div>`;
  for (const g of k.groups){
    if (g.title) h += `<div class="sechead" style="margin-top:10px"><span>${esc(g.title)}</span></div>`;
    for (const it of g.items) h += `<div class="chk" data-key="${it.key}"><div class="q">${esc(it.text)}</div><div class="vx"><button type="button" class="v" aria-pressed="false" aria-label="תקין">V תקין</button><button type="button" class="x" aria-pressed="false" aria-label="לא תקין">X לא תקין</button></div><textarea class="nt" placeholder="הערה / מה לתקן" hidden></textarea></div>`;
  }
  h += `<h3>סיכום הבדיקה</h3><div class="opts" id="sumOpts">${SUMMARY.map(s => `<button type="button" class="opt ${s.key}" data-sum="${s.key}" aria-pressed="false">${s.text}</button>`).join("")}</div>
    <div id="defBlock" hidden style="margin-top:10px">
      <div class="f"><label>פירוט ליקויים</label><textarea id="cDef" placeholder="מה נמצא, מה צריך לקרות"></textarea></div>
      <div class="grid2"><div class="f"><label>אחראי לטיפול</label><input type="text" id="cOwner" placeholder="מוסך / שם"></div><div class="f"><label>תאריך יעד</label><input type="date" id="cDue"></div></div>
      <p class="note bad">לפי הנוהל: אין להתחיל לעבוד בציוד עד תיקון הליקוי, ומדווחים למנהל האתר.</p>
    </div>
    <h3>חתימת הבודק</h3><canvas class="sig" id="sig" aria-label="חתימה באצבע"></canvas><div class="sigrow"><span class="hint" style="font-size:.76rem;color:var(--ink3)">חותמים באצבע</span><button type="button" class="del" id="sigClear">ניקוי</button></div>
    <h3>צילומים <small style="font-weight:400;color:var(--ink3)">(ליקויים, מד שעות)</small></h3>
    <div id="photoBlock">${state.assets ? `<label class="filebtn">📷 הוספת צילום<input type="file" id="cPhoto" accept="image/*" multiple></label><div class="photos" id="photos"></div>` : `<p class="note">צילומים זמינים רק לעורכים של הארטיפקט.</p>`}</div>
    <button type="button" class="add" id="cSave" style="margin-top:16px">שמירת הטופס</button>`;
  const sh = openSheet(h);
  const prog = () => { const n = Object.values(data.items).filter(Boolean).length; sh.querySelector("#progT").textContent = n + "/" + items.length + " סומנו"; sh.querySelector("#progB").style.width = Math.round(n / items.length * 100) + "%"; };
  const setItem = (key, v) => {
    data.items[key] = v; const row = sh.querySelector(`.chk[data-key="${key}"]`);
    row.querySelector(".v").setAttribute("aria-pressed", v === "ok"); row.querySelector(".x").setAttribute("aria-pressed", v === "bad");
    row.classList.toggle("bad", v === "bad"); const nt = row.querySelector(".nt"); nt.hidden = v !== "bad"; if (v === "bad" && !nt.value) nt.focus();
    prog(); if (!data.summaryTouched) setSummary(suggestSummary(data.items), true);
  };
  const setSummary = (s, auto) => { data.summary = s; if (!auto) data.summaryTouched = true; sh.querySelectorAll("[data-sum]").forEach(b => b.setAttribute("aria-pressed", b.dataset.sum === s)); sh.querySelector("#defBlock").hidden = s === "ok"; };
  sh.querySelectorAll(".chk").forEach(row => { const key = row.dataset.key; row.querySelector(".v").onclick = () => setItem(key, "ok"); row.querySelector(".x").onclick = () => setItem(key, "bad"); row.querySelector(".nt").oninput = e => data.notes[key] = e.target.value; });
  sh.querySelector("#allOk").onclick = () => items.forEach(it => setItem(it.key, "ok"));
  sh.querySelectorAll("[data-sum]").forEach(b => b.onclick = () => setSummary(b.dataset.sum, false));
  const sig = signaturePad(sh.querySelector("#sig")); sh.querySelector("#sigClear").onclick = () => sig.clear();
  const ph = sh.querySelector("#cPhoto"); if (ph) ph.onchange = async () => {
    for (const f of ph.files){ try { const blob = await shrink(f); const a = await state.assets.upload(blob); data.photos.push(a.id); sh.querySelector("#photos").appendChild(el(`<img src="${esc(a.url)}" alt="צילום">`)); } catch (e){ toast("העלאת הצילום נכשלה", "bad"); } }
    ph.value = "";
  };
  sh.querySelector("#cSave").onclick = async () => {
    const name = sh.querySelector("#cName").value.trim(); if (!name){ toast("צריך שם בודק", "bad"); sh.querySelector("#cName").focus(); return; }
    const missing = items.filter(it => !data.items[it.key]); if (missing.length){ toast("נשארו " + missing.length + " סעיפים בלי V או X", "bad"); sh.querySelector(`.chk[data-key="${missing[0].key}"]`).scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const noNote = items.filter(it => data.items[it.key] === "bad" && !(data.notes[it.key] || "").trim()); if (noNote.length){ toast("X בלי פירוט: " + noNote[0].text.slice(0, 30), "bad"); sh.querySelector(`.chk[data-key="${noNote[0].key}"] .nt`).focus(); return; }
    if (!data.summary) setSummary(suggestSummary(data.items), true);
    const hoursEl = sh.querySelector("#cHours"); const hours = hoursEl ? Number(hoursEl.value) : "";
    if (hoursEl && hoursEl.value === ""){ toast("צריך שעות מנוע", "bad"); hoursEl.focus(); return; }
    if (hoursEl && svc && hours < svc.hours && !confirm("שעות המנוע (" + hours + ") נמוכות מהקודמות (" + svc.hours + "). לשמור בכל זאת?")) return;
    const btn = sh.querySelector("#cSave"); btn.disabled = true; btn.textContent = "שומר…";
    const check = { eqId: eq.id, eqName: eq.name, kind: eq.kind, date: sh.querySelector("#cDate").value || isoDate(), inspector: name, role: sh.querySelector("#cRole").value.trim(), site: sh.querySelector("#cSite").value.trim(),
      plate: eq.plate || (sh.querySelector("#cPlate") ? sh.querySelector("#cPlate").value.trim() : ""), hours: hoursEl ? hours : "", items: { ...data.items }, notes: Object.fromEntries(Object.entries(data.notes).filter(([k, v]) => data.items[k] === "bad" && v.trim()).map(([k, v]) => [k, v.trim()])),
      summary: data.summary, defectsText: data.summary === "ok" ? "" : sh.querySelector("#cDef").value.trim(), owner: data.summary === "ok" ? "" : sh.querySelector("#cOwner").value.trim(), due: data.summary === "ok" ? "" : sh.querySelector("#cDue").value,
      signature: sig.isEmpty() ? "" : sig.toDataURL(), photos: data.photos };
    LS.set("name", name); LS.set("role", check.role);
    try {
      await saveCheck(check);
      for (const d of defectsFromCheck(check, state.defects)) await saveDefect(d);
      const patch = {}; if (hoursEl && hours > (Number(eq.hours) || 0)) patch.hours = hours;
      if (!eq.plate && check.plate) patch.plate = check.plate;
      if (Object.keys(patch).length) await saveEquipment({ ...eq, ...patch });
      closeSheet(); const n = countItems(check.items); toast("נשמר · " + n.ok + " תקין" + (n.bad ? ", " + n.bad + " ליקויים נפתחו" : ""));
      showCheck(check.id);
    } catch (e){ btn.disabled = false; btn.textContent = "שמירת הטופס"; toast("השמירה נכשלה: " + (e.message || e), "bad"); }
  };
}

// חתימה באצבע על קנבס; שומרים PNG קטן
function signaturePad(canvas){
  const ratio = Math.min(2, window.devicePixelRatio || 1); let drawn = false, drawing = false, last = null;
  const fit = () => { const r = canvas.getBoundingClientRect(); canvas.width = Math.max(1, Math.round(r.width * ratio)); canvas.height = Math.max(1, Math.round(r.height * ratio)); const c = canvas.getContext("2d"); c.lineWidth = 2.2 * ratio; c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = "#121212"; };
  fit(); if (canvas.width <= 1) requestAnimationFrame(fit);
  const pos = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * ratio, (e.clientY - r.top) * ratio]; };
  canvas.addEventListener("pointerdown", e => { drawing = true; last = pos(e); canvas.setPointerCapture(e.pointerId); e.preventDefault(); });
  canvas.addEventListener("pointermove", e => { if (!drawing) return; const p = pos(e), c = canvas.getContext("2d"); c.beginPath(); c.moveTo(last[0], last[1]); c.lineTo(p[0], p[1]); c.stroke(); last = p; drawn = true; });
  const up = () => { drawing = false; }; canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  return { clear(){ canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height); drawn = false; }, isEmpty: () => !drawn,
    toDataURL(){ const w = 360, hgt = Math.round(canvas.height / canvas.width * w) || 120; const o = document.createElement("canvas"); o.width = w; o.height = hgt; o.getContext("2d").drawImage(canvas, 0, 0, w, hgt); return o.toDataURL("image/png"); } };
}
// מקטינים צילום לפני העלאה (עד 1280px, JPEG)
async function shrink(file){
  if (!/^image\//.test(file.type)) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(1, 1280 / Math.max(img.width, img.height)); if (s === 1 && file.size < 600000) return file;
    const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(b => res(b || file), "image/jpeg", 0.82));
  } catch { return file; } finally { URL.revokeObjectURL(url); }
}
