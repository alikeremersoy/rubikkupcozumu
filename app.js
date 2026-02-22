import Cube from 'https://esm.sh/cubejs@1.3.2';

const facesConfig = [
    { id: 'U', name: 'Üst (U)' },
    { id: 'R', name: 'Sağ (R)' },
    { id: 'F', name: 'Ön (F)' },
    { id: 'D', name: 'Alt (D)' },
    { id: 'L', name: 'Sol (L)' },
    { id: 'B', name: 'Arka (B)' },
];

let facesData = {
    U: { colors: [] },
    R: { colors: [] },
    F: { colors: [] },
    D: { colors: [] },
    L: { colors: [] },
    B: { colors: [] }
};

let activeFace = null;

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    try {
        Cube.initSolver();
        console.log("Solver initialized successfully.");
    } catch (err) {
        console.warn("Solver initialization error:", err);
    }
});

let currentCameraFace = null;
let videoStream = null;

// Cube 3D Dragging
let cubeElement;
let isDragging = false;
let startX, startY;
let currentX = -30, currentY = -20;

function initUI() {
    cubeElement = document.getElementById('rubiks-cube');

    // Add 9 cells to each color grid
    document.querySelectorAll('.color-grid').forEach(grid => {
        grid.innerHTML = Array(9).fill('<div></div>').join('');
    });

    // Face Click Handler
    document.querySelectorAll('.cube-face').forEach(face => {
        face.addEventListener('click', (e) => {
            selectFace(face.dataset.face);
        });
    });

    // Setup action buttons
    document.getElementById('input-file').addEventListener('change', handleImageUpload);
    document.getElementById('btn-camera').addEventListener('click', () => openCamera());
    document.getElementById('btn-manual').addEventListener('click', () => openManualPicker());

    document.getElementById('close-camera-btn').addEventListener('click', closeCamera);
    document.getElementById('capture-btn').addEventListener('click', captureFrame);

    document.getElementById('close-manual-btn').addEventListener('click', closeManualPicker);
    document.getElementById('save-manual-btn').addEventListener('click', saveManualColors);

    // Global Actions
    document.getElementById('analyze-btn').addEventListener('click', analyzeAndSolve);
    document.getElementById('reset-btn').addEventListener('click', resetAll);

    // Manual picker dots setup
    setupManualPickerUI();

    // Dragging setup
    setupDragging();

    // Select the Front face by default
    selectFace('F');
}

function selectFace(faceId) {
    activeFace = faceId;

    document.querySelectorAll('.cube-face').forEach(f => f.classList.remove('selected'));
    document.querySelector(`.cube-face[data-face="${faceId}"]`).classList.add('selected');

    // Update Action Panel
    const actionPanel = document.getElementById('action-panel');
    const faceObj = facesConfig.find(f => f.id === faceId);
    document.getElementById('selected-face-title').textContent = `${faceObj.name} Yüzeyi Seçildi`;
    actionPanel.classList.remove('hidden');

    // Smooth Rotate Cube to Face
    const rotations = {
        'U': { x: -90, y: 0 },
        'D': { x: 90, y: 0 },
        'R': { x: 0, y: -90 },
        'L': { x: 0, y: 90 },
        'F': { x: 0, y: 0 },
        'B': { x: 0, y: 180 }
    };

    animatedRotation(rotations[faceId].x, rotations[faceId].y);
}

function animatedRotation(rotX, rotY) {
    currentX = rotY;
    currentY = rotX;
    cubeElement.style.transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
    cubeElement.style.transform = `rotateX(${currentY}deg) rotateY(${currentX}deg)`;
}

function updateRotation() {
    cubeElement.style.transition = 'none'; // Instant drag
    cubeElement.style.transform = `rotateX(${currentY}deg) rotateY(${currentX}deg)`;
}

function setupDragging() {
    const scene = document.querySelector('.scene');

    scene.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        currentX += deltaX * 0.5;
        currentY -= deltaY * 0.5;

        updateRotation();

        startX = e.clientX;
        startY = e.clientY;
    });

    document.addEventListener('mouseup', () => { isDragging = false; });

    // Touch
    scene.addEventListener('touchstart', (e) => {
        isDragging = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const deltaX = e.touches[0].clientX - startX;
        const deltaY = e.touches[0].clientY - startY;

        currentX += deltaX * 0.5;
        currentY -= deltaY * 0.5;

        updateRotation();

        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    });

    document.addEventListener('touchend', () => { isDragging = false; });
}

function handleImageUpload(e) {
    if (!activeFace) return;
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.getElementById(`canvas-${activeFace}`);
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            // Draw scaled image to canvas mapping
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // We want to fill the canvas 240x240
            const size = Math.min(img.width, img.height);
            const startX = (img.width - size) / 2;
            const startY = (img.height - size) / 2;

            ctx.drawImage(img, startX, startY, size, size, 0, 0, canvas.width, canvas.height);

            extractColors(activeFace, ctx, canvas.width, canvas.height);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);

    // Clear input
    e.target.value = '';
}

