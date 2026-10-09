const KEY = "fio-data-v2";

// Primeiro uso: o FIO começa vazio. Nenhuma tarefa é criada automaticamente.
const EMPTY_DATA = { version: 2, projects: [] };
let data = load();
let view = "tasks";
let selectedTask = null;
let deferredInstallPrompt = null;
let isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
let historyReady = false;
let fioHistoryDepth = 0;
let taskTab = "active";

function navigate(nextView, taskId=null, replace=false){
  view = nextView;
  if(taskId !== null) selectedTask = taskId;
  const state = { fio:true, view, selectedTask, depth:fioHistoryDepth };
  if(historyReady){
    if(replace) history.replaceState({...state, fio:true, depth:fioHistoryDepth}, '', location.href);
    else { history.pushState({...state, fio:true, depth:fioHistoryDepth+1}, '', location.href); fioHistoryDepth++; }
  }
  render();
}

function goBack(fallback='tasks'){
  if(historyReady && fioHistoryDepth > 0){
    history.back();
  } else {
    navigate(fallback);
  }
}

window.addEventListener('popstate', event => {
  const state = event.state;
  if(state?.fio){
    view = state.view || 'tasks';
    selectedTask = state.selectedTask || null;
    fioHistoryDepth = Math.max(0, Number(state.depth)||0);
    render();
  } else {
    // Se o navegador não tiver um estado anterior do FIO, voltamos à página inicial do app.
    navigate('tasks', null, true);
  }
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  isStandalone = true;
  toast('FIO foi adicionado à tela inicial.');
});

const app = document.querySelector("#app");
const modal = document.querySelector("#modal");
const modalContent = document.querySelector("#modalContent");

function load(){
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY_DATA);
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.projects)) return structuredClone(EMPTY_DATA);
    return parsed;
  } catch(e){ return structuredClone(EMPTY_DATA); }
}
function save(){ localStorage.setItem(KEY, JSON.stringify(data)); }
function esc(s=""){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function toast(msg){
  const el=document.querySelector("#toast");
  el.textContent=msg; el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),2200);
}
function findTask(id){
  for(const p of data.projects){
    const t=p.tasks.find(t=>t.id===id);
    if(t) return {p,t};
  }
}
function progress(t){ return t.stages.filter(s=>s.done).length; }
function allTasks(){ return data.projects.flatMap(p=>p.tasks); }
function latestPausedTask(){
  return allTasks()
    .filter(t=>!t.completed && t.stopAt && t.stages.some(s=>!s.done))
    .sort((a,b)=>(b.stopAt||0)-(a.stopAt||0))[0] || null;
}
function currentIndex(t){
  const firstOpen=t.stages.findIndex(s=>!s.done);
  if(firstOpen<0) return t.stages.length-1;
  return Math.min(Math.max(Number.isInteger(t.current)?t.current:firstOpen,0),t.stages.length-1);
}

function render(){
  if(view==="tasks") renderTasks();
  if(view==="data") renderData();
  if(view==="create") renderCreate();
  if(view==="task") renderTask();
  if(view==="resume") renderResume();
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
}

