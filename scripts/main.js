/* Scénarios Manhwa — The Last Horizon (Foundry v13) : outil MJ, calque joueur, journal des scénarios, récompenses. */
const MID = "scenarios-manhwa";
const SOCKET = `module.${MID}`;
const { ApplicationV2 } = foundry.applications.api;
const C = () => window.SM_CARD;

/* ═══════════ réglages ═══════════ */
Hooks.once("init", () => {
  const R = (k, o) => game.settings.register(MID, k, o);
  R("scenarios", { scope: "world", config: false, type: Array, default: [] });
  R("playersSeeDone", { name: "Les joueurs voient les scénarios terminés", hint: "Si activé, les scénarios terminés ou échoués marqués « visible » restent consultables dans le journal des joueurs.", scope: "world", config: true, type: Boolean, default: true });
  R("playersCanOpen", { name: "Les joueurs peuvent ouvrir le journal des scénarios", scope: "world", config: true, type: Boolean, default: true });
  R("sidebarButtons", { name: "Boutons dans la barre latérale", hint: "Affiche les boutons Journal des scénarios / Tableau MJ en haut de l'onglet Journal et/ou Objets. Désactivé par défaut (les contrôles de scène restent).", scope: "world", config: true, type: String, choices: { none: "Masqués (défaut)", journal: "Onglet Journal", items: "Onglet Objets", both: "Journal et Objets" }, default: "none", onChange: () => { ui.journal?.render(); ui.items?.render(); } });
  R("notifyStatus", { name: "Notifier les changements de statut", hint: "Quand un scénario passe en cours / terminé / échoué, une notification est envoyée aux joueurs (via Notifications Manhwa si le module est actif, sinon la carte du scénario est ré-affichée).", scope: "world", config: true, type: Boolean, default: true });
  R("statusText", { name: "Texte de notification — statut", hint: "Variables : {titre} {type} {num} {statut}", scope: "world", config: true, type: String, default: "[ {type} « {titre} » : {statut}. ]" });
  R("rewardText", { name: "Texte de notification — récompense", hint: "Variables : {titre} {perso} {gold} {pi} {objets}", scope: "world", config: true, type: String, default: "[ {perso} reçoit {gold} G · {pi} P.I. · {objets} pour « {titre} ». ]" });
  R("goldPath", { name: "Champ du Gold", hint: "Manhwa Sheet : clé ou nom de la monnaie (vide = le Gold de la fiche). Custom System Builder : clé system.props.<clé>.", scope: "world", config: true, type: String, default: "" });
  R("piPath", { name: "Champ des P.I. (Pièces Interstellaires)", hint: "Manhwa Sheet : clé ou nom de la monnaie (pi par défaut). Custom System Builder : clé system.props.<clé>.", scope: "world", config: true, type: String, default: "pi" });
  R("dimBackground", { name: "Assombrir l'écran derrière la carte", scope: "client", config: true, type: Boolean, default: true });
  R("duration", { name: "Durée d'affichage de la carte (s) · 0 = jusqu'au clic", scope: "world", config: true, type: Number, default: 0 });
  R("position", { name: "Position de la carte", scope: "world", config: true, type: String, choices: { center: "Centre", top: "Haut", bottom: "Bas" }, default: "center" });
  R("scale", { name: "Échelle de la carte (%)", scope: "client", config: true, type: Number, default: 115 });
  R("soundName", { name: "Son à l'affichage", hint: "Même bibliothèque que les notifications. « Aucun » pour couper.", scope: "world", config: true, type: String, choices: { none: "Aucun", doux: "Doux", systeme: "Système", cloche: "Cloche", neutre: "Neutre", mystique: "Mystique", upbeat: "Entrain", victoire: "Victoire", alerte: "Alerte", danger: "Danger", echec: "Échec", sombre: "Sombre", ominous: "Menaçant", abysse: "Abysse", tambour: "Tambour", glitch: "Glitch" }, default: "doux" });
  R("sound", { name: "Son personnalisé (chemin Foundry, prioritaire s'il est rempli)", scope: "world", config: true, type: String, default: "" });
  R("soundOldIgnored", { name: "", scope: "world", config: false, type: String, default: `modules/${MID}/sounds/scenario.ogg`, filePicker: "audio" });
  R("volume", { name: "Volume (0–1)", scope: "client", config: true, type: Number, default: 0.35, range: { min: 0, max: 1, step: 0.05 } });
  R("chat", { name: "Copier la carte dans le chat à la diffusion", scope: "world", config: true, type: Boolean, default: true });
});

/* ═══════════ données ═══════════ */
const all = () => (game.settings.get(MID, "scenarios") || []).map(s => C().normalize(s));
async function saveAll(list) { await game.settings.set(MID, "scenarios", list); }
/* 2.0 — scénarios par Groupe MJ (Fiche Manhwa) : un scénario réservé n'est vu que par les joueurs de ce groupe */
const gmGroupList = () => { try { return globalThis.MANHWA?.gmGroups?.list() || []; } catch (e) { return []; } };
const myGmGroups = (user = game.user) => { try { return (globalThis.MANHWA?.gmGroups?.ofUser(user) || []).map(g => g.id); } catch (e) { return []; } };
const gmgUsers = gid => { try { const G = globalThis.MANHWA?.gmGroups; const g = G?.get(gid); if (!g) return null; return game.users.filter(u => !u.isGM && G.ofUser(u).some(x => x.id === gid)).map(u => u.id); } catch (e) { return null; } };
function visibleFor(user) {
  const list0 = all(); if (user.isGM) return list0; const mine = myGmGroups(user); const list = list0.filter(s => !s.gmg || !gmGroupList().some(g => g.id === s.gmg) || mine.includes(s.gmg));
  const seeDone = game.settings.get(MID, "playersSeeDone");
  return list.filter(s => s.status === "active" || (seeDone && s.visible !== false && (s.status === "done" || s.status === "failed"))).map(s => { const c = { ...s }; delete c.notes; delete c.rew; return c; });
}
/* chemin d'une monnaie sur la fiche : Manhwa Sheet (system.resources.<clé>) ou Custom System Builder (system.props.<clé>) */
const isMS = () => game.system.id === "manhwa-sheet" && typeof globalThis.MANHWA?.config === "function";
const nrm = v => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
function msRes(want, fallbackGold) { const r = (globalThis.MANHWA.config().resources || []); const n = nrm(want); return (n && r.find(x => nrm(x.key) === n || nrm(x.name) === n)) || (fallbackGold ? (r.find(x => nrm(x.key) === "gold" || nrm(x.name) === "gold") || r.find(x => x.paysStats) || r[0]) : null); }
function walletPath(kind) { if (isMS()) { const res = kind === "gold" ? msRes(game.settings.get(MID, "goldPath"), true) : msRes(game.settings.get(MID, "piPath") || "pi", false); return res ? `system.resources.${res.key}` : null; } return `system.props.${kind === "gold" ? goldPath() : game.settings.get(MID, "piPath")}`; }
function goldPath() { const g = game.settings.get(MID, "goldPath"); if (g) return g; try { return game.settings.get("fiche-manhwa", "goldPath") || "gold"; } catch (e) { return "gold"; } }
function playerActors() {
  return game.actors.filter(a => a.hasPlayerOwner && (!isMS() || a.type === "character")).map(a => {
    const owner = game.users.find(u => !u.isGM && a.testUserPermission(u, "OWNER"));
    const gp = goldPath(), pp = game.settings.get(MID, "piPath");
    return { id: a.id, name: a.name, img: a.img, owner: owner?.name || "", gold: walletPath("gold") ? (foundry.utils.getProperty(a, walletPath("gold")) ?? null) : null, pi: walletPath("pi") ? (foundry.utils.getProperty(a, walletPath("pi")) ?? null) : null };
  });
}
function users() { return game.users.filter(u => !u.isGM).map(u => ({ id: u.id, name: u.name, color: u.color?.toString?.() || u.color, active: u.active, chars: game.actors.filter(a => a.type === "character" && a.testUserPermission(u, "OWNER")).map(a => a.name) })); }
function catalogueList() {
  try { const cat = game.modules.get("last-horizon-catalogue"); if (!cat?.active || !cat.api?.getDB) return []; const db = cat.api.getDB() || {}; return (db.items || []).map(e => ({ id: e.id, n: e.n, rang: e.rang, t: e.t, price: e.price })); } catch (e) { return []; }
}

