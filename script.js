/* =====================================================
   AL JEFOON TENTS
   DAILY EXPENSE REPORT
   SCRIPT.JS
   VERSION 3.0

   FEATURES
   -----------------------------------------------------
   - Date-based daily records
   - Selected dashboard date controls the report
   - Automatic petty cash opening carry-forward
   - Previous day's closing becomes next day's opening
   - Negative amounts allowed
   - Cash received automatically affects petty cash
   - Expenses automatically affect petty cash
   - Date-specific remarks
   - Selected-date printing
   - Existing data migration
   ===================================================== */


const KEY = "alJefoonDailyExpenseReportV1";


/* =====================================================
   PETTY CASH HOLDERS
   ===================================================== */

const holders = [
  {name:"Ali",active:true},
  {name:"Saud",active:true},
  {name:"Zohaib",active:true},
  {name:"Fahad",active:true},
  {name:"Ihsan",active:true},
  {name:"Parvaiz",active:false},
  {name:"Malik",active:false}
];


/* =====================================================
   DATE HELPERS
   ===================================================== */

/*
  Get today's date without UTC conversion problems.

  Using toISOString() can sometimes show the wrong day
  depending on timezone. This function uses local time.
*/
function todayLocal(){

  const d = new Date();

  const year = d.getFullYear();
  const month = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");

  return `${year}-${month}-${day}`;
}


/*
  Format YYYY-MM-DD as DD/MM/YYYY.
*/
function formatDate(date){

  if(!date) return "";

  const parts = String(date).split("-");

  if(parts.length !== 3){
    return date;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}


/*
  Get the previous calendar date.
*/
function previousDate(date){

  if(!date) return "";

  const parts = date.split("-");

  if(parts.length !== 3) return "";

  const d = new Date(
    Number(parts[0]),
    Number(parts[1])-1,
    Number(parts[2])
  );

  d.setDate(d.getDate()-1);

  const year = d.getFullYear();
  const month = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");

  return `${year}-${month}-${day}`;
}


/*
  Get all dates between two dates if needed.
*/
function compareDates(a,b){

  if(a < b) return -1;
  if(a > b) return 1;

  return 0;
}


/* =====================================================
   DEFAULT STATE
   ===================================================== */

function defaultState(){

  const date = todayLocal();

  return {

    date:date,

    jobs:[],

    cash:[],

    expenses:[],

    bank:[],

    /*
      Petty cash is now stored by DATE.

      Example:

      pettyDaily: {
        "2026-08-21": [
          { holder:"Ali", opening:100, ... }
        ],

        "2026-08-22": [
          { holder:"Ali", opening:75, ... }
        ]
      }
    */
    pettyDaily:{},

    /*
      Remarks are also stored by date.
    */
    remarksByDate:{}

  };
}


/* =====================================================
   MIGRATION / LOAD
   ===================================================== */

function load(){

  try{

    const saved = JSON.parse(
      localStorage.getItem(KEY)
    );

    const base = defaultState();

    if(!saved){
      return base;
    }


    /*
      ---------------------------------------------------
      DATE
      ---------------------------------------------------
    */

    saved.date = saved.date || base.date;


    /*
      ---------------------------------------------------
      BASIC ARRAYS
      ---------------------------------------------------
    */

    saved.jobs =
      Array.isArray(saved.jobs)
        ? saved.jobs
        : [];

    saved.cash =
      Array.isArray(saved.cash)
        ? saved.cash
        : [];

    saved.expenses =
      Array.isArray(saved.expenses)
        ? saved.expenses
        : [];

    saved.bank =
      Array.isArray(saved.bank)
        ? saved.bank
        : [];


    /*
      ---------------------------------------------------
      MIGRATE OLD TRANSACTIONS
      ---------------------------------------------------

      Old version did not store a date on jobs/cash/
      expenses.

      We assign those old records to the saved report
      date so they are not lost.
    */

    saved.jobs.forEach(r=>{
      if(!r.date){
        r.date = saved.date;
      }
    });

    saved.cash.forEach(r=>{
      if(!r.date){
        r.date = saved.date;
      }
    });

    saved.expenses.forEach(r=>{
      if(!r.date){
        r.date = saved.date;
      }
    });

    saved.bank.forEach(r=>{
      if(!r.date){
        r.date = saved.date;
      }
    });


    /*
      ---------------------------------------------------
      MIGRATE PETTY CASH
      ---------------------------------------------------

      Old version used:

      saved.petty = [
        {
          holder:"Ali",
          opening:0,
          received:0,
          expenses:0,
          active:true
        }
      ]

      New version uses:

      pettyDaily = {
        "YYYY-MM-DD":[...]
      }
    */

    if(!saved.pettyDaily){

      saved.pettyDaily = {};

      if(Array.isArray(saved.petty)){

        saved.pettyDaily[saved.date] =
          saved.petty.map(p=>({

            holder:p.holder,

            opening:num(p.opening),

            /*
              These fields are retained for compatibility.
              Automatic calculations are handled separately.
            */
            received:num(p.received),

            expenses:num(p.expenses),

            active:
              typeof p.active === "boolean"
                ? p.active
                : true

          }));

      }

    }


    /*
      Make sure pettyDaily is an object.
    */
    if(
      typeof saved.pettyDaily !== "object" ||
      Array.isArray(saved.pettyDaily)
    ){

      saved.pettyDaily = {};

    }


    /*
      Make sure all existing petty cash dates contain
      all current holders.
    */
    Object.keys(saved.pettyDaily).forEach(date=>{

      if(!Array.isArray(saved.pettyDaily[date])){
        saved.pettyDaily[date] = [];
      }

      holders.forEach(h=>{

        const exists =
          saved.pettyDaily[date].some(
            p =>
              normalizeName(p.holder) ===
              normalizeName(h.name)
          );

        if(!exists){

          saved.pettyDaily[date].push({

            holder:h.name,

            opening:0,

            received:0,

            expenses:0,

            active:h.active

          });

        }

      });

    });


    /*
      ---------------------------------------------------
      REMARKS MIGRATION
      ---------------------------------------------------
    */

    if(!saved.remarksByDate){

      saved.remarksByDate = {};

      if(saved.remarks){

        saved.remarksByDate[saved.date] =
          saved.remarks;

      }

    }

    if(
      typeof saved.remarksByDate !== "object" ||
      Array.isArray(saved.remarksByDate)
    ){

      saved.remarksByDate = {};

    }


    /*
      Return the migrated state.
    */

    return saved;

  }catch(e){

    console.error(
      "Error loading saved data:",
      e
    );

    return defaultState();

  }

}


/* =====================================================
   GLOBAL STATE
   ===================================================== */

let state = load();


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
   ESCAPE HTML
   ===================================================== */

function esc(v){

  return String(v ?? "")
    .replace(/[&<>"']/g,m=>({

      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#039;"

    }[m]));

}


