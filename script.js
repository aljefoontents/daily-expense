const KEY="alJefoonDailyExpenseReportV1";

/* =====================================================
   GOOGLE SHEETS BACKUP
   =====================================================

   Replace the URL below with your deployed
   Google Apps Script Web App URL.

   Example:
   https://script.google.com/macros/s/XXXXXXXXXXXX/exec

   ===================================================== */

const GOOGLE_SHEETS_BACKUP_URL =
  "https://script.google.com/macros/s/AKfycbxIbk9ltodS6rKoYiVu7INA7kE05mEA5vDW4Lm8FMM5fl4fLeOKHja8fPeAiIVyP-zHpA/exec";


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

  const m=
    String(d.getMonth()+1)
      .padStart(2,"0");

  const day=
    String(d.getDate())
      .padStart(2,"0");

  return `${y}-${m}-${day}`;

}


function formatDate(date){

  if(!date) return "";

  const parts=
    String(date).split("-");

  if(parts.length!==3)
    return date;

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

      baseOpening:0,

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

    const saved=
      JSON.parse(
        localStorage.getItem(KEY)
      );

    const base=
      defaultState();

    if(!saved)
      return base;


    saved.cash=
      Array.isArray(saved.cash)
        ? saved.cash
        : [];


    saved.expenses=
      Array.isArray(saved.expenses)
        ? saved.expenses
        : [];


    saved.jobs=
      Array.isArray(saved.jobs)
        ? saved.jobs
        : [];


    saved.bank=
      Array.isArray(saved.bank)
        ? saved.bank
        : [];


    saved.petty=
      Array.isArray(saved.petty)
        ? saved.petty
        : base.petty;


    saved.date=
      saved.date ||
      base.date;


    saved.remarks=
      saved.remarks ||
      "";


    /* =================================================
       MIGRATE OLD PETTY CASH DATA
       ================================================= */

    saved.petty.forEach(p=>{

      if(
        typeof p.baseOpening===
        "undefined"
      ){

        p.baseOpening=
          num(
            typeof p.opening!=="undefined"
              ? p.opening
              : 0
          );

      }


      if(
        typeof p.opening===
        "undefined"
      ){

        p.opening=
          p.baseOpening;

      }


      if(
        typeof p.received===
        "undefined"
      ){

        p.received=0;

      }


      if(
        typeof p.expenses===
        "undefined"
      ){

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

      const exists=
        saved.petty.some(
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
      Old transactions without dates
      are assigned to the saved report date.
    */

    saved.cash.forEach(r=>{

      if(!r.date){

        r.date=
          saved.date;

      }

    });


    saved.expenses.forEach(r=>{

      if(!r.date){

        r.date=
          saved.date;

      }

    });


    saved.jobs.forEach(r=>{

      if(!r.date){

        r.date=
          saved.date;

      }

    });


    saved.bank.forEach(r=>{

      if(!r.date){

        r.date=
          saved.date;

      }

    });


    return saved;


  }catch(e){

    console.error(
      "Load error:",
      e
    );

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

  return "AED "+
    Number(n||0).toLocaleString(
      "en-AE",
      {

        minimumFractionDigits:2,

        maximumFractionDigits:2

      }
    );

}


function num(v){

  const n=
    Number(v);

  return Number.isFinite(n)
    ? n
    : 0;

}


function emptyRow(
  cols,
  msg="No entries"
){

  return `

    <tr>

      <td
        colspan="${cols}"
        style="text-align:center;color:#777"
      >

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

  return String(a||"")===
         String(b||"");

}


/* =====================================================
   SELECTED DATE
   ===================================================== */

function selectedDate(){

  const input=
    document.getElementById(
      "reportDate"
    );


  if(
    input &&
    input.value
  ){

    return input.value;

  }


  return state.date ||
         todayString();

}


/* =====================================================
   FILTER TRANSACTIONS BY REPORT DATE
   ===================================================== */

function getDaily(
  type,
  date=selectedDate()
){

  return (
    state[type]||[]
  ).filter(
    r=>
      sameDate(
        r.date,
        date
      )
  );

}


/* =====================================================
   PETTY CASH
   ===================================================== */

function findPettyHolder(name){

  const target=
    normalizeName(name);


  if(!target)
    return null;


  return state.petty.find(
    p=>
      normalizeName(p.holder)===
      target
  )||null;

}


/* =====================================================
   AUTOMATIC RECEIVED
   ===================================================== */

function automaticReceived(
  holderName,
  date
){

  return getDaily(
    "cash",
    date
  ).reduce(

    (total,r)=>{

      if(
        normalizeName(
          r.receivedBy
        )===
        normalizeName(
          holderName
        )
      ){

        return total+
               num(r.amount);

      }

      return total;

    },

    0

  );

}


/* =====================================================
   AUTOMATIC CASH GIVEN / TRANSFERRED OUT
   ===================================================== */

function automaticCashGiven(
  holderName,
  date
){

  return getDaily(
    "cash",
    date
  ).reduce(

    (total,r)=>{

      /*
        If this holder is the person FROM whom
        the cash was received, the amount must be
        deducted from this holder's petty cash.
      */

      if(
        normalizeName(
          r.from
        )===
        normalizeName(
          holderName
        )
      ){

        return total+
               num(r.amount);

      }

      return total;

    },

    0

  );

}


/* =====================================================
   AUTOMATIC EXPENSES
   ===================================================== */

function automaticExpenses(
  holderName,
  date
){

  return getDaily(
    "expenses",
    date
  ).reduce(

    (total,r)=>{

      if(
        normalizeName(
          r.paidBy
        )===
        normalizeName(
          holderName
        )
      ){

        return total+
               num(r.amount);

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

  const d=
    new Date(
      date+"T12:00:00"
    );


  d.setDate(
    d.getDate()-1
  );


  const y=
    d.getFullYear();


  const m=
    String(
      d.getMonth()+1
    ).padStart(2,"0");


  const day=
    String(
      d.getDate()
    ).padStart(2,"0");


  return `${y}-${m}-${day}`;

}


/* =====================================================
   CHECK PETTY ACTIVITY
   ===================================================== */

function hasPettyActivity(
  holder,
  date
){

  const cashReceived=
    automaticReceived(
      holder,
      date
    );


  const cashGiven=
    automaticCashGiven(
      holder,
      date
    );


  const expensesPaid=
    automaticExpenses(
      holder,
      date
    );


  return cashReceived!==0 ||
         cashGiven!==0 ||
         expensesPaid!==0;

}


/* =====================================================
   FIND PREVIOUS KNOWN PETTY BALANCE
   ===================================================== */

function getOpeningForDate(
  petty,
  date
){

  const holderName =
    normalizeName(petty.holder);

  /*
    Start from the holder's original/base opening balance.
  */

  let balance =
    num(
      typeof petty.baseOpening !== "undefined"
        ? petty.baseOpening
        : petty.opening
    );


  /*
    Collect every date before the selected date
    where this holder had petty-cash activity.
  */

  const allDates = new Set();


  state.cash.forEach(r => {

    if(!r.date)
      return;


    if(String(r.date) >= String(date))
      return;


    const receivedBy =
      normalizeName(r.receivedBy);

    const from =
      normalizeName(r.from);


    if(
      receivedBy === holderName ||
      from === holderName
    ){

      allDates.add(
        String(r.date)
      );

    }

  });


  state.expenses.forEach(r => {

    if(!r.date)
      return;


    if(String(r.date) >= String(date))
      return;


    if(
      normalizeName(r.paidBy) === holderName
    ){

      allDates.add(
        String(r.date)
      );

    }

  });


  /*
    Process previous dates in chronological order.
  */

  const dates =
    [...allDates].sort();


  dates.forEach(previousDay => {

    const received =
      automaticReceived(
        petty.holder,
        previousDay
      );


    const cashGiven =
      automaticCashGiven(
        petty.holder,
        previousDay
      );


    const expenses =
      automaticExpenses(
        petty.holder,
        previousDay
      );


    balance =
      balance +
      received -
      cashGiven -
      expenses;

  });


  return balance;

}


/* =====================================================
   PETTY FIGURES
   ===================================================== */

function pettyFigures(
  petty,
  date=selectedDate()
){

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


  const autoCashGiven=
    automaticCashGiven(
      petty.holder,
      date
    );


  const autoExpenses=
    automaticExpenses(
      petty.holder,
      date
    );


  let manualReceived=0;

  let manualExpenses=0;


  const baseDate=
    state.date;


  if(
    date===baseDate
  ){

    manualReceived=
      num(
        petty.received
      );


    manualExpenses=
      num(
        petty.expenses
      );

  }


  const received=
    manualReceived+
    autoReceived;


  const expenses=
    manualExpenses+
    autoExpenses;


  /*
    Closing balance now correctly accounts for
    cash transferred from this holder to another holder.

    Example:

    Fahad gives Saud AED 70

    Fahad:
      Opening 100
      Received 0
      Cash Given 70
      Expenses 0
      Closing 30

    Saud:
      Opening 100
      Received 70
      Cash Given 0
      Expenses 0
      Closing 170
  */

  const closing=
    opening+
    received-
    autoCashGiven-
    expenses;


  return {

    opening,

    manualReceived,

    manualExpenses,

    autoReceived,

    autoCashGiven,

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
      document.getElementById(
        "reportDate"
      );


    /*
      IMPORTANT:
      The app opens using the CURRENT DATE
      if no previous date has been selected.
    */

    if(
      !state.date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(
        state.date
      )
    ){

      state.date=
        todayString();

    }


    reportDate.value=
      state.date;


    reportDate.addEventListener(
      "change",
      e=>{

        state.date=
          e.target.value;

        save();

      }
    );


    /*
      Remarks.
    */

    document.getElementById(
      "remarksInput"
    ).value=
      state.remarks;


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
              .querySelectorAll(
                ".nav-btn"
              )
              .forEach(x=>
                x.classList.remove(
                  "active"
                )
              );


            document
              .querySelectorAll(
                ".section"
              )
              .forEach(x=>
                x.classList.remove(
                  "active"
                )
              );


            b.classList.add(
              "active"
            );


            document
              .getElementById(
                b.dataset.section
              )
              .classList.add(
                "active"
              );

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
        .getElementById(
          "printModal"
        )
        .classList.remove(
          "hidden"
        );

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
        .getElementById(
          "printModal"
        )
        .classList.add(
          "hidden"
        );

    };


    document.getElementById(
      "printFull"
    ).onclick=()=>{

      document
        .getElementById(
          "printModal"
        )
        .classList.add(
          "hidden"
        );


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

      ].map(
        x=>x.value
      );


      document
        .getElementById(
          "printModal"
        )
        .classList.add(
          "hidden"
        );


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

function setPettyStatus(
  i,
  status
){

  if(!state.petty[i])
    return;


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


  state[type][i][key]=
    value;


  if(

    [
      "cash",
      "expenses",
      "jobs",
      "bank"
    ].includes(type)

    &&

    !state[type][i].date

  ){

    state[type][i].date=
      selectedDate();

  }


  save();

}


function del(
  type,
  i
){

  if(!state[type])
    return;


  state[type].splice(
    i,
    1
  );


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
    daily.map(r=>{

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
            del(
              'jobs',
              ${i}
            )
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
            del(
              'cash',
              ${i}
            )
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
            del(
              'expenses',
              ${i}
            )
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
            del(
              'bank',
              ${i}
            )
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
        pettyFigures(
          r,
          date
        );


      return `

      <tr>

        <td>

          <b>
            ${esc(r.holder)}
          </b>

        </td>


        <td>

          <input
            type="number"
            step="0.01"
            value="${figures.opening}"

            ${
              date===state.date

              ?

              `onchange="
                updateBaseOpening(
                  ${i},
                  num(this.value)
                )
              "`

              :

              "readonly"

            }

            title="${
              date===state.date

              ?

              "Initial/base opening balance"

              :

              "Automatically carried forward from previous days"

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

function updateBaseOpening(
  i,
  value
){

  if(!state.petty[i])
    return;


  state.petty[i].baseOpening=
    num(value);


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

    ?

    daily.map(fn).join("")

    :

    emptyRow(cols);

}


/* =====================================================
   REPORT PREVIEW
   ===================================================== */

function renderPreview(){

  const date=
    selectedDate();


  const dailyCash=
    getDaily("cash");


  const dailyBank=
    getDaily("bank");


  const dailyExpenses=
    getDaily("expenses");


  const cashTotal=
    dailyCash.reduce(
      (a,r)=>
        a+num(r.amount),
      0
    );


  const bankTotal=
    dailyBank.reduce(
      (a,r)=>
        a+num(r.amount),
      0
    );


  const expenseTotal=
    dailyExpenses.reduce(
      (a,r)=>
        a+num(r.amount),
      0
    );


  const pettyTotal=
    state.petty
      .filter(r=>r.active)
      .reduce(
        (a,r)=>
          a+
          pettyFigures(
            r,
            date
          ).closing,
        0
      );


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
      .replace(
        "AED ",
        ""
      );


  document.getElementById(
    "paperBank"
  ).textContent=
    money(bankTotal)
      .replace(
        "AED ",
        ""
      );


  document.getElementById(
    "paperExpenses"
  ).textContent=
    money(expenseTotal)
      .replace(
        "AED ",
        ""
      );


  document.getElementById(
    "paperPetty"
  ).textContent=
    money(pettyTotal)
      .replace(
        "AED ",
        ""
      );


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

          <td>
            ${esc(r.jobNo)}
          </td>

          <td>
            ${esc(r.client)}
          </td>

          <td>
            ${esc(r.description)}
          </td>

          <td class="num">
            ${num(r.total).toFixed(2)}
          </td>

          <td class="num">
            ${num(r.cash).toFixed(2)}
          </td>

          <td>
            ${esc(r.incharge)}
          </td>

          <td>
            ${esc(r.status)}
          </td>

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

          <td>
            ${esc(r.from)}
          </td>

          <td>
            ${esc(r.jobNo)}
          </td>

          <td class="num">
            ${num(r.amount).toFixed(2)}
          </td>

          <td>
            ${esc(r.receivedBy)}
          </td>

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

          <td>
            ${esc(r.paidTo)}
          </td>

          <td>
            ${esc(r.type)}
          </td>

          <td class="num">
            ${num(r.amount).toFixed(2)}
          </td>

          <td>
            ${esc(r.paidBy)}
          </td>

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

          <td>
            ${formatDate(r.date)}
          </td>

          <td>
            ${esc(r.reference)}
          </td>

          <td>
            ${esc(r.from)}
          </td>

          <td class="num">
            ${num(r.amount).toFixed(2)}
          </td>

          <td>
            ${esc(r.remarks)}
          </td>

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

      ?

      active
        .map(pettyRows)
        .join("")

      :

      emptyRow(5);


  document.querySelector(
    "#inactivePreview tbody"
  ).innerHTML=

    inactive.length

      ?

      inactive
        .map(pettyRows)
        .join("")

      :

      emptyRow(5);


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


  const reportDate=
    document.getElementById(
      "reportDate"
    );


  if(reportDate){

    reportDate.value=
      state.date;

  }


  const remarks=
    document.getElementById(
      "remarksInput"
    );


  if(remarks){

    remarks.value=
      state.remarks;

  }

}


/* =====================================================
   GOOGLE SHEETS BACKUP
   ===================================================== */

/*
   This function sends the COMPLETE current state
   to Google Apps Script.

   It uses the currently selected report date.

   IMPORTANT:
   The Google Apps Script must be deployed as:

   Execute as: Me
   Who has access: Anyone

*/

async function backupToGoogleSheets(){

  const date=
    selectedDate();


  if(
    !GOOGLE_SHEETS_BACKUP_URL ||
    GOOGLE_SHEETS_BACKUP_URL.includes(
      "PASTE_YOUR_GOOGLE_APPS_SCRIPT"
    )
  ){

    alert(
      "Please add your Google Apps Script Web App URL first."
    );

    return;

  }


  /*
    Make sure the selected date is saved.
  */

  state.date=
    date;


  save();


  /*
    Create a clean copy of the data.

    We do not send functions or DOM elements.
  */

  const backupData={

    date:date,

    reportDate:date,

    jobs:Array.isArray(state.jobs)
      ? state.jobs
      : [],

    cash:Array.isArray(state.cash)
      ? state.cash
      : [],

    expenses:Array.isArray(state.expenses)
      ? state.expenses
      : [],

    bank:Array.isArray(state.bank)
      ? state.bank
      : [],

    petty:Array.isArray(state.petty)
      ? state.petty.map(p=>{

          const figures=
            pettyFigures(
              p,
              date
            );


          return {

            holder:p.holder,

            opening:figures.opening,

            received:figures.received,

            expenses:figures.expenses,

            closing:figures.closing,

            active:Boolean(
              p.active
            ),

            date:date

          };

        })

      : [],

    remarks:
      state.remarks||""

  };


  /*
    Show backup message.
  */

  showBackupStatus(
    "Backing up..."
  );


  try{

    const response=
      await fetch(
        GOOGLE_SHEETS_BACKUP_URL,
        {

          method:"POST",

          headers:{
            "Content-Type":
              "text/plain;charset=utf-8"
          },

          body:
            JSON.stringify(
              backupData
            )

        }
      );


    const result=
      await response.json();


    if(
      result &&
      result.success
    ){

      showBackupStatus(
        "Backup completed successfully."
      );


      alert(
        "Daily Expense Report for " +
        formatDate(date) +
        " has been backed up to Google Sheets."
      );


    }else{

      throw new Error(
        result &&
        result.message

          ?

        result.message

          :

        "Google Apps Script returned an error."
      );

    }


  }catch(error){

    console.error(
      "Google Sheets backup error:",
      error
    );


    showBackupStatus(
      "Backup failed."
    );


    alert(
      "Google Sheets backup failed.\n\n" +
      "Please check your Google Apps Script Web App URL and deployment settings."
    );

  }

}


/* =====================================================
   BACKUP STATUS
   ===================================================== */

function showBackupStatus(
  message
){

  let status=
    document.getElementById(
      "googleBackupStatus"
    );


  /*
    If the status element does not exist in HTML,
    create it automatically.
  */

  if(!status){

    status=
      document.createElement(
        "div"
      );


    status.id=
      "googleBackupStatus";


    status.style.position=
      "fixed";


    status.style.bottom=
      "20px";


    status.style.right=
      "20px";


    status.style.zIndex=
      "99999";


    status.style.padding=
      "12px 18px";


    status.style.background=
      "#000";


    status.style.color=
      "#fff";


    status.style.borderRadius=
      "6px";


    status.style.fontFamily=
      "Arial, sans-serif";


    status.style.fontSize=
      "14px";


    status.style.boxShadow=
      "0 3px 12px rgba(0,0,0,.25)";


    document.body.appendChild(
      status
    );

  }


  status.textContent=
    message;


  status.style.display=
    "block";


  clearTimeout(
    status._hideTimer
  );


  status._hideTimer=
    setTimeout(
      ()=>{

        status.style.display=
          "none";

      },
      5000
    );

}


/* =====================================================
   PRINT
   ===================================================== */

function printSelected(
  sections
){

  /*
    Make absolutely sure the printed report uses
    the currently selected dashboard date.
  */

  const date=
    selectedDate();


  state.date=
    date;


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

    summary:
      ".mini-summary",

    jobs:
      ".report-block:nth-of-type(1)",

    cash:
      ".report-block:nth-of-type(2)",

    expenses:
      ".report-block:nth-of-type(3)",

    bank:
      ".report-block:nth-of-type(4)",

    petty:
      ".report-block:nth-of-type(5)",

    inactive:
      ".report-block:nth-of-type(6)",

    remarks:
      ".report-block:nth-of-type(7)"

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
    Restore screen after printing.
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
