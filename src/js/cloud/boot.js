/* ================= עלייה באירוח עצמאי (Vercel + Supabase) =================
   אותה אפליקציה בדיוק (main.js), רק שהמאגר, המשתמש והקבצים מגיעים מ-Supabase ולא מ-window.claude של ה-artifact.
   הסדר: כניסה במייל וסיסמה → רשימת האתרים שיש לך בהם הרשאה → בחירת אתר (או מסך חברה) → האפליקציה עולה.
   main.js (18-identity) מחכה ל-window.__backend, שההבטחה שלו נוצרת ב-cloud.html לפני טעינת הקוד.
   ההגדרות: VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY בזמן הבנייה (משתני סביבה ב-Vercel). המפתח anon ציבורי מעצם טבעו;
   ההרשאות נאכפות ב-RLS בשרת (supabase/1-סכמה.sql). */
import "../main.js";
import { createClient } from "@supabase/supabase-js";
import { makeBackend } from "./supabase-db.js";
import { $, esc, shared, toast } from "../core.js";
import { siteBuildSeries } from "../19-site-build.js";

/* שני מוצרים מאותו קוד (ישי 1.11): «יומן אתר» של בלקטריק, ו«יומן אתר · קבלן חשמל» שמשרת קבלני חשמל (S.E.E ועוד).
   פריסות נפרדות: פרויקט Vercel נפרד, פרויקט Supabase נפרד, כתובת נפרדת; אין נתונים או משתמשים משותפים.
   הצד נקבע ב-VITE_ORG בזמן הבנייה (belectric / see) ונעול; בלי VITE_ORG (בדיקות, מקומי) לפי הדומיין (…hashmal… = see) או ?org=see. */
const ENV=(import.meta.env||{});
const ORGS={
  belectric:{ id:"belectric", brand:"BELECTRIC", url:ENV.VITE_SUPABASE_URL||window.__SB_URL||"",         key:ENV.VITE_SUPABASE_ANON_KEY||window.__SB_KEY||"" },
  see:      { id:"see",       brand:"S.E.E",     url:ENV.VITE_SEE_SUPABASE_URL||window.__SB_SEE_URL||"", key:ENV.VITE_SEE_SUPABASE_ANON_KEY||window.__SB_SEE_KEY||"" },
};
const qs=new URLSearchParams(location.search);
const LOCK=ORGS[ENV.VITE_ORG||window.__ORG||""]||null;
const ORG=LOCK||(/hashmal|-see\b|^see\./.test(location.hostname)?ORGS.see:null)||ORGS[qs.get("org")]||ORGS.belectric;
/* הכתובת הישנה של קבלן החשמל על הפריסה של בלקטריק: מפנים לכתובת החדשה (VITE_SEE_APP_URL) ולא מציגים כלום. */
const MOVED=LOCK&&LOCK.id==="belectric"&&/hashmal/.test(location.hostname)?(ENV.VITE_SEE_APP_URL||""):"";
const CFG={ url:ORG.url, key:ORG.key };
const ready=v=>{ if(window.__backendReady) window.__backendReady(v); };
const LS={ get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} }, del:k=>{ try{ localStorage.removeItem(k); }catch(e){} } };

function screen(html){ document.querySelectorAll(".cloud-screen").forEach(e=>e.remove()); const el=document.createElement("div"); el.className="lock cloud-screen"; el.setAttribute("role","dialog"); el.setAttribute("aria-modal","true"); el.innerHTML=html; document.body.appendChild(el); return el; }
const brand=()=>'<div class="brand">'+esc((shared.CLOUD&&shared.CLOUD.company)||ORG.brand)+'</div>';