/* ═══════════ calque joueur ═══════════ */
let layerEl = null, hideTimer = null, queue = [], showing = false;
function layer() { if (layerEl) return layerEl; layerEl = document.createElement("div"); layerEl.id = "sm-layer"; document.body.appendChild(layerEl); return layerEl; }
function playSound() { let src = (game.settings.get(MID, "sound") || "").trim(); if (!src) { const n = game.settings.get(MID, "soundName"); if (!n || n === "none") return; src = `modules/${MID}/sounds/${n}.ogg`; } try { foundry.audio.AudioHelper.play({ src, volume: game.settings.get(MID, "volume"), autoplay: true, loop: false }, false); } catch (e) { try { AudioHelper.play({ src, volume: game.settings.get(MID, "volume"), autoplay: true, loop: false }, false); } catch (e2) {} } }
function showCard(scen, opts = {}) {
  if (showing) { queue.push([scen, opts]); return; }
  showing = true; const L = layer(); L.innerHTML = "";
  const dim = game.settings.get(MID, "dimBackground"); const pos = game.settings.get(MID, "position"); const scale = (game.settings.get(MID, "scale") || 100) / 100;
  if (dim) { const d = document.createElement("div"); d.className = "sm-dim"; L.appendChild(d); }
  const w = document.createElement("div"); w.className = `sm-wrap pos-${pos}`; w.style.transform = `scale(${scale})`;
  w.innerHTML = C().html(scen, { cls: "live" }) + `<div class="sm-hint">CLIQUER POUR FERMER · CONSULTABLE DANS LE JOURNAL DES SCÉNARIOS</div>`;
  L.appendChild(w);
  const close = () => { if (!showing) return; w.classList.add("out"); setTimeout(() => { L.innerHTML = ""; showing = false; if (queue.length) { const n = queue.shift(); showCard(n[0], n[1]); } }, 360); clearTimeout(hideTimer); };
  w.addEventListener("click", close); L.querySelector(".sm-dim")?.addEventListener("click", close);
  const dur = Number(game.settings.get(MID, "duration")) || 0; if (dur > 0) hideTimer = setTimeout(close, dur * 1000);
  if (!opts.silent) playSound();
}
function receive(p) {
  if (!p || p.type !== "show") return;
  const t = p.targets; if (t !== "all" && Array.isArray(t) && !t.includes(game.user.id) && !(game.user.isGM && p.gmToo)) return;
  if (game.user.isGM && !p.gmToo) return;
  showCard(p.scen);
  for (const app of Object.values(ui.windows)) if (app instanceof ScenJournal) app.render(false);
  foundry.applications.instances?.forEach?.(a => { if (a instanceof ScenJournal) a.render(false); });
}
function broadcast(scen, targets = "all", gmToo = true) {
  if (scen?.gmg && targets === "all") { const u = gmgUsers(scen.gmg); if (u) targets = u; }   /* scénario d'un Groupe MJ : seulement ses joueurs */
  const payload = { type: "show", scen, targets, gmToo };
  game.socket.emit(SOCKET, payload); receive(payload);
  if (game.settings.get(MID, "chat")) chatCard(scen);
}
function chatCard(s) {
  const wr = C().worldRef(s); const T = C().TYPE_LABELS[s.type] || s.type;
  const html = `<div class="sm-chat" style="border:1px solid #2a3c6a;border-left:4px solid ${wr[2]};border-radius:4px;padding:8px 10px;background:#070f20;color:#cfe0ff;font-family:'Signika',sans-serif">
    <div style="font-size:10px;letter-spacing:.2em;color:#38e0ff">${T}${s.type === "PRINCIPAL" ? " · N°" + s.num : ""} · RANG ${s.rang}</div>
    <div style="font-size:15px;font-weight:700;color:${s.titreCol || "#fff"};margin:3px 0">${foundry.utils.escapeHTML(s.titre || s.cible || "")}</div>
    ${s.success ? `<div><b style="color:#3dffa0">◈ Réussite :</b> ${foundry.utils.escapeHTML(s.success)}</div>` : ""}${s.fail ? `<div><b style="color:#ff4d6a">✕ Échec :</b> ${foundry.utils.escapeHTML(s.fail)}</div>` : ""}${s.time ? `<div><b style="color:#ffd34d">◷ Limite :</b> ${foundry.utils.escapeHTML(s.time)}</div>` : ""}${s.rewards ? `<div><b style="color:#f0c46a">✦ Récompense :</b> ${foundry.utils.escapeHTML(s.rewards)}</div>` : ""}
    <div style="font-size:9px;letter-spacing:.14em;color:#4a6a9e;margin-top:4px">MONDE ${wr[0]} · ${wr[1]}</div></div>`;
  ChatMessage.create({ content: html, speaker: { alias: "Système" } });
}