function renderTasks(){
  const all=allTasks();
  const active=all.filter(t=>t.completed!==true);
  const completed=all.filter(t=>t.completed===true);
  const shown=taskTab==="completed"?completed:active;
  app.innerHTML=`
    <div class="decor"></div>
    <div class="topline">
      <div><div class="eyebrow">SEU ESPAÇO DE TRABALHO</div><h1>Projetos e tarefas</h1></div>
      <button class="plus-link" id="newTask">＋ Nova tarefa</button>
    </div>
    <div class="task-tabs" role="tablist" aria-label="Filtrar tarefas">
      <button class="task-tab ${taskTab==='active'?'selected':''}" id="activeTab" role="tab" aria-selected="${taskTab==='active'}">Em andamento <span>${active.length}</span></button>
      <button class="task-tab ${taskTab==='completed'?'selected':''}" id="completedTab" role="tab" aria-selected="${taskTab==='completed'}">Concluídas <span>${completed.length}</span></button>
    </div>
    ${shown.length ? shown.map(t=>{
      const pr=progress(t), total=t.stages.length, idx=currentIndex(t);
      return `<article class="project-card ${t.completed?'completed-card':'active'}" data-id="${t.id}">
        <div class="project-head">
          <div>
            <div class="eyebrow">${t.completed?'TAREFA CONCLUÍDA':'TAREFA'}</div>
            <div class="project-name">${esc(t.name)}</div>
            <div class="progress-text">${pr}/${total} etapas concluídas${t.completedAt?` · concluída em ${new Date(t.completedAt).toLocaleDateString('pt-BR')}`:''}</div>
          </div>
          <div class="mini-orbit mini-thread" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
        </div>
        <div class="stage-list">
          ${t.stages.map((s,i)=>`<div class="stage-row ${s.done?'done':''} ${i===idx&&!s.done?'current':''}">
            <span class="status">${s.done?'✓':''}</span><span>${esc(s.name)}</span>
            <span class="stage-state">${s.done?'concluída':i===idx&&!t.completed?'em andamento':''}</span>
          </div>`).join("")}
        </div>
        <div class="card-actions"><button class="text-btn open-task">${t.completed?'Ver tarefa':'Abrir tarefa →'}</button>${t.completed?'<button class="text-btn reopen-task">Reabrir tarefa</button>':'<button class="text-btn clone-task">Clonar</button>'}<button class="text-btn danger-text delete-task">Excluir</button></div>
      </article>`;
    }).join("") : `<div class="empty"><div class="drawing">FIO</div><h2>${taskTab==='completed'?'Nenhuma tarefa concluída ainda':'Por onde começamos?'}</h2><p class="muted">${taskTab==='completed'?'Quando você concluir uma tarefa, ela ficará guardada aqui.':'Crie uma tarefa e divida o caminho em pequenos passos. O FIO não traz tarefas prontas.'}</p>${taskTab==='active'?'<button class="primary" id="newTaskEmpty">Criar primeira tarefa</button>':''}</div>`}
  `;
  document.querySelector("#newTask")?.addEventListener("click",()=>navigate("create"));
  document.querySelector("#newTaskEmpty")?.addEventListener("click",()=>navigate("create"));
  document.querySelector("#activeTab").onclick=()=>{taskTab="active";renderTasks()};
  document.querySelector("#completedTab").onclick=()=>{taskTab="completed";renderTasks()};
  document.querySelectorAll(".open-task").forEach(b=>b.addEventListener("click",e=>{const id=e.target.closest(".project-card").dataset.id;navigate("task",id)}));
  document.querySelectorAll(".clone-task").forEach(b=>b.addEventListener("click",e=>{const id=e.target.closest(".project-card").dataset.id,found=findTask(id);if(!found)return;cloneTask(found.t,found.p,true)}));
  document.querySelectorAll(".reopen-task").forEach(b=>b.addEventListener("click",e=>{const id=e.target.closest(".project-card").dataset.id,found=findTask(id);if(!found)return;found.t.completed=false;delete found.t.completedAt;taskTab="active";save();renderTasks();toast("Tarefa reaberta.")}));
  document.querySelectorAll(".delete-task").forEach(b=>b.addEventListener("click",e=>{const id=e.target.closest(".project-card").dataset.id,found=findTask(id);if(!found)return;deleteTask(found.t,found.p,false)}));
}

function renderCreate(){
  app.innerHTML=`
    <button class="back-btn" id="back">← Voltar</button>
    <div class="topline compact-topline"><div><div class="eyebrow">NOVA TAREFA</div><h1>O que você precisa fazer?</h1></div></div>
    <form class="form compact-form" id="createForm">
      <div><label for="taskName">Nome da tarefa ou projeto</label><input id="taskName" required placeholder="Digite o nome"></div>
      <div><label>Etapas</label><p class="field-hint">Adicione apenas as etapas que fizerem sentido para esta tarefa.</p><div class="stage-editor" id="stageEditor"></div><button type="button" class="text-btn add-stage-btn" id="addStage">＋ adicionar etapa</button></div>
      <div class="form-actions"><button type="button" class="secondary" id="cancelCreate">Cancelar</button><button class="primary">Criar tarefa</button></div>
    </form>`;
  document.querySelector("#back").onclick=document.querySelector("#cancelCreate").onclick=()=>goBack("tasks");
  document.querySelector("#addStage").onclick=()=>{const ed=document.querySelector("#stageEditor");ed.insertAdjacentHTML("beforeend",stageInput("",document.querySelectorAll(".stage-edit").length));ed.lastElementChild.querySelector("input").focus()};
  document.querySelector("#createForm").onsubmit=e=>{e.preventDefault();const name=document.querySelector("#taskName").value.trim();const stages=[...document.querySelectorAll(".stage-edit input")].map(x=>x.value.trim()).filter(Boolean).map(n=>({id:crypto.randomUUID(),name:n,done:false}));if(!name){toast("Digite o nome da tarefa.");return}if(!stages.length){toast("Adicione pelo menos uma etapa.");return}const task={id:crypto.randomUUID(),name,stages,current:0,stopNote:"",stopAt:null};data.projects.unshift({id:crypto.randomUUID(),name,createdAt:Date.now(),tasks:[task]});save();selectedTask=task.id;navigate("task", task.id, true)};
}
function stageInput(value,i){return `<div class="stage-edit"><input value="${esc(value)}" placeholder="Etapa ${i+1}"><button type="button" class="small-btn" onclick="this.parentElement.remove()">×</button></div>`}