function extractColors(faceId, ctx, width, height) {
    const grid = document.getElementById(`grid-${faceId}`);
    const cells = grid.querySelectorAll('div');

    // Sample points: 16%, 50%, 84% to get grid centers
    const pX = [width * 0.16, width * 0.50, width * 0.84];
    const pY = [height * 0.16, height * 0.50, height * 0.84];

    facesData[faceId].colors = [];

    let cellIndex = 0;
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            // sample a 10x10 area
            const imgData = ctx.getImageData(pX[x] - 5, pY[y] - 5, 10, 10);
            let r = 0, g = 0, b = 0;
            for (let i = 0; i < imgData.data.length; i += 4) {
                r += imgData.data[i];
                g += imgData.data[i + 1];
                b += imgData.data[i + 2];
            }
            const count = imgData.data.length / 4;
            r = Math.round(r / count);
            g = Math.round(g / count);
            b = Math.round(b / count);

            facesData[faceId].colors.push({ r, g, b });
            cells[cellIndex].style.backgroundColor = `rgb(${r},${g},${b})`;
            cellIndex++;
        }
    }
}

// Camera Setup
async function openCamera() {
    if (!activeFace) return;
    currentCameraFace = activeFace;
    const modal = document.getElementById('camera-modal');
    const video = document.getElementById('camera-video');
    modal.classList.remove('hidden');

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = videoStream;

        // Handle webcam mirroring effect on desktop
        setTimeout(() => {
            const track = videoStream.getVideoTracks()[0];
            const settings = track.getSettings();
            const facingMode = settings.facingMode;
            if (facingMode === 'user' || typeof facingMode === 'undefined') {
                video.style.transform = 'scaleX(-1)';
                video.dataset.mirrored = 'true';
            } else {
                video.style.transform = 'none';
                video.dataset.mirrored = 'false';
            }
        }, 500);

    } catch (err) {
        showError("Kamera erişimi sağlanamadı: " + err.message);
        closeCamera();
    }
}

function closeCamera() {
    document.getElementById('camera-modal').classList.add('hidden');
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
}

function captureFrame() {
    if (!currentCameraFace || !videoStream) return;

    const video = document.getElementById('camera-video');
    const canvas = document.getElementById(`canvas-${currentCameraFace}`);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const size = Math.min(video.videoWidth, video.videoHeight);
    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Un-mirror canvas context if video was physically mirrored locally
    if (video.dataset.mirrored === 'true') {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
        ctx.drawImage(video, startX, startY, size, size, 0, 0, canvas.width, canvas.height);
        ctx.restore();
    } else {
        ctx.drawImage(video, startX, startY, size, size, 0, 0, canvas.width, canvas.height);
    }

    extractColors(currentCameraFace, ctx, canvas.width, canvas.height);
    closeCamera();
}

// Manual Picker Setup
let currentManualColor = "255,255,255";

function setupManualPickerUI() {
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', (e) => {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
            e.target.classList.add('selected');
            currentManualColor = e.target.dataset.color;
        });
    });

    document.querySelectorAll('.manual-cell').forEach(cell => {
        cell.addEventListener('click', (e) => {
            e.target.style.backgroundColor = `rgb(${currentManualColor})`;
            e.target.dataset.rgb = currentManualColor;
        });
    });
}

function openManualPicker() {
    if (!activeFace) return;
    currentCameraFace = activeFace;

    const faceObj = facesConfig.find(f => f.id === activeFace);
    document.getElementById('manual-face-name').textContent = faceObj.name;
    document.getElementById('manual-color-modal').classList.remove('hidden');

    document.querySelectorAll('.manual-cell').forEach(cell => {
        cell.style.backgroundColor = '#333';
        cell.dataset.rgb = '';
    });
}

function closeManualPicker() {
    document.getElementById('manual-color-modal').classList.add('hidden');
}

function saveManualColors() {
    const cells = document.querySelectorAll('.manual-cell');

    for (let c of cells) {
        if (!c.dataset.rgb) {
            alert('Tüm 9 kareyi de boyamalısın (Merkez ve kenarlar)!');
            return;
        }
    }

    facesData[currentCameraFace].colors = [];
    const mainCells = document.getElementById(`grid-${currentCameraFace}`).querySelectorAll('div');

    // clear canvas so manual colors show
    const canvas = document.getElementById(`canvas-${currentCameraFace}`);
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

    cells.forEach((cell, i) => {
        const [r, g, b] = cell.dataset.rgb.split(',').map(Number);
        facesData[currentCameraFace].colors.push({ r, g, b });
        mainCells[i].style.backgroundColor = `rgb(${r},${g},${b})`;
    });

    closeManualPicker();
}

