"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {FormEvent} from "react";
import type {Session} from "@supabase/supabase-js";
import {browserClient} from "@/lib/supabase";

type Project={id:string;name:string;created_at:string};
type Connection={id:string;label:string;studio_id:string;active:boolean;last_seen_at:string|null};
type Command={id:string;kind:string;payload:Record<string,unknown>;status:string;result:{detail?:string}|null};
type Message={id:string;role:string;content:string};
type State={project:Project;connections:Connection[];commands:Command[];messages:Message[]};
const supabase=browserClient();
const labels:Record<string,string>={pending_approval:"Review required",queued:"Queued for Studio",leased:"Applying in Studio",needs_reconciliation:"Needs manual reconciliation",completed:"Reported applied",failed:"Failed / rejected"};

export default function Home(){
 const [session,setSession]=useState<Session|null>(null);
 const [email,setEmail]=useState(""),[password,setPassword]=useState("");
 const [loginMode,setLoginMode]=useState<"login"|"signup">("login");
 const [projects,setProjects]=useState<Project[]>([]),[projectId,setProjectId]=useState("");
 const [state,setState]=useState<State|null>(null),[name,setName]=useState(""),[prompt,setPrompt]=useState("");
 const [pair,setPair]=useState<{code:string;origin:string;expiresAt:string}|null>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const projectIdRef=useRef(projectId);
 projectIdRef.current=projectId;
 const api=useCallback(async (path:string,options:RequestInit={})=>{
  const {data:{session:live}}=await supabase.auth.getSession();
  if(!live?.access_token)throw Error("Sign in to continue");
  const response=await fetch(path,{...options,headers:{"content-type":"application/json",authorization:"Bearer "+live.access_token,...(options.headers||{})},cache:"no-store"});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||"Request failed");
  return data;
 },[]);
 const refresh=useCallback(async ()=>{
  const id=projectIdRef.current;
  if(!id)return;
  try{const data=await api("/api/projects/"+id+"/state");if(projectIdRef.current===id)setState(data);}
  catch{/* transient polling failure */}
 },[api]);
 useEffect(()=>{
  void supabase.auth.getSession().then(({data})=>setSession(data.session));
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,current)=>setSession(current));
  return ()=>subscription.unsubscribe();
 },[]);
 useEffect(()=>{
  if(!session){setProjects([]);setProjectId("");setState(null);return;}
  void api("/api/projects").then(d=>setProjects(d.projects)).catch(e=>setNotice(e.message));
 },[session,api]);
 useEffect(()=>{
  if(!projectId)return;
  void refresh();
  const timer=setInterval(()=>void refresh(),3500);
  return ()=>clearInterval(timer);
 },[projectId,refresh]);
 async function auth(e:FormEvent){
  e.preventDefault();setBusy(true);setNotice("");
  try{
   const result=loginMode==="login"?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password});
   if(result.error)throw result.error;
   if(loginMode==="signup"&&!result.data.session)setNotice("Check your email to confirm your account.");
  }catch(e){setNotice((e as Error).message);}finally{setBusy(false);}
 }
 async function action(fn:()=>Promise<void>){
  setBusy(true);setNotice("");
  try{await fn();}catch(e){setNotice((e as Error).message);}finally{setBusy(false);}
 }
 const online=state?.connections.some(c=>c.active&&c.last_seen_at&&Date.now()-Date.parse(c.last_seen_at)<20000);
 if(!session)return <main className="login-shell"><section className="login-card">
  <div className="brand"><span className="logo-mark">R</span><span>RSGP <small>STUDIO GAME PRINTER</small></span></div>
  <div className="hero-tag">YOUR ROBLOX WORKSHOP, ONLINE</div>
  <h1>From an idea<br/>to a real game.</h1>
  <p>Plan, build and refine your Roblox experience in one connected workspace.</p>
  <form onSubmit={auth}>
   <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@example.com"/></label>
   <label>Password<input type="password" minLength={6} value={password} onChange={e=>setPassword(e.target.value)} required placeholder="At least 6 characters"/></label>
   <button className="primary" disabled={busy}>{loginMode==="login"?"Sign in →":"Create account →"}</button>
  </form>
  <button className="text-button" onClick={()=>setLoginMode(loginMode==="login"?"signup":"login")}>{loginMode==="login"?"New here? Create an account":"Already have an account? Sign in"}</button>
  {notice&&<p className="notice">{notice}</p>}
 </section></main>;
 return <div className="shell">
  <aside className="sidebar">
   <div className="brand"><span className="logo-mark">R</span><span>RSGP <small>GAME PRINTER</small></span></div>
   <div className="sidebar-heading">YOUR PROJECTS</div>
   <div className="project-list">{projects.map(p=><button key={p.id} className={"project-item "+(projectId===p.id?"selected":"")} onClick={()=>{setProjectId(p.id);setPair(null);setState(null);}}><span className="project-glyph">◈</span>{p.name}</button>)}</div>
   <form onSubmit={e=>{e.preventDefault();void action(async()=>{const d=await api("/api/projects",{method:"POST",body:JSON.stringify({name})});setProjects(ps=>[d.project,...ps]);setProjectId(d.project.id);setName("");});}}>
    <input value={name} onChange={e=>setName(e.target.value)} maxLength={80} placeholder="New project name" required/>
    <button className="secondary" disabled={busy}>+ Create project</button>
   </form>
   <div className="sidebar-footer"><span>{session.user.email}</span><button className="text-button" onClick={()=>void supabase.auth.signOut()}>Sign out</button></div>
  </aside>
  <main className="workspace">
   {!projectId?<section className="empty"><div className="big-mark">✦</div><h1>What will you build?</h1><p>Create a project on the left to start your Roblox game.</p></section>:<>
    <header className="topbar"><div><span className="eyebrow">WORKSPACE / {state?.project.name??"LOADING"}</span><h1>{state?.project.name||"Your project"}</h1></div><div className="connection"><span className={"dot "+(online?"online":"")}></span>{online?"Studio connected":"Studio offline"}</div></header>
    <div className="columns">
     <section className="panel builder">
      <div className="section-head"><span className="eyebrow">AI GAME BUILDER</span><span className="mini">Proposals require your approval</span></div>
      <div className="chat">{!state?.messages.length&&<div className="chat-intro"><div className="big-mark">✦</div><h2>Tell RSGP what to make.</h2><p>Try “Make a small neon obby with checkpoints and a starter HUD.”</p></div>}
       {state?.messages.map(m=><div key={m.id} className={"bubble "+m.role}><span>{m.role==="user"?"YOU":"RSGP"}</span><p>{m.content}</p></div>)}
      </div>
      <form className="composer" onSubmit={e=>{e.preventDefault();void action(async()=>{const d=await api("/api/projects/"+projectId+"/generate",{method:"POST",body:JSON.stringify({prompt})});setPrompt("");setNotice(d.proposed+" changes proposed. Review them before applying.");await refresh();});}}>
       <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={3000} placeholder="Describe your game or the change you want…" rows={3} required/>
       <div className="composer-bottom"><span>AI suggests • you approve • Studio applies</span><button disabled={busy||prompt.trim().length<5} className="primary">{busy?"Working…":"Generate plan ↗"}</button></div>
      </form>
     </section>
     <section className="right-rail">
      <div className="panel"><div className="section-head"><span className="eyebrow">STUDIO CONNECTION</span><span className="mini">Bridge</span></div>
       <h3>Link your Roblox Studio</h3><p className="muted">Install the RSGP plugin and paste a one-time pairing code into it.</p>
       <button className="secondary" disabled={busy} onClick={()=>void action(async()=>setPair(await api("/api/projects/"+projectId+"/pair",{method:"POST"})))}>Generate pairing code</button>
       {pair&&<div className="pair-code"><span>EXPIRES {new Date(pair.expiresAt).toLocaleTimeString()}</span><code>{pair.code}</code><button className="text-button" onClick={()=>void navigator.clipboard.writeText(pair.code)}>Copy code</button><small>Plugin endpoint: {pair.origin}</small></div>}
       {state?.connections.filter(c=>c.active).map(c=><div className="connection-row" key={c.id}><span>◉ {c.label}<small>{c.last_seen_at?"Seen "+new Date(c.last_seen_at).toLocaleTimeString():"Awaiting plugin"}</small></span><button className="text-button danger" onClick={()=>void action(async()=>{await api("/api/projects/"+projectId+"/connections",{method:"POST",body:JSON.stringify({connectionId:c.id})});await refresh();})}>Revoke</button></div>)}
      </div>
      <div className="panel changes"><div className="section-head"><span className="eyebrow">BUILD QUEUE</span><span className="mini">{state?.commands.length||0} changes</span></div>
       {!state?.commands.length?<p className="muted">Your AI-generated changes appear here for review.</p>:state?.commands.map(c=><div className="change" key={c.id}>
        <div className="change-title"><span className="file-icon">{c.kind==="create_script"?"⌘":c.kind==="create_gui"?"▣":"▧"}</span><strong>{String(c.payload.name||c.kind)}</strong></div>
        <div className="change-kind">{c.kind.replaceAll("_"," ")} · {labels[c.status]||c.status}</div>
        {c.kind==="create_script"?<details><summary>Preview Luau (disabled on insertion)</summary><pre>{String(c.payload.source)}</pre></details>:
         c.kind==="create_part"?<div className="change-preview">Position: {JSON.stringify(c.payload.position)} · Size: {JSON.stringify(c.payload.size)}</div>:
         c.kind==="create_gui"?<div className="change-preview">Heading: {String(c.payload.title)}<br/>Elements: {Array.isArray(c.payload.elements)?c.payload.elements.map((x:unknown)=>{const element=x as {kind:string;text:string};return element.kind+": "+element.text;}).join(" | "):"None"}</div>:null}
        {c.status==="pending_approval"&&<div className="review-actions">
          <button className="secondary approve" disabled={busy} onClick={()=>void action(async()=>{await api("/api/commands/"+c.id+"/approve",{method:"POST"});await refresh();})}>Approve & send →</button>
          <button className="text-button danger" disabled={busy} onClick={()=>void action(async()=>{await api("/api/commands/"+c.id+"/reject",{method:"POST"});await refresh();})}>Reject</button>
         </div>}
        {c.status==="needs_reconciliation"&&<div className="reconcile">
          <p>Studio may have applied this change. Inspect the place before resolving it. RSGP will not retry automatically.</p>
          <div className="review-actions">
           <button className="secondary" disabled={busy} onClick={()=>void action(async()=>{await api("/api/commands/"+c.id+"/reconcile",{method:"POST",body:JSON.stringify({outcome:"applied"})});await refresh();})}>I see it in Studio</button>
           <button className="text-button danger" disabled={busy} onClick={()=>void action(async()=>{await api("/api/commands/"+c.id+"/reconcile",{method:"POST",body:JSON.stringify({outcome:"not_applied"})});await refresh();})}>Not applied</button>
          </div>
         </div>}
        {c.result?.detail&&<small className="muted">{c.result.detail}</small>}
       </div>)}
      </div>
     </section>
    </div>
   </>}
   {notice&&<div className="toast" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
  </main>
 </div>;
}
