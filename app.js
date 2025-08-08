// app.js - Integração básica com Firestore (módulo)
import { db } from './firebase-config.js';
import {
  collection, addDoc, doc, getDoc, getDocs, onSnapshot, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const $ = id => document.getElementById(id);

// Ao carregar DOM
document.addEventListener('DOMContentLoaded', () => {
  setupForms();
  startRealtimeListeners();
  const mapTab = document.getElementById('map-tab');
  if (mapTab) {
    mapTab.addEventListener('shown.bs.tab', () => {
      initMap().catch(e => console.error(e));
    });
  }
});

function setupForms() {
  const inspectorForm = $('inspectorForm');
  if (inspectorForm) {
    inspectorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('inspectorFullName').value.trim();
      const registration = $('inspectorRegistration').value.trim();
      if (!name || !registration) { alert('Preencha nome e matrícula'); return; }
      try {
        await addDoc(collection(db, 'inspectors'), { name, registration, createdAt: new Date() });
        inspectorForm.reset();
      } catch (err) { console.error(err); alert('Erro ao salvar fiscal'); }
    });
  }

  const contractorForm = $('contractorForm');
  if (contractorForm) {
    contractorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('contractorName').value.trim();
      if (!name) { alert('Nome da empreiteira é obrigatório'); return; }
      try {
        await addDoc(collection(db, 'contractors'), { name, createdAt: new Date() });
        contractorForm.reset();
      } catch (err) { console.error(err); alert('Erro ao salvar empreiteira'); }
    });
  }

  const roadForm = $('roadForm');
  if (roadForm) {
    roadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = $('roadType').value;
      const number = $('roadNumber').value.trim();
      const startKm = parseFloat($('roadStartKm').value) || 0;
      const endKm = parseFloat($('roadEndKm').value) || 0;
      const description = $('roadDescription').value.trim();
      if (!number) { alert('Informe o número da rodovia'); return; }
      try {
        await addDoc(collection(db, 'roads'), {
          type, number, startKm, endKm, description, sections: [], coordinates: [], createdAt: new Date()
        });
        roadForm.reset();
      } catch (err) { console.error(err); alert('Erro ao salvar rodovia'); }
    });
  }

  const inspectionForm = $('inspectionForm');
  if (inspectionForm) {
    inspectionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const inspectorId = $('inspectorName').value;
      const date = $('inspectionDate').value;
      const roadId = $('roadSelect').value;
      const startKm = parseFloat($('startKm').value);
      const endKm = parseFloat($('endKm').value);
      const observations = $('observations').value.trim();

      if (!inspectorId || !date || !roadId || isNaN(startKm) || isNaN(endKm)) {
        alert('Preencha todos os campos obrigatórios');
        return;
      }

      try {
        // determinar empreiteira (simplificado)
        let contractorId = '';
        const roadSnap = await getDoc(doc(db, 'roads', roadId));
        if (roadSnap.exists()) {
          const data = roadSnap.data();
          if (Array.isArray(data.sections)) {
            const sec = data.sections.find(s => startKm >= s.startKm && startKm < s.endKm);
            if (sec && sec.contractorId) contractorId = sec.contractorId;
          }
        }
        await addDoc(collection(db, 'inspections'), {
          inspectorId, date, roadId, startKm, endKm, contractorId, observations, geoStart: null, geoEnd: null, createdAt: new Date()
        });
        inspectionForm.reset();
      } catch (err) { console.error(err); alert('Erro ao salvar vistoria'); }
    });
  }

  const sectionForm = $('sectionForm');
  if (sectionForm) {
    sectionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const roadId = $('modalRoadId').value;
      const startKm = parseFloat($('sectionStartKm').value);
      const endKm = parseFloat($('sectionEndKm').value);
      const contractorId = $('sectionContractor').value;
      if (!roadId || isNaN(startKm) || isNaN(endKm) || !contractorId) { alert('Preencha os campos do trecho'); return; }
      try {
        const roadRef = doc(db, 'roads', roadId);
        const roadSnap = await getDoc(roadRef);
        if (!roadSnap.exists()) { alert('Rodovia não encontrada'); return; }
        const roadData = roadSnap.data();
        const sections = Array.isArray(roadData.sections) ? roadData.sections : [];
        sections.push({ startKm, endKm, contractorId });
        await updateDoc(roadRef, { sections });
        const modalEl = document.getElementById('sectionsModal');
        if (modalEl) {
          const bsModal = bootstrap.Modal.getInstance(modalEl);
          if (bsModal) bsModal.hide();
        }
        sectionForm.reset();
      } catch (err) { console.error(err); alert('Erro ao adicionar trecho'); }
    });
  }

  const saveGeoBtn = $('saveGeo');
  if (saveGeoBtn) {
    saveGeoBtn.addEventListener('click', async () => {
      const inspectionId = $('geoInspectionId').value;
      const startLat = parseFloat($('startLat').value);
      const startLng = parseFloat($('startLng').value);
      const endLat = parseFloat($('endLat').value);
      const endLng = parseFloat($('endLng').value);
      if (!inspectionId || isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) { alert('Preencha as coordenadas'); return; }
      try {
        await updateDoc(doc(db, 'inspections', inspectionId), {
          geoStart: { lat: startLat, lng: startLng },
          geoEnd: { lat: endLat, lng: endLng }
        });
        const modalEl = document.getElementById('geoModal');
        if (modalEl) {
          const bs = bootstrap.Modal.getInstance(modalEl);
          if (bs) bs.hide();
        }
        alert('Coordenadas salvas');
      } catch (err) { console.error(err); alert('Erro ao salvar coordenadas'); }
    });
  }
}

