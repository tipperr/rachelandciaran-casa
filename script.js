const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSv21AONKOgZAmBybcog5R9Gl83LZB_GMNg8A_HAkXJnvtkAuLz6kQ7cCTG5WwoHK_6p43q06xVTB-s/pub?output=csv';

// ─── CSV Parser (RFC 4180) ────────────────────────────────────────────────────

function parseCSV(text) {
  const rows = []; let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i+1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function csvToObjects(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(row => row.some(cell => cell.trim() !== ''))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (row[i] || '').trim(); });
      return obj;
    });
}

// ─── Data Mapping ─────────────────────────────────────────────────────────────

function mapPerson(raw) {
  return {
    name:       raw['Unique Name'] || '',
    nights:     parseInt(raw['Total Days'], 10) || 0,
    visits:     parseInt(raw['Total Visits'], 10) || 0,
    photo_url:  rewriteDriveUrl(raw['Photo URL'] || ''),
    badge:      raw['Tier'] || '',
    last_visit: raw['Last Visit'] || '',
    subtitle:   raw['Subtitle'] || '',
  };
}

function rewriteDriveUrl(url) {
  // Drive URLs are no longer used — photos are hosted in the repo's photos/ directory.
  // This function is kept as a passthrough for any non-Drive URLs.
  return url;
}

function sortPeople(people) {
  return [...people].sort((a, b) => {
    if (b.nights !== a.nights) return b.nights - a.nights;
    if (b.visits !== a.visits) return b.visits - a.visits;
    return 0; // sheet row order preserved as fallback
  });
}

// ─── Relative Time ────────────────────────────────────────────────────────────

function relativeTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr; // non-parseable: display as-is
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return '1 week ago';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return '1 month ago';
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ─── Initials Avatar ─────────────────────────────────────────────────────────

function initialsAvatar(name, size = 48) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#cc0000','#9b1d1d','#7a2020','#b34040','#8c2020'];
  const color = colors[name.charCodeAt(0) % colors.length];
  const el = document.createElement('div');
  el.className = 'avatar-initials';
  el.style.cssText = `width:${size}px;height:${size}px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:${Math.floor(size * 0.38)}px;color:#fff;flex-shrink:0;`;
  el.textContent = initials;
  return el;
}

function makePhoto(person, size) {
  if (!person.photo_url) return initialsAvatar(person.name, size);
  const img = document.createElement('img');
  img.src = person.photo_url;
  img.alt = `${person.name}'s photo`;
  img.width = size;
  img.height = size;
  img.style.cssText = `width:${size}px;height:${size}px;object-fit:cover;border-radius:50%;flex-shrink:0;`;
  img.onerror = () => img.replaceWith(initialsAvatar(person.name, size));
  return img;
}

// ─── Render: Header ───────────────────────────────────────────────────────────

function renderHeader(people) {
  const totalNights = people.reduce((s, p) => s + p.nights, 0);
  const el = document.getElementById('live-counter');
  // Counter animates in startAnimations(); set final values here for reference
  el.dataset.competitors = people.length;
  el.dataset.nights = totalNights;
  el.textContent = `${people.length} competitors · ${totalNights} nights · 0 of them rewarded`;
}

// ─── Render: Podium ───────────────────────────────────────────────────────────