/* ---------- כניסה ---------- */
function login(sb){
  return new Promise(res=>{
    const el=screen(brand()+'<h2>יומן אתר</h2><div class="sub">כניסה במייל ובסיסמה שקיבלת</div>'
      +'<form class="cloud-form" id="cfLogin" autocomplete="on">'
      +'<div class="f"><label for="cfEmail">מייל</label><input type="email" id="cfEmail" inputmode="email" autocomplete="username" required></div>'
      +'<div class="f"><label for="cfPass">סיסמה</label><input type="password" id="cfPass" autocomplete="current-password" required></div>'
      +'<div class="cloud-err" id="cfErr" role="alert" hidden></div>'
      +'<button class="save" type="submit" id="cfGo">כניסה</button>'
      +'<button class="linkbtn" type="button" id="cfForgot">שכחתי סיסמה</button></form>');
    const f=el.querySelector("#cfLogin"), e=el.querySelector("#cfErr"), go=el.querySelector("#cfGo");
    const email=()=>el.querySelector("#cfEmail").value.trim();
    const bad=msg=>{ e.textContent=msg; e.hidden=false; go.disabled=false; go.textContent="כניסה"; };
    f.onsubmit=async ev=>{ ev.preventDefault(); e.hidden=true; go.disabled=true; go.textContent="רגע…";
      const { data, error } = await sb.auth.signInWithPassword({ email:email(), password:el.querySelector("#cfPass").value });
      if(error||!data||!data.session){ bad(/invalid/i.test(error&&error.message||"")?"המייל או הסיסמה לא נכונים.":"הכניסה נכשלה: "+((error&&error.message)||"")); return; }
      el.remove(); res(data.session); };
    el.querySelector("#cfForgot").onclick=async()=>{ if(!email()){ bad("כתוב קודם את המייל."); return; }
      const { error } = await sb.auth.resetPasswordForEmail(email(),{ redirectTo:location.origin+location.pathname });
      bad(error?"לא הצלחתי לשלוח: "+error.message:"נשלח מייל עם קישור לקביעת סיסמה חדשה."); };
    setTimeout(()=>el.querySelector("#cfEmail").focus(),50);
  });
}

/* ---------- סיסמה חדשה (אחרי קישור «שכחתי סיסמה») ---------- */
function newPassword(sb){
  return new Promise(res=>{
    const el=screen(brand()+'<h2>סיסמה חדשה</h2><div class="sub">לפחות 8 תווים</div>'
      +'<form class="cloud-form" id="cfNew"><div class="f"><label for="cfP1">סיסמה חדשה</label><input type="password" id="cfP1" autocomplete="new-password" minlength="8" required></div>'
      +'<div class="cloud-err" id="cfErr2" role="alert" hidden></div><button class="save" type="submit">שמור והמשך</button></form>');
    el.querySelector("#cfNew").onsubmit=async ev=>{ ev.preventDefault(); const { error } = await sb.auth.updateUser({ password:el.querySelector("#cfP1").value });
      if(error){ const e=el.querySelector("#cfErr2"); e.textContent=error.message; e.hidden=false; return; } el.remove(); res(); };
  });
}

/* ---------- האתרים של המשתמש ---------- */
async function mySites(sb){
  let { data, error } = await sb.from("members").select("role, site:sites(id,slug,name,company,ord)");
  if(error&&/company|ord/.test(error.message||"")){ ({ data, error } = await sb.from("members").select("role, site:sites(id,slug,name)")); }   // סכמה בלי העמודות החדשות
  if(error) throw error;
  const order={ "ein-tamar":0, moledet:1, "beer-tuvia":2 };
  return (data||[]).filter(r=>r.site).map(r=>({ id:r.site.id, slug:r.site.slug, name:r.site.name, company:r.site.company||ORG.brand, role:r.role, ord:Number(r.site.ord)||(order[r.site.slug]??9) })).sort((a,b)=>a.ord-b.ord||a.name.localeCompare(b.name,"he"));
}

