// --- START OF CORRECTED FILE paintUI.js ---

(() => { // IIFE to encapsulate scope
    // --- Elements ---
    const paintCanvasElement = document.getElementById('paintCanvas');
    const paintBackgroundCanvas = document.getElementById('paintBackgroundCanvas');
    const paintStatusElement = document.getElementById('paintStatus');
    const paintControlsForm = document.getElementById('paintControlsForm');
    // Canvas Setup Inputs
    const paintCanvasWidthInput = document.getElementById('paintCanvasWidthInput');
    const paintCanvasHeightInput = document.getElementById('paintCanvasHeightInput');
    const paintBackgroundColorRadios = paintControlsForm?.elements['paintBackgroundColor'];
    const createCanvasButton = document.getElementById('createCanvasButton');
    // Paint Method Inputs
    const paintMethodRadios = paintControlsForm?.elements['paintMethod'];
    const paintMasterScaleSlider = document.getElementById('paintMasterScaleSlider');
    const paintMasterScaleValue = document.getElementById('paintMasterScaleValue');
    // Stamp Drag Scaling Inputs
    const paintMinDragScaleSlider = document.getElementById('paintMinDragScaleSlider');
    const paintMinDragScaleValue = document.getElementById('paintMinDragScaleValue');
    const paintMaxDragScaleSlider = document.getElementById('paintMaxDragScaleSlider');
    const paintMaxDragScaleValue = document.getElementById('paintMaxDragScaleValue');
    const paintMinDragDistSlider = document.getElementById('paintMinDragDistSlider');
    const paintMinDragDistValue = document.getElementById('paintMinDragDistValue');
    const paintMaxDragDistSlider = document.getElementById('paintMaxDragDistSlider');
    const paintMaxDragDistValue = document.getElementById('paintMaxDragDistValue');
    // Alpha Modulation Inputs (Mean/StdDev)
    const paintAlphaMeanSlider = document.getElementById('paintMinAlphaSlider'); // Assumes ID hasn't changed
    const paintAlphaMeanValue = document.getElementById('paintMinAlphaValue');
    const paintAlphaStdDevSlider = document.getElementById('paintMaxAlphaSlider'); // Assumes ID hasn't changed
    const paintAlphaStdDevValue = document.getElementById('paintMaxAlphaValue');
    const alphaOverrideCheckbox = document.getElementById('alphaOverrideCheckbox');
    // Raw Sampling Inputs
    const paintMasterOpacitySlider = document.getElementById('paintMasterOpacitySlider');
    const paintMasterOpacityValue = document.getElementById('paintMasterOpacityValue');
    const paintTileRotationSlider = document.getElementById('paintTileRotationSlider');
    const paintTileRotationValue = document.getElementById('paintTileRotationValue');
    const paintXStrideFactorSlider = document.getElementById('paintXStrideFactorSlider');
    const paintXStrideFactorValue = document.getElementById('paintXStrideFactorValue');
    const paintYStrideFactorSlider = document.getElementById('paintYStrideFactorSlider');
    const paintYStrideFactorValue = document.getElementById('paintYStrideFactorValue');
    const paintCompoundAngleCheckbox = document.getElementById('paintCompoundAngleCheckbox');
    // Export Inputs
    const exportBackgroundRadios = paintControlsForm?.elements['exportBackground'];
    const exportFormatRadios = paintControlsForm?.elements['exportFormat'];
    const jpgQualityGroup = document.getElementById('jpgQualityGroup');
    const jpgQualitySlider = document.getElementById('jpgQualitySlider');
    const jpgQualityValue = document.getElementById('jpgQualityValue');
    const exportCanvasButton = document.getElementById('exportCanvasButton');
    const copyCanvasButton = document.getElementById('copyCanvasButton');

    // --- Basic Checks ---
    if (!paintCanvasElement || !paintBackgroundCanvas || !paintStatusElement || !paintControlsForm || !createCanvasButton || !exportCanvasButton || !copyCanvasButton || !alphaOverrideCheckbox) {
        console.error("Paint UI critical elements not found!");
        if (paintStatusElement) paintStatusElement.textContent = "Error: Critical Paint UI elements missing.";
        return; // Stop execution if essential elements are missing
    }

    // --- Contexts ---
    let paintCtx = null;
    let paintBgCtx = null;
    const contextOptionsP3 = { colorSpace: 'display-p3', willReadFrequently: true };
    const contextOptionsDefault = { willReadFrequently: true };
    const contextOptionsBg = { alpha: false }; // Background doesn't need alpha

    try {
        paintCtx = paintCanvasElement.getContext('2d', contextOptionsP3);
        paintBgCtx = paintBackgroundCanvas.getContext('2d', contextOptionsBg);
    } catch (e) {
        console.warn("Could not get display-p3 context for paint canvas, falling back.", e);
        try {
            paintCtx = paintCanvasElement.getContext('2d', contextOptionsDefault);
            if (!paintBgCtx) { paintBgCtx = paintBackgroundCanvas.getContext('2d', contextOptionsBg); }
        } catch (e2) {
            console.error("Failed to get any 2D context for paint canvas:", e2);
            if (paintStatusElement) paintStatusElement.textContent = "Error: Canvas context not supported.";
        }
    }
     if (!paintBgCtx) {
        try { paintBgCtx = paintBackgroundCanvas.getContext('2d', contextOptionsBg); }
        catch (e) { console.error("Failed to get background canvas context:", e); }
    }


    // --- State ---
    let latestRecordCache = null;
    const defaultDistribution = { meanR: 127, stdDevR: 25, meanG: 127, stdDevG: 25, meanB: 127, stdDevB: 25, meanA: 255 };
    const defaultShape = { type: 'circle', baseSize: 80, scaleFactor: 1.0, angle: 0 };
    const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;
    const STAR_POINTS = 5;
    const STAR_INNER_RADIUS_RATIO = 0.45;

    // --- Paint Parameters State ---
    let paintCanvasWidth = 700;
    let paintCanvasHeight = 700;
    let paintBackgroundColor = '#ffffff';
    let paintMethod = 'stamp';
    let masterScaleFactor = 0.5;
    let minDragScale = 0.75;
    let maxDragScale = 2.5;
    let minDragDistance = 1;
    let maxDragDistance = 50;
    let alphaMeanMod = 255;
    let alphaStdDevMod = 0;
    let alphaOverrideEnabled = false;
    let masterOpacity = 1.0;
    let tileRotationFactor = 0.05;
    let xStrideFactor = 0.25;
    let yStrideFactor = 0.25;
    let useCompoundAngle = false;
    let exportBackgroundColor = 'transparent';
    let exportFormat = 'png';
    let jpgQuality = 0.92;

    // --- Drag State ---
    let isDragging = false;
    let dragPath = []; // Stores {x, y, timestamp}
    let lastDragPoint = null; // Stores the previous point during drag move
    let isPotentialFillClick = false; // Flag for fill mode click detection

    // --- Constants ---
    const MIN_STAMP_SIZE = 5;
    const MAX_STAMP_SIZE = 200; // Prevent excessively large stamps
    const TILE_ANGLE_SENSITIVITY = 0.005; // Adjust this to control rotation speed based on position
    const BBOX_PADDING_FACTOR = 1.4; // Increased padding

    // --- Temporary Canvases ---
    const tempSourceCanvas = document.createElement('canvas'); // For raw source (original alpha)
    let tempSourceCtx = null;
    const tempExportCanvas = document.createElement('canvas'); // For export compositing
    let tempExportCtx = null;
    const tempPatternCanvas = document.createElement('canvas'); // For distribution/pixel/raw pattern generation
    let tempPatternCtx = null;

    // --- Gaussian Random Variable ---
    let spareGaussian = null;

    // --- Helper Functions ---
    function gaussianRandom() { let u, v, s; if (spareGaussian !== null) { const temp = spareGaussian; spareGaussian = null; return temp; } do { u = Math.random() * 2 - 1; v = Math.random() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0); s = Math.sqrt(-2.0 * Math.log(s) / s); spareGaussian = v * s; return u * s; }
    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
    function mapValue(value, inMin, inMax, outMin, outMax) { const clampedValue = clamp(value, inMin, inMax); const proportion = (clampedValue - inMin) / (inMax - inMin); return outMin + proportion * (outMax - outMin); }
    function shuffleArray(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } }
    function sampleAlphaUsingSliders() { let sampledAlpha = alphaMeanMod + alphaStdDevMod * gaussianRandom(); return clamp(Math.round(sampledAlpha), 0, 255); }
    function finalizeAlpha(baseAlphaValue) { let alpha = alphaOverrideEnabled ? 255 : baseAlphaValue; const clampedMasterOpacity = clamp(masterOpacity, 0.0, 1.0); alpha = Math.round(alpha * clampedMasterOpacity); return clamp(alpha, 0, 255); }
    function generateColorObjectFromDistribution(dist) { const meanR = dist?.meanR ?? defaultDistribution.meanR; const stdDevR = dist?.stdDevR ?? defaultDistribution.stdDevR; const meanG = dist?.meanG ?? defaultDistribution.meanG; const stdDevG = dist?.stdDevG ?? defaultDistribution.stdDevG; const meanB = dist?.meanB ?? defaultDistribution.meanB; const stdDevB = dist?.stdDevB ?? defaultDistribution.stdDevB; const r = clamp(Math.round(meanR + stdDevR * gaussianRandom()), 0, 255); const g = clamp(Math.round(meanG + stdDevG * gaussianRandom()), 0, 255); const b = clamp(Math.round(meanB + stdDevB * gaussianRandom()), 0, 255); const a = sampleAlphaUsingSliders(); return { r, g, b, a }; }
    function drawCirclePath(ctx, centerX, centerY, radius) { if (!ctx || radius <= 0) return false; ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI); return true; }
    function drawSquarePath(ctx, centerX, centerY, sideLength, angleRad) { if (!ctx || sideLength <= 0) return false; const halfSide = sideLength / 2; const points = [ { x: -halfSide, y: -halfSide }, { x: halfSide, y: -halfSide }, { x: halfSide, y: halfSide }, { x: -halfSide, y: halfSide } ]; ctx.beginPath(); points.forEach((p, index) => { const rotatedX = p.x * Math.cos(angleRad) - p.y * Math.sin(angleRad); const rotatedY = p.x * Math.sin(angleRad) + p.y * Math.cos(angleRad); const finalX = centerX + rotatedX; const finalY = centerY + rotatedY; if (index === 0) ctx.moveTo(finalX, finalY); else ctx.lineTo(finalX, finalY); }); ctx.closePath(); return true; }
    function drawTrianglePath(ctx, centerX, centerY, sizeLongSide, angleRad) { if (!ctx || sizeLongSide <= 0) return false; const S = sizeLongSide; const base = S / GOLDEN_RATIO; const h_squared = S**2 - (base/2)**2; if (h_squared <= 0) return false; const h = Math.sqrt(h_squared); const apexY = -(2 * h / 3); const baseY = h / 3; const halfBase = base / 2; const points = [ { x: 0, y: apexY }, { x: -halfBase, y: baseY }, { x: halfBase, y: baseY } ]; ctx.beginPath(); points.forEach((p, index) => { const rotatedX = p.x * Math.cos(angleRad) - p.y * Math.sin(angleRad); const rotatedY = p.x * Math.sin(angleRad) + p.y * Math.cos(angleRad); const finalX = centerX + rotatedX; const finalY = centerY + rotatedY; if (index === 0) ctx.moveTo(finalX, finalY); else ctx.lineTo(finalX, finalY); }); ctx.closePath(); return true; }
    function drawStarPath(ctx, centerX, centerY, outerRadius, angleRad) { if (!ctx || outerRadius <= 0) return false; const innerRadius = outerRadius * STAR_INNER_RADIUS_RATIO; const angleStep = Math.PI / STAR_POINTS; const startAngleOffset = angleRad - Math.PI / 2; ctx.beginPath(); for (let i = 0; i < 2 * STAR_POINTS; i++) { const radius = (i % 2 === 0) ? outerRadius : innerRadius; const currentAngle = startAngleOffset + i * angleStep; const x = centerX + radius * Math.cos(currentAngle); const y = centerY + radius * Math.sin(currentAngle); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); return true; }
    function getApproximatePaintBoundingBox(shapeType, centerX, centerY, size, angleRad, canvasWidth, canvasHeight) { let maxExtent = 0; switch (shapeType) { case 'circle': maxExtent = size; break; case 'square': maxExtent = size * Math.sqrt(2) / 2; break; case 'triangle': maxExtent = size; break; case 'star': maxExtent = size; break; default: maxExtent = size; } maxExtent *= BBOX_PADDING_FACTOR; let minX = Math.floor(centerX - maxExtent); let minY = Math.floor(centerY - maxExtent); let maxX = Math.ceil(centerX + maxExtent); let maxY = Math.ceil(centerY + maxExtent); minX = Math.max(0, minX); minY = Math.max(0, minY); maxX = Math.min(canvasWidth, maxX); maxY = Math.min(canvasHeight, maxY); const width = Math.max(1, maxX - minX); const height = Math.max(1, maxY - minY); if (width <= 0 || height <= 0 || isNaN(width) || isNaN(height)) { console.error("Invalid bounding box calculated:", { shapeType, centerX, centerY, size, angleRad, minX, minY, maxX, maxY, width, height }); return null; } return { x: minX, y: minY, width: width, height: height }; }
    function getPointerCoords(event, canvas) { if (!canvas) return null; const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height; const canvasX = (event.clientX - rect.left) * scaleX; const canvasY = (event.clientY - rect.top) * scaleY; const clampedX = Math.max(0, Math.min(canvas.width, canvasX)); const clampedY = Math.max(0, Math.min(canvas.height, canvasY)); return { x: clampedX, y: clampedY }; }
    function fetchLatestRecord() { if (typeof memoryBank === 'undefined' || !memoryBank.getAllRecords) { console.warn("memoryBank not available to fetch latest record."); latestRecordCache = null; return null; } try { const allRecords = memoryBank.getAllRecords(); if (allRecords && allRecords.length > 0) { for (let i = allRecords.length - 1; i >= 0; i--) { const record = allRecords[i]; if (record && record.shape && record.shape.type && (record.distribution || record.sampling === 'raw' || record.sampling === 'pixel')) { latestRecordCache = record; return record; } } latestRecordCache = null; return null; } else { latestRecordCache = null; return null; } } catch (error) { console.error("Error fetching records from memoryBank:", error); latestRecordCache = null; return null; } }

    // --- REVISED: Stamping Function (Unified Approach) ---
    async function stampShapeAtPoint(centerX, centerY, shapeType, samplingMethod, recordData, baseSize, angle) {
        if (!paintCtx) {
            console.error("Paint context not available for stamping.");
            return;
        }

        // Determine final size based on shape type for drawing functions
        let drawSize = clamp(baseSize * masterScaleFactor, MIN_STAMP_SIZE, MAX_STAMP_SIZE);
        let sizeForBBox = drawSize; // Size used for bounding box calculation
        let sizeParamForPath = drawSize; // Size to pass to path function
        switch (shapeType) {
            case 'square': sizeForBBox = drawSize / Math.sqrt(2); sizeParamForPath = drawSize; break;
            case 'triangle': sizeForBBox = drawSize; sizeParamForPath = drawSize; break;
        }

        // Calculate bounding box based on the *final* position and angle
        const bbox = getApproximatePaintBoundingBox(
            shapeType, centerX, centerY, sizeForBBox, angle,
            paintCanvasElement.width, paintCanvasElement.height
        );
        if (!bbox) { console.error("Failed bbox calc for stamp"); return; }

        try {
            // --- Prepare tempPatternCanvas ---
            if (tempPatternCanvas.width !== bbox.width || tempPatternCanvas.height !== bbox.height || !tempPatternCtx) {
                tempPatternCanvas.width = bbox.width;
                tempPatternCanvas.height = bbox.height;
                try { tempPatternCtx = tempPatternCanvas.getContext('2d', { ...contextOptionsP3, alpha: true }); }
                catch(e) { tempPatternCtx = tempPatternCanvas.getContext('2d', { ...contextOptionsDefault, alpha: true }); }
                if (!tempPatternCtx) { throw new Error("Failed to get context for temp pattern canvas."); }
            } else {
                tempPatternCtx.clearRect(0, 0, bbox.width, bbox.height);
            }

            const tempImageData = tempPatternCtx.createImageData(bbox.width, bbox.height);
            const tempPixels = tempImageData.data;
            const tempCenterX = bbox.width / 2;
            const tempCenterY = bbox.height / 2;

            // --- Define shape path on tempPatternCanvas (unrotated) ---
            let pathCreated = false;
            switch (shapeType) {
                 case 'circle':   pathCreated = drawCirclePath(tempPatternCtx, tempCenterX, tempCenterY, sizeParamForPath); break;
                 case 'square':   pathCreated = drawSquarePath(tempPatternCtx, tempCenterX, tempCenterY, sizeParamForPath, 0); break;
                 case 'triangle': pathCreated = drawTrianglePath(tempPatternCtx, tempCenterX, tempCenterY, sizeParamForPath, 0); break;
                 case 'star':     pathCreated = drawStarPath(tempPatternCtx, tempCenterX, tempCenterY, sizeParamForPath, 0); break;
            }
            if (!pathCreated) { throw new Error(`Failed to create path for ${shapeType} on temp canvas.`); }

            // --- Generate Pixel Data for the temp canvas based on method ---
            let sourceColors = null; // For pixel sampling
            let pixelCounter = 0;
            let rawSourceImageData = null; // For raw sampling source pixels

            // --- RAW GRADIENT Pattern Generation ---
            if (samplingMethod === 'raw' && recordData?.id && memoryBank?.getPixelData) {
                const pixelDataResult = await memoryBank.getPixelData(recordData.id, 'render');
                if (!pixelDataResult?.arrayBuffer || pixelDataResult.width <= 0 || pixelDataResult.height <= 0) {
                    throw new Error("Invalid raw pixel data fetched for pattern generation.");
                }
                const { arrayBuffer, width: sourceW, height: sourceH } = pixelDataResult;

                // Put original raw data onto tempSourceCanvas
                if (tempSourceCanvas.width !== sourceW || tempSourceCanvas.height !== sourceH || !tempSourceCtx) {
                    tempSourceCanvas.width = sourceW; tempSourceCanvas.height = sourceH;
                    tempSourceCtx = tempSourceCanvas.getContext('2d', { colorSpace: contextOptionsP3.colorSpace, willReadFrequently: true, alpha: true });
                    if (!tempSourceCtx) throw new Error("Failed temp source ctx");
                }
                const rawSrcImgData = new ImageData(new Uint8ClampedArray(arrayBuffer), sourceW, sourceH);
                tempSourceCtx.putImageData(rawSrcImgData, 0, 0);

                // Draw the source image onto the tempPatternCanvas, clipped and centered
                tempPatternCtx.save();
                tempPatternCtx.clip(); // Clip to the shape path defined above
                const sourceAspectRatio = sourceW / sourceH;
                let dWidth, dHeight;
                if (sourceAspectRatio >= 1) { dWidth = sizeForBBox * 2; dHeight = dWidth / sourceAspectRatio; }
                else { dHeight = sizeForBBox * 2; dWidth = dHeight * sourceAspectRatio; }
                tempPatternCtx.drawImage(tempSourceCanvas, 0, 0, sourceW, sourceH, tempCenterX - dWidth / 2, tempCenterY - dHeight / 2, dWidth, dHeight);
                tempPatternCtx.restore();

                // Get the pixels that were actually drawn within the clip
                const drawnPixels = tempPatternCtx.getImageData(0, 0, bbox.width, bbox.height).data;

                // Iterate and apply sampled/finalized alpha to the tempImageData
                for (let i = 0; i < tempPixels.length; i += 4) {
                    if (drawnPixels[i + 3] > 0) { // If pixel was part of the drawn raw image
                        const baseAlpha = sampleAlphaUsingSliders(); // Sample new alpha
                        const finalAlpha = finalizeAlpha(baseAlpha); // Apply override & opacity
                        tempPixels[i] = drawnPixels[i];     // R
                        tempPixels[i + 1] = drawnPixels[i + 1]; // G
                        tempPixels[i + 2] = drawnPixels[i + 2]; // B
                        tempPixels[i + 3] = finalAlpha;       // Final Alpha
                    }
                }
                tempPatternCtx.beginPath(); // Clear path after use
                tempPatternCtx.putImageData(tempImageData, 0, 0); // Put modified data back

            }
            // --- PIXEL SAMPLING Pattern Generation ---
            else if (samplingMethod === 'pixel' && recordData?.id && memoryBank?.getPixelData) {
                try {
                    const pixelDataResult = await memoryBank.getPixelData(recordData.id, 'render');
                    if (pixelDataResult?.arrayBuffer) {
                        const sourcePixels = new Uint8ClampedArray(pixelDataResult.arrayBuffer);
                        const numSourcePixels = pixelDataResult.width * pixelDataResult.height;
                        sourceColors = [];
                        for (let i = 0; i < numSourcePixels; i++) {
                            const index = i * 4; if (sourcePixels[index + 3] > 0) {
                                sourceColors.push({ r: sourcePixels[index], g: sourcePixels[index + 1], b: sourcePixels[index + 2], a: sourcePixels[index + 3] });
                            }
                        }
                        if (sourceColors.length > 0) { shuffleArray(sourceColors); }
                        else { throw new Error("No source pixels found"); } // Force fallback
                    } else { throw new Error("Could not retrieve valid render pixel data"); }
                } catch (fetchError){
                    console.warn(`Pixel sampling failed: ${fetchError.message}. Falling back to distribution.`);
                    samplingMethod = 'distribution'; // Fallback
                    sourceColors = null;
                    if (!recordData?.distribution) recordData = null; // Use default dist if needed
                }

                // Fill tempImageData (either with pixel or distribution data now)
                const distribution = (recordData && recordData.distribution) ? recordData.distribution : defaultDistribution;
                for (let y = 0; y < bbox.height; y++) {
                    for (let x = 0; x < bbox.width; x++) {
                        if (tempPatternCtx.isPointInPath(x + 0.5, y + 0.5)) {
                            let r, g, b, baseAlpha;
                            if (samplingMethod === 'pixel' && sourceColors) { // Check again in case of fallback
                                const color = sourceColors[pixelCounter % sourceColors.length];
                                r = color.r; g = color.g; b = color.b;
                                baseAlpha = color.a; // Use original alpha from source pixel
                                pixelCounter++;
                            } else { // Distribution
                                const color = generateColorObjectFromDistribution(distribution);
                                r = color.r; g = color.g; b = color.b;
                                baseAlpha = color.a; // Use sampled alpha
                            }
                            const finalAlpha = finalizeAlpha(baseAlpha);
                            const index = (y * bbox.width + x) * 4;
                            tempPixels[index] = r; tempPixels[index + 1] = g; tempPixels[index + 2] = b; tempPixels[index + 3] = finalAlpha;
                        }
                    }
                }
                tempPatternCtx.beginPath(); // Clear the path on temp context
                tempPatternCtx.putImageData(tempImageData, 0, 0); // Put the final pattern onto the temporary canvas
            }
            // --- DISTRIBUTION SAMPLING Pattern Generation ---
            else { // Default to distribution if not raw or pixel (or if they failed)
                const distribution = (recordData && recordData.distribution) ? recordData.distribution : defaultDistribution;
                for (let y = 0; y < bbox.height; y++) {
                    for (let x = 0; x < bbox.width; x++) {
                        if (tempPatternCtx.isPointInPath(x + 0.5, y + 0.5)) {
                            const color = generateColorObjectFromDistribution(distribution);
                            const finalAlpha = finalizeAlpha(color.a);
                            const index = (y * bbox.width + x) * 4;
                            tempPixels[index] = color.r; tempPixels[index + 1] = color.g; tempPixels[index + 2] = color.b; tempPixels[index + 3] = finalAlpha;
                        }
                    }
                }
                tempPatternCtx.beginPath(); // Clear the path on temp context
                tempPatternCtx.putImageData(tempImageData, 0, 0); // Put the final pattern onto the temporary canvas
            }


            // --- Draw the final pattern onto the main canvas ---
            paintCtx.save();
            paintCtx.translate(centerX, centerY); // Translate to final position
            paintCtx.rotate(angle); // Rotate the main context
            // Draw temp canvas centered at the new origin (0,0 after translate)
            paintCtx.drawImage(tempPatternCanvas, -bbox.width / 2, -bbox.height / 2);
            paintCtx.restore(); // Resets transform and globalAlpha

        } catch (error) {
            console.error(`Error during stamping shape ${shapeType} with method ${samplingMethod}:`, error);
            // Ensure context state is clean even on error
            tempPatternCtx?.beginPath();
            try { paintCtx.restore(); } catch(e) {} // Attempt restore
        }
    }


    // --- Process Drag Path (Passes correct angle for single click) ---
    async function processDragPath() {
        if (!dragPath || dragPath.length < 1) {
            dragPath = []; return;
        }
        const record = fetchLatestRecord();
        let baseShape, samplingMethod, recordDataForStamp, baseSizeValue, baseAngle;
        if (record && record.shape) {
            baseShape = record.shape.type || defaultShape.type;
            samplingMethod = record.sampling === 'raw' ? 'raw' : (record.sampling === 'pixel' ? 'pixel' : 'distribution');
            recordDataForStamp = record;
            const dragBaseSize = (record.shape.baseSize || defaultShape.baseSize) * 0.3;
            baseSizeValue = dragBaseSize * (record.shape.scaleFactor || 1.0);
            baseAngle = record.shape.angle || 0;
        } else {
            baseShape = defaultShape.type; samplingMethod = 'distribution'; recordDataForStamp = null;
            baseSizeValue = defaultShape.baseSize * 0.3; baseAngle = defaultShape.angle;
        }
        if (dragPath.length === 1) {
            const p = dragPath[0];
            const clickSize = clamp(baseSizeValue * 1.5, MIN_STAMP_SIZE, MAX_STAMP_SIZE);
            await stampShapeAtPoint(p.x, p.y, baseShape, samplingMethod, recordDataForStamp, clickSize, baseAngle);
            if (paintStatusElement) paintStatusElement.textContent = `Clicked ${baseShape} (${samplingMethod}) at (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`;
        } else {
            if (paintStatusElement) paintStatusElement.textContent = `Painting drag path (${dragPath.length} points, ${samplingMethod})...`;
            for (let i = 1; i < dragPath.length; i++) {
                const p2 = dragPath[i]; const p1 = dragPath[i - 1];
                const dx = p2.x - p1.x; const dy = p2.y - p1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const dragAngle = Math.atan2(dy, dx);
                const scale = mapValue(distance, minDragDistance, maxDragDistance, minDragScale, maxDragScale);
                let stampSize = baseSizeValue * scale;
                await stampShapeAtPoint(p2.x, p2.y, baseShape, samplingMethod, recordDataForStamp, stampSize, dragAngle);
            }
            if (paintStatusElement) paintStatusElement.textContent = `Painted drag path (${dragPath.length} points, ${samplingMethod}).`;
        }
        dragPath = [];
    }

    // --- Trigger Fill Paint Function (Revised Pixel Sampling Source) ---
    async function triggerFillPaint() {
        if (!paintCtx) return;
        console.log("Triggering Fill Paint...");
        if (paintStatusElement) paintStatusElement.textContent = "Filling canvas...";
        const clampedMasterOpacity = clamp(masterOpacity, 0.0, 1.0);

        const record = fetchLatestRecord();
        let samplingMethod, recordDataForFill, baseShape, baseSizeValue;

        if (record && record.shape) {
            if (record.sampling === 'pixel') { samplingMethod = 'pixel'; }
            else if (record.sampling === 'raw') { samplingMethod = 'raw'; }
            else { samplingMethod = 'distribution'; }
            recordDataForFill = record;
            baseShape = record.shape.type || defaultShape.type;
            baseSizeValue = (record.shape.baseSize || defaultShape.baseSize) * (record.shape.scaleFactor || 1.0) * masterScaleFactor;
            console.log(`Fill using record ${record.id.substring(0,4)}... Mode: ${samplingMethod}`);
        } else {
            samplingMethod = 'distribution'; recordDataForFill = null; baseShape = defaultShape.type;
            baseSizeValue = defaultShape.baseSize * masterScaleFactor;
             console.log(`Fill using default shape/distribution. Mode: ${samplingMethod}`);
        }

        // No clearRect here
        await new Promise(resolve => setTimeout(resolve, 10)); // Allow UI update for status

        // --- Pixel Sampling or Distribution Fill (Using Temp Canvas) ---
        if (samplingMethod === 'pixel' || samplingMethod === 'distribution') {
            let sourceColors = null; // For pixel sampling
            let distribution = defaultDistribution; // For distribution or fallback

            if (samplingMethod === 'pixel' && recordDataForFill?.id && memoryBank?.getPixelData) {
                try {
                    const pixelDataResult = await memoryBank.getPixelData(recordDataForFill.id, 'render'); // Fetch RENDER data
                    if (pixelDataResult?.arrayBuffer) {
                        const sourcePixels = new Uint8ClampedArray(pixelDataResult.arrayBuffer);
                        const numSourcePixels = pixelDataResult.width * pixelDataResult.height;
                        sourceColors = [];
                        for (let i = 0; i < numSourcePixels; i++) {
                            const index = i * 4; if (sourcePixels[index + 3] > 0) {
                                sourceColors.push({ r: sourcePixels[index], g: sourcePixels[index + 1], b: sourcePixels[index + 2], a: sourcePixels[index + 3] }); // Store RGBA
                            }
                        }
                        if (sourceColors.length > 0) { shuffleArray(sourceColors); console.log(`Using ${sourceColors.length} shuffled pixels from 'render' data for fill.`); }
                        else { samplingMethod = 'distribution'; console.warn("No source pixels found in render data for pixel sampling fill, falling back to distribution."); }
                    } else { samplingMethod = 'distribution'; console.warn(`Could not retrieve valid render pixel data for pixel sampling fill (record ${recordDataForFill.id}), falling back to distribution.`); }
                } catch (fetchError) { samplingMethod = 'distribution'; console.error(`Error fetching render data for pixel sampling fill:`, fetchError); }
            }

            // Use record's distribution if method is distribution or pixel fallback
            if (samplingMethod === 'distribution' && recordDataForFill && recordDataForFill.distribution) {
                distribution = recordDataForFill.distribution;
            }

            try {
                // Prepare temporary canvas
                if (tempPatternCanvas.width !== paintCanvasElement.width || tempPatternCanvas.height !== paintCanvasElement.height || !tempPatternCtx) {
                     tempPatternCanvas.width = paintCanvasElement.width; tempPatternCanvas.height = paintCanvasElement.height;
                     try { tempPatternCtx = tempPatternCanvas.getContext('2d', { ...contextOptionsP3, alpha: true }); }
                     catch(e) { tempPatternCtx = tempPatternCanvas.getContext('2d', { ...contextOptionsDefault, alpha: true }); }
                     if (!tempPatternCtx) { throw new Error("Failed to get context for temp pattern canvas."); }
                } else {
                    tempPatternCtx.clearRect(0, 0, tempPatternCanvas.width, tempPatternCanvas.height);
                }

                const tempImageData = tempPatternCtx.createImageData(tempPatternCanvas.width, tempPatternCanvas.height);
                const tempPixels = tempImageData.data;
                const numPixels = tempPatternCanvas.width * tempPatternCanvas.height;

                for (let i = 0; i < numPixels; i++) {
                    let r, g, b, baseAlpha;
                    if (samplingMethod === 'pixel' && sourceColors) {
                        const color = sourceColors[i % sourceColors.length];
                        r = color.r; g = color.g; b = color.b;
                        baseAlpha = color.a; // Use original alpha
                    } else { // Distribution
                        const color = generateColorObjectFromDistribution(distribution);
                        r = color.r; g = color.g; b = color.b;
                        baseAlpha = color.a; // Use sampled alpha
                    }
                    const finalAlpha = finalizeAlpha(baseAlpha); // Apply opacity and override

                    const index = i * 4;
                    tempPixels[index] = r;
                    tempPixels[index + 1] = g;
                    tempPixels[index + 2] = b;
                    tempPixels[index + 3] = finalAlpha;
                }
                tempPatternCtx.putImageData(tempImageData, 0, 0); // Put pattern on temp canvas

                // Draw temp canvas onto main canvas (opacity/override already baked in)
                paintCtx.drawImage(tempPatternCanvas, 0, 0);

                if (paintStatusElement) paintStatusElement.textContent = `Canvas filled (${samplingMethod === 'pixel' ? 'Pixel Sampling' : 'Distribution Sampling'}).`;
            } catch (error) { console.error(`Error during ${samplingMethod} fill:`, error); if (paintStatusElement) paintStatusElement.textContent = `Error during ${samplingMethod} fill.`; }
        }
        // --- Raw Fill (Tiling - Sampled Alpha per Tile) ---
        else if (samplingMethod === 'raw' && recordDataForFill?.id && memoryBank?.getPixelData) {
            try {
                const pixelDataResult = await memoryBank.getPixelData(recordDataForFill.id, 'render');
                if (!pixelDataResult?.arrayBuffer || pixelDataResult.width <= 0 || pixelDataResult.height <= 0) { throw new Error(`Could not retrieve valid raw pixel data for record ${recordDataForFill.id}.`); }
                const { arrayBuffer, width: sourceW, height: sourceH } = pixelDataResult;
                if (tempSourceCanvas.width !== sourceW || tempSourceCanvas.height !== sourceH || !tempSourceCtx) {
                    tempSourceCanvas.width = sourceW; tempSourceCanvas.height = sourceH;
                    tempSourceCtx = tempSourceCanvas.getContext('2d', { colorSpace: contextOptionsP3.colorSpace, willReadFrequently: false });
                    if (!tempSourceCtx) throw new Error("Failed to get context for temporary source canvas.");
                }
                const imageData = new ImageData(new Uint8ClampedArray(arrayBuffer), sourceW, sourceH);
                tempSourceCtx.putImageData(imageData, 0, 0);
                const tileBBox = getApproximatePaintBoundingBox(baseShape, 0, 0, baseSizeValue, 0, Infinity, Infinity);
                if (!tileBBox || tileBBox.width <= 0 || tileBBox.height <= 0) { throw new Error("Could not calculate valid tile bounding box for raw fill."); }
                const tileWidth = tileBBox.width; const tileHeight = tileBBox.height;
                const strideX = Math.max(1, Math.floor(tileWidth * xStrideFactor));
                const strideY = Math.max(1, Math.floor(tileHeight * yStrideFactor));
                const offsetX = tileWidth / 2; const offsetY = tileHeight / 2;
                const baseTileRotationRad = tileRotationFactor * Math.PI;
                let currentTileAngle = 0;
                console.log(`Raw Fill Tiling: Tile Size≈${tileWidth.toFixed(0)}x${tileHeight.toFixed(0)}, Stride=${strideX}x${strideY}, AngleFactor=${tileRotationFactor.toFixed(2)}, MasterOpacity=${clampedMasterOpacity.toFixed(2)}, CompoundAngle: ${useCompoundAngle}`);

                for (let y = -offsetY; y < paintCanvasElement.height + offsetY; y += strideY) {
                    for (let x = -offsetX; x < paintCanvasElement.width + offsetX; x += strideX) {
                        const sampledTileAlpha = sampleAlphaUsingSliders(); // Sample alpha per tile
                        const finalTileAlpha = finalizeAlpha(sampledTileAlpha); // Apply override & opacity
                        const angleToUse = useCompoundAngle ? currentTileAngle : (x + y) * tileRotationFactor * TILE_ANGLE_SENSITIVITY;

                        paintCtx.save();
                        paintCtx.globalAlpha = finalTileAlpha / 255.0; // Use final alpha for this tile
                        paintCtx.translate(x + tileWidth / 2, y + tileHeight / 2);
                        paintCtx.rotate(angleToUse);
                        paintCtx.drawImage(tempSourceCanvas, 0, 0, sourceW, sourceH, -tileWidth / 2, -tileHeight / 2, tileWidth, tileHeight);
                        paintCtx.restore();
                        if (useCompoundAngle) {
                            currentTileAngle += baseTileRotationRad;
                        }
                    }
                }
                paintCtx.globalAlpha = 1.0; // Reset global alpha after loop

                if (paintStatusElement) paintStatusElement.textContent = `Canvas filled (Raw Tiling - Sampled Alpha per Tile).`;
            } catch (error) { console.error("Error during raw fill:", error); if (paintStatusElement) paintStatusElement.textContent = `Error during raw fill: ${error.message}`; paintCtx.globalAlpha = 1.0; }
        } else { if (paintStatusElement) paintStatusElement.textContent = `Fill failed: Unsupported mode or missing data (${samplingMethod}).`; }
    }


    // --- Create/Reset Canvas Function (Unchanged) ---
    function createPaintCanvases() { try { const width = Math.max(100, Math.min(8000, paintCanvasWidth)); const height = Math.max(100, Math.min(8000, paintCanvasHeight)); console.log(`Creating/Resizing canvases to ${width}x${height}, BG: ${paintBackgroundColor}`); paintBackgroundCanvas.width = width; paintBackgroundCanvas.height = height; if (!paintBgCtx) { paintBgCtx = paintBackgroundCanvas.getContext('2d', contextOptionsBg); } if (paintBgCtx) { paintBgCtx.fillStyle = paintBackgroundColor; paintBgCtx.fillRect(0, 0, width, height); } else { console.error("Failed to get background canvas context."); } paintCanvasElement.width = width; paintCanvasElement.height = height; try { paintCtx = paintCanvasElement.getContext('2d', contextOptionsP3); } catch (e) { paintCtx = paintCanvasElement.getContext('2d', contextOptionsDefault); } if (paintCtx) { paintCtx.clearRect(0, 0, width, height); } else { console.error("Failed to get paint canvas context after resize."); } if (paintStatusElement) paintStatusElement.textContent = `Canvas created ${width}x${height}. Ready.`; } catch (error) { console.error("Error creating/resizing canvases:", error); if (paintStatusElement) paintStatusElement.textContent = "Error setting up canvas."; } }

    // --- Export/Copy Canvas Function (Unchanged) ---
    async function exportOrCopyCanvas(action = 'export') { if (!paintCtx || !paintBgCtx) { alert("Canvas context is not available."); return; } if (paintStatusElement) paintStatusElement.textContent = action === 'copy' ? "Preparing image for clipboard..." : "Preparing image for export..."; console.log(`Starting canvas ${action}... Format: ${exportFormat}, BG: ${exportBackgroundColor}, Quality: ${jpgQuality}`); try { if (tempExportCanvas.width !== paintCanvasElement.width || tempExportCanvas.height !== paintCanvasElement.height) { tempExportCanvas.width = paintCanvasElement.width; tempExportCanvas.height = paintCanvasElement.height; tempExportCtx = tempExportCanvas.getContext('2d', { alpha: exportBackgroundColor === 'transparent' }); if (!tempExportCtx) { throw new Error("Failed to get temporary export canvas context."); } } else { tempExportCtx.clearRect(0, 0, tempExportCanvas.width, tempExportCanvas.height); } if (exportBackgroundColor !== 'transparent') { tempExportCtx.fillStyle = exportBackgroundColor; tempExportCtx.fillRect(0, 0, tempExportCanvas.width, tempExportCanvas.height); } else { tempExportCtx.drawImage(paintBackgroundCanvas, 0, 0); } tempExportCtx.drawImage(paintCanvasElement, 0, 0); const mimeType = exportFormat === 'jpeg' ? 'image/jpeg' : 'image/png'; const qualityArg = exportFormat === 'jpeg' ? jpgQuality : undefined; tempExportCanvas.toBlob(async (blob) => { if (!blob) { alert("Failed to create image blob."); if (paintStatusElement) paintStatusElement.textContent = "Error creating image."; return; } if (action === 'export') { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `paint_export_${Date.now()}.${exportFormat}`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); if (paintStatusElement) paintStatusElement.textContent = `Image exported as ${a.download}. Ready.`; console.log("Export successful."); } else if (action === 'copy') { try { if (!navigator.clipboard || !navigator.clipboard.write) { throw new Error("Clipboard API (write) not supported or available in this context (e.g., non-secure)."); } const item = new ClipboardItem({ [mimeType]: blob }); await navigator.clipboard.write([item]); alert("Image copied to clipboard!"); if (paintStatusElement) paintStatusElement.textContent = "Image copied to clipboard. Ready."; console.log("Copy to clipboard successful."); } catch (copyError) { console.error("Failed to copy image to clipboard:", copyError); alert(`Failed to copy image: ${copyError.message}`); if (paintStatusElement) paintStatusElement.textContent = "Failed to copy image."; } } updateReadyStatus(); }, mimeType, qualityArg); } catch (error) { console.error(`Error during canvas ${action}:`, error); alert(`Error during image ${action}: ${error.message}`); if (paintStatusElement) paintStatusElement.textContent = `Error during ${action}.`; } }

    // --- Event Handlers (Unchanged) ---
    function handlePointerDown(event) { if (event.button !== 0 && event.pointerType === 'mouse') return; event.preventDefault(); paintCanvasElement.setPointerCapture(event.pointerId); if (paintMethod === 'stamp') { isDragging = true; dragPath = []; lastDragPoint = null; const coords = getPointerCoords(event, paintCanvasElement); if (!coords) return; const startPoint = { x: coords.x, y: coords.y, timestamp: performance.now() }; dragPath.push(startPoint); lastDragPoint = startPoint; paintCanvasElement.style.cursor = 'grabbing'; if (paintStatusElement) paintStatusElement.textContent = "Dragging..."; } else if (paintMethod === 'fill') { isPotentialFillClick = true; paintCanvasElement.style.cursor = 'pointer'; if (paintStatusElement) paintStatusElement.textContent = "Click to Fill..."; } }
    function handlePointerMove(event) { if (paintMethod === 'stamp' && isDragging) { event.preventDefault(); const coords = getPointerCoords(event, paintCanvasElement); if (!coords) return; const currentPoint = { x: coords.x, y: coords.y, timestamp: performance.now() }; dragPath.push(currentPoint); lastDragPoint = currentPoint; } else if (paintMethod === 'fill') { isPotentialFillClick = false; } }
    async function handlePointerUpOrLeave(event) { if (!paintCanvasElement.hasPointerCapture(event.pointerId)) return; event.preventDefault(); paintCanvasElement.releasePointerCapture(event.pointerId); paintCanvasElement.style.cursor = 'crosshair'; if (paintMethod === 'stamp' && isDragging) { isDragging = false; lastDragPoint = null; await processDragPath(); } else if (paintMethod === 'fill' && isPotentialFillClick) { await triggerFillPaint(); } isDragging = false; isPotentialFillClick = false; }

    // --- Update Parameters Function (Reads Alpha Override) ---
    function updatePaintParameters(event) { try { paintCanvasWidth = parseInt(paintCanvasWidthInput?.value ?? 700, 10); paintCanvasHeight = parseInt(paintCanvasHeightInput?.value ?? 700, 10); paintBackgroundColor = paintBackgroundColorRadios?.value ?? '#ffffff'; paintMethod = paintMethodRadios?.value ?? 'stamp'; masterScaleFactor = parseFloat(paintMasterScaleSlider?.value ?? 0.5); minDragScale = parseFloat(paintMinDragScaleSlider?.value ?? 0.5); maxDragScale = parseFloat(paintMaxDragScaleSlider?.value ?? 1.5); minDragDistance = parseInt(paintMinDragDistSlider?.value ?? 1, 10); maxDragDistance = parseInt(paintMaxDragDistSlider?.value ?? 50, 10); alphaMeanMod = parseInt(paintAlphaMeanSlider?.value ?? 255, 10); alphaStdDevMod = parseInt(paintAlphaStdDevSlider?.value ?? 0, 10); alphaOverrideEnabled = alphaOverrideCheckbox?.checked ?? false; // Read override checkbox
        masterOpacity = parseFloat(paintMasterOpacitySlider?.value ?? 1.0); tileRotationFactor = parseFloat(paintTileRotationSlider?.value ?? 0.05); xStrideFactor = parseFloat(paintXStrideFactorSlider?.value ?? 0.25); yStrideFactor = parseFloat(paintYStrideFactorSlider?.value ?? 0.25); useCompoundAngle = paintCompoundAngleCheckbox?.checked ?? false; exportBackgroundColor = exportBackgroundRadios?.value ?? 'transparent'; exportFormat = exportFormatRadios?.value ?? 'png'; jpgQuality = parseFloat(jpgQualitySlider?.value ?? 0.92); if(paintMasterScaleValue) paintMasterScaleValue.textContent = `${(masterScaleFactor * 100).toFixed(0)}%`; if(paintMinDragScaleValue) paintMinDragScaleValue.textContent = `${minDragScale.toFixed(1)}x`; if(paintMaxDragScaleValue) paintMaxDragScaleValue.textContent = `${maxDragScale.toFixed(1)}x`; if(paintMinDragDistValue) paintMinDragDistValue.textContent = `${minDragDistance}px`; if(paintMaxDragDistValue) paintMaxDragDistValue.textContent = `${maxDragDistance}px`; if(paintAlphaMeanValue) paintAlphaMeanValue.textContent = `${alphaMeanMod}`; if(paintAlphaStdDevValue) paintAlphaStdDevValue.textContent = `${alphaStdDevMod}`; if(paintMasterOpacityValue) paintMasterOpacityValue.textContent = `${masterOpacity.toFixed(2)}`; if(paintTileRotationValue) paintTileRotationValue.textContent = `${tileRotationFactor.toFixed(2)} (factor)`; if(paintXStrideFactorValue) paintXStrideFactorValue.textContent = `${xStrideFactor.toFixed(2)}`; if(paintYStrideFactorValue) paintYStrideFactorValue.textContent = `${yStrideFactor.toFixed(2)}`; if(jpgQualityValue) jpgQualityValue.textContent = `${jpgQuality.toFixed(2)}`; if (jpgQualityGroup) { jpgQualityGroup.style.display = exportFormat === 'jpeg' ? 'flex' : 'none'; } } catch (e) { console.error("Error updating paint parameters:", e); } if (!event || !['paintCanvasWidthInput', 'paintCanvasHeightInput', 'paintBackgroundColor'].includes(event.target?.id)) { updateReadyStatus(); } }

     // --- Update Ready Status Message (Unchanged) ---
    function updateReadyStatus() { if (!paintStatusElement) return; fetchLatestRecord(); let modeDesc = paintMethod === 'stamp' ? 'Click/Drag to Stamp' : 'Click to Fill'; let recordDesc = '(default)'; let samplingDesc = 'distribution'; let shapeDesc = defaultShape.type; if (latestRecordCache) { recordDesc = `(record ${latestRecordCache.id.substring(0,4)}...)`; samplingDesc = latestRecordCache.sampling === 'raw' ? 'raw' : (latestRecordCache.sampling === 'pixel' ? 'pixel' : 'distribution'); shapeDesc = latestRecordCache.shape?.type || defaultShape.type; } paintStatusElement.textContent = `Ready. ${modeDesc} (${shapeDesc}, ${samplingDesc} ${recordDesc}).`; }

    // --- Initial Setup (Unchanged) ---
    function initializePaintUI() { if (!paintCanvasElement || !paintBackgroundCanvas) { if (paintStatusElement) paintStatusElement.textContent = "Paint canvas elements failed to initialize."; return; } updatePaintParameters(); createPaintCanvases(); paintControlsForm.addEventListener('input', updatePaintParameters); createCanvasButton.addEventListener('click', createPaintCanvases); exportCanvasButton.addEventListener('click', () => exportOrCopyCanvas('export')); copyCanvasButton.addEventListener('click', () => exportOrCopyCanvas('copy')); paintCanvasElement.addEventListener('pointerdown', handlePointerDown); paintCanvasElement.addEventListener('pointermove', handlePointerMove); paintCanvasElement.addEventListener('pointerup', handlePointerUpOrLeave); paintCanvasElement.addEventListener('pointerleave', handlePointerUpOrLeave); console.log("Paint UI Initialized (Canvas Setup, Export, Compound Angle)."); }

    initializePaintUI();

})(); // End IIFE

// --- END OF CORRECTED FILE paintUI.js ---