/* =====================================================
   MONEY
   ===================================================== */

function money(n){

  return "AED " +
    Number(n || 0).toLocaleString(
      "en-AE",
      {
        minimumFractionDigits:2,
        maximumFractionDigits:2
      }
    );

}


/* =====================================================
   NUMBER
   ===================================================== */

/*
  IMPORTANT:

  Number("-27") returns -27.

  The previous code already allowed negative values
  mathematically. This version explicitly preserves
  negative numbers as well.
*/

function num(v){

  if(v === "" || v === null || v === undefined){
    return 0;
  }

  const n = Number(v);

  return Number.isFinite(n)
    ? n
    : 0;

}


/* =====================================================
   EMPTY ROW
   ===================================================== */

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


/* =====================================================
   NORMALIZE NAME
   ===================================================== */

function normalizeName(value){

  return String(value || "")
    .trim()
    .toLowerCase();

}


/* =====================================================
   GET SELECTED DATE
   ===================================================== */

function selectedDate(){

  const input =
    document.getElementById("reportDate");

  if(input && input.value){

    return input.value;

  }

  return state.date;

}


/* =====================================================
   DATE FILTER
   ===================================================== */

function filterByDate(array,date){

  if(!Array.isArray(array)){
    return [];
  }

  return array.filter(
    r => String(r.date || "") === String(date)
  );

}


/* =====================================================
   CURRENT DATE DATA
   ===================================================== */

function currentJobs(){

  return filterByDate(
    state.jobs,
    selectedDate()
  );

}


function currentCash(){

  return filterByDate(
    state.cash,
    selectedDate()
  );

}


function currentExpenses(){

  return filterByDate(
    state.expenses,
    selectedDate()
  );

}


function currentBank(){

  return filterByDate(
    state.bank,
    selectedDate()
  );

}


/* =====================================================
   PETTY CASH DAILY RECORDS
   ===================================================== */