function renderTask(){
  const found=findTask(selectedTask); if(!found){navigate("tasks", null, true);return}
  const {t}=found, current=currentIndex(t), n=t.stages.length;
  app.innerHTML=`
    <section class="hero-task">
      <div class="task-topline">
        <button class="back-btn" id="back">← Tarefas</button>
        <button class="home-task-btn" id="taskHome" aria-label="Ir para o início">⌂ Início</button>
      </div>
      <div class="task-title"><div class="eyebrow">PROJETO</div><h1>${esc(t.name)}</h1><div class="progress-text" id="stageProgress">Etapa ${Math.min(current+1,n)}/${n} · ${progress(t)} concluídas</div></div>

      <div class="pause-hero">
        <div>
          <div class="eyebrow">PONTO DE PARADA</div>
          <strong>Parei aqui</strong>
          <span>Guarde onde você está para retomar depois.</span>
        </div>
        <div class="task-main-actions"><button class="pause pause-hero-btn" id="pause">Ⅱ&nbsp; Parei aqui</button><button class="complete-task-btn" id="completeTask">✓ Concluir tarefa</button></div>
      </div>

      <div class="task-focus compact-focus">
        <div class="eyebrow">VOCÊ ESTÁ AQUI</div>
        <div class="focus-name">${esc(t.stages[current].name)}</div>
        <div class="focus-next">${current<n-1 ? 'Próximo: '+esc(t.stages[current+1].name) : 'Última etapa da tarefa'}</div>
      </div>

      <div class="timeline-wrap">
        <div class="thread-spiral" aria-hidden="true"><span class="thread-segment s1"></span><span class="thread-segment s2"></span><span class="thread-segment s3"></span><span class="thread-segment s4"></span></div>
        <div class="timeline">
          ${t.stages.map((s,i)=>`<button class="timeline-item ${s.done?'done':''} ${i===current&&!s.done?'current':''}" data-index="${i}" aria-label="${esc(s.name)}">
            <span class="timeline-node">${s.done?'✓':i+1}</span>
            <span class="timeline-copy"><strong>${esc(s.name)}</strong><small>${s.done?'concluída':i===current?'você está aqui':'próxima etapa'}</small></span>
          </button>`).join("")}
        </div>
      </div>
      ${t.stopAt ? `<div class="last-stop"><div class="eyebrow">ÚLTIMO PONTO DE PARADA</div><div>${esc(t.stopNote || 'Ponto de parada registrado.')}</div></div>` : ''}
    </section>`;

  document.querySelector("#back").onclick=()=>goBack("tasks");
  document.querySelector("#taskHome").onclick=()=>navigate("tasks");
  document.querySelectorAll(".timeline-item").forEach(el=>el.onclick=()=>{
    const index=Number(el.dataset.index);
    if(index===current && !t.stages[index].done){
      t.stages[index].done=true;
      const next=t.stages.findIndex((s,i)=>i>index&&!s.done);
      t.current=next>=0?next:t.stages.length-1;
      save();render();toast("Etapa concluída. O fio avançou.");
      return;
    }
    t.current=index;save();render();
  });
  document.querySelector("#pause").onclick=()=>openPause(t,current);
  document.querySelector("#completeTask").onclick=()=>completeTask(t);
}