/* ---------- מסך חברה: שורה לכל אתר, כמו שמנהל רואה 10 אתרים במבט אחד ---------- */
const ROLE_HE={ owner:"בעלים", editor:"עריכה", viewer:"צפייה" };
const fmtN=n=>Number(n||0).toLocaleString("he-IL");
async function siteStats(sb,site){
  const [st,tk,lg]=await Promise.all([
    sb.from("docs").select("data").eq("site_id",site.id).eq("coll","status").limit(PAGE_SMALL),
    sb.from("docs").select("data").eq("site_id",site.id).eq("coll","tasks").limit(PAGE_SMALL),
    sb.from("docs").select("data").eq("site_id",site.id).eq("coll","log").order("ts",{ascending:false}).limit(1),
  ]);
  const acts=(st.data||[]).map(r=>r.data), tasks=(tk.data||[]).map(r=>r.data), last=(lg.data||[])[0];
  const ser=siteBuildSeries(acts); const s=ser.panels||ser.tables||null;
  const done=s&&s.pts.length?s.pts[s.pts.length-1][1]:0, total=s?s.total:0;
  const today=new Date().toISOString().slice(0,10);
  const open=tasks.filter(t=>t&&t.status!=="done"), late=open.filter(t=>t.due&&t.due<today);
  return { pct:total?done/total:null, done, total, unit:ser.panels?"פאנלים":"שולחנות", open:open.length, late:late.length, lastTs:last&&last.data?Number(last.data.ts)||0:0, lastWho:last&&last.data?last.data.who||"":"" };
}
const PAGE_SMALL=1000;
const ago=ts=>{ if(!ts) return "אין עדיין פעילות"; const d=(Date.now()-ts)/36e5; if(d<1) return "לפני פחות משעה"; if(d<24) return "לפני "+Math.round(d)+" שעות"; const dd=Math.round(d/24); return dd===1?"אתמול":"לפני "+dd+" ימים"; };

function openCompany(sb,sites,current,onPick){
  const mixed=new Set(sites.map(s=>s.company)).size>1;
  const el=screen(brand()+'<h2>כל האתרים</h2><div class="sub">'+sites.length+' אתרים · לחיצה פותחת את היומן של האתר</div><div class="cloud-sites" id="cfSites">'
    +sites.map(s=>'<button type="button" class="cloud-site" data-slug="'+esc(s.slug)+'"'+(current&&current.slug===s.slug?' aria-current="true"':'')+'><span class="cs-name">'+(mixed?'<small class="cs-co">'+esc(s.company)+'</small>':'')+esc(s.name)+'<i class="role-badge role-'+esc(s.role)+'">'+(ROLE_HE[s.role]||s.role)+'</i></span>'
      +'<span class="cs-pct"><b class="num">…</b></span><span class="cs-sub">טוען…</span></button>').join("")
    +'</div>'+(current?'<button type="button" class="linkbtn" id="cfBack">חזרה ל'+esc(current.name)+'</button>':'')+'<button type="button" class="linkbtn" id="cfOut">יציאה</button>');
  el.querySelector("#cfSites").onclick=e=>{ const b=e.target.closest("[data-slug]"); if(!b) return; const s=sites.find(x=>x.slug===b.dataset.slug); if(s) onPick(s); };
  const back=el.querySelector("#cfBack"); if(back) back.onclick=()=>el.remove();
  el.querySelector("#cfOut").onclick=()=>signOut(sb);
  sites.forEach(async s=>{ const b=el.querySelector('[data-slug="'+s.slug+'"]'); if(!b) return;
    try{ const st=await siteStats(sb,s);
      b.querySelector(".cs-pct").innerHTML=st.pct===null?'<b class="num">—</b>':'<b class="num">'+Math.round(st.pct*100)+'%</b><small>'+fmtN(st.done)+' מתוך '+fmtN(st.total)+' '+st.unit+'</small>';
      b.querySelector(".cs-sub").innerHTML=(st.open?'<span class="cs-open'+(st.late?' late':'')+'">'+st.open+' משימות פתוחות'+(st.late?' · '+st.late+' באיחור':'')+'</span>':'<span class="cs-open ok">אין משימות פתוחות</span>')+' · '+esc(ago(st.lastTs))+(st.lastWho?' · '+esc(st.lastWho):'');
    }catch(e){ b.querySelector(".cs-sub").textContent="לא נטען"; } });
  return el;
}