/* ═══════════ notifications (statut, récompenses) ═══════════ */
function tpl(s, v) { return String(s || "").replace(/\{(\w+)\}/g, (m, k) => (v[k] ?? m)); }
function notifyPlayers(text, scen) {
  const nm = game.modules.get("notifications-manhwa"); const tg = (scen?.gmg && gmgUsers(scen.gmg)) || "all";
  if (nm?.active && nm.api?.notify) { nm.api.notify({ text, theme: "or", font: "system", duration: 8, position: "top", width: 700, chat: false, targets: tg, gmToo: true, top: "SYS::SCENARIO_LINK", bot: "SCENARIO.NETWORK · STATUS.SYS", sound: "neutral" }); return true; }
  if (scen && !scen._noShow) broadcast(scen, tg, true); else ChatMessage.create({ content: `<div style="font-family:'Signika';color:#38e0ff">${foundry.utils.escapeHTML(text)}</div>`, speaker: { alias: "Système" } });
  return false;
}
async function grantRewards(m) {
  const list = all(); const s = list.find(x => x.id === m.scenId); const gp = goldPath(), pp = game.settings.get(MID, "piPath");
  const cat = game.modules.get("last-horizon-catalogue"); const db = cat?.active && cat.api?.getDB ? (cat.api.getDB() || {}) : {};
  let mapping = null; try { mapping = foundry.utils.mergeObject(foundry.utils.deepClone(game.settings.get("last-horizon-catalogue", "mapping") || {}), {}); } catch (e) {}
  const results = [];
  for (const id of m.actorIds || []) {
    const a = game.actors.get(id); if (!a) continue; const upd = {};
    const GP = walletPath("gold"), PP = walletPath("pi");
    if (m.gold && GP) upd[GP] = (Number(foundry.utils.getProperty(a, GP)) || 0) + Number(m.gold);
    if (m.pi && PP) upd[PP] = (Number(foundry.utils.getProperty(a, PP)) || 0) + Number(m.pi);
    if (Object.keys(upd).length) await a.update(upd);
    const names = [];
    for (const it of m.items || []) {
      const e = (db.items || []).find(x => x.id === it.id); if (!e || !cat.api?.itemData) { names.push(`${it.n} (introuvable au catalogue)`); continue; }
      const data = await cat.api.itemData(e, mapping || {}, db); if (!data) continue;
      if (isMS()) { data.system = { ...(data.system || {}), quantity: Math.max(1, it.qty || 1) }; await a.createEmbeddedDocuments("Item", [data]); }
      else for (let q = 0; q < (it.qty || 1); q++) await a.createEmbeddedDocuments("Item", [data]);
      names.push(`${it.qty > 1 ? it.qty + "× " : ""}${e.n}`);
    }
    results.push({ actor: a.name, names });
    const text = tpl(game.settings.get(MID, "rewardText"), { titre: m.title || s?.titre || "", perso: a.name, gold: m.gold || 0, pi: m.pi || 0, objets: names.length ? names.join(", ") : "aucun objet" });
    if (game.settings.get(MID, "notifyStatus")) notifyPlayers(text, null);
  }
  return results;
}

/* ═══════════ outil MJ (iframe) ═══════════ */
class ScenTool extends ApplicationV2 {
  static DEFAULT_OPTIONS = { id: "sm-tool", classes: ["lh-frame", "sm-frame", "ms-fsable"], window: { title: "Scénarios Manhwa — Tableau des scénarios", icon: "fa-solid fa-scroll", resizable: true, minimizable: true }, position: { width: 1360, height: 900 } };
  async _prepareContext() { return {}; }
  async _renderHTML() { this._smReady = false; const f = document.createElement("iframe"); f.className = "sm-iframe"; f.src = `modules/${MID}/app/scen.html`; f.setAttribute("allow", "clipboard-write"); this.frame = f; return f; }
  _replaceHTML(r, c) { c.replaceChildren(r); }
  post(m) { try { this.frame?.contentWindow?.postMessage(m, "*"); } catch (e) {} }
  initData() { return { type: "sm-init", scenarios: all(), users: users(), actors: playerActors(), catalogue: catalogueList(), world: game.world.title, gmGroups: gmGroupList().map(g => ({ id: g.id, name: g.name, color: g.color })), stellar: !!game.modules.get("carte-stellaire-manhwa")?.active, settings: { goldPath: goldPath(), piPath: game.settings.get(MID, "piPath") } }; }
}
let tool = null;
function openTool() { if (!game.user.isGM) return ui.notifications.warn("Réservé au MJ."); if (!tool) tool = new ScenTool(); tool.render({ force: true }); return tool; }
window.addEventListener("message", async ev => {
  const m = ev.data; if (!m || !tool || ev.source !== tool.frame?.contentWindow) return;
  switch (m.type) {
    case "sm-ready": tool._smReady = true; tool.post(tool.initData()); if (pendingLoad) { tool.post({ type: "sm-load", id: pendingLoad }); pendingLoad = null; } break;
    case "sm-save": { const prev = all(); await saveAll((m.scenarios || []).map(x => { const o = prev.find(y => y.id === x.id); if (!o) return x; const y = { ...x }; if (x.timer === undefined && o.timer) y.timer = o.timer; if (x.timerUnits === undefined && o.timerUnits) y.timerUnits = o.timerUnits; if (x.objectives === undefined && o.objectives) { y.objectives = o.objectives; y.objSrc = o.objSrc; } return y; })); refreshJournals(); break; }
    case "sm-broadcast": broadcast(m.scen, m.targets || "all", true); break;
    case "sm-status": statusNotify(m.scen); refreshJournals(); break;
    case "sm-reward": { const r = await grantRewards(m); tool.post({ type: "sm-toast", text: r.map(x => `${x.actor} : ${m.gold || 0} G · ${m.pi || 0} P.I.${x.names.length ? " · " + x.names.join(", ") : ""}`).join("  |  ") || "Aucun personnage trouvé." }); tool.post({ type: "sm-actors", actors: playerActors() }); break; }
  }
});
Hooks.on("userConnected", () => { if (tool) tool.post({ type: "sm-users", users: users() }); });

/* ═══════════ journal des scénarios (joueurs & MJ) — fenêtre système façon ORV ═══════════ */
const E = v => foundry.utils.escapeHTML(String(v ?? ""));
const fold = v => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ST_ORDER = ["active", "upcoming", "done", "failed"];
const ST_ICON = { upcoming: "fa-solid fa-hourglass-start", active: "fa-solid fa-bolt", done: "fa-solid fa-check", failed: "fa-solid fa-xmark" };
const scenName = s => s.titre || s.cible || s.ref;
/* objectifs : s.objectives = [{text, done}] ; tant qu'il n'existe pas, le texte « Réussite » est découpé ligne par ligne.
   s.objSrc garde le texte d'origine : si le MJ réécrit la réussite dans l'éditeur, la liste est recalculée en gardant les coches des lignes inchangées. */
