import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.3.1";

const STORAGE_KEY = "cloudsync-reader-mvp-books";

export function App() {
  const [books, setBooks] = useState(() => loadBooks());
  const [activeBookId, setActiveBookId] = useState(null);
  const activeBook = useMemo(() => books.find((b) => b.id === activeBookId) ?? null, [books, activeBookId]);

  const [pdfState, setPdfState] = useState({ doc: null, page: 1, pages: 0 });
  const pdfCanvasRef = useRef(null);
  const epubContainerRef = useRef(null);
  const epubRenditionRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  }, [books]);

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
    if (epubContainerRef.current) {
      epubContainerRef.current.innerHTML = "";
    }
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
    }

    event.target.value = "";
  }

  function removeBook(bookId) {
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
    if (activeBookId === bookId) setActiveBookId(null);
  }

  function nextPdfPage(delta) {
    setPdfState((prev) => {
      if (!prev.doc) return prev;
      const next = Math.max(1, Math.min(prev.pages, prev.page + delta));
      return { ...prev, page: next };
    });
  }

  function progressLabel(book) {
    if (book.type === "pdf") return `page ${book.progress?.page || 1}`;
    return book.progress?.cfi ? "saved" : "start";
  }

  return React.createElement(
    React.Fragment,
    null,
    React.createElement("header", { className: "topbar" },
      React.createElement("h1", null, "CloudSync Reader MVP (React)"),
      React.createElement("p", null, "Read PDF/EPUB in browser with local progress sync."),
    ),
    React.createElement("main", { className: "layout" },
      React.createElement("aside", { className: "panel library-panel" },
        React.createElement("h2", null, "Library"),
        React.createElement("label", { className: "upload-btn", htmlFor: "bookInput" }, "+ Add PDF/EPUB"),
        React.createElement("input", {
          id: "bookInput",
          type: "file",
          accept: ".pdf,.epub,application/pdf,application/epub+zip",
          multiple: true,
          onChange: handleUpload,
        }),
        React.createElement("ul", { className: "library-list" },
          books.length === 0
            ? React.createElement("li", { className: "library-meta" }, "No books yet")
            : books.map((book) =>
                React.createElement("li", { key: book.id, className: "library-item" },
                  React.createElement("h3", null, book.title),
                  React.createElement("p", { className: "library-meta" }, `${book.type.toUpperCase()} • ${progressLabel(book)}`),
                  React.createElement("div", { className: "library-actions" },
                    React.createElement("button", { onClick: () => setActiveBookId(book.id) }, "Open"),
                    React.createElement("button", { onClick: () => removeBook(book.id) }, "Remove"),
                  ),
                ),
              ),
        ),
      ),
      React.createElement("section", { className: "panel reader-panel" },
        !activeBook
          ? React.createElement("div", { className: "empty-state" },
              React.createElement("div", null,
                React.createElement("h2", null, "No book selected"),
                React.createElement("p", null, "Upload and open a PDF/EPUB from your library."),
              ),
            )
          : React.createElement("div", { className: "reader-shell" },
              React.createElement("div", { className: "reader-toolbar" },
                React.createElement("strong", null, activeBook.title),
                activeBook.type === "pdf"
                  ? React.createElement("div", { className: "controls" },
                      React.createElement("button", { onClick: () => nextPdfPage(-1) }, "◀ Prev"),
                      React.createElement("span", null, `Page ${pdfState.page} / ${pdfState.pages}`),
                      React.createElement("button", { onClick: () => nextPdfPage(1) }, "Next ▶"),
                    )
                  : React.createElement("div", { className: "controls" },
                      React.createElement("button", { onClick: () => epubRenditionRef.current?.prev() }, "◀ Prev"),
                      React.createElement("button", { onClick: () => epubRenditionRef.current?.next() }, "Next ▶"),
                    ),
              ),
              activeBook.type === "pdf"
                ? React.createElement("div", { className: "pdf-reader" }, React.createElement("canvas", { ref: pdfCanvasRef }))
                : React.createElement("div", { ref: epubContainerRef, className: "epub-reader" }),
            ),
      ),
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
