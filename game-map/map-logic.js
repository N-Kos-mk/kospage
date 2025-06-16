// SHA256ハッシュ生成関数
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 定数
const GRID_SIZE = 6.0;
const HUMIDITY_GRID_SIZE = 15.0;

let serverId = null;
const hashedValueCache = {};

async function getHashedFloat(x, y, salt) {
    const key = `${serverId}:${x}:${y}:${salt}`;
    if (hashedValueCache[key]) return hashedValueCache[key];
    const h = await sha256(key);
    const result = (parseInt(h.substring(0, 8), 16) / 0xFFFFFFFF);
    hashedValueCache[key] = result;
    return result;
}

function interpolate(a, b, t) {
    const ft = t * Math.PI;
    const f = (1 - Math.cos(ft)) * 0.5;
    return a * (1 - f) + b * f;
}

async function getNoiseValue(x, y, salt, customGridSize = null) {
    const gridSize = customGridSize !== null ? customGridSize : GRID_SIZE;
    const ix = Math.floor(x / gridSize);
    const iy = Math.floor(y / gridSize);
    const fx = (x / gridSize) - ix;
    const fy = (y / gridSize) - iy;
    const v1 = await getHashedFloat(ix, iy, salt);
    const v2 = await getHashedFloat(ix + 1, iy, salt);
    const v3 = await getHashedFloat(ix, iy + 1, salt);
    const v4 = await getHashedFloat(ix + 1, iy + 1, salt);
    const i1 = interpolate(v1, v2, fx);
    const i2 = interpolate(v3, v4, fx);
    return interpolate(i1, i2, fy);
}

export async function initialize(sid) {
    serverId = sid;
    for (const key in hashedValueCache) {
        delete hashedValueCache[key];
    }
}

export async function getBiome(x, y) {
    if (x === 0 && y === 0) {
        return "BASECAMP";
    }
    if (!serverId) throw new Error("Not initialized.");

    const elevation = (
        (await getNoiseValue(x, y, "elevation1")) * 0.7 +
        (await getNoiseValue(x * 2, y * 2, "elevation2")) * 0.2 +
        (await getNoiseValue(x * 4, y * 4, "elevation3")) * 0.1
    );
    const temp = (await getNoiseValue(x, y, "temp")) - (y / 1000.0) * 0.4;
    const humidity = await getNoiseValue(x, y, "humidity", HUMIDITY_GRID_SIZE);

    if (elevation > 0.8) {
        if (temp > 0.85) return "VOLCANO";
        if (temp < 0.3) return "SNOW_MOUNTAIN";
        return "MOUNTAIN";
    } else if (elevation > 0.7) {
        return "HILL";
    } else if (elevation > 0.3) {
        if (humidity > 0.7 && temp > 0.8) return "JUNGLE";
        if (humidity > 0.4) return "FOREST";
        return "PLAINS";
    } else {
        const river_noise_v = await getNoiseValue(x * 0.5, y * 4.0, "river_v");
        const river_noise_h = await getNoiseValue(x * 4.0, y * 0.5, "river_h");
        if ((river_noise_v > 0.48 && river_noise_v < 0.52) || (river_noise_h > 0.48 && river_noise_h < 0.52)) {
            return "RIVER";
        }
        if (temp > 0.7 && humidity < 0.3) return "DESERT";
        if (temp < 0.3) return "TUNDRA";
        if (humidity > 0.65) return "SWAMP";
        return "PLAINS";
    }
}