function completeTask(t){
  const remaining=t.stages.filter(s=>!s.done).length;
  const message=remaining>0
    ? `Ainda há ${remaining} etapa(s) não concluída(s). Deseja concluir a tarefa inteira mesmo assim?`
    : `Marcar “${t.name}” como concluída?`;
  if(!confirm(message)) return;
  t.completed=true;
  t.completedAt=Date.now();
  t.stopAt=null;
  save();
  taskTab="completed";
  navigate("tasks",null);
  toast("Tarefa concluída e guardada em Concluídas.");
}

function cloneTask(t,p,fromList=false){
  const copy=structuredClone(t);copy.id=crypto.randomUUID();copy.name=`${t.name} — cópia`;copy.stopAt=null;copy.stopNote="";copy.stages=copy.stages.map(s=>({...s,id:crypto.randomUUID(),done:false}));copy.current=0;p.tasks.push(copy);save();
  if(fromList){render();toast("Tarefa clonada.")}else{selectedTask=copy.id;navigate("task", copy.id);toast("Tarefa clonada.")}
}
function deleteTask(t,p,fromTask=true){
  if(!confirm(`Excluir “${t.name}”? Esta ação não pode ser desfeita.`)) return;
  p.tasks=p.tasks.filter(x=>x.id!==t.id);data.projects=data.projects.filter(project=>project.tasks.length);save();selectedTask=null;navigate("tasks",null);toast("Tarefa excluída.");
}

function openPause(t,current){
  modalContent.innerHTML=`<div class="modal">
    <div class="eyebrow">PAREI AQUI</div><h2>Deixe um bilhete para depois.</h2>
    <p>O aplicativo já sabe qual é a etapa atual. Escreva só o que você não quer precisar reconstruir quando voltar.</p>
    <label>O que é importante lembrar?</label>
    <textarea id="pauseNote" placeholder="Ex.: a medida está na planta impressa.">${esc(t.stopNote||"")}</textarea>
    <div class="modal-actions"><button class="secondary" id="closeModal">Cancelar</button><button class="primary" id="savePause">Salvar e sair</button></div>
  </div>`;
  modal.showModal();
  document.querySelector("#closeModal").onclick=()=>modal.close();
  document.querySelector("#savePause").onclick=()=>{
    t.current=current;
    t.stopNote=document.querySelector("#pauseNote").value.trim();
    t.stopAt=Date.now();
    save();modal.close();navigate("resume", t.id);
  };
}

function renderResume(){
  const found=findTask(selectedTask);if(!found){navigate("tasks", null, true);return}
  const {t}=found, current=currentIndex(t);
  app.innerHTML=`<section class="resume">
    <div class="resume-topline"><button class="back-btn" id="resumeBack">← Tarefas</button><button class="home-task-btn" id="resumeHome">⌂ Início</button></div>
    <div class="resume-kicker">RETOMADA</div>
    <h1>Você estava aqui.</h1>
    <div class="resume-project">${esc(t.name)}</div>
    <div class="resume-note">
      <div class="resume-note-label">▤ &nbsp; O que você deixou anotado</div>
      <div class="resume-note-text">${esc(t.stopNote||"Você não deixou uma observação desta vez.")}</div>
    </div>
    <div class="resume-next"><span>PRÓXIMO PASSO</span><strong>${esc(t.stages[current]?.name||"Retomar tarefa")}</strong></div>
    <div class="timeline resume-timeline">
      ${t.stages.map((s,i)=>`<div class="timeline-item static ${s.done?'done':''} ${i===current&&!s.done?'current':''}">
        <span class="timeline-node">${s.done?'✓':i+1}</span>
        <span class="timeline-copy"><strong>${esc(s.name)}</strong><small>${s.done?'concluída':i===current?'você está aqui':''}</small></span>
      </div>`).join("")}
    </div>
    <div class="task-actions resume-actions"><button class="primary" id="continue">Continuar</button><button class="secondary" id="editStop">Editar ponto de parada</button></div>
  </section>`;
  document.querySelector("#resumeBack").onclick=()=>goBack("tasks");
  document.querySelector("#resumeHome").onclick=()=>navigate("tasks");
  document.querySelector("#continue").onclick=()=>navigate("task",t.id);
  document.querySelector("#editStop").onclick=()=>openPause(t,current);
}

