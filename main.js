import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

import {
  createDetector,
  SupportedModels,
} from '@tensorflow-models/face-landmarks-detection';

const video = document.getElementById('video');
const SQUINTED_EYES_DURATION = 1000
const narrow_eyes = document.getElementById("narrow-eyes")
const NARROWEST_EYES = 5.2
let narrow_eyes_value = NARROWEST_EYES + parseInt(narrow_eyes.value)/10;
console.log(narrow_eyes_value)

let isPaused = false;

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

let eyeClosedStart = null;

function getDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isEyeClosed(eyeTop, eyeBottom) {
  const distance = getDistance(eyeTop, eyeBottom);
//   console.log(distance)
  return distance < narrow_eyes_value; // Tune this threshold based on your face & resolution
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

    const detect = async () => {
        const faces = await detector.estimateFaces(video);
        if (faces.length > 0 && !isPaused) {
            const keypoints = faces[0].keypoints;

            const leftEyeTop = keypoints[159];
            const leftEyeBottom = keypoints[145];
            const rightEyeTop = keypoints[386];
            const rightEyeBottom = keypoints[374];

            const leftClosed = isEyeClosed(leftEyeTop, leftEyeBottom);
            const rightClosed = isEyeClosed(rightEyeTop, rightEyeBottom);
            // console.log(leftClosed)

            if (leftClosed && rightClosed) {
                // alert("you blinked")
                if (!eyeClosedStart) eyeClosedStart = Date.now();
                const duration = Date.now() - eyeClosedStart;

                if (duration > SQUINTED_EYES_DURATION) {
                    
                    window.scrollBy({ top: 300, behavior: 'smooth' });

                    eyeClosedStart = null; // reset after alert
                }
            } else {
                eyeClosedStart = null; // reset if eyes open again
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

narrow_eyes.addEventListener("input", () => {
    narrow_eyes_value = NARROWEST_EYES + parseInt(narrow_eyes.value) / 10;
});