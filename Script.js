// --- State ---
let loads = [];

// --- DOM Helpers ---
const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

// --- Elements ---
const supportTypeEl = $('#supportType');
const ovLeftEl      = $('#ovLeft');
const beamLenEl     = $('#beamLength');
const ovRightEl     = $('#ovRight');
const EEl           = $('#E');
const IEl           = $('#I');
const loadTypeEl    = $('#loadType');
const loadInputsEl  = $('#loadInputs');
const addLoadBtn    = $('#addLoadBtn');
const loadTableBody = $('#loadTable tbody');
const genBtn        = $('#genBtn');
const clearBtn      = $('#clearBtn');
const exportCSVBtn  = $('#exportCSV');
const exportPNGBtn  = $('#exportPNG');

// Result spans
const maxShearEl  = $('#maxShear');
const minShearEl  = $('#minShear');
const maxMomentEl = $('#maxMoment');
const minMomentEl = $('#minMoment');
const maxDeflEl   = $('#maxDefl');

// Initial render of load inputs
loadTypeEl.addEventListener('change', renderLoadInputs);
renderLoadInputs();

function renderLoadInputs() {
  let html = '';
  if (loadTypeEl.value === 'point') {
    html = `
      <label>P (kN):
        <input type="number" id="ptP" step="0.1" value="10"/>
      </label>
      <label>x (m):
        <input type="number" id="ptX" step="0.1" value="2"/>
      </label>
    `;
  }
  else if (loadTypeEl.value === 'udl') {
    html = `
      <label>w (kN/m):
        <input type="number" id="udlW" step="0.1" value="5"/>
      </label>
      <label>a (m):
        <input type="number" id="udlA" step="0.1" value="1"/>
      </label>
      <label>b (m):
        <input type="number" id="udlB" step="0.1" value="4"/>
      </label>
    `;
  }
  else {
    html = `
      <label>wₘₐₓ (kN/m):
        <input type="number" id="triW" step="0.1" value="8"/>
      </label>
      <label>a (m):
        <input type="number" id="triA" step="0.1" value="0"/>
      </label>
      <label>b (m):
        <input type="number" id="triB" step="0.1" value="5"/>
      </label>
    `;
  }
  loadInputsEl.innerHTML = html;
}

// --- Add Load ---
addLoadBtn.addEventListener('click', () => {
  const L  = +beamLenEl.value;
  const t  = loadTypeEl.value;
  let ld   = { type: t };

  if (t === 'point') {
    ld.p = +$('#ptP').value;
    ld.x = +$('#ptX').value;
    if (ld.x < -+ovLeftEl.value || ld.x > L + +ovRightEl.value) {
      return alert('Point load position outside beam');
    }
  }
  else if (t === 'udl') {
    ld.w = +$('#udlW').value;
    ld.a = +$('#udlA').value;
    ld.b = +$('#udlB').value;
    if (ld.a >= ld.b) return alert('UDL: a must be < b');
  }
  else {
    ld.w = +$('#triW').value;
    ld.a = +$('#triA').value;
    ld.b = +$('#triB').value;
    if (ld.a >= ld.b) return alert('Triangular: a must be < b');
  }

  loads.push(ld);
  renderTable();
});

