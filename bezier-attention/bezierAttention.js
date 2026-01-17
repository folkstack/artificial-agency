// Ensure TensorFlow.js is loaded before this script
const tf = window.tf;

// --- Helper Functions ---
function combinations(n, k) {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    if (k > n / 2) k = n - k;
    let res = 1;
    for (let i = 1; i <= k; ++i) {
        res = res * (n - i + 1) / i;
    }
    return res;
}

function bernsteinPolynomial(n, i, t) {
    if (!tf) { console.error("TensorFlow (tf) is not available in bernsteinPolynomial"); return null; }
    return tf.tidy(() => {
        const tScalar = tf.scalar(t);
        const oneMinusT = tf.sub(1, tScalar);
        const comb = tf.scalar(combinations(n, i));
        const tPowI = tf.pow(tScalar, i);
        const oneMinusTPowNMinusI = tf.pow(oneMinusT, n - i);
        return tf.mul(comb, tf.mul(tPowI, oneMinusTPowNMinusI));
    });
}

function bezierPoint(controlPointsTensor, t) {
    if (!tf) { console.error("TensorFlow (tf) is not available in bezierPoint"); return null; }
    return tf.tidy(() => {
        const n = controlPointsTensor.shape[0] - 1;
        let point = tf.scalar(0);
        for (let i = 0; i <= n; i++) {
            const basis = bernsteinPolynomial(n, i, t);
            if (!basis || !(basis instanceof tf.Tensor)) {
                console.error(`Invalid basis function result from bernsteinPolynomial for i=${i}, t=${t}. Result:`, basis);
                throw new Error(`Invalid basis function result for i=${i}, t=${t}`);
            }
            const controlPoint = controlPointsTensor.slice([i], [1]).asScalar();
            point = tf.add(point, tf.mul(basis, controlPoint));
        }
        return point; // point is the final tensor for this tidy scope
    });
}


// --- API Functions (Using tf.keep) ---

/**
 * Calculates multiple points along a 1D Bézier curve.
 * Uses tf.keep on the final result tensor.
 * @param {number[]} controlPoints
 * @param {number} numPoints
 * @returns {tf.Tensor1D | null}
 */
function calculateBezierPoints(controlPoints, numPoints) {
    if (!tf) { console.error("TensorFlow (tf) is not available in calculateBezierPoints"); return null; }
    if (!controlPoints || controlPoints.length < 2) { throw new Error("At least 2 control points are required."); }
    if (numPoints < 2) { throw new Error("Number of points must be at least 2."); }

    let finalCurveTensor = null; // Variable in outer scope

    tf.tidy(() => { // Tidy manages intermediates
        const controlPointsTensor = tf.tensor1d(controlPoints);
        const points = [];
        for (let i = 0; i < numPoints; i++) {
            const t = i / (numPoints - 1);
            const point = bezierPoint(controlPointsTensor, t); // bezierPoint uses its own tidy
            if (!point || !(point instanceof tf.Tensor)) {
                 throw new Error(`Failed to calculate valid Bézier point tensor at t=${t}`);
            }
            points.push(point);
        }
        const curveTensor = tf.stack(points); // Create final tensor
        finalCurveTensor = tf.keep(curveTensor); // Explicitly keep it
    }); // End tidy

    if (!finalCurveTensor) {
        console.error("calculateBezierPoints: Failed to produce tensor after tidy.");
    }
    return finalCurveTensor; // Return the kept tensor
}

/**
 * Calculates sharpness. Uses tf.keep on the final result tensor.
 * @param {tf.Tensor1D} curvePoints
 * @returns {tf.Tensor1D | null}
 */
function calculateSharpness(curvePoints) {
     if (!tf) { console.error("TensorFlow (tf) is not available in calculateSharpness"); return null; }

     let finalSharpnessTensor = null; // Variable in outer scope

     tf.tidy(() => { // Tidy manages intermediates
        const M = curvePoints.shape[0];
        if (M < 3) {
            finalSharpnessTensor = tf.keep(tf.zeros([M]));
            return; // Exit tidy early
        }
        const y_i_plus_2 = curvePoints.slice([2], [M - 2]);
        const y_i_plus_1 = curvePoints.slice([1], [M - 2]);
        const y_i_ = curvePoints.slice([0], [M - 2]);
        const secondDerivativeApprox = tf.add(y_i_plus_2, tf.sub(y_i_, tf.mul(2, y_i_plus_1)));
        const sharpnessMagnitude = tf.abs(secondDerivativeApprox);
        const paddedSharpness = tf.pad(sharpnessMagnitude, [[1, 1]], 0);
        finalSharpnessTensor = tf.keep(paddedSharpness);
    }); // End tidy

    if (!finalSharpnessTensor) {
         console.error("calculateSharpness: Failed to produce tensor after tidy.");
    }
    return finalSharpnessTensor; // Return the kept tensor
}

/**
 * Original Softmax Attention
 */
