const KEY="alJefoonDailyExpenseReportV1";
const holders=[
  {name:"Ali",active:true},{name:"Saud",active:true},{name:"Zohaib",active:true},
  {name:"Fahad",active:true},{name:"Ihsan",active:true},{name:"Parvaiz",active:false},
  {name:"Malik",active:false}
];
let state=load();

function defaultState(){
  return {
    date:new Date().toISOString().slice(0,10),
    jobs:[], cash:[], expenses:[], bank:[],
    petty:holders.map(h=>({holder:h.name,opening:0,received:0,expenses:0,active:h.active})),
    remarks:""
  };
}
function load(){try{return JSON.parse(localStorage.getItem(KEY))||defaultState()}catch(e){return defaultState()}}
function save(){localStorage.setItem(KEY,JSON.stringify(state));renderAll()}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function money(n){return "AED "+Number(n||0).toLocaleString("en-AE",{minimumFractionDigits:2,maximumFractionDigits:2})}
function num(v){return Math.max(0,Number(v)||0)}
function emptyRow(cols,msg="No entries"){return `<tr><td colspan="${cols}" style="text-align:center;color:#777">${msg}</td></tr>`}

document.addEventListener("DOMContentLoaded",()=>{
  document.getElementById("reportDate").value=state.date;
  document.getElementById("reportDate").addEventListener("change",e=>{state.date=e.target.value;save()});
  document.getElementById("remarksInput").value=state.remarks;
  document.getElementById("remarksInput").addEventListener("input",e=>{state.remarks=e.target.value;save()});
  document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".section").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");document.getElementById(b.dataset.section).classList.add("active");
  }));
  document.getElementById("printOptionsBtn").onclick=()=>document.getElementById("printModal").classList.remove("hidden");
  document.getElementById("printReportBtn").onclick=()=>printSelected(["summary","jobs","cash","expenses","bank","petty","inactive","remarks"]);
  document.getElementById("closeModal").onclick=()=>document.getElementById("printModal").classList.add("hidden");
  document.getElementById("printFull").onclick=()=>{document.getElementById("printModal").classList.add("hidden");printSelected(["summary","jobs","cash","expenses","bank","petty","inactive","remarks"])};
  document.getElementById("printSelected").onclick=()=>{
    const a=[...document.querySelectorAll(".print-check:checked")].map(x=>x.value);
    document.getElementById("printModal").classList.add("hidden");printSelected(a)
  };
  renderAll();
});

function addJob(){state.jobs.push({jobNo:"",client:"",description:"",total:0,cash:0,incharge:"",status:"Pending"});save()}
function addCash(){state.cash.push({from:"",jobNo:"",amount:0,receivedBy:""});save()}
function addExpense(){state.expenses.push({paidTo:"",type:"",amount:0,paidBy:""});save()}
function addBank(){state.bank.push({date:state.date,reference:"",from:"",amount:0,remarks:""});save()}



function setPettyStatus(i,status){
  if(!state.petty[i]) return;
  state.petty[i].active = status === "active";
  save();
}

function updateArray(type,i,key,value){state[type][i][key]=value;save()}
function del(type,i){state[type].splice(i,1);save()}

