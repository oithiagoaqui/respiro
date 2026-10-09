const STORAGE_KEY = 'respiro-local-v1';
const BACKUP_FORMAT = 'respiro-local-backup';
const BACKUP_VERSION = 1;

const defaultStrategies = [
  { id:'bath', name:'Tomar um banho', category:'corpo', icon:'◒' },
  { id:'taylor', name:'Ouvir Taylor Swift', category:'afetivo', icon:'♫' },
  { id:'cats', name:'Brincar com os gatos', category:'afetivo', icon:'♡' },
  { id:'write', name:'Escrever', category:'expressivo', icon:'✎' },
  { id:'mom', name:'Ligar para a mãe', category:'afetivo', icon:'☎' },
  { id:'friend', name:'Ligar para uma amiga', category:'afetivo', icon:'☏' },
  { id:'senses', name:'5 sentidos', category:'sensorial', icon:'◉', guided:true }
];
const defaultTriggers = ['Barulho','Luz forte','Multidões','Cobrança','Mudança de rotina'];
const emotions = [
  ['ansiosa','◌','Ansiosa'], ['sobrecarregada','≋','Sobrecarregada'], ['triste','☹','Triste'],
  ['irritada','⌁','Irritada'], ['medo','!','Com medo'], ['cansada','◡','Exausta'],
  ['frustrada','↗','Frustrada'], ['sozinha','♡','Sozinha'], ['confusa','…','Confusa']
];

function makeInstallationId(){
  if(window.crypto?.randomUUID) return crypto.randomUUID();
  if(window.crypto?.getRandomValues){
    const bytes=new Uint8Array(16); crypto.getRandomValues(bytes);
    return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  return 'local-'+Date.now()+'-'+Math.random().toString(36).slice(2);
}
function freshData(){
  return {
    schemaVersion: BACKUP_VERSION,
    installationId: makeInstallationId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    strategies: defaultStrategies.map(x=>({...x})),
    triggers: [],
    history: []
  };
}
function normalizeData(data){
  const base=freshData();
  const strategies=Array.isArray(data?.strategies)?data.strategies:base.strategies;
  const cleanedStrategies=strategies.filter(x=>x?.id!=='pray' && x?.name!=='Orar');
  const hasSenses=cleanedStrategies.some(x=>x?.id==='senses');
  return {
    schemaVersion: BACKUP_VERSION,
    installationId: typeof data?.installationId==='string' && data.installationId ? data.installationId : base.installationId,
    createdAt: data?.createdAt || base.createdAt,
    updatedAt: new Date().toISOString(),
    strategies: hasSenses ? cleanedStrategies : [...cleanedStrategies, {...defaultStrategies.find(x=>x.id==='senses')}],
    triggers: Array.isArray(data?.triggers)?data.triggers.filter(x=>typeof x==='string'):[],
    history: Array.isArray(data?.history)?data.history.slice(0,30):[]
  };
}
const Store = {
  key: STORAGE_KEY,
  read(){
    try {
      const raw=localStorage.getItem(this.key);
      if(raw) return normalizeData(JSON.parse(raw));
      const migrated=this.migrateLegacy();
      if(migrated) { this.write(migrated); return migrated; }
      const data=freshData(); this.write(data); return data;
    } catch { const data=freshData(); return data; }
  },
  write(data){
    const normalized=normalizeData(data);
    localStorage.setItem(this.key,JSON.stringify(normalized));
    return normalized;
  },
  update(patch){
    const current=this.read();
    return this.write({...current,...patch,updatedAt:new Date().toISOString()});
  },
  addHistory(item){
    const current=this.read();
    current.history=[item,...current.history].slice(0,30);
    this.write(current);
  },
  clear(){ localStorage.removeItem(this.key); },
  exportData(){
    const data=this.read();
    return {format:BACKUP_FORMAT,version:BACKUP_VERSION,exportedAt:new Date().toISOString(),data};
  },
  validateBackup(payload){
    return payload && payload.format===BACKUP_FORMAT && payload.data && Array.isArray(payload.data.strategies) && Array.isArray(payload.data.triggers) && Array.isArray(payload.data.history);
  },
  importData(payload){
    if(!this.validateBackup(payload)) throw new Error('Arquivo de backup do Respiro inválido.');
    return this.write(payload.data);
  },
  migrateLegacy(){
    try {
      const strategies=JSON.parse(localStorage.getItem('respiro-strategies-v2'));
      const history=JSON.parse(localStorage.getItem('respiro-history-v2'));
      const triggers=JSON.parse(localStorage.getItem('respiro-triggers-v1'));
      if(!Array.isArray(strategies) && !Array.isArray(history) && !Array.isArray(triggers)) return null;
      return normalizeData({strategies:Array.isArray(strategies)?strategies:undefined,history:Array.isArray(history)?history:undefined,triggers:Array.isArray(triggers)?triggers:undefined});
    } catch { return null; }
  }
};

let localData=Store.read();
let breathTimer = null;
let breathRunning = false;
let sensesTimer = null;
let state = {
  route:'checkin', emotion:null, intensity:5, triggers:[],
  strategies:localData.strategies, customTriggers:localData.triggers,
  breathCycle:0, completedStrategy:'', currentStrategy:''
};
function syncLocalData(){
  localData=Store.read();
  state.strategies=localData.strategies;
  state.customTriggers=localData.triggers;
}
function saveStrategies(){ localData=Store.update({strategies:state.strategies}); }
function saveTriggers(){ localData=Store.update({triggers:state.customTriggers}); }
function allTriggers(){ return [...defaultTriggers,...state.customTriggers.filter(x=>!defaultTriggers.includes(x))]; }
function saveHistory(item){ Store.addHistory(item); localData=Store.read(); }
function historyData(){ return Store.read().history; }
function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1800); }
function esc(s){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function stopBreathing(){ if(breathTimer){clearInterval(breathTimer);breathTimer=null;} breathRunning=false; }
function stopSenses(){ if(sensesTimer){clearTimeout(sensesTimer);sensesTimer=null;} }

function render(){
  stopBreathing();
  stopSenses();
  const app=document.getElementById('app');
  const views={home:homeView,checkin:checkinView,'checkin-intensity':intensityView,regulate:regulateView,breath:breathView,senses:sensesView,done:doneView,task:taskView,triggers:triggersView,strategies:strategiesView,history:historyView,settings:settingsView};
  app.innerHTML=(views[state.route]||homeView)();
  bind();
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.route===state.route || ['checkin','checkin-intensity','regulate'].includes(state.route)&&b.dataset.route==='home'));
}