function parseObjectives(txt) { return String(txt || "").split(/\r?\n/).map(l => l.replace(/^\s*(?:[-–—•·*◈▸>]|\d+[.)])\s*/, "").trim()).filter(Boolean); }
function objectivesOf(s) {
  const src = String(s.success || ""); const prev = Array.isArray(s.objectives) ? s.objectives.filter(o => o && String(o.text || "").trim()) : [];
  if (prev.length && (s.objSrc == null || s.objSrc === src)) return prev.map(o => ({ text: String(o.text), done: !!o.done }));
  return parseObjectives(src).map(text => ({ text, done: !!prev.find(o => o.text === text)?.done }));
}
/* décompte en direct (mis à jour chaque seconde par C().tick) */
function cdHTML(s, cls = "") {
  const left = C().timerLeft(s); if (left == null) return ""; const t = s.timer; const units = (s.timerUnits && s.timerUnits.length) ? s.timerUnits : C().DEFAULT_UNITS;
  return `<span class="c-countdown ${cls}${left <= 0 ? " expired" : ""}${t.pausedLeft != null ? " paused" : ""}" data-timer="1" data-end="${t.end || ""}" data-paused="${t.pausedLeft != null ? t.pausedLeft : ""}" data-units="${units.join(",")}">${C().fmtLeft(left, units)}</span>`;
}
/* messages système / constellations, entre crochets */
function sysFeed(s) {
  const out = []; const m = (s.sysmsg || "").trim(); const wr = C().worldRef(s);
  out.push(["sys", m ? (m.startsWith("[") ? m : `[ ${m} ]`) : C().TYPE_SYSMSG[s.type]]);
  if (s.constellation) out.push(["const", `[ La constellation « ${s.constellation} » s'intéresse à ce scénario. ]`]);
  if (s.cible) out.push(["target", `[ Cible ${s.type === "TRAQUE" ? "verrouillée" : "désignée"} : ${s.cible}. ]`]);
  if (s.status !== "active" && C().STATUS_SYSMSG[s.status]) out.push([`st-${s.status}`, C().STATUS_SYSMSG[s.status]]);
  out.push(["world", `[ Monde ${wr[1]} · coordonnées ${wr[0]} ]`]);
  return out.map(([k, t]) => `<div class="ln ${k}">${E(t)}</div>`).join("");
}
class ScenJournal extends ApplicationV2 {
  static DEFAULT_OPTIONS = { id: "sm-journal", classes: ["sm-journal"], window: { title: "Journal des scénarios", icon: "fa-solid fa-book-open", resizable: true, minimizable: true }, position: { width: 1500, height: 940 } };
  /* fenêtre grande et adaptée à l'écran : min(1500, 92 % de la largeur) × min(940, 90 % de la hauteur), centrée */
  constructor(o = {}) {
    const W = Math.round(Math.min(1500, window.innerWidth * .92)), H = Math.round(Math.min(940, window.innerHeight * .9));
    super(foundry.utils.mergeObject({ position: { width: W, height: H } }, o));
    this.filter = "all"; this.type = ""; this.ranks = new Set(); this.q = ""; this.gg = ""; this.sort = "num"; this.sel = null; this.timerOpen = false;
  }
  async _prepareContext() { return {}; }
  async _renderHTML() {
    const gm = game.user.isGM; const seeDone = gm || game.settings.get(MID, "playersSeeDone");
    const SORTS = { num: C().compare, rank: (a, b) => C().RANKS.indexOf(b.rang) - C().RANKS.indexOf(a.rang) || C().compare(a, b), status: (a, b) => ST_ORDER.indexOf(a.status) - ST_ORDER.indexOf(b.status) || C().compare(a, b), recent: (a, b) => (b.up || 0) - (a.up || 0), time: (a, b) => (C().timerLeft(a) ?? Infinity) - (C().timerLeft(b) ?? Infinity) || C().compare(a, b) };
    const list = visibleFor(game.user).sort(SORTS[this.sort] || C().compare); const f = this.filter; const q = fold(this.q.trim());
    const hay = s => fold([s.titre, s.cible, s.constellation, s.ref, s.rewards, s.success, s.fail, C().TYPE_LABELS[s.type], C().worldRef(s)[1], gm ? s.notes : ""].join(" "));
    const shown = list.filter(s => (f === "all" || s.status === f) && (!this.type || s.type === this.type) && (!this.ranks.size || this.ranks.has(s.rang)) && (!q || hay(s).includes(q)) && (!this.gg || (this.gg === "-" ? !s.gmg : s.gmg === this.gg)));
    if (!this.sel || !shown.some(s => s.id === this.sel)) this.sel = shown[0]?.id || null;
    const count = st => list.filter(s => s.status === st).length;
    const root = document.createElement("div"); root.className = `sm-jbody${gm ? " gm" : ""}`;

    /* ── bandeau système ── */
    const urgent = list.filter(s => s.status === "active" && (C().timerLeft(s) ?? -1) > 0).sort((a, b) => C().timerLeft(a) - C().timerLeft(b))[0];
    const nA = count("active");
    const top = `<div class="sm-jtop"><div class="sm-jbrand"><span class="sm-jdot"></span><b>SYSTÈME</b><span>REGISTRE DES SCÉNARIOS</span></div>
      <div class="sm-jannounce">${nA ? `[ ${nA} scénario${nA > 1 ? "s" : ""} en cours. Les constellations observent votre progression. ]` : "[ Aucun scénario en cours. Le Bureau prépare la suite. ]"}</div>
      ${urgent ? `<div class="sm-jurgent" data-id="${E(urgent.id)}" title="${E(scenName(urgent))}"><span>PROCHAINE ÉCHÉANCE</span>${cdHTML(urgent)}</div>` : ""}
      <div class="sm-jstats">${["active", ...(gm ? ["upcoming"] : []), ...(seeDone ? ["done", "failed"] : [])].map(st => `<span class="k ${st}"><b>${count(st)}</b>${C().STATUS[st]}</span>`).join("")}</div></div>`;

    /* ── colonne liste ── */
    const chip = (attr, v, on, lbl, n, ic) => `<button type="button" data-${attr}="${E(v)}" class="${on ? "on" : ""}" title="${E(lbl)}">${ic ? `<i class="ic ${ic}"></i>` : ""}<span class="lb">${lbl}</span>${n != null ? `<i>${n}</i>` : ""}</button>`;
    const stF = [["all", "Tous", list.length], ["active", "En cours", nA], ...(gm ? [["upcoming", "À venir", count("upcoming")]] : []), ...(seeDone ? [["done", "Terminés", count("done")], ["failed", "Échoués", count("failed")]] : [])];
    const types = C().TYPES.filter(t => list.some(s => s.type === t)); const ranks = C().RANKS.filter(r => list.some(s => s.rang === r));
    const anyF = f !== "all" || this.type || this.ranks.size || q || this.gg;
    let side = `<div class="sm-jsearch"><i class="fa-solid fa-magnifying-glass"></i><input type="text" placeholder="Rechercher un scénario…" title="Titre, cible, constellation, référence, récompense…" value="${E(this.q)}" spellcheck="false">${this.q ? `<button type="button" class="x" title="Effacer"><i class="fa-solid fa-xmark"></i></button>` : ""}</div>
      <div class="sm-jfilters">${stF.map(x => chip("f", x[0], f === x[0], x[1], x[2], ST_ICON[x[0]])).join("")}</div>
      ${types.length > 1 ? `<div class="sm-jtypes">${chip("ty", "", !this.type, "Tous types")}${types.map(t => chip("ty", t, this.type === t, C().TYPE_SHORT[t])).join("")}</div>` : ""}
      ${ranks.length > 1 ? `<div class="sm-jranks"><span>RANG</span>${ranks.map(r => `<button type="button" data-rk="${r}" class="rank-${r.toLowerCase()}${this.ranks.has(r) ? " on" : ""}" title="Rang ${r}">${r}</button>`).join("")}</div>` : ""}
      ${(() => { const GG = gmGroupList(); const mine = gm ? GG : GG.filter(g => myGmGroups().includes(g.id)); if (!mine.length || (!gm && mine.length < 1)) return ""; return `<div class="sm-jgg"><span>GROUPE MJ</span><button type="button" data-gg="" class="${!this.gg ? "on" : ""}">Tous</button>${gm ? `<button type="button" data-gg="-" class="${this.gg === "-" ? "on" : ""}">Sans</button>` : ""}${mine.map(g => `<button type="button" data-gg="${E(g.id)}" class="${this.gg === g.id ? "on" : ""}" style="--g:${E(g.color)}"><i></i>${E(g.name)}</button>`).join("")}</div>`; })()}
      <div class="sm-jsort"><span>TRI</span>${[["num", "N°"], ["rank", "Rang"], ["status", "Statut"], ["time", "Échéance"], ["recent", "Récents"]].map(x => `<button type="button" data-s="${x[0]}" class="${this.sort === x[0] ? "on" : ""}">${x[1]}</button>`).join("")}${anyF ? `<button type="button" class="reset" title="Réinitialiser les filtres"><i class="fa-solid fa-rotate-left"></i></button>` : ""}</div>
      <div class="sm-jlist" tabindex="0">`;
    let last = null;
    if (!shown.length) side += `<div class="sm-jempty">[ AUCUN SCÉNARIO ${list.length ? "NE CORRESPOND" : "POUR L'INSTANT"} ]${list.length ? "<br>Modifie la recherche ou les filtres." : ""}</div>`;
    for (const s of shown) {
      if (this.sort === "num" && s.type !== last) { last = s.type; side += `<div class="sm-jgroup">${C().TYPE_LABELS[s.type]}</div>`; }
      const obj = objectivesOf(s), nd = obj.filter(o => o.done).length, cd = s.status === "active" ? cdHTML(s) : "";
      side += `<div class="sm-jrow rank-${s.rang.toLowerCase()} st-${s.status}${s.id === this.sel ? " on" : ""}" data-id="${E(s.id)}">
        <div class="r">${s.rang}</div>
        <div class="t"><b>${s.type === "PRINCIPAL" ? `<em>N°${E(s.num)}</em>` : ""}${E(scenName(s))}</b><small>${C().TYPE_SHORT[s.type]}<span class="w"> · ${E(C().worldRef(s)[1])}</span>${s.gmg && gmGroupList().find(g => g.id === s.gmg) ? `<span class="gg" style="--g:${E(gmGroupList().find(g => g.id === s.gmg).color)}"> · ♛ ${E(gmGroupList().find(g => g.id === s.gmg).name)}</span>` : ""}${cd ? ` · <i class="fa-regular fa-clock"></i>${cd}` : ""}</small>${obj.length > 1 ? `<span class="pg" title="${nd}/${obj.length} objectifs"><i style="width:${Math.round(nd / obj.length * 100)}%"></i></span>` : ""}</div>
        <div class="e">${gm && s.visible === false ? `<i class="fa-solid fa-eye-slash" title="Masqué aux joueurs une fois terminé"></i>` : ""}<span class="st ${s.status}">${C().STATUS[s.status]}</span></div></div>`;
    }
    side += `</div><div class="sm-jcount">${shown.length} / ${list.length} SCÉNARIO${list.length > 1 ? "S" : ""}</div>`;

    /* ── détail ── */
    const cur = shown.find(s => s.id === this.sel);
    const detail = cur ? this._detailHTML(cur, gm) : `<div class="sm-jnone"><div class="sm-jempty">[ SÉLECTIONNE UN SCÉNARIO ]</div></div>`;
    root.innerHTML = `${top}<aside class="sm-jside">${side}</aside><main class="sm-jdetail">${detail}</main>`;

    /* ── écouteurs ── */
    const $$ = (sel, fn, ev = "click") => root.querySelectorAll(sel).forEach(el => el.addEventListener(ev, e => fn(el, e)));
    $$(".sm-jrow", el => { this.sel = el.dataset.id; this.render(false); });
    $$(".sm-jurgent", el => { this.sel = el.dataset.id; this.filter = "all"; this.type = ""; this.ranks.clear(); this.q = ""; this.render(false); });
    $$(".sm-jfilters button", el => { this.filter = el.dataset.f; this.render(false); });
    $$(".sm-jtypes button", el => { this.type = el.dataset.ty; this.render(false); });
    $$(".sm-jgg button", el => { this.gg = el.dataset.gg; this.render(false); });
    $$(".sm-jranks button", el => { const r = el.dataset.rk; this.ranks.has(r) ? this.ranks.delete(r) : this.ranks.add(r); this.render(false); });
    $$(".sm-jsort button[data-s]", el => { this.sort = el.dataset.s; this.render(false); });
    $$(".sm-jsort .reset", () => { this.filter = "all"; this.type = ""; this.ranks.clear(); this.q = ""; this.gg = ""; this.render(false); });
    $$(".sm-jsearch .x", () => { this.q = ""; this.render(false); });
    $$(".sm-jsearch input", el => { this.q = el.value; clearTimeout(this._qT); this._qT = setTimeout(() => this.render(false), 160); }, "input");
    $$(".sm-jlist", (el, e) => { if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return; e.preventDefault(); const i = shown.findIndex(s => s.id === this.sel); const n = shown[Math.max(0, Math.min(shown.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]; if (n && n.id !== this.sel) { this.sel = n.id; this._focusList = true; this.render(false); } }, "keydown");
    if (cur) {
      $$(".sm-jcard-act [data-a='replay']", () => showCard(cur, { silent: true }));
      if (gm) {
        $$(".sm-jobj li[data-i]", el => toggleObjective(cur.id, Number(el.dataset.i)));
        $$(".sm-jstatus button", el => setScenStatus(cur.id, el.dataset.st));
        $$(".sm-jacts [data-a]", el => ({ cast: () => recastScen(cur.id), vis: () => toggleVisible(cur.id), edit: () => editInTool(cur.id), chat: () => chatCard(cur), del: () => deleteScenario(cur.id) })[el.dataset.a]?.());
        $$(".sm-timer [data-t]", el => adjustTimer(cur.id, el.dataset.t)); $$(".sm-timer [data-u]", el => toggleUnit(cur.id, el.dataset.u));
        $$(".sm-jtimer", el => { this.timerOpen = el.open; }, "toggle");
      }
    }
    const view = root.querySelector(".sm-jview"), fit = view?.querySelector(".sm-jfit"), cardEl = fit?.querySelector(".sm-card");
    this._ro?.disconnect();
    if (cardEl) { const doFit = () => fitCard(view, fit, cardEl); this._ro = new ResizeObserver(doFit); this._ro.observe(view); requestAnimationFrame(doFit); }
    this._startTick();
    return root;
  }
  _detailHTML(s, gm) {
    const wr = C().worldRef(s); const rk = s.rang.toLowerCase(); const obj = objectivesOf(s); const nd = obj.filter(o => o.done).length;
    const kind = `${C().TYPE_LABELS[s.type]}${s.type === "PRINCIPAL" ? ` · N°${E(s.num)}` : ""}`;
    const left = C().timerLeft(s); const cd = cdHTML(s, "big");
    const stBtns = ST_ORDER.map(st => `<button type="button" data-st="${st}" class="${st}${s.status === st ? " on" : ""}" title="Passer en « ${C().STATUS[st].toLowerCase()} »"><i class="${ST_ICON[st]}"></i>${C().STATUS[st]}</button>`).join("");
    const act = (a, ic, lbl, cls = "", title = "") => `<button type="button" data-a="${a}" class="${cls}" title="${E(title)}"><i class="${ic}"></i><span>${lbl}</span></button>`;
    const gmBar = gm ? `<div class="sm-jgm"><div class="sm-jstatus">${stBtns}</div><div class="sm-jacts">
        ${act("cast", "fa-solid fa-tower-broadcast", "Diffuser", "hot", "Afficher de nouveau la carte à tous les joueurs" + (s.casts ? ` (déjà diffusé ${s.casts}×)` : ""))}
        ${act("vis", s.visible === false ? "fa-solid fa-eye-slash" : "fa-solid fa-eye", s.visible === false ? "Masqué" : "Visible", s.visible === false ? "off" : "", "Visibilité pour les joueurs une fois le scénario terminé ou échoué")}
        ${act("edit", "fa-solid fa-pen-to-square", "Éditer", "", "Ouvrir ce scénario dans le tableau MJ")}
        ${act("chat", "fa-solid fa-comment", "Chat", "", "Copier la carte dans le chat")}
        ${act("del", "fa-solid fa-trash", "Supprimer", "danger", "Supprimer définitivement ce scénario")}</div></div>` : "";
    const showCd = left != null || s.time || gm;
    const cdSec = showCd ? `<section class="sm-jsec cd${left != null && left <= 0 ? " expired" : ""}${s.timer?.pausedLeft != null ? " paused" : ""}"><h3><i class="fa-regular fa-clock"></i>TEMPS RESTANT${s.timer?.pausedLeft != null ? `<span class="tag">PAUSE</span>` : ""}</h3>
        <div class="sm-jcd">${cd || `<span class="none">${s.time ? E(s.time) : "—"}</span>`}</div>${cd && s.time ? `<div class="lim">Limite annoncée : ${E(s.time)}</div>` : ""}
        ${gm ? `<details class="sm-jtimer"${this.timerOpen ? " open" : ""}><summary><i class="fa-solid fa-sliders"></i> Régler le compte à rebours</summary>${timerBarHTML(s)}</details>` : ""}</section>` : "";
    const objSec = obj.length ? `<section class="sm-jsec obj"><h3><i class="fa-solid fa-list-check"></i>OBJECTIFS<span class="n">${nd} / ${obj.length}</span></h3><div class="bar"><i style="width:${Math.round(nd / obj.length * 100)}%"></i></div>
        <ul class="sm-jobj${gm ? " gm" : ""}">${obj.map((o, i) => `<li${gm ? ` data-i="${i}" title="${o.done ? "Décocher" : "Cocher"}"` : ""} class="${o.done ? "done" : ""}"><span class="ck">${o.done ? '<i class="fa-solid fa-check"></i>' : ""}</span><span class="tx">${E(o.text)}</span></li>`).join("")}</ul>
        ${gm ? `<div class="hint">Clique un objectif pour le cocher : les joueurs voient la progression en direct. Une ligne du champ « Réussite » = un objectif.</div>` : ""}</section>` : "";
    const r = s.rew || {}; const rewReal = gm && (r.gold || r.pi || (r.items || []).length) ? `<div class="real"><span class="lbl">RÉELLES (MJ)</span>${r.gold ? `<span class="pill gold">${E(r.gold)} G</span>` : ""}${r.pi ? `<span class="pill pi">${E(r.pi)} P.I.</span>` : ""}${(r.items || []).map(it => `<span class="pill it">${it.qty > 1 ? E(it.qty) + "× " : ""}${E(it.n)}</span>`).join("")}</div>` : "";
    const duo = `<div class="sm-jduo">${s.fail ? `<section class="sm-jsec fail"><h3><i class="fa-solid fa-skull"></i>PÉNALITÉ D'ÉCHEC</h3><p>${E(s.fail)}</p></section>` : ""}${s.rewards || rewReal ? `<section class="sm-jsec rew"><h3><i class="fa-solid fa-gem"></i>RÉCOMPENSE</h3>${s.rewards ? `<p>${E(s.rewards)}</p>` : ""}${rewReal}</section>` : ""}</div>`;
    const notes = gm && (s.notes || "").trim() ? `<section class="sm-jsec notes"><h3><i class="fa-solid fa-user-secret"></i>NOTES DU MJ <small>invisibles pour les joueurs</small></h3><p>${E(s.notes)}</p></section>` : "";
    return `<div class="sm-jdgrid rank-${rk}">
      <div class="sm-jcardcol"><div class="sm-jview"><div class="sm-jfit">${C().html(s, { cls: "journal" })}</div></div>
        <div class="sm-jcard-act"><button type="button" data-a="replay" title="Réafficher l'annonce en grand, pour toi seul"><i class="fa-solid fa-expand"></i> Revoir l'annonce</button></div></div>
      <div class="sm-jinfo">
        <div class="sm-jwin"><div class="sm-jwin-bar"><span class="dot"></span><span class="id">SYS::SCENARIO · ID#${E(String(s.ref).toUpperCase())}</span><span class="st-chip ${s.status}"><i class="${ST_ICON[s.status]}"></i>${C().STATUS[s.status]}</span></div>
          <div class="sm-jhead"><div class="hex rank-${rk}"><b>${s.rang}</b></div><div class="hd"><div class="kind">${kind}</div><h2 style="--tc:${E(s.titreCol || "#ffffff")}">${E(scenName(s))}</h2>
            <div class="meta"><span class="world" style="--w:${E(wr[2])}"><i></i>${E(wr[1])} · ${E(wr[0])}</span><span class="rk rank-${rk}">RANG ${s.rang} · ${E(C().RANK_SUB[s.rang] || "")}</span>${gm && s.casts ? `<span class="casts"><i class="fa-solid fa-tower-broadcast"></i> ${E(s.casts)}×</span>` : ""}${gm && s.visible === false ? `<span class="hid"><i class="fa-solid fa-eye-slash"></i> masqué</span>` : ""}</div></div></div>
          <div class="sm-jfeed">${sysFeed(s)}</div></div>
        ${gmBar}${cdSec}${objSec}${duo}${notes}
      </div></div>`;
  }
  /* garde les positions de défilement et le focus de la recherche d'un rendu à l'autre (chaque sauvegarde re-rend le journal) */
  _replaceHTML(r, c) {
    const same = this._lastSel === this.sel; this._lastSel = this.sel;
    const keep = [".sm-jlist", ...(same ? [".sm-jinfo", ".sm-jdetail"] : [])].map(k => [k, c.querySelector(k)?.scrollTop || 0]);
    const qi = c.querySelector(".sm-jsearch input"); const foc = qi && document.activeElement === qi ? [qi.selectionStart, qi.selectionEnd] : null;
    c.replaceChildren(r);
    keep.forEach(([k, v]) => { const el = c.querySelector(k); if (el) el.scrollTop = v; });
    if (foc) { const n = c.querySelector(".sm-jsearch input"); n?.focus(); n?.setSelectionRange(...foc); }
    if (this._focusList) { this._focusList = false; const l = c.querySelector(".sm-jlist"); l?.focus(); l?.querySelector(".sm-jrow.on")?.scrollIntoView({ block: "nearest" }); }
  }
  _startTick() { if (this._tick) return; this._tick = setInterval(() => { if (!this.rendered) { clearInterval(this._tick); this._tick = null; return; } C().tick(this.element); this.element?.querySelectorAll(".sm-timer .left[data-end]").forEach(el => { if (el.dataset.paused !== "" || !Number(el.dataset.end)) return; el.textContent = C().fmtLeft(Number(el.dataset.end) - Date.now(), (el.dataset.units || "").split(",").filter(Boolean)); }); }, 1000); }
  _onClose() { this._ro?.disconnect(); clearInterval(this._tick); this._tick = null; }
}
/* la carte (430 px de large) s'adapte à la colonne qui lui est réservée : agrandir la fenêtre agrandit la carte */
function fitCard(view, fit, card) {
  const cs = getComputedStyle(view); const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const availW = view.clientWidth - padX, availH = view.clientHeight - padY;
  const w = card.offsetWidth || 430, h = card.offsetHeight || 600; if (!w || !h || availW <= 0 || availH <= 0) return;
  const k = Math.max(.35, Math.min(1.35, availW / w, availH / h));
  card.style.transform = `scale(${k})`; card.style.transformOrigin = "top left"; fit.style.width = Math.round(w * k) + "px"; fit.style.height = Math.round(h * k) + "px";
}
/* ── actions MJ du journal ── */
function statusNotify(s) {
  if (!game.settings.get(MID, "notifyStatus")) return; const st = C().STATUS[s.status] || s.status;
  const text = tpl(game.settings.get(MID, "statusText"), { titre: scenName(s), type: C().TYPE_LABELS[s.type] || s.type, num: s.num, statut: st.toLowerCase() });
  notifyPlayers(text, s.status === "active" ? s : (s.gmg ? { gmg: s.gmg, _noShow: true } : null));
}
async function setScenStatus(id, status) { if (!game.user.isGM) return; const list = all(); const s = list.find(x => x.id === id); if (!s || s.status === status || !C().STATUS[status]) return; s.status = status; s.up = Date.now(); await saveAll(list); statusNotify(s); }
async function toggleVisible(id) { if (!game.user.isGM) return; const list = all(); const s = list.find(x => x.id === id); if (!s) return; s.visible = s.visible === false; s.up = Date.now(); await saveAll(list); }
async function recastScen(id) { if (!game.user.isGM) return; const list = all(); const s = list.find(x => x.id === id); if (!s) return; s.casts = (s.casts || 0) + 1; await saveAll(list); broadcast(s, "all", true); }
async function toggleObjective(id, i) {
  if (!game.user.isGM) return; const list = all(); const s = list.find(x => x.id === id); if (!s) return;
  const objs = objectivesOf(s); if (!objs[i]) return; objs[i].done = !objs[i].done; s.objectives = objs; s.objSrc = String(s.success || ""); await saveAll(list);
}
/* suppression : confirmation DialogV2 (ask:false pour l'API sans confirmation) */
async function deleteScenario(id, { ask = true } = {}) {
  if (!game.user.isGM) { ui.notifications.warn("Réservé au MJ."); return false; }
  const list = all(); const s = list.find(x => x.id === id); if (!s) return false;
  if (ask) {
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Supprimer le scénario", icon: "fa-solid fa-trash" }, classes: ["sm-dialog"], modal: true,
      content: `<p>[ Supprimer définitivement <b>« ${E(scenName(s))} »</b> (${E(C().TYPE_SHORT[s.type])}${s.type === "PRINCIPAL" ? " N°" + E(s.num) : ""} · rang ${E(s.rang)}) ? ]</p><p class="hint">Le scénario disparaît du journal des joueurs et du tableau MJ. Cette action est irréversible.</p>`,
      yes: { label: "Supprimer", icon: "fa-solid fa-trash" }, no: { label: "Annuler", icon: "fa-solid fa-xmark", default: true } });
    if (!ok) return false;
  }
  await saveAll(list.filter(x => x.id !== id)); ui.notifications.info(`Scénario « ${scenName(s)} » supprimé.`); return true;
}
/* ouvre le tableau MJ (iframe) et y charge ce scénario dans l'éditeur */
let pendingLoad = null;
function editInTool(id) {
  if (!game.user.isGM) return;
  if (tool?.rendered && tool._smReady) { if (tool.minimized) tool.maximize(); tool.bringToFront?.(); tool.post({ type: "sm-load", id }); return; }
  pendingLoad = id; openTool();
}
/* ── compte à rebours (MJ) ── */
function timerBarHTML(s) {
  const left = C().timerLeft(s); const t = s.timer || {}; const paused = t.pausedLeft != null; const has = left != null;
  const units = (s.timerUnits && s.timerUnits.length) ? s.timerUnits : C().DEFAULT_UNITS;
  const b = (k, lbl, title) => `<button data-t="${k}" title="${title || ""}">${lbl}</button>`;
  const UL = { y: "années", M: "mois", w: "semaines", d: "jours", h: "heures", m: "minutes", s: "secondes" };
  const unitBtns = C().UNITS.map(u => `<button data-u="${u[0]}" class="u${units.includes(u[0]) ? " on" : ""}" title="${units.includes(u[0]) ? "Ne plus afficher les " : "Afficher les "}${UL[u[0]]}">${UL[u[0]]}</button>`).join("");
  return `<div class="sm-timer${has ? " has" : ""}${paused ? " paused" : ""}${has && left <= 0 ? " expired" : ""}">
    <div class="row"><span class="lbl"><i class="fa-regular fa-clock"></i> TEMPS RESTANT</span><span class="left" data-end="${t.end || ""}" data-paused="${paused ? t.pausedLeft : ""}" data-units="${units.join(",")}">${has ? C().fmtLeft(left, units) : "—"}</span>${paused ? `<span class="tag">PAUSE</span>` : ""}${s.time ? `<span class="lim">limite annoncée : ${foundry.utils.escapeHTML(s.time)}</span>` : ""}</div>
    <div class="row">${b("-604800000", "−1 sem")}${b("-86400000", "−1 j")}${b("-3600000", "−1 h")}${b("-600000", "−10 min")}${b("+600000", "+10 min")}${b("+3600000", "+1 h")}${b("+86400000", "+1 j")}${b("+604800000", "+1 sem")}${b("custom", '<i class="fa-solid fa-sliders"></i> Personnalisé…', "Ajouter, retirer ou définir une durée précise (années, mois, semaines, jours, heures, minutes, secondes)")}
      <span class="sep"></span>${has ? b("pause", paused ? '<i class="fa-solid fa-play"></i> Reprendre' : '<i class="fa-solid fa-pause"></i> Pause') : ""}${s.time ? b("fromLimit", '<i class="fa-solid fa-hourglass-start"></i> Depuis la limite', "Démarre le compte à rebours d'après le texte de la limite (ex. « 48 heures »)") : ""}${has ? b("clear", '<i class="fa-solid fa-xmark"></i> Effacer') : ""}</div>
    <div class="row units"><span class="ulbl">AFFICHER</span>${unitBtns}<span class="uhint">la plus grande unité cochée absorbe le reste ; les unités décochées se replient dans la plus petite cochée</span></div>
    <div class="hint">Les joueurs voient le décompte en direct dans leur journal et sur la carte.</div></div>`;
}
async function adjustTimer(id, act) {
  const list = all(); const s = list.find(x => x.id === id); if (!s) return;
  const now = Date.now(); const left = C().timerLeft(s); const t = s.timer || {};
  const setLeft = ms => { ms = Math.max(0, ms); if (t.pausedLeft != null) s.timer = { end: null, pausedLeft: ms }; else s.timer = { end: now + ms, pausedLeft: null }; };
  if (act === "clear") s.timer = null;
  else if (act === "pause") { if (left == null) return; if (t.pausedLeft != null) s.timer = { end: now + t.pausedLeft, pausedLeft: null }; else s.timer = { end: null, pausedLeft: Math.max(0, left) }; }
  else if (act === "fromLimit") { const ms = C().parseDuration(s.time); if (!ms) return ui.notifications.warn(`Impossible de lire une durée dans « ${s.time} » (ex. attendu : 48 heures, 3 jours, 2h30).`); s.timer = { end: now + ms, pausedLeft: null }; }
  else if (act === "custom") { const r = await customDuration(left); if (!r) return; if (r.mode === "set") setLeft(r.ms); else if (left == null) { if (r.mode === "sub") return; s.timer = { end: now + r.ms, pausedLeft: null }; } else setLeft(left + (r.mode === "sub" ? -r.ms : r.ms)); }
  else { const d = Number(act); if (!d) return; if (left == null) { if (d <= 0) return; s.timer = { end: now + d, pausedLeft: null }; } else setLeft(left + d); }
  s.up = now; await saveAll(list);
}
async function toggleUnit(id, u) {
  const list = all(); const s = list.find(x => x.id === id); if (!s) return;
  let units = (s.timerUnits && s.timerUnits.length) ? [...s.timerUnits] : [...C().DEFAULT_UNITS];
  if (units.includes(u)) { if (units.length === 1) return ui.notifications.warn("Il faut garder au moins une unité."); units = units.filter(x => x !== u); } else units.push(u);
  s.timerUnits = C().UNITS.map(x => x[0]).filter(x => units.includes(x)); await saveAll(list);
}
/* durée personnalisée : années · mois · semaines · jours · heures · minutes · secondes, à ajouter, retirer ou définir */
async function customDuration(left) {
  const F = [["y", "Années"], ["M", "Mois"], ["w", "Semaines"], ["d", "Jours"], ["h", "Heures"], ["m", "Minutes"], ["s", "Secondes"]];
  const content = `<div class="sm-custom"><div class="grid">${F.map(f => `<label>${f[1]}<input type="number" name="${f[0]}" min="0" step="1" value="0"></label>`).join("")}</div>
    <div class="modes"><label><input type="radio" name="mode" value="add" checked> Ajouter au temps restant</label><label><input type="radio" name="mode" value="sub"${left == null ? " disabled" : ""}> Retirer du temps restant</label><label><input type="radio" name="mode" value="set"> Définir (remplace le temps restant)</label></div>
    <p class="hint">Mois = 30 jours, année = 365 jours.</p></div>`;
  const r = await foundry.applications.api.DialogV2.prompt({ window: { title: "Durée personnalisée", icon: "fa-solid fa-sliders" }, classes: ["sm-dialog"], content,
    ok: { label: "Appliquer", callback: (ev, btn) => { const f = btn.form; const ms = C().UNITS.reduce((acc, u) => acc + (Number(f.elements[u[0]].value) || 0) * u[1], 0); return { ms, mode: f.elements.mode.value }; } } });
  if (!r || !(r.ms > 0)) return null; return r;
}
let journal = null;
function openJournal() { if (!game.user.isGM && !game.settings.get(MID, "playersCanOpen")) return ui.notifications.warn("Le journal des scénarios est fermé par le MJ."); if (!journal) journal = new ScenJournal(); journal.render({ force: true }); return journal; }
function refreshJournals() { if (journal?.rendered) journal.render(false); }
Hooks.on("manhwaGmGroups", () => { refreshJournals(); if (tool?._smReady) tool.post(tool.initData()); });
Hooks.on("updateSetting", s => { if (s.key === `${MID}.scenarios`) { refreshJournals(); if (tool) tool.post({ type: "sm-scenarios", scenarios: all() }); } });

