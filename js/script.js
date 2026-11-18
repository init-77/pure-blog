/* =========================================================================
   LOGICA APPLICATIVA (FILTRO TAG, RENDERING MARKDOWN E ROUTING)
   ========================================================================= */
let articles = [];
let activeTag = "tutti";
let currentPage = 1;
const ARTICLES_PER_PAGE = 8;
const CONTENT_DIRECTORY_URL = new URL("../content/", document.currentScript.src);
const ARTICLES_INDEX_URL = new URL("../content/articles.json", document.currentScript.src);

// Icona SVG geometrica ispirata all'indicatore nello screenshot
const ringIconSVG = `
  <svg class="card-indicator" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="16" cy="16" r="10" stroke="currentColor" stroke-width="5" stroke-dasharray="3.2 2.2"/>
  </svg>
`;

function parseArticle(source, filename) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error(`Front matter mancante in ${filename}`);

  const metadata = jsyaml.load(match[1]) || {};
  const filenameDate = filename.match(/^(\d{4})(\d{2})(\d{2})/);
  const rawDate = metadata.date ?? (filenameDate
    ? `${filenameDate[1]}-${filenameDate[2]}-${filenameDate[3]}`
    : "");
  const date = rawDate instanceof Date
    ? rawDate.toISOString().slice(0, 10)
    : String(rawDate);

  if (!metadata.title || !Array.isArray(metadata.tags) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Metadati non validi in ${filename}`);
  }

  return {
    ...metadata,
    author: Array.isArray(metadata.author)
      ? metadata.author.join(", ").replace(/\[\[(.*?)\]\]/g, "$1")
      : (metadata.author || "Autore sconosciuto"),
    date,
    excerpt: metadata.excerpt || metadata.description || "",
    readTime: metadata.readTime || "",
    id: filename.replace(/\.md$/i, ""),
    markdown: match[2]
  };
}

async function loadArticles() {
  try {
    const indexResponse = await fetch(ARTICLES_INDEX_URL);
    if (!indexResponse.ok) throw new Error("Impossibile caricare l'indice degli articoli");

    const articleFiles = await indexResponse.json();
    if (!Array.isArray(articleFiles) || articleFiles.some(filename => typeof filename !== "string" || !/^[^/]+\.md$/i.test(filename))) {
      throw new Error("Indice degli articoli non valido");
    }

    articles = await Promise.all(articleFiles.map(async filename => {
      const url = new URL(encodeURIComponent(filename), CONTENT_DIRECTORY_URL);
      const articleResponse = await fetch(url);
      if (!articleResponse.ok) throw new Error(`Impossibile caricare ${filename}`);
      return parseArticle(await articleResponse.text(), filename);
    }));
    articles.sort((first, second) => second.date.localeCompare(first.date));

    if (document.getElementById("cards-container")) {
      renderTags();
      renderCards();
    }

    if (document.getElementById("post-content")) {
      const articleId = new URLSearchParams(window.location.search).get("article");
      if (articleId) {
        openArticle(articleId, false);
      } else {
        document.getElementById("post-title").textContent = "Articolo non trovato";
      }
    } else if (window.location.hash.startsWith("#articolo/")) {
      const id = window.location.hash.replace("#articolo/", "");
      openArticle(id, false);
    }
  } catch (error) {
    const countLabel = document.getElementById("articles-count-label");
    const cardsContainer = document.getElementById("cards-container");
    if (countLabel) countLabel.textContent = "Articoli non disponibili";
    if (cardsContainer) {
      const details = error instanceof Error ? ` ${error.message}` : "";
      cardsContainer.textContent = `Impossibile caricare gli articoli.${details}`;
    }
    console.error("Errore durante il caricamento degli articoli:", error);
  }
}

// Estrae tutti i tag unici dagli articoli
function getAllTags() {
  const tagSet = new Set();
  articles.forEach(article => article.tags.forEach(tag => tagSet.add(tag)));
  return ["tutti", ...Array.from(tagSet)];
}

// Renderizza la barra dei tag
function renderTags() {
  const container = document.getElementById("tags-container");
  const tags = getAllTags();
  const tagCounts = new Map();

  articles.forEach(article => {
    article.tags.forEach(tag => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1));
  });

  container.innerHTML = tags.map(tag => `
    <button
      class="tag-btn ${activeTag === tag ? 'active' : ''}"
      onclick="filterByTag('${tag}')">
      ${tag === 'tutti'
        ? `Tutti gli articoli (${articles.length})`
        : `#${tag} (${tagCounts.get(tag) || 0})`}
    </button>
  `).join("");
}

// Filtra gli articoli per tag
function filterByTag(tag) {
  activeTag = tag;
  currentPage = 1;
  renderTags();
  renderCards();
}

// Renderizza le schede riassuntive nella Home Page
function renderCards() {
  const container = document.getElementById("cards-container");
  const countLabel = document.getElementById("articles-count-label");

  const filtered = activeTag === "tutti"
    ? articles
    : articles.filter(article => article.tags.includes(activeTag));
  const pageCount = Math.ceil(filtered.length / ARTICLES_PER_PAGE);
  currentPage = Math.min(currentPage, Math.max(pageCount, 1));
  const pageStart = (currentPage - 1) * ARTICLES_PER_PAGE;
  const pageArticles = filtered.slice(pageStart, pageStart + ARTICLES_PER_PAGE);

  countLabel.textContent = activeTag === "tutti"
    ? `Articoli pubblicati (${filtered.length})`
    : `Argomento: #${activeTag} (${filtered.length})`;

  container.innerHTML = pageArticles.map(article => `
    <article class="article-card" data-article-id="${encodeURIComponent(article.id)}">
      <div class="card-content">
        <h2 class="card-title">${article.title}</h2>
        <div class="card-meta">di ${article.author} · ${article.date}</div>
        <p class="card-excerpt">${article.excerpt}</p>
        <div class="card-footer">
          ${article.tags.map(tag => `<span class="card-tag">#${tag}</span>`).join("")}
        </div>
      </div>
      ${ringIconSVG}
    </article>
  `).join("");

    container.querySelectorAll(".article-card").forEach(card => {
      const articleId = decodeURIComponent(card.dataset.articleId);
      card.addEventListener("click", () => openArticlePage(articleId));
    });

  renderPagination(pageCount);
}

function renderPagination(pageCount) {
  const container = document.getElementById("pagination-controls");
  if (!container) return;

  if (pageCount <= 1) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <button class="page-btn" type="button" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>
      Precedenti
    </button>
    <span class="page-status" aria-live="polite">Pagina ${currentPage} di ${pageCount}</span>
    <button class="page-btn" type="button" data-page="${currentPage + 1}" ${currentPage === pageCount ? "disabled" : ""}>
      Successivi
    </button>
  `;

  container.querySelectorAll(".page-btn:not(:disabled)").forEach(button => {
    button.addEventListener("click", () => {
      currentPage = Number(button.dataset.page);
      renderCards();
      document.getElementById("home-view").scrollIntoView({ behavior: "smooth" });
    });
  });
}

function openArticlePage(id) {
  const articleUrl = new URL("article.html", window.location.href);
  articleUrl.searchParams.set("article", id);
  window.location.href = articleUrl;
}

// Apre la pagina/vista del singolo articolo convertendo il Markdown
function openArticle(id, updateHistory = true) {
  const article = articles.find(item => item.id === id);
  if (!article) return;

  document.getElementById("post-meta").textContent = `${article.date} · di ${article.author} · ${article.readTime}`;
  document.getElementById("post-title").textContent = article.title;
  document.getElementById("post-tags").innerHTML = article.tags
    .map(tag => `<span class="card-tag">#${tag}</span>`)
    .join("");

  // Converte il testo Markdown in HTML pulito tramite marked.js
  document.getElementById("post-content").innerHTML = marked.parse(article.markdown, { breaks: true });

  // Cambia vista
  const homeView = document.getElementById("home-view");
  if (homeView) {
    homeView.style.display = "none";
    document.getElementById("article-view").classList.add("active");
  } else {
    document.title = `${article.title} — Appunti sul margine`;
  }

  // Aggiorna l'URL hash così il tasto "Indietro" del browser funziona naturalmente
  if (updateHistory && homeView) {
    window.location.hash = `articolo/${article.id}`;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Torna alla Home Page
function showHome(updateHistory = true) {
  if (!document.getElementById("home-view")) {
    window.location.href = "index.html";
    return;
  }

  document.getElementById("article-view").classList.remove("active");
  document.getElementById("home-view").style.display = "block";
  currentPage = 1;
  renderCards();

  if (updateHistory) {
    history.pushState("", document.title, window.location.pathname + window.location.search);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Gestisce il tasto Indietro/Avanti del browser tramite URL hash
if (document.getElementById("home-view")) {
  window.addEventListener("hashchange", () => {
    const hash = window.location.hash;
    if (hash.startsWith("#articolo/")) {
      const id = hash.replace("#articolo/", "");
      openArticle(id, false);
    } else {
      showHome(false);
    }
  });
}

// Inizializzazione al caricamento della pagina
document.addEventListener("DOMContentLoaded", loadArticles);