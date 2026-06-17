// static/main.js

import * as THREE from "https://esm.sh/three@0.164.1";
import { OrbitControls } from "https://esm.sh/three@0.164.1/examples/jsm/controls/OrbitControls.js";

const G = 0.9;
const DT = 0.08;
const PREDICT_DT = 0.10;
const DURATION = 900;
const SOFTENING = 8;
const MAX_POINTS = 2500;
const TIME_FLOW = 20;
const ORBIT_DISTANCE_SCALE = 1.75;
const WORLD_LIMIT = 5200;

const ACTUAL_RENDER_INTERVAL = 0.04;
const CHART_RENDER_INTERVAL = 0.18;
const INFO_RENDER_INTERVAL = 0.12;

const viewport = document.getElementById("viewport");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x02030a, 0.00012);

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    12000
);

camera.position.set(1500, 1300, 1500);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setClearColor(0x000000, 1);
renderer.domElement.style.display = "block";
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 80;
controls.maxDistance = 7000;
controls.update();

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const clock = new THREE.Clock();

const ui = {
    angle: document.getElementById("angle"),
    verticalAngle: document.getElementById("vertical-angle"),
    speed: document.getElementById("speed"),
    startTime: document.getElementById("start-time"),
    systemMode: document.getElementById("system-mode"),
    dateInput: document.getElementById("date-input"),
    angleValue: document.getElementById("angle-value"),
    verticalAngleValue: document.getElementById("vertical-angle-value"),
    speedValue: document.getElementById("speed-value"),
    timeValue: document.getElementById("time-value"),
    selectedPlanet: document.getElementById("selected-planet"),
    massScale: document.getElementById("mass-scale"),
    radiusScale: document.getElementById("radius-scale"),
    massValue: document.getElementById("mass-value"),
    radiusValue: document.getElementById("radius-value"),
    savePlanet: document.getElementById("save-planet"),
    resetPlanets: document.getElementById("reset-planets"),
    launch: document.getElementById("launch"),
    play: document.getElementById("play"),
    pause: document.getElementById("pause"),
    resetFlight: document.getElementById("reset-flight"),
    info: document.getElementById("info"),
    chart: document.getElementById("speed-chart"),
    chartModal: document.getElementById("chart-modal"),
    closeChart: document.getElementById("close-chart"),
    bigChart: document.getElementById("big-speed-chart"),
    speed05x: document.getElementById("speed-05x"),
    speed1x: document.getElementById("speed-1x"),
    speed2x: document.getElementById("speed-2x"),
    speed5x: document.getElementById("speed-5x"),
    cameraLock: document.getElementById("camera-lock"),
    back1: document.getElementById("back-1"),
    back5: document.getElementById("back-5"),
    leftPanel: document.getElementById("left-panel"),
    rightPanel: document.getElementById("right-panel"),
    toggleLeft: document.getElementById("toggle-left"),
    toggleRight: document.getElementById("toggle-right")
};

//행성의 속성과 공전 운동을 관리하는 클래스
class Planet {
    constructor(data) {
        this.name = data.name;
        this.baseMass = data.mass;
        this.baseRadius = data.radius;
        this.baseInfluenceRadius = data.influenceRadius;
        this.orbitRadius = data.orbitRadius * ORBIT_DISTANCE_SCALE;
        this.angularSpeed = data.angularSpeed;
        this.initialAngle = data.initialAngle;
        this.inclination = (data.inclination ?? 0) * Math.PI / 180;
        this.ascendingNode = (data.ascendingNode ?? 0) * Math.PI / 180;
        this.color = data.color;
        this.massScale = 1;
        this.radiusScale = 1;
        this.mesh = null;
        this.influenceMesh = null;
        this.orbitMesh = null;
        this.atmosphereMesh = null;
        this.ringMesh = null;
    }

    get mass() {
        return this.baseMass * this.massScale;
    }

    get radius() {
        return this.baseRadius * this.radiusScale;
    }

    get influenceRadius() {
        return this.baseInfluenceRadius * Math.sqrt(this.massScale);
    }

    get visualRadius() {
        if (this.name === "Sun") return 32;
        if (this.name === "Jupiter") return 18;
        if (this.name === "Saturn") return 15;
        if (this.name === "Uranus") return 13;
        if (this.name === "Neptune") return 13;
        if (this.name === "Earth") return 12;
        if (this.name === "Venus") return 11;
        if (this.name === "Mars") return 10;
        return 8;
    }

    get visualScaledRadius() {
        return this.visualRadius * this.radiusScale;
    }

    orbitTransformVector(vector) {
        const qNode = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            this.ascendingNode
        );

        const nodeAxis = new THREE.Vector3(
            Math.cos(this.ascendingNode),
            0,
            -Math.sin(this.ascendingNode)
        ).normalize();

        const qInclination = new THREE.Quaternion().setFromAxisAngle(
            nodeAxis,
            this.inclination
        );

        return vector.clone().applyQuaternion(qInclination).applyQuaternion(qNode);
    }

    positionAt(t) {
        if (this.orbitRadius === 0) {
            return new THREE.Vector3(0, 0, 0);
        }

        const angle = this.angularSpeed * t + this.initialAngle;

        const flatPosition = new THREE.Vector3(
            this.orbitRadius * Math.cos(angle),
            0,
            this.orbitRadius * Math.sin(angle)
        );

        return this.orbitTransformVector(flatPosition);
    }

    reset() {
        this.massScale = 1;
        this.radiusScale = 1;
    }
}