/* ═══════════ boutons ═══════════ */
Hooks.on("getSceneControlButtons", controls => {
  const mk = (name, title, icon, fn) => ({ name, title, icon, button: true, order: 98, onChange: fn, onClick: fn });
  const tools = []; if (game.user.isGM) tools.push(mk("sm-tool", "Scénarios Manhwa — Tableau (MJ)", "fa-solid fa-scroll", openTool));
  if (game.user.isGM || game.settings.get(MID, "playersCanOpen")) tools.push(mk("sm-journal", "Journal des scénarios", "fa-solid fa-book-open", openJournal));
  if (Array.isArray(controls)) { const c = controls.find(x => x.name === "notes") || controls[0]; tools.forEach(t => c.tools.push(t)); }
  else { const c = controls.notes || controls.tokens; if (c) tools.forEach(t => { c.tools[t.name] = t; }); }
});
const sidebarBtns = (dir, html, where) => {
  const mode = game.settings.get(MID, "sidebarButtons") || "none"; if (mode !== "both" && mode !== where) return;
  const root = html instanceof HTMLElement ? html : html[0]; if (root.querySelector(".sm-btn")) return;
  const header = root.querySelector(".directory-header") || root.querySelector("header") || root;
  if (game.user.isGM || game.settings.get(MID, "playersCanOpen")) { const b = document.createElement("button"); b.type = "button"; b.className = "sm-btn"; b.innerHTML = '<i class="fa-solid fa-book-open"></i> Journal des scénarios'; b.addEventListener("click", openJournal); header.appendChild(b); }
  if (game.user.isGM) { const b2 = document.createElement("button"); b2.type = "button"; b2.className = "sm-btn"; b2.innerHTML = '<i class="fa-solid fa-scroll"></i> Scénarios — Tableau MJ'; b2.addEventListener("click", openTool); header.appendChild(b2); }
};
Hooks.on("renderJournalDirectory", (dir, html) => sidebarBtns(dir, html, "journal"));
Hooks.on("renderItemDirectory", (dir, html) => sidebarBtns(dir, html, "items"));