function renderPodium(sorted) {
  const podium = document.getElementById('podium');
  podium.innerHTML = '';

  const top = sorted.slice(0, Math.min(3, sorted.length));
  // Display order: Silver (1), Gold (0), Bronze (2)
  const displayOrder = top.length === 1 ? [0] :
                       top.length === 2 ? [1, 0] :
                       [1, 0, 2];

  const maxNights = top[0].nights;
  const maxBarHeight = 120;
  const minBarHeight = 30;

  displayOrder.forEach(idx => {
    const person = top[idx];
    const rank = idx + 1;
    const label = ['🥇 GOLD', '🥈 SILVER', '🥉 BRONZE'][idx];
    const barH = idx === 0 ? maxBarHeight
               : Math.max(minBarHeight, Math.round((person.nights / maxNights) * maxBarHeight * 0.75));

    const slot = document.createElement('div');
    slot.className = `podium-slot podium-rank-${rank}`;
    slot.setAttribute('aria-label', `${rank === 1 ? 'Champion' : rank === 2 ? 'Second place' : 'Third place'}: ${person.name}, ${person.nights} nights`);

    const photoEl = makePhoto(person, rank === 1 ? 80 : 64);

    const nameEl = document.createElement('div');
    nameEl.className = 'podium-name';
    nameEl.textContent = person.name;

    const nightsEl = document.createElement('div');
    nightsEl.className = 'podium-nights';
    nightsEl.textContent = `${person.nights} nights`;

    const labelEl = document.createElement('div');
    labelEl.className = 'podium-label';
    labelEl.textContent = label;

    const bar = document.createElement('div');
    bar.className = 'podium-bar';
    bar.style.height = `${barH}px`;

    slot.append(photoEl, nameEl, nightsEl, labelEl, bar);
    if (person.subtitle) {
      const subtitleEl = document.createElement('div');
      subtitleEl.className = 'podium-subtitle';
      subtitleEl.textContent = person.subtitle;
      slot.appendChild(subtitleEl);
    }
    podium.appendChild(slot);
  });
}

// ─── Render: Table ────────────────────────────────────────────────────────────

function renderTable(sorted) {
  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '';

  sorted.forEach((person, i) => {
    const rank = i + 1;
    const tr = document.createElement('tr');
    tr.dataset.name = person.name.toLowerCase();
    if (rank === 1) tr.classList.add('rank-1');
    else if (rank === 2) tr.classList.add('rank-2');
    else if (rank === 3) tr.classList.add('rank-3');
    tr.style.animationDelay = `${Math.min(i * 30, 300)}ms`;

    const rankTd = document.createElement('td');
    rankTd.className = 'col-rank';
    rankTd.textContent = rank;

    const photoTd = document.createElement('td');
    photoTd.className = 'col-photo';
    photoTd.appendChild(makePhoto(person, 36));

    const nameTd = document.createElement('td');
    nameTd.className = 'col-name';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'person-name';
    nameSpan.textContent = person.name;
    nameTd.appendChild(nameSpan);
    if (person.subtitle) {
      const sub = document.createElement('span');
      sub.className = 'person-subtitle';
      sub.textContent = person.subtitle;
      nameTd.appendChild(sub);
    }

    const nightsTd = document.createElement('td');
    nightsTd.className = 'col-nights';
    nightsTd.textContent = person.nights;

    const visitsTd = document.createElement('td');
    visitsTd.className = 'col-visits';
    visitsTd.textContent = person.visits;

    const badgeTd = document.createElement('td');
    badgeTd.className = 'col-badge';
    badgeTd.textContent = person.badge;

    const lastTd = document.createElement('td');
    lastTd.className = 'col-last';
    lastTd.textContent = relativeTime(person.last_visit);

    tr.append(rankTd, photoTd, nameTd, nightsTd, visitsTd, badgeTd, lastTd);
    tbody.appendChild(tr);
  });
}

// ─── Person Card ──────────────────────────────────────────────────────────────

function personalGapSentence(sorted, person, rank) {
  const leader = sorted[0];
  const tiedAtTop = sorted.filter(p => p.nights === leader.nights);
  if (rank === 1 && tiedAtTop.length === 1) return "You're in the lead. Defend it.";
  if (tiedAtTop.includes(person)) {
    const others = tiedAtTop.filter(p => p !== person).map(p => p.name);
    const last = others.pop();
    const names = others.length ? `${others.join(', ')} and ${last}` : last;
    return `You're tied at the top with ${names}.`;
  }
  const gap = leader.nights - person.nights;
  const leaderNames = tiedAtTop.length > 1 ? 'the leaders' : leader.name;
  return `You need ${gap} more night${gap === 1 ? '' : 's'} to challenge ${leaderNames}.`;
}

