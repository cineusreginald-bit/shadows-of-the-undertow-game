// Shadow Run · Supabase link: a public leaderboard and private play stats.
// The game calls SRB.start / chapter / caught / quit / win. If Supabase is not set up, every call does nothing.
(function () {
  "use strict";
  const cfg = window.SR_CONFIG || {};
  const ready = !!(cfg.url && cfg.key && window.supabase && window.supabase.createClient);
  const db = ready ? window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  const device = window.matchMedia && matchMedia("(pointer: coarse)").matches ? "touch" : "desktop";
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
  const secs = (t) => Math.max(0, Math.min(36000, Math.round(t || 0)));
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const TOP = 5;
  let runId = null, last = null, posted = false, mineId = null;

  // ---- private stats: insert only, never read back
  function log(event, chapter, time, retries) {
    if (!db || !runId) return;
    db.from("run_events").insert({ run_id: runId, event, chapter: chapter || null, time_s: secs(time), retries: retries | 0, device })
      .then(({ error }) => { if (error) console.warn("[Shadow Run] stat not saved:", error.message); });
  }

  // ---- leaderboard block on the end screen
  let ui = null;
  function build() {
    const stat = document.getElementById("winStat");
    if (!stat || ui) return;
    const css = document.createElement("style");
    css.textContent = `
      .sr-lb { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; width: 100%; max-width: 440px; }
      .sr-lb form { display: flex; gap: 10px; flex-wrap: wrap; }
      .sr-lb input { flex: 1 1 150px; min-width: 0; font-family: var(--mono); font-size: 15px; font-weight: 500; letter-spacing: .12em; text-transform: uppercase; color: var(--fg); background: transparent; border: 1px solid var(--line); border-radius: 999px; padding: 12px 20px; outline: none; user-select: text; -webkit-user-select: text; touch-action: manipulation; }
      .sr-lb input:focus { border-color: var(--fire); }
      .sr-lb input::placeholder { color: var(--muted); }
      .sr-lb .btn { padding: 12px 22px; }
      .sr-lb .btn[disabled] { opacity: .45; cursor: default; transform: none; }
      .sr-lb ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
      .sr-lb li { display: grid; grid-template-columns: 2.2em 1fr auto auto; gap: 12px; align-items: baseline; font-family: var(--mono); font-size: 14px; font-weight: 500; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); font-variant-numeric: tabular-nums; padding: 5px 0; border-bottom: 1px solid var(--line); }
      .sr-lb li b { font-weight: 500; color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sr-lb li.me, .sr-lb li.me b { color: var(--fire); }
      .sr-lb [hidden] { display: none; }`;
    document.head.appendChild(css);
    const el = document.createElement("div");
    el.className = "sr-lb"; el.id = "board"; el.hidden = true;
    el.innerHTML = `
      <form id="boardForm" autocomplete="off">
        <input id="boardName" type="text" maxlength="16" placeholder="Your name" aria-label="Your name" autocapitalize="characters" spellcheck="false" enterkeyhint="send">
        <button class="btn ghost" type="submit" id="boardPost">Post time</button>
      </form>
      <span class="label" id="boardHead">Fastest runs</span>
      <ol id="boardList"></ol>
      <span class="label" id="boardMsg" role="status" hidden></span>`;
    stat.insertAdjacentElement("afterend", el);
    ui = { el, form: el.querySelector("#boardForm"), name: el.querySelector("#boardName"), post: el.querySelector("#boardPost"), head: el.querySelector("#boardHead"), list: el.querySelector("#boardList"), msg: el.querySelector("#boardMsg") };
    try { ui.name.value = localStorage.getItem("sr_name") || ""; } catch (e) {}
    ui.form.addEventListener("submit", (e) => { e.preventDefault(); post(); });
  }
  function say(text) { ui.msg.textContent = text || ""; ui.msg.hidden = !text; }

  function draw(rows) {
    ui.list.textContent = "";
    rows.forEach((r, i) => {
      const li = document.createElement("li");
      if (r.id === mineId) li.className = "me";
      const n = document.createElement("span"); n.textContent = String(i + 1).padStart(2, "0");
      const who = document.createElement("b"); who.textContent = r.name;
      const t = document.createElement("span"); t.textContent = fmt(r.time_s);
      const re = document.createElement("span"); re.textContent = `${r.retries} ${r.retries === 1 ? "retry" : "retries"}`;
      li.append(n, who, t, re); ui.list.appendChild(li);
    });
    ui.head.hidden = ui.list.hidden = !rows.length;
  }
  function load() {
    if (!db) return;
    db.from("scores").select("id, name, time_s, retries").order("time_s").order("retries").order("created_at").limit(TOP)
      .then(({ data, error }) => { if (error) { console.warn("[Shadow Run] leaderboard not loaded:", error.message); return; } draw(data || []); });
  }
  function post() {
    if (!db || !last || posted) return;
    const name = ui.name.value.replace(/\s+/g, " ").trim().slice(0, 16);
    if (!name) { say("Enter a name first"); ui.name.focus(); return; }
    ui.post.disabled = true; say("");
    db.from("scores").insert({ name, time_s: last.time_s, retries: last.retries }).select("id").single()
      .then(({ data, error }) => {
        if (error) { ui.post.disabled = false; say("Could not post. Try again."); console.warn("[Shadow Run] score not posted:", error.message); return; }
        posted = true; mineId = data && data.id; ui.form.hidden = true; say("Time posted");
        try { localStorage.setItem("sr_name", name); } catch (e) {}
        load();
      });
  }

  window.SRB = {
    ready,
    start() { runId = uuid(); last = null; posted = false; mineId = null; if (ui) { ui.el.hidden = true; } log("start", "cell", 0, 0); },
    chapter(id, time, retries) { log("chapter", id, time, retries); },
    caught(id, time, retries) { log("caught", id, time, retries); },
    quit(id, time, retries) { log("quit", id, time, retries); runId = null; },
    win(time, retries) {
      log("win", "true", time, retries);
      if (!db) return;
      build(); if (!ui) return;
      last = { time_s: Math.max(30, secs(time)), retries: retries | 0 };
      ui.form.hidden = false; ui.post.disabled = false; say(""); ui.el.hidden = false; load();
    }
  };
})();
