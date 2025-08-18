import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

import {
  createDetector,
  SupportedModels,
} from '@tensorflow-models/face-landmarks-detection';

const video = document.getElementById('video');
const sensitivity = document.getElementById("sensitivity")
let sensitivity_value = calculateSensitivity(sensitivity.value)
const scroll_amount = document.getElementById("scroll-amount")

let scroll_pixels = 300+parseInt(scroll_amount.value)*4;

let isPaused = false;
let DO_NOT_RENDER = false;

function calculateSensitivity(sensitivity)
{
    return (31-sensitivity)/2;
}

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

async function main() {
  await tf.setBackend('webgl');
  await setupCamera();
  video.play();

  const detectorConfig = {
    runtime: 'mediapipe',
    solutionPath: `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh`,
  };

  const detector = await createDetector(SupportedModels.MediaPipeFaceMesh, detectorConfig);

  let mouthOpenStart = null;
  let lastScrolled = 0;

  function getDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  const detect = async () => {
    const faces = await detector.estimateFaces(video);
    if (faces.length > 0 && !isPaused) {
      const keypoints = faces[0].keypoints;

      const upperLip = keypoints[13];
      const lowerLip = keypoints[14];

      const mouthOpen = getDistance(upperLip, lowerLip) > sensitivity_value; // tweak threshold if needed

      if (mouthOpen) {
        // if (!mouthOpenStart) mouthOpenStart = Date.now();
        // const duration = Date.now() - mouthOpenStart;
        let delay = Date.now() - lastScrolled;

        if (delay > 600) { // half second of open mouth
          lastScrolled = Date.now();
          // alert('Mouth opened!');
          let before_scrolling = window.scrollY;
          // if(window.scrollY)
          console.log("Right now at: " + before_scrolling)
          console.log("Gonna be at: " + (before_scrolling + scroll_pixels))
          DO_NOT_RENDER = true;
          window.scrollBy({ top: scroll_pixels, behavior: 'smooth' });
          setTimeout(() => {
            DO_NOT_RENDER = false;
            onScroll();
          }, estimateScrollDuration(scroll_pixels));

          mouthOpenStart = null; // reset
        }
      } else {
        mouthOpenStart = null; // reset if closed
      }
    }

    requestAnimationFrame(detect);
  };


  detect();
}

main();

document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !e.target.matches("input, textarea")) {
    e.preventDefault(); // Prevent page from scrolling
    isPaused = !isPaused // Trigger the same toggle logic
    }
});

sensitivity.addEventListener("input", () => {
    sensitivity_value = calculateSensitivity(sensitivity.value);
});

scroll_amount.addEventListener("input", () => {
    scroll_pixels = 300 + parseInt(scroll_amount.value) * 40;
});




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
            renderPage(2);
            renderPage(3);
            renderPage(4);
            renderPage(5);
            renderPage(6);
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
    visiblePages.push(pageNum);
    visiblePages.sort(function(a, b){return a - b});
    console.log(visiblePages)
    pdfDoc.getPage(pageNum).then((page) => {
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.id = pageNum
        canvas.className = "canvas"

        page.render({ canvasContext: context, viewport: viewport });

        canvasMap.set(pageNum, canvas);

        const div = document.createElement('div');
        div.appendChild(canvas)
        // div.innerHTML = div.innerHTML + '<p style="margin: 50%">'+ pageNum +'</p>'
        // console.log(div.innerHTML)

        // console.log(canvasMap.get(pageNum+1))
        if(pageNum == visiblePages[0] && canvasMap.get(pageNum+1)) pdfContainer.insertBefore(div, canvasMap.get(pageNum+1).parentNode);
        else pdfContainer.appendChild(div);

    });

    currentPageDisplay.innerText = visiblePages[visiblePages.length -1]
}

function removePage(pageNum) {
    const canvas = canvasMap.get(pageNum).parentNode;
    if (canvas && canvas.parentNode) {
    canvas.parentNode.removeChild(canvas);
    }
    canvasMap.delete(pageNum);
    visiblePages = visiblePages.filter((num) => num !== pageNum);
}

let scrollTimeout;
let lastRendered = 0;

function onScroll() {
  if(DO_NOT_RENDER) return;
  console.log("scrolling?");
  let body_height = document.body.offsetHeight;
  let scroll_y = window.scrollY;
  let scrolled_percentage = scroll_y / body_height * 100;

  let first = visiblePages[0];
  let last = visiblePages[visiblePages.length-1];

    if (scrolled_percentage < 25 && first > 1){// && Date.now() - lastRendered > 500) {
        renderPage(first - 1);
        if (visiblePages.length > NUM_PAGES_TO_KEEP) {
            removePage(last);
        }
        // lastRendered = Date.now();
    }
    // console.log(last)
    if (scrolled_percentage > 75 && last < pdfDoc.numPages){//  && Date.now() - lastRendered > 600) {
        // console.log(Date.now() - lastRendered)
        renderPage(last + 1);
        if (visiblePages.length > NUM_PAGES_TO_KEEP) {
            removePage(first);
        }
        lastRendered = Date.now();
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

function estimateScrollDuration(pixels) {
    //const baseSpeed = 0.8;
    //return Math.min(1000, Math.max(200, Math.abs(pixels) / baseSpeed));

    return 480; //500ms for universality
}