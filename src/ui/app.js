/**
 * DockerClean Web Studio Client App
 */

let state = {
  data: null,
  activeTab: 'containers',
  selectedContainers: new Set(),
  selectedImages: new Set(),
  selectedVolumes: new Set(),
  selectedCache: false
};

// DOM Elements
const daemonStatusText = document.getElementById('daemonStatusText');
const gaugeTotal = document.getElementById('gaugeTotal');

const statContainers = document.getElementById('statContainers');
const subContainers = document.getElementById('subContainers');
const statImages = document.getElementById('statImages');
const subImages = document.getElementById('subImages');
const statVolumes = document.getElementById('statVolumes');
const subVolumes = document.getElementById('subVolumes');
const statCache = document.getElementById('statCache');
const subCache = document.getElementById('subCache');

const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const btnRefresh = document.getElementById('btnRefresh');
const btnPruneSelected = document.getElementById('btnPruneSelected');

const tableHead = document.getElementById('tableHead');
const tableBody = document.getElementById('tableBody');
const toastEl = document.getElementById('toast');

function showToast(message, type = 'info') {
  toastEl.textContent = message;
  toastEl.className = `toast show ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
  setTimeout(() => {
    toastEl.className = 'toast';
  }, 3200);
}

async function loadData() {
  try {
    const res = await fetch('/api/df');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.data = data;

    renderUI();
  } catch (err) {
    showToast(`Failed to load Docker DF: ${err.message}`, 'error');
  }
}

function renderUI() {
  if (!state.data) return;
  const { isMock, dockerAvailable, summary, containers, images, volumes, buildCache } = state.data;

  // Status
  daemonStatusText.textContent = dockerAvailable
    ? 'Docker Daemon Live & Connected'
    : 'Docker Daemon Inactive (Simulated Storage Mode)';
  daemonStatusText.style.color = dockerAvailable ? 'var(--color-success)' : 'var(--color-warning)';

  // Gauge & Stats
  gaugeTotal.textContent = summary.totalReclaimableFormatted;

  const stoppedContainers = containers.filter(c => c.stopped).length;
  statContainers.textContent = stoppedContainers;
  subContainers.textContent = `${summary.containerReclaimableFormatted} reclaimable`;

  const danglingImages = images.filter(i => i.dangling).length;
  statImages.textContent = danglingImages;
  subImages.textContent = `${summary.imageReclaimableFormatted} reclaimable`;

  const unusedVolumes = volumes.filter(v => !v.inUse).length;
  statVolumes.textContent = unusedVolumes;
  subVolumes.textContent = `${summary.volumeReclaimableFormatted} reclaimable`;

  statCache.textContent = summary.cacheReclaimableFormatted;
  subCache.textContent = `${buildCache.length} layer(s)`;

  renderTable();
}

function renderTable() {
  if (!state.data) return;

  if (state.activeTab === 'containers') {
    renderContainersTable(state.data.containers);
  } else if (state.activeTab === 'images') {
    renderImagesTable(state.data.images);
  } else if (state.activeTab === 'volumes') {
    renderVolumesTable(state.data.volumes);
  } else if (state.activeTab === 'cache') {
    renderCacheTable(state.data.buildCache);
  }
}

function renderContainersTable(containers) {
  tableHead.innerHTML = `
    <tr>
      <th style="width: 5%"><input type="checkbox" id="chkAllTab"></th>
      <th style="width: 20%">Container Name</th>
      <th style="width: 25%">Image</th>
      <th style="width: 20%">Status</th>
      <th style="width: 15%">Size</th>
      <th style="width: 15%">Created</th>
    </tr>
  `;

  if (containers.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="loading-cell">No containers found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = containers.map(c => {
    const isChecked = state.selectedContainers.has(c.id);
    const badgeClass = c.stopped ? 'status-badge stopped' : 'status-badge running';
    return `
      <tr>
        <td><input type="checkbox" class="chk-item" data-id="${c.id}" ${isChecked ? 'checked' : ''}></td>
        <td><span class="asset-id">${escapeHtml(c.name)}</span></td>
        <td><code>${escapeHtml(c.image)}</code></td>
        <td><span class="${badgeClass}">${escapeHtml(c.status)}</span></td>
        <td>${escapeHtml(c.size)}</td>
        <td>${escapeHtml(c.created)}</td>
      </tr>
    `;
  }).join('');

  bindCheckboxEvents('containers', containers.map(c => c.id));
}

function renderImagesTable(images) {
  tableHead.innerHTML = `
    <tr>
      <th style="width: 5%"><input type="checkbox" id="chkAllTab"></th>
      <th style="width: 30%">Repository</th>
      <th style="width: 15%">Tag</th>
      <th style="width: 20%">Image ID</th>
      <th style="width: 15%">Size</th>
      <th style="width: 15%">Status</th>
    </tr>
  `;

  if (images.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="loading-cell">No images found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = images.map(img => {
    const isChecked = state.selectedImages.has(img.id);
    const badgeClass = img.dangling ? 'status-badge dangling' : 'status-badge running';
    return `
      <tr>
        <td><input type="checkbox" class="chk-item" data-id="${img.id}" ${isChecked ? 'checked' : ''}></td>
        <td><span class="asset-id">${escapeHtml(img.repository)}</span></td>
        <td><code>${escapeHtml(img.tag)}</code></td>
        <td><code>${escapeHtml(img.id.slice(0, 12))}</code></td>
        <td>${escapeHtml(img.size)}</td>
        <td><span class="${badgeClass}">${img.dangling ? 'DANGLING' : 'IN USE'}</span></td>
      </tr>
    `;
  }).join('');

  bindCheckboxEvents('images', images.map(i => i.id));
}

function renderVolumesTable(volumes) {
  tableHead.innerHTML = `
    <tr>
      <th style="width: 5%"><input type="checkbox" id="chkAllTab"></th>
      <th style="width: 45%">Volume Name</th>
      <th style="width: 20%">Driver</th>
      <th style="width: 15%">Estimated Size</th>
      <th style="width: 15%">Status</th>
    </tr>
  `;

  if (volumes.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" class="loading-cell">No volumes found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = volumes.map(v => {
    const isChecked = state.selectedVolumes.has(v.name);
    return `
      <tr>
        <td><input type="checkbox" class="chk-item" data-id="${v.name}" ${isChecked ? 'checked' : ''}></td>
        <td><span class="asset-id">${escapeHtml(v.name)}</span></td>
        <td><code>${escapeHtml(v.driver)}</code></td>
        <td>${escapeHtml(v.size)}</td>
        <td><span class="status-badge ${v.inUse ? 'running' : 'stopped'}">${v.inUse ? 'IN USE' : 'UNUSED'}</span></td>
      </tr>
    `;
  }).join('');

  bindCheckboxEvents('volumes', volumes.map(v => v.name));
}

function renderCacheTable(buildCache) {
  tableHead.innerHTML = `
    <tr>
      <th style="width: 5%"><input type="checkbox" id="chkAllTab" ${state.selectedCache ? 'checked' : ''}></th>
      <th style="width: 35%">Cache Layer ID</th>
      <th style="width: 25%">Type</th>
      <th style="width: 20%">Size</th>
      <th style="width: 15%">Status</th>
    </tr>
  `;

  if (buildCache.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" class="loading-cell">Build cache is clean.</td></tr>`;
    return;
  }

  tableBody.innerHTML = buildCache.map(b => {
    return `
      <tr>
        <td><input type="checkbox" class="chk-cache" ${state.selectedCache ? 'checked' : ''}></td>
        <td><span class="asset-id">${escapeHtml(b.id)}</span></td>
        <td><code>${escapeHtml(b.type)}</code></td>
        <td>${escapeHtml(b.size)}</td>
        <td><span class="status-badge dangling">RECLAIMABLE</span></td>
      </tr>
    `;
  }).join('');

  const chkAllTab = document.getElementById('chkAllTab');
  if (chkAllTab) {
    chkAllTab.addEventListener('change', (e) => {
      state.selectedCache = e.target.checked;
      renderTable();
    });
  }

  tableBody.querySelectorAll('.chk-cache').forEach(el => {
    el.addEventListener('change', (e) => {
      state.selectedCache = e.target.checked;
    });
  });
}