// Solver Setup
function colorDistance(c1, c2) {
    const rMean = (c1.r + c2.r) / 2;
    const r = c1.r - c2.r;
    const g = c1.g - c2.g;
    const b = c1.b - c2.b;
    return Math.sqrt((((512 + rMean) * r * r) >> 8) + 4 * g * g + (((767 - rMean) * b * b) >> 8));
}

function showError(msg) {
    const errDiv = document.getElementById('error-message');
    errDiv.textContent = msg;
    errDiv.classList.remove('hidden');
}

function analyzeAndSolve() {
    const errDiv = document.getElementById('error-message');
    errDiv.classList.add('hidden');

    for (const f of facesConfig) {
        if (facesData[f.id].colors.length !== 9) {
            showError(`Lütfen ${f.name} yüzeyinin fotoğrafını veya renklerini yükleyin.`);
            selectFace(f.id); // auto switch to failing face
            return;
        }
    }

    const centers = {};
    for (const f of facesConfig) {
        centers[f.id] = facesData[f.id].colors[4];
    }

    let cubeString = "";

    for (const f of facesConfig) {
        for (let i = 0; i < 9; i++) {
            const tileColor = facesData[f.id].colors[i];

            let closestFace = 'U';
            let minDistance = Infinity;

            for (const [faceId, centerColor] of Object.entries(centers)) {
                const dist = colorDistance(tileColor, centerColor);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestFace = faceId;
                }
            }
            cubeString += closestFace;
        }
    }

    console.log("Extracted Cube String:", cubeString);

    try {
        if (!Cube.fromString) throw new Error("Cubejs kütüphanesi yüklenemedi.");

        const cubeInstance = Cube.fromString(cubeString);
        const solutionMoves = cubeInstance.solve();

        const resSection = document.getElementById('result-section');
        const movesContainer = document.getElementById('solution-moves');

        const moveDict = {
            "R": "Sağ Taraf Yukarı ⬆️", "R'": "Sağ Taraf Aşağı ⬇️", "R2": "Sağ Taraf 2 Kere",
            "L": "Sol Taraf Aşağı ⬇️", "L'": "Sol Taraf Yukarı ⬆️", "L2": "Sol Taraf 2 Kere",
            "U": "Üst Taraf Sola ⬅️", "U'": "Üst Taraf Sağa ➡️", "U2": "Üst Taraf 2 Kere",
            "D": "Alt Taraf Sağa ➡️", "D'": "Alt Taraf Sola ⬅️", "D2": "Alt Taraf 2 Kere",
            "F": "Ön Yüz Sağa ↻", "F'": "Ön Yüz Sola ↺", "F2": "Ön Yüz 2 Kere",
            "B": "Arka Yüz Sola ↺", "B'": "Arka Yüz Sağa ↻", "B2": "Arka Yüz 2 Kere"
        };

        resSection.classList.remove('hidden');

        if (!solutionMoves || solutionMoves.trim() === "") {
            movesContainer.innerHTML = `<div style="text-align:center; padding:2rem; width:100%;">
                <div style="font-size:4rem; margin-bottom:1rem;">🎉</div>
                <h3 style="color:#22c55e;">Bu Küp Zaten Çözülü!</h3>
                <p style="color:#cbd5e1; margin-top:0.5rem;">Herhangi bir hamle yapmana gerek yok knk.</p>
            </div>`;
        } else {
            movesContainer.innerHTML = solutionMoves.trim().split(' ').map((move, index) => {
                const tr = moveDict[move] || move;
                return `<div style="display:inline-block; margin: 0.5rem; text-align:center; padding:1.2rem; background:rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius:12px; min-width:130px; position:relative;">
                    <div style="position:absolute; top:6px; left:10px; font-size:0.75rem; color:var(--primary); font-weight:bold;">Adım ${index + 1}</div>
                    <div style="font-size:2.2rem; font-weight:bold; margin-top:12px;">${move}</div>
                    <div style="font-size:0.85rem; color:#e2e8f0; margin-top:8px; line-height:1.2;">${tr}</div>
                </div>`;
            }).join('');
        }

        resSection.scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
        console.error("Solver error:", err);
        if (err.message && err.message.includes("Invalid cube string")) {
            showError("Geçersiz küp dizilimi! Renkler doğru algılanamadı.");
        } else {
            showError("Çözüm bulunamadı veya küp çözülemez bir durumda. " + err.message);
        }
    }
}

function resetAll() {
    facesData = {
        U: { colors: [] }, R: { colors: [] }, F: { colors: [] },
        D: { colors: [] }, L: { colors: [] }, B: { colors: [] }
    };

    document.querySelectorAll('.face-canvas').forEach(c => {
        c.getContext('2d').clearRect(0, 0, c.width, c.height);
    });

    document.querySelectorAll('.color-grid').forEach(grid => {
        grid.innerHTML = Array(9).fill('<div></div>').join('');
    });

    document.getElementById('result-section').classList.add('hidden');
    document.getElementById('error-message').classList.add('hidden');

    selectFace('F');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