function renderPersonCard(sorted, person, rank) {
  const section = document.getElementById('person-section');
  const container = document.getElementById('person-card');
  container.innerHTML = '';

  const borderColor = rank === 1 ? 'var(--accent)' : rank === 2 ? 'var(--silver)' : rank === 3 ? 'var(--bronze)' : 'var(--border)';

  const card = document.createElement('div');
  card.className = 'person-card';
  card.style.borderLeftColor = borderColor;

  const photoEl = makePhoto(person, 72);

  const info = document.createElement('div');
  info.className = 'person-card-info';

  const nameEl = document.createElement('div');
  nameEl.className = 'person-card-name';
  nameEl.textContent = person.name;

  const meta = document.createElement('div');
  meta.className = 'person-card-meta';
  meta.textContent = `${person.badge ? person.badge + ' ' : ''}${person.nights} night${person.nights !== 1 ? 's' : ''} · ${person.visits} visit${person.visits !== 1 ? 's' : ''} · last visit ${relativeTime(person.last_visit)}`;

  const sentence = document.createElement('div');
  sentence.className = 'person-card-sentence';
  sentence.textContent = personalGapSentence(sorted, person, rank);

  info.append(nameEl, meta, sentence);

  const rankEl = document.createElement('div');
  rankEl.className = 'person-card-rank';
  rankEl.textContent = `#${rank}`;

  card.append(photoEl, info, rankEl);
  container.appendChild(card);
  section.hidden = false;
}

// ─── ?person= Highlight ───────────────────────────────────────────────────────

function applyPersonParam(sorted) {
  const param = new URLSearchParams(window.location.search).get('person');
  if (!param) return;
  const target = param.toLowerCase();

  const idx = sorted.findIndex(p => p.name.toLowerCase() === target);
  if (idx !== -1) {
    const person = sorted[idx];
    const rank = idx + 1;
    renderPersonCard(sorted, person, rank);
    document.title = `${person.name} · #${rank} · ${person.nights} night${person.nights !== 1 ? 's' : ''}`;
  }

  const row = document.querySelector(`tr[data-name="${CSS.escape(target)}"]`);
  if (!row) return;
  row.classList.add('highlighted');
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ─── Animations ───────────────────────────────────────────────────────────────

function startAnimations(people) {
  // Counting counter
  const el = document.getElementById('live-counter');
  const targetCompetitors = parseInt(el.dataset.competitors, 10);
  const targetNights = parseInt(el.dataset.nights, 10);
  const duration = 800;
  const start = performance.now();

  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
    const c = Math.round(ease * targetCompetitors);
    const n = Math.round(ease * targetNights);
    el.textContent = `${c} competitor${c !== 1 ? 's' : ''} · ${n} night${n !== 1 ? 's' : ''} · 0 of them rewarded`;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // Table row slide-in is handled by CSS animation (class 'animate' triggers it)
  document.getElementById('leaderboard-body').classList.add('animate');
}

// ─── Skeleton & Error ─────────────────────────────────────────────────────────

function showSkeleton() {
  document.getElementById('skeleton').hidden = false;
  document.getElementById('content').hidden = true;
  document.getElementById('error-state').hidden = true;
}

function showContent() {
  document.getElementById('skeleton').hidden = true;
  document.getElementById('content').hidden = false;
  document.getElementById('error-state').hidden = true;
}

function showError() {
  document.getElementById('skeleton').hidden = true;
  document.getElementById('content').hidden = true;
  document.getElementById('error-state').hidden = false;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function fetchAndRender() {
  showSkeleton();
  try {
    const res = await fetch(SHEET_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const rows = parseCSV(text);
    const objects = csvToObjects(rows);
    const people = objects.map(mapPerson).filter(p => p.name !== '');
    const sorted = sortPeople(people);

    renderHeader(sorted);
    renderPodium(sorted);
    renderTable(sorted);
    showContent();
    startAnimations(sorted);
    applyPersonParam(sorted);
  } catch (err) {
    console.error('Failed to load leaderboard:', err);
    showError();
  }
}

document.getElementById('retry-btn').addEventListener('click', fetchAndRender);
fetchAndRender();
