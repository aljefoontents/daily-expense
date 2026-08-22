const KEY="alJefoonDailyExpenseReportV1";

const holders=[
  {name:"Ali",active:true},
  {name:"Saud",active:true},
  {name:"Zohaib",active:true},
  {name:"Fahad",active:true},
  {name:"Ihsan",active:true},
  {name:"Parvaiz",active:false},
  {name:"Malik",active:false}
];

let state=load();


/* =====================================================
   DATE HELPERS
   ===================================================== */

function todayString(){
  const d=new Date();
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");

  return `${y}-${m}-${day}`;
}

function formatDate(date){

  if(!date) return "";

  const parts=String(date).split("-");

  if(parts.length!==3) return date;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function dateValue(date){
  return String(date||"");
}


/* =====================================================
   DEFAULT STATE
   ===================================================== */

function defaultState(){

  return {
    date:todayString(),

    jobs:[],
    cash:[],
    expenses:[],
    bank:[],

    petty:holders.map(h=>({
      holder:h.name,

      /*
        baseOpening is the ORIGINAL opening balance.
        Future days automatically use the previous day's
        closing balance.
      */
      baseOpening:0,

      /*
        Keep old opening field for compatibility with
        existing saved data.
      */
      opening:0,

      received:0,
      expenses:0,

      active:h.active
    })),

    remarks:""
  };
}


/* =====================================================
   LOAD
   ===================================================== */

function load(){

  try{

    const saved=JSON.parse(
      localStorage.getItem(KEY)
    );

    const base=defaultState();

    if(!saved) return base;


    /* Arrays */

    saved.cash=Array.isArray(saved.cash)
      ? saved.cash
      : [];

    saved.expenses=Array.isArray(saved.expenses)
      ? saved.expenses
      : [];

    saved.jobs=Array.isArray(saved.jobs)
      ? saved.jobs
      : [];

    saved.bank=Array.isArray(saved.bank)
      ? saved.bank
      : [];

    saved.petty=Array.isArray(saved.petty)
      ? saved.petty
      : base.petty;


    /* Date */

    saved.date=saved.date||base.date;

    saved.remarks=saved.remarks||"";


    /* =================================================
       MIGRATE OLD PETTY CASH DATA
       ================================================= */

    saved.petty.forEach(p=>{

      if(typeof p.baseOpening==="undefined"){

        p.baseOpening=num(
          typeof p.opening!=="undefined"
            ? p.opening
            : 0
        );

      }

      if(typeof p.opening==="undefined"){
        p.opening=p.baseOpening;
      }

      if(typeof p.received==="undefined"){
        p.received=0;
      }

      if(typeof p.expenses==="undefined"){
        p.expenses=0;
      }

      p.active=
        typeof p.active==="boolean"
          ? p.active
          : true;

    });


    /* =================================================
       ADD MISSING HOLDERS
       ================================================= */

    holders.forEach(h=>{

      const exists=saved.petty.some(
        p=>
          normalizeName(p.holder)
          ===
          normalizeName(h.name)
      );

      if(!exists){

        saved.petty.push({
          holder:h.name,
          baseOpening:0,
          opening:0,
          received:0,
          expenses:0,
          active:h.active
        });

      }

    });


    /*
      Existing transactions from the old version did not
      have a date.

      Assign them to the saved report date so they do not
      disappear after the new date filtering is enabled.
    */

    saved.cash.forEach(r=>{
      if(!r.date){
        r.date=saved.date;
      }
    });

    saved.expenses.forEach(r=>{
      if(!r.date){
        r.date=saved.date;
      }
    });

    saved.jobs.forEach(r=>{
      if(!r.date){
        r.date=saved.date;
      }
    });

    saved.bank.forEach(r=>{
      if(!r.date){
        r.date=saved.date;
      }
    });


    return saved;

  }catch(e){

    console.error("Load error:",e);

    return defaultState();
  }
}


/* =====================================================
   SAVE
   ===================================================== */

function save(){

  localStorage.setItem(
    KEY,
    JSON.stringify(state)
  );

  renderAll();
}


/* =====================================================
   GENERAL HELPERS
   ===================================================== */

function esc(v){

  return String(v??"").replace(
    /[&<>"']/g,
    m=>({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#039;"
    }[m])
  );

}


function money(n){

  return "AED "+Number(n||0).toLocaleString(
    "en-AE",
    {
      minimumFractionDigits:2,
      maximumFractionDigits:2
    }
  );

}


function num(v){

  /*
    IMPORTANT:
    Number("-27") correctly returns -27.
    The old application therefore supports negative
    numbers.
  */

  const n=Number(v);

  return Number.isFinite(n)
    ? n
    : 0;

}


function emptyRow(cols,msg="No entries"){

  return `
    <tr>
      <td colspan="${cols}"
          style="text-align:center;color:#777">
        ${msg}
      </td>
    </tr>
  `;

}


function normalizeName(value){

  return String(value||"")
    .trim()
    .toLowerCase();

}


function sameDate(a,b){

  return String(a||"")===String(b||"");

}


/* =====================================================
   SELECTED DATE
   ===================================================== */

function selectedDate(){

  const input=document.getElementById("reportDate");

  if(input && input.value){
    return input.value;
  }

  return state.date||todayString();
}


/* =====================================================
   FILTER TRANSACTIONS BY REPORT DATE
   ===================================================== */

function getDaily(type,date=selectedDate()){

  return (state[type]||[]).filter(
    r=>sameDate(r.date,date)
  );

}


/* =====================================================
   PETTY CASH
   ===================================================== */

/*
  Find petty holder.
*/

function findPettyHolder(name){

  const target=normalizeName(name);

  if(!target) return null;

  return state.petty.find(
    p=>normalizeName(p.holder)===target
  )||null;

}


/*
  Get all cash received by a holder on a particular day.
*/

function automaticReceived(holderName,date){

  return getDaily("cash",date).reduce(
    (total,r)=>{

      if(
        normalizeName(r.receivedBy)
        ===
        normalizeName(holderName)
      ){

        return total+num(r.amount);

      }

      return total;

    },
    0
  );

}


/*
  Get all expenses paid by a holder on a particular day.
*/

function automaticExpenses(holderName,date){

  return getDaily("expenses",date).reduce(
    (total,r)=>{

      if(
        normalizeName(r.paidBy)
        ===
        normalizeName(holderName)
      ){

        return total+num(r.amount);

      }

      return total;

    },
    0
  );

}


/* =====================================================
   PREVIOUS DATE
   ===================================================== */

function previousDate(date){

  const d=new Date(date+"T12:00:00");

  d.setDate(d.getDate()-1);

  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");

  return `${y}-${m}-${day}`;

}


/* =====================================================
   CHECK IF A DATE HAS ANY PETTY ACTIVITY
   ===================================================== */

function hasPettyActivity(holder,date){

  const cashReceived=
    automaticReceived(holder,date);

  const expensesPaid=
    automaticExpenses(holder,date);

  return cashReceived!==0 ||
         expensesPaid!==0;

}


/* =====================================================
   FIND PREVIOUS KNOWN PETTY BALANCE
   ===================================================== */

/*
  This is the important part.

  Example:

  21 Aug:
  Opening 20
  Expense 10
  Closing 10

  22 Aug:
  Opening automatically becomes 10.

  22 Aug:
  Expense 5
  Closing becomes 5

  23 Aug:
  Opening automatically becomes 5.
*/

function getOpeningForDate(petty,date){

  const targetDate=date;

  /*
    First look at the holder's original/base opening.
  */

  let balance=num(
    typeof petty.baseOpening!=="undefined"
      ? petty.baseOpening
      : petty.opening
  );


  /*
    We need to calculate all daily movements before
    the selected date.
  */

  const allDates=new Set();

  state.cash.forEach(r=>{
    if(
      r.date &&
      r.date<targetDate &&
      normalizeName(r.receivedBy)
      ===
      normalizeName(petty.holder)
    ){
      allDates.add(r.date);
    }
  });

  state.expenses.forEach(r=>{
    if(
      r.date &&
      r.date<targetDate &&
      normalizeName(r.paidBy)
      ===
      normalizeName(petty.holder)
    ){
      allDates.add(r.date);
    }
  });


  /*
    Sort dates chronologically.
  */

  const dates=[...allDates].sort();


  /*
    Apply every day's movement.
  */

  dates.forEach(date=>{

    const received=
      automaticReceived(
        petty.holder,
        date
      );

    const expenses=
      automaticExpenses(
        petty.holder,
        date
      );

    balance=
      balance
      +received
      -expenses;

  });


  return balance;

}


/* =====================================================
   PETTY FIGURES
   ===================================================== */

function pettyFigures(petty,date=selectedDate()){

  const opening=
    getOpeningForDate(
      petty,
      date
    );


  const autoReceived=
    automaticReceived(
      petty.holder,
      date
    );


  const autoExpenses=
    automaticExpenses(
      petty.holder,
      date
    );


  /*
    Legacy manual values are only used on the original
    saved date, so old data is not lost.

    New petty cash movements should normally come from
    Cash Received and Expenses.
  */

  let manualReceived=0;
  let manualExpenses=0;


  /*
    If this is the first/base date, preserve any old
    manually entered petty cash values.
  */

  const baseDate=state.date;

  if(date===baseDate){

    manualReceived=
      num(petty.received);

    manualExpenses=
      num(petty.expenses);

  }


  const received=
    manualReceived
    +
    autoReceived;


  const expenses=
    manualExpenses
    +
    autoExpenses;


  const closing=
    opening
    +
    received
    -
    expenses;


  return {

    opening,

    manualReceived,

    manualExpenses,

    autoReceived,

    autoExpenses,

    received,

    expenses,

    closing

  };

}


/* =====================================================
   STARTUP
   ===================================================== */

document.addEventListener(
  "DOMContentLoaded",
  ()=>{

    const reportDate=
      document.getElementById("reportDate");


    /*
      Set current saved report date.
    */

    reportDate.value=
      state.date;


    /*
      IMPORTANT:

      Changing the calendar changes the active report date.

      The petty cash opening balance is recalculated
      automatically from previous days.
    */

    reportDate.addEventListener(
      "change",
      e=>{

        state.date=e.target.value;

        save();

      }
    );


    /*
      Remarks.
    */

    document.getElementById(
      "remarksInput"
    ).value=state.remarks;


    document.getElementById(
      "remarksInput"
    ).addEventListener(
      "input",
      e=>{

        state.remarks=
          e.target.value;

        save();

      }
    );


    /*
      Navigation.
    */

    document
      .querySelectorAll(".nav-btn")
      .forEach(b=>

        b.addEventListener(
          "click",
          ()=>{

            document
              .querySelectorAll(".nav-btn")
              .forEach(x=>
                x.classList.remove("active")
              );

            document
              .querySelectorAll(".section")
              .forEach(x=>
                x.classList.remove("active")
              );

            b.classList.add("active");

            document
              .getElementById(
                b.dataset.section
              )
              .classList.add("active");

          }
        )

      );


    /*
      Print options.
    */

    document.getElementById(
      "printOptionsBtn"
    ).onclick=()=>{

      document
        .getElementById("printModal")
        .classList.remove("hidden");

    };


    document.getElementById(
      "printReportBtn"
    ).onclick=()=>{

      printSelected([
        "summary",
        "jobs",
        "cash",
        "expenses",
        "bank",
        "petty",
        "inactive",
        "remarks"
      ]);

    };


    document.getElementById(
      "closeModal"
    ).onclick=()=>{

      document
        .getElementById("printModal")
        .classList.add("hidden");

    };


    document.getElementById(
      "printFull"
    ).onclick=()=>{

      document
        .getElementById("printModal")
        .classList.add("hidden");

      printSelected([
        "summary",
        "jobs",
        "cash",
        "expenses",
        "bank",
        "petty",
        "inactive",
        "remarks"
      ]);

    };


    document.getElementById(
      "printSelected"
    ).onclick=()=>{

      const a=[
        ...document.querySelectorAll(
          ".print-check:checked"
        )
      ].map(x=>x.value);


      document
        .getElementById("printModal")
        .classList.add("hidden");


      printSelected(a);

    };


    renderAll();

  }
);


/* =====================================================
   ADD
   ===================================================== */

function addJob(){

  state.jobs.push({

    date:selectedDate(),

    jobNo:"",
    client:"",
    description:"",
    total:0,
    cash:0,
    incharge:"",
    status:"Pending"

  });

  save();

}


function addCash(){

  state.cash.push({

    date:selectedDate(),

    from:"",
    jobNo:"",
    amount:0,
    receivedBy:""

  });

  save();

}


function addExpense(){

  state.expenses.push({

    date:selectedDate(),

    paidTo:"",
    type:"",
    amount:0,
    paidBy:""

  });

  save();

}


function addBank(){

  state.bank.push({

    date:selectedDate(),

    reference:"",
    from:"",
    amount:0,
    remarks:""

  });

  save();

}


/* =====================================================
   PETTY CASH STATUS
   ===================================================== */

function setPettyStatus(i,status){

  if(!state.petty[i]) return;

  state.petty[i].active=
    status==="active";

  save();

}


/* =====================================================
   UPDATE / DELETE
   ===================================================== */

function updateArray(
  type,
  i,
  key,
  value
){

  if(
    !state[type] ||
    !state[type][i]
  ){
    return;
  }


  state[type][i][key]=value;


  /*
    If a transaction somehow does not have a date,
    attach it to the currently selected dashboard date.
  */

  if(
    ["cash","expenses","jobs","bank"].includes(type)
    &&
    !state[type][i].date
  ){

    state[type][i].date=
      selectedDate();

  }


  save();

}


function del(type,i){

  if(!state[type]) return;

  state[type].splice(i,1);

  save();

}


/* =====================================================
   JOBS
   ===================================================== */

function renderJobs(){

  const el=
    document.getElementById(
      "jobsEditor"
    );


  const daily=
    getDaily("jobs");


  el.innerHTML=`

  <div class="editor-table">

  <table>

  <thead>

  <tr>

    <th>Job No</th>
    <th>Client</th>
    <th>Description</th>
    <th>Total Amount</th>
    <th>Cash</th>
    <th>Incharge</th>
    <th>Status</th>
    <th></th>

  </tr>

  </thead>

  <tbody>

  ${
    daily.map((r)=>{

      const i=
        state.jobs.indexOf(r);

      return `

      <tr>

      <td>
        <input
          value="${esc(r.jobNo)}"
          onchange="
            updateArray(
              'jobs',
              ${i},
              'jobNo',
              this.value
            )
          "
        >
      </td>


      <td>
        <input
          value="${esc(r.client)}"
          onchange="
            updateArray(
              'jobs',
              ${i},
              'client',
              this.value
            )
          "
        >
      </td>


      <td>
        <input
          value="${esc(r.description)}"
          onchange="
            updateArray(
              'jobs',
              ${i},
              'description',
              this.value
            )
          "
        >
      </td>


      <td>
        <input
          type="number"
          step="0.01"
          value="${r.total}"
          onchange="
            updateArray(
              'jobs',
              ${i},
              'total',
              num(this.value)
            )
          "
        >
      </td>


      <td>
        <input
          type="number"
          step="0.01"
          value="${r.cash}"
          onchange="
            updateArray(
              'jobs',
              ${i},
              'cash',
              num(this.value)
            )
          "
        >
      </td>


      <td>
        <input
          value="${esc(r.incharge)}"
          onchange="
            updateArray(
              'jobs',
              ${i},
              'incharge',
              this.value
            )
          "
        >
      </td>


      <td>

        <select
          onchange="
            updateArray(
              'jobs',
              ${i},
              'status',
              this.value
            )
          "
        >

          ${
            [
              "Pending",
              "Partially Received",
              "Received",
              "No Amount"
            ]
            .map(x=>`

              <option
                ${r.status===x?"selected":""}
              >
                ${x}
              </option>

            `).join("")
          }

        </select>

      </td>


      <td>

        <button
          class="delete-btn"
          onclick="
            del('jobs',${i})
          "
        >
          Delete
        </button>

      </td>

      </tr>

      `;

    }).join("")
  }

  ${
    daily.length
      ? ""
      : emptyRow(8)
  }

  </tbody>

  </table>

  </div>

  `;

}


/* =====================================================
   CASH
   ===================================================== */

function renderCash(){

  const daily=
    getDaily("cash");


  document.getElementById(
    "cashEditor"
  ).innerHTML=`

  <div class="editor-table">

  <table>

  <thead>

  <tr>

    <th>From Whom</th>
    <th>Job No</th>
    <th>Cash</th>
    <th>Received By</th>
    <th></th>

  </tr>

  </thead>


  <tbody>

  ${
    daily.map(r=>{

      const i=
        state.cash.indexOf(r);

      return `

      <tr>

      <td>

        <input
          value="${esc(r.from)}"
          onchange="
            updateArray(
              'cash',
              ${i},
              'from',
              this.value
            )
          "
        >

      </td>


      <td>

        <input
          value="${esc(r.jobNo)}"
          onchange="
            updateArray(
              'cash',
              ${i},
              'jobNo',
              this.value
            )
          "
        >

      </td>


      <td>

        <input
          type="number"
          step="0.01"
          value="${r.amount}"
          onchange="
            updateArray(
              'cash',
              ${i},
              'amount',
              num(this.value)
            )
          "
        >

      </td>


      <td>

        <input
          value="${esc(r.receivedBy)}"
          onchange="
            updateArray(
              'cash',
              ${i},
              'receivedBy',
              this.value
            )
          "
        >

      </td>


      <td>

        <button
          class="delete-btn"
          onclick="
            del('cash',${i})
          "
        >
          Delete
        </button>

      </td>

      </tr>

      `;

    }).join("")
  }

  ${
    daily.length
      ? ""
      : emptyRow(5)
  }

  </tbody>

  </table>

  </div>

  `;

}


/* =====================================================
   EXPENSES
   ===================================================== */

function renderExpenses(){

  const daily=
    getDaily("expenses");


  document.getElementById(
    "expenseEditor"
  ).innerHTML=`

  <div class="editor-table">

  <table>

  <thead>

  <tr>

    <th>Paid To</th>
    <th>Expense Type</th>
    <th>Amount</th>
    <th>Paid By</th>
    <th></th>

  </tr>

  </thead>


  <tbody>

  ${
    daily.map(r=>{

      const i=
        state.expenses.indexOf(r);

      return `

      <tr>

      <td>

        <input
          value="${esc(r.paidTo)}"
          onchange="
            updateArray(
              'expenses',
              ${i},
              'paidTo',
              this.value
            )
          "
        >

      </td>


      <td>

        <input
          value="${esc(r.type)}"
          onchange="
            updateArray(
              'expenses',
              ${i},
              'type',
              this.value
            )
          "
        >

      </td>


      <td>

        <input
          type="number"
          step="0.01"
          value="${r.amount}"
          onchange="
            updateArray(
              'expenses',
              ${i},
              'amount',
              num(this.value)
            )
          "
        >

      </td>


      <td>

        <input
          value="${esc(r.paidBy)}"
          onchange="
            updateArray(
              'expenses',
              ${i},
              'paidBy',
              this.value
            )
          "
        >

      </td>


      <td>

        <button
          class="delete-btn"
          onclick="
            del('expenses',${i})
          "
        >
          Delete
        </button>

      </td>

      </tr>

      `;

    }).join("")
  }

  ${
    daily.length
      ? ""
      : emptyRow(5)
  }

  </tbody>

  </table>

  </div>

  `;

}


/* =====================================================
   BANK
   ===================================================== */

function renderBank(){

  const daily=
    getDaily("bank");


  document.getElementById(
    "bankEditor"
  ).innerHTML=`

  <div class="editor-table">

  <table>

  <thead>

  <tr>

    <th>Received On</th>
    <th>Reference</th>
    <th>From Whom</th>
    <th>Amount</th>
    <th>Remarks</th>
    <th></th>

  </tr>

  </thead>


  <tbody>

  ${
    daily.map(r=>{

      const i=
        state.bank.indexOf(r);

      return `

      <tr>

      <td>

        <input
          type="date"
          value="${r.date}"
          onchange="
            updateArray(
              'bank',
              ${i},
              'date',
              this.value
            )
          "
        >

      </td>


      <td>

        <input
          value="${esc(r.reference)}"
          onchange="
            updateArray(
              'bank',
              ${i},
              'reference',
              this.value
            )
          "
        >

      </td>


      <td>

        <input
          value="${esc(r.from)}"
          onchange="
            updateArray(
              'bank',
              ${i},
              'from',
              this.value
            )
          "
        >

      </td>


      <td>

        <input
          type="number"
          step="0.01"
          value="${r.amount}"
          onchange="
            updateArray(
              'bank',
              ${i},
              'amount',
              num(this.value)
            )
          "
        >

      </td>


      <td>

        <input
          value="${esc(r.remarks)}"
          onchange="
            updateArray(
              'bank',
              ${i},
              'remarks',
              this.value
            )
          "
        >

      </td>


      <td>

        <button
          class="delete-btn"
          onclick="
            del('bank',${i})
          "
        >
          Delete
        </button>

      </td>

      </tr>

      `;

    }).join("")
  }

  ${
    daily.length
      ? ""
      : emptyRow(6)
  }

  </tbody>

  </table>

  </div>

  `;

}


/* =====================================================
   PETTY CASH
   ===================================================== */

function renderPetty(){

  const date=
    selectedDate();


  document.getElementById(
    "pettyEditor"
  ).innerHTML=`

  <div class="editor-table">

  <table>

  <thead>

  <tr>

    <th>Holder</th>
    <th>Opening</th>
    <th>Received</th>
    <th>Expenses</th>
    <th>Closing</th>
    <th>Status</th>

  </tr>

  </thead>


  <tbody>

  ${
    state.petty.map((r,i)=>{

      const figures=
        pettyFigures(r,date);


      return `

      <tr>

        <td>
          <b>${esc(r.holder)}</b>
        </td>


        <td>

          <input
            type="number"
            step="0.01"
            value="${figures.opening}"
            ${
              date===state.date
              ? `onchange="
                  updateBaseOpening(
                    ${i},
                    num(this.value)
                  )
                "`
              : "readonly"
            }
            title="${
              date===state.date
                ? "Initial/base opening balance"
                : "Automatically carried forward from previous days"
            }"
          >

        </td>


        <td>

          <input
            type="number"
            step="0.01"
            value="${figures.received}"
            readonly
            title="Automatically includes cash received by this holder"
          >

        </td>


        <td>

          <input
            type="number"
            step="0.01"
            value="${figures.expenses}"
            readonly
            title="Automatically includes expenses paid by this holder"
          >

        </td>


        <td>

          <b>
            ${money(figures.closing)}
          </b>

        </td>


        <td>

          <select
            class="status-select ${
              r.active
                ? "status-active"
                : "status-inactive"
            }"
            onchange="
              setPettyStatus(
                ${i},
                this.value
              )
            "
          >

            <option
              value="active"
              ${r.active?"selected":""}
            >
              Active
            </option>

            <option
              value="inactive"
              ${!r.active?"selected":""}
            >
              Inactive
            </option>

          </select>

        </td>

      </tr>

      `;

    }).join("")
  }

  </tbody>

  </table>

  </div>

  `;

}