const customPlanetData = [
    { name: "Sun", mass: 12000, radius: 28, orbitRadius: 0, angularSpeed: 0, initialAngle: 0, inclination: 0, ascendingNode: 0, influenceRadius: 135, color: 0xffcc33 },
    { name: "Mercury", mass: 90, radius: 5, orbitRadius: 80, angularSpeed: 0.045, initialAngle: 0.4, inclination: 7.0, ascendingNode: 48.3, influenceRadius: 24, color: 0x999999 },
    { name: "Venus", mass: 210, radius: 8, orbitRadius: 125, angularSpeed: 0.032, initialAngle: 1.1, inclination: 3.4, ascendingNode: 76.7, influenceRadius: 38, color: 0xffa64d },
    { name: "Earth", mass: 280, radius: 9, orbitRadius: 180, angularSpeed: 0.024, initialAngle: 2.0, inclination: 0.0, ascendingNode: 0.0, influenceRadius: 52, color: 0x3a7bff },
    { name: "Mars", mass: 170, radius: 7, orbitRadius: 250, angularSpeed: 0.018, initialAngle: 2.8, inclination: 1.85, ascendingNode: 49.6, influenceRadius: 45, color: 0xff5533 },
    { name: "Ceres", mass: 75, radius: 5, orbitRadius: 315, angularSpeed: 0.014, initialAngle: 3.3, inclination: 10.6, ascendingNode: 80.3, influenceRadius: 28, color: 0xb0a090 },
    { name: "Jupiter", mass: 1300, radius: 20, orbitRadius: 420, angularSpeed: 0.010, initialAngle: 4.0, inclination: 1.3, ascendingNode: 100.5, influenceRadius: 112, color: 0xd6a36a },
    { name: "Saturn", mass: 950, radius: 17, orbitRadius: 560, angularSpeed: 0.007, initialAngle: 5.0, inclination: 2.49, ascendingNode: 113.7, influenceRadius: 102, color: 0xe6d28a },
    { name: "Uranus", mass: 620, radius: 14, orbitRadius: 710, angularSpeed: 0.005, initialAngle: 5.7, inclination: 0.77, ascendingNode: 74.0, influenceRadius: 88, color: 0x7fd4d9 },
    { name: "Neptune", mass: 660, radius: 14, orbitRadius: 850, angularSpeed: 0.004, initialAngle: 0.9, inclination: 1.77, ascendingNode: 131.8, influenceRadius: 90, color: 0x4169e1 },
    { name: "Pluto", mass: 45, radius: 4, orbitRadius: 980, angularSpeed: 0.003, initialAngle: 1.7, inclination: 17.2, ascendingNode: 110.3, influenceRadius: 24, color: 0xc9b18a }
];

const realScaledPlanetData = [
    { name: "Sun", mass: 333000 * 280 * 0.015, radius: 28, orbitRadius: 0, angularSpeed: 0, initialAngle: 0, inclination: 0, ascendingNode: 0, influenceRadius: 160, color: 0xffcc33, periodDays: 0, phaseAtEpoch: 0 },
    { name: "Mercury", mass: 0.055 * 280, radius: 5, orbitRadius: 70, angularSpeed: 0, initialAngle: 0, inclination: 7.00, ascendingNode: 48.33, influenceRadius: 20, color: 0x999999, periodDays: 87.969, phaseAtEpoch: 4.40 },
    { name: "Venus", mass: 0.815 * 280, radius: 8, orbitRadius: 130, angularSpeed: 0, initialAngle: 0, inclination: 3.39, ascendingNode: 76.68, influenceRadius: 36, color: 0xffa64d, periodDays: 224.701, phaseAtEpoch: 3.18 },
    { name: "Earth", mass: 280, radius: 9, orbitRadius: 180, angularSpeed: 0, initialAngle: 0, inclination: 0.00, ascendingNode: 0.00, influenceRadius: 52, color: 0x3a7bff, periodDays: 365.256, phaseAtEpoch: 1.75 },
    { name: "Mars", mass: 0.107 * 280, radius: 7, orbitRadius: 275, angularSpeed: 0, initialAngle: 0, inclination: 1.85, ascendingNode: 49.56, influenceRadius: 42, color: 0xff5533, periodDays: 686.980, phaseAtEpoch: 6.20 },
    { name: "Ceres", mass: 0.03 * 280, radius: 5, orbitRadius: 385, angularSpeed: 0, initialAngle: 0, inclination: 10.59, ascendingNode: 80.31, influenceRadius: 24, color: 0xb0a090, periodDays: 1680.0, phaseAtEpoch: 2.20 },
    { name: "Jupiter", mass: 317.8 * 280, radius: 20, orbitRadius: 560, angularSpeed: 0, initialAngle: 0, inclination: 1.30, ascendingNode: 100.46, influenceRadius: 130, color: 0xd6a36a, periodDays: 4332.59, phaseAtEpoch: 0.60 },
    { name: "Saturn", mass: 95.2 * 280, radius: 17, orbitRadius: 760, angularSpeed: 0, initialAngle: 0, inclination: 2.49, ascendingNode: 113.67, influenceRadius: 115, color: 0xe6d28a, periodDays: 10759.22, phaseAtEpoch: 5.80 },
    { name: "Uranus", mass: 14.5 * 280, radius: 14, orbitRadius: 970, angularSpeed: 0, initialAngle: 0, inclination: 0.77, ascendingNode: 74.01, influenceRadius: 95, color: 0x7fd4d9, periodDays: 30688.5, phaseAtEpoch: 1.10 },
    { name: "Neptune", mass: 17.1 * 280, radius: 14, orbitRadius: 1180, angularSpeed: 0, initialAngle: 0, inclination: 1.77, ascendingNode: 131.78, influenceRadius: 98, color: 0x4169e1, periodDays: 60182.0, phaseAtEpoch: 5.35 }
];

let planets = [];
let selectedPlanet = null;

let predictedLine = null;
let predictedStartMarker = null;
let predictedEndMarker = null;

let actualLine = null;
let actualMarker = null;
let hoverRing = null;

let predictedResult = null;
let actualState = null;

let simTime = Number(ui.startTime.value);
let running = false;
let playScale = 1;
let accumulator = 0;
let lastChartSpeeds = [];
let lastChartLabel = "speed";

let actualRenderTimer = 0;
let chartRenderTimer = 0;
let infoRenderTimer = 0;

let cameraLocked = false;
let cameraLockOffset = new THREE.Vector3(240, 220, 240);

const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);