// --- Render Load Table ---
function renderTable() {
  loadTableBody.innerHTML = '';
  loads.forEach((ld, i) => {
    let desc = '';
    if (ld.type === 'point') desc = `P=${ld.p}@${ld.x}`;
    if (ld.type === 'udl')   desc = `w=${ld.w},[${ld.a}→${ld.b}]`;
    if (ld.type === 'triangular')
      desc = `wₘₐₓ=${ld.w},[${ld.a}→${ld.b}]`;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${i+1}</td>
      <td>${ld.type}</td>
      <td>${desc}</td>
      <td><button onclick="removeLoad(${i})">✕</button></td>
    `;
    loadTableBody.appendChild(row);
  });
}
window.removeLoad = i => {
  loads.splice(i, 1);
  renderTable();
};

// --- Clear All ---
clearBtn.addEventListener('click', () => {
  loads = [];
  renderTable();
  clearCharts();
  resetInputs();
});
function clearCharts() {
  $('#chartSFD').innerHTML = '';
  $('#chartBMD').innerHTML = '';
  $('#chartDefl').innerHTML = '';
  maxShearEl.textContent = minShearEl.textContent =
  maxMomentEl.textContent = minMomentEl.textContent =
  maxDeflEl.textContent   = '–';
}
function resetInputs() {
  supportTypeEl.value = 'simply';
  ovLeftEl.value = '0';
  beamLenEl.value = '5';
  ovRightEl.value = '0';
  EEl.value = '210';
  IEl.value = '8e-5';
}

// --- Generate Diagrams ---
genBtn.addEventListener('click', () => {
  if (!loads.length) return alert('Add at least one load');
  const params = {
    L: +beamLenEl.value,
    ovL: +ovLeftEl.value,
    ovR: +ovRightEl.value,
    E: +EEl.value * 1e9,
    I: +IEl.value,
    sup: supportTypeEl.value,
  };
  computeAndPlot(params, loads);
});

// --- Core Compute & Plot ---
function computeAndPlot(cfg, loads) {
  const { L, ovL, ovR, E, I, sup } = cfg;
  const totalLen = L + ovL + ovR;

  // 1) Reactions & fixed moments
  let sumW = 0, sumM = 0;
  loads.forEach(ld => {
    let wsum = 0, cent = 0;
    if (ld.type === 'point') {
      wsum = ld.p;
      cent = ovL + ld.x;
    }
    if (ld.type === 'udl') {
      wsum = ld.w * (ld.b - ld.a);
      cent = ovL + (ld.a + ld.b) / 2;
    }
    if (ld.type === 'triangular') {
      wsum = 0.5 * ld.w * (ld.b - ld.a);
      cent = ovL + ld.a + 2/3 * (ld.b - ld.a);
    }
    sumW += wsum;
    sumM += wsum * cent;
  });

  let RA=0, RB=0, MA=0, MB=0;
  if (sup === 'simply' || sup === 'overhang') {
    RB = sumM / L;
    RA = sumW - RB;
  } else if (sup === 'cantilever') {
    RA = sumW;
    MA = sumM;
  } else {
    // fixed–fixed approximate
    RA = RB = sumW / 2;
    MA = MB = sumM / 4;
  }

  // 2) Sample V, M, deflection
  const N = 300, dx = totalLen / (N - 1);
  const xArr = ['x'], vArr = ['Shear'], mArr = ['Moment'], dArr = ['Deflection'];
  let Mprev = sup === 'cantilever' ? MA : 0, slope = 0;

  for (let i = 0; i < N; i++) {
    const xw = i * dx, xv = xw - ovL;
    xArr.push(xv);

    // Shear
    let V = sup !== 'cantilever' ? RA : -RA;
    loads.forEach(ld => {
      const pos = ovL + (ld.type === 'point' ? ld.x : 0);
      if (ld.type === 'point' && xw >= pos) V -= ld.p;
      if (ld.type === 'udl' && xw >= ovL + ld.a) {
        const xe = Math.min(xw, ovL + ld.b) - (ovL + ld.a);
        V -= ld.w * xe;
      }
      if (ld.type === 'triangular' && xw >= ovL + ld.a) {
        const xe = Math.min(xw, ovL + ld.b) - (ovL + ld.a);
        const h = ld.w * xe / (ld.b - ld.a);
        const area = 0.5 * h * xe;
        V -= area;
      }
    });
    vArr.push(V);

    // Moment
    const M = i === 0
      ? Mprev
      : Mprev + (vArr[i] + vArr[i+1]) / 2 * dx;
    mArr.push(M);
    Mprev = M;

    // Deflection integration
    slope += M / (E * I) * dx;
    const def = slope * dx;
    dArr.push(def * 1e3);
  }

  // 3) Plot
  plotC3('#chartSFD', xArr, vArr, 'Shear', 'kN');
  plotC3('#chartBMD', xArr, mArr, 'Moment', 'kN·m');
  plotC3('#chartDefl', xArr, dArr, 'Deflection', 'mm');

  // 4) Results
  const shearVals = vArr.slice(1), momVals = mArr.slice(1), defVals = dArr.slice(1);
  maxShearEl.textContent  = Math.max(...shearVals).toFixed(2);
  minShearEl.textContent  = Math.min(...shearVals).toFixed(2);
  maxMomentEl.textContent = Math.max(...momVals).toFixed(2);
  minMomentEl.textContent = Math.min(...momVals).toFixed(2);
  maxDeflEl.textContent   = Math.max(...defVals).toFixed(2);
}

// Helper to draw with C3
function plotC3(selector, xdata, ydata, key, unit) {
  c3.generate({
    bindto: selector,
    data: {
      x: 'x',
      columns: [xdata, ydata],
      types: { [key]: 'line' }
    },
    axis: {
      x: {
        label: 'x (m)',
        tick: { culling: { max: 8 }, rotate: 45, format: d3.format('.1f') }
      },
      y: { label: `${key} (${unit})` }
    },
    padding: { right: 20 }
  });
}

// --- CSV Export ---
exportCSVBtn.addEventListener('click', () => {
  // grabs the SFD data
  const chart = c3.chart.internal.main;
  const rows = chart.data().flatMap(d =>
    d.values.map(pt => `${pt.x},${pt.value}`)
  );
  const csv = rows.join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'beam_data.csv';
  a.click();
});

// --- PNG Export ---
exportPNGBtn.addEventListener('click', () => {
  const svg = document.querySelector('.c3 svg');
  const xml = new XMLSerializer().serializeToString(svg);
  const svg64 = btoa(xml);
  const img = new Image();
  img.src = 'data:image/svg+xml;base64,' + svg64;
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = svg.clientWidth;
    canvas.height = svg.clientHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'beam_chart.png';
      a.click();
    });
  };
});