/* =====================================================
   UPDATE BASE OPENING
   ===================================================== */

function updateBaseOpening(i,value){

  if(!state.petty[i]) return;

  state.petty[i].baseOpening=
    num(value);

  /*
    Keep old opening field synchronized for compatibility.
  */

  state.petty[i].opening=
    num(value);

  save();

}


/* =====================================================
   GENERIC PREVIEW ROWS
   ===================================================== */

function rowsDaily(
  type,
  fn,
  cols
){

  const daily=
    getDaily(type);


  return daily.length
    ? daily.map(fn).join("")
    : emptyRow(cols);

}


/* =====================================================
   REPORT PREVIEW
   ===================================================== */

function renderPreview(){

  const date=
    selectedDate();


  /*
    Only transactions belonging to the selected date
    are included in the report.
  */

  const dailyCash=
    getDaily("cash");

  const dailyBank=
    getDaily("bank");

  const dailyExpenses=
    getDaily("expenses");


  const cashTotal=
    dailyCash.reduce(
      (a,r)=>a+num(r.amount),
      0
    );


  const bankTotal=
    dailyBank.reduce(
      (a,r)=>a+num(r.amount),
      0
    );


  const expenseTotal=
    dailyExpenses.reduce(
      (a,r)=>a+num(r.amount),
      0
    );


  const pettyTotal=
    state.petty
      .filter(r=>r.active)
      .reduce(
        (a,r)=>
          a+pettyFigures(r,date).closing,
        0
      );


  /*
    Dashboard totals.
  */

  document.getElementById(
    "sumCash"
  ).textContent=
    money(cashTotal);


  document.getElementById(
    "sumBank"
  ).textContent=
    money(bankTotal);


  document.getElementById(
    "sumExpenses"
  ).textContent=
    money(expenseTotal);


  document.getElementById(
    "sumPetty"
  ).textContent=
    money(pettyTotal);


  document.getElementById(
    "paperCash"
  ).textContent=
    money(cashTotal)
      .replace("AED ","");


  document.getElementById(
    "paperBank"
  ).textContent=
    money(bankTotal)
      .replace("AED ","");


  document.getElementById(
    "paperExpenses"
  ).textContent=
    money(expenseTotal)
      .replace("AED ","");


  document.getElementById(
    "paperPetty"
  ).textContent=
    money(pettyTotal)
      .replace("AED ","");


  /* =================================================
     JOBS
     ================================================= */

  document.querySelector(
    "#jobsPreview tbody"
  ).innerHTML=

    rowsDaily(
      "jobs",
      r=>`

        <tr>

          <td>${esc(r.jobNo)}</td>

          <td>${esc(r.client)}</td>

          <td>${esc(r.description)}</td>

          <td class="num">
            ${num(r.total).toFixed(2)}
          </td>

          <td class="num">
            ${num(r.cash).toFixed(2)}
          </td>

          <td>${esc(r.incharge)}</td>

          <td>${esc(r.status)}</td>

        </tr>

      `,
      7
    );


  /* =================================================
     CASH
     ================================================= */

  document.querySelector(
    "#cashPreview tbody"
  ).innerHTML=

    rowsDaily(
      "cash",
      r=>`

        <tr>

          <td>${esc(r.from)}</td>

          <td>${esc(r.jobNo)}</td>

          <td class="num">
            ${num(r.amount).toFixed(2)}
          </td>

          <td>${esc(r.receivedBy)}</td>

        </tr>

      `,
      4
    );


  /* =================================================
     EXPENSES
     ================================================= */

  document.querySelector(
    "#expensePreview tbody"
  ).innerHTML=

    rowsDaily(
      "expenses",
      r=>`

        <tr>

          <td>${esc(r.paidTo)}</td>

          <td>${esc(r.type)}</td>

          <td class="num">
            ${num(r.amount).toFixed(2)}
          </td>

          <td>${esc(r.paidBy)}</td>

        </tr>

      `,
      4
    );


  /* =================================================
     BANK
     ================================================= */

  document.querySelector(
    "#bankPreview tbody"
  ).innerHTML=

    rowsDaily(
      "bank",
      r=>`

        <tr>

          <td>${formatDate(r.date)}</td>

          <td>${esc(r.reference)}</td>

          <td>${esc(r.from)}</td>

          <td class="num">
            ${num(r.amount).toFixed(2)}
          </td>

          <td>${esc(r.remarks)}</td>

        </tr>

      `,
      5
    );


  /* =================================================
     PETTY CASH
     ================================================= */

  const active=
    state.petty.filter(
      r=>r.active
    );


  const inactive=
    state.petty.filter(
      r=>!r.active
    );


  const pettyRows=r=>{

    const figures=
      pettyFigures(
        r,
        date
      );


    return `

      <tr>

        <td>
          ${esc(r.holder)}
        </td>

        <td class="num">
          ${figures.opening.toFixed(2)}
        </td>

        <td class="num">
          ${figures.received.toFixed(2)}
        </td>

        <td class="num">
          ${figures.expenses.toFixed(2)}
        </td>

        <td class="num">
          ${figures.closing.toFixed(2)}
        </td>

      </tr>

    `;

  };


  document.querySelector(
    "#pettyPreview tbody"
  ).innerHTML=

    active.length
      ? active.map(pettyRows).join("")
      : emptyRow(5);


  document.querySelector(
    "#inactivePreview tbody"
  ).innerHTML=

    inactive.length
      ? inactive.map(pettyRows).join("")
      : emptyRow(5);


  document.getElementById(
    "remarksPreview"
  ).textContent=
    state.remarks||"";

}