const sunLight = new THREE.PointLight(0xffffff, 3.5, 5000);
sunLight.position.set(0, 300, 0);
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0x9bbcff, 0.45);
fillLight.position.set(-900, 600, 900);
scene.add(fillLight);

const helperGrid = new THREE.GridHelper(WORLD_LIMIT, 80, 0x1d3557, 0x0b1a2d);
helperGrid.material.transparent = true;
helperGrid.material.opacity = 0.18;
scene.add(helperGrid);

function cloneData(data) {
    return data.map((item) => ({ ...item }));
}

function daysFromJ2000(dateString) {
    const selected = new Date(`${dateString}T12:00:00Z`);
    const j2000 = new Date("2000-01-01T12:00:00Z");
    return (selected - j2000) / (1000 * 60 * 60 * 24);
}

function makePlanetDataByMode() {
    if (ui.systemMode.value === "custom") {
        return cloneData(customPlanetData);
    }

    const days = daysFromJ2000(ui.dateInput.value);
    const data = cloneData(realScaledPlanetData);

    for (const planet of data) {
        if (planet.orbitRadius === 0) {
            planet.angularSpeed = 0;
            planet.initialAngle = 0;
            continue;
        }

        const anglePerDay = (2 * Math.PI) / planet.periodDays;
        planet.angularSpeed = anglePerDay * TIME_FLOW;
        planet.initialAngle = planet.phaseAtEpoch + anglePerDay * days;
    }

    return data;
}

function makeCircle(radius, color, opacity, y = 0, segments = 240, rotationSourcePlanet = null) {
    const points = [];

    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const point = new THREE.Vector3(
            radius * Math.cos(angle),
            y,
            radius * Math.sin(angle)
        );

        if (rotationSourcePlanet) {
            points.push(rotationSourcePlanet.orbitTransformVector(point));
        } else {
            points.push(point);
        }
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity
    });

    return new THREE.Line(geometry, material);
}

function colorToRgb(hex) {
    return {
        r: (hex >> 16) & 255,
        g: (hex >> 8) & 255,
        b: hex & 255
    };
}

function hashString(text) {
    let hash = 0;

    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }

    return Math.abs(hash);
}

function seededNoise(seed, x, y) {
    const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
    return value - Math.floor(value);
}

