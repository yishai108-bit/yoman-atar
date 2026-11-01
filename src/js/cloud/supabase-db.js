/* ================= שכבת חיבור ל-Supabase =================
   מחזירה אובייקט במבנה של window.claude של ה-artifact (use("db"|"user"|"assets"|"downloads"|"sample")),
   כך שכל המודולים של האפליקציה רצים בלי שינוי: אותם מסכים, אותן פעולות, אותם חישובים.

   המאגר: טבלה אחת docs(site_id, coll, id, data jsonb) (ראו supabase/1-סכמה.sql). כל אוסף של האפליקציה הוא
   coll; כל מסמך הוא שורה. ההרשאות (בעלים / עריכה / צפייה לכל אתר) נאכפות ב-RLS בשרת.
   קריאה: כל אוסף נטען פעם אחת למטמון ומוחזק מעודכן בזמן אמת (Realtime על docs) ובבדיקה תקופתית (updated_at),
   כך ש-onSnapshot מתנהג כמו במאגר של ה-artifact. כתיבה: upsert לשורה, ואז עדכון המטמון והמאזינים.
   קבצים (צילומים, חתימות, תוכניות): Supabase Storage, דלי public בשם assets, נתיב <אתר>/<מזהה>.<סיומת>. */

const PAGE=1000;                                   // מגבלת שורות לבקשה ב-PostgREST
const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const merge=(a,b)=>{ const o={...(a||{})}; for(const [k,v] of Object.entries(b||{})) o[k]=v&&typeof v==="object"&&!Array.isArray(v)&&o[k]&&typeof o[k]==="object"&&!Array.isArray(o[k])?merge(o[k],v):v; return o; };
const META={fromCache:false,hasPendingWrites:false};
const err=(code,msg)=>Object.assign(new Error(msg||code),{code});