function attentionWithSharpness(curvePoints, sharpnessScaleFactor = 1.0) {
    if (!tf) { console.error("TF not available"); return null; }
    let attendedCurve = null;
    let attentionWeights = null;
    let sharpnessTensor = null; // Local scope for sharpness copy

    tf.tidy(() => {
        const M = curvePoints.shape[0];
        const Q = curvePoints.reshape([M, 1]);
        const K = curvePoints.reshape([M, 1]);
        const V = curvePoints.reshape([M, 1]);
        const scores = tf.matMul(Q, K.transpose());

        sharpnessTensor = calculateSharpness(curvePoints); // Gets a kept tensor
        if (!sharpnessTensor || !(sharpnessTensor instanceof tf.Tensor)) { throw new Error("Sharpness calc failed."); }

        const scaledSharpness = tf.mul(sharpnessTensor, sharpnessScaleFactor);
        const sharpnessBias = scaledSharpness.reshape([1, M]);
        const modifiedScores = tf.add(scores, sharpnessBias);

        // Softmax activation
        const weights = tf.softmax(modifiedScores, -1);

        const output = tf.matMul(weights, V);
        const finalCurve = output.reshape([M]);

        attendedCurve = tf.keep(finalCurve);
        attentionWeights = tf.keep(weights);

        // Dispose the local sharpnessTensor copy - the caller has its own kept version
        if (sharpnessTensor && !sharpnessTensor.isDisposed) { sharpnessTensor.dispose(); }
    });

    if (attendedCurve && attentionWeights) { return { attendedCurve, attentionWeights }; }
    else { /* Error handling */ if(attendedCurve && !attendedCurve.isDisposed) attendedCurve.dispose(); if(attentionWeights && !attentionWeights.isDisposed) attentionWeights.dispose(); return null; }
}

/**
 * Attention using ReLU + L1 Normalization
 */
function attentionWithSharpness_ReLU(curvePoints, sharpnessScaleFactor = 1.0) {
    if (!tf) { console.error("TF not available"); return null; }
    let attendedCurve = null;
    let attentionWeights = null;
    let sharpnessTensor = null;

    tf.tidy(() => {
        const M = curvePoints.shape[0];
        const Q = curvePoints.reshape([M, 1]);
        const K = curvePoints.reshape([M, 1]);
        const V = curvePoints.reshape([M, 1]);
        const scores = tf.matMul(Q, K.transpose());

        sharpnessTensor = calculateSharpness(curvePoints);
        if (!sharpnessTensor || !(sharpnessTensor instanceof tf.Tensor)) { throw new Error("Sharpness calc failed."); }

        const scaledSharpness = tf.mul(sharpnessTensor, sharpnessScaleFactor);
        const sharpnessBias = scaledSharpness.reshape([1, M]);
        const modifiedScores = tf.add(scores, sharpnessBias);

        const positiveScores = tf.relu(modifiedScores);
        const epsilon = tf.scalar(1e-7);
        const rowSums = tf.add(tf.sum(positiveScores, -1, true), epsilon);
        const weights = tf.div(positiveScores, rowSums); // Normalized weights

        const output = tf.matMul(weights, V);
        const finalCurve = output.reshape([M]);

        attendedCurve = tf.keep(finalCurve);
        attentionWeights = tf.keep(weights);

        if (sharpnessTensor && !sharpnessTensor.isDisposed) { sharpnessTensor.dispose(); }
    });

    if (attendedCurve && attentionWeights) { return { attendedCurve, attentionWeights }; }
    else { /* Error handling */ if(attendedCurve && !attendedCurve.isDisposed) attendedCurve.dispose(); if(attentionWeights && !attentionWeights.isDisposed) attentionWeights.dispose(); return null; }
}

/**
 * Attention using Sigmoid activation
 */
function attentionWithSharpness_Sigmoid(curvePoints, sharpnessScaleFactor = 1.0) {
     if (!tf) { console.error("TF not available"); return null; }
    let attendedCurve = null;
    let attentionWeights = null;
    let sharpnessTensor = null;

    tf.tidy(() => {
        const M = curvePoints.shape[0];
        const Q = curvePoints.reshape([M, 1]);
        const K = curvePoints.reshape([M, 1]);
        const V = curvePoints.reshape([M, 1]);
        const scores = tf.matMul(Q, K.transpose());

        sharpnessTensor = calculateSharpness(curvePoints);
        if (!sharpnessTensor || !(sharpnessTensor instanceof tf.Tensor)) { throw new Error("Sharpness calc failed."); }

        const scaledSharpness = tf.mul(sharpnessTensor, sharpnessScaleFactor);
        const sharpnessBias = scaledSharpness.reshape([1, M]);
        const modifiedScores = tf.add(scores, sharpnessBias);

        // Sigmoid activation
        const weights = tf.sigmoid(modifiedScores);

        const output = tf.matMul(weights, V);
        const finalCurve = output.reshape([M]);

        attendedCurve = tf.keep(finalCurve);
        attentionWeights = tf.keep(weights);

        if (sharpnessTensor && !sharpnessTensor.isDisposed) { sharpnessTensor.dispose(); }
    });

    if (attendedCurve && attentionWeights) { return { attendedCurve, attentionWeights }; }
    else { /* Error handling */ if(attendedCurve && !attendedCurve.isDisposed) attendedCurve.dispose(); if(attentionWeights && !attentionWeights.isDisposed) attentionWeights.dispose(); return null; }
}

