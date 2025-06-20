import { initialize, getBiome } from './map-logic.js';

// --- DOM要素取得 ---
const mapContainer = document.getElementById('mapContainer');
const hotspotOverlayContainer = document.getElementById('hotspotOverlayContainer');
const seedInput = document.getElementById('seedInput');
const rangeInput = document.getElementById('rangeInput');
const generateButton = document.getElementById('generateButton');
const mapWrapper = document.getElementById('map-wrapper');
const zoomInput = document.getElementById('zoomInput');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');

// --- 定数定義 ---
/*const COLOR_MAP = {
    "BASECAMP":      "#FF69B4",
    "SNOW_MOUNTAIN": "#FFFFFF",
    "MOUNTAIN":      "#8B4513",
    "HILL":          "#A0522D",
    "PLAINS":        "#228B22",
    "DESERT":        "#DAA520",
    "RIVER":         "deepskyblue",
    "FOREST":        "#006400",
    "SWAMP":         "#556B2F",
    "JUNGLE":        "#32CD32",
    "VOLCANO":       "#FF4500",
    "TUNDRA":        "#B0C4DE",
};*/
const COLOR_MAP = {
    "BASECAMP": "rgb(255, 0, 255)",
    "SNOW_MOUNTAIN": "rgb(255, 255, 255)",
    "MOUNTAIN": "rgb(139, 69, 19)",
    "HILL": "rgb(205, 133, 63)",
    "PLAINS": "rgb(154, 245, 64)",
    "DESERT": "rgb(245, 222, 179)",
    "RIVER": "rgb(65, 105, 225)",
    "FOREST": "rgb(46, 197, 46)",
    "SWAMP": "rgb(116, 160, 40)",
    "JUNGLE": "rgb(0, 100, 0)",
    "VOLCANO": "rgb(255, 0, 0)",
    "TUNDRA": "rgb(176, 196, 222)"
};
const DEFAULT_COLOR = "#333333";

// --- 状態管理 ---
let currentZoom = 100;

// --- 関数定義 ---

/**
 * 日本時間の月曜午前5時を基準とした、現在の週を代表する日付文字列(YYYY-MM-DD)を生成する
 */
function getWeeklyKey() {
    const now = new Date();
    const shiftedTime = new Date(now.getTime() + (4 * 60 * 60 * 1000));
    const dayOfWeek = shiftedTime.getUTCDay();
    const daysToSubtract = (dayOfWeek + 6) % 7;
    const lastMonday = new Date(shiftedTime.getTime());
    lastMonday.setUTCDate(lastMonday.getUTCDate() - daysToSubtract);
    const year = lastMonday.getUTCFullYear();
    const month = String(lastMonday.getUTCMonth() + 1).padStart(2, '0');
    const day = String(lastMonday.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 現在のズームレベルを map-wrapper に適用する
 */
function applyZoom() {
    if (currentZoom < 10) currentZoom = 10;
    if (currentZoom > 500) currentZoom = 500;
    zoomInput.value = currentZoom;
    mapWrapper.style.transform = `scale(${currentZoom / 100})`;
}

/**
 * ホットスポットのオーバーレイを描画する
 * @param {number} range - マップの表示範囲
 * @param {number} cellSize - マップセルの計算後サイズ
 */
function drawHotspotOverlay(range, cellSize) {
    const urlParams = new URLSearchParams(window.location.search);
    const hotspotsParam = urlParams.get('hotspots');
    if (!hotspotsParam) return;

    const hotspotCoords = hotspotsParam.split(';').filter(s => s).map(s => s.split(',').map(n => parseInt(n, 10)));
    const highlightMap = new Map();

    for (const [centerX, centerY] of hotspotCoords) {
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) === 2) {
                    highlightMap.set(`${centerX + dx},${centerY + dy}`, 'hotspot-ring2');
                }
            }
        }
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                highlightMap.set(`${centerX + dx},${centerY + dy}`, 'hotspot-ring1');
            }
        }
        highlightMap.set(`${centerX},${centerY}`, 'hotspot-center');
    }

    hotspotOverlayContainer.innerHTML = '';
    const gridSize = range * 2 + 1;
    hotspotOverlayContainer.style.gridTemplateColumns = `repeat(${gridSize}, ${cellSize}px)`;
    hotspotOverlayContainer.style.gridAutoRows = `${cellSize}px`;

    for (let y = range; y >= -range; y--) {
        for (let x = -range; x <= range; x++) {
            const key = `${x},${y}`;
            const cell = document.createElement('div');
            if (highlightMap.has(key)) {
                cell.className = `highlight-cell ${highlightMap.get(key)}`;
            }
            hotspotOverlayContainer.appendChild(cell);
        }
    }
}

/**
 * ページ読み込み時にURLからserver_idを読み取る
 */
function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const serverIdFromUrl = urlParams.get('server_id');
    if (serverIdFromUrl) {
        seedInput.value = serverIdFromUrl;
    }
}

/**
 * メインのマップ生成・描画関数
 */
async function generateMap() {
    const serverId = seedInput.value;
    const range = parseInt(rangeInput.value, 10);
    if (!serverId || isNaN(range) || range < 1) {
        alert("有効なサーバーIDと表示範囲を入力してください。");
        return;
    }

    mapContainer.innerHTML = 'マップを生成中...';
    hotspotOverlayContainer.innerHTML = '';

    const weeklyKey = getWeeklyKey();
    const finalSeed = `${serverId}:${weeklyKey}`;
    console.log(`Using final seed: ${finalSeed}`);
    await initialize(finalSeed);

    const promises = [];
    for (let y = range; y >= -range; y--) {
        for (let x = -range; x <= range; x++) {
            promises.push(getBiome(x, y));
        }
    }
    const biomes = await Promise.all(promises);
    
    mapContainer.innerHTML = '';
    const gridSize = range * 2 + 1;
    const availableWidth = window.innerWidth - 40;
    const dynamicCellSize = availableWidth / gridSize;
    const cellSize = Math.max(2, Math.min(15, dynamicCellSize)); 

    mapContainer.style.gridTemplateColumns = `repeat(${gridSize}, ${cellSize}px)`;
    mapContainer.style.fontSize = `${cellSize * 1.2}px`;
    mapContainer.style.lineHeight = `${cellSize}px`;

    let biomeIndex = 0;
    for (let y = range; y >= -range; y--) {
        for (let x = -range; x <= range; x++) {
            const biomeName = biomes[biomeIndex++];
            const cell = document.createElement('div');
            cell.textContent = '■';
            cell.style.color = COLOR_MAP[biomeName] || DEFAULT_COLOR;
            cell.title = `(${x}, ${y}): ${biomeName}`;
            mapContainer.appendChild(cell);
        }
    }
    drawHotspotOverlay(range, cellSize);
}

// --- イベントリスナー設定 ---
generateButton.addEventListener('click', generateMap);
zoomInBtn.addEventListener('click', () => {
    currentZoom += 10;
    applyZoom();
});
zoomOutBtn.addEventListener('click', () => {
    currentZoom -= 10;
    applyZoom();
});
zoomInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        const newValue = parseInt(zoomInput.value, 10);
        if (!isNaN(newValue)) {
            currentZoom = newValue;
            applyZoom();
        }
        zoomInput.blur();
    }
});
zoomInput.addEventListener('change', () => {
    const newValue = parseInt(zoomInput.value, 10);
    if (!isNaN(newValue)) {
        currentZoom = newValue;
        applyZoom();
    }
});

window.onload = () => {
    checkUrlParams();
    generateMap();
    applyZoom();
};