function startRealtimeListeners() {
  // inspectors
  const inspectorsCol = collection(db, 'inspectors');
  onSnapshot(inspectorsCol, (snap) => {
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    const selectIds = ['inspectorName','filterInspector','mapInspector','planningInspector','trackingInspector'];
    selectIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = id.includes('filter') || id.includes('map') ? '<option value="">Todos</option>' : '<option value="" selected disabled>Selecione o fiscal</option>';
      items.forEach(i => {
        const opt = document.createElement('option'); opt.value = i.id; opt.textContent = i.name; el.appendChild(opt);
      });
    });
    // inspectors table
    const tbody = document.querySelector('#inspectorsTable tbody');
    if (tbody) {
      tbody.innerHTML = '';
      items.forEach(i => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><img src="" class="inspector-photo"/></td><td>${i.name}</td><td>${i.registration||''}</td><td>0</td><td><button class='btn btn-sm btn-danger delete-inspector' data-id='${i.id}'>Excluir</button></td>`;
        tbody.appendChild(tr);
      });
    }
  });

  // contractors
  const contractorsCol = collection(db, 'contractors');
  onSnapshot(contractorsCol, (snap) => {
    const items = []; snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    const selectIds = ['roadContractor','sectionContractor','mapContractor','planningContractor'];
    selectIds.forEach(id => {
      const el = document.getElementById(id); if (!el) return;
      el.innerHTML = id === 'roadContractor' ? '<option value="">Nenhuma</option>' : '<option value="">Todas</option>';
      items.forEach(c => { const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name; el.appendChild(opt); });
    });
    const tbody = document.querySelector('#contractorsTable tbody');
    if (tbody) { tbody.innerHTML = ''; items.forEach(c => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${c.name}</td><td>0</td><td><button class='btn btn-sm btn-danger delete-contractor' data-id='${c.id}'>Excluir</button></td>`; tbody.appendChild(tr); }); }
  });

  // roads
  const roadsCol = collection(db, 'roads');
  onSnapshot(roadsCol, (snap) => {
    const items = []; snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    const roadSelects = ['roadSelect','mapRoad','filterRoad'];
    roadSelects.forEach(id => {
      const el = document.getElementById(id); if (!el) return;
      el.innerHTML = id === 'filterRoad' || id === 'mapRoad' ? '<option value="">Todas</option>' : '<option value="" selected disabled>Selecione a rodovia</option>';
      items.forEach(r => { const opt = document.createElement('option'); opt.value = r.id; opt.textContent = `${r.type}-${r.number}`; el.appendChild(opt); });
    });
    const tbody = document.querySelector('#roadSectionsTable tbody');
    if (tbody) { tbody.innerHTML = ''; items.forEach(r => { const tr = document.createElement('tr'); const sections = Array.isArray(r.sections)?r.sections.length:0; tr.innerHTML = `<td>${r.type}-${r.number}</td><td>${r.startKm} a ${r.endKm}</td><td>${(r.endKm - r.startKm)}</td><td>${sections}</td><td><button class='btn btn-sm btn-primary' onclick="openSectionsModal('${r.id}')">Trechos</button></td>`; tbody.appendChild(tr); }); }
  });

  // inspections
  const inspectionsCol = collection(db, 'inspections');
  onSnapshot(inspectionsCol, (snap) => {
    const items = []; snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    const tbody = document.querySelector('#historyTable tbody');
    if (tbody) { tbody.innerHTML = ''; items.forEach(ins => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${ins.date||''}</td><td>${ins.inspectorId||''}</td><td>${ins.roadId||''}</td><td>${ins.startKm} a ${ins.endKm}</td><td>${ins.contractorId||''}</td><td>${ins.geoStart? 'Sim':'Não'}</td><td><button class='btn btn-sm btn-secondary' onclick="viewInspection('${ins.id}')">Ver</button></td>`; tbody.appendChild(tr); }); }
  });
}

// Expor funções globais
window.openSectionsModal = async function(roadId) {
  document.getElementById('modalRoadId').value = roadId;
  const tbody = document.querySelector('#roadSectionsModalTable tbody'); tbody.innerHTML = '';
  const r = await getDoc(doc(db, 'roads', roadId));
  if (r.exists()) {
    const data = r.data();
    const secs = Array.isArray(data.sections)?data.sections:[];
    secs.forEach((s, idx) => {
      const tr = document.createElement('tr'); tr.innerHTML = `<td>${s.startKm}</td><td>${s.endKm}</td><td>${s.contractorId||''}</td><td><button class='btn btn-sm btn-danger delete-section' data-id='${idx}' data-road-id='${roadId}'>Excluir</button></td>`;
      tbody.appendChild(tr);
    });
  }
  const modal = new bootstrap.Modal(document.getElementById('sectionsModal')); modal.show();
}

window.viewInspection = async function(id) {
  const snap = await getDoc(doc(db, 'inspections', id));
  if (!snap.exists()) return alert('Não encontrado');
  const data = snap.data();
  const container = document.getElementById('inspectionDetails');
  container.innerHTML = `<p><b>Data:</b> ${data.date}</p><p><b>Observações:</b> ${data.observations||''}</p><p><b>Georreferenciado:</b> ${data.geoStart? 'Sim':'Não'}</p>`;
  const modal = new bootstrap.Modal(document.getElementById('inspectionModal')); modal.show();
}

// Exclusões simplificadas
document.addEventListener('click', async (e) => {
  if (e.target.matches('.delete-contractor')) { const id = e.target.dataset.id; if (confirm('Excluir empreiteira?')) await deleteDoc(doc(db, 'contractors', id)); }
  if (e.target.matches('.delete-inspector')) { const id = e.target.dataset.id; if (confirm('Excluir fiscal?')) await deleteDoc(doc(db, 'inspectors', id)); }
  if (e.target.matches('.delete-road')) { const id = e.target.dataset.id; if (confirm('Excluir rodovia?')) await deleteDoc(doc(db, 'roads', id)); }
  if (e.target.matches('.delete-section')) {
    const idx = parseInt(e.target.dataset.id); const roadId = e.target.dataset.roadId; const roadRef = doc(db,'roads',roadId);
    const roadSnap = await getDoc(roadRef); if (!roadSnap.exists()) return;
    const data = roadSnap.data(); const sections = Array.isArray(data.sections)?data.sections:[]; sections.splice(idx,1); await updateDoc(roadRef,{sections}); openSectionsModal(roadId);
  }
});

// MAP básico
let map, roadLayers=[], routeLayers=[];
async function initMap() {
  if (map) return;
  const el = document.getElementById('map');
  if (!el) return;
  el.innerHTML = '';
  map = L.map('map').setView([-23.5505, -46.6333], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ attribution: '&copy; OpenStreetMap contributors' }).addTo(map);

  const roadsSnap = await getDocs(collection(db,'roads'));
  roadsSnap.forEach(rd => { const r = rd.data(); if (Array.isArray(r.coordinates) && r.coordinates.length>=2) { const latlngs = r.coordinates.map(c=>[c[0],c[1]]); const layer = L.polyline(latlngs,{color:'#3366cc',weight:4}).addTo(map); roadLayers.push(layer); } });
  const inspSnap = await getDocs(collection(db,'inspections'));
  inspSnap.forEach(insDoc => {
    const ins = insDoc.data();
    if (ins.geoStart && ins.geoEnd) {
      const sp = [ins.geoStart.lat, ins.geoStart.lng];
      const ep = [ins.geoEnd.lat, ins.geoEnd.lng];
      L.marker(sp).addTo(map).bindPopup('Início: ' + ins.date);
      L.marker(ep).addTo(map).bindPopup('Fim: ' + ins.date);
      const line = L.polyline([sp,ep],{color:'#0d6efd',weight:3,dashArray:'5,5'}).addTo(map);
      routeLayers.push(line);
    }
  });
  const all = roadLayers.concat(routeLayers);
  if (all.length>0) { const group = L.featureGroup(all); map.fitBounds(group.getBounds().pad(0.2)); }
}
