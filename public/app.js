"use strict";
const $=x=>document.querySelector(x);
const escapeHTML=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const state={cameras:[],incidents:[],events:[],modal:""};
const human={new:"Новая",in_progress:"В работе",resolved:"Закрыта",online:"На связи",offline:"Нет связи",low:"Низкий",medium:"Средний",high:"Высокий",critical:"Критичный"};
async function request(url,method="GET",body){
 const options={method,headers:{"Content-Type":"application/json"}};
 if(body!==undefined)options.body=JSON.stringify(body);
 const r=await fetch(url,options);const result=await r.json();
 if(!r.ok)throw Error(result.error||"Ошибка соединения");
 return result;
}
function toast(text,error=false){const n=$("#notice");n.textContent=text;n.style.background=error?"#9b4638":"#1d464f";n.style.display="block";clearTimeout(window.hideNote);window.hideNote=setTimeout(()=>n.style.display="none",3100);}
function displayCameras(){
 $("#cameraRows").innerHTML=state.cameras.map(x=>'<tr><td><b>'+escapeHTML(x.id)+'</b></td><td>'+escapeHTML(x.name)+'</td><td>'+escapeHTML(x.location)+'</td><td><span class="status '+escapeHTML(x.status)+'">'+escapeHTML(human[x.status])+'</span></td><td><button type="button" class="secondary" data-camera="'+escapeHTML(x.id)+'" data-status="'+(x.status==="online"?"offline":"online")+'">Сменить статус</button></td></tr>').join("");
}
function displayIncidents(){
 const filter=$("#status").value,arr=state.incidents.filter(x=>!filter||x.status===filter);
 $("#incidentRows").innerHTML=arr.map(x=>{
  const action=x.status==="new"?'<button data-incident="'+x.id+'" data-next="in_progress">В работу</button>':x.status==="in_progress"?'<button data-incident="'+x.id+'" data-next="resolved">Завершить</button>':'<span class="status online">Готово</span>';
  return '<tr><td><b>№ '+x.id+'</b><small class="'+escapeHTML(x.severity)+'">'+escapeHTML(human[x.severity])+'</small></td><td><strong>'+escapeHTML(x.title)+'</strong><small>'+escapeHTML(x.description)+'</small></td><td>'+escapeHTML(x.cameraId)+'</td><td>'+escapeHTML(x.assignee||"Не назначен")+'</td><td><span class="tag">'+escapeHTML(human[x.status])+'</span></td><td>'+action+'</td></tr>';
 }).join("")||'<tr><td colspan="6">Заявок по выбранному фильтру нет</td></tr>';
}
function displayEvents(){
 $("#eventLog").innerHTML=state.events.map(e=>'<li><time>'+escapeHTML(new Date(e.createdAt).toLocaleString("ru-RU"))+' · '+escapeHTML(e.cameraId)+'</time><b class="'+escapeHTML(e.severity)+'">'+escapeHTML(e.type)+'</b><p>'+escapeHTML(e.message)+'</p></li>').join("")||'<li>Пока нет событий</li>';
}
async function reload(){
 const [c,i,e,m]=await Promise.all([request("/api/cameras"),request("/api/incidents"),request("/api/events"),request("/api/overview")]);
 state.cameras=c;state.incidents=i;state.events=e;$("#mOnline").textContent=m.online+"/"+m.cameras;$("#mCameras").textContent=m.cameras;$("#mOpen").textContent=m.open;$("#mEvents").textContent=m.events;
 displayCameras();displayIncidents();displayEvents();$("#health").textContent="● Сервер работает";
}
const opts=(items)=>items.map(x=>'<option value="'+escapeHTML(x.id)+'">'+escapeHTML(x.id+" · "+x.name)+'</option>').join("");
function field(name,label,kind="text",options=""){
 return '<div class="field"><label for="f_'+name+'">'+label+'</label>'+(kind==="select"?'<select id="f_'+name+'" name="'+name+'" required>'+options+'</select>':kind==="textarea"?'<textarea id="f_'+name+'" name="'+name+'"></textarea>':'<input id="f_'+name+'" name="'+name+'" required maxlength="140">')+'</div>';
}
function openForm(mode){
 state.modal=mode;$("#dialogTitle").textContent=mode==="incident"?"Новая заявка":"Новое событие датчика";
 const priorities='<option value="low">Низкий</option><option value="medium">Средний</option><option value="high">Высокий</option><option value="critical">Критичный</option>';
 const cameras=opts(state.cameras);
 $("#fields").innerHTML=mode==="incident"?field("title","Краткое название")+field("cameraId","Видеоточка","select",cameras)+field("severity","Важность","select",priorities)+field("description","Описание","textarea"):field("cameraId","Видеоточка","select",cameras)+field("type","Тип","select",'<option value="motion">Движение</option><option value="door_open">Открытие двери</option><option value="smoke">Дым</option><option value="camera_offline">Отключение камеры</option>')+field("severity","Приоритет","select",priorities)+field("message","Содержание события");
 $("#formDialog").showModal();
}
$("#refresh").addEventListener("click",()=>reload().then(()=>toast("Данные обновлены")).catch(e=>toast(e.message,true)));
$("#status").addEventListener("change",displayIncidents);
$("#newIncident").addEventListener("click",()=>openForm("incident"));
$("#newEvent").addEventListener("click",()=>openForm("event"));
$("#closeDialog").addEventListener("click",()=>$("#formDialog").close());
$("#cancel").addEventListener("click",()=>$("#formDialog").close());
$("#editor").addEventListener("submit",async e=>{
 e.preventDefault();const payload=Object.fromEntries(new FormData(e.target));
 try{await request(state.modal==="incident"?"/api/incidents":"/api/events","POST",payload);$("#formDialog").close();e.target.reset();await reload();toast("Запись сохранена");}catch(err){toast(err.message,true);}
});
document.addEventListener("click",async e=>{
 const btn=e.target.closest("button[data-camera],button[data-incident]");if(!btn)return;
 btn.disabled=true;try{
  if(btn.dataset.camera)await request("/api/cameras/"+encodeURIComponent(btn.dataset.camera),"PATCH",{status:btn.dataset.status});
  if(btn.dataset.incident)await request("/api/incidents/"+encodeURIComponent(btn.dataset.incident),"PATCH",{status:btn.dataset.next,assignee:"Оператор смены"});
  await reload();toast("Изменение сохранено");
 }catch(err){toast(err.message,true);}finally{btn.disabled=false;}
});
function tick(){$("#clock").textContent=new Date().toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});}
tick();setInterval(tick,30000);
reload().catch(e=>{$("#health").textContent="● Нет соединения";toast(e.message,true);});