async function signOut(sb){ try{ await sb.auth.signOut(); }catch(e){} LS.del("cloudSite"); location.replace(location.pathname); }

/* ---------- עלייה ---------- */
(async()=>{
  if(MOVED){ screen('<div class="brand">יומן אתר · קבלן חשמל</div><h2>עברנו לכתובת חדשה</h2><div class="sub"><a href="'+esc(MOVED)+'">'+esc(MOVED)+'</a></div>'); ready(null); return; }
  if(!CFG.url||!CFG.key){ screen(brand()+'<h2>יומן אתר</h2><div class="sub">החיבור למאגר של '+esc(ORG.brand)+' עוד לא הוגדר בגרסה הזאת ('+(ORG.id==="see"?"VITE_SEE_SUPABASE_URL / VITE_SEE_SUPABASE_ANON_KEY":"VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY")+').</div>'); ready(null); return; }
  const sb=(window.__createSupabase||createClient)(CFG.url,CFG.key,{ auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storageKey:"sb-"+ORG.id } });
  shared.CLOUD={ sb, org:ORG.id, url:CFG.url, company:ORG.brand, sites:[], site:null, openCompany:()=>{}, signOut:()=>signOut(sb) };
  let session=null;
  try{ session=(await sb.auth.getSession()).data.session; }catch(e){}
  const recovering=/type=recovery/.test(location.hash||"");
  if(!session) session=await login(sb);
  if(recovering) await newPassword(sb);
  let sites=[];
  try{ sites=await mySites(sb); }catch(e){ toast("לא הצלחתי לקרוא את רשימת האתרים: "+(e.message||"")); }
  shared.CLOUD.sites=sites;
  if(!sites.length){ screen(brand()+'<h2>אין גישה לאף אתר</h2><div class="sub">נכנסת כ-'+esc(session.user.email||"")+'. בקש ממנהל האפליקציה לצרף אותך לאתר.</div><button type="button" class="linkbtn" id="cfOut0">יציאה</button>').querySelector("#cfOut0").onclick=()=>signOut(sb); ready(null); return; }
  const want=qs.get("site")||LS.get("cloudSite");
  let site=sites.find(s=>s.slug===want)||(sites.length===1?sites[0]:null);
  const pick=s=>{ LS.set("cloudSite",s.slug); const u=new URL(location.href); u.searchParams.set("site",s.slug); u.hash=""; location.replace(u.toString()); };
  if(!site){ openCompany(sb,sites,null,pick); ready(null); return; }   // בחירה → טעינה מחדש עם ?site=
  LS.set("cloudSite",site.slug);
  shared.CLOUD.site=site; shared.CLOUD.openCompany=()=>openCompany(sb,sites,site,s=>{ if(s.slug===site.slug){ document.querySelectorAll(".cloud-screen").forEach(e=>e.remove()); return; } pick(s); });
  const be=makeBackend(sb,{ siteId:site.id, siteSlug:site.slug, role:site.role, user:session.user, url:CFG.url });
  shared.BLOB_BASE=be.blobBase;
  shared.CLOUD.company=site.company||ORG.brand;
  const sn=$("#siteName"); if(sn){ sn.innerHTML='<b>'+esc(shared.CLOUD.company)+'</b>'+esc(site.name); sn.style.cursor="pointer"; sn.title="כל האתרים"; sn.onclick=()=>shared.CLOUD.openCompany(); }
  document.title="יומן אתר · "+site.name;
  sb.auth.onAuthStateChange((ev)=>{ if(ev==="SIGNED_OUT") location.replace(location.pathname); });
  ready(be);
})();
