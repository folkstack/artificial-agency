// --- START OF MODIFIED FILE script.js ---

window.onload = async () => { // Make window.onload async
    // --- Canvas Elements ---
    const monitorCanvas = document.getElementById('monitorCanvas');
    const monitorCanvas2 = document.getElementById('monitorCanvas2'); // Monitor 2
    const p3Canvas = document.getElementById('p3Canvas');
    const overlayCanvas = document.getElementById('overlayCanvas');
    const angleScaleCanvas = document.getElementById('angleScaleCanvas');
    const positionCanvas = document.getElementById('positionCanvas');


    // --- Status Elements ---
    const monitorStatus = document.getElementById('monitorStatus'); // Monitor 1 status
    const monitorStatus2 = document.getElementById('monitorStatus2'); // Monitor 2 status
    const p3Status = document.getElementById('p3Status');
    const overlayStatus = document.getElementById('overlayStatus');
    const angleScaleStatus = document.getElementById('angleScaleStatus');
    const positionStatus = document.getElementById('positionStatus');
    const permissionStatus = document.getElementById('permissionStatus'); // Added for FSA


    // --- Form Elements ---
    const shapeForm = document.getElementById('shapeForm');
    const shapeTypeRadios = shapeForm?.elements['shapeType'];
    const shapeSizeSlider = document.getElementById('shapeSizeSlider');
    const shapeSizeValueSpan = document.getElementById('shapeSizeValue');
    const angleScaleForm = document.getElementById('angleScaleForm');
    const angleSlider = document.getElementById('angleSlider');
    const distanceSlider = document.getElementById('distanceSlider');
    const angleValueSpan = document.getElementById('angleValue');
    const distanceValueSpan = document.getElementById('distanceValue');
    const positionForm = document.getElementById('positionForm');
    const xSlider = document.getElementById('xSlider');
    const ySlider = document.getElementById('ySlider');
    const xValueSpan = document.getElementById('xValueSpan');
    const yValueSpan = document.getElementById('yValueSpan');
    const samplingForm = document.getElementById('samplingForm');
    const samplingMethodRadios = samplingForm?.elements['samplingMethod'];
    const renderScaleSlider = document.getElementById('renderScaleSlider');
    const renderScaleValueSpan = document.getElementById('renderScaleValueSpan');


    // --- Button Elements ---
    const renderButton = document.getElementById('renderButton');
    const permissionButton = document.getElementById('permissionButton'); // Added for FSA


    // --- Constants ---
    const CANVAS_SIZE =100;
    const CANVAS_CENTER_X = CANVAS_SIZE / 2;
    const CANVAS_CENTER_Y = CANVAS_SIZE / 2;
    const MAX_DISTANCE_FOR_SCALE = Math.sqrt(CANVAS_CENTER_X ** 2 + CANVAS_CENTER_Y ** 2);
    const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;
    const MIN_SCALE_FACTOR = 0.5;
    const INDICATOR_RADIUS = 5;
    const SHAPE_STROKE_WIDTH = 2;
    const SHAPE_STROKE_STYLE = 'rgba(0, 0, 0, 0.9)';
    const STAR_POINTS = 5;
    const STAR_INNER_RADIUS_RATIO = 0.45;
    const RENDER_MASK_COLOR = 'rgba(255, 0, 0, 1)';
    const COLOR_SPACE = 'display-p3';
    const TILING_AREA_SCALE_FACTOR = 1.1;


    // --- State Variables ---
    let isDraggingAngleScale = false;
    let isDraggingPosition = false;
    let currentAngle = 0;
    let currentDistance = 0.1;
    let shapePositionX = CANVAS_CENTER_X;
    let shapePositionY = CANVAS_CENTER_Y;
    let selectedShape = 'circle';
    let baseShapeSize = 250;
    let samplingMethod = 'pixel';
    let renderScaleMultiple = 1.7;
    let animationFrameRequestId = null;
    let isRendering = false;
    // hasFsaPermission is implicitly handled by memoryBank.hasDirectoryPermission()


    // --- Create Hidden Render Canvas ---
    const renderCanvas = document.createElement('canvas');

    // --- Get Contexts ---
    let monitorCtx = null;
    let monitorCtx2 = null;
    let p3Ctx = null;
    let overlayCtx = null;
    let angleScaleCtx = null;
    let positionCtx = null;
    let renderCtx = null;
    const contextOptionsP3 = { colorSpace: COLOR_SPACE };
    const contextOptionsP3Read = { colorSpace: COLOR_SPACE, willReadFrequently: true };
    try { monitorCtx = monitorCanvas?.getContext('2d', contextOptionsP3Read); } catch (e) { console.error("Error getting Monitor 1 context:", e); if(monitorStatus) monitorStatus.textContent = "Error: Monitor 1 Context (P3?)."; }
    try { monitorCtx2 = monitorCanvas2?.getContext('2d', contextOptionsP3Read); } catch (e) { console.error("Error getting Monitor 2 context:", e); if(monitorStatus2) monitorStatus2.textContent = "Error: Monitor 2 Context (P3?)."; }
    try { p3Ctx = p3Canvas?.getContext('2d', contextOptionsP3); } catch (e) { console.error("Error getting P3 context:", e); if(p3Status) p3Status.textContent = "Error: P3 Context."; }
    try { overlayCtx = overlayCanvas?.getContext('2d', contextOptionsP3); } catch (e) { console.error("Error getting Overlay context:", e); if(overlayStatus) overlayStatus.textContent = "Error: Overlay Context."; }
    try { angleScaleCtx = angleScaleCanvas?.getContext('2d', contextOptionsP3); } catch (e) { console.error("Error getting Angle/Scale context:", e); if(angleScaleStatus) angleScaleStatus.textContent = "Error: Angle/Scale Context."; }
    try { positionCtx = positionCanvas?.getContext('2d', contextOptionsP3); } catch (e) { console.error("Error getting Position context:", e); if(positionStatus) positionStatus.textContent = "Error: Position Context."; }


    // --- Color Sequence & Strings ---
    const yellowRGB  = [1.1, 1, 0];
    const cyanRGB    = [0, 1, 1];
    const magentaRGB = [1, 0, 1];
    const redRGB     = [1, 0, 0];
    const greenRGB   = [0, 1, 0];
    const blueRGB    = [0, 0, 1];
    const gradientKeyColorsRGB = [ yellowRGB, greenRGB, cyanRGB, blueRGB, magentaRGB, redRGB, yellowRGB ];
    const p3ColorStrings = gradientKeyColorsRGB.map(rgb => `color(${COLOR_SPACE} ${rgb[0].toFixed(6)} ${rgb[1].toFixed(6)} ${rgb[2].toFixed(6)})`);


    // --- Helper: Calculate Approximate Bounding Box ---
    function getApproximateBoundingBox(shape, centerX, centerY, size, angleRad, canvasWidth, canvasHeight) {
        let maxExtent = 0;
        switch (shape) {
            case 'circle': maxExtent = size / (2 * Math.PI); break; // Radius
            case 'square': maxExtent = size / 2; break; // Half diagonal
            case 'triangle': maxExtent = size * (2/3); break; // Approx height from center
            case 'star': maxExtent = size / 2; break; // Outer radius
            default: maxExtent = Math.max(canvasWidth, canvasHeight) / 2;
        }
        maxExtent *= 1.1; // Padding

        let minX = Math.floor(centerX - maxExtent);
        let minY = Math.floor(centerY - maxExtent);
        let maxX = Math.ceil(centerX + maxExtent);
        let maxY = Math.ceil(centerY + maxExtent);

        minX = Math.max(0, minX); minY = Math.max(0, minY);
        maxX = Math.min(canvasWidth, maxX); maxY = Math.min(canvasHeight, maxY);

        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);

        return { x: minX, y: minY, width: width, height: height };
    }


    // --- Drawing Functions ---
    function drawConicGradient(canvas, context, statusElement, colors, requestedColorSpace, centerOverride = null) {
        if (!context) { if (statusElement) statusElement.textContent = `Error: Canvas context for '${canvas.id}' not supported or creation failed.`; console.error("Canvas context is null for:", canvas.id); const fallbackCtx = canvas?.getContext('2d'); if (fallbackCtx) { fallbackCtx.fillStyle = '#ddd'; fallbackCtx.fillRect(0, 0, canvas.width, canvas.height); fallbackCtx.fillStyle = '#000'; fallbackCtx.font = '14px sans-serif'; fallbackCtx.textAlign = 'center'; fallbackCtx.textBaseline = 'middle'; fallbackCtx.fillText('Context Error', canvas.width / 2, canvas.height / 2); } return; }
        const width = canvas.width; const height = canvas.height;
        const centerX = centerOverride ? centerOverride.x : width / 2;
        const centerY = centerOverride ? centerOverride.y : height / 2;
        const startAngle = Math.PI * 3 / 2;
        const gradient = context.createConicGradient(startAngle, centerX, centerY);
        const numStops = colors.length;
        if (numStops > 1) { const step = 1 / (numStops - 1); colors.forEach((color, index) => { const position = Math.min(1, index * step); try { gradient.addColorStop(position, color); } catch (e) { console.error(`Error adding color stop for ${canvas.id || 'render'}: Pos=${position}, Color='${color}', Error:`, e); if (statusElement) statusElement.textContent += ` | Error adding stop: ${color}`; } }); try { gradient.addColorStop(1, colors[0]); } catch (e) { console.error(`Error adding wrap-around color stop for ${canvas.id || 'render'}: Color='${colors[0]}', Error:`, e); } } else if (numStops === 1) { gradient.addColorStop(0, colors[0]); gradient.addColorStop(1, colors[0]); }
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
        if (statusElement) { try { const actualColorSpace = context.getContextAttributes().colorSpace; console.log(`${canvas.id} context actual colorSpace: ${actualColorSpace} (requested ${requestedColorSpace})`); let statusMsg = `Canvas '${canvas.id}': `; if (actualColorSpace === requestedColorSpace) statusMsg += `Using ${actualColorSpace}.`; else statusMsg += `Using ${actualColorSpace} (requested ${requestedColorSpace}, check support).`; statusElement.textContent = statusMsg; } catch (e) { console.warn(`Could not read colorSpace attribute for ${canvas.id}.`, e); statusElement.textContent = `Canvas '${canvas.id}': Color space check failed.`; } }
    }
    function drawP3GradientSource() { if (!p3Ctx) return; drawConicGradient(p3Canvas, p3Ctx, p3Status, p3ColorStrings, COLOR_SPACE); }
    function drawIndicator(ctx, x, y) { if (!ctx) return; ctx.beginPath(); ctx.arc(x, y, INDICATOR_RADIUS, 0, 2 * Math.PI); ctx.fillStyle = 'rgba(255, 0, 0, 0.7)'; ctx.fill(); ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'; ctx.lineWidth = 1; ctx.stroke(); }
    function drawCirclePath(ctx, centerX, centerY, sizeCircumference) { const radius = sizeCircumference / (2 * Math.PI); if (radius <= 0 || !ctx) return false; ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI); return true; }
    function drawSquarePath(ctx, centerX, centerY, sizeDiagonal, angleRad) { if (sizeDiagonal <= 0 || !ctx) return false; const side = sizeDiagonal / Math.sqrt(2); const halfSide = side / 2; const points = [ { x: -halfSide, y: -halfSide }, { x:  halfSide, y: -halfSide }, { x:  halfSide, y:  halfSide }, { x: -halfSide, y:  halfSide } ]; ctx.beginPath(); points.forEach((p, index) => { const rotatedX = p.x * Math.cos(angleRad) - p.y * Math.sin(angleRad); const rotatedY = p.x * Math.sin(angleRad) + p.y * Math.cos(angleRad); const finalX = centerX + rotatedX; const finalY = centerY + rotatedY; if (index === 0) ctx.moveTo(finalX, finalY); else ctx.lineTo(finalX, finalY); }); ctx.closePath(); return true; }
    function drawTrianglePath(ctx, centerX, centerY, sizeLongSide, angleRad) { if (sizeLongSide <= 0 || !ctx) return false; const S = sizeLongSide; const base = S / GOLDEN_RATIO; const h_squared = S**2 - (base/2)**2; if (h_squared <= 0) return false; const h = Math.sqrt(h_squared); const apexY = -(2 * h / 3); const baseY = h / 3; const halfBase = base / 2; const points = [ { x: 0, y: apexY }, { x: -halfBase, y: baseY }, { x: halfBase, y: baseY } ]; ctx.beginPath(); points.forEach((p, index) => { const rotatedX = p.x * Math.cos(angleRad) - p.y * Math.sin(angleRad); const rotatedY = p.x * Math.sin(angleRad) + p.y * Math.cos(angleRad); const finalX = centerX + rotatedX; const finalY = centerY + rotatedY; if (index === 0) ctx.moveTo(finalX, finalY); else ctx.lineTo(finalX, finalY); }); ctx.closePath(); return true; }
    function drawStarPath(ctx, centerX, centerY, outerDiameter, angleRad) { if (outerDiameter <= 0 || !ctx) return false; const outerRadius = outerDiameter / 2; const innerRadius = outerRadius * STAR_INNER_RADIUS_RATIO; const angleStep = Math.PI / STAR_POINTS; const startAngleOffset = angleRad - Math.PI / 2; ctx.beginPath(); for (let i = 0; i < 2 * STAR_POINTS; i++) { const radius = (i % 2 === 0) ? outerRadius : innerRadius; const currentAngle = startAngleOffset + i * angleStep; const x = centerX + radius * Math.cos(currentAngle); const y = centerY + radius * Math.sin(currentAngle); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); return true; }
    function drawShape(ctx, shape, centerX, centerY, size, angleRad, doFill = false, fillStyle = null) { if (!ctx) return; let pathCreated = false; switch (shape) { case 'circle': pathCreated = drawCirclePath(ctx, centerX, centerY, size); break; case 'square': pathCreated = drawSquarePath(ctx, centerX, centerY, size, angleRad); break; case 'triangle': pathCreated = drawTrianglePath(ctx, centerX, centerY, size, angleRad); break; case 'star': pathCreated = drawStarPath(ctx, centerX, centerY, size, angleRad); break; } if (pathCreated) { if (doFill) { ctx.fillStyle = fillStyle || 'black'; ctx.fill(); } else { ctx.strokeStyle = SHAPE_STROKE_STYLE; ctx.lineWidth = SHAPE_STROKE_WIDTH; ctx.stroke(); } } }


    // --- requestAnimationFrame Drawing Loop (UI Updates Only) ---
    function drawUpdate() {
        if (overlayCtx) overlayCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        if (angleScaleCtx) angleScaleCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        if (positionCtx) positionCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        const indicatorAngleX = CANVAS_CENTER_X + currentDistance * Math.cos(currentAngle);
        const indicatorAngleY = CANVAS_CENTER_Y + currentDistance * Math.sin(currentAngle);
        drawIndicator(angleScaleCtx, indicatorAngleX, indicatorAngleY);
        drawIndicator(positionCtx, shapePositionX, shapePositionY);
        const scaleFactor = Math.max(MIN_SCALE_FACTOR, currentDistance / MAX_DISTANCE_FOR_SCALE);
        const overlayDrawShapeSize = baseShapeSize * scaleFactor;
        drawShape(overlayCtx, selectedShape, shapePositionX, shapePositionY, overlayDrawShapeSize, currentAngle, false);
        const normalizedAngle = (currentAngle / (2 * Math.PI)) % 1; const normalizedDistance = Math.max(0, Math.min(1, currentDistance / MAX_DISTANCE_FOR_SCALE)); if (angleSlider && angleSlider.value !== normalizedAngle.toString()) angleSlider.value = normalizedAngle; if (distanceSlider && distanceSlider.value !== normalizedDistance.toString()) distanceSlider.value = normalizedDistance; if(angleValueSpan) angleValueSpan.textContent = `${currentAngle.toFixed(2)} rad`; if(distanceValueSpan) distanceValueSpan.textContent = `${(normalizedDistance * 100).toFixed(0)}%`; if (xSlider && xSlider.value !== shapePositionX.toString()) xSlider.value = shapePositionX; if (ySlider && ySlider.value !== shapePositionY.toString()) ySlider.value = shapePositionY; if(xValueSpan) xValueSpan.textContent = `${shapePositionX.toFixed(0)} px`; if(yValueSpan) yValueSpan.textContent = `${shapePositionY.toFixed(0)} px`; if (shapeSizeSlider && shapeSizeSlider.value !== baseShapeSize.toString()) shapeSizeSlider.value = baseShapeSize; if(shapeSizeValueSpan) shapeSizeValueSpan.textContent = `${baseShapeSize} units`; if(angleScaleStatus) angleScaleStatus.textContent = `Angle: ${currentAngle.toFixed(2)}, Scale: ${scaleFactor.toFixed(2)}`; if(positionStatus) positionStatus.textContent = `X: ${shapePositionX.toFixed(1)}, Y: ${shapePositionY.toFixed(1)}`; if(overlayStatus) overlayStatus.textContent = `Shape: ${selectedShape}, Pos: (${shapePositionX.toFixed(0)}, ${shapePositionY.toFixed(0)}), Angle: ${currentAngle.toFixed(2)}, Scale: ${scaleFactor.toFixed(2)} (Base: ${baseShapeSize})`;
        animationFrameRequestId = null;
    }
    function requestDraw() { if (!animationFrameRequestId && !isRendering) { animationFrameRequestId = requestAnimationFrame(drawUpdate); } }


    // --- Interaction Logic ---
    function getCanvasCoords(event, canvas) { if (!canvas) return null; const rect = canvas.getBoundingClientRect(); let clientX, clientY; if (event.changedTouches) { if (event.changedTouches.length === 0) return null; clientX = event.changedTouches[0].clientX; clientY = event.changedTouches[0].clientY; } else { clientX = event.clientX; clientY = event.clientY; } const computedStyle = getComputedStyle(canvas); const borderLeftWidth = parseFloat(computedStyle.borderLeftWidth) || 0; const borderTopWidth = parseFloat(computedStyle.borderTopWidth) || 0; const canvasX = clientX - rect.left - borderLeftWidth; const canvasY = clientY - rect.top - borderTopWidth; const clampedX = Math.max(0, Math.min(CANVAS_SIZE, canvasX)); const clampedY = Math.max(0, Math.min(CANVAS_SIZE, canvasY)); return { x: clampedX, y: clampedY }; }
    function handleAngleScaleInteraction(event) { const coords = getCanvasCoords(event, angleScaleCanvas); if (!coords) return; const deltaX = coords.x - CANVAS_CENTER_X; const deltaY = coords.y - CANVAS_CENTER_Y; currentDistance = Math.min(MAX_DISTANCE_FOR_SCALE, Math.sqrt(deltaX ** 2 + deltaY ** 2)); currentAngle = Math.atan2(deltaY, deltaX); if (currentAngle < 0) currentAngle += 2 * Math.PI; requestDraw(); }
    function handlePositionInteraction(event) { const coords = getCanvasCoords(event, positionCanvas); if (!coords) return; shapePositionX = coords.x; shapePositionY = coords.y; requestDraw(); }


    // --- Form Input Handlers ---
    function handleShapeFormInput(event) { if (event.target.name === 'shapeType') { selectedShape = event.target.value; } else if (event.target.id === 'shapeSizeSlider') { baseShapeSize = parseInt(event.target.value, 10); } requestDraw(); }
    function handleAngleScaleFormInput() { const normAngle = parseFloat(angleSlider?.value ?? 0); const normDistance = parseFloat(distanceSlider?.value ?? 0); currentAngle = normAngle * 2 * Math.PI; currentDistance = normDistance * MAX_DISTANCE_FOR_SCALE; requestDraw(); }
    function handlePositionFormInput() { shapePositionX = parseFloat(xSlider?.value ?? CANVAS_CENTER_X); shapePositionY = parseFloat(ySlider?.value ?? CANVAS_CENTER_Y); requestDraw(); }
    function handleSamplingFormInput(event) { if (event.target.name === 'samplingMethod') { samplingMethod = event.target.value; console.log("Sampling method changed to:", samplingMethod); } else if (event.target.id === 'renderScaleSlider') { renderScaleMultiple = parseFloat(event.target.value); if(renderScaleValueSpan) renderScaleValueSpan.textContent = `${renderScaleMultiple.toFixed(1)}x`; console.log("Render scale multiple changed to:", renderScaleMultiple); } }


    // --- Fisher-Yates Shuffle ---
    function shuffleArray(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } }


    // --- Gaussian Random Number ---
    let spareGaussian = null;
    function gaussianRandom() { let u, v, s; if (spareGaussian !== null) { const temp = spareGaussian; spareGaussian = null; return temp; } do { u = Math.random() * 2 - 1; v = Math.random() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0); s = Math.sqrt(-2.0 * Math.log(s) / s); spareGaussian = v * s; return u * s; }

    // --- Update UI based on FSA Permission State ---
    function updatePermissionUI() {
        if (typeof memoryBank === 'undefined') {
             if(permissionStatus) permissionStatus.textContent = "Error: memoryBank module not loaded.";
             if(permissionButton) permissionButton.disabled = true;
             if(renderButton) renderButton.disabled = true;
             return;
        }

        const hasPermission = memoryBank.hasDirectoryPermission(); // Check in-memory handle status

        if (hasPermission) {
            if(permissionStatus) permissionStatus.textContent = "✅ Directory permission active for this session.";
            if(permissionButton) permissionButton.disabled = true; // Can disable after grant
            if(renderButton) renderButton.disabled = isRendering; // Enable render if not already rendering
        } else {
            if(permissionStatus) permissionStatus.textContent = "⚠️ Directory permission required to save results.";
            if(permissionButton) permissionButton.disabled = false; // Enable button to request
            if(renderButton) renderButton.disabled = true; // Disable render until granted
        }
    }

    // --- Request FSA Permission Handler ---
    async function requestFsaPermission() {
        if (permissionButton) permissionButton.disabled = true; // Disable while request is active
        if (permissionStatus) permissionStatus.textContent = "Requesting permission...";

        // Ensure memoryBank is available before calling
        if (typeof memoryBank === 'undefined' || !memoryBank.requestDirectoryPermission) {
            console.error("Cannot request permission: memoryBank not ready.");
            if (permissionStatus) permissionStatus.textContent = "Error: memoryBank module failed.";
            // Keep button disabled maybe? Or re-enable after a delay?
            return;
        }

        const granted = await memoryBank.requestDirectoryPermission();

        if (granted) {
            console.log("Directory permission granted by user.");
            // UI update will happen because hasDirectoryPermission() will now be true
        } else {
            console.warn("Directory permission not granted or request failed.");
            // UI update will happen because hasDirectoryPermission() will still be false
        }
        updatePermissionUI(); // Update UI based on the result
    }


    // --- Render to Monitor Function (Modified for Memory Bank & FSA) ---
    async function renderAndDisplay() {
        if (isRendering) return;
        if (!monitorCtx || !monitorCtx2) {
             if(monitorStatus) monitorStatus.textContent = "Error: Monitor context(s) missing.";
             if(monitorStatus2) monitorStatus2.textContent = "Error: Monitor context(s) missing.";
             return;
        }
        // Check permission using the memoryBank's current state
        if (typeof memoryBank === 'undefined' || !memoryBank.hasDirectoryPermission || !memoryBank.hasDirectoryPermission()) {
             if(monitorStatus) monitorStatus.textContent = "Error: Grant directory permission first.";
             if(monitorStatus2) monitorStatus2.textContent = "Error: Grant directory permission first.";
             // Don't alert if memoryBank itself is missing
             if (typeof memoryBank !== 'undefined') {
                 alert("Please grant directory permission using the button before rendering.");
             }
             return;
        }

        isRendering = true;
        if(renderButton) renderButton.disabled = true;
        if(monitorStatus) monitorStatus.textContent = "Starting Render...";
        if(monitorStatus2) monitorStatus2.textContent = "Starting Render...";
        console.time("RenderAndDisplay");

        let finalDistribution = null;
        let finalShapeParams = {};
        let finalScaleFactor = 0;
        let renderImageDataForBank = null;
        let paintImageDataForBank = null;

        await new Promise(resolve => setTimeout(resolve, 10));

        try {
            // --- Calculate Dynamic Render Size & Params ---
            const actualRenderSize = Math.max(10, Math.round(CANVAS_SIZE * renderScaleMultiple));
            const actualRenderCenterX = actualRenderSize / 2;
            const actualRenderCenterY = actualRenderSize / 2;
            const actualScaleFactorRender = actualRenderSize / CANVAS_SIZE;

            if (renderCanvas.width !== actualRenderSize || renderCanvas.height !== actualRenderSize || !renderCtx) {
                console.log(`Setting render canvas size to ${actualRenderSize}x${actualRenderSize}`);
                renderCanvas.width = actualRenderSize;
                renderCanvas.height = actualRenderSize;
                try {
                    renderCtx = renderCanvas.getContext('2d', contextOptionsP3Read);
                    if (!renderCtx) throw new Error("Failed to get context after resize");
                } catch (e) { console.error("Error getting Render context:", e); throw e; }
            }

            const renderShapeX = shapePositionX * actualScaleFactorRender;
            const renderShapeY = shapePositionY * actualScaleFactorRender;
            const renderBaseSize = baseShapeSize * actualScaleFactorRender;
            const scaleFactorInteraction = Math.max(MIN_SCALE_FACTOR, currentDistance / MAX_DISTANCE_FOR_SCALE);
            const renderDrawSize = renderBaseSize * scaleFactorInteraction;
            finalScaleFactor = scaleFactorInteraction;
            finalShapeParams = {
                type: selectedShape,
                angle: currentAngle,
                baseSize: baseShapeSize,
                scaleFactor: scaleFactorInteraction,
                positionX: shapePositionX,
                positionY: shapePositionY
            };

            // --- Step 1 & 2: Draw Mask & Gradient on Render Canvas ---
            if(monitorStatus) monitorStatus.textContent = "Drawing gradient...";
            if(monitorStatus2) monitorStatus2.textContent = "Drawing gradient...";
            await new Promise(resolve => setTimeout(resolve, 10));

            renderCtx.clearRect(0, 0, actualRenderSize, actualRenderSize);
            renderCtx.globalAlpha = 1.0;
            drawShape(renderCtx, selectedShape, renderShapeX, renderShapeY, renderDrawSize, currentAngle, true, RENDER_MASK_COLOR);
            renderCtx.globalCompositeOperation = 'source-in';
            drawConicGradient(renderCanvas, renderCtx, null, p3ColorStrings, COLOR_SPACE, { x: actualRenderCenterX, y: actualRenderCenterY });
            renderCtx.globalCompositeOperation = 'source-over';

            // --- Step 3: Calculate Bounding Box on Render Canvas ---
            const bbox = getApproximateBoundingBox( selectedShape, renderShapeX, renderShapeY, renderDrawSize, currentAngle, actualRenderSize, actualRenderSize );
            console.log("Calculated Render BBox:", bbox);

            // --- CAPTURE RENDER PIXEL DATA ---
            if (bbox.width > 0 && bbox.height > 0) {
                 try {
                    renderImageDataForBank = renderCtx.getImageData(bbox.x, bbox.y, bbox.width, bbox.height);
                    console.log(`Captured render pixel data: ${renderImageDataForBank.width}x${renderImageDataForBank.height}`);
                 } catch (e) {
                     console.error("Error getting ImageData from render canvas:", e);
                     throw new Error("Failed to capture render pixel data.");
                 }
            } else {
                 console.warn("Render bounding box has zero width or height. Cannot capture pixel data.");
                 throw new Error("Render bounding box has zero size.");
            }

            // --- Initialize variables for sampling ---
            let sourcePixelColors = [];
            let validMonitorTargetCoords = [];
            let meanR = 0, meanG = 0, meanB = 0, meanA = 0;
            let stdDevR = 0, stdDevG = 0, stdDevB = 0;
            let monitorImageData = null; let monitorPixels = null;
            let monitorImageData2 = null; let monitorPixels2 = null;
            let numPixelsMonitor1 = 0;
            const numPixelsMonitor2Full = CANVAS_SIZE * CANVAS_SIZE;
            const monitorShapeX = shapePositionX;
            const monitorShapeY = shapePositionY;
            const monitorBaseSize = baseShapeSize;
            const monitorDrawSize = monitorBaseSize * scaleFactorInteraction;

            // --- Steps 4, 5, 6: Only if NOT Raw Sampling ---
            if (samplingMethod !== 'raw') {
                if(monitorStatus) monitorStatus.textContent = "Extracting source pixels...";
                if(monitorStatus2) monitorStatus2.textContent = "Extracting source pixels...";
                await new Promise(resolve => setTimeout(resolve, 10));

                // Step 4: Extract Source Colors
                if (!renderImageDataForBank) throw new Error("Cannot extract source colors, render pixel data missing.");
                const pixelsRender = renderImageDataForBank.data;
                const renderWidth = renderImageDataForBank.width;
                const renderHeight = renderImageDataForBank.height;
                for (let y = 0; y < renderHeight; y++) {
                    for (let x = 0; x < renderWidth; x++) {
                        const index = (y * renderWidth + x) * 4;
                        const a = pixelsRender[index + 3];
                        if (a > 0) { sourcePixelColors.push({ r: pixelsRender[index], g: pixelsRender[index + 1], b: pixelsRender[index + 2], a: a }); }
                    }
                }
                 if (sourcePixelColors.length === 0) { throw new Error("No source pixels found in shape (alpha > 0)."); }
                 console.log(`Extracted ${sourcePixelColors.length} source pixels.`);

                // Step 5: Identify Target Pixels
                if(monitorStatus) monitorStatus.textContent = "Identifying target shape pixels...";
                if(monitorStatus2) monitorStatus2.textContent = "Identifying target shape pixels...";
                await new Promise(resolve => setTimeout(resolve, 10));
                let pathCreated = false;
                monitorCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
                monitorCtx.beginPath();
                switch (selectedShape) {
                     case 'circle':   pathCreated = drawCirclePath(monitorCtx, monitorShapeX, monitorShapeY, monitorDrawSize); break;
                     case 'square':   pathCreated = drawSquarePath(monitorCtx, monitorShapeX, monitorShapeY, monitorDrawSize, currentAngle); break;
                     case 'triangle': pathCreated = drawTrianglePath(monitorCtx, monitorShapeX, monitorShapeY, monitorDrawSize, currentAngle); break;
                     case 'star':     pathCreated = drawStarPath(monitorCtx, monitorShapeX, monitorShapeY, monitorDrawSize, currentAngle); break;
                }
                if (pathCreated) {
                    for (let y = 0; y < CANVAS_SIZE; y++) {
                        for (let x = 0; x < CANVAS_SIZE; x++) {
                            if (monitorCtx.isPointInPath(x + 0.5, y + 0.5)) {
                                validMonitorTargetCoords.push({ x: x, y: y });
                            }
                        }
                    }
                }
                monitorCtx.beginPath(); // Clear the path
                 if (validMonitorTargetCoords.length === 0) { throw new Error("No target pixels found for shape on monitor."); }
                numPixelsMonitor1 = validMonitorTargetCoords.length;
                console.log(`Identified ${numPixelsMonitor1} target pixels on Monitor 1.`);

                // Step 6: Calculate Distribution Stats
                if (samplingMethod === 'distribution' || samplingMethod === 'pixel') {
                    let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
                    let sumSqR = 0, sumSqG = 0, sumSqB = 0;
                    const count = sourcePixelColors.length;
                    for (const color of sourcePixelColors) { sumR += color.r; sumG += color.g; sumB += color.b; sumA += color.a; sumSqR += color.r * color.r; sumSqG += color.g * color.g; sumSqB += color.b * color.b; }
                    meanR = sumR / count; meanG = sumG / count; meanB = sumB / count; meanA = sumA / count;
                    const varianceR = (sumSqR / count) - (meanR * meanR); const varianceG = (sumSqG / count) - (meanG * meanG); const varianceB = (sumSqB / count) - (meanB * meanB);
                    stdDevR = Math.sqrt(Math.max(0, varianceR)); stdDevG = Math.sqrt(Math.max(0, varianceG)); stdDevB = Math.sqrt(Math.max(0, varianceB));
                    finalDistribution = { meanR, stdDevR, meanG, stdDevG, meanB, stdDevB, meanA };
                    console.log(`Distribution: R(${meanR.toFixed(1)}±${stdDevR.toFixed(1)}), G(${meanG.toFixed(1)}±${stdDevG.toFixed(1)}), B(${meanB.toFixed(1)}±${stdDevB.toFixed(1)}), A(${meanA.toFixed(1)})`);
                 }

                 monitorImageData = monitorCtx.createImageData(CANVAS_SIZE, CANVAS_SIZE); monitorPixels = monitorImageData.data;
                 monitorImageData2 = monitorCtx2.createImageData(CANVAS_SIZE, CANVAS_SIZE); monitorPixels2 = monitorImageData2.data;
            }

            // --- Step 7: Clear Monitor Canvases ---
            monitorCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
            monitorCtx2.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

            // --- Step 8: Generate/Paint based on Sampling Method ---
            let monitor1StatusMsg = "N/A";
            let monitor2StatusMsg = "N/A";

            if (samplingMethod === 'pixel') {
                if(monitorStatus) monitorStatus.textContent = "Randomizing source pixels...";
                if(monitorStatus2) monitorStatus2.textContent = "Randomizing source pixels...";
                await new Promise(resolve => setTimeout(resolve, 10));
                shuffleArray(sourcePixelColors);

                // Paint Monitor 1
                if(monitorStatus) monitorStatus.textContent = "Painting Monitor 1 (Pixel)...";
                await new Promise(resolve => setTimeout(resolve, 10));
                for (let i = 0; i < numPixelsMonitor1; i++) { const targetCoord = validMonitorTargetCoords[i]; const colorIndex = i % sourcePixelColors.length; const shuffledColor = sourcePixelColors[colorIndex]; const monitorIndex = (targetCoord.y * CANVAS_SIZE + targetCoord.x) * 4; monitorPixels[monitorIndex] = shuffledColor.r; monitorPixels[monitorIndex + 1] = shuffledColor.g; monitorPixels[monitorIndex + 2] = shuffledColor.b; monitorPixels[monitorIndex + 3] = shuffledColor.a; }
                monitorCtx.putImageData(monitorImageData, 0, 0);
                monitor1StatusMsg = `Pixel sampling painted (${numPixelsMonitor1} pixels).`;
                if(monitorStatus) monitorStatus.textContent = monitor1StatusMsg;

                // Paint Monitor 2
                if(monitorStatus2) monitorStatus2.textContent = "Painting Monitor 2 (Pixel)...";
                await new Promise(resolve => setTimeout(resolve, 10));
                for (let i = 0; i < numPixelsMonitor2Full; i++) { const colorIndex = i % sourcePixelColors.length; const shuffledColor = sourcePixelColors[colorIndex]; const monitorIndex2 = i * 4; monitorPixels2[monitorIndex2] = shuffledColor.r; monitorPixels2[monitorIndex2 + 1] = shuffledColor.g; monitorPixels2[monitorIndex2 + 2] = shuffledColor.b; monitorPixels2[monitorIndex2 + 3] = shuffledColor.a; }
                monitorCtx2.putImageData(monitorImageData2, 0, 0);
                monitor2StatusMsg = `Pixel sampling painted (${numPixelsMonitor2Full} pixels).`;
                if(monitorStatus2) monitorStatus2.textContent = monitor2StatusMsg;

            } else if (samplingMethod === 'distribution') {
                if(monitorStatus) monitorStatus.textContent = "Generating distribution samples...";
                if(monitorStatus2) monitorStatus2.textContent = "Generating distribution samples...";
                await new Promise(resolve => setTimeout(resolve, 10));
                const distributionSampledColors = [];
                for (let i = 0; i < numPixelsMonitor2Full; i++) { const r = Math.max(0, Math.min(255, Math.round(meanR + stdDevR * gaussianRandom()))); const g = Math.max(0, Math.min(255, Math.round(meanG + stdDevG * gaussianRandom()))); const b = Math.max(0, Math.min(255, Math.round(meanB + stdDevB * gaussianRandom()))); const a = Math.max(0, Math.min(255, Math.round(meanA))); distributionSampledColors.push({ r, g, b, a }); }

                // Paint Monitor 1
                if(monitorStatus) monitorStatus.textContent = "Painting Monitor 1 (Distribution)...";
                await new Promise(resolve => setTimeout(resolve, 10));
                for (let i = 0; i < numPixelsMonitor1; i++) { const targetCoord = validMonitorTargetCoords[i]; const generatedColor = distributionSampledColors[i]; const monitorIndex = (targetCoord.y * CANVAS_SIZE + targetCoord.x) * 4; monitorPixels[monitorIndex] = generatedColor.r; monitorPixels[monitorIndex + 1] = generatedColor.g; monitorPixels[monitorIndex + 2] = generatedColor.b; monitorPixels[monitorIndex + 3] = generatedColor.a; }
                 monitorCtx.putImageData(monitorImageData, 0, 0);
                 monitor1StatusMsg = `Distribution sampling painted (${numPixelsMonitor1} pixels).`;
                 if(monitorStatus) monitorStatus.textContent = monitor1StatusMsg;

                // Paint Monitor 2
                if(monitorStatus2) monitorStatus2.textContent = "Painting Monitor 2 (Distribution)...";
                await new Promise(resolve => setTimeout(resolve, 10));
                 for (let i = 0; i < numPixelsMonitor2Full; i++) { const generatedColor = distributionSampledColors[i]; const monitorIndex2 = i * 4; monitorPixels2[monitorIndex2] = generatedColor.r; monitorPixels2[monitorIndex2 + 1] = generatedColor.g; monitorPixels2[monitorIndex2 + 2] = generatedColor.b; monitorPixels2[monitorIndex2 + 3] = generatedColor.a; }
                monitorCtx2.putImageData(monitorImageData2, 0, 0);
                monitor2StatusMsg = `Distribution sampling painted (${numPixelsMonitor2Full} pixels).`;
                if(monitorStatus2) monitorStatus2.textContent = monitor2StatusMsg;

            } else if (samplingMethod === 'raw') {
                // Paint Monitor 1
                if(monitorStatus) monitorStatus.textContent = "Painting Monitor 1 (Raw Gradient)...";
                await new Promise(resolve => setTimeout(resolve, 10));
                 if (renderImageDataForBank) {
                     const tempRenderCanvas = document.createElement('canvas');
                     tempRenderCanvas.width = renderImageDataForBank.width;
                     tempRenderCanvas.height = renderImageDataForBank.height;
                     const tempRenderCtx = tempRenderCanvas.getContext('2d');
                     if (tempRenderCtx) { // Check if context was obtained
                         tempRenderCtx.putImageData(renderImageDataForBank, 0, 0);
                         const monitorBBoxX = bbox.x / actualScaleFactorRender;
                         const monitorBBoxY = bbox.y / actualScaleFactorRender;
                         const monitorBBoxW = bbox.width / actualScaleFactorRender;
                         const monitorBBoxH = bbox.height / actualScaleFactorRender;
                         monitorCtx.drawImage(tempRenderCanvas, 0, 0, tempRenderCanvas.width, tempRenderCanvas.height, monitorBBoxX, monitorBBoxY, monitorBBoxW, monitorBBoxH);
                         monitor1StatusMsg = `Raw gradient drawn (from ${bbox.width}x${bbox.height} source).`;
                     } else {
                         monitor1StatusMsg = `Raw gradient draw failed (temp context error).`;
                     }
                 } else {
                      monitor1StatusMsg = `Raw gradient draw failed (no source data).`;
                 }
                if(monitorStatus) monitorStatus.textContent = monitor1StatusMsg;


                // Paint Monitor 2
                if(monitorStatus2) monitorStatus2.textContent = "Painting Monitor 2 (Tiled Raw)...";
                await new Promise(resolve => setTimeout(resolve, 10));
                const monitorBBox = getApproximateBoundingBox( selectedShape, monitorShapeX, monitorShapeY, monitorDrawSize, currentAngle, CANVAS_SIZE, CANVAS_SIZE );
                const strideX = Math.max(1, Math.floor(monitorBBox.width / 4));
                const strideY = Math.max(1, Math.floor(monitorBBox.height / 4));
                const offsetX = monitorBBox.width / 4;
                const offsetY = monitorBBox.height / 4;
                const tilingLimit = CANVAS_SIZE * TILING_AREA_SCALE_FACTOR;
                console.log(`Monitor BBox for Tiling: ${JSON.stringify(monitorBBox)}, StrideX: ${strideX}, StrideY: ${strideY}, OffsetX: ${offsetX.toFixed(1)}, OffsetY: ${offsetY.toFixed(1)}`);

                if (renderImageDataForBank && monitorBBox.width > 0 && monitorBBox.height > 0) {
                    const tempShapeCanvas = document.createElement('canvas');
                    tempShapeCanvas.width = monitorBBox.width;
                    tempShapeCanvas.height = monitorBBox.height;
                    const tempShapeCtx = tempShapeCanvas.getContext('2d', { colorSpace: COLOR_SPACE });

                    const tempRenderSourceCanvas = document.createElement('canvas');
                    tempRenderSourceCanvas.width = renderImageDataForBank.width;
                    tempRenderSourceCanvas.height = renderImageDataForBank.height;
                    const tempRenderSourceCtx = tempRenderSourceCanvas.getContext('2d');

                    if (tempShapeCtx && tempRenderSourceCtx) { // Check contexts
                        tempRenderSourceCtx.putImageData(renderImageDataForBank, 0, 0);
                        tempShapeCtx.drawImage(tempRenderSourceCanvas, 0, 0, renderImageDataForBank.width, renderImageDataForBank.height, 0, 0, monitorBBox.width, monitorBBox.height);

                        monitorCtx2.globalAlpha = 1.0;
                        for (let y = -offsetY; y < tilingLimit; y += strideY) {
                            for (let x = -offsetX; x < tilingLimit; x += strideX) {
                                const tileAngle = (x + y) * 0.005;
                                const tileAlpha = Math.max(0.1, Math.min(0.9, 0.5 + (Math.random() - 0.5) * 0.8));
                                monitorCtx2.save();
                                const centerX = x + monitorBBox.width / 2;
                                const centerY = y + monitorBBox.height / 2;
                                monitorCtx2.translate(centerX, centerY);
                                monitorCtx2.rotate(tileAngle);
                                monitorCtx2.globalAlpha = tileAlpha;
                                monitorCtx2.drawImage(tempShapeCanvas, -monitorBBox.width / 2, -monitorBBox.height / 2);
                                monitorCtx2.restore();
                            }
                        }
                        monitor2StatusMsg = `Raw gradient tiled (stride: ${strideX}x${strideY}, rotated, varied opacity).`;
                    } else {
                         monitor2StatusMsg = `Error creating tile source (temp context error).`;
                    }
                    if(monitorStatus2) monitorStatus2.textContent = monitor2StatusMsg;
                } else {
                     monitor2StatusMsg = `Error creating tile source or zero dimensions.`;
                     if(monitorStatus2) monitorStatus2.textContent = monitor2StatusMsg;
                     console.error("Failed to create or draw on tempShapeCanvas for tiling, source data missing, or dimensions were zero.");
                }
            }

            // --- CAPTURE MONITOR 2 PIXEL DATA ---
            try {
                paintImageDataForBank = monitorCtx2.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
                console.log(`Captured paint pixel data: ${paintImageDataForBank.width}x${paintImageDataForBank.height}`);
            } catch (e) {
                console.error("Error getting ImageData from monitor 2 canvas:", e);
                throw new Error("Failed to capture paint pixel data.");
            }


            // --- ADD RECORD TO MEMORY BANK ---
            if (typeof memoryBank !== 'undefined' && memoryBank.addRecord && renderImageDataForBank && paintImageDataForBank) {
                if(monitorStatus) monitorStatus.textContent = "Saving record...";
                if(monitorStatus2) monitorStatus2.textContent = "Saving record...";
                await new Promise(resolve => setTimeout(resolve, 10));

                const recordData = {
                    distribution: finalDistribution,
                    shape: finalShapeParams,
                    category: [selectedShape],
                    sampling: samplingMethod,
                    scale: renderScaleMultiple,
                    renderPixelData: renderImageDataForBank.data.buffer.slice(0),
                    renderWidth: renderImageDataForBank.width,
                    renderHeight: renderImageDataForBank.height,
                    paintPixelData: paintImageDataForBank.data.buffer.slice(0),
                    paintWidth: paintImageDataForBank.width,
                    paintHeight: paintImageDataForBank.height,
                    saveState: false,
                };
                const newRecordMetadata = await memoryBank.addRecord(recordData);
                if (newRecordMetadata) {
                     console.log("--- Memory Bank Add Result ---");
                     console.log("Successfully added record metadata:", newRecordMetadata);
                     console.log("Current total records:", memoryBank.getAllRecords().length);
                     console.log("-----------------------------");
                     if(monitorStatus) monitorStatus.textContent = monitor1StatusMsg + " | Record saved.";
                     if(monitorStatus2) monitorStatus2.textContent = monitor2StatusMsg + " | Record saved.";
                }
                else {
                     console.error("!!! FAILED to add record to memory bank (check console for details).");
                     if(monitorStatus) monitorStatus.textContent = monitor1StatusMsg + " | Save FAILED.";
                     if(monitorStatus2) monitorStatus2.textContent = monitor2StatusMsg + " | Save FAILED.";
                }
            } else {
                const reason = typeof memoryBank === 'undefined' ? "memoryBank module not found" : (!renderImageDataForBank || !paintImageDataForBank ? "pixel data capture failed" : "addRecord function missing");
                console.warn(`Record not saved: ${reason}.`);
                 if(monitorStatus) monitorStatus.textContent = monitor1StatusMsg + " | Not saved.";
                 if(monitorStatus2) monitorStatus2.textContent = monitor2StatusMsg + " | Not saved.";
            }

        } catch (error) {
            console.error("Rendering or Saving failed:", error);
            const errorMsg = `Error: ${error.message}`;
            if(monitorStatus) monitorStatus.textContent = errorMsg;
            if(monitorStatus2) monitorStatus2.textContent = errorMsg;
        } finally {
            console.timeEnd("RenderAndDisplay");
            isRendering = false;
            // Re-enable render button ONLY if permission is still granted
            if(renderButton && typeof memoryBank !== 'undefined' && memoryBank.hasDirectoryPermission && memoryBank.hasDirectoryPermission()) {
                 renderButton.disabled = false;
            }
            requestDraw(); // Redraw UI overlays etc.
        }
    }


    // --- Attach Event Listeners ---
    function setupDragListeners(canvas, interactionHandler, draggingFlagSetter) {
        if (!canvas) return; let isActive = false;
        const startInteraction = (e) => { e.preventDefault(); isActive = true; draggingFlagSetter(true); canvas.style.cursor = 'grabbing'; interactionHandler(e); };
        const moveInteraction = (e) => { if (isActive) { e.preventDefault(); interactionHandler(e); } };
        const endInteraction = (e) => { if (isActive) { isActive = false; draggingFlagSetter(false); canvas.style.cursor = 'crosshair'; } };
        canvas.addEventListener('mousedown', startInteraction); canvas.addEventListener('touchstart', startInteraction, { passive: false });
        document.addEventListener('mousemove', moveInteraction); document.addEventListener('touchmove', moveInteraction, { passive: false });
        document.addEventListener('mouseup', endInteraction); document.addEventListener('touchend', endInteraction, { passive: false });
    }
    setupDragListeners(angleScaleCanvas, handleAngleScaleInteraction, (val) => { if (typeof val === 'boolean') isDraggingAngleScale = val; });
    setupDragListeners(positionCanvas, handlePositionInteraction, (val) => { if (typeof val === 'boolean') isDraggingPosition = val; });
    shapeForm?.addEventListener('input', handleShapeFormInput);
    angleScaleForm?.addEventListener('input', handleAngleScaleFormInput);
    positionForm?.addEventListener('input', handlePositionFormInput);
    samplingForm?.addEventListener('input', handleSamplingFormInput);
    renderButton?.addEventListener('click', renderAndDisplay);
    permissionButton?.addEventListener('click', requestFsaPermission);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !isRendering && renderButton && !renderButton.disabled) {
            const activeElement = document.activeElement;
            const isFormElement = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'BUTTON' || activeElement.tagName === 'SELECT' || activeElement.tagName === 'TEXTAREA');
            if ((!isFormElement || activeElement === renderButton) && activeElement !== permissionButton) {
                 event.preventDefault();
                 console.log("Enter key pressed, triggering render...");
                 renderAndDisplay();
             }
        }
    });


    // --- Initial State ---
    drawP3GradientSource();
    if (shapeTypeRadios) shapeTypeRadios.value = selectedShape;
    if (shapeSizeSlider) shapeSizeSlider.value = baseShapeSize;
    if (angleSlider) angleSlider.value = (currentAngle / (2 * Math.PI)) % 1;
    if (distanceSlider) distanceSlider.value = Math.max(0, Math.min(1, currentDistance / MAX_DISTANCE_FOR_SCALE));
    if (xSlider) xSlider.value = shapePositionX;
    if (ySlider) ySlider.value = shapePositionY;
    if (samplingMethodRadios) samplingMethodRadios.value = samplingMethod;
    if (renderScaleSlider) renderScaleSlider.value = renderScaleMultiple;
    if (renderScaleValueSpan) renderScaleValueSpan.textContent = `${renderScaleMultiple.toFixed(1)}x`;

    // --- Initialize Permission and UI ---
    if (permissionStatus) permissionStatus.textContent = "Checking stored permission..."; // Initial status
    if (typeof memoryBank !== 'undefined' && memoryBank.tryInitializePermission) {
        try {
            const initSuccess = await memoryBank.tryInitializePermission(); // Await the async check
            if (initSuccess) {
                console.log("Permission successfully initialized from storage.");
            } else {
                console.log("Permission not initialized from storage (requires user grant).");
            }
        } catch (initError) {
             console.error("Error during permission initialization:", initError);
             if (permissionStatus) permissionStatus.textContent = "Error initializing permission.";
        }
    } else {
         console.error("memoryBank or tryInitializePermission not available for initialization.");
         if (permissionStatus) permissionStatus.textContent = "Error: memoryBank module failed.";
    }
    updatePermissionUI(); // Update button states etc. based on initialization result
    requestDraw(); // Initial draw of interactive elements

}; // End window.onload

// --- END OF CORRECTED FILE script.js ---