function bindCheckboxEvents(category, allIds) {
  const set = category === 'containers' ? state.selectedContainers : category === 'images' ? state.selectedImages : state.selectedVolumes;

  tableBody.querySelectorAll('.chk-item').forEach(el => {
    el.addEventListener('change', (e) => {
      const id = el.dataset.id;
      if (e.target.checked) set.add(id);
      else set.delete(id);
    });
  });

  const chkAllTab = document.getElementById('chkAllTab');
  if (chkAllTab) {
    chkAllTab.addEventListener('change', (e) => {
      if (e.target.checked) {
        allIds.forEach(id => set.add(id));
      } else {
        set.clear();
      }
      renderTable();
    });
  }
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Prune Trigger
btnPruneSelected.addEventListener('click', async () => {
  const cArr = Array.from(state.selectedContainers);
  const iArr = Array.from(state.selectedImages);
  const vArr = Array.from(state.selectedVolumes);
  const cache = state.selectedCache;

  if (cArr.length === 0 && iArr.length === 0 && vArr.length === 0 && !cache) {
    showToast('Please select at least one stopped container, dangling image, volume, or cache layer to reclaim.', 'info');
    return;
  }

  try {
    btnPruneSelected.disabled = true;
    btnPruneSelected.textContent = 'Reclaiming...';

    const res = await fetch('/api/prune', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        containers: cArr,
        images: iArr,
        volumes: vArr,
        buildCache: cache,
        force: true
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    state.selectedContainers.clear();
    state.selectedImages.clear();
    state.selectedVolumes.clear();
    state.selectedCache = false;

    showToast('Disk space successfully reclaimed!', 'success');
    await loadData();
  } catch (err) {
    showToast(`Prune error: ${err.message}`, 'error');
  } finally {
    btnPruneSelected.disabled = false;
    btnPruneSelected.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      Reclaim Selected Space
    `;
  }
});

// Event Listeners
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.activeTab = btn.dataset.tab;
    renderTable();
  });
});

selectAllCheckbox.addEventListener('change', (e) => {
  if (!state.data) return;
  const isChecked = e.target.checked;

  if (isChecked) {
    state.data.containers.filter(c => c.stopped).forEach(c => state.selectedContainers.add(c.id));
    state.data.images.filter(i => i.dangling).forEach(i => state.selectedImages.add(i.id));
    state.data.volumes.filter(v => !v.inUse).forEach(v => state.selectedVolumes.add(v.name));
    state.selectedCache = true;
  } else {
    state.selectedContainers.clear();
    state.selectedImages.clear();
    state.selectedVolumes.clear();
    state.selectedCache = false;
  }
  renderTable();
});

btnRefresh.addEventListener('click', loadData);

// Initial Load
loadData();