function renderJobs(){
  const el=document.getElementById("jobsEditor");
  el.innerHTML=`<div class="editor-table"><table><thead><tr><th>Job No</th><th>Client</th><th>Description</th><th>Total Amount</th><th>Cash</th><th>Incharge</th><th>Status</th><th></th></tr></thead><tbody>
  ${state.jobs.map((r,i)=>`<tr>
  <td><input value="${esc(r.jobNo)}" onchange="updateArray('jobs',${i},'jobNo',this.value)"></td>
  <td><input value="${esc(r.client)}" onchange="updateArray('jobs',${i},'client',this.value)"></td>
  <td><input value="${esc(r.description)}" onchange="updateArray('jobs',${i},'description',this.value)"></td>
  <td><input type="number" step="0.01" value="${r.total}" onchange="updateArray('jobs',${i},'total',num(this.value))"></td>
  <td><input type="number" step="0.01" value="${r.cash}" onchange="updateArray('jobs',${i},'cash',num(this.value))"></td>
  <td><input value="${esc(r.incharge)}" onchange="updateArray('jobs',${i},'incharge',this.value)"></td>
  <td><select onchange="updateArray('jobs',${i},'status',this.value)">${["Pending","Partially Received","Received","No Amount"].map(x=>`<option ${r.status===x?"selected":""}>${x}</option>`).join("")}</select></td>
  <td><button class="delete-btn" onclick="del('jobs',${i})">Delete</button></td></tr>`).join("")}</tbody></table></div>`;
}
function renderCash(){
  document.getElementById("cashEditor").innerHTML=`<div class="editor-table"><table><thead><tr><th>From Whom</th><th>Job No</th><th>Cash</th><th>Received By</th><th></th></tr></thead><tbody>
  ${state.cash.map((r,i)=>`<tr><td><input value="${esc(r.from)}" onchange="updateArray('cash',${i},'from',this.value)"></td><td><input value="${esc(r.jobNo)}" onchange="updateArray('cash',${i},'jobNo',this.value)"></td><td><input type="number" step="0.01" value="${r.amount}" onchange="updateArray('cash',${i},'amount',num(this.value))"></td><td><input value="${esc(r.receivedBy)}" onchange="updateArray('cash',${i},'receivedBy',this.value)"></td><td><button class="delete-btn" onclick="del('cash',${i})">Delete</button></td></tr>`).join("")}</tbody></table></div>`;
}
function renderExpenses(){
  document.getElementById("expenseEditor").innerHTML=`<div class="editor-table"><table><thead><tr><th>Paid To</th><th>Expense Type</th><th>Amount</th><th>Paid By</th><th></th></tr></thead><tbody>
  ${state.expenses.map((r,i)=>`<tr><td><input value="${esc(r.paidTo)}" onchange="updateArray('expenses',${i},'paidTo',this.value)"></td><td><input value="${esc(r.type)}" onchange="updateArray('expenses',${i},'type',this.value)"></td><td><input type="number" step="0.01" value="${r.amount}" onchange="updateArray('expenses',${i},'amount',num(this.value))"></td><td><input value="${esc(r.paidBy)}" onchange="updateArray('expenses',${i},'paidBy',this.value)"></td><td><button class="delete-btn" onclick="del('expenses',${i})">Delete</button></td></tr>`).join("")}</tbody></table></div>`;
}
function renderBank(){
  document.getElementById("bankEditor").innerHTML=`<div class="editor-table"><table><thead><tr><th>Received On</th><th>Reference</th><th>From Whom</th><th>Amount</th><th>Remarks</th><th></th></tr></thead><tbody>
  ${state.bank.map((r,i)=>`<tr><td><input type="date" value="${r.date}" onchange="updateArray('bank',${i},'date',this.value)"></td><td><input value="${esc(r.reference)}" onchange="updateArray('bank',${i},'reference',this.value)"></td><td><input value="${esc(r.from)}" onchange="updateArray('bank',${i},'from',this.value)"></td><td><input type="number" step="0.01" value="${r.amount}" onchange="updateArray('bank',${i},'amount',num(this.value))"></td><td><input value="${esc(r.remarks)}" onchange="updateArray('bank',${i},'remarks',this.value)"></td><td><button class="delete-btn" onclick="del('bank',${i})">Delete</button></td></tr>`).join("")}</tbody></table></div>`;
}
function renderPetty(){
  document.getElementById("pettyEditor").innerHTML=`<div class="editor-table"><table><thead><tr><th>Holder</th><th>Opening</th><th>Received</th><th>Expenses</th><th>Closing</th><th>Status</th></tr></thead><tbody>
  ${state.petty.map((r,i)=>`<tr><td><b>${esc(r.holder)}</b></td><td><input type="number" step="0.01" value="${r.opening}" onchange="updateArray('petty',${i},'opening',num(this.value))"></td><td><input type="number" step="0.01" value="${r.received}" onchange="updateArray('petty',${i},'received',num(this.value))"></td><td><input type="number" step="0.01" value="${r.expenses}" onchange="updateArray('petty',${i},'expenses',num(this.value))"></td><td><b>${money(r.opening+r.received-r.expenses)}</b></td><td><select class="status-select ${r.active?"status-active":"status-inactive"}" onchange="setPettyStatus(${i},this.value)"><option value="active" ${r.active?"selected":""}>Active</option><option value="inactive" ${!r.active?"selected":""}>Inactive</option></select></td></tr>`).join("")}</tbody></table></div>`;
}

