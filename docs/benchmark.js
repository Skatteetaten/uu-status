(function () {
  const DATASET_URL = 'https://data.uutilsynet.no/dataset/alle-erklaeringer';
  const LOCAL_MIRROR_URL = './data/uustatus/benchmark-source.json';
  const CACHE_KEY = 'uu-benchmark-cache-v2-orgnr';
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const REQUIREMENTS_PER_DECLARATION = 48;

  const TARGETS = [
    { key: 'skatteetaten', name: 'Skatteetaten', aliases: ['skatteetaten', 'skatteetatens'], orgNumbers: ['974761076'] },
    { key: 'nav', name: 'NAV', aliases: ['arbeids og velferdsetaten', 'arbeids- og velferdsetaten'], orgNumbers: ['889640782'] },
    { key: 'helsenorge_helsedirektoratet', name: 'Helsenorge / Helsedirektoratet', aliases: ['helsedirektoratet', 'norsk helsenett'], orgNumbers: ['994598759', '983544622'] },
    { key: 'domstolene', name: 'Domstolene', aliases: ['domstolene', 'domstoladministrasjonen', 'domstol', 'hoyesterett', 'høgesterett'], orgNumbers: ['926721720', '926721380'] },
    {
      key: 'regjeringen',
      name: 'Regjeringen.no',
      aliases: ['departementet', 'departementene', 'statsministerens kontor'],
      urlIncludes: ['regjeringen.no'],
      orgNumbers: ['977161630', '932931311', '872417842']
    },
    { key: 'statens_vegvesen', name: 'Statens vegvesen', aliases: ['statens vegvesen'], orgNumbers: ['971032081'] },
    { key: 'oslo_kommune', name: 'Oslo kommune', aliases: ['oslo kommune'], orgNumbers: ['958935420'] },
    { key: 'forsvaret', name: 'Forsvaret', aliases: ['forsvaret'], orgNumbers: ['986105174'] },
    {
      key: 'politi_lensmannsetaten',
      name: 'Politidirektoratet',
      aliases: ['politidirektoratet'],
      orgNumbers: ['982531950']
    },
    {
      key: 'utlendingsdirektoratet',
      name: 'Utlendingsdirektoratet',
      aliases: ['utlendingsdirektoratet'],
      orgNumbers: ['974760746']
    },
    {
      key: 'digdir',
      name: 'Digdir',
      aliases: ['digitaliseringsdirektoratet', 'digdir'],
      orgNumbers: ['991825827']
    }
  ];

  const PATHS = {
    orgName: ['verksemdNamn', 'organisasjon', 'organizationName', 'orgName', 'organisasjonsnavn'],
    orgNumber: ['organisasjonsnummer', 'orgnr', 'organisasjonnummer', 'organizationNumber'],
    serviceName: ['iktLoeysingNamn', 'iktLoysingNamn', 'serviceName', 'losning', 'tjenesteNavn', 'name', 'navn'],
    serviceUrl: ['iktLoeysingAdresse', 'iktLoysingAdresse', 'publiseringsadresse', 'erklaeringsAdresse', 'url', 'nettadresse', 'adresse'],
    declarationUrl: ['erklaeringsAdresse', 'publiseringsadresse', 'declarationUrl', 'erklaeringUrl', 'url'],
    brudd: ['talBrot', 'antallBrudd', 'brudd', 'totalBrudd', 'brot'],
    oppfylt: ['talSamsvar', 'antallOppfylt', 'oppfylt', 'totalOppfylt', 'samsvar'],
    ikkeRelevant: ['talIkkjeRelevant', 'antallIkkeRelevant', 'ikkeRelevant', 'ikkjeRelevant', 'totalIkkeRelevant'],
    updatedAt: ['sisteOppdatering', 'erklaeringErOppdatert', 'updatedAt', 'lastUpdated', 'sistOppdatert', 'sistOppdatertDato']
  };

  const OWNED_DOMAIN_RULES = {
    skatteetaten: {
      suffixes: [
        'skatteetaten.no',
        'sua.no',
        'skatteetaten.github.io',
        'skatteetaten.sharepoint.com',
        'skatt-sit.sits.no',
        'skatt.skatteeaten.no'
      ],
      contains: ['skatteetaten', 'skatt']
    },
    nav: { suffixes: ['nav.no'] },
    helsenorge_helsedirektoratet: { suffixes: ['helsenorge.no', 'helsedirektoratet.no'] },
    domstolene: { suffixes: ['domstol.no', 'domstolene.no'] },
    regjeringen: { suffixes: ['regjeringen.no'] },
    statens_vegvesen: { suffixes: ['vegvesen.no', 'vegvesenet.no'] },
    oslo_kommune: { suffixes: ['oslo.kommune.no', 'oslokommune.no'] },
    forsvaret: { suffixes: ['forsvaret.no'] },
    politi_lensmannsetaten: { suffixes: ['politi.no', 'politiet.no'] },
    utlendingsdirektoratet: { suffixes: ['udi.no'] },
    digdir: { suffixes: ['digdir.no'] }
  };

  function normalize(input) {
    if (input === null || input === undefined) return '';
    let s = String(input).toLowerCase();
    s = s.replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a');
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    s = s.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    return s;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const cleaned = String(value).replace(/\s/g, '').replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  function toDate(value) {
    if (!value) return null;
    const asDate = new Date(String(value).trim());
    if (!Number.isNaN(asDate.getTime())) return asDate;
    const m = String(value).trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) {
      const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
      if (!Number.isNaN(d.getTime())) return d;
    }
    return null;
  }

  function formatDate(value) {
    if (!value) return '—';
    const d = value instanceof Date ? value : toDate(value);
    if (!d) return '—';
    return d.toLocaleDateString('no-NO', { year: 'numeric', month: 'short', day: '2-digit' });
  }

  function formatDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('no-NO', {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }

  function formatInt(n) {
    if (!Number.isFinite(n)) return '0';
    return n.toLocaleString('no-NO');
  }

  function formatPercent(num) {
    if (num === null || num === undefined || !Number.isFinite(num)) return '—';
    return num.toLocaleString('no-NO', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  function pickByPath(obj, path) {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    let cur = obj;
    for (const part of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, part)) cur = cur[part];
      else return undefined;
    }
    return cur;
  }

  function pickFirst(obj, paths) {
    for (const p of paths) {
      const v = pickByPath(obj, p);
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return null;
  }

  function containsAlias(normalizedText, alias) {
    const normalizedAlias = normalize(alias);
    if (!normalizedAlias) return false;
    const isSingleWord = !normalizedAlias.includes(' ');
    if (isSingleWord) {
      return new RegExp(`(^| )${normalizedAlias}( |$)`).test(normalizedText);
    }
    return normalizedText.includes(normalizedAlias);
  }

  function safeUrlString(value) {
    if (!value) return '';
    const s = String(value).trim();
    if (!s) return '';
    try {
      return new URL(s).toString();
    } catch {
      return s;
    }
  }

  function hostAndPath(urlValue) {
    if (!urlValue) return '';
    try {
      const u = new URL(urlValue);
      return normalize(`${u.hostname} ${u.pathname}`);
    } catch {
      return normalize(urlValue);
    }
  }

  function hostFromUrl(urlValue) {
    if (!urlValue) return '';
    try {
      return new URL(urlValue).hostname.toLowerCase();
    } catch {
      return '';
    }
  }

  function isOwnedDomain(targetKey, host) {
    if (!host) return false;
    const rules = OWNED_DOMAIN_RULES[targetKey] || {};
    const suffixes = rules.suffixes || [];
    const contains = rules.contains || [];

    if (suffixes.some((d) => host === d || host.endsWith(`.${d}`))) return true;
    if (contains.some((token) => host.includes(token))) return true;
    return false;
  }

  function extractRecords(payload) {
    if (!payload) return [];
    const directCandidates = [
      payload,
      payload._embedded,
      payload.data,
      payload.items,
      payload.results,
      payload.content,
      payload._embedded && payload._embedded.dataElements,
      payload._embedded && payload._embedded.items,
      payload._embedded && payload._embedded.results,
      payload._embedded && payload._embedded.content,
      payload.records
    ];
    for (const candidate of directCandidates) {
      if (Array.isArray(candidate) && candidate.length) return candidate;
    }
    const likelyArrays = [];
    function walk(node, depth) {
      if (!node || depth > 4) return;
      if (Array.isArray(node)) {
        if (node.length && typeof node[0] === 'object' && !Array.isArray(node[0])) {
          const keys = Object.keys(node[0]);
          const score = keys.filter((k) => /(verksemd|ikt|erklaer|brudd|samsvar|updated|oppdatert)/i.test(k)).length;
          likelyArrays.push({ score, data: node });
        }
        for (const item of node) walk(item, depth + 1);
        return;
      }
      if (typeof node === 'object') {
        for (const k of Object.keys(node)) walk(node[k], depth + 1);
      }
    }
    walk(payload, 0);
    likelyArrays.sort((a, b) => b.score - a.score || b.data.length - a.data.length);
    return likelyArrays.length ? likelyArrays[0].data : [];
  }

  function countFromResultat(resultat) {
    if (!resultat || typeof resultat !== 'object') return { brudd: null, oppfylt: null, ikkeRelevant: null };
    const values = Array.isArray(resultat) ? resultat : Object.values(resultat);
    let brudd = 0;
    let oppfylt = 0;
    let ikkeRelevant = 0;
    for (const v of values) {
      const n = normalize(v);
      if (!n) continue;
      if (n.includes('brot') || n.includes('brudd') || n === 'ikkje samsvar') brudd += 1;
      else if (n.includes('samsvar') || n.includes('oppfylt')) oppfylt += 1;
      else if (n.includes('ikkje relevant') || n.includes('ikke relevant')) ikkeRelevant += 1;
    }
    return { brudd: brudd || null, oppfylt: oppfylt || null, ikkeRelevant: ikkeRelevant || null };
  }

  function normalizeOrgNumber(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\D/g, '');
  }

  function isAllowedOrgNumber(target, orgNumber) {
    const allowed = target.orgNumbers;
    if (!Array.isArray(allowed) || !allowed.length) return true;
    const n = normalizeOrgNumber(orgNumber);
    if (!n) return false;
    return allowed.includes(n);
  }

  function matchTarget(record) {
    const orgName = pickFirst(record, PATHS.orgName);
    const orgNumber = pickFirst(record, PATHS.orgNumber);
    const allUrls = [
      pickFirst(record, PATHS.serviceUrl),
      pickFirst(record, PATHS.declarationUrl),
      record.iktLoeysingAdresse,
      record.publiseringsadresse,
      record.erklaeringsAdresse
    ].filter(Boolean);
    const normalizedOrg = normalize(orgName || '');
    const normalizedUrls = allUrls.map(hostAndPath).join(' ');

    for (const target of TARGETS) {
      if (!isAllowedOrgNumber(target, orgNumber)) continue;
      if (target.urlIncludes && target.urlIncludes.some((needle) => normalizedUrls.includes(normalize(needle)))) return target;

      if (target.aliases && target.aliases.some((alias) => containsAlias(normalizedOrg, alias))) return target;
    }
    return null;
  }

  function newStats(target) {
    return {
      key: target.key,
      target: target.name,
      records: 0,
      solutions: new Set(),
      declarationUrls: new Set(),
      solutionUrls: new Set(),
      ownDomainSolutions: new Set(),
      externalDomainSolutions: new Set(),
      brudd: 0,
      oppfylt: 0,
      vurderte: 0,
      ikkeRelevant: 0,
      hasIkkeRelevant: false,
      latestUpdate: null
    };
  }

  function aggregate(records) {
    const map = new Map(TARGETS.map((t) => [t.key, newStats(t)]));
    for (const record of records) {
      const target = matchTarget(record);
      if (!target) continue;
      const stat = map.get(target.key);

      const solutionUrl = safeUrlString(pickFirst(record, PATHS.serviceUrl));
      const declarationUrl = safeUrlString(pickFirst(record, PATHS.declarationUrl));
      const uniqueKey = solutionUrl || declarationUrl || normalize(String(pickFirst(record, PATHS.serviceName) || pickFirst(record, PATHS.orgName) || ''));
      if (uniqueKey) stat.solutions.add(uniqueKey);
      if (solutionUrl) stat.solutionUrls.add(solutionUrl);
      if (declarationUrl) stat.declarationUrls.add(declarationUrl);
      if (solutionUrl) {
        const host = hostFromUrl(solutionUrl);
        if (isOwnedDomain(target.key, host)) stat.ownDomainSolutions.add(solutionUrl);
        else stat.externalDomainSolutions.add(solutionUrl);
      }

      let brudd = toNumber(pickFirst(record, PATHS.brudd));
      let oppfylt = toNumber(pickFirst(record, PATHS.oppfylt));
      let ikkeRelevant = toNumber(pickFirst(record, PATHS.ikkeRelevant));
      if (brudd === null || oppfylt === null || ikkeRelevant === null) {
        const counted = countFromResultat(record.resultat);
        if (brudd === null) brudd = counted.brudd;
        if (oppfylt === null) oppfylt = counted.oppfylt;
        if (ikkeRelevant === null) ikkeRelevant = counted.ikkeRelevant;
      }
      brudd = Number.isFinite(brudd) ? brudd : 0;
      oppfylt = Number.isFinite(oppfylt) ? oppfylt : 0;
      ikkeRelevant = Number.isFinite(ikkeRelevant) ? ikkeRelevant : 0;

      stat.brudd += brudd;
      stat.oppfylt += oppfylt;
      stat.vurderte += brudd + oppfylt;
      stat.ikkeRelevant += ikkeRelevant;
      if (ikkeRelevant > 0) stat.hasIkkeRelevant = true;

      const dt = toDate(pickFirst(record, PATHS.updatedAt));
      if (dt && (!stat.latestUpdate || dt > stat.latestUpdate)) stat.latestUpdate = dt;
    }

    const rows = TARGETS.map((t) => {
      const s = map.get(t.key);
      const declarationCount = s.declarationUrls.size;
      const denominator = declarationCount * REQUIREMENTS_PER_DECLARATION;
      const bruddandel = denominator > 0 ? s.brudd / denominator : null;
      const totalWithIr = s.vurderte + s.ikkeRelevant;
      const andelIr = s.hasIkkeRelevant && totalWithIr > 0 ? s.ikkeRelevant / totalWithIr : null;
      return {
        key: s.key,
        target: s.target,
        records: declarationCount,
        uniqueSolutions: s.solutions.size,
        ownDomainSolutions: s.ownDomainSolutions.size,
        externalDomainSolutions: s.externalDomainSolutions.size,
        brudd: s.brudd,
        oppfylt: s.oppfylt,
        vurderte: s.vurderte,
        bruddandel,
        ikkeRelevant: s.ikkeRelevant,
        andelIkkeRelevant: andelIr,
        latestUpdate: s.latestUpdate,
        declarationUrls: Array.from(s.declarationUrls),
        solutionUrls: Array.from(s.solutionUrls)
      };
    });

    rows.sort((a, b) => {
      const av = a.bruddandel === null ? Number.POSITIVE_INFINITY : a.bruddandel;
      const bv = b.bruddandel === null ? Number.POSITIVE_INFINITY : b.bruddandel;
      return av - bv;
    });
    return rows;
  }

  async function fetchAllRecords() {
    const firstRes = await fetch(DATASET_URL, { headers: { Accept: 'application/json' } });
    if (!firstRes.ok) throw new Error(`HTTP ${firstRes.status}`);
    const firstData = await firstRes.json();
    let all = extractRecords(firstData);
    const page = firstData.page || {};
    const totalPages = Number(page.totalPages || 1);
    const size = Number(page.size || 10);
    for (let p = 2; p <= totalPages; p += 1) {
      const pageUrl = new URL(DATASET_URL);
      pageUrl.searchParams.set('page', String(p));
      pageUrl.searchParams.set('size', String(size));
      const res = await fetch(pageUrl.toString(), { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} på side ${p}`);
      const data = await res.json();
      const rows = extractRecords(data);
      if (rows.length) all = all.concat(rows);
    }
    return all;
  }

  async function fetchLocalMirrorRecords() {
    const res = await fetch(LOCAL_MIRROR_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for lokal speilfil`);
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.records)) return data.records;
    return extractRecords(data);
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.records) || !parsed.fetchedAt) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function saveCache(records, source) {
    const payload = { fetchedAt: Date.now(), records, source: source || 'api' };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
    return payload;
  }

  function cacheIsFresh(cache) {
    if (!cache || !cache.fetchedAt) return false;
    return Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  }

  function setTechnicalStatus(message, isError) {
    const el = document.getElementById('technicalStatus');
    if (!el) return;
    el.textContent = `Teknisk: ${message}`;
    el.style.color = isError ? 'var(--bad)' : 'var(--muted)';
  }

  function linkListHtml(urls) {
    if (!urls || !urls.length) return '<span class="muted">Ingen lenker tilgjengelig.</span>';
    const uniq = Array.from(new Set(urls));
    const first = uniq.slice(0, 3);
    const links = first.map((u) => `<a href="${escapeHtml(u)}" target="_blank" rel="noopener">${escapeHtml(u)}</a>`).join('<br>');
    if (uniq.length <= 3) return links;

    const extraId = `extra-${Math.random().toString(36).slice(2, 10)}`;
    const extraLinks = uniq
      .slice(3)
      .map((u) => `<a href="${escapeHtml(u)}" target="_blank" rel="noopener">${escapeHtml(u)}</a>`)
      .join('<br>');

    return `
      ${links}
      <button type="button" class="btn-more-links muted" data-target-id="${extraId}" data-closed-label="+ ${uniq.length - 3} flere" aria-expanded="false" aria-controls="${extraId}" style="margin-top:4px;background:none;border:0;padding:0;cursor:pointer;text-decoration:underline;">
        + ${uniq.length - 3} flere
      </button>
      <div id="${extraId}" hidden style="margin-top:4px;">${extraLinks}</div>
    `;
  }

  function wireMoreLinksToggles(scopeEl) {
    scopeEl.querySelectorAll('.btn-more-links').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetId = btn.getAttribute('data-target-id');
        const panel = targetId ? document.getElementById(targetId) : null;
        if (!panel) return;

        const isOpen = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!isOpen));
        panel.hidden = isOpen;
        btn.textContent = isOpen ? (btn.dataset.closedLabel || '+ flere') : 'Vis færre';
      });
    });
  }

  function wireRowToggles(tbody) {
    const toggle = (row) => {
      const detailId = row.getAttribute('data-detail-id');
      const detail = detailId ? document.getElementById(detailId) : null;
      if (!detail) return;
      const open = row.getAttribute('aria-expanded') === 'true';
      row.setAttribute('aria-expanded', String(!open));
      detail.hidden = open;
    };

    tbody.querySelectorAll('.clickable-row').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target && e.target.closest('a')) return;
        toggle(row);
      });
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle(row);
        }
      });
    });
  }

  function renderRows(rows) {
    const tbody = document.getElementById('benchmarkBody');
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="muted">Ingen treff for valgte targets.</td></tr>';
      return;
    }

    const html = rows.map((row) => {
      let pillClass = 'pill neutral';
      if (row.bruddandel !== null) {
        if (row.bruddandel === 0) pillClass = 'pill ok';
        else if (row.bruddandel <= 0.15) pillClass = 'pill warn';
        else pillClass = 'pill bad';
      }
      const detailId = `detail-${row.key}`;
      const avgBrudd = row.records > 0 ? row.brudd / row.records : null;
      return `
        <tr class="clickable-row" data-detail-id="${detailId}" tabindex="0" role="button" aria-expanded="false" aria-controls="${detailId}">
          <td><span class="row-target"><span class="row-caret" aria-hidden="true">▶</span><span>${escapeHtml(row.target)}</span></span></td>
          <td>${formatInt(row.records)}</td>
          <td>${formatInt(row.brudd)} / ${avgBrudd === null ? '—' : avgBrudd.toLocaleString('no-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
          <td><span class="${pillClass}">${formatPercent(row.bruddandel)}</span></td>
          <td>${formatDate(row.latestUpdate)}</td>
        </tr>
        <tr class="detail-row" id="${detailId}" hidden>
          <td colspan="5">
            <div class="detail-content">
              <p>Bruddandel beregnet som brudd / (antall erklæringer × ${REQUIREMENTS_PER_DECLARATION}).</p>
              <ul>
                <li><strong>Erklæringer:</strong><br>${linkListHtml(row.declarationUrls)}</li>
                <li><strong>Løsninger:</strong><br>${linkListHtml(row.solutionUrls)}</li>
              </ul>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = html;
    wireRowToggles(tbody);
    wireMoreLinksToggles(tbody);
  }

  function renderKpis(rows) {
    const kpiSe = document.getElementById('kpiSkatteetaten');
    const kpiWeighted = document.getElementById('kpiWeightedOthers');
    const kpiRank = document.getElementById('kpiRank');
    const kpiExplain = document.getElementById('kpiExplain');
    const methodMath = document.getElementById('methodMath');

    const skatteetaten = rows.find((r) => r.key === 'skatteetaten') || null;
    const others = rows.filter((r) => r.key !== 'skatteetaten');
    const othersWithRate = others.filter((r) => r.bruddandel !== null);

    const weightedBrudd = others.reduce((sum, r) => sum + r.brudd, 0);
    const weightedDenominator = others.reduce((sum, r) => sum + (r.records * REQUIREMENTS_PER_DECLARATION), 0);
    const weighted = weightedDenominator > 0 ? weightedBrudd / weightedDenominator : null;

    const unweighted = othersWithRate.length
      ? othersWithRate.reduce((sum, r) => sum + r.bruddandel, 0) / othersWithRate.length
      : null;

    const ranked = rows.filter((r) => r.bruddandel !== null);
    const rankIndex = skatteetaten ? ranked.findIndex((r) => r.key === 'skatteetaten') : -1;
    const bestRank = rankIndex >= 0 ? rankIndex + 1 : -1;
    const rankText = bestRank > 0 ? `${bestRank} av ${ranked.length}` : '—';

    if (kpiSe) kpiSe.textContent = skatteetaten ? formatPercent(skatteetaten.bruddandel) : '—';
    if (kpiWeighted) kpiWeighted.textContent = formatPercent(unweighted);
    if (kpiRank) kpiRank.textContent = rankText;
    if (kpiExplain) {
      if (skatteetaten && skatteetaten.bruddandel !== null) {
        kpiExplain.textContent = `${formatPercent(skatteetaten.bruddandel)} betyr at ${formatPercent(skatteetaten.bruddandel)} av de 48 kravene per erklæring er rapportert med brudd i Skatteetatens tjenester.`;
      } else {
        kpiExplain.textContent = 'Ingen beregnet bruddandel for Skatteetaten i tilgjengelig datagrunnlag.';
      }
    }

    if (methodMath) {
      methodMath.textContent = `Vektet snitt: ${formatPercent(weighted)}. Uvektet snitt: ${formatPercent(unweighted)}.`;
    }
  }

  function getMaxDate(rows) {
    let maxDataDate = null;
    for (const r of rows) {
      if (r.latestUpdate && (!maxDataDate || r.latestUpdate > maxDataDate)) maxDataDate = r.latestUpdate;
    }
    return maxDataDate;
  }

  function renderSourceLine(maxDataDate) {
    const el = document.getElementById('sourceLine');
    if (!el) return;
    el.textContent = `Datakilde: Uu-tilsynets åpne datasett. Sist oppdatert: ${formatDate(maxDataDate)}.`;
  }

  function renderError(errorMessage) {
    const tbody = document.getElementById('benchmarkBody');
    if (!tbody) return;
      tbody.innerHTML = `
      <tr>
        <td colspan="5" class="muted">
          Kunne ikke hente datagrunnlag akkurat nå (${escapeHtml(errorMessage)}).
          <a href="${DATASET_URL}" target="_blank" rel="noopener">Åpne datasettet direkte</a>.
        </td>
      </tr>
    `;
  }

  function setupAccordion() {
    const btn = document.getElementById('methodToggle');
    const panel = document.getElementById('methodPanel');
    if (!btn || !panel) return;
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      panel.hidden = open;
    });
  }

  function setupInfoPopovers() {
    const buttons = Array.from(document.querySelectorAll('.info-btn[data-tooltip]'));
    if (!buttons.length) return;

    let openButton = null;

    const closePopover = (btn) => {
      if (!btn) return;
      const id = btn.getAttribute('aria-controls');
      const pop = id ? document.getElementById(id) : null;
      if (pop) pop.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      if (openButton === btn) openButton = null;
    };

    const openPopover = (btn) => {
      if (openButton && openButton !== btn) closePopover(openButton);
      const id = btn.getAttribute('aria-controls');
      const pop = id ? document.getElementById(id) : null;
      if (pop) pop.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      openButton = btn;
    };

    buttons.forEach((btn, i) => {
      const text = btn.getAttribute('data-tooltip') || '';
      const parent = btn.parentElement;
      if (!parent) return;

      const wrap = document.createElement('span');
      wrap.className = 'info-wrap';
      parent.insertBefore(wrap, btn);
      wrap.appendChild(btn);

      const pop = document.createElement('div');
      const popId = `info-popover-${i + 1}`;
      pop.id = popId;
      pop.className = 'info-popover';
      pop.setAttribute('role', 'tooltip');
      pop.hidden = true;
      pop.textContent = text;
      wrap.appendChild(pop);

      btn.setAttribute('aria-controls', popId);
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-haspopup', 'dialog');
      btn.removeAttribute('title');

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        if (expanded) closePopover(btn);
        else openPopover(btn);
      });
    });

    document.addEventListener('click', (e) => {
      if (!openButton) return;
      const target = e.target;
      if (target instanceof Node && openButton.parentElement && openButton.parentElement.contains(target)) return;
      closePopover(openButton);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && openButton) {
        closePopover(openButton);
        openButton.focus();
      }
    });
  }

  async function main() {
    setupAccordion();
    setupInfoPopovers();
    let cache = loadCache();
    try {
      if (!cacheIsFresh(cache)) {
        let records = [];
        let source = 'api';
        try {
          records = await fetchAllRecords();
        } catch (apiErr) {
          source = 'lokal-speilfil';
          records = await fetchLocalMirrorRecords();
          if (!records.length) throw apiErr;
        }
        cache = saveCache(records, source);
      }

      const rows = aggregate(cache.records);
      renderRows(rows);
      renderKpis(rows);
      renderSourceLine(getMaxDate(rows));
      const sourceText = cache.source === 'lokal-speilfil'
        ? 'en lokal speilfil av Uu-tilsynets åpne datasett'
        : 'Uu-tilsynets åpne API';
      setTechnicalStatus(`Data er hentet fra ${sourceText}. Cache oppdatert: ${formatDateTime(cache.fetchedAt)}.`, false);
    } catch (err) {
      const msg = err && err.message ? err.message : 'ukjent feil';
      if (cache && Array.isArray(cache.records) && cache.records.length) {
        const rows = aggregate(cache.records);
        renderRows(rows);
        renderKpis(rows);
        renderSourceLine(getMaxDate(rows));
        setTechnicalStatus(`Feil ved oppdatering (${msg}). Viser siste cachede versjon fra ${formatDateTime(cache.fetchedAt)}.`, true);
      } else {
        renderError(msg);
        setTechnicalStatus(`Feil ved henting av data: ${msg}`, true);
      }
    }
  }

  main();
})();
