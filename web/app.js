const STORAGE_KEY = "cloudsync-reader-mvp-books";

const els = {
  bookInput: document.getElementById("bookInput"),
  libraryList: document.getElementById("libraryList"),
  emptyState: document.getElementById("emptyState"),
  readerShell: document.getElementById("readerShell"),
  bookTitle: document.getElementById("bookTitle"),
  pdfControls: document.getElementById("pdfControls"),
  pdfPrevBtn: document.getElementById("pdfPrevBtn"),
  pdfNextBtn: document.getElementById("pdfNextBtn"),
  pdfPageInfo: document.getElementById("pdfPageInfo"),
  pdfReader: document.getElementById("pdfReader"),
  pdfCanvas: document.getElementById("pdfCanvas"),
  epubControls: document.getElementById("epubControls"),
  epubPrevBtn: document.getElementById("epubPrevBtn"),
  epubNextBtn: document.getElementById("epubNextBtn"),
  epubReader: document.getElementById("epubReader"),
};

const state = {
  books: loadBooks(),
  activeBookId: null,
  pdfDoc: null,
  pdfPage: 1,
  epubBook: null,
  epubRendition: null,
};

renderLibrary();
wireEvents();

function wireEvents() {
  els.bookInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await addBook(file);
    }
    e.target.value = "";
    renderLibrary();
  });

  els.pdfPrevBtn.addEventListener("click", () => goPdfPage(-1));
  els.pdfNextBtn.addEventListener("click", () => goPdfPage(1));
  els.epubPrevBtn.addEventListener("click", () => state.epubRendition?.prev());
  els.epubNextBtn.addEventListener("click", () => state.epubRendition?.next());
}

function loadBooks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function persistBooks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.books));
}

function formatProgress(book) {
  if (book.type === "pdf") {
    return `Progress: page ${book.progress?.page || 1}`;
  }
  if (book.type === "epub") {
    return `Progress: ${book.progress?.cfi ? "saved" : "start"}`;
  }
  return "Progress: -";
}

async function addBook(file) {
  const name = file.name;
  const lower = name.toLowerCase();
  const type = lower.endsWith(".pdf") ? "pdf" : lower.endsWith(".epub") ? "epub" : null;
  if (!type) return;

  const dataUrl = await readAsDataURL(file);
  const id = crypto.randomUUID();

  state.books.unshift({
    id,
    title: name.replace(/\.(pdf|epub)$/i, ""),
    filename: name,
    type,
    dataUrl,
    progress: type === "pdf" ? { page: 1 } : { cfi: null },
    addedAt: new Date().toISOString(),
  });

  persistBooks();
}

function renderLibrary() {
  els.libraryList.innerHTML = "";
  if (!state.books.length) {
    els.libraryList.innerHTML = "<li class='library-meta'>No books yet</li>";
    return;
  }

  for (const book of state.books) {
    const li = document.createElement("li");
    li.className = "library-item";
    li.innerHTML = `
      <h3>${escapeHtml(book.title)}</h3>
      <p class="library-meta">${book.type.toUpperCase()} • ${formatProgress(book)}</p>
      <div class="library-actions">
        <button data-open="${book.id}">Open</button>
        <button data-remove="${book.id}">Remove</button>
      </div>
    `;
    els.libraryList.appendChild(li);
  }

  els.libraryList.querySelectorAll("button[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => openBook(btn.dataset.open));
  });
  els.libraryList.querySelectorAll("button[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => removeBook(btn.dataset.remove));
  });
}

function removeBook(bookId) {
  if (state.activeBookId === bookId) {
    clearReader();
  }
  state.books = state.books.filter((b) => b.id !== bookId);
  persistBooks();
  renderLibrary();
}

async function openBook(bookId) {
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return;

  clearReader();
  state.activeBookId = bookId;

  els.emptyState.classList.add("hidden");
  els.readerShell.classList.remove("hidden");
  els.bookTitle.textContent = book.title;

  if (book.type === "pdf") {
    els.pdfControls.classList.remove("hidden");
    els.pdfReader.classList.remove("hidden");

    const pdfjsLib = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

    state.pdfDoc = await pdfjsLib.getDocument(book.dataUrl).promise;
    state.pdfPage = Math.min(book.progress?.page || 1, state.pdfDoc.numPages);
    await renderPdfPage();
  }

  if (book.type === "epub") {
    els.epubControls.classList.remove("hidden");
    els.epubReader.classList.remove("hidden");

    state.epubBook = ePub(book.dataUrl);
    state.epubRendition = state.epubBook.renderTo("epubReader", {
      width: "100%",
      height: "100%",
      allowScriptedContent: false,
    });

    state.epubRendition.on("relocated", (location) => {
      const active = state.books.find((b) => b.id === state.activeBookId);
      if (!active || active.type !== "epub") return;
      active.progress = { cfi: location.start.cfi };
      persistBooks();
      renderLibrary();
    });

    await state.epubRendition.display(book.progress?.cfi || undefined);
  }
}

async function renderPdfPage() {
  if (!state.pdfDoc) return;
  const page = await state.pdfDoc.getPage(state.pdfPage);
  const viewport = page.getViewport({ scale: 1.3 });
  const canvas = els.pdfCanvas;
  const context = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;

  els.pdfPageInfo.textContent = `Page ${state.pdfPage} / ${state.pdfDoc.numPages}`;

  const active = state.books.find((b) => b.id === state.activeBookId);
  if (active && active.type === "pdf") {
    active.progress = { page: state.pdfPage };
    persistBooks();
    renderLibrary();
  }
}

async function goPdfPage(delta) {
  if (!state.pdfDoc) return;
  const next = state.pdfPage + delta;
  if (next < 1 || next > state.pdfDoc.numPages) return;
  state.pdfPage = next;
  await renderPdfPage();
}

function clearReader() {
  state.activeBookId = null;
  state.pdfDoc = null;
  state.pdfPage = 1;

  if (state.epubRendition) {
    state.epubRendition.destroy();
    state.epubRendition = null;
  }
  state.epubBook = null;

  els.readerShell.classList.add("hidden");
  els.emptyState.classList.remove("hidden");
  els.pdfControls.classList.add("hidden");
  els.epubControls.classList.add("hidden");
  els.pdfReader.classList.add("hidden");
  els.epubReader.classList.add("hidden");
  els.epubReader.innerHTML = "";
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