function ensurePettyDate(date){

  if(!date){
    return;
  }

  if(!state.pettyDaily[date]){

    state.pettyDaily[date] = [];

  }


  holders.forEach(h=>{

    const exists =
      state.pettyDaily[date].some(
        p =>
          normalizeName(p.holder) ===
          normalizeName(h.name)
      );

    if(!exists){

      state.pettyDaily[date].push({

        holder:h.name,

        opening:0,

        received:0,

        expenses:0,

        active:h.active

      });

    }

  });

}


/* =====================================================
   FIND PETTY RECORD
   ===================================================== */

function findPettyHolder(
  name,
  date=selectedDate()
){

  ensurePettyDate(date);

  const target =
    normalizeName(name);

  return state.pettyDaily[date]
    .find(
      p =>
        normalizeName(p.holder) ===
        target
    ) || null;

}


/* =====================================================
   PREVIOUS DAY PETTY RECORD
   ===================================================== */

function getPreviousPettyRecord(
  holderName,
  date
){

  const prev =
    previousDate(date);

  if(!prev){
    return null;
  }

  if(
    !state.pettyDaily[prev]
  ){
    return null;
  }

  return state.pettyDaily[prev]
    .find(
      p =>
        normalizeName(p.holder) ===
        normalizeName(holderName)
    ) || null;

}


/* =====================================================
   AUTOMATIC CASH RECEIVED
   ===================================================== */

function automaticReceived(
  holderName,
  date=selectedDate()
){

  return currentCash()
    .filter(
      r =>
        String(r.date) === String(date) &&
        normalizeName(r.receivedBy) ===
        normalizeName(holderName)
    )
    .reduce(
      (total,r)=>
        total + num(r.amount),
      0
    );

}


/* =====================================================
   AUTOMATIC EXPENSES
   ===================================================== */

function automaticExpenses(
  holderName,
  date=selectedDate()
){

  return currentExpenses()
    .filter(
      r =>
        String(r.date) === String(date) &&
        normalizeName(r.paidBy) ===
        normalizeName(holderName)
    )
    .reduce(
      (total,r)=>
        total + num(r.amount),
      0
    );

}


/* =====================================================
   PETTY CASH FIGURES
   ===================================================== */