function rows(type,fn,cols){
  return state[type].length?state[type].map(fn).join(""):emptyRow(cols);
}
function renderPreview(){
  const cashTotal=state.cash.reduce((a,r)=>a+num(r.amount),0);
  const bankTotal=state.bank.reduce((a,r)=>a+num(r.amount),0);
  const expenseTotal=state.expenses.reduce((a,r)=>a+num(r.amount),0);
  const pettyTotal=state.petty.filter(r=>r.active).reduce((a,r)=>a+num(r.opening)+num(r.received)-num(r.expenses),0);
  document.getElementById("sumCash").textContent=money(cashTotal);document.getElementById("sumBank").textContent=money(bankTotal);document.getElementById("sumExpenses").textContent=money(expenseTotal);document.getElementById("sumPetty").textContent=money(pettyTotal);
  document.getElementById("paperCash").textContent=money(cashTotal).replace("AED ","");document.getElementById("paperBank").textContent=money(bankTotal).replace("AED ","");document.getElementById("paperExpenses").textContent=money(expenseTotal).replace("AED ","");document.getElementById("paperPetty").textContent=money(pettyTotal).replace("AED ","");
  document.querySelector("#jobsPreview tbody").innerHTML=rows("jobs",(r)=>`<tr><td>${esc(r.jobNo)}</td><td>${esc(r.client)}</td><td>${esc(r.description)}</td><td class="num">${num(r.total).toFixed(2)}</td><td class="num">${num(r.cash).toFixed(2)}</td><td>${esc(r.incharge)}</td><td>${esc(r.status)}</td></tr>`,7);
  document.querySelector("#cashPreview tbody").innerHTML=rows("cash",(r)=>`<tr><td>${esc(r.from)}</td><td>${esc(r.jobNo)}</td><td class="num">${num(r.amount).toFixed(2)}</td><td>${esc(r.receivedBy)}</td></tr>`,4);
  document.querySelector("#expensePreview tbody").innerHTML=rows("expenses",(r)=>`<tr><td>${esc(r.paidTo)}</td><td>${esc(r.type)}</td><td class="num">${num(r.amount).toFixed(2)}</td><td>${esc(r.paidBy)}</td></tr>`,4);
  document.querySelector("#bankPreview tbody").innerHTML=rows("bank",(r)=>`<tr><td>${esc(r.date)}</td><td>${esc(r.reference)}</td><td>${esc(r.from)}</td><td class="num">${num(r.amount).toFixed(2)}</td><td>${esc(r.remarks)}</td></tr>`,5);
  const active=state.petty.filter(r=>r.active), inactive=state.petty.filter(r=>!r.active);
  const pettyRows=r=>`<tr><td>${esc(r.holder)}</td><td class="num">${num(r.opening).toFixed(2)}</td><td class="num">${num(r.received).toFixed(2)}</td><td class="num">${num(r.expenses).toFixed(2)}</td><td class="num">${(num(r.opening)+num(r.received)-num(r.expenses)).toFixed(2)}</td></tr>`;
  document.querySelector("#pettyPreview tbody").innerHTML=active.length?active.map(pettyRows).join(""):emptyRow(5);
  document.querySelector("#inactivePreview tbody").innerHTML=inactive.length?inactive.map(pettyRows).join(""):emptyRow(5);
  document.getElementById("remarksPreview").textContent=state.remarks||"";
}
function renderAll(){renderJobs();renderCash();renderExpenses();renderBank();renderPetty();renderPreview();document.getElementById("reportDate").value=state.date;document.getElementById("remarksInput").value=state.remarks}

function printSelected(sections){
  renderPreview();
  const all=["summary","jobs","cash","expenses","bank","petty","inactive","remarks"];
  all.forEach(s=>{
    const map={summary:".mini-summary",jobs:".report-block:nth-of-type(1)",cash:".report-block:nth-of-type(2)",expenses:".report-block:nth-of-type(3)",bank:".report-block:nth-of-type(4)",petty:".report-block:nth-of-type(5)",inactive:".report-block:nth-of-type(6)",remarks:".report-block:nth-of-type(7)"};
    const el=document.querySelector(map[s]); if(el) el.classList.toggle("hidden-print",!sections.includes(s));
  });
  window.print();
  setTimeout(()=>all.forEach(s=>{const map={summary:".mini-summary",jobs:".report-block:nth-of-type(1)",cash:".report-block:nth-of-type(2)",expenses:".report-block:nth-of-type(3)",bank:".report-block:nth-of-type(4)",petty:".report-block:nth-of-type(5)",inactive:".report-block:nth-of-type(6)",remarks:".report-block:nth-of-type(7)"};const el=document.querySelector(map[s]);if(el)el.classList.remove("hidden-print")}),500);
}