function homeView(){
 return `<section class="hero"><div class="flower"></div><div class="eyebrow">Seu espaço de cuidado</div><h1>Vamo comigo?</h1><p>Um passo de cada vez, no seu ritmo. Você pode começar de novo sempre que precisar.</p></section>
 <section class="card"><h2>Vamos entender como você está</h2><p class="muted">Escolha uma emoção e encontre algo que possa ajudar neste momento.</p><button class="primary-btn" data-action="start">Começar</button></section>`;
}

function checkinView(){
 const selected=state.emotion;
 return `<section class="checkin-transition"><div class="eyebrow">Vamos começar por você</div><h1>Como você está se sentindo?</h1><p class="screen-copy">Escolha o que mais se aproxima do que está acontecendo agora.</p>
 <div class="emotion-grid">${emotions.map(([id,face,label])=>`<button type="button" class="emotion ${selected===id?'selected':''}" data-emotion="${id}"><span class="face">${face}</span><small>${label}</small></button>`).join('')}</div>
 <p class="muted tiny">Depois dessa escolha, vamos seguir para os possíveis gatilhos.</p></section>`;
}

function intensityView(){
 const triggers=allTriggers();
 return `<div class="eyebrow">Vamos entender um pouco mais</div><h2>O que pode ter contribuído?</h2><p class="screen-copy">Marque os gatilhos que fizerem sentido. Você também pode avaliar a intensidade.</p>
 <div class="card"><div class="intensity-number">${state.intensity}</div><div class="scale">${Array.from({length:10},(_,i)=>`<button type="button" data-intensity="${i+1}" class="${state.intensity===i+1?'active':''}">${i+1}</button>`).join('')}</div><div class="scale-labels"><span>Leve</span><span>Intenso</span></div></div>
 <div class="card trigger-card"><div class="section-heading"><div><h3>O que pode ter contribuído para isso?</h3><p>Você pode escolher mais de um.</p></div><button type="button" class="small-add" data-action="add-trigger">+ adicionar</button></div>
 <div class="trigger-list">${triggers.map(t=>`<button type="button" class="chip ${state.triggers.includes(t)?'selected':''}" data-trigger="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>
 <button class="primary-btn" data-action="next-strategy">Encontrar algo que ajude →</button>`;
}

function regulateView(){
 return `<div class="eyebrow">Vamos encontrar algo que ajude</div><h2>Vamo comigo?</h2><p class="screen-copy">Escolha uma opção para este momento. Você pode experimentar outra depois.</p>
 <div class="featured-strategies"><button type="button" class="featured-strategy breath-feature" data-action="breath-open"><span class="featured-icon">◌</span><span><strong>Respiração guiada</strong><small>5 ciclos para inspirar, segurar e soltar com calma.</small></span><b>›</b></button><button type="button" class="featured-strategy senses-feature" data-use="senses"><span class="featured-icon">✧</span><span><strong>5 sentidos</strong><small>Um exercício para voltar ao momento presente.</small></span><b>›</b></button></div>
 <div class="other-options"><div class="section-heading"><div><h3>Outras estratégias</h3><p>Escolha o que fizer sentido para você.</p></div><button type="button" class="small-add" data-action="manage">editar</button></div><div class="strategy-list">${state.strategies.filter(s=>s.id!=='senses').map(s=>`<button type="button" class="strategy strategy-button" data-use="${esc(s.id)}"><div class="strategy-icon">${s.icon||'♡'}</div><div class="strategy-copy"><strong>${esc(s.name)}</strong><small>${labelCategory(s.category)}</small></div><span class="strategy-arrow">›</span></button>`).join('')}</div></div>`;
}

function breathView(){
 return `<div class="breath-page"><div class="eyebrow">Respiração guiada</div><h2>Respira comigo</h2><p class="screen-copy">Acompanhe a bolinha. São 5 ciclos, sem pressa.</p><div class="breath-stage breath-stage-large"><div id="breathCircle" class="breath-circle"><span id="breathPhase">Quando quiser</span><small id="breathCount">4s</small></div></div><div class="breath-instruction" id="breathInstruction">Inspire, segure e solte o ar no ritmo da animação.</div><div class="cycle-count" id="cycleCount">Ciclo 1 de 5</div><button class="primary-btn" id="breathStart" data-action="breath">Começar</button><button class="secondary-btn" data-action="breath-stop">Voltar às estratégias</button></div>`;
}
function taskView(){
 return `<section class="done-screen task-screen"><div class="done-flower">♡</div><div class="eyebrow">Uma coisa de cada vez</div><h1>${esc(state.currentStrategy||'Sua estratégia')}</h1><p class="screen-copy">Agora, experimente essa estratégia no seu ritmo. Quando terminar, volte aqui para decidir o que precisa.</p><button class="primary-btn" data-action="task-finished">Já fiz isso</button><button class="secondary-btn" data-action="another-task">Escolher outra estratégia</button></section>`;
}
function doneView(){
 return `<section class="done-screen"><div class="done-flower">✿</div><div class="eyebrow">Um passo de cada vez</div><h1>Como você está agora?</h1><p class="screen-copy">Você concluiu: <strong>${esc(state.completedStrategy||'uma estratégia')}</strong>.</p><button class="primary-btn" data-action="feeling-ok">Estou bem</button><button class="secondary-btn" data-action="another-task">Quero experimentar outra coisa</button><button class="text-btn" data-action="continue">Quero continuar nesta estratégia</button></section>`;
}

function sensesView(){
 const steps=[
  {title:'Visão',count:'5 coisas que você vê',copy:'Olhe ao seu redor e encontre 5 coisas que você consegue ver.',icon:'👁️',visual:'<div class="sense-dots"><i></i><i></i><i></i><i></i><i></i></div>'},
  {title:'Tato',count:'4 coisas que você sente',copy:'Perceba 4 sensações no seu corpo ou ao seu redor.',icon:'✋',visual:'<div class="sense-wave sense-wave-tact"></div>'},
  {title:'Audição',count:'3 coisas que você ouve',copy:'Pare por alguns segundos e perceba 3 sons ao seu redor.',icon:'👂',visual:'<div class="sound-waves"><span>)))</span><b>◯</b><span>(((</span></div>'},
  {title:'Olfato',count:'2 coisas que você cheira',copy:'Perceba 2 cheiros ao seu redor.<br><em>Se não encontrar nenhum cheiro, tudo bem. Perceba apenas o ar entrando pelo nariz.</em>',icon:'👃',visual:'<div class="smell-waves"><i></i><i></i></div>'},
  {title:'Paladar',count:'1 coisa que você saboreia',copy:'Perceba o gosto que está na sua boca.',icon:'👅',visual:'<div class="sense-pulse"></div>'}
 ];
 const step=state.sensesStep??0;
 if(step===-1) return `<div class="sense-intro"><div class="eyebrow">Uma pausa no presente</div><div class="sense-big-icon">◉</div><h2>5 sentidos</h2><p class="screen-copy">Um exercício simples para voltar ao momento presente.</p><button class="primary-btn" data-action="senses-start">Começar</button></div>`;
 if(step>=5) return `<div class="sense-intro sense-final"><div class="eyebrow">Terminamos</div><div class="sense-big-icon final-pulse">◉</div><h2>Você está aqui.</h2><p class="screen-copy">Agora, neste momento.</p><button class="primary-btn" data-action="senses-done">Concluir</button></div>`;
 const x=steps[step];
 return `<div class="sense-screen"><div class="eyebrow">${step+1} de 5</div><div class="sense-progress">${steps.map((_,i)=>`<i class="${i<=step?'active':''}"></i>`).join('')}</div><div class="sense-icon">${x.icon}</div><h2>${x.title}</h2><h3>${x.count}</h3><p class="screen-copy">${x.copy}</p><div class="sense-visual">${x.visual}</div><button class="primary-btn" data-action="senses-next">Pronto →</button></div>`;
}

function triggersView(){
 const triggers=allTriggers();
 return `<div class="eyebrow">Autoconhecimento</div><div class="top-actions"><div><h2>Seus gatilhos</h2><p class="screen-copy">Gatilhos que você já identificou podem ajudar a perceber padrões ao longo do tempo.</p></div><button type="button" class="inline-btn" data-action="add-trigger">+ Adicionar</button></div>
 <div class="card"><div class="trigger-list">${triggers.map(t=>`<button type="button" class="chip selected">${esc(t)}</button>`).join('')}</div><div class="callout" style="margin-top:16px">Esses gatilhos são informativos e podem ser ajustados conforme o acompanhamento.</div></div>`;
}
function strategiesView(){
 return `<div class="top-actions"><div><div class="eyebrow">Personalização</div><h2>Suas estratégias</h2></div><button type="button" class="inline-btn" data-action="add">+ Adicionar</button></div><p class="screen-copy">Mantenha aqui as coisas que realmente ajudam você a se regular.</p>
 <div class="strategy-list">${state.strategies.length?state.strategies.map(s=>`<div class="strategy"><div class="strategy-icon">${s.icon||'♡'}</div><div class="strategy-copy"><strong>${esc(s.name)}</strong><small>${labelCategory(s.category)}</small></div><button type="button" class="strategy-action" data-delete="${esc(s.id)}">Excluir</button></div>`).join(''):'<div class="empty">Nenhuma estratégia cadastrada ainda.</div>'}</div>`;
}
function historyView(){
 const h=historyData();
 return `<div class="eyebrow">Acompanhamento</div><h2>Histórico</h2><p class="screen-copy">Seus check-ins ficam registrados neste dispositivo e não são sincronizados.</p><div class="card">${h.length?h.map(x=>`<div class="history-item"><strong>${esc(x.emotion)} · intensidade ${x.intensity}/10</strong><small>${esc(x.date)}${x.trigger?' · gatilhos: '+esc(x.trigger):''}${x.strategy?' · estratégia: '+esc(x.strategy):''}</small></div>`).join(''):'<div class="empty">Ainda não há registros. Faça seu primeiro check-in.</div>'}</div>`;
}
function settingsView(){
 const data=Store.read();
 const created=new Date(data.createdAt).toLocaleDateString('pt-BR');
 return `<div class="eyebrow">Configurações</div><h2>Seus dados</h2>
 <div class="card privacy-card"><div class="privacy-icon">⌂</div><strong>Seus dados ficam armazenados neste dispositivo.</strong><p>Não são sincronizados com outros aparelhos e não são enviados para o Vercel ou GitHub.</p><p class="muted">Criado em ${created}. O identificador local serve apenas para diferenciar este conjunto de dados e não é uma forma de login.</p></div>
 <div class="card settings-actions">
 <button class="secondary-btn" data-action="export-data">Exportar meus dados</button>
 <button class="secondary-btn" data-action="import-data">Importar meus dados</button>
 <button class="danger-btn" data-action="clear-data">Apagar meus dados</button>
 </div>
 <div class="card callout"><strong>Sobre este protótipo</strong><br>Se os dados do navegador forem apagados, o navegador for redefinido ou o aparelho for trocado sem um backup, seus registros podem ser perdidos.</div>`;
}

function labelCategory(c){ return ({corpo:'Corpo',sensorial:'Sensorial',afetivo:'Afetivo',expressivo:'Expressivo',espiritual:'Espiritual',outro:'Outra'})[c]||'Estratégia'; }
function prettyEmotion(id){ const x=emotions.find(e=>e[0]===id); return x?x[2]:'Não informado'; }

function bind(){
 document.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>{state.route=b.dataset.route;render();});
 document.querySelectorAll('[data-emotion]').forEach(b=>b.onclick=()=>{state.emotion=b.dataset.emotion;render();setTimeout(()=>{state.route='checkin-intensity';render();},320);});
 document.querySelectorAll('[data-intensity]').forEach(b=>b.onclick=()=>{state.intensity=+b.dataset.intensity;render();});
 document.querySelectorAll('[data-trigger]').forEach(b=>b.onclick=()=>{const t=b.dataset.trigger;state.triggers=state.triggers.includes(t)?state.triggers.filter(x=>x!==t):[...state.triggers,t];render();});
 document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>handleAction(b.dataset.action));
 document.querySelectorAll('[data-use]').forEach(b=>b.onclick=()=>{const s=state.strategies.find(x=>x.id===b.dataset.use);if(s){if(s.id==='senses'){state.sensesStep=-1;state.route='senses';render();return;}state.currentStrategy=s.name;state.route='task';render();}});
 document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteStrategy(b.dataset.delete));
}
function handleAction(a){
 if(a==='start'){state.route='checkin';render();return;}
 if(a==='next-intensity'){if(!state.emotion)return;state.route='checkin-intensity';render();return;}
 if(a==='next-strategy'){state.route='regulate';render();return;}
 if(a==='manage'){state.route='strategies';render();return;}
 if(a==='senses-start'){state.sensesStep=0;render();return;}
 if(a==='senses-next'){state.sensesStep=(state.sensesStep??0)+1;render();if(state.sensesStep===5){sensesTimer=setTimeout(()=>{const b=document.querySelector('[data-action=\"senses-done\"]');if(b)b.focus();},2500);}return;}
 if(a==='senses-done'){state.completedStrategy='5 sentidos';saveHistory({emotion:prettyEmotion(state.emotion),intensity:state.intensity,trigger:state.triggers.join(', '),strategy:'5 sentidos',date:new Date().toLocaleString('pt-BR')});state.route='done';state.sensesStep=-1;render();return;}
 if(a==='add')openStrategyModal();
 if(a==='add-trigger')openTriggerModal();
 if(a==='breath'){startBreathing();return;}
 if(a==='breath-open'){state.route='breath';render();return;}
 if(a==='breath-finish'){state.completedStrategy='Respiração guiada';saveHistory({emotion:prettyEmotion(state.emotion),intensity:state.intensity,trigger:state.triggers.join(', '),strategy:'Respiração guiada',date:new Date().toLocaleString('pt-BR')});state.route='done';render();return;}
 if(a==='breath-stop'){stopBreathing();state.route='regulate';render();return;}
 if(a==='task-finished'){state.completedStrategy=state.currentStrategy;saveHistory({emotion:prettyEmotion(state.emotion),intensity:state.intensity,trigger:state.triggers.join(', '),strategy:state.currentStrategy,date:new Date().toLocaleString('pt-BR')});state.route='done';render();return;}
 if(a==='feeling-ok'){state.route='home';state.emotion=null;state.triggers=[];state.intensity=5;state.completedStrategy='';render();return;}
 if(a==='another-task'){state.route='regulate';render();return;}
 if(a==='continue'){if(state.completedStrategy==='5 sentidos'){state.route='senses';state.sensesStep=-1;}else if(state.completedStrategy==='Respiração guiada'){state.route='breath';}else{state.currentStrategy=state.completedStrategy;state.route='task';}render();return;}
 if(a==='settings'){state.route='settings';render();return;}
 if(a==='export-data'){exportData();return;}
 if(a==='import-data'){document.getElementById('importFile').click();return;}
 if(a==='clear-data'){clearLocalData();return;}
}

function startBreathing(){
 const circle=document.getElementById('breathCircle'),phase=document.getElementById('breathPhase'),count=document.getElementById('breathCount'),instruction=document.getElementById('breathInstruction'),button=document.getElementById('breathStart'),cycleLabel=document.getElementById('cycleCount');
 if(!circle||breathRunning)return;
 breathRunning=true;button.textContent='Respiração em andamento';button.disabled=true;
 const phases=[{name:'Inspire',seconds:4,from:.72,to:1.08,text:'Puxe o ar devagar pelo nariz.'},{name:'Segure',seconds:4,from:1.08,to:1.08,text:'Segure suavemente, sem forçar.'},{name:'Solte',seconds:4,from:1.08,to:.72,text:'Solte o ar devagar pela boca.'}];
 const phaseMs=4000,cycleMs=12000,totalMs=cycleMs*5,startAt=Date.now();
 function tick(){
   const elapsed=Date.now()-startAt;
   if(elapsed>=totalMs){stopBreathing();if(phase)phase.textContent='Concluído';if(count)count.textContent='';if(circle)circle.style.transform='scale(.78)';if(instruction)instruction.textContent='Você terminou os 5 ciclos. Perceba como está se sentindo.';if(button){button.textContent='Concluir';button.disabled=false;button.dataset.action='breath-finish';}if(cycleLabel)cycleLabel.textContent='5 de 5 ciclos';return;}
   const cycle=Math.floor(elapsed/cycleMs),within=elapsed%cycleMs,phaseIndex=Math.floor(within/phaseMs),phaseElapsed=(within%phaseMs)/phaseMs,p=phases[phaseIndex];
   const scale=p.from+(p.to-p.from)*phaseElapsed;
   if(phase)phase.textContent=p.name;if(count)count.textContent=`${Math.max(1,Math.ceil(p.seconds-(within%phaseMs)/1000))}s`;if(circle)circle.style.transform=`scale(${scale})`;if(instruction)instruction.textContent=p.text;if(cycleLabel)cycleLabel.textContent=`Ciclo ${cycle+1} de 5`;
 }
 tick();breathTimer=setInterval(tick,100);
}

function deleteStrategy(id){const item=state.strategies.find(s=>s.id===id);if(!item)return;if(!confirm(`Excluir “${item.name}”?`))return;state.strategies=state.strategies.filter(s=>s.id!==id);saveStrategies();render();toast('Estratégia excluída');}

function openStrategyModal(){
 const modal=document.getElementById('modal');modal.classList.remove('hidden');
 document.getElementById('modalTitle').textContent='Nova estratégia';document.getElementById('modalHelp').textContent='Adicione algo que costuma ajudar você a se regular.';
 document.getElementById('strategyFields').style.display='block';document.getElementById('triggerFields').style.display='none';document.getElementById('itemName').value='';document.getElementById('itemName').placeholder='Ex.: Caminhar um pouco';document.getElementById('itemName').focus();
}
function openTriggerModal(){
 const modal=document.getElementById('modal');modal.classList.remove('hidden');
 document.getElementById('modalTitle').textContent='Adicionar gatilho';document.getElementById('modalHelp').textContent='Registre algo que você percebe que pode contribuir para a sobrecarga.';
 document.getElementById('strategyFields').style.display='none';document.getElementById('triggerFields').style.display='block';document.getElementById('itemName').value='';document.getElementById('itemName').placeholder='Ex.: cheiro forte';document.getElementById('itemName').focus();
}
function closeModal(){document.getElementById('modal').classList.add('hidden');document.getElementById('itemName').value='';}

document.getElementById('modalClose').onclick=closeModal;
document.getElementById('saveItem').onclick=()=>{
 const name=document.getElementById('itemName').value.trim();if(!name){toast('Digite alguma coisa');return;}
 if(document.getElementById('triggerFields').style.display!=='none'){
   if(!state.customTriggers.includes(name)&&!defaultTriggers.includes(name)){state.customTriggers.push(name);saveTriggers();}
   closeModal();render();toast('Gatilho adicionado');return;
 }
 const cat=document.getElementById('itemCategory').value;state.strategies.push({id:'custom-'+Date.now(),name,category:cat,icon:'♡'});saveStrategies();closeModal();render();toast('Estratégia adicionada');
};

function exportData(){
 const payload=Store.exportData();
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob); const a=document.createElement('a');
 const date=new Date().toISOString().slice(0,10);
 a.href=url; a.download=`respiro-backup-${date}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
 toast('Backup exportado');
}
async function importDataFromFile(file){
 try{
   const payload=JSON.parse(await file.text());
   if(!Store.validateBackup(payload)) throw new Error('Arquivo inválido');
   if(!confirm('Importar este backup substituirá os dados atuais deste Respiro. Continuar?')) return;
   Store.importData(payload); syncLocalData(); state.emotion=null; state.triggers=[]; state.intensity=5; state.route='home'; render(); toast('Dados importados');
 }catch{ toast('Não foi possível importar esse arquivo'); }
}
function clearLocalData(){
 if(!confirm('Apagar todos os dados do Respiro neste dispositivo? Esta ação não pode ser desfeita. Se quiser guardar uma cópia, exporte seus dados antes.')) return;
 Store.clear(); ['respiro-strategies-v2','respiro-history-v2','respiro-triggers-v1'].forEach(key=>localStorage.removeItem(key)); localData=Store.read(); state.strategies=localData.strategies; state.customTriggers=localData.triggers; state.emotion=null; state.triggers=[]; state.intensity=5; state.route='home'; render(); toast('Dados apagados');
}

document.getElementById('modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal();});
function goBack(){if(state.route==='home'){toast('Você está no início.');return;}if(state.route==='senses'){state.route='regulate';state.sensesStep=-1;render();return;}if(state.route==='done'||state.route==='task'){state.route='regulate';render();return;}if(state.route==='breath'){stopBreathing();state.route='regulate';render();return;}if(state.route==='checkin-intensity'){state.route='checkin';render();return;}if(state.route==='regulate'){state.route='checkin-intensity';render();return;}state.route='home';render();}
document.getElementById('backBtn').onclick=goBack;
function setPageHistory(){history.replaceState({respiro:true},'',location.href);history.pushState({respiro:true},'',location.href);}
window.addEventListener('popstate',()=>{history.pushState({respiro:true},'',location.href);goBack();});
setPageHistory();
document.getElementById('menuBtn').onclick=()=>{state.route='settings';render();};
render();

document.getElementById('importFile').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)importDataFromFile(file);e.target.value='';});