function pettyFigures(
  petty,
  date=selectedDate()
){

  /*
    ---------------------------------------------------
    OPENING BALANCE
    ---------------------------------------------------

    If there is a previous day's petty cash record,
    its closing balance automatically becomes today's
    opening balance.

    This is the important carry-forward feature.
  */

  const previous =
    getPreviousPettyRecord(
      petty.holder,
      date
    );


  let opening;


  if(previous){

    /*
      Previous day exists.

      Therefore today's opening is ALWAYS the previous
      day's closing.

      No manual entry is required.
    */

    const previousFigures =
      calculatePettyFiguresForDate(
        previous,
        previousDate(date)
      );

    opening =
      previousFigures.closing;

  }else{

    /*
      No previous day exists.

      This is the first day for this holder, so use
      the manually entered opening balance.
    */

    opening =
      num(petty.opening);

  }


  /*
    Automatic cash received for THIS DATE only.
  */

  const autoReceived =
    automaticReceived(
      petty.holder,
      date
    );


  /*
    Automatic expenses for THIS DATE only.
  */

  const autoExpenses =
    automaticExpenses(
      petty.holder,
      date
    );


  /*
    Manual values are retained for compatibility.

    In the current interface Received and Expenses are
    automatically calculated, so normally these will be 0.
  */

  const manualReceived =
    num(petty.received);


  const manualExpenses =
    num(petty.expenses);


  const received =
    manualReceived +
    autoReceived;


  const expenses =
    manualExpenses +
    autoExpenses;


  const closing =
    opening +
    received -
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
   CALCULATE PETTY FIGURES FOR ANY DATE
   ===================================================== */

function calculatePettyFiguresForDate(
  petty,
  date
){

  if(!petty){
    return {

      opening:0,
      manualReceived:0,
      manualExpenses:0,
      autoReceived:0,
      autoExpenses:0,
      received:0,
      expenses:0,
      closing:0

    };
  }


  const previous =
    getPreviousPettyRecord(
      petty.holder,
      date
    );


  let opening;


  if(previous){

    /*
      Prevent infinite recursion by directly calculating
      the previous day's figures.

      Previous opening comes from the day before it.
    */

    opening =
      calculateOpeningBalance(
        petty.holder,
        date
      );

  }else{

    opening =
      num(petty.opening);

  }


  const autoReceived =
    automaticReceived(
      petty.holder,
      date
    );


  const autoExpenses =
    automaticExpenses(
      petty.holder,
      date
    );


  const manualReceived =
    num(petty.received);


  const manualExpenses =
    num(petty.expenses);


  const received =
    manualReceived +
    autoReceived;


  const expenses =
    manualExpenses +
    autoExpenses;


  const closing =
    opening +
    received -
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
   CALCULATE OPENING BALANCE
   ===================================================== */

/*
  This is the core carry-forward function.

  Example:

  21/08
  Opening = 100
  Received = 50
  Expenses = 140
  Closing = 10

  22/08
  Opening automatically = 10
*/

function calculateOpeningBalance(
  holderName,
  date
){

  const prev =
    previousDate(date);


  if(!prev){
    return 0;
  }


  const previousRecord =
    findPettyHolder(
      holderName,
      prev
    );


  /*
    If there is no record for the previous day,
    continue backwards until we find the most recent
    petty cash record.

    This also means if you skip a day, the balance
    can still carry forward.
  */

  if(!previousRecord){

    return findLastKnownClosing(
      holderName,
      prev
    );

  }


  /*
    Calculate the previous day's closing.
  */

  const previousFigures =
    calculatePettyFiguresForDate(
      previousRecord,
      prev
    );


  return previousFigures.closing;

}


/* =====================================================
   FIND LAST KNOWN CLOSING
   ===================================================== */

function findLastKnownClosing(
  holderName,
  beforeDate
){

  let date = beforeDate;


  /*
    Search backwards up to 10 years.

    This prevents an infinite loop while still allowing
    long-term daily records.
  */

  for(let i=0;i<3650;i++){

    const record =
      state.pettyDaily[date]
        ? state.pettyDaily[date]
            .find(
              p =>
                normalizeName(p.holder) ===
                normalizeName(holderName)
            )
        : null;


    if(record){

      const figures =
        calculatePettyFiguresForDate(
          record,
          date
        );

      return figures.closing;

    }


    date =
      previousDate(date);

  }


  return 0;

}


/* =====================================================
   GET PETTY RECORDS FOR CURRENT DATE
   ===================================================== */

function currentPetty(){

  const date =
    selectedDate();

  ensurePettyDate(date);

  return state.pettyDaily[date];

}


/* =====================================================
   GET REMARKS
   ===================================================== */

function getRemarks(date=selectedDate()){

  return state.remarksByDate[date] || "";

}


/* =====================================================
   STARTUP
   ===================================================== */

document.addEventListener(
  "DOMContentLoaded",
  ()=>{

    /*
      Make sure current date has petty records.
    */

    ensurePettyDate(state.date);


    /*
      Set calendar.
    */

    document
      .getElementById("reportDate")
      .value = state.date;


    /*
      Calendar changed.
    */

    document
      .getElementById("reportDate")
      .addEventListener(
        "change",
        e=>{

          const newDate =
            e.target.value;

          if(!newDate){
            return;
          }


          state.date =
            newDate;


          /*
            Make sure petty cash records exist for
            the selected date.
          */

          ensurePettyDate(
            newDate
          );


          save();

        }
      );


    /*
      Remarks.
    */

    document
      .getElementById("remarksInput")
      .value =
        getRemarks();


    document
      .getElementById("remarksInput")
      .addEventListener(
        "input",
        e=>{

          state.remarksByDate[
            selectedDate()
          ] =
            e.target.value;

          save();

        }
      );


    /*
      Navigation.
    */

    document
      .querySelectorAll(".nav-btn")
      .forEach(b=>{

        b.addEventListener(
          "click",
          ()=>{

            document
              .querySelectorAll(".nav-btn")
              .forEach(
                x =>
                  x.classList.remove("active")
              );


            document
              .querySelectorAll(".section")
              .forEach(
                x =>
                  x.classList.remove("active")
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
        );

      });


    /*
      Print options.
    */

    document
      .getElementById("printOptionsBtn")
      .onclick = ()=>{

        document
          .getElementById("printModal")
          .classList.remove(
            "hidden"
          );

      };


    /*
      Main print button.
    */

    document
      .getElementById("printReportBtn")
      .onclick = ()=>{

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


    /*
      Close modal.
    */

    document
      .getElementById("closeModal")
      .onclick = ()=>{

        document
          .getElementById("printModal")
          .classList.add(
            "hidden"
          );

      };


    /*
      Print full.
    */

    document
      .getElementById("printFull")
      .onclick = ()=>{

        document
          .getElementById("printModal")
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


    /*
      Print selected.
    */

    document
      .getElementById("printSelected")
      .onclick = ()=>{

        const selected = [
          ...document
            .querySelectorAll(
              ".print-check:checked"
            )
        ]
        .map(
          x => x.value
        );


        document
          .getElementById("printModal")
          .classList.add(
            "hidden"
          );


        printSelected(
          selected
        );

      };


    /*
      Initial render.
    */

    renderAll();

  }
);


/* =====================================================
   ADD JOB
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


/* =====================================================
   ADD CASH
   ===================================================== */

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


/* =====================================================
   ADD EXPENSE
   ===================================================== */

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


/* =====================================================
   ADD BANK
   ===================================================== */

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

  const date =
    selectedDate();

  ensurePettyDate(date);


  if(!state.pettyDaily[date][i]){
    return;
  }


  state.pettyDaily[date][i].active =
    status === "active";


  save();

}


/* =====================================================
   UPDATE GENERIC ARRAY
   ===================================================== */

function updateArray(
  type,
  i,
  key,
  value
){

  /*
    Special handling for date-based arrays.
  */

  if(
    !state[type] ||
    !state[type][i]
  ){

    return;

  }


  state[type][i][key] =
    value;


  save();

}


/* =====================================================
   UPDATE PETTY OPENING
   ===================================================== */

function updatePettyOpening(
  i,
  value
){

  const date =
    selectedDate();


  ensurePettyDate(date);


  const record =
    state.pettyDaily[date][i];


  if(!record){
    return;
  }


  /*
    If there is a previous balance, do NOT allow
    today's opening to be manually changed.

    It must come from yesterday's closing.
  */

  const previous =
    getPreviousPettyRecord(
      record.holder,
      date
    );


  if(previous){

    return;

  }


  record.opening =
    num(value);


  save();

}


/* =====================================================
   DELETE
   ===================================================== */

function del(
  type,
  i
){

  if(
    !state[type] ||
    !state[type][i]
  ){

    return;

  }


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

  const el =
    document.getElementById(
      "jobsEditor"
    );


  const records =
    currentJobs();


  el.innerHTML = `

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
    records.map(
      r=>{

        const i =
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
                .map(
                  x=>`
                    <option
                      ${
                        r.status===x
                          ? "selected"
                          : ""
                      }
                    >
                      ${x}
                    </option>
                  `
                )
                .join("")
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

      }
    ).join("")
  }

  ${
    records.length
      ? ""
      : emptyRow(
          8,
          `No jobs for ${formatDate(selectedDate())}`
        )
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

  const records =
    currentCash();


  document
    .getElementById(
      "cashEditor"
    )
    .innerHTML = `

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
      records.map(
        r=>{

          const i =
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

        }
      ).join("")
    }

    ${
      records.length
        ? ""
        : emptyRow(
            5,
            `No cash received for ${formatDate(selectedDate())}`
          )
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

  const records =
    currentExpenses();


  document
    .getElementById(
      "expenseEditor"
    )
    .innerHTML = `

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
      records.map(
        r=>{

          const i =
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

        }
      ).join("")
    }

    ${
      records.length
        ? ""
        : emptyRow(
            5,
            `No expenses for ${formatDate(selectedDate())}`
          )
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

  const records =
    currentBank();


  document
    .getElementById(
      "bankEditor"
    )
    .innerHTML = `

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
      records.map(
        r=>{

          const i =
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

        }
      ).join("")
    }

    ${
      records.length
        ? ""
        : emptyRow(
            6,
            `No bank transfers for ${formatDate(selectedDate())}`
          )
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

  const date =
    selectedDate();


  ensurePettyDate(date);


  const records =
    state.pettyDaily[date];


  document
    .getElementById(
      "pettyEditor"
    )
    .innerHTML = `

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
      records.map(
        (r,i)=>{

          const figures =
            pettyFigures(
              r,
              date
            );


          const previous =
            getPreviousPettyRecord(
              r.holder,
              date
            );


          /*
            If previous day exists, opening is automatic.
            Otherwise the first day's opening can be entered.
          */

          const openingHTML =
            previous

              ? `
                <input
                  type="number"
                  step="0.01"
                  value="${figures.opening}"
                  readonly
                  title="Automatically carried forward from the previous day's closing balance"
                >
              `

              : `
                <input
                  type="number"
                  step="0.01"
                  value="${r.opening}"
                  onchange="
                    updatePettyOpening(
                      ${i},
                      this.value
                    )
                  "
                  title="Enter opening balance for the first day"
                >
              `;


          return `

          <tr>

            <td>
              <b>
                ${esc(r.holder)}
              </b>
            </td>


            <td>

              ${openingHTML}

            </td>


            <td>

              <input
                type="number"
                step="0.01"
                value="${figures.received}"
                readonly
                title="Automatically includes cash received by this holder for ${formatDate(date)}"
              >

            </td>


            <td>

              <input
                type="number"
                step="0.01"
                value="${figures.expenses}"
                readonly
                title="Automatically includes expenses paid by this holder for ${formatDate(date)}"
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
                  ${
                    r.active
                      ? "selected"
                      : ""
                  }
                >
                  Active
                </option>


                <option
                  value="inactive"
                  ${
                    !r.active
                      ? "selected"
                      : ""
                  }
                >
                  Inactive
                </option>

              </select>

            </td>

          </tr>

          `;

        }
      ).join("")
    }

    </tbody>

    </table>

    </div>

    `;

}


/* =====================================================
   GENERIC PREVIEW ROWS
   ===================================================== */

function rows(
  records,
  fn,
  cols
){

  return records.length
    ? records.map(fn).join("")
    : emptyRow(cols);

}


/* =====================================================
   REPORT PREVIEW
   ===================================================== */

function renderPreview(){

  const date =
    selectedDate();


  /*
    ---------------------------------------------------
    CURRENT DAY RECORDS ONLY
    ---------------------------------------------------
  */

  const jobs =
    currentJobs();

  const cash =
    currentCash();

  const expenses =
    currentExpenses();

  const bank =
    currentBank();


  /*
    ---------------------------------------------------
    TOTAL CASH
    ---------------------------------------------------
  */

  const cashTotal =
    cash.reduce(
      (a,r)=>
        a + num(r.amount),
      0
    );


  /*
    ---------------------------------------------------
    TOTAL BANK
    ---------------------------------------------------
  */

  const bankTotal =
    bank.reduce(
      (a,r)=>
        a + num(r.amount),
      0
    );


  /*
    ---------------------------------------------------
    TOTAL EXPENSES
    ---------------------------------------------------
  */

  const expenseTotal =
    expenses.reduce(
      (a,r)=>
        a + num(r.amount),
      0
    );


  /*
    ---------------------------------------------------
    PETTY CASH
    ---------------------------------------------------
  */

  const pettyRecords =
    currentPetty();


  const active =
    pettyRecords.filter(
      r => r.active
    );


  const inactive =
    pettyRecords.filter(
      r => !r.active
    );


  const pettyTotal =
    active.reduce(
      (a,r)=>
        a +
        pettyFigures(
          r,
          date
        ).closing,
      0
    );


  /*
    ---------------------------------------------------
    SUMMARY CARDS
    ---------------------------------------------------
  */

  document
    .getElementById(
      "sumCash"
    )
    .textContent =
      money(cashTotal);


  document
    .getElementById(
      "sumBank"
    )
    .textContent =
      money(bankTotal);


  document
    .getElementById(
      "sumExpenses"
    )
    .textContent =
      money(expenseTotal);


  document
    .getElementById(
      "sumPetty"
    )
    .textContent =
      money(pettyTotal);


  /*
    ---------------------------------------------------
    PAPER SUMMARY
    ---------------------------------------------------
  */

  document
    .getElementById(
      "paperCash"
    )
    .textContent =
      money(cashTotal)
        .replace("AED ","");


  document
    .getElementById(
      "paperBank"
    )
    .textContent =
      money(bankTotal)
        .replace("AED ","");


  document
    .getElementById(
      "paperExpenses"
    )
    .textContent =
      money(expenseTotal)
        .replace("AED ","");


  document
    .getElementById(
      "paperPetty"
    )
    .textContent =
      money(pettyTotal)
        .replace("AED ","");


  /*
    ---------------------------------------------------
    JOBS PREVIEW
    ---------------------------------------------------
  */

  document
    .querySelector(
      "#jobsPreview tbody"
    )
    .innerHTML =

    rows(
      jobs,

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


  /*
    ---------------------------------------------------
    CASH PREVIEW
    ---------------------------------------------------
  */

  document
    .querySelector(
      "#cashPreview tbody"
    )
    .innerHTML =

    rows(
      cash,

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


  /*
    ---------------------------------------------------
    EXPENSE PREVIEW
    ---------------------------------------------------
  */

  document
    .querySelector(
      "#expensePreview tbody"
    )
    .innerHTML =

    rows(
      expenses,

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


  /*
    ---------------------------------------------------
    BANK PREVIEW
    ---------------------------------------------------
  */

  document
    .querySelector(
      "#bankPreview tbody"
    )
    .innerHTML =

    rows(
      bank,

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


  /*
    ---------------------------------------------------
    PETTY CASH ROWS
    ---------------------------------------------------
  */

  const pettyRows =
    r=>{

      const figures =
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


  /*
    Active petty cash.
  */

  document
    .querySelector(
      "#pettyPreview tbody"
    )
    .innerHTML =

    active.length
      ? active
          .map(pettyRows)
          .join("")
      : emptyRow(5);


  /*
    Inactive petty cash.
  */

  document
    .querySelector(
      "#inactivePreview tbody"
    )
    .innerHTML =

    inactive.length
      ? inactive
          .map(pettyRows)
          .join("")
      : emptyRow(5);


  /*
    ---------------------------------------------------
    MANAGEMENT REMARKS
    ---------------------------------------------------
  */

  document
    .getElementById(
      "remarksPreview"
    )
    .textContent =
      getRemarks(date) || "";

}


/* =====================================================
   RENDER ALL
   ===================================================== */

function renderAll(){

  const date =
    selectedDate();


  ensurePettyDate(date);


  renderJobs();

  renderCash();

  renderExpenses();

  renderBank();

  renderPetty();

  renderPreview();


  /*
    Keep calendar synchronized.
  */

  const dateInput =
    document.getElementById(
      "reportDate"
    );


  if(dateInput){

    dateInput.value =
      state.date;

  }


  /*
    Update remarks for selected date.
  */

  const remarksInput =
    document.getElementById(
      "remarksInput"
    );


  if(remarksInput){

    remarksInput.value =
      getRemarks(date);

  }

}


/* =====================================================
   PRINT
   ===================================================== */

function printSelected(
  sections
){

  /*
    Always refresh the report using the currently
    selected dashboard date before printing.
  */

  const date =
    selectedDate();


  /*
    Keep state synchronized with calendar.
  */

  state.date =
    date;


  /*
    Make sure the selected date has petty records.
  */

  ensurePettyDate(date);


  /*
    Re-render the report.
  */

  renderPreview();


  const all = [

    "summary",

    "jobs",

    "cash",

    "expenses",

    "bank",

    "petty",

    "inactive",

    "remarks"

  ];


  const map = {

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
    ---------------------------------------------------
    REPORT DATE
    ---------------------------------------------------

    This is the important print-date fix.

    It uses the Dashboard calendar date.

    Example:

    Calendar = 21/08/2026

    Printed report =
    21/08/2026

    Even if today's computer date is
    22/08/2026 or 25/08/2026.
  */

  const reportTitle =
    document.querySelector(
      ".report-title"
    );


  const originalTitle =
    reportTitle
      ? reportTitle.innerHTML
      : "";


  if(reportTitle){

    reportTitle.innerHTML =
      `SUMMARY DASHBOARD
       <span class="print-report-date">
         — ${formatDate(date)}
       </span>`;

  }


  /*
    ---------------------------------------------------
    SHOW/HIDE PRINT SECTIONS
    ---------------------------------------------------
  */

  all.forEach(
    section=>{

      const el =
        document.querySelector(
          map[section]
        );


      if(el){

        el.classList.toggle(
          "hidden-print",
          !sections.includes(
            section
          )
        );

      }

    }
  );


  /*
    ---------------------------------------------------
    PRINT
    ---------------------------------------------------
  */

  window.print();


  /*
    ---------------------------------------------------
    RESTORE SCREEN
    ---------------------------------------------------
  */

  setTimeout(
    ()=>{

      all.forEach(
        section=>{

          const el =
            document.querySelector(
              map[section]
            );


          if(el){

            el.classList.remove(
              "hidden-print"
            );

          }

        }
      );


      if(reportTitle){

        reportTitle.innerHTML =
          originalTitle;

      }

    },
    500
  );

}
