pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
const pdfContainer = document.getElementById("pdf-container");
const fileInput = document.getElementById("file-input");
const fileInputModal = document.getElementById("file-input-modal");
const uploadModal = document.getElementById("upload-modal");
const pageInput = document.getElementById("page-input");
const goButton = document.getElementById("go-button");
const currentPageDisplay = document.getElementById("current-page");
const zoomInBtn = document.getElementById("zoom-in");
const zoomOutBtn = document.getElementById("zoom-out");

let pdfDoc = null;
let currentScroll = 0;
let scrollInterval = null;
let visiblePages = [];
const canvasMap = new Map();
let isScrolling = false;

const NUM_PAGES_TO_KEEP = 10;
let scale = 1.35;

function handlePDFUpload(file) {
    if (file && file.type === "application/pdf") {
    const fileReader = new FileReader();
    fileReader.onload = async function () {
        const typedArray = new Uint8Array(this.result);
        pdfDoc = await pdfjsLib.getDocument(typedArray).promise;
        resetView();
        renderPage(1);
    };
    fileReader.readAsArrayBuffer(file);
    }
}

fileInputModal.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
    uploadModal.style.display = "none";
    handlePDFUpload(file);
    }
});

fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
    handlePDFUpload(file);
    }
});

function resetView() {
    pdfContainer.innerHTML = "";
    canvasMap.clear();
    visiblePages = [];
    currentScroll = 0;
    window.scrollTo(0, 0);
}

zoomInBtn.addEventListener("click", () => {
    scale += 0.15;
    rerenderVisiblePages();
});

zoomOutBtn.addEventListener("click", () => {
    scale = Math.max(0.5, scale - 0.15);
    rerenderVisiblePages(true);
});

function rerenderVisiblePages(isZoomOut = false) {
    const centerCanvas = getCenterCanvas();
    const centerOffsetBefore = centerCanvas ? centerCanvas.getBoundingClientRect().top : 0;

    const scrollBefore = window.scrollY;
    const centerPage = [...canvasMap.entries()].find(([_, canvas]) => canvas === centerCanvas)?.[0];

    const pagesToRender = [...visiblePages];
    for (let pageNum of pagesToRender) {
    removePage(pageNum);
    }
    for (let pageNum of pagesToRender) {
    renderPage(pageNum);
    }

    setTimeout(() => {
    const centerOffsetAfter = centerCanvas ? centerCanvas.getBoundingClientRect().top : 0;
    const scrollDelta = centerOffsetAfter - centerOffsetBefore;
    const correction = isZoomOut ? scrollDelta * 0.5 : scrollDelta;
    window.scrollTo(0, scrollBefore + correction);
    }, 100);
}

function getCenterCanvas() {
    const centerY = window.scrollY + window.innerHeight / 2;
    let closest = null;
    let closestOffset = Infinity;

    visiblePages.forEach((pageNum) => {
    const canvas = canvasMap.get(pageNum);
    if (canvas) {
        const offset = Math.abs(canvas.offsetTop + canvas.height / 2 - centerY);
        if (offset < closestOffset) {
        closestOffset = offset;
        closest = canvas;
        }
    }
    });

    return closest;
}

function renderPage(pageNum) {
    if (canvasMap.has(pageNum)) return;
    pdfDoc.getPage(pageNum).then((page) => {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    page.render({ canvasContext: context, viewport: viewport });

    let inserted = false;
    for (let i = 0; i < visiblePages.length; i++) {
        if (pageNum < visiblePages[i]) {
        pdfContainer.insertBefore(canvas, canvasMap.get(visiblePages[i]));
        visiblePages.splice(i, 0, pageNum);
        inserted = true;
        break;
        }
    }
    if (!inserted) {
        pdfContainer.appendChild(canvas);
        visiblePages.push(pageNum);
    }

    canvasMap.set(pageNum, canvas);
    });
}

function removePage(pageNum) {
    const canvas = canvasMap.get(pageNum);
    if (canvas && canvas.parentNode) {
    canvas.parentNode.removeChild(canvas);
    }
    canvasMap.delete(pageNum);
    visiblePages = visiblePages.filter((num) => num !== pageNum);
}

function onScroll() {
    if (!pdfDoc) return;
    const scrollTop = window.scrollY;
    let closest = null;
    let closestOffset = Infinity;
    visiblePages.forEach((pageNum) => {
    const canvas = canvasMap.get(pageNum);
    if (canvas) {
        const offset = Math.abs(canvas.offsetTop - scrollTop);
        if (offset < closestOffset) {
        closestOffset = offset;
        closest = pageNum;
        }
    }
    });

    if (closest !== null) {
    currentPageDisplay.textContent = closest;

    const first = visiblePages[0];
    const last = visiblePages[visiblePages.length - 1];

    if (closest === last && last < pdfDoc.numPages) {
        renderPage(last + 1);
        if (visiblePages.length > NUM_PAGES_TO_KEEP) {
        removePage(first);
        }
    }

    if (closest === first && first > 1) {
        renderPage(first - 1);
        if (visiblePages.length > NUM_PAGES_TO_KEEP) {
        removePage(last);
        }
    }
    }
}

window.addEventListener("scroll", onScroll);

goButton.addEventListener("click", () => {
    const target = parseInt(pageInput.value);
    if (!target || target < 1 || target > pdfDoc.numPages) return;

    resetView();
    for (let i = target; i < target + NUM_PAGES_TO_KEEP && i <= pdfDoc.numPages; i++) {
    renderPage(i);
    }
    setTimeout(() => {
        const targetCanvas = canvasMap.get(target);
        if (targetCanvas) {
            targetCanvas.scrollIntoView();
        }
    }, 500);
});

// Trigger "Go" on Enter key in page input
pageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
    goButton.click();
    }
});