function makePlanetTexture(planet) {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    const base = colorToRgb(planet.color);
    const seed = hashString(planet.name);

    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, `rgb(${Math.min(base.r + 45, 255)}, ${Math.min(base.g + 45, 255)}, ${Math.min(base.b + 45, 255)})`);
    gradient.addColorStop(0.55, `rgb(${base.r}, ${base.g}, ${base.b})`);
    gradient.addColorStop(1, `rgb(${Math.max(base.r - 55, 0)}, ${Math.max(base.g - 55, 0)}, ${Math.max(base.b - 55, 0)})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    if (planet.name === "Sun") {
        for (let i = 0; i < 1800; i++) {
            const x = seededNoise(seed, i, 1) * size;
            const y = seededNoise(seed, i, 2) * size;
            const r = 2 + seededNoise(seed, i, 3) * 7;
            const alpha = 0.08 + seededNoise(seed, i, 4) * 0.18;

            ctx.beginPath();
            ctx.fillStyle = `rgba(255, ${150 + seededNoise(seed, i, 5) * 90}, 40, ${alpha})`;
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        for (let y = 0; y < size; y += 18) {
            ctx.strokeStyle = "rgba(255, 240, 120, 0.12)";
            ctx.lineWidth = 2;
            ctx.beginPath();

            for (let x = 0; x <= size; x += 8) {
                const wave = Math.sin(x * 0.025 + y * 0.04) * 8;
                if (x === 0) ctx.moveTo(x, y + wave);
                else ctx.lineTo(x, y + wave);
            }

            ctx.stroke();
        }
    } else if (planet.name === "Earth") {
        ctx.fillStyle = "rgba(35, 115, 240, 0.98)";
        ctx.fillRect(0, 0, size, size);

        ctx.fillStyle = "rgba(45, 175, 95, 0.90)";
        for (let i = 0; i < 36; i++) {
            const cx = seededNoise(seed, i, 1) * size;
            const cy = seededNoise(seed, i, 2) * size;
            const rx = 24 + seededNoise(seed, i, 3) * 62;
            const ry = 12 + seededNoise(seed, i, 4) * 34;

            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, seededNoise(seed, i, 5) * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.strokeStyle = "rgba(255, 255, 255, 0.30)";
        ctx.lineWidth = 3;
        for (let i = 0; i < 22; i++) {
            const y = seededNoise(seed, i, 7) * size;
            ctx.beginPath();

            for (let x = 0; x <= size; x += 12) {
                const wave = Math.sin(x * 0.025 + i) * 12;
                if (x === 0) ctx.moveTo(x, y + wave);
                else ctx.lineTo(x, y + wave);
            }

            ctx.stroke();
        }
    } else if (planet.name === "Jupiter" || planet.name === "Saturn") {
        for (let y = 0; y < size; y++) {
            const band = Math.sin(y * 0.045 + seed) * 0.5 + 0.5;
            const noise = seededNoise(seed, 1, y) * 0.25;
            const factor = 0.72 + band * 0.38 + noise;

            ctx.strokeStyle = `rgb(${Math.min(base.r * factor, 255)}, ${Math.min(base.g * factor, 255)}, ${Math.min(base.b * factor, 255)})`;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size, y);
            ctx.stroke();
        }

        if (planet.name === "Jupiter") {
            ctx.fillStyle = "rgba(170, 55, 40, 0.58)";
            ctx.beginPath();
            ctx.ellipse(size * 0.64, size * 0.56, 42, 23, -0.2, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (planet.name === "Mars") {
        for (let i = 0; i < 950; i++) {
            const x = seededNoise(seed, i, 1) * size;
            const y = seededNoise(seed, i, 2) * size;
            const r = 1 + seededNoise(seed, i, 3) * 5;
            const alpha = 0.06 + seededNoise(seed, i, 4) * 0.14;

            ctx.beginPath();
            ctx.fillStyle = `rgba(70, 25, 12, ${alpha})`;
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = "rgba(255, 230, 190, 0.42)";
        ctx.beginPath();
        ctx.ellipse(size * 0.5, size * 0.08, 95, 22, 0, 0, Math.PI * 2);
        ctx.fill();
    } else {
        for (let i = 0; i < 1100; i++) {
            const x = seededNoise(seed, i, 1) * size;
            const y = seededNoise(seed, i, 2) * size;
            const r = 0.8 + seededNoise(seed, i, 3) * 3.8;
            const light = seededNoise(seed, i, 4) > 0.5 ? 1 : -1;
            const alpha = 0.045 + seededNoise(seed, i, 5) * 0.09;

            ctx.beginPath();
            ctx.fillStyle = light > 0
                ? `rgba(255, 255, 255, ${alpha})`
                : `rgba(0, 0, 0, ${alpha})`;
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.needsUpdate = true;

    return texture;
}

function makePlanetMaterial(planet) {
    const texture = makePlanetTexture(planet);

    if (planet.name === "Sun") {
        return new THREE.MeshStandardMaterial({
            map: texture,
            emissiveMap: texture,
            emissive: 0xffaa22,
            emissiveIntensity: 1.8,
            roughness: 0.9,
            metalness: 0.0
        });
    }

    return new THREE.MeshStandardMaterial({
        map: texture,
        roughness: planet.name === "Earth" ? 0.58 : 0.78,
        metalness: 0.02,
        emissive: planet.color,
        emissiveIntensity: 0.035
    });
}

function makeAtmosphereMesh(planet) {
    if (planet.name === "Sun") return null;

    const geometry = new THREE.SphereGeometry(planet.visualScaledRadius * 1.08, 32, 32);
    const material = new THREE.MeshBasicMaterial({
        color: planet.name === "Earth" ? 0x66ccff : planet.color,
        transparent: true,
        opacity: planet.name === "Earth" ? 0.22 : 0.10,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
    });

    return new THREE.Mesh(geometry, material);
}

function makePlanetRingMesh(planet) {
    if (planet.name !== "Saturn" && planet.name !== "Uranus") return null;

    const inner = planet.visualScaledRadius * 1.35;
    const outer = planet.visualScaledRadius * (planet.name === "Saturn" ? 2.25 : 1.85);

    const geometry = new THREE.RingGeometry(inner, outer, 96);
    const material = new THREE.MeshBasicMaterial({
        color: planet.name === "Saturn" ? 0xd8c381 : 0x9bdfe8,
        transparent: true,
        opacity: planet.name === "Saturn" ? 0.48 : 0.32,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = Math.PI / 2.25;
    ring.rotation.z = planet.name === "Uranus" ? Math.PI / 2.1 : Math.PI / 9;

    return ring;
}

function disposeObjectDeep(object) {
    if (!object) return;

    object.traverse((child) => {
        if (child.geometry) child.geometry.dispose();

        if (child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];

            for (const material of materials) {
                if (material.map) material.map.dispose();
                if (material.emissiveMap) material.emissiveMap.dispose();
                material.dispose();
            }
        }
    });

    scene.remove(object);
}

function makeStars() {
    const count = 1200;
    const positions = [];

    for (let i = 0; i < count; i++) {
        const r = 4200 + Math.random() * 4200;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        positions.push(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.cos(phi),
            r * Math.sin(phi) * Math.sin(theta)
        );
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.5,
        transparent: true,
        opacity: 0.65
    });

    scene.add(new THREE.Points(geometry, material));
}

function buildPlanetObjects() {
    for (const planet of planets) {
        if (planet.orbitRadius > 0) {
            planet.orbitMesh = makeCircle(planet.orbitRadius, 0x888888, 0.34, 0, 220, planet);
            scene.add(planet.orbitMesh);
        }

        const geometry = new THREE.SphereGeometry(planet.visualScaledRadius, 48, 48);
        const material = makePlanetMaterial(planet);

        planet.mesh = new THREE.Mesh(geometry, material);
        planet.mesh.userData.planet = planet;
        scene.add(planet.mesh);

        planet.atmosphereMesh = makeAtmosphereMesh(planet);
        if (planet.atmosphereMesh) {
            planet.mesh.add(planet.atmosphereMesh);
        }

        planet.ringMesh = makePlanetRingMesh(planet);
        if (planet.ringMesh) {
            planet.mesh.add(planet.ringMesh);
        }

        planet.influenceMesh = makeCircle(planet.influenceRadius, 0x4da3ff, 0.24, 2.0, 120);
        scene.add(planet.influenceMesh);
    }

    hoverRing = makeCircle(22, 0xffffff, 0.9, 3.0, 80);
    hoverRing.visible = false;
    scene.add(hoverRing);
}

function disposeObject(object) {
    if (!object) return;
    disposeObjectDeep(object);
}

function clearPlanetObjects() {
    for (const planet of planets) {
        disposeObject(planet.mesh);
        disposeObject(planet.influenceMesh);
        disposeObject(planet.orbitMesh);
    }

    disposeObject(hoverRing);
    hoverRing = null;
    planets = [];
}

function resetActualObjects() {
    disposeObject(actualLine);
    disposeObject(actualMarker);
    actualLine = null;
    actualMarker = null;
}

function resetPredictedObjects() {
    disposeObject(predictedLine);
    disposeObject(predictedStartMarker);
    disposeObject(predictedEndMarker);
    predictedLine = null;
    predictedStartMarker = null;
    predictedEndMarker = null;
}

function rebuildSolarSystem() {
    running = false;
    actualState = null;
    accumulator = 0;
    actualRenderTimer = 0;
    chartRenderTimer = 0;
    infoRenderTimer = 0;

    resetActualObjects();
    resetPredictedObjects();
    clearPlanetObjects();

    planets = makePlanetDataByMode().map((item) => new Planet(item));
    selectedPlanet = planets.find((planet) => planet.name === "Earth") || planets[0];

    buildPlanetObjects();
    loadSelectedPlanet();

    simTime = Number(ui.startTime.value);
    updatePlanetPositions(simTime);
    computePredictedTrajectory();
    resetCamera();
}

function updatePlanetPositions(t) {
    for (const planet of planets) {
        const position = planet.positionAt(t);

        if (planet.mesh) planet.mesh.position.copy(position);
        if (planet.influenceMesh) planet.influenceMesh.position.copy(position);
    }
}

function startPosition(t) {
    const earth = planets.find((planet) => planet.name === "Earth");

    if (!earth) {
        return new THREE.Vector3(-200, 0, 0);
    }

    const earthPosition = earth.positionAt(t);
    const direction = earthPosition.clone().normalize();

    const safeDistance = Math.max(
        earth.radius * 2.8,
        earth.visualScaledRadius * 2.2,
        35
    );

    return earthPosition.clone().add(direction.multiplyScalar(safeDistance));
}

function initialVelocity() {
    const horizontalAngleDegrees = Number(ui.angle.value);
    const verticalAngleDegrees = Number(ui.verticalAngle.value);
    const initialSpeed = Number(ui.speed.value);

    const horizontalAngle = horizontalAngleDegrees * Math.PI / 180;
    const verticalAngle = verticalAngleDegrees * Math.PI / 180;

    const horizontalSpeed = initialSpeed * Math.cos(verticalAngle);
    const verticalSpeed = initialSpeed * Math.sin(verticalAngle);

    return new THREE.Vector3(
        horizontalSpeed * Math.cos(horizontalAngle),
        verticalSpeed,
        horizontalSpeed * Math.sin(horizontalAngle)
    );
}

function totalAcceleration(position, t) {
    const acceleration = new THREE.Vector3(0, 0, 0);

    for (const planet of planets) {
        const planetPosition = planet.positionAt(t);
        const direction = planetPosition.clone().sub(position);
        const distance = Math.max(direction.length(), SOFTENING);
        const scale = G * planet.mass / (distance * distance * distance);

        acceleration.add(direction.multiplyScalar(scale));
    }

    return acceleration;
}

function advance(position, velocity, t, dt) {
    const acceleration = totalAcceleration(position, t);
    velocity.add(acceleration.multiplyScalar(dt));
    position.add(velocity.clone().multiplyScalar(dt));
}

function checkCollision(position, t) {
    for (const planet of planets) {
        const distance = planet.positionAt(t).distanceTo(position);

        if (distance < planet.radius) {
            return planet.name;
        }
    }

    return null;
}

function computePredictedTrajectory() {
    const launchTime = Number(ui.startTime.value);
    const initialSpeed = Number(ui.speed.value);

    let position = startPosition(launchTime);
    let velocity = initialVelocity();

    const positions = [position.clone()];
    const speeds = [velocity.length()];
    const times = [launchTime];

    let collision = null;
    const steps = Math.floor(DURATION / PREDICT_DT);
    const interval = Math.max(1, Math.floor(steps / MAX_POINTS));

    for (let i = 0; i < steps; i++) {
        const t = launchTime + i * PREDICT_DT;

        advance(position, velocity, t, PREDICT_DT);

        if (i % interval === 0) {
            positions.push(position.clone());
            speeds.push(velocity.length());
            times.push(t);
        }

        collision = checkCollision(position, t);
        if (collision) break;
        if (position.length() > WORLD_LIMIT) break;
    }

    predictedResult = {
        positions,
        speeds,
        times,
        collision,
        initialSpeed
    };

    updatePlanetPositions(simTime);
    drawPredictedTrajectory();
    drawChart(predictedResult.speeds, "predicted speed");
    updateInfo();
}

function drawPredictedTrajectory() {
    resetPredictedObjects();

    const geometry = new THREE.BufferGeometry().setFromPoints(predictedResult.positions);
    const material = new THREE.LineBasicMaterial({
        color: 0x58f0ff,
        transparent: true,
        opacity: 0.5
    });

    predictedLine = new THREE.Line(geometry, material);
    scene.add(predictedLine);

    predictedStartMarker = new THREE.Mesh(
        new THREE.SphereGeometry(7, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x00ff66 })
    );
    predictedStartMarker.position.copy(predictedResult.positions[0]);
    scene.add(predictedStartMarker);

    predictedEndMarker = new THREE.Mesh(
        new THREE.SphereGeometry(8, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xff3333 })
    );
    predictedEndMarker.position.copy(predictedResult.positions[predictedResult.positions.length - 1]);
    scene.add(predictedEndMarker);
}

function launchActual() {
    simTime = Number(ui.startTime.value);

    const position = startPosition(simTime);
    const velocity = initialVelocity();

    actualState = {
        active: true,
        paused: false,
        time: simTime,
        position,
        velocity,
        positions: [position.clone()],
        speeds: [velocity.length()],
        collision: null
    };

    running = true;
    playScale = 1;
    accumulator = 0;
    actualRenderTimer = 0;
    chartRenderTimer = 0;
    infoRenderTimer = 0;

    resetActualObjects();
    drawActualTrajectory();
    drawChart(actualState.speeds, "actual speed");
    updateInfo();
}

function pauseActual() {
    running = false;

    if (actualState) {
        actualState.paused = true;
    }

    updateInfo();
}

function playActual() {
    if (!actualState) {
        launchActual();
        return;
    }

    running = true;
    actualState.paused = false;
    updateInfo();
}

function resumeActual(scale) {
    if (!actualState) {
        launchActual();
    }

    running = true;
    playScale = scale;
    actualState.paused = false;
    updateInfo();
}

function stepActual(dt) {
    if (!actualState || !actualState.active || actualState.paused) return;

    advance(actualState.position, actualState.velocity, actualState.time, dt);
    actualState.time += dt;
    simTime = actualState.time;

    actualState.positions.push(actualState.position.clone());
    actualState.speeds.push(actualState.velocity.length());

    actualState.collision = checkCollision(actualState.position, actualState.time);

    if (actualState.collision) {
        actualState.active = false;
        actualState.paused = true;
        running = false;
    }

    if (actualState.position.length() > WORLD_LIMIT || actualState.time - Number(ui.startTime.value) > DURATION) {
        actualState.active = false;
        actualState.paused = true;
        running = false;
    }
}

function drawActualTrajectory() {
    resetActualObjects();

    const geometry = new THREE.BufferGeometry().setFromPoints(actualState.positions);
    const material = new THREE.LineBasicMaterial({
        color: 0xffd84d,
        transparent: true,
        opacity: 1.0
    });

    actualLine = new THREE.Line(geometry, material);
    scene.add(actualLine);

    actualMarker = new THREE.Mesh(
        new THREE.SphereGeometry(12, 18, 18),
        new THREE.MeshBasicMaterial({ color: 0xffd84d })
    );
    actualMarker.position.copy(actualState.position);
    scene.add(actualMarker);
}

function updateInfo() {
    if (!predictedResult) return;

    const predictedSpeeds = predictedResult.speeds;
    const predictedFinalSpeed = predictedSpeeds[predictedSpeeds.length - 1];
    const predictedMaxSpeed = Math.max(...predictedSpeeds);
    const predictedSpeedGain = predictedFinalSpeed - predictedResult.initialSpeed;

    let closestName = "";
    let closestDistance = Infinity;
    let closestInfluenceRadius = 0;
    let insideInfluenceName = null;

    for (let i = 0; i < predictedResult.positions.length; i++) {
        const position = predictedResult.positions[i];
        const t = predictedResult.times[i];

        for (const planet of planets) {
            const distance = planet.positionAt(t).distanceTo(position);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestName = planet.name;
                closestInfluenceRadius = planet.influenceRadius;
            }

            if (!insideInfluenceName && distance <= planet.influenceRadius) {
                insideInfluenceName = planet.name;
            }
        }
    }

    let actualText = "아직 발사 안 됨";

    if (actualState) {
        const actualSpeed = actualState.velocity.length();
        const actualMaxSpeed = Math.max(...actualState.speeds);
        const status = actualState.collision
            ? `충돌: ${actualState.collision}`
            : actualState.active && running
                ? "비행 중"
                : actualState.paused
                    ? "멈춤"
                    : "종료";

        actualText =
            `실제 시간: ${actualState.time.toFixed(2)}
실제 현재 속도: ${actualSpeed.toFixed(2)}
실제 최대 속도: ${actualMaxSpeed.toFixed(2)}
실제 상태: ${status}`;
    }

    ui.info.textContent =
        `[태양계 설정]
모드: ${ui.systemMode.value === "real" ? "Real Scaled Solar System" : "Custom Solar System"}
기준 날짜: ${ui.dateInput.value}
공전 반지름 표시 배율: ${ORBIT_DISTANCE_SCALE.toFixed(2)}x
시점 고정: ${cameraLocked ? "ON" : "OFF"}

[예상 궤적]
수평 발사각: ${Number(ui.angle.value).toFixed(1)}°
수직 발사각: ${Number(ui.verticalAngle.value).toFixed(1)}°
예상 초기 속도: ${predictedResult.initialSpeed.toFixed(2)}
예상 최종 속도: ${predictedFinalSpeed.toFixed(2)}
예상 최대 속도: ${predictedMaxSpeed.toFixed(2)}
예상 속도 변화량: ${predictedSpeedGain.toFixed(2)}
예상 최소 접근 천체: ${closestName}
예상 최소 접근 거리: ${closestDistance.toFixed(2)}
최소 접근 천체 중력권 반지름: ${closestInfluenceRadius.toFixed(2)}
예상 중력권 진입: ${insideInfluenceName ?? "없음"}
예상 충돌 여부: ${predictedResult.collision ?? "없음"}

[실제 궤적]
${actualText}

현재 태양계 시간: ${simTime.toFixed(2)}
청록색: 예상 궤적
노란색: 실제 궤적
파란색 원: 중력권`;
}

function drawChart(speeds, label, targetCanvas = ui.chart) {
    if (targetCanvas === ui.chart) {
        lastChartSpeeds = [...speeds];
        lastChartLabel = label;
    }

    const canvas = targetCanvas;
    const context = canvas.getContext("2d");

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ratio = window.devicePixelRatio || 1;

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    context.clearRect(0, 0, width, height);

    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(88, 240, 255, 0.12)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.35)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    if (!speeds || speeds.length === 0) {
        context.fillStyle = "white";
        context.font = "13px Arial";
        context.fillText("no speed data", 14, 24);
        return;
    }

    const minSpeed = Math.min(...speeds);
    const maxSpeed = Math.max(...speeds);
    const range = Math.max(maxSpeed - minSpeed, 1);

    context.strokeStyle = label.includes("actual") ? "#ffd84d" : "#58f0ff";
    context.lineWidth = targetCanvas === ui.bigChart ? 3 : 2;
    context.beginPath();

    for (let i = 0; i < speeds.length; i++) {
        const x = speeds.length === 1 ? 0 : (i / (speeds.length - 1)) * width;
        const y = height - ((speeds[i] - minSpeed) / range * (height - 40) + 20);

        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
    }

    context.stroke();

    context.fillStyle = "rgba(255,255,255,0.9)";
    context.font = targetCanvas === ui.bigChart ? "16px Arial" : "12px Arial";
    context.fillText(label, 14, 24);

    context.fillStyle = "rgba(255,255,255,0.65)";
    context.font = targetCanvas === ui.bigChart ? "13px Arial" : "11px Arial";
    context.fillText(`min ${minSpeed.toFixed(2)}   max ${maxSpeed.toFixed(2)}`, 14, 44);
}

function updateUIValues() {
    ui.angleValue.textContent = Number(ui.angle.value).toFixed(1);
    ui.verticalAngleValue.textContent = Number(ui.verticalAngle.value).toFixed(1);
    ui.speedValue.textContent = Number(ui.speed.value).toFixed(1);
    ui.timeValue.textContent = Number(ui.startTime.value).toFixed(1);
    ui.massValue.textContent = Number(ui.massScale.value).toFixed(2);
    ui.radiusValue.textContent = Number(ui.radiusScale.value).toFixed(2);
}

function clampRangeValue(input, value) {
    const min = Number(input.min);
    const max = Number(input.max);
    return Math.min(max, Math.max(min, value));
}

function setRangeValue(input, value) {
    const step = Number(input.step || 1);
    const decimals = step.toString().includes(".")
        ? step.toString().split(".")[1].length
        : 0;

    input.value = clampRangeValue(input, value).toFixed(decimals);
    input.dispatchEvent(new Event("input", { bubbles: true }));
}

function setupKeyboardRangeControl(input) {
    input.addEventListener("keydown", (event) => {
        const key = event.key;

        if (
            key !== "ArrowLeft" &&
            key !== "ArrowRight" &&
            key !== "ArrowDown" &&
            key !== "ArrowUp"
        ) {
            return;
        }

        event.preventDefault();

        const baseStep = Number(input.dataset.keyStep || input.step || 1);
        const multiplier = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
        const step = baseStep * multiplier;

        const direction =
            key === "ArrowRight" || key === "ArrowUp"
                ? 1
                : -1;

        setRangeValue(input, Number(input.value) + direction * step);
    });
}

function setupAllKeyboardRangeControls() {
    const rangeInputs = [
        ui.angle,
        ui.verticalAngle,
        ui.speed,
        ui.startTime,
        ui.massScale,
        ui.radiusScale
    ];

    for (const input of rangeInputs) {
        setupKeyboardRangeControl(input);
    }
}

function loadSelectedPlanet() {
    if (!selectedPlanet) return;

    ui.selectedPlanet.textContent = `선택된 행성: ${selectedPlanet.name}`;
    ui.massScale.value = selectedPlanet.massScale;
    ui.radiusScale.value = selectedPlanet.radiusScale;
    updateUIValues();
}

function updatePlanetVisualGeometry(planet) {
    if (!planet) return;

    if (planet.mesh) {
        const oldGeometry = planet.mesh.geometry;
        const oldMaterial = planet.mesh.material;

        planet.mesh.geometry = new THREE.SphereGeometry(planet.visualScaledRadius, 48, 48);
        planet.mesh.material = makePlanetMaterial(planet);

        oldGeometry.dispose();

        if (oldMaterial.map) oldMaterial.map.dispose();
        if (oldMaterial.emissiveMap) oldMaterial.emissiveMap.dispose();
        oldMaterial.dispose();

        if (planet.atmosphereMesh) {
            planet.mesh.remove(planet.atmosphereMesh);
            planet.atmosphereMesh.geometry.dispose();
            planet.atmosphereMesh.material.dispose();
            planet.atmosphereMesh = null;
        }

        if (planet.ringMesh) {
            planet.mesh.remove(planet.ringMesh);
            planet.ringMesh.geometry.dispose();
            planet.ringMesh.material.dispose();
            planet.ringMesh = null;
        }

        planet.atmosphereMesh = makeAtmosphereMesh(planet);
        if (planet.atmosphereMesh) {
            planet.mesh.add(planet.atmosphereMesh);
        }

        planet.ringMesh = makePlanetRingMesh(planet);
        if (planet.ringMesh) {
            planet.mesh.add(planet.ringMesh);
        }
    }

    if (planet.influenceMesh) {
        const oldGeometry = planet.influenceMesh.geometry;
        planet.influenceMesh.geometry = makeCircle(planet.influenceRadius, 0x4da3ff, 0.24, 2.0, 120).geometry;
        oldGeometry.dispose();
    }
}

function focusPlanet(planet) {
    cameraLocked = false;
    updateCameraLockButton();

    const position = planet.positionAt(simTime);
    controls.target.copy(position);

    const offset = new THREE.Vector3(180, 170, 180);
    camera.position.copy(position.clone().add(offset));
    camera.lookAt(position);
    controls.update();
}

function resetCamera() {
    cameraLocked = false;
    updateCameraLockButton();

    controls.target.set(0, 0, 0);
    camera.position.set(1500, 1300, 1500);
    camera.lookAt(0, 0, 0);
    controls.update();
}

function getCameraLockTarget() {
    if (actualState) {
        return actualState.position.clone();
    }

    const earth = planets.find((planet) => planet.name === "Earth");
    if (earth) {
        return earth.positionAt(simTime);
    }

    return new THREE.Vector3(0, 0, 0);
}

function updateCameraLockButton() {
    ui.cameraLock.textContent = cameraLocked ? "시점 고정 ON" : "시점 고정 OFF";
}

function toggleCameraLock() {
    cameraLocked = !cameraLocked;

    if (cameraLocked) {
        const target = getCameraLockTarget();
        cameraLockOffset.copy(camera.position.clone().sub(controls.target));

        if (cameraLockOffset.length() < 80) {
            cameraLockOffset.set(300, 260, 300);
        }

        controls.target.copy(target);
        camera.position.copy(target.clone().add(cameraLockOffset));
        camera.lookAt(target);
    }

    updateCameraLockButton();
    updateInfo();
}

function applyCameraLock() {
    if (!cameraLocked) return;

    const target = getCameraLockTarget();
    controls.target.copy(target);
    camera.position.copy(target.clone().add(cameraLockOffset));
    camera.lookAt(target);
}

function clearActual() {
    running = false;
    actualState = null;
    accumulator = 0;
    actualRenderTimer = 0;
    chartRenderTimer = 0;
    infoRenderTimer = 0;
    resetActualObjects();
    updatePlanetPositions(simTime);

    if (predictedResult) {
        drawChart(predictedResult.speeds, "predicted speed");
    }

    updateInfo();
}

function resetFlight() {
    simTime = Number(ui.startTime.value);
    clearActual();
    updatePlanetPositions(simTime);
    computePredictedTrajectory();
}

function resetToSliderTime() {
    simTime = Number(ui.startTime.value);
    clearActual();
    updatePlanetPositions(simTime);
    computePredictedTrajectory();
}

function moveBack(seconds) {
    simTime = Math.max(0, simTime - seconds);
    ui.startTime.value = simTime.toFixed(1);
    resetToSliderTime();
}

function handleHover(event) {
    mouse.x = event.clientX / window.innerWidth * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const hits = raycaster.intersectObjects(planets.map((planet) => planet.mesh), false);

    for (const planet of planets) {
        if (planet.mesh) planet.mesh.scale.set(1, 1, 1);
    }

    if (hits.length > 0) {
        const planet = hits[0].object.userData.planet;
        const position = planet.positionAt(simTime);

        hits[0].object.scale.set(1.45, 1.45, 1.45);
        hoverRing.visible = true;
        hoverRing.position.copy(position);
        hoverRing.scale.setScalar(Math.max(0.8, planet.visualScaledRadius / 12));
        renderer.domElement.style.cursor = "pointer";
    } else if (hoverRing) {
        hoverRing.visible = false;
        renderer.domElement.style.cursor = "default";
    }
}

function handleClick(event) {
    if (event.target !== renderer.domElement) return;

    mouse.x = event.clientX / window.innerWidth * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const hits = raycaster.intersectObjects(planets.map((planet) => planet.mesh), false);

    if (hits.length > 0) {
        selectedPlanet = hits[0].object.userData.planet;
        loadSelectedPlanet();
        focusPlanet(selectedPlanet);
    }
}

for (const input of [ui.angle, ui.verticalAngle, ui.speed]) {
    input.addEventListener("input", () => {
        updateUIValues();
        clearActual();
        computePredictedTrajectory();
    });
}

ui.startTime.addEventListener("input", () => {
    updateUIValues();
    resetToSliderTime();
});

ui.systemMode.addEventListener("change", () => {
    rebuildSolarSystem();
});

ui.dateInput.addEventListener("change", () => {
    if (ui.systemMode.value === "real") {
        rebuildSolarSystem();
    }
});

ui.massScale.addEventListener("input", updateUIValues);
ui.radiusScale.addEventListener("input", updateUIValues);

ui.savePlanet.addEventListener("click", () => {
    if (!selectedPlanet) return;

    selectedPlanet.massScale = Number(ui.massScale.value);
    selectedPlanet.radiusScale = Number(ui.radiusScale.value);

    updatePlanetVisualGeometry(selectedPlanet);
    resetToSliderTime();
});

ui.resetPlanets.addEventListener("click", () => {
    rebuildSolarSystem();
});

ui.launch.addEventListener("click", launchActual);
ui.play.addEventListener("click", playActual);
ui.pause.addEventListener("click", pauseActual);
ui.resetFlight.addEventListener("click", resetFlight);

ui.speed05x.addEventListener("click", () => resumeActual(0.5));
ui.speed1x.addEventListener("click", () => resumeActual(1));
ui.speed2x.addEventListener("click", () => resumeActual(2));
ui.speed5x.addEventListener("click", () => resumeActual(5));

ui.cameraLock.addEventListener("click", toggleCameraLock);

ui.back1.addEventListener("click", () => moveBack(1));
ui.back5.addEventListener("click", () => moveBack(5));

ui.chart.addEventListener("click", () => {
    ui.chartModal.classList.remove("hidden");
    drawChart(
        lastChartSpeeds.length ? lastChartSpeeds : [0],
        lastChartLabel,
        ui.bigChart
    );
});

ui.closeChart.addEventListener("click", () => {
    ui.chartModal.classList.add("hidden");
});

ui.chartModal.addEventListener("click", (event) => {
    if (event.target === ui.chartModal) {
        ui.chartModal.classList.add("hidden");
    }
});

ui.toggleLeft.addEventListener("click", () => {
    const collapsed = ui.leftPanel.classList.toggle("collapsed");
    ui.toggleLeft.classList.toggle("collapsed", collapsed);
    ui.toggleLeft.textContent = collapsed ? "›" : "☰";
});

ui.toggleRight.addEventListener("click", () => {
    const collapsed = ui.rightPanel.classList.toggle("collapsed");
    ui.toggleRight.classList.toggle("collapsed", collapsed);
    ui.toggleRight.textContent = collapsed ? "‹" : "☷";
});

window.addEventListener("mousemove", handleHover);
window.addEventListener("click", handleClick);

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    if (lastChartSpeeds.length > 0) {
        drawChart(lastChartSpeeds, lastChartLabel, ui.chart);
    }
});

function animate() {
    const delta = clock.getDelta();

    actualRenderTimer += delta;
    chartRenderTimer += delta;
    infoRenderTimer += delta;

    let stepped = false;

    if (running && actualState && actualState.active && !actualState.paused) {
        accumulator += delta * playScale * TIME_FLOW;

        while (accumulator >= DT) {
            stepActual(DT);
            accumulator -= DT;
            stepped = true;
        }
    }

    updatePlanetPositions(simTime);

    for (const planet of planets) {
        if (planet.mesh && planet.name !== "Sun") {
            planet.mesh.rotation.y += delta * 0.18;
        }

        if (planet.mesh && planet.name === "Sun") {
            planet.mesh.rotation.y += delta * 0.08;
        }
    }

    if (stepped && actualState) {
        if (actualRenderTimer >= ACTUAL_RENDER_INTERVAL || !actualState.active) {
            drawActualTrajectory();
            actualRenderTimer = 0;
        }

        if (chartRenderTimer >= CHART_RENDER_INTERVAL || !actualState.active) {
            drawChart(actualState.speeds, "actual speed");
            chartRenderTimer = 0;
        }

        if (infoRenderTimer >= INFO_RENDER_INTERVAL || !actualState.active) {
            updateInfo();
            infoRenderTimer = 0;
        }
    }

    if (actualState && actualMarker) {
        actualMarker.position.copy(actualState.position);
    }

    applyCameraLock();

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

makeStars();
setupAllKeyboardRangeControls();
updateUIValues();
updateCameraLockButton();
rebuildSolarSystem();
animate();