export function makeBackend(sb,ctx){
  const { siteId, siteSlug, role, user, url } = ctx;
  const colls=new Map();                           // coll -> {docs:Map, ready:Promise|null, subs:Set}
  const state=c=>{ let s=colls.get(c); if(!s){ s={docs:new Map(),ready:null,subs:new Set()}; colls.set(c,s); } return s; };

  /* ---------- קריאה ---------- */
  async function fetchAll(coll){
    const out=new Map(); let from=0;
    for(;;){
      const { data, error } = await sb.from("docs").select("id,data").eq("site_id",siteId).eq("coll",coll).order("id").range(from,from+PAGE-1);
      if(error) throw err("unavailable",error.message);
      for(const r of data||[]) out.set(r.id,r.data);
      if(!data||data.length<PAGE) break; from+=PAGE;
    }
    return out;
  }
  function load(coll){ const s=state(coll); if(!s.ready) s.ready=fetchAll(coll).then(m=>{ s.docs=m; return s; }).catch(e=>{ s.ready=null; throw e; }); return s.ready; }
  async function reload(coll){ const s=state(coll); try{ s.docs=await fetchAll(coll); s.ready=Promise.resolve(s); notify(coll); }catch(e){ for(const sub of s.subs) sub.error&&sub.error(e); } }

  const snapDoc=(coll,id)=>{ const body=state(coll).docs.get(id); return { id, exists:body!==undefined, data:()=>clone(body), metadata:META }; };
  function runQuery(q){
    let docs=[...state(q.coll).docs.keys()].sort().map(id=>snapDoc(q.coll,id));
    for(const [f,op,v] of q.where) docs=docs.filter(d=>{ const x=d.data()[f];
      return op==="=="?x===v:op==="!="?x!==v:op==="<"?x<v:op==="<="?x<=v:op===">"?x>v:op===">="?x>=v:op==="in"?(v||[]).includes(x):true; });
    if(q.order) docs.sort((a,b)=>{ const x=a.data()[q.order[0]], y=b.data()[q.order[0]]; const c=x<y?-1:x>y?1:0; return q.order[1]==="desc"?-c:c; });
    if(q.lim) docs=docs.slice(0,q.lim);
    return { docs, size:docs.length, empty:!docs.length, docChanges:()=>[], metadata:META };
  }
  function notify(coll){ const s=state(coll); for(const sub of [...s.subs]){ if(sub.dead) continue; try{ sub.kind==="doc"?sub.next(snapDoc(coll,sub.id)):sub.next(runQuery(sub.q)); }catch(e){} } }
  function subscribe(coll,sub){ const s=state(coll); s.subs.add(sub);
    load(coll).then(()=>{ if(!sub.dead){ sub.kind==="doc"?sub.next(snapDoc(coll,sub.id)):sub.next(runQuery(sub.q)); } }).catch(e=>{ if(!sub.dead&&sub.error) sub.error(e); });
    return ()=>{ sub.dead=true; s.subs.delete(sub); }; }

  /* ---------- כתיבה ---------- */
  const split=path=>{ const p=String(path).split("/"); if(p.length!==2||!p[0]||!p[1]) throw err("invalid_argument","path "+path); return p; };
  async function put(coll,id,body){
    const { error } = await sb.from("docs").upsert({ site_id:siteId, coll, id, data:body },{ onConflict:"site_id,coll,id" });
    if(error) throw err(/row-level|policy|permission|42501/i.test(error.message||"")?"invalid_argument":"unavailable",error.message);
    state(coll).docs.set(id,clone(body)); notify(coll);
  }
  const docRef=path=>{ const [coll,id]=split(path); return {
    id, path,
    async get(){ await load(coll); return snapDoc(coll,id); },
    async set(data){ await put(coll,id,clone(data)); },
    async update(patch){ await load(coll); const cur=state(coll).docs.get(id); if(cur===undefined) throw err("invalid_argument","missing"); await put(coll,id,merge(cur,clone(patch))); },
    async delete(){ const { error } = await sb.from("docs").delete().match({ site_id:siteId, coll, id }); if(error) throw err("unavailable",error.message); state(coll).docs.delete(id); notify(coll); },
    onSnapshot(next,error){ return subscribe(coll,{kind:"doc",id,next,error}); },
  }; };
  const query=q=>({
    where:(f,op,v)=>query({...q,where:[...q.where,[f,op,v]]}),
    orderBy:(f,d)=>query({...q,order:[f,d||"asc"]}),
    limit:n=>query({...q,lim:n}),
    async get(){ await load(q.coll); return runQuery(q); },
    onSnapshot(next,error){ return subscribe(q.coll,{kind:"q",q,next,error}); },
  });
  const collRef=coll=>Object.assign(query({coll,where:[],order:null,lim:0}),{
    path:coll, doc:id=>docRef(coll+"/"+(id||("d"+Date.now().toString(36)+Math.random().toString(36).slice(2,7)))),
    async add(data){ const r=docRef(coll+"/d"+Date.now().toString(36)+Math.random().toString(36).slice(2,7)); await r.set(data); return r; },
  });
  const db={ doc:docRef, collection:collRef };

  /* ---------- זמן אמת + בדיקה תקופתית ---------- */
  const pending=new Map();                        // coll -> timer
  const touch=coll=>{ if(!coll) return; clearTimeout(pending.get(coll)); pending.set(coll,setTimeout(()=>{ pending.delete(coll); if(colls.has(coll)) reload(coll); },200)); };
  let channel=null;
  try{
    channel=sb.channel("docs:"+siteId)
      .on("postgres_changes",{event:"*",schema:"public",table:"docs",filter:"site_id=eq."+siteId},p=>{ const r=p.new&&p.new.coll?p.new:p.old; touch(r&&r.coll); })
      .subscribe(()=>{});
  }catch(e){ channel=null; }
  let since=new Date().toISOString();
  async function poll(){
    if(document.hidden) return;
    try{
      const { data, error } = await sb.from("docs").select("coll,id,data,updated_at").eq("site_id",siteId).gt("updated_at",since).order("updated_at").limit(PAGE);
      if(error||!data) return;
      const changed=new Set();
      for(const r of data){ since=r.updated_at>since?r.updated_at:since; const s=colls.get(r.coll); if(!s||!s.ready) continue; const cur=s.docs.get(r.id); if(JSON.stringify(cur)!==JSON.stringify(r.data)){ s.docs.set(r.id,r.data); changed.add(r.coll); } }
      changed.forEach(notify);
    }catch(e){}
  }
  const timer=setInterval(poll,45000);
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden) poll(); });

  /* ---------- משתמש ---------- */
  const name=(user&&(user.user_metadata&&(user.user_metadata.name||user.user_metadata.full_name)))||(user&&user.email?user.email.split("@")[0]:"משתמש");
  const avatar="data:image/svg+xml;utf8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#1D4E6B"/><text x="24" y="31" font-size="22" font-family="sans-serif" font-weight="700" fill="#fff" text-anchor="middle">'+String(name).trim().charAt(0).toUpperCase()+'</text></svg>');
  const me={ id:user?user.id:"", name, avatarUrl:avatar, isOwner:role==="owner", canEdit:role!=="viewer", email:user?user.email:"" };
  const usr={ isOwner:async()=>me.isOwner, canEdit:async()=>me.canEdit, id:async()=>me.id, me:async()=>({...me}), profiles:async()=>({}), search:async()=>[] };

  /* ---------- קבצים ---------- */
  const base=url.replace(/\/$/,"")+"/storage/v1/object/public/assets/";
  const assets={
    async upload(blob){
      const type=(blob&&blob.type)||"application/octet-stream";
      const ext=type==="image/png"?"png":type==="image/webp"?"webp":type==="application/pdf"?"pdf":type==="image/jpeg"?"jpg":(type.split("/")[1]||"bin").replace(/[^a-z0-9]/gi,"").slice(0,5)||"bin";
      const id=siteSlug+"/"+Date.now().toString(36)+Math.random().toString(36).slice(2,8)+"."+ext;
      const { error } = await sb.storage.from("assets").upload(id,blob,{ contentType:type, upsert:false, cacheControl:"31536000" });
      if(error) throw err("unavailable",error.message);
      return { id, url:base+id, size:blob.size||0, type };
    },
    base,
  };

  /* ---------- הורדות: קובץ לדפדפן ---------- */
  const downloads={ async save(f){ const blob=f.data instanceof Blob?f.data:new Blob([f.data],{type:f.type||"application/octet-stream"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=f.filename||"file"; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1500); } };

  return {
    use: async n=> n==="db"?db : n==="user"?usr : n==="assets"?assets : n==="downloads"?downloads : null,
    blobBase: base,
    close(){ clearInterval(timer); try{ if(channel) sb.removeChannel(channel); }catch(e){} },
    _colls: colls,
  };
}
