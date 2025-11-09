// docs/find/app.js
(function () {
  const $ = (id) => document.getElementById(id);

  // --- utils ---
  const norm = (s) => (s || "").toLowerCase();
  const words = (s) => (s || "").toLowerCase().match(/[a-zæøå0-9]+/g) || [];
  const debounce = (fn, ms = 200) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  // --- data ---
  async function loadIndex() {
    try {
      const res = await fetch("./index.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const idx = await res.json();
      console.log("Index loaded:", {
        components: idx.components?.length || 0,
        patterns: idx.patterns?.length || 0,
        docs: idx.all_docs?.length || 0,
      });
      return idx;
    } catch (e) {
      console.error("Kunne ikke laste index.json:", e);
      $("results").innerHTML = `<p>Feil ved lasting av index.json: ${String(e)}</p>`;
      return { components: [], patterns: [], all_docs: [], aliases: {} };
    }
  }

  // --- scoring / matching ---
  function scoreDoc(queryTokens, doc) {
    // enkel token-baserte treff: 1 poeng per token-treff, +bonus for komponent/mønster
    const set = new Set(doc.tokens || []);
    let s = 0;
    for (const t of queryTokens) if (set.has(t)) s += 1;
    if (doc.type === "component") s += 2;
    if (doc.type === "pattern") s += 1;
    // litt bonus hvis exakte ord i navn
    const name = norm(doc.name || doc.title || "");
    if (queryTokens.some((t) => name.includes(t))) s += 1;
    return s;
  }

  function buildAnswerPack(query, idx) {
    const qTokens = words(query);
    if (!qTokens.length) return null;

    // Kandidater
    const compCand = (idx.components || [])
      .map((d) => ({ doc: d, score: scoreDoc(qTokens, d) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    const pattCand = (idx.patterns || [])
      .map((d) => ({ doc: d, score: scoreDoc(qTokens, d) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    // Relatert innhold fra all_docs (språk/god praksis/visuell identitet osv.)
    const extraCand = (idx.all_docs || [])
      .map((d) => ({ doc: d, score: scoreDoc(qTokens, d) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    // Ta første relevante komponent som hovedkort
    const component = compCand[0]?.doc || null;

    // Filtrer ekstra-liste slik at vi ikke dupliserer hovedkortet,
    // og vis bare forskjellige URL-er
    const seenUrls = new Set(component ? [component.url] : []);
    const unique = (arr) => {
      const out = [];
      for (const { doc } of arr) {
        if (!doc?.url || seenUrls.has(doc.url)) continue;
        seenUrls.add(doc.url);
        out.push(doc);
        if (out.length >= 8) break;
      }
      return out;
    };

    return {
      component,
      patterns: unique(pattCand),
      extras: unique(extraCand),
    };
  }

  // --- rendering ---
  function renderAnswerPack(pack, query) {
    const el = $("results");
    if (!pack) {
      el.innerHTML = `<p>Ingen treff for «${query || ""}».</p>`;
      return;
    }

    const comp = pack.component;
    const compCard = comp
      ? `
      <article class="card" aria-labelledby="comp-h">
        <h2 id="comp-h">Komponent: ${esc(comp.name || comp.title)}</h2>
        ${comp.image ? `<img src="${comp.image}" alt="" loading="lazy" />` : ""}
        ${comp.summary ? `<p>${esc(comp.summary)}</p>` : ""}
        <p>
          <a href="${comp.url}" target="_blank" rel="noopener">Åpne komponent-dokumentasjonen</a>
        </p>
        ${
          comp.tips?.length
            ? `<h3>Tips & obs</h3>
               <ul>${comp.tips.slice(0, 8).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`
            : ""
        }
      </article>`
      : "";

    const pattList =
      pack.patterns?.length
        ? `
      <article class="card" aria-labelledby="pat-h">
        <h2 id="pat-h">Kjente mønstre</h2>
        <ul>
          ${pack.patterns
            .slice(0, 5)
            .map((p) => `<li><a href="${p.url}" target="_blank" rel="noopener">${esc(p.title || p.name || p.url)}</a></li>`)
            .join("")}
        </ul>
      </article>`
        : "";

    const extrasList =
      pack.extras?.length
        ? `
      <details class="card" aria-labelledby="rel-h">
        <summary id="rel-h">Relatert innhold</summary>
        <ul>
          ${pack.extras
            .slice(0, 8)
            .map((d) => `<li><a href="${d.url}" target="_blank" rel="noopener">${esc(d.title || d.name || d.url)}</a></li>`)
            .join("")}
        </ul>
      </details>`
        : "";

    el.innerHTML = compCard + pattList + extrasList;

    // Litt status nederst for å forstå treffene (kan fjernes senere)
    el.insertAdjacentHTML(
      "beforeend",
      `<p style="opacity:.6;font-size:.9em;margin-top:1rem">Søk: «${esc(query)}»</p>`
    );
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // --- init ---
  window.addEventListener("DOMContentLoaded", async () => {
    const idx = await loadIndex();
    const input = $("q");
    const go = $("go");

    const run = () => {
      const q = input.value.trim();
      console.log("RUN search:", q);
      const pack = buildAnswerPack(q, idx);
      renderAnswerPack(pack, q);
    };

    // Interaksjoner
    go.addEventListener("click", run);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        run();
      }
    });
    input.addEventListener("input", debounce(run, 150));

    // Demo: forhåndsfyll et vanlig spørsmål for å verifisere kjapt
    if (!input.value) input.value = "Neste-knapp";
    run();
  });
})();