Hooks.once("ready", () => {
  setInterval(() => { const L = document.getElementById("sm-layer"); if (L && L.childElementCount) C().tick(L); }, 1000); /* décompte en direct sur la carte affichée à l'écran */
  game.socket.on(SOCKET, receive);
  const mod = game.modules.get(MID);
  mod.api = {
    open: openTool, openJournal, all, visible: () => visibleFor(game.user),
    /** Affiche un scénario (objet ou id) à tous ou à des joueurs donnés. */
    show: (scen, targets = "all") => { const s = typeof scen === "string" ? all().find(x => x.id === scen) : scen; if (s) broadcast(s, targets, true); },
    /** Change le statut d'un scénario par id : 'upcoming' | 'active' | 'done' | 'failed'. */
    setStatus: async (id, status) => { const list = all(); const s = list.find(x => x.id === id); if (!s) return; s.status = status; s.up = Date.now(); await saveAll(list); },
    /** Supprime un scénario par id (MJ). Demande confirmation sauf { confirm: false }. Renvoie true si supprimé. */
    delete: (id, { confirm = true } = {}) => deleteScenario(id, { ask: confirm }),
    /** Coche / décoche l'objectif n° i (0 = premier) d'un scénario (MJ). */
    toggleObjective, objectives: id => { const s = all().find(x => x.id === id); return s ? objectivesOf(s) : []; },
    /** Ouvre le tableau MJ sur ce scénario. */
    edit: editInTool,
    grant: grantRewards, card: (s, o) => C().html(s, o)
  };
  console.log(`${MID} | prêt`);
});

/* 1.3.2 : récompenses compatibles Manhwa Sheet (monnaies dans system.resources, quantité d'objets, véhicules exclus de la liste) */
