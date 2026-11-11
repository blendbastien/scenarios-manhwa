/* Scénarios Manhwa — rendu partagé de la carte (outil MJ, calque joueur, journal). D'après TLH Générateur de Scénario v3.5. */
window.SM_CARD = (function () {
  const RANK_CLASSES = { F: 'rank-f', E: 'rank-e', D: 'rank-d', C: 'rank-c', B: 'rank-b', A: 'rank-a', S: 'rank-s', SS: 'rank-ss', SSS: 'rank-sss' };
  const RANKS = Object.keys(RANK_CLASSES);
  const RANK_SUB = { F: 'MENACE NÉGLIGEABLE', E: 'MENACE MINEURE', D: 'MENACE MODÉRÉE', C: 'MENACE SÉRIEUSE', B: 'MENACE ÉLEVÉE', A: 'MENACE CRITIQUE', S: 'MENACE EXTRÊME', SS: 'MENACE CATASTROPHIQUE', SSS: 'MENACE APOCALYPTIQUE' };
  const TYPES = ['PRINCIPAL', 'SECONDAIRE', 'CACHÉE', 'URGENCE', 'BOUNTY', 'TRAQUE', 'ÉVÉNEMENT', 'JOURNALIÈRE', 'INTERDIT'];
  const TYPE_LABELS = { PRINCIPAL: 'SCÉNARIO PRINCIPAL', SECONDAIRE: 'SCÉNARIO SECONDAIRE', CACHÉE: 'SCÉNARIO CACHÉ', URGENCE: 'URGENCE SYSTÈME', BOUNTY: 'CONTRAT DE CONSTELLATION', TRAQUE: 'TRAQUE — CIBLE DÉSIGNÉE', ÉVÉNEMENT: 'ÉVÉNEMENT MONDIAL', JOURNALIÈRE: 'QUÊTE JOURNALIÈRE', INTERDIT: 'SCÉNARIO INTERDIT' };
  const TYPE_SHORT = { PRINCIPAL: 'Principal', SECONDAIRE: 'Secondaire', CACHÉE: 'Caché', URGENCE: 'Urgence', BOUNTY: 'Bounty', TRAQUE: 'Traque', ÉVÉNEMENT: 'Événement', JOURNALIÈRE: 'Journalière', INTERDIT: 'Interdit' };
  const TYPE_SYSMSG = { PRINCIPAL: '[ Un nouveau scénario principal est arrivé. ]', SECONDAIRE: '[ Un scénario secondaire a été ajouté. ]', CACHÉE: '[ Vous avez découvert un scénario caché. ]', URGENCE: '[ Alerte. Un scénario d’urgence a été déclenché. ]', BOUNTY: '[ Une constellation a émis un contrat à votre attention. ]', TRAQUE: '[ Une cible vous a été désignée. ]', ÉVÉNEMENT: '[ Un événement mondial commence. Tous les incarnés sont concernés. ]', JOURNALIÈRE: '[ Le scénario journalier a été renouvelé. ]', INTERDIT: '[ Avertissement : ce scénario contrevient aux lois du Bureau. ]' };
  const TYPE_STATUS = { PRINCIPAL: 'ACTIF', SECONDAIRE: 'ACTIF', CACHÉE: 'DISSIMULÉ', URGENCE: 'CRITIQUE', BOUNTY: 'CONTRAT OUVERT', TRAQUE: 'CIBLE VERROUILLÉE', ÉVÉNEMENT: 'EN COURS', JOURNALIÈRE: 'RENOUVELÉ', INTERDIT: 'PROSCRIT' };
  const STATUS = { upcoming: 'À VENIR', active: 'EN COURS', done: 'TERMINÉ', failed: 'ÉCHOUÉ' };
  const STATUS_SYSMSG = { done: '[ Scénario accompli. Les récompenses ont été calculées. ]', failed: '[ Scénario échoué. La pénalité s’applique. ]', upcoming: '[ Ce scénario n’a pas encore commencé. ]' };
  const WORLD_REFS = { eos: ['EX-441007', 'EOS', '#ffd070'], andromeda: ['EX-788210', 'ANDROMEDA', '#1ad4f0'], clockwork: ['EX-902113', 'CLOCKWORK', '#ffcc60'], cordelia: ['EX-155674', 'CORDELIA', '#70f088'], eryndor: ['EX-663098', 'ERYNDOR', '#ff6070'], hyperion: ['EX-217455', 'HYPERION', '#80aaff'], inertia: ['EX-580341', 'INERTIA', '#cc88ff'], nova: ['EX-096872', 'NOVA', '#00eeff'], triangulum: ['EX-734519', 'TRIANGULUM', '#ee60ff'] };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function worldRef(s) {
    if (s.monde === 'custom' || String(s.monde || '').startsWith('p:')) return [(s.wcode || 'EX-??????').toUpperCase(), (s.wname || 'MONDE INCONNU').toUpperCase(), s.wcol || '#8fd4ff'];   /* 2.0 : planète de la Carte stellaire = « p:<id> » */
    return WORLD_REFS[s.monde] || WORLD_REFS.eos;
  }
  function starCluster(seedStr) {
    let seed = 0; for (const ch of String(seedStr || '')) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    let a = seed || 1; const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
    const pts = []; for (let i = 0; i < 14; i++) pts.push([20 + rnd() * 390, 20 + rnd() * 560]);
    let s = ''; for (let i = 0; i < pts.length; i++) { const p = pts[i]; s += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${(0.8 + rnd() * 1.6).toFixed(2)}"/>`; if (i) { const q = pts[i - 1]; if (rnd() < .7) s += `<path d="M${q[0].toFixed(1)} ${q[1].toFixed(1)} L${p[0].toFixed(1)} ${p[1].toFixed(1)}"/>`; } }
    return s;
  }
  /* ── compte à rebours : timer = { end: ms|null, pausedLeft: ms|null } ── */
  function timerLeft(s) { const t = s && s.timer; if (!t || (t.end == null && t.pausedLeft == null)) return null; if (t.pausedLeft != null) return t.pausedLeft; return t.end - Date.now(); }
  /* unités d'affichage : la plus grande absorbe tout ce qui est au-dessus, les unités non cochées se replient dans la plus petite cochée */
  const UNITS = [['y', 31536000000, 'a'], ['M', 2592000000, 'mois'], ['w', 604800000, 'sem'], ['d', 86400000, 'j'], ['h', 3600000, 'h'], ['m', 60000, 'min'], ['s', 1000, 's']];
  const DEFAULT_UNITS = ['d', 'h', 'm', 's'];
  function fmtLeft(ms, units) {
    if (ms == null) return ''; if (ms <= 0) return 'TEMPS ÉCOULÉ';
    units = (units && units.length) ? units : DEFAULT_UNITS; const p = n => String(n).padStart(2, '0');
    let rem = Math.floor(ms / 1000) * 1000; const parts = []; const sel = UNITS.filter(u => units.includes(u[0]));
    sel.forEach((u, i) => { const v = i === sel.length - 1 ? Math.floor(rem / u[1]) : Math.floor(rem / u[1]); rem -= v * u[1]; parts.push([u[0], v, u[2]]); });
    /* heures, minutes, secondes cochées à la suite → horloge HH:MM:SS */
    const tail = parts.slice(-3).map(x => x[0]).join('');
    const trim = arr => { let i = 0; while (i < arr.length - 1 && arr[i][1] === 0) i++; return arr.slice(i); }; /* pas de zéros en tête */
    if (tail === 'hms') { const head = trim(parts.slice(0, -3)).filter(x => x[1] > 0).map(x => x[1] + x[2]); const [h, m, sec] = parts.slice(-3).map(x => x[1]); return (head.length ? head.join(' ') + ' ' : '') + p(h) + ':' + p(m) + ':' + p(sec); }
    return trim(parts).map(x => x[1] + ' ' + x[2]).join(' ');
  }
  /* "48 heures", "3 jours", "90 min", "2h30" → ms (ou null) */
  function parseDuration(txt) {
    const t = String(txt || '').toLowerCase().replace(/,/g, '.'); let ms = 0, found = false;
    const re = /(\d+(?:\.\d+)?)\s*(jours?|j\b|heures?|h\b|minutes?|min\b|m\b|secondes?|s\b)/g; let x;
    while ((x = re.exec(t))) { const n = parseFloat(x[1]), u = x[2][0]; ms += n * (u === 'j' ? 86400000 : u === 'h' ? 3600000 : u === 'm' ? 60000 : 1000); found = true; }
    const hm = /(\d+)h(\d{1,2})/.exec(t); if (hm && !found) { ms = (+hm[1]) * 3600000 + (+hm[2]) * 60000; found = true; }
    return found && ms > 0 ? ms : null;
  }
  function timerHTML(s) {
    const left = timerLeft(s); if (left == null) return esc(s.time || '');
    const t = s.timer; const units = (s.timerUnits && s.timerUnits.length) ? s.timerUnits : DEFAULT_UNITS; const attrs = `data-timer="1" data-end="${t.end || ''}" data-paused="${t.pausedLeft != null ? t.pausedLeft : ''}" data-units="${units.join(',')}"`;
    return `<span class="c-countdown${left <= 0 ? ' expired' : ''}${t.pausedLeft != null ? ' paused' : ''}" ${attrs}>${fmtLeft(left, units)}</span>${t.pausedLeft != null ? '<span class="c-cd-tag">PAUSE</span>' : ''}`;
  }
  /* met à jour tous les comptes à rebours affichés (appelé chaque seconde par le module) */
  function tick(root) {
    (root || document).querySelectorAll('.c-countdown[data-timer]').forEach(el => { if (el.dataset.paused !== '') return; const end = Number(el.dataset.end); if (!end) return; const left = end - Date.now(); el.textContent = fmtLeft(left, (el.dataset.units || '').split(',').filter(Boolean)); el.classList.toggle('expired', left <= 0); });
  }
  function normalize(s) {
    s = Object.assign({ type: 'PRINCIPAL', num: 1, rang: 'S', monde: 'eos', status: 'active', visible: true, titreCol: '#ffffff' }, s || {});
    if (!TYPES.includes(s.type)) s.type = 'PRINCIPAL';
    if (!RANKS.includes(s.rang)) s.rang = 'F';
    if (!STATUS[s.status]) s.status = 'active';
    if (!s.ref) s.ref = '0000';
    return s;
  }
  /* HTML complet de la carte. opts : {id, cls, appear:true} */
  function html(s0, opts) {
    const s = normalize(s0); opts = opts || {};
    const hasCible = s.type === 'BOUNTY' || s.type === 'TRAQUE';
    const ref = String(s.ref || '0000').toUpperCase();
    const wr = worldRef(s);
    const sysmsg = (s.sysmsg || '').trim();
    const msg = sysmsg ? (sysmsg.startsWith('[') ? sysmsg : `[ ${sysmsg} ]`) : (s.status !== 'active' ? STATUS_SYSMSG[s.status] : '');
    const statusTxt = s.status === 'active' ? (TYPE_STATUS[s.type] || 'ACTIF') : STATUS[s.status];
    const titre = (s.titre || '').toUpperCase();
    const tc = s.titreCol || '#ffffff';
    const rangCls = s.rang.length === 2 ? ' s2' : s.rang.length === 3 ? ' s3' : '';
    return `<div ${opts.id ? `id="${opts.id}"` : ''} class="sm-card ${RANK_CLASSES[s.rang]} type-${s.type} st-${s.status} ${opts.cls || ''}" data-sid="${esc(s.id || '')}">
      <div class="c-aurora"></div><div class="c-light"></div><div class="c-hex"></div><div class="c-grain"></div><div class="c-lines"></div><div class="c-veil"></div>
      <svg class="c-globe" viewBox="0 0 200 200"><circle cx="100" cy="100" r="80"/><ellipse cx="100" cy="100" rx="80" ry="30"/><ellipse cx="100" cy="100" rx="30" ry="80"/><ellipse cx="100" cy="100" rx="80" ry="60"/><ellipse cx="100" cy="100" rx="60" ry="80"/><path d="M20 100 H180 M100 20 V180" stroke="#fff" stroke-width="1"/></svg>
      <svg class="c-starcluster" viewBox="0 0 430 600" preserveAspectRatio="none">${hasCible ? starCluster(ref + (s.cible || '')) : ''}</svg>
      <div class="c-scan"></div><div class="c-typeband"></div><div class="c-frame-a"></div><div class="c-frame-b"></div>
      <div class="c-corner tl"></div><div class="c-corner tr"></div><div class="c-corner bl"></div><div class="c-corner br"></div>
      <div class="c-corner2 tl"></div><div class="c-corner2 tr"></div><div class="c-corner2 bl"></div><div class="c-corner2 br"></div>
      <div class="c-px"></div><div class="c-px"></div><div class="c-px"></div><div class="c-px"></div><div class="c-px"></div><div class="c-px"></div><div class="c-px"></div>
      <div class="c-side l"><div class="c-side-bar"></div></div><div class="c-side r"><div class="c-side-bar"></div></div>
      <div class="c-ticks l"></div><div class="c-ticks r"></div>
      <div class="c-stamp">HORS-LOI</div><div class="c-daily">RENOUVELÉ · 24H</div>
      ${s.status !== 'active' ? `<div class="c-statusstamp st-${s.status}">${STATUS[s.status]}</div>` : ''}
      <div class="c-inner">
        <div class="c-sysbar"><div class="c-sysbar-dot"></div><div class="c-sysbar-id">SYS::SCENARIO_ALERT · ID#${esc(ref)}</div><div class="c-sysbar-status">${esc(statusTxt)}</div><div class="c-winbtns"><div class="c-wb" title="Réduire"><svg viewBox="0 0 10 10"><path d="M2 5h6"/></svg></div><div class="c-wb" title="Agrandir"><svg viewBox="0 0 10 10"><path d="M2 2h6v6H2z"/></svg></div><div class="c-wb c-close" data-close="1" title="Fermer"><svg viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6"/></svg></div></div></div>
        <div class="c-sysmsg">${esc(msg)}</div>
        <div class="c-header">
          <div class="c-cat-tag">${esc(TYPE_LABELS[s.type] || s.type)}</div>
          <div class="c-num-wrap ${s.type === 'PRINCIPAL' ? 'visible' : ''}"><span class="c-num-prefix">— N°</span><span class="c-num-val" style="${/^1+$/.test(String(s.num || '').trim()) ? 'transform:translateX(-0.035em)' : ''}">${esc(s.num || 1)}</span></div>
          <div class="c-title ${s.type === 'PRINCIPAL' ? 'big' : 'normal'}" style="color:${esc(tc)};text-shadow:0 0 15px ${esc(tc)}66,0 0 40px ${esc(tc)}22">${s.type === 'PRINCIPAL' ? esc(titre) : (titre ? `‹ ${esc(titre)} ›` : '')}</div>
          <div class="c-header-line"><div class="c-header-line-bar"></div><div class="c-header-line-diamond"></div><div class="c-header-line-bar r"></div></div>
          <div class="c-rank-emblem"><div class="c-hex-wrap"><svg viewBox="0 0 46 52"><g class="ring"><path d="M23 1 L44 13 L44 39 L23 51 L2 39 L2 13 Z" fill="none" stroke="var(--rank-color)" stroke-width="1" stroke-dasharray="4 3" opacity=".55"/></g><path d="M23 5 L40.5 15 L40.5 37 L23 47 L5.5 37 L5.5 15 Z" fill="rgba(255,255,255,.05)" stroke="var(--rank-color)" stroke-width="1.6"/><path d="M23 10 L36 17.5 L36 34.5 L23 42 L10 34.5 L10 17.5 Z" fill="none" stroke="var(--rank-color)" stroke-width=".6" opacity=".5"/></svg><div class="c-hex-letter${rangCls}">${esc(s.rang)}</div></div><div><div class="c-rang-badge">RANG ${esc(s.rang)}</div><span class="c-rank-sub">${esc(RANK_SUB[s.rang] || 'DIFFICULTÉ ÉVALUÉE')}</span></div></div>
        </div>
        <div class="c-bounty-target ${hasCible ? 'visible' : ''}"><svg class="c-reticle" viewBox="0 0 170 170"><g class="spin"><circle cx="85" cy="85" r="80" stroke-dasharray="6 8"/><circle cx="85" cy="85" r="60"/></g><path d="M85 0 V30 M85 140 V170 M0 85 H30 M140 85 H170"/><circle cx="85" cy="85" r="10"/></svg><div class="c-bounty-target-label">${s.type === 'TRAQUE' ? 'Cible verrouillée' : 'Cible désignée'}</div><div class="c-bounty-target-name">${esc(s.cible || '—')}</div></div>
        <div class="c-constellation-row ${s.type === 'BOUNTY' && s.constellation ? 'visible' : ''}"><div class="c-constellation-val">${esc(s.constellation || '')}</div></div>
        <div class="c-div"></div>
        <div class="c-fields">
          <div class="c-field success"><div class="c-field-lbl"><span class="ic">◈</span>Réussite</div><div class="c-field-val success">${esc(s.success || '')}</div></div>
          <div class="c-field danger"><div class="c-field-lbl"><span class="ic">✕</span>Échec</div><div class="c-field-val danger">${esc(s.fail || '')}</div></div>
          <div class="c-field time"><div class="c-field-lbl"><span class="ic">◷</span>Limite</div><div class="c-field-val time">${timerHTML(s)}</div></div>
          <div class="c-field reward"><div class="c-field-lbl"><span class="ic">✦</span>Récompense</div><div class="c-field-val reward">${esc(s.rewards || '')}</div></div>
        </div>
        <div class="c-footer"><div class="c-footer-code">0x${esc(ref)} · ${esc(TYPE_SHORT[s.type] || '')}${s.type === 'PRINCIPAL' ? ' ' + esc(s.num || 1) : ''}</div></div>
      </div>
    </div>`;
  }
  /* tri : type (ordre canonique) puis numéro puis titre */
  function sortKey(s) { return [TYPES.indexOf(s.type), Number(s.num) || 0, (s.titre || '').toLowerCase()]; }
  function compare(a, b) { const A = sortKey(a), B = sortKey(b); for (let i = 0; i < 3; i++) { if (A[i] < B[i]) return -1; if (A[i] > B[i]) return 1; } return 0; }
  function genRef() { const len = 4 + Math.floor(Math.random() * 3); let r = ''; const H = '0123456789ABCDEF'; for (let i = 0; i < len; i++) r += H[Math.floor(Math.random() * 16)]; return r; }
  return { html, normalize, worldRef, compare, genRef, esc, timerLeft, fmtLeft, parseDuration, tick, UNITS, DEFAULT_UNITS, RANKS, TYPES, TYPE_LABELS, TYPE_SHORT, TYPE_SYSMSG, TYPE_STATUS, STATUS, STATUS_SYSMSG, WORLD_REFS, RANK_SUB };
})();
