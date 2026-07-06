/**
 * Scene builder for NumberGame - generates Game.scene JSON
 * Run: node tools/build-scene.js
 * Output: assets/scenes/Game.scene
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('crypto');

function uid() {
    return require('crypto').randomUUID();
}

// Build scene JSON as array of objects with __id__ = array index
const objects = [];

function add(obj) {
    const id = objects.length;
    objects.push(obj);
    return id;
}

// Helper to create Vec3
function vec3(x, y, z) {
    return { __type__: 'cc.Vec3', x, y, z };
}

// Helper to create Quat
function quat(x, y, z, w) {
    return { __type__: 'cc.Quat', x, y, z, w };
}

// Helper to create Color
function color(r, g, b, a = 255) {
    return { __type__: 'cc.Color', r, g, b, a };
}

// Helper to create Size
function size(width, height) {
    return { __type__: 'cc.Size', width, height };
}

// Helper to create Vec2
function vec2(x, y) {
    return { __type__: 'cc.Vec2', x, y };
}

// Track scene node id for children references
let sceneId;

// ========== SceneAsset ==========
add({
    __type__: 'cc.SceneAsset',
    _name: 'Game',
    _objFlags: 0,
    __editorExtras__: {},
    _native: '',
    scene: { __id__: 1 }
});

// ========== Scene ==========
sceneId = add({
    __type__: 'cc.Scene',
    _name: 'Game',
    _objFlags: 0,
    __editorExtras__: {},
    _parent: null,
    _children: [],
    _active: true,
    _components: [],
    _prefab: null,
    _lpos: vec3(0, 0, 0),
    _lrot: quat(0, 0, 0, 1),
    _lscale: vec3(1, 1, 1),
    _mobility: 0,
    _layer: 1073741824,
    _euler: vec3(0, 0, 0),
    autoReleaseAssets: false,
    _globals: null, // will set after
    _id: uid()
});

// ========== SceneGlobals ==========
const globalsId = add({
    __type__: 'cc.SceneGlobals',
    ambient: null,
    skybox: null,
    fog: null,
    octree: null
});
objects[sceneId]._globals = { __id__: globalsId };

// AmbientInfo
const ambientId = add({
    __type__: 'cc.AmbientInfo',
    _skyColorHDR: { __type__: 'cc.Vec4', x: 0.2, y: 0.5, z: 0.8, w: 0.520833 },
    _skyColor: { __type__: 'cc.Vec4', x: 0.2, y: 0.5, z: 0.8, w: 0.520833 },
    _skyIllumHDR: 20000,
    _skyIllum: 20000,
    _groundAlbedoHDR: { __type__: 'cc.Vec4', x: 0.2, y: 0.2, z: 0.2, w: 1 },
    _groundAlbedo: { __type__: 'cc.Vec4', x: 0.2, y: 0.2, z: 0.2, w: 1 }
});
objects[globalsId].ambient = { __id__: ambientId };

// SkyboxInfo
const skyboxId = add({
    __type__: 'cc.SkyboxInfo',
    _envLightingType: 0,
    _envmapHDR: null,
    _envmap: null,
    _envmapLodCount: 0,
    _diffuseMapHDR: null,
    _diffuseMap: null,
    _enabled: false,
    _useHDR: true,
    _editableMaterial: null,
    _reflectionHDR: null,
    _reflectionMap: null,
    _rotationAngle: 0
});
objects[globalsId].skybox = { __id__: skyboxId };

// FogInfo
const fogId = add({
    __type__: 'cc.FogInfo',
    _type: 0,
    _fogColor: color(200, 200, 200),
    _enabled: false,
    _fogDensity: 0.3,
    _fogStart: 0.5,
    _fogEnd: 300,
    _fogAtten: 5,
    _fogTop: 1.5,
    _fogRange: 1.2,
    _accurate: false
});
objects[globalsId].fog = { __id__: fogId };

// OctreeInfo
const octreeId = add({
    __type__: 'cc.OctreeInfo',
    _enabled: false,
    _minPos: vec3(-1024, -1024, -1024),
    _maxPos: vec3(1024, 1024, 1024),
    _depth: 8
});
objects[globalsId].octree = { __id__: octreeId };

// ========== Helper functions ==========

function createNode(name, parentIdx, pos = { x: 0, y: 0, z: 0 }, layer = 1073741824) {
    const nodeIdx = add({
        __type__: 'cc.Node',
        _name: name,
        _objFlags: 0,
        __editorExtras__: {},
        _parent: null,
        _children: [],
        _active: true,
        _components: [],
        _prefab: null,
        _lpos: vec3(pos.x, pos.y, pos.z),
        _lrot: quat(0, 0, 0, 1),
        _lscale: vec3(1, 1, 1),
        _mobility: 0,
        _layer: layer,
        _euler: vec3(0, 0, 0),
        _id: uid()
    });

    // Link parent-child
    objects[nodeIdx]._parent = { __id__: parentIdx };
    objects[parentIdx]._children.push({ __id__: nodeIdx });

    return nodeIdx;
}

function addUITransform(nodeIdx, width, height, anchorX = 0.5, anchorY = 0.5) {
    const compIdx = add({
        __type__: 'cc.UITransform',
        _name: '',
        _objFlags: 0,
        __editorExtras__: {},
        node: null,
        _enabled: true,
        __scriptAsset: null,
        _contentSize: size(width, height),
        _anchorPoint: vec2(anchorX, anchorY)
    });
    objects[compIdx].node = { __id__: nodeIdx };
    objects[nodeIdx]._components.push({ __id__: compIdx });
    return compIdx;
}

function addWidget(nodeIdx, top, bottom, left, right, alignFlags) {
    const compIdx = add({
        __type__: 'cc.Widget',
        _name: '',
        _objFlags: 0,
        __editorExtras__: {},
        node: null,
        _enabled: true,
        __scriptAsset: null,
        _alignFlags: alignFlags || 0,
        _target: null,
        _left: left || 0,
        _right: right || 0,
        _top: top || 0,
        _bottom: bottom || 0,
        _horizontalCenter: 0,
        _verticalCenter: 0,
        _isAbsLeft: true,
        _isAbsRight: true,
        _isAbsTop: true,
        _isAbsBottom: true,
        _isAbsHorizontalCenter: true,
        _isAbsVerticalCenter: true,
        _originalWidth: 0,
        _originalHeight: 0,
        _alignMode: 2
    });
    objects[compIdx].node = { __id__: nodeIdx };
    objects[nodeIdx]._components.push({ __id__: compIdx });
    return compIdx;
}

function addLabel(nodeIdx, text, fontSize = 32, clr = null) {
    const compIdx = add({
        __type__: 'cc.Label',
        _name: '',
        _objFlags: 0,
        __editorExtras__: {},
        node: null,
        _enabled: true,
        __scriptAsset: null,
        _string: text,
        _horizontalAlign: 1,
        _verticalAlign: 1,
        _actualFontSize: fontSize,
        _fontSize: fontSize,
        _fontFamily: 'Arial',
        _lineHeight: fontSize + 4,
        _overflow: 0,
        _enableWrapText: true,
        _font: null,
        _isSystemFontUsed: true,
        _spacingX: 0,
        _isItalic: false,
        _isBold: false,
        _isUnderline: false,
        _underlineHeight: 2,
        _cacheMode: 0,
        _color: clr || color(255, 255, 255),
        _useSystemFont: true
    });
    objects[compIdx].node = { __id__: nodeIdx };
    objects[nodeIdx]._components.push({ __id__: compIdx });
    return compIdx;
}

function addSprite(nodeIdx, clr = null, type = 0) {
    const compIdx = add({
        __type__: 'cc.Sprite',
        _name: '',
        _objFlags: 0,
        __editorExtras__: {},
        node: null,
        _enabled: true,
        __scriptAsset: null,
        _customMaterial: null,
        _srcBlendFactor: 2,
        _dstBlendFactor: 4,
        _color: clr || color(255, 255, 255, 255),
        _type: type,
        _fillType: 0,
        _sizeMode: 0,
        _fillCenter: vec2(0, 0),
        _fillStart: 0,
        _fillRange: 0,
        _isTrimmedMode: true,
        _useGrayscale: false,
        _atlas: null,
        _spriteFrame: null
    });
    objects[compIdx].node = { __id__: nodeIdx };
    objects[nodeIdx]._components.push({ __id__: compIdx });
    return compIdx;
}

function addButton(nodeIdx, normalColor, pressedColor, interactable = true) {
    const transition = 2; // COLOR
    const compIdx = add({
        __type__: 'cc.Button',
        _name: '',
        _objFlags: 0,
        __editorExtras__: {},
        node: null,
        _enabled: true,
        __scriptAsset: null,
        clickEvents: [],
        _interactable: interactable,
        _transition: transition,
        _normalColor: normalColor || color(255, 255, 255),
        _hoverColor: color(200, 200, 200),
        _pressedColor: pressedColor || color(150, 150, 150),
        _disabledColor: color(124, 124, 124),
        _duration: 0.1,
        _zoomScale: 1.1,
        _target: null
    });
    objects[compIdx].node = { __id__: nodeIdx };
    objects[nodeIdx]._components.push({ __id__: compIdx });
    return compIdx;
}

function addCanvas(nodeIdx) {
    const compIdx = add({
        __type__: 'cc.Canvas',
        _name: '',
        _objFlags: 0,
        __editorExtras__: {},
        node: null,
        _enabled: true,
        __scriptAsset: null,
        _cameraComponent: null,
        _alignCanvasWithScreen: true,
        _designResolution: size(720, 1280),
        _fitWidth: true,
        _fitHeight: false
    });
    objects[compIdx].node = { __id__: nodeIdx };
    objects[nodeIdx]._components.push({ __id__: compIdx });
    return compIdx;
}

function addCamera(nodeIdx) {
    const compIdx = add({
        __type__: 'cc.Camera',
        _name: '',
        _objFlags: 0,
        __editorExtras__: {},
        node: null,
        _enabled: true,
        __scriptAsset: null,
        _projection: 0,
        _priority: 1073741824,
        _fov: 45,
        _fovAxis: 0,
        _orthoHeight: 10,
        _near: 1,
        _far: 2000,
        _color: color(0, 0, 0, 255),
        _depth: 1,
        _stencil: 0,
        _clearFlags: 7,
        _rect: { __type__: 'cc.Rect', x: 0, y: 0, width: 1, height: 1 },
        _visibility: 1073741823
    });
    objects[compIdx].node = { __id__: nodeIdx };
    objects[nodeIdx]._components.push({ __id__: compIdx });
    return compIdx;
}

function addAudioSource(nodeIdx) {
    const compIdx = add({
        __type__: 'cc.AudioSource',
        _name: '',
        _objFlags: 0,
        __editorExtras__: {},
        node: null,
        _enabled: true,
        __scriptAsset: null,
        _clip: null,
        _playOnAwake: false,
        _volume: 1,
        _loop: false
    });
    objects[compIdx].node = { __id__: nodeIdx };
    objects[nodeIdx]._components.push({ __id__: compIdx });
    return compIdx;
}

// Script component references
function addScriptComponent(nodeIdx, scriptClass) {
    const compIdx = add({
        __type__: scriptClass,
        _name: '',
        _objFlags: 0,
        __editorExtras__: {},
        node: null,
        _enabled: true,
        __scriptAsset: null
    });
    objects[compIdx].node = { __id__: nodeIdx };
    objects[nodeIdx]._components.push({ __id__: compIdx });
    return compIdx;
}

// ========== BUILD SCENE ==========

// --- Canvas ---
const canvasNodeIdx = createNode('Canvas', sceneId, vec3(360, 640, 0), 1073741824);
addUITransform(canvasNodeIdx, 720, 1280);
addCanvas(canvasNodeIdx);

// --- Camera ---
const cameraNodeIdx = createNode('Camera', canvasNodeIdx, vec3(0, 0, 1000), 1073741824);
addCamera(cameraNodeIdx);

// --- TopBar ---
const topBarIdx = createNode('TopBar', canvasNodeIdx, vec3(0, 520, 0), 1073741824);
addUITransform(topBarIdx, 720, 80);
addWidget(topBarIdx, 0, null, null, null, 45); // TOP + LEFT + RIGHT = 4+8+32=44... actually top=4, left=8, right=32 => 44. But let's just use top
// Actually alignFlags: TOP=1<<2=4, LEFT=1<<3=8, RIGHT=1<<5=32, BOTTOM=1<<4=16
// TOP + LEFT + RIGHT = 4+8+32 = 44
// But the default widget sets top=0. Let me use 44

// --- ScoreLabel ---
const scoreLabelIdx = createNode('ScoreLabel', topBarIdx, vec3(-200, 0, 0), 1073741824);
addUITransform(scoreLabelIdx, 200, 50);
addLabel(scoreLabelIdx, '分数: 0', 30, color(255, 255, 100));

// --- ComboLabel ---
const comboLabelIdx = createNode('ComboLabel', topBarIdx, vec3(0, 0, 0), 1073741824);
addUITransform(comboLabelIdx, 200, 50);
addLabel(comboLabelIdx, '', 28, color(255, 200, 50));

// --- TimeLabel ---
const timeLabelIdx = createNode('TimeLabel', topBarIdx, vec3(200, 0, 0), 1073741824);
addUITransform(timeLabelIdx, 200, 50);
addLabel(timeLabelIdx, '30s', 30, color(100, 255, 100));

// --- FruitArea ---
const fruitAreaIdx = createNode('FruitArea', canvasNodeIdx, vec3(0, 100, 0), 1073741824);
addUITransform(fruitAreaIdx, 600, 500);

// --- ButtonPanel ---
const buttonPanelIdx = createNode('ButtonPanel', canvasNodeIdx, vec3(0, -420, 0), 1073741824);
addUITransform(buttonPanelIdx, 700, 120);

// Button colors: 1=红, 2=蓝, 3=绿, 4=橙, 5=紫
const btnColors = [
    color(231, 76, 60),
    color(52, 152, 219),
    color(46, 204, 113),
    color(243, 156, 18),
    color(155, 89, 182)
];

const btnNodeIndices = [];
const BUTTON_X_POSITIONS = [-240, -120, 0, 120, 240];

for (let i = 0; i < 5; i++) {
    const btnIdx = createNode(`Btn${i + 1}`, buttonPanelIdx, vec3(BUTTON_X_POSITIONS[i], 0, 0), 1073741824);
    addUITransform(btnIdx, 100, 100);
    addSprite(btnIdx, btnColors[i]);
    addButton(btnIdx, btnColors[i], color(
        Math.max(0, btnColors[i].r - 60),
        Math.max(0, btnColors[i].g - 60),
        Math.max(0, btnColors[i].b - 60)
    ));

    // Number label inside button
    const btnLabelIdx = createNode('Label', btnIdx, vec3(0, 0, 0), 1073741824);
    addUITransform(btnLabelIdx, 80, 80);
    addLabel(btnLabelIdx, `${i + 1}`, 48, color(255, 255, 255));

    btnNodeIndices.push(btnIdx);
}

// --- CountdownLabel ---
const countdownLabelIdx = createNode('CountdownLabel', canvasNodeIdx, vec3(0, 200, 0), 1073741824);
addUITransform(countdownLabelIdx, 300, 100);
addLabel(countdownLabelIdx, '', 72, color(255, 255, 255));
objects[countdownLabelIdx]._active = false;

// --- FeedbackLabel ---
const feedbackLabelIdx = createNode('FeedbackLabel', canvasNodeIdx, vec3(0, -100, 0), 1073741824);
addUITransform(feedbackLabelIdx, 400, 80);
addLabel(feedbackLabelIdx, '', 48, color(46, 204, 113));
objects[feedbackLabelIdx]._active = false;

// --- ResultPanel ---
const resultPanelIdx = createNode('ResultPanel', canvasNodeIdx, vec3(0, 0, 0), 1073741824);
addUITransform(resultPanelIdx, 500, 600);
objects[resultPanelIdx]._active = false;

// Semi-transparent background
const resultBgIdx = createNode('ResultBg', resultPanelIdx, vec3(0, 0, 0), 1073741824);
addUITransform(resultBgIdx, 500, 600);
addSprite(resultBgIdx, color(30, 30, 50, 220));

// Result labels
const finalScoreLabelIdx = createNode('FinalScoreLabel', resultPanelIdx, vec3(0, 200, 0), 1073741824);
addUITransform(finalScoreLabelIdx, 400, 60);
addLabel(finalScoreLabelIdx, '0', 56, color(255, 255, 100));

const correctCountLabelIdx = createNode('CorrectCountLabel', resultPanelIdx, vec3(0, 120, 0), 1073741824);
addUITransform(correctCountLabelIdx, 400, 40);
addLabel(correctCountLabelIdx, '0/0', 32, color(255, 255, 255));

const maxComboLabelIdx = createNode('MaxComboLabel', resultPanelIdx, vec3(0, 60, 0), 1073741824);
addUITransform(maxComboLabelIdx, 400, 40);
addLabel(maxComboLabelIdx, '0', 32, color(255, 255, 255));

const fastestLabelIdx = createNode('FastestLabel', resultPanelIdx, vec3(0, 0, 0), 1073741824);
addUITransform(fastestLabelIdx, 400, 40);
addLabel(fastestLabelIdx, '--', 32, color(255, 255, 255));

const starsLabelIdx = createNode('StarsLabel', resultPanelIdx, vec3(0, -60, 0), 1073741824);
addUITransform(starsLabelIdx, 400, 50);
addLabel(starsLabelIdx, '', 40, color(255, 200, 50));

// Replay button
const replayBtnIdx = createNode('ReplayBtn', resultPanelIdx, vec3(-100, -150, 0), 1073741824);
addUITransform(replayBtnIdx, 160, 60);
addSprite(replayBtnIdx, color(46, 204, 113));
addButton(replayBtnIdx, color(46, 204, 113), color(30, 160, 80));
const replayLabelIdx = createNode('Label', replayBtnIdx, vec3(0, 0, 0), 1073741824);
addUITransform(replayLabelIdx, 140, 50);
addLabel(replayLabelIdx, '再来一次', 28, color(255, 255, 255));

// Home button
const homeBtnIdx = createNode('HomeBtn', resultPanelIdx, vec3(100, -150, 0), 1073741824);
addUITransform(homeBtnIdx, 160, 60);
addSprite(homeBtnIdx, color(52, 152, 219));
addButton(homeBtnIdx, color(52, 152, 219), color(30, 100, 170));
const homeLabelIdx = createNode('Label', homeBtnIdx, vec3(0, 0, 0), 1073741824);
addUITransform(homeLabelIdx, 140, 50);
addLabel(homeLabelIdx, '返回主页', 28, color(255, 255, 255));

// --- Manager Nodes (script components will be attached via MCP) ---

// AudioManager
const audioMgrIdx = createNode('AudioManager', canvasNodeIdx, vec3(0, 0, 0), 1073741824);
addAudioSource(audioMgrIdx);

// ScoreManager
const scoreMgrIdx = createNode('ScoreManager', canvasNodeIdx, vec3(0, 0, 0), 1073741824);

// TimerManager
const timerMgrIdx = createNode('TimerManager', canvasNodeIdx, vec3(0, 0, 0), 1073741824);

// FruitSpawner
const fruitSpawnerIdx = createNode('FruitSpawner', canvasNodeIdx, vec3(0, 0, 0), 1073741824);

// ButtonPanel script node
const btnPanelScriptIdx = createNode('ButtonPanelScript', canvasNodeIdx, vec3(0, 0, 0), 1073741824);

// ResultPanel script node (this one has the actual ResultPanel node)
const resultPanelScriptIdx = createNode('ResultPanelScript', canvasNodeIdx, vec3(0, 0, 0), 1073741824);

// GameManager
const gameMgrIdx = createNode('GameManager', canvasNodeIdx, vec3(0, 0, 0), 1073741824);

// Write output
const outputPath = path.join(__dirname, '..', 'assets', 'scenes', 'Game.scene');
fs.writeFileSync(outputPath, JSON.stringify(objects, null, 2), 'utf8');
console.log(`Scene written to ${outputPath}`);
console.log(`Total objects: ${objects.length}`);