/* =====================================================
   RENDER ALL
   ===================================================== */

function renderAll(){

  renderJobs();

  renderCash();

  renderExpenses();

  renderBank();

  renderPetty();

  renderPreview();


  document.getElementById(
    "reportDate"
  ).value=
    state.date;


  document.getElementById(
    "remarksInput"
  ).value=
    state.remarks;

}


/* =====================================================
   PRINT
   ===================================================== */

function printSelected(sections){

  /*
    Make absolutely sure the printed report uses the
    date currently selected in the Dashboard calendar.
  */

  const date=
    selectedDate();


  state.date=date;


  renderPreview();


  const all=[

    "summary",
    "jobs",
    "cash",
    "expenses",
    "bank",
    "petty",
    "inactive",
    "remarks"

  ];


  const map={

    summary:".mini-summary",

    jobs:".report-block:nth-of-type(1)",

    cash:".report-block:nth-of-type(2)",

    expenses:".report-block:nth-of-type(3)",

    bank:".report-block:nth-of-type(4)",

    petty:".report-block:nth-of-type(5)",

    inactive:".report-block:nth-of-type(6)",

    remarks:".report-block:nth-of-type(7)"

  };


  /*
    Add selected date to report heading.
  */

  const reportTitle=
    document.querySelector(
      ".report-title"
    );


  const originalTitle=
    reportTitle
      ? reportTitle.innerHTML
      : "";


  if(reportTitle){

    reportTitle.innerHTML=
      `SUMMARY DASHBOARD
       <span class="print-report-date">
         — ${formatDate(date)}
       </span>`;

  }


  /*
    Hide sections not selected.
  */

  all.forEach(s=>{

    const el=
      document.querySelector(
        map[s]
      );


    if(el){

      el.classList.toggle(
        "hidden-print",
        !sections.includes(s)
      );

    }

  });


  /*
    Print.
  */

  window.print();


  /*
    Restore normal screen after printing.
  */

  setTimeout(()=>{

    all.forEach(s=>{

      const el=
        document.querySelector(
          map[s]
        );


      if(el){

        el.classList.remove(
          "hidden-print"
        );

      }

    });


    if(reportTitle){

      reportTitle.innerHTML=
        originalTitle;

    }

  },500);

}

