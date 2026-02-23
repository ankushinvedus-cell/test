import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.3.1";

const STORAGE_KEY = "cloudsync-reader-mvp-books";

export function App() {
  const [books, setBooks] = useState(() => loadBooks());
  const [activeBookId, setActiveBookId] = useState(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");

  const [pdfState, setPdfState] = useState({ doc: null, page: 1, pages: 0 });
  const pdfCanvasRef = useRef(null);
  const epubContainerRef = useRef(null);
  const epubRenditionRef = useRef(null);

  const activeBook = useMemo(() => books.find((b) => b.id === activeBookId) ?? null, [books, activeBookId]);

  const filteredBooks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return books;
    return books.filter((book) => `${book.title} ${book.filename} ${book.type}`.toLowerCase().includes(q));
  }, [books, query]);

  const stats = useMemo(() => {
    const pdf = books.filter((b) => b.type === "pdf").length;
    const epub = books.filter((b) => b.type === "epub").length;
    return { total: books.length, pdf, epub };
  }, [books]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  }, [books]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;

    async function openActiveBook() {
      cleanupReaders();
      if (!activeBook) return;

      if (activeBook.type === "pdf") {
        const pdfjsLib = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

        const doc = await pdfjsLib.getDocument(activeBook.dataUrl).promise;
        if (cancelled) return;

        const page = Math.min(activeBook.progress?.page || 1, doc.numPages);
        setPdfState({ doc, page, pages: doc.numPages });
      }

      if (activeBook.type === "epub") {
        const book = ePub(activeBook.dataUrl);
        const rendition = book.renderTo(epubContainerRef.current, {
          width: "100%",
          height: "100%",
          allowScriptedContent: false,
        });

        epubRenditionRef.current = rendition;
        rendition.on("relocated", (location) => {
          const cfi = location?.start?.cfi;
          if (!cfi) return;
          setBooks((prev) => prev.map((b) => (b.id === activeBook.id ? { ...b, progress: { cfi } } : b)));
        });

        await rendition.display(activeBook.progress?.cfi || undefined);
      }
    }

    openActiveBook();
    return () => {
      cancelled = true;
      cleanupReaders();
    };
  }, [activeBookId]);

  useEffect(() => {
    async function renderPdfPage() {
      if (!activeBook || activeBook.type !== "pdf" || !pdfState.doc || !pdfCanvasRef.current) return;
      const page = await pdfState.doc.getPage(pdfState.page);
      const viewport = page.getViewport({ scale: 1.25 });
      const canvas = pdfCanvasRef.current;
      const context = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport }).promise;

      setBooks((prev) => prev.map((b) => (b.id === activeBook.id ? { ...b, progress: { page: pdfState.page } } : b)));
    }

    renderPdfPage();
  }, [pdfState.page, pdfState.doc, activeBook?.id]);

  function cleanupReaders() {
    setPdfState({ doc: null, page: 1, pages: 0 });
    if (epubRenditionRef.current) {
      epubRenditionRef.current.destroy();
      epubRenditionRef.current = null;
    }
    if (epubContainerRef.current) epubContainerRef.current.innerHTML = "";
  }

  async function handleUpload(event) {
    const files = Array.from(event.target.files ?? []);
    const parsed = [];

    for (const file of files) {
      const lower = file.name.toLowerCase();
      const type = lower.endsWith(".pdf") ? "pdf" : lower.endsWith(".epub") ? "epub" : null;
      if (!type) continue;
      const dataUrl = await readAsDataUrl(file);
      parsed.push({
        id: crypto.randomUUID(),
        title: file.name.replace(/\.(pdf|epub)$/i, ""),
        filename: file.name,
        type,
        dataUrl,
        progress: type === "pdf" ? { page: 1 } : { cfi: null },
      });
    }

    if (parsed.length) {
      setBooks((prev) => [...parsed, ...prev]);
      if (!activeBookId) setActiveBookId(parsed[0].id);
      setToast(`${parsed.length} book${parsed.length > 1 ? "s" : ""} added`);
    }

    event.target.value = "";
  }

  function removeBook(bookId) {
    const removed = books.find((b) => b.id === bookId);
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
    if (activeBookId === bookId) setActiveBookId(null);
    if (removed) setToast(`Removed “${removed.title}”`);
  }

  function nextPdfPage(delta) {
    setPdfState((prev) => {
      if (!prev.doc) return prev;
      const next = Math.max(1, Math.min(prev.pages, prev.page + delta));
      return { ...prev, page: next };
    });
  }

  function progressLabel(book) {
    if (book.type === "pdf") return `Page ${book.progress?.page || 1}`;
    return book.progress?.cfi ? "Saved location" : "Start";
  }

  function isActive(book) {
    return book.id === activeBookId;
  }

  return React.createElement(
    React.Fragment,
    null,
    React.createElement("div", { className: "app-shell" },
      React.createElement("header", { className: "topbar" },
        React.createElement("div", null,
          React.createElement("h1", null, "CloudSync Reader"),
          React.createElement("p", null, "Modern web MVP for PDF/EPUB reading and seamless local progress."),
        ),
        React.createElement("div", { className: "stats" },
          React.createElement("span", { className: "stat-pill" }, `${stats.total} books`),
          React.createElement("span", { className: "stat-pill" }, `${stats.pdf} PDF`),
          React.createElement("span", { className: "stat-pill" }, `${stats.epub} EPUB`),
        ),
      ),

      React.createElement("main", { className: "layout" },
        React.createElement("aside", { className: "panel library-panel" },
          React.createElement("div", { className: "library-head" },
            React.createElement("h2", null, "Library"),
            React.createElement("label", { className: "upload-btn", htmlFor: "bookInput" }, "+ Add books"),
          ),
          React.createElement("input", {
            id: "bookInput",
            type: "file",
            accept: ".pdf,.epub,application/pdf,application/epub+zip",
            multiple: true,
            onChange: handleUpload,
          }),
          React.createElement("input", {
            className: "search-input",
            type: "search",
            placeholder: "Search title or format…",
            value: query,
            onChange: (e) => setQuery(e.target.value),
          }),
          React.createElement("ul", { className: "library-list" },
            filteredBooks.length === 0
              ? React.createElement("li", { className: "library-empty" }, query ? "No matches found." : "No books yet.")
              : filteredBooks.map((book) =>
                  React.createElement("li", {
                    key: book.id,
                    className: `library-item ${isActive(book) ? "active" : ""}`,
                  },
                    React.createElement("div", { className: "book-row" },
                      React.createElement("h3", null, book.title),
                      React.createElement("span", { className: `format-chip ${book.type}` }, book.type.toUpperCase()),
                    ),
                    React.createElement("p", { className: "library-meta" }, progressLabel(book)),
                    React.createElement("div", { className: "library-actions" },
                      React.createElement("button", { className: "btn-primary", onClick: () => setActiveBookId(book.id) }, "Open"),
                      React.createElement("button", { className: "btn-ghost", onClick: () => removeBook(book.id) }, "Remove"),
                    ),
                  ),
                ),
          ),
        ),

        React.createElement("section", { className: "panel reader-panel" },
          !activeBook
            ? React.createElement("div", { className: "empty-state" },
                React.createElement("div", { className: "empty-card" },
                  React.createElement("h2", null, "Pick a book to start reading"),
                  React.createElement("p", null, "Upload PDF/EPUB files and continue exactly where you left off."),
                ),
              )
            : React.createElement("div", { className: "reader-shell" },
                React.createElement("div", { className: "reader-toolbar" },
                  React.createElement("div", { className: "reader-title-group" },
                    React.createElement("strong", null, activeBook.title),
                    React.createElement("span", null, activeBook.filename),
                  ),
                  activeBook.type === "pdf"
                    ? React.createElement("div", { className: "controls" },
                        React.createElement("button", { className: "btn-ghost", onClick: () => nextPdfPage(-1) }, "◀ Prev"),
                        React.createElement("span", { className: "page-indicator" }, `Page ${pdfState.page} / ${pdfState.pages}`),
                        React.createElement("button", { className: "btn-primary", onClick: () => nextPdfPage(1) }, "Next ▶"),
                      )
                    : React.createElement("div", { className: "controls" },
                        React.createElement("button", { className: "btn-ghost", onClick: () => epubRenditionRef.current?.prev() }, "◀ Prev"),
                        React.createElement("button", { className: "btn-primary", onClick: () => epubRenditionRef.current?.next() }, "Next ▶"),
                      ),
                ),
                activeBook.type === "pdf"
                  ? React.createElement("div", { className: "pdf-reader" }, React.createElement("canvas", { ref: pdfCanvasRef }))
                  : React.createElement("div", { ref: epubContainerRef, className: "epub-reader" }),
              ),
        ),
      ),
      toast ? React.createElement("div", { className: "toast" }, toast) : null,
    ),
  );
}

function loadBooks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
