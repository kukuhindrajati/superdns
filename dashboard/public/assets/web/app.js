(() => {
  'use strict';

  const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
  const state = { range:'hour', points:[], settings:null, latest:null, currentPage:null, dirtyPages:new Set(), savingPages:new Set(), passwordDirty:false, suppressHashGuard:false };
  const settingsPages = ['update','blockpage','safesearch','whitelist','local-dns-records','acl','dns-options'];
  const fmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
  const compact = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
  const pageNames = {
    overview:'Overview', statistics:'Metrics explorer', update:'Blacklist source', blockpage:'Block response',
    safesearch:'SafeSearch', whitelist:'Whitelist', 'local-dns-records':'Local DNS records', acl:'Client access', 'dns-options':'DNS options',
    'domain-test':'DNS inspector', 'query-log':'Realtime query log', operations:'Operations', activity:'Activity log', security:'Security'
  };
  const charts = {
    traffic:[['qps','QPS','blue'],['cache_hit_pct','Cache hit %','cyan'],['cache_miss_rate','Cache miss/s','amber']],
    filter:[['blacklist_hits','Blacklist','amber'],['expired','Expired','violet'],['timeouts','Timeout','red'],['discard_timeout','Discard timeout','pink']],
    request:[['request_current','Active','cyan'],['request_user','User','blue'],['request_replies','Replies','violet'],['request_exceeded','Exceeded','red'],['request_overwritten','Overwritten','amber'],['request_avg','Average','pink']],
    resolver:[['recursion_ms','Recursion ms','blue'],['recursion_median_ms','Median ms','cyan'],['queue_time_max_ms','Queue max ms','amber'],['recursive_replies','Replies','violet']],
    protection:[['ip_rate_limited','IP rate limited','red'],['cookie_invalid','Invalid cookie','amber'],['replyaddr_limit','Reply limit','violet'],['wait_limit','Wait limit','blue'],['dns_error_reports','DNS errors','pink']],
    resources:[['memory_used_pct','RAM %','blue'],['load1','Load 1m','amber'],['disk_free_gb','Disk free GB','cyan']]
  };
  const chartCanvas = {traffic:'trafficChart',filter:'filterChart',request:'requestChart',resolver:'resolverChart',protection:'protectionChart',resources:'resourceChart'};
  const colors = {blue:'#f6821f',cyan:'#3fb8af',amber:'#f6b85f',red:'#e85d68',violet:'#7568d9',pink:'#cf6fbf'};

  async function api(path, options = {}) {
    const headers = Object.assign({'Accept':'application/json'}, options.headers || {});
    if (options.body) Object.assign(headers, {'Content-Type':'application/json','X-CSRF-Token':csrf});
    const response = await fetch(path, Object.assign({}, options, {headers}));
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  function setText(id, value) { const node = document.getElementById(id); if (node) node.textContent = value; }
  function escapeHTML(value) { const node=document.createElement('span'); node.textContent=value ?? ''; return node.innerHTML; }
  function age(seconds) {
    if (seconds == null || seconds < 0) return 'Unknown';
    if (seconds < 120) return `${Math.round(seconds)} sec ago`;
    if (seconds < 7200) return `${Math.round(seconds/60)} min ago`;
    if (seconds < 172800) return `${Math.round(seconds/3600)} hr ago`;
    return `${Math.round(seconds/86400)} days ago`;
  }
  function formatScheduleTime(unixSeconds) {
    if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return 'Unknown';
    return new Date(unixSeconds * 1000).toLocaleString('id-ID', {dateStyle:'medium', timeStyle:'short'});
  }
  function renderSyncSchedule(sample = state.latest) {
    const lastNode=document.getElementById('blacklistLastUpdate'), nextNode=document.getElementById('blacklistNextUpdate');
    if (!lastNode || !nextNode) return;
    const ageSeconds=Number(sample?.update_age);
    const intervalMinutes=Number(state.settings?.update_interval_minutes);
    if (!Number.isFinite(ageSeconds) || ageSeconds < 0) { lastNode.textContent='Unknown'; nextNode.textContent='Unknown'; return; }
    const lastAt=Date.now()/1000-ageSeconds;
    const intervalSeconds=(Number.isFinite(intervalMinutes) && intervalMinutes > 0 ? intervalMinutes : 60)*60;
    lastNode.textContent=formatScheduleTime(lastAt);
    nextNode.textContent=formatScheduleTime(lastAt+intervalSeconds);
  }
  function toast(message, error = false) {
    const region=document.getElementById('toastRegion');
    const item=document.createElement('div'); item.className=`toast${error?' error':''}`; item.innerHTML=`<span class="toast-icon">${error?'!':'✓'}</span><span class="toast-message">${escapeHTML(message)}</span>`; region.appendChild(item);
    let remaining=5200, started=Date.now(), timer;
    const schedule=()=>{started=Date.now();timer=setTimeout(()=>item.remove(),remaining)};
    item.addEventListener('mouseenter',()=>{clearTimeout(timer);remaining=Math.max(0,remaining-(Date.now()-started));item.classList.add('paused')});
    item.addEventListener('mouseleave',()=>{item.classList.remove('paused');schedule()});
    schedule();
  }

  function hydrateIcons() {
    const icons={
      update:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      blockpage:'<path d="M12 3 20 6v6c0 5-3.4 8-8 10-4.6-2-8-5-8-10V6zM8.5 8.5l7 7M15.5 8.5l-7 7"/>',
      safesearch:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M8 10.5l1.7 1.7 3.6-3.8"/>',
      whitelist:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.7 2.7L16.5 9"/>',
      'local-dns-records':'<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v5h4M8 13h8M8 17h6"/>',
      acl:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2c0-3 2.4-5 6-5s6 2 6 5v2M16 5a3 3 0 0 1 0 6M17 14c2.5.4 4 1.9 4 4v2"/>'
    };
    Object.entries(icons).forEach(([page,paths])=>{const host=document.querySelector(`[data-page="${page}"] .setting-icon`);if(host)host.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`});
    const operationIcons=['<path d="M20 6v5h-5M4 18v-5h5M6.1 9a7 7 0 0 1 11.3-2.4L20 11M4 13l2.6 4.4A7 7 0 0 0 17.9 15"/>','<path d="M12 3v9M7.1 6.6a8 8 0 1 0 9.8 0"/>','<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>'];
    document.querySelectorAll('.operation-symbol').forEach((host,index)=>host.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${operationIcons[index]||operationIcons[2]}</svg>`);
    const emptyResult=document.querySelector('.query-result.empty .result-icon');if(emptyResult)emptyResult.innerHTML=queryIcon('empty');
  }
  function confirmAction(title, message, dangerous = false) {
    const dialog=document.getElementById('confirmDialog'); setText('confirmTitle',title); setText('confirmMessage',message);
    const accept=document.getElementById('confirmAccept'); accept.className=`button ${dangerous?'danger':'primary'}`;
    dialog.showModal();
    return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue==='confirm'), {once:true}));
  }

  function normalizeStatus(sample) {
    if (!sample) return null;
    return Object.assign(sample, {
      timeouts:sample.timed_out ?? sample.timeouts ?? 0,
      request_exceeded:sample.exceeded ?? sample.request_exceeded ?? 0,
      request_overwritten:sample.overwritten ?? sample.request_overwritten ?? 0,
      discard_timeout:sample.queries_discard_timeout ?? sample.discard_timeout ?? 0,
      ip_rate_limited:sample.queries_ip_ratelimited ?? sample.ip_rate_limited ?? 0,
      cookie_invalid:sample.queries_cookie_invalid ?? sample.cookie_invalid ?? 0,
      replyaddr_limit:sample.queries_replyaddr_limit ?? sample.replyaddr_limit ?? 0,
      wait_limit:sample.queries_wait_limit ?? sample.wait_limit ?? 0,
      queue_time_max_ms:(sample.queue_time_max_us ?? 0)/1000
    });
  }

  function filterState() { try { return JSON.parse(localStorage.getItem('trustlayer_chart_filters')||'{}'); } catch { return {}; } }
  function renderToggles() {
    const saved=filterState();
    Object.entries(charts).forEach(([chart, series]) => {
      const host=document.querySelector(`[data-toggles="${chart}"]`); if (!host) return;
      const enabled = saved[chart] ?? series.map(([key]) => key);
      host.innerHTML=series.map(([key,label,tone]) => `<label class="series-toggle ${enabled.includes(key)?'enabled':''}"><input type="checkbox" class="metric-toggle" data-chart="${chart}" data-key="${key}" ${enabled.includes(key)?'checked':''}><i class="series-swatch ${tone}"></i><span>${label}</span></label>`).join('');
    });
    document.querySelectorAll('.metric-toggle').forEach(input => input.addEventListener('change', () => {
      input.closest('.series-toggle')?.classList.toggle('enabled', input.checked);
      const next={};
      document.querySelectorAll('.metric-toggle:checked').forEach(item => (next[item.dataset.chart] ||= []).push(item.dataset.key));
      localStorage.setItem('trustlayer_chart_filters',JSON.stringify(next)); renderCharts();
    }));
  }

  function valueFor(point, key) { return key==='disk_free_gb' ? (Number(point.disk_free_bytes)||0)/1073741824 : Number(point[key])||0; }
  function niceMax(value) { if (!Number.isFinite(value)||value<=0) return 1; const power=10**Math.floor(Math.log10(value)); return Math.ceil(value/power)*power; }
  function drawChart(canvas, points, series) {
    if (!canvas) return;
    const dpr=window.devicePixelRatio||1, rect=canvas.getBoundingClientRect(), width=Math.max(300,rect.width), height=270;
    canvas.width=width*dpr; canvas.height=height*dpr;
    const ctx=canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,width,height);
    const styles=getComputedStyle(document.body), border=styles.getPropertyValue('--border').trim(), muted=styles.getPropertyValue('--muted').trim();
    const pad={l:48,r:12,t:16,b:31}; ctx.font='11px Inter, system-ui'; ctx.fillStyle=muted; ctx.strokeStyle=border; ctx.lineWidth=1;
    if (!series.length) { ctx.fillText('Select at least one series',pad.l,height/2); return; }
    const max=niceMax(Math.max(1,...points.flatMap(point=>series.map(item=>valueFor(point,item[0])))));
    for(let i=0;i<=4;i++){const y=pad.t+(height-pad.t-pad.b)*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(width-pad.r,y);ctx.stroke();ctx.fillText(fmt.format(max*(4-i)/4),4,y+3);}
    if(points.length<2){ctx.fillText('Waiting for historical samples',pad.l+10,height/2);return;}
    series.forEach(([key,,tone])=>{ctx.strokeStyle=colors[tone];ctx.lineWidth=1.8;ctx.lineJoin='round';ctx.beginPath();points.forEach((point,index)=>{const x=pad.l+(width-pad.l-pad.r)*index/(points.length-1),y=pad.t+(height-pad.t-pad.b)*(1-valueFor(point,key)/max);index?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();});
    [0,Math.floor((points.length-1)/2),points.length-1].forEach((index,position)=>{const date=new Date(points[index].at*1000),label=state.range==='hour'||state.range==='day'?date.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}):state.range==='year'||state.range==='all'?date.toLocaleDateString('id-ID',{month:'short',year:'2-digit'}):date.toLocaleDateString('id-ID',{day:'2-digit',month:'short'});const x=pad.l+(width-pad.l-pad.r)*index/(points.length-1);ctx.fillStyle=muted;ctx.fillText(label,x-(position===2?40:position===1?18:0),height-7);});
  }
  function renderCharts() {
    Object.entries(charts).forEach(([name, series]) => {
      const enabled=[...document.querySelectorAll(`.metric-toggle[data-chart="${name}"]:checked`)].map(input=>series.find(item=>item[0]===input.dataset.key)).filter(Boolean);
      drawChart(document.getElementById(chartCanvas[name]),state.points,enabled);
    });
  }

  function updateOverview() {
    const point=state.points.at(-1), sample=state.latest;
    setText('kpiQps',point?fmt.format(point.qps):'—');
    setText('kpiCache',point?`${fmt.format(point.cache_hit_pct)}%`:'—');
    setText('kpiCacheDetail',sample?`${compact.format(sample.cache_hits)} cumulative hits`:'hit ratio');
    setText('kpiLatency',sample?`${fmt.format(sample.recursion_avg_ms)} ms`:'—');
    setText('kpiLatencyDetail',sample?`median ${fmt.format(sample.recursion_median_ms)} ms`:'average recursion');
    setText('kpiBlocked',sample?compact.format(sample.blacklist):'—');
    setText('kpiBlockedDetail',point?`${compact.format(point.blacklist_hits)} in selected bucket`:'blocked responses');
    setText('overviewUpdated',sample?new Date(sample.at*1000).toLocaleString('id-ID'):'No sample');
  }

  async function loadMetrics() {
    const data=await api(`/api/metrics?range=${state.range}`); state.points=data.points||[]; renderCharts(); updateOverview();
  }
  async function loadStatus() {
    const data=await api('/api/status'), sample=normalizeStatus(data.latest); state.latest=sample;
    const badge=document.getElementById('liveStatus'), sidebar=document.querySelector('.sidebar-foot');
    const healthy=!!sample && sample.unbound_up && Date.now()/1000-sample.at<180;
    badge.className=`health-badge ${healthy?'ok':'danger'}`; badge.querySelector('span').textContent=healthy?'Operational':'Needs attention';
    sidebar?.classList.toggle('online',healthy); setText('sidebarStatus',healthy?'Resolver operational':'Resolver attention');
    if (!sample) return;
    setText('statsAt',new Date(sample.at*1000).toLocaleString('id-ID')); setText('statsHealth',sample.unbound_up?'Operational':'Offline');
    setText('statsUpdateAge',age(sample.update_age)); setText('statsVersion',`v${data.version||'—'}`); renderStats(sample); renderSyncSchedule(sample); updateOverview();
  }

  function renderStats(sample) {
    const groups=[
      ['Traffic',[['Total queries','queries','Unbound total.num.queries'],['Cache hits','cache_hits','Responses served from cache'],['Cache misses','cache_misses','Queries requiring recursion']]],
      ['Policy',[['Blacklist matches','blacklist','Filtered responses'],['Timed out','timeouts','total.num.queries_timed_out'],['Discard timeout','discard_timeout','queries_discard_timeout'],['Prefetch','prefetch','Cache prefetch operations'],['Expired served','expired','Expired cache responses']]],
      ['Request queue',[['Current','request_current','requestlist.current.all'],['Maximum','request_max','requestlist.max'],['Exceeded','request_exceeded','requestlist.exceeded'],['Overwritten','request_overwritten','requestlist.overwritten'],['Average','request_avg','requestlist.avg']]],
      ['Resolver',[['Recursion average','recursion_avg_ms','Milliseconds'],['Recursion median','recursion_median_ms','Milliseconds'],['Recursive replies','recursive_replies','Recursive answers'],['Queue maximum','queue_time_max_ms','Milliseconds'],['TCP usage','tcp_usage','Active TCP slots']]],
      ['Protection',[['IP rate limited','ip_rate_limited','queries_ip_ratelimited'],['Invalid cookie','cookie_invalid','queries_cookie_invalid'],['Reply-address limit','replyaddr_limit','queries_replyaddr_limit'],['Wait limit','wait_limit','queries_wait_limit'],['DNS error reports','dns_error_reports','Extended resolver errors']]],
      ['Host',[['Memory used','memory_used_pct','System RAM utilization'],['Load average','load1','One-minute load average'],['Disk free','disk_free_bytes','Available root filesystem'],['Active domains','active_domains','Current blacklist domain count']]]
    ];
    const value=(key)=>key==='disk_free_bytes'?`${fmt.format((sample[key]||0)/1073741824)} GB`:key==='memory_used_pct'?`${fmt.format(sample[key]||0)}%`:key.includes('_ms')?`${fmt.format(sample[key]||0)} ms`:fmt.format(sample[key]??0);
    const table=document.getElementById('statsTable'); if(!table)return;
    table.innerHTML=groups.flatMap(([group,rows])=>rows.map(([label,key,desc],index)=>`<tr><td class="metric-group">${index===0?group:''}</td><td>${label}</td><td>${value(key)}</td><td>${desc}</td></tr>`)).join('');
  }

  function uniqueLines(value){return [...new Set(value.split(/\r?\n/).map(item=>item.trim()).filter(Boolean))];}
  function collectSettings(page){const next=Object.assign({update_interval_minutes:60,dnssec_enabled:true,tproxy_enabled:false,block_ips:[],safesearch_engines:[],whitelist:[],host_records:[],recursive_clients:[]},state.settings||{});if(page==='update')next.update_interval_minutes=Number(document.getElementById('updateInterval').value);if(page==='dns-options'){next.dnssec_enabled=document.getElementById('dnssecEnabled').checked;next.tproxy_enabled=document.getElementById('tproxyEnabled').checked;}if(page==='blockpage')next.block_ips=uniqueLines(document.getElementById('blockIPs').value);if(page==='safesearch')next.safesearch_engines=[...document.querySelectorAll('input[name="engine"]:checked')].map(item=>item.value);if(page==='whitelist')next.whitelist=uniqueLines(document.getElementById('whitelist').value);if(page==='local-dns-records')next.host_records=uniqueLines(document.getElementById('hostRecords').value);if(page==='acl')next.recursive_clients=uniqueLines(document.getElementById('recursiveClients').value);return next;}
  function pageSnapshot(settings,page){if(page==='update')return Number(settings?.update_interval_minutes??60);if(page==='dns-options')return [Boolean(settings?.dnssec_enabled),Boolean(settings?.tproxy_enabled)];if(page==='safesearch')return settings?.safesearch_engines||[];const keys={blockpage:'block_ips',whitelist:'whitelist','local-dns-records':'host_records',acl:'recursive_clients'},key=keys[page];return key?(settings?.[key]||[]).join('\n'):null;}
  function formSnapshot(page){if(page==='update')return Number(document.getElementById('updateInterval').value);if(page==='dns-options')return [document.getElementById('dnssecEnabled').checked,document.getElementById('tproxyEnabled').checked];if(page==='safesearch')return [...document.querySelectorAll('input[name="engine"]:checked')].map(item=>item.value);const ids={blockpage:'blockIPs',whitelist:'whitelist','local-dns-records':'hostRecords',acl:'recursiveClients'};return ids[page]?document.getElementById(ids[page]).value:null;}
  function setFormState(page,status){const form=document.querySelector(`form[data-settings-form="${page}"]`);if(!form)return;const badge=form.closest('.settings-card')?.querySelector('.form-status'),discard=form.querySelector('.discard-button'),labels={loading:'Loading…',saved:'Saved',dirty:'Unsaved changes',saving:'Saving…',error:'Save failed'};if(badge){badge.className=`form-status ${status}`;badge.textContent=labels[status]||status;}if(discard)discard.hidden=!['dirty','error'].includes(status);form.closest('.settings-card')?.classList.toggle('is-dirty',['dirty','error'].includes(status));const submit=form.querySelector('button[type="submit"]');if(submit)submit.disabled=status==='saving';}
  function restoreSettingsPage(page){const settings=state.settings;if(!settings)return;if(page==='update'){const interval=document.getElementById('updateInterval');if(interval&&!Array.from(interval.options).some(option=>Number(option.value)===settings.update_interval_minutes)){const option=document.createElement('option');option.value=settings.update_interval_minutes;option.textContent=`Every ${settings.update_interval_minutes} minutes`;interval.appendChild(option);}if(interval)interval.value=settings.update_interval_minutes;}if(page==='dns-options'){document.getElementById('dnssecEnabled').checked=Boolean(settings.dnssec_enabled);document.getElementById('tproxyEnabled').checked=Boolean(settings.tproxy_enabled);}const values={blockpage:['blockIPs',settings.block_ips],whitelist:['whitelist',settings.whitelist],'local-dns-records':['hostRecords',settings.host_records],acl:['recursiveClients',settings.recursive_clients]};if(values[page])document.getElementById(values[page][0]).value=(values[page][1]||[]).join('\n');if(page==='safesearch')document.querySelectorAll('input[name="engine"]').forEach(input=>input.checked=(settings.safesearch_engines||[]).includes(input.value));state.dirtyPages.delete(page);setFormState(page,'saved');}
  function syncDirtyState(page){if(!state.settings||state.savingPages.has(page))return;const dirty=JSON.stringify(formSnapshot(page))!==JSON.stringify(pageSnapshot(state.settings,page));if(dirty)state.dirtyPages.add(page);else state.dirtyPages.delete(page);setFormState(page,dirty?'dirty':'saved');}
  async function loadSettings(options={}){const settings=await api('/api/settings'),initial=!state.settings,force=new Set(options.forcePages||[]);state.settings=settings;settingsPages.forEach(page=>{if(initial||force.has(page)||!state.dirtyPages.has(page))restoreSettingsPage(page);else syncDirtyState(page);});renderSyncSchedule();}
  function discardPage(page){if(settingsPages.includes(page))restoreSettingsPage(page);if(page==='security'){document.getElementById('passwordForm')?.reset();state.passwordDirty=false;}}
  function hasUnsavedChanges(page){return state.dirtyPages.has(page)||(page==='security'&&state.passwordDirty);}
  function initializeDraftControls(){document.querySelectorAll('form[data-settings-form]').forEach(form=>{const page=form.dataset.settingsForm,header=form.closest('.settings-card')?.querySelector('header'),footer=form.querySelector('footer'),submit=footer?.querySelector('button[type="submit"]');if(header&&!header.querySelector('.form-status')){const badge=document.createElement('span');badge.className='form-status loading';badge.setAttribute('aria-live','polite');badge.textContent='Loading…';header.appendChild(badge);}if(footer&&submit&&!footer.querySelector('.form-actions')){const actions=document.createElement('div');actions.className='form-actions';const discard=document.createElement('button');discard.type='button';discard.className='button subtle discard-button';discard.textContent='Discard';discard.hidden=true;discard.addEventListener('click',async()=>{const accepted=await confirmAction('Discard unsaved changes?',`Changes on ${pageNames[page]} will be replaced with the last saved configuration.`);if(accepted)discardPage(page);});actions.append(discard,submit);footer.appendChild(actions);}form.addEventListener('input',()=>syncDirtyState(page));});const passwordForm=document.getElementById('passwordForm');passwordForm?.addEventListener('input',()=>{state.passwordDirty=[...passwordForm.querySelectorAll('input')].some(input=>input.value!=='');});}

  const actionNames={update_blacklist:'Blacklist refreshed',restart_unbound:'Resolver restarted',apply_settings:'DNS configuration updated',change_password:'Administrator password changed'};
  function activityIcon(action){const paths={apply_settings:'<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="13" cy="18" r="2"/>',update_blacklist:'<path d="M20 6v5h-5M4 18v-5h5M6.1 9a7 7 0 0 1 11.3-2.4L20 11M4 13l2.6 4.4A7 7 0 0 0 17.9 15"/>',restart_unbound:'<path d="M12 3v9M7.1 6.6a8 8 0 1 0 9.8 0"/>',change_password:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>'};return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[action]||paths.apply_settings}</svg>`;}
  async function loadActions(){const actions=await api('/api/actions'),host=document.getElementById('actionList');if(!host)return;if(!actions.length){host.innerHTML='<div class="empty-state">No activity has been recorded.</div>';return;}host.innerHTML=actions.map(action=>{const historical=action.action==='apply_settings'&&action.message==='selesai'?'Konfigurasi diterapkan; detail perubahan tidak tersedia untuk event lama.':action.message;return `<div class="activity-item ${action.status==='success'?'':'failed'}"><span class="activity-icon ${action.action}">${activityIcon(action.action)}</span><span class="activity-copy"><strong>${actionNames[action.action]||escapeHTML(action.action)}</strong><small>${escapeHTML(historical)}</small></span><time class="activity-time">${new Date(action.finished).toLocaleString('id-ID')}</time></div>`}).join('');}
  async function createAction(action,settings,scheduleRefresh=true){const body={action};if(settings)body.settings=settings;const result=await api('/api/actions',{method:'POST',body:JSON.stringify(body)});toast(`Action queued · ${result.id}`);if(scheduleRefresh){setTimeout(loadActions,1500);setTimeout(()=>Promise.all([loadStatus(),loadActions()]),5000);}return result;}
  async function waitForAction(id){for(let attempt=0;attempt<40;attempt++){await new Promise(resolve=>setTimeout(resolve,750));const actions=await api('/api/actions'),result=actions.find(action=>action.id===id);if(result){if(result.status==='success')return result;throw new Error(result.message||'Configuration could not be applied.');}}throw new Error('Worker response timed out; review Activity log before retrying.');}
  function normalizedPage(value){if(value==='hosts-file')value='local-dns-records';return document.querySelector(`[data-page="${value}"]`)?value:'overview';}
  function renderRoute(page){page=normalizedPage(page);if(state.currentPage==='security'&&page!=='security')discardPage('security');state.currentPage=page;document.querySelectorAll('.page-view').forEach(node=>node.classList.toggle('active',node.dataset.page===page));document.querySelectorAll('[data-nav]').forEach(node=>node.classList.toggle('active',node.dataset.nav===page));setText('topPageName',pageNames[page]||'Overview');closeSidebar();if(page==='overview')loadMetrics().catch(error=>toast(error.message,true));if(page==='statistics')Promise.all([loadStatus(),loadMetrics()]).catch(error=>toast(error.message,true));if(page==='activity')loadActions().catch(error=>toast(error.message,true));window.scrollTo({top:0,behavior:'instant'});}
  async function navigateTo(page){page=normalizedPage(page);if(page===state.currentPage)return;if(hasUnsavedChanges(state.currentPage)){const accepted=await confirmAction('Discard unsaved changes?',`Changes on ${pageNames[state.currentPage]} have not been saved. Leave this page and discard them?`);if(!accepted)return;discardPage(state.currentPage);}if((location.hash||'#overview')===`#${page}`)renderRoute(page);else location.hash=page;}
  async function handleHashChange(){const requested=normalizedPage((location.hash||'#overview').slice(1));if(state.suppressHashGuard){state.suppressHashGuard=false;renderRoute(requested);return;}if(state.currentPage&&requested!==state.currentPage&&hasUnsavedChanges(state.currentPage)){history.replaceState(null,'',`#${state.currentPage}`);const accepted=await confirmAction('Discard unsaved changes?',`Changes on ${pageNames[state.currentPage]} have not been saved. Leave this page and discard them?`);if(!accepted)return;discardPage(state.currentPage);state.suppressHashGuard=true;location.hash=requested;return;}renderRoute(requested);}
  function closeSidebar(){document.getElementById('sidebar')?.classList.remove('open');document.getElementById('sidebarBackdrop').hidden=true;}

  document.querySelectorAll('[data-range]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-range]').forEach(item=>item.classList.remove('active'));button.classList.add('active');state.range=button.dataset.range;loadMetrics().catch(error=>toast(error.message,true));}));
  document.getElementById('resetChartFilters')?.addEventListener('click',()=>{localStorage.removeItem('trustlayer_chart_filters');renderToggles();renderCharts();});
  document.getElementById('refreshStatistics')?.addEventListener('click',()=>Promise.all([loadStatus(),loadMetrics()]).then(()=>toast('Metrics refreshed')).catch(error=>toast(error.message,true)));
  document.getElementById('refreshActions')?.addEventListener('click',()=>loadActions().then(()=>toast('Activity refreshed')).catch(error=>toast(error.message,true)));
  document.getElementById('passwordForm')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    const current=document.getElementById('currentPassword').value,newPassword=document.getElementById('newPassword').value,confirmPassword=document.getElementById('confirmPassword').value;
    if(newPassword.length<12){toast('Password baru minimal 12 karakter.',true);return;}
    if(newPassword!==confirmPassword){toast('Konfirmasi password tidak cocok.',true);return;}
    const accepted=await confirmAction('Change administrator password','All existing dashboard sessions will be signed out. DNS resolution will remain online.');
    if(!accepted)return;
    const button=document.getElementById('changePasswordButton');button.disabled=true;button.textContent='Changing password…';
    try{
      await api('/api/change-password',{method:'POST',body:JSON.stringify({current_password:current,new_password:newPassword,confirm_password:confirmPassword})});
      form.reset();state.passwordDirty=false;toast('Password change queued. You will be signed out automatically.');
      setTimeout(()=>location.assign('/login?changed=1'),5000);
    }catch(error){button.disabled=false;button.textContent='Change password';toast(error.message,true);}
  });
  document.querySelectorAll('form[data-settings-form]').forEach(form=>form.addEventListener('submit',async event=>{event.preventDefault();const page=form.dataset.settingsForm;if(!state.dirtyPages.has(page)){toast('No unsaved changes on this page.');return;}const accepted=await confirmAction('Apply configuration','The configuration will be validated before the resolver reloads.');if(!accepted)return;state.savingPages.add(page);setFormState(page,'saving');try{const queued=await createAction('apply_settings',collectSettings(page),false);await waitForAction(queued.id);state.savingPages.delete(page);await loadSettings({forcePages:[page]});await loadActions();toast(`${pageNames[page]} saved successfully.`);}catch(error){state.savingPages.delete(page);state.dirtyPages.add(page);setFormState(page,'error');toast(error.message,true);}}));
  document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',async()=>{const restart=button.dataset.action==='restart_unbound',accepted=await confirmAction(restart?'Restart Unbound':'Refresh blacklist',restart?'DNS may be unavailable for a few seconds while the validated service restarts.':'The latest domains_isp source will be downloaded, validated, and activated atomically.',restart);if(accepted)createAction(button.dataset.action).catch(error=>toast(error.message,true));}));
  function queryIcon(kind){const paths={empty:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',loading:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',blocked:'<path d="M12 3 20 6v6c0 5-3.4 8-8 10-4.6-2-8-5-8-10V6zM8.5 8.5l7 7M15.5 8.5l-7 7"/>',whitelist:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.7 2.7L16.5 9"/>',normal:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',error:'<path d="M10.3 4.1 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>'};return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind]||paths.normal}</svg>`;}
  document.getElementById('domainTestForm')?.addEventListener('submit',async event=>{event.preventDefault();const result=document.getElementById('testResult');result.className='query-result result-loading';result.innerHTML=`<span class="result-icon">${queryIcon('loading')}</span><div><strong>Running query</strong><p>Waiting for the local resolver.</p></div>`;try{const data=await api('/api/test-domain',{method:'POST',body:JSON.stringify({domain:document.getElementById('testDomain').value})});const labels={blocked:'Blocked by policy',whitelist:'Allowed by whitelist',normal:'Normal resolution'},kind=['blocked','whitelist','normal'].includes(data.classification)?data.classification:'normal';result.className=`query-result result-${kind}`;result.innerHTML=`<span class="result-icon">${queryIcon(kind)}</span><div><strong>${labels[kind]} · ${escapeHTML(data.domain)}</strong><p><code>${escapeHTML((data.answers||[]).join(', ')||'No A record returned')}</code></p></div>`;}catch(error){result.className='query-result result-error';result.innerHTML=`<span class="result-icon">${queryIcon('error')}</span><div><strong>Query failed</strong><p>${escapeHTML(error.message)}</p></div>`;toast(error.message,true);}});

  const themeKey='trustlayer_theme_v2';
  function applyTheme(theme){document.body.dataset.theme=theme;localStorage.setItem(themeKey,theme);setText('themeLabel',theme==='light'?'Dark mode':'Light mode');renderCharts();}
  document.getElementById('themeToggle')?.addEventListener('click',()=>applyTheme(document.body.dataset.theme==='dark'?'light':'dark'));
  document.getElementById('menuToggle')?.addEventListener('click',()=>{document.getElementById('sidebar').classList.add('open');document.getElementById('sidebarBackdrop').hidden=false;});
  document.getElementById('sidebarBackdrop')?.addEventListener('click',closeSidebar);
  document.addEventListener('click',event=>{const link=event.target.closest('a[href^="#"]');if(!link)return;event.preventDefault();navigateTo(link.getAttribute('href').slice(1));});
  window.addEventListener('hashchange',handleHashChange);window.addEventListener('beforeunload',event=>{if(state.dirtyPages.size||state.passwordDirty){event.preventDefault();event.returnValue='';}});window.addEventListener('resize',()=>{clearTimeout(window.chartResize);window.chartResize=setTimeout(renderCharts,120);});

  hydrateIcons();initializeDraftControls();applyTheme(localStorage.getItem(themeKey)||'light');renderToggles();if(!location.hash)history.replaceState(null,'','#overview');renderRoute(normalizedPage(location.hash.slice(1)));
  Promise.all([loadStatus(),loadSettings(),loadActions(),loadMetrics()]).catch(error=>toast(error.message,true));
  setInterval(()=>{loadStatus().catch(()=>{});if((location.hash||'#overview')==='#overview')loadMetrics().catch(()=>{});},60000);
})();