/**
 * Attention using Square + L1 Normalization
 */
function attentionWithSharpness_Square(curvePoints, sharpnessScaleFactor = 1.0) {
    if (!tf) { console.error("TF not available"); return null; }
    let attendedCurve = null;
    let attentionWeights = null;
    let sharpnessTensor = null;

    tf.tidy(() => {
        const M = curvePoints.shape[0];
        const Q = curvePoints.reshape([M, 1]);
        const K = curvePoints.reshape([M, 1]);
        const V = curvePoints.reshape([M, 1]);
        const scores = tf.matMul(Q, K.transpose());

        sharpnessTensor = calculateSharpness(curvePoints);
        if (!sharpnessTensor || !(sharpnessTensor instanceof tf.Tensor)) { throw new Error("Sharpness calc failed."); }

        const scaledSharpness = tf.mul(sharpnessTensor, sharpnessScaleFactor);
        const sharpnessBias = scaledSharpness.reshape([1, M]);
        const modifiedScores = tf.add(scores, sharpnessBias);

        const squaredScores = tf.square(modifiedScores);
        const epsilon = tf.scalar(1e-7);
        const rowSums = tf.add(tf.sum(squaredScores, -1, true), epsilon);
        const weights = tf.div(squaredScores, rowSums); // Normalized weights

        const output = tf.matMul(weights, V);
        const finalCurve = output.reshape([M]);

        attendedCurve = tf.keep(finalCurve);
        attentionWeights = tf.keep(weights);

        if (sharpnessTensor && !sharpnessTensor.isDisposed) { sharpnessTensor.dispose(); }
    });

    if (attendedCurve && attentionWeights) { return { attendedCurve, attentionWeights }; }
    else { /* Error handling */ if(attendedCurve && !attendedCurve.isDisposed) attendedCurve.dispose(); if(attentionWeights && !attentionWeights.isDisposed) attentionWeights.dispose(); return null; }
}


/**
 * Calculates non-uniform t values based on importance scores.
 */
function calculateNonUniformTValues(importanceScores, numNewPoints) {
    const M = importanceScores.length;
    const N = numNewPoints;
    if (M < 2) { throw new Error("Importance scores array must have at least 2 elements."); }
    if (N < 2) { return [0.5]; }

    const epsilon = 1e-7;
    const s_adjusted = importanceScores.map(s => Math.max(0, s) + epsilon);
    const c_sum = [0];
    for (let i = 0; i < M; i++) { c_sum.push(c_sum[i] + s_adjusted[i]); }
    c_sum.shift();
    const totalC = c_sum[M - 1];

    if (totalC <= epsilon * M) {
        console.warn("All importance scores are near zero. Falling back to uniform t values.");
        return Array.from({ length: N }, (_, k) => k / (N - 1));
    }

    const c_norm = c_sum.map(c => c / totalC);
    const target_C_norm = Array.from({ length: N }, (_, k) => k / (N - 1));
    const new_t_values = [];
    let current_orig_index = 0;

    for (const target_val of target_C_norm) {
        while (current_orig_index < M - 1 && c_norm[current_orig_index] < target_val) {
            current_orig_index++;
        }
        const c_prev = current_orig_index === 0 ? 0.0 : c_norm[current_orig_index - 1];
        const c_curr = c_norm[current_orig_index];
        const t_at_c_prev = current_orig_index === 0 ? 0.0 : (current_orig_index - 1) / (M - 1);
        const t_at_c_curr = current_orig_index / (M - 1);
        let t_new;
        const c_diff = c_curr - c_prev;
        if (c_diff < 1e-9) { t_new = t_at_c_curr; }
        else { const fraction = (target_val - c_prev) / c_diff; t_new = t_at_c_prev + fraction * (t_at_c_curr - t_at_c_prev); }
        new_t_values.push(Math.max(0.0, Math.min(1.0, t_new)));
    }
     if (N > 0) { new_t_values[N - 1] = 1.0; new_t_values[0] = 0.0; }
    return new_t_values;
}


// --- Make functions available globally (UPDATED LIST) ---
if (typeof window !== 'undefined') {
    window.bezierAttentionAPI = {
        calculateBezierPoints: calculateBezierPoints,
        calculateSharpness: calculateSharpness,
        attentionWithSharpness: attentionWithSharpness,           // Original Softmax
        attentionWithSharpness_ReLU: attentionWithSharpness_ReLU,     // ReLU + Norm
        attentionWithSharpness_Sigmoid: attentionWithSharpness_Sigmoid, // Sigmoid
        attentionWithSharpness_Square: attentionWithSharpness_Square,  // Square + Norm
        calculateNonUniformTValues: calculateNonUniformTValues
    };
    console.log("bezierAttentionAPI attached to window:", window.bezierAttentionAPI);
} else {
    console.warn("Not running in a browser environment...");
}