function renderData(){
  app.innerHTML=`<section class="data-page">
    <div class="eyebrow">SEUS DADOS</div><h1>Dados e backup</h1>
    <p class="muted">O FIO não precisa de conta, login ou banco de dados externo.</p>
    <div class="data-section"><h3>Exportar seus dados</h3><p>Os dados ficam armazenados localmente no navegador, no armazenamento/cache local do dispositivo. Se você limpar os dados ou o cache do navegador, eles podem ser apagados. <strong>É uma boa ideia fazer um backup de vez em quando.</strong></p><button class="primary" id="export">Exportar meus dados</button></div>
    <div class="data-section"><h3>Importar dados</h3><p>Escolha um backup que você já tenha exportado. Normalmente ele estará na pasta <strong>Downloads</strong> do computador ou celular. O nome será parecido com <strong>fio-backup-2026-10-06.json</strong>.</p><label class="file-label">Escolher arquivo JSON<input id="import" type="file" accept="application/json,.json"></label></div>
    <div class="data-section" id="installSection">
      <h3>Usar como aplicativo</h3>
      <p>O FIO pode ser colocado na tela inicial do celular com um ícone próprio. Depois disso, ele abre em uma janela própria, sem a aparência de uma página comum do navegador.</p>
      <div id="installArea"></div>
    </div>
    <div class="data-section" id="privacySection"><h3>Privacidade</h3><p>O FIO foi pensado para funcionar localmente. Esta versão não envia seus projetos para um servidor.</p></div>
    <div class="data-section"><button class="secondary" id="reset">Apagar todos os dados</button></div>
  </section>`;
  document.querySelector("#export").onclick=()=>{
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=url;a.download=`fio-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);toast("Backup exportado.");
  };
  document.querySelector("#import").onchange=e=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const imported=JSON.parse(reader.result);
        if(!imported||!Array.isArray(imported.projects))throw new Error();
        data={version:2,projects:imported.projects};save();navigate("tasks", null);toast("Dados importados com sucesso.");
      }catch{toast("Esse arquivo não parece ser um backup do FIO.")}
    };reader.readAsText(file);
  };
  const installArea=document.querySelector("#installArea");
  if(isStandalone){
    installArea.innerHTML='<p class="install-status">✓ O FIO já está instalado como aplicativo neste dispositivo.</p>';
  } else if(deferredInstallPrompt){
    installArea.innerHTML='<button class="primary" id="installApp">Adicionar FIO à tela inicial</button>';
    document.querySelector("#installApp").onclick=async()=>{
      deferredInstallPrompt.prompt();
      const choice=await deferredInstallPrompt.userChoice;
      deferredInstallPrompt=null;
      if(choice.outcome==="accepted") toast("Instalação iniciada.");
    };
  } else {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    installArea.innerHTML=ios
      ? '<div class="install-guide"><strong>No iPhone/iPad:</strong> toque em <strong>Compartilhar</strong> no Safari e escolha <strong>Adicionar à Tela de Início</strong>.</div>'
      : '<div class="install-guide"><strong>No Android:</strong> abra o menu do navegador (⋮) e procure <strong>Adicionar à tela inicial</strong> ou <strong>Instalar aplicativo</strong>.</div>';
  }

  document.querySelector("#reset").onclick=()=>{
    if(confirm("Apagar todos os projetos e tarefas? Esta ação não pode ser desfeita.")){data=structuredClone(EMPTY_DATA);save();navigate("tasks", null);toast("Dados apagados.")}
  };
}

function startApp(){
  // Retomada orientada: se existe um ponto de parada, ele vira a primeira tela na reabertura.
  const paused=latestPausedTask();
  if(paused){ selectedTask=paused.id; view="resume"; }
  else view="tasks";
  history.replaceState({fio:true,view,selectedTask,depth:0},'',location.href);
  fioHistoryDepth=0;
  historyReady=true;
  render();
}

document.querySelector("#brandHome").onclick=()=>navigate("tasks");
document.querySelector("#homeBtn").onclick=()=>navigate("tasks");
document.querySelector("#settingsBtn").onclick=()=>navigate("data");
document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>navigate(b.dataset.view));

startApp();
