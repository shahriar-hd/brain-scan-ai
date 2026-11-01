/* Brain Scan AI — client-side YOLO11m-seg inference with ONNX Runtime Web */
(function () {
  "use strict";

  const params = new URLSearchParams(location.search);

  const MODEL_ID = "shahriarhd/brain-scan-ai-yolov11-seg";
  const MODEL_FILE = "yolov11-seg-brain.onnx";
  const MODEL_URL =
    params.get("model") ||
    `https://huggingface.co/${MODEL_ID}/resolve/main/${MODEL_FILE}`;

  const INPUT_SIZE = 256;
  const GRID = 64;
  const NUM_MASKS = 32;
  const NC = 1;
  const IOU_THRESHOLD = 0.7;
  const PALETTE = [
    [74, 168, 255],
    [255, 138, 128],
    [53, 208, 127],
    [255, 193, 7],
    [186, 104, 255],
    [0, 214, 214],
  ];

  const $ = (id) => document.getElementById(id);

  const els = {
    status: $("status"),
    modelStatus: $("model-status"),
    dropzone: $("dropzone"),
    fileInput: $("file-input"),
    browse: $("browse-btn"),
    conf: $("conf"),
    confValue: $("conf-value"),
    run: $("run-btn"),
    download: $("download-btn"),
    canvas: $("canvas"),
    placeholder: $("placeholder"),
    results: $("results"),
    modelSource: $("model-source"),
    loadModelBtn: $("load-model-btn"),
    modelInput: $("model-input"),
    modelSourceLabel: $("model-source-label"),
  };

  const autoSample = params.get("sample");

  const state = {
    session: null,
    image: null,
    detections: [],
    lastRender: null,
  };

  if (ort && ort.env && ort.env.wasm) {
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.simd = true;
    ort.env.wasm.wasmPaths =
      "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";
    ort.env.logLevel = "error";
  }

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.className = kind || "muted";
  }

  function setModelStatus(text, kind) {
    els.modelStatus.textContent = text;
    els.modelStatus.className = "badge " + (kind || "");
  }

  async function fetchWithProgress(url, onProgress) {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} while downloading the model`);
    }
    const total = Number(response.headers.get("content-length")) || 0;
    if (!response.body || !total) {
      return await response.arrayBuffer();
    }
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      onProgress(received, total);
    }
    const buffer = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    return buffer.buffer;
  }

  function handleModelError(error) {
    console.error(error);
    setModelStatus("Model failed", "badge-error");
    setStatus(`Could not load the model: ${error.message}`, "error");
  }

  async function createSession(buffer, sourceLabel, started) {
    setModelStatus("Initializing…", "badge-loading");
    setStatus("Initializing inference session…", "busy");

    const previous = state.session;
    state.session = await ort.InferenceSession.create(buffer, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    if (previous && typeof previous.release === "function") {
      try {
        previous.release();
      } catch (ignored) {
        /* ignore */
      }
    }

    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    setModelStatus("Model ready", "badge-ready");
    els.modelSourceLabel.textContent = sourceLabel;
    setStatus(`Model ready in ${seconds}s. Choose an MRI slice and press Run.`);
    els.run.disabled = false;
    if (autoSample) {
      loadImageFromSrc(autoSample).catch((error) =>
        setStatus(`Could not load the sample: ${error.message}`, "error")
      );
    } else if (state.image) {
      runInference();
    }
  }

  async function loadModelFromUrl() {
    const started = performance.now();
    try {
      els.modelStatus.className = "badge badge-loading";
      setStatus(
        "Downloading the ONNX model (about 85 MB, cached by the browser after the first run)…",
        "busy"
      );
      const buffer = await fetchWithProgress(MODEL_URL, (received, total) => {
        const pct = Math.round((received / total) * 100);
        setModelStatus(`Downloading… ${pct}%`);
      });
      const label = params.get("model")
        ? `URL — ${MODEL_URL}`
        : `Hugging Face — ${MODEL_ID}`;
      await createSession(buffer, label, started);
    } catch (error) {
      handleModelError(error);
    }
  }

  async function loadModelFromFile(file) {
    const started = performance.now();
    try {
      setModelStatus("Reading local model…", "badge-loading");
      setStatus("Reading local ONNX file…", "busy");
      const buffer = await file.arrayBuffer();
      const size = (file.size / 1024 / 1024).toFixed(1);
      await createSession(buffer, `Local file — ${file.name} (${size} MB)`, started);
    } catch (error) {
      handleModelError(error);
    }
  }

  function letterbox(img) {
    const canvas = document.createElement("canvas");
    canvas.width = INPUT_SIZE;
    canvas.height = INPUT_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "rgb(114,114,114)";
    ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const scale = Math.min(INPUT_SIZE / w, INPUT_SIZE / h);
    const rw = Math.max(1, Math.round(w * scale));
    const rh = Math.max(1, Math.round(h * scale));
    const padX = Math.floor((INPUT_SIZE - rw) / 2);
    const padY = Math.floor((INPUT_SIZE - rh) / 2);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, padX, padY, rw, rh);

    const rgba = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
    const plane = INPUT_SIZE * INPUT_SIZE;
    const tensor = new Float32Array(3 * plane);
    for (let i = 0; i < plane; i++) {
      tensor[i] = rgba[i * 4] / 255;
      tensor[plane + i] = rgba[i * 4 + 1] / 255;
      tensor[2 * plane + i] = rgba[i * 4 + 2] / 255;
    }
    return { tensor, scale, rw, rh, padX, padY, w, h };
  }

  function iou(a, b) {
    const x1 = Math.max(a.x1, b.x1);
    const y1 = Math.max(a.y1, b.y1);
    const x2 = Math.min(a.x2, b.x2);
    const y2 = Math.min(a.y2, b.y2);
    const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
    const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
    return inter / (areaA + areaB - inter + 1e-9);
  }

  function postprocess(preds, protos, confThreshold) {
    const data = preds.data;
    const anchors = preds.dims[2];
    const scoreOffset = 4;
    const maskOffset = 4 + NC;

    let candidates = [];
    for (let i = 0; i < anchors; i++) {
      const score = data[scoreOffset * anchors + i];
      if (score < confThreshold) continue;
      const cx = data[i];
      const cy = data[anchors + i];
      const w = data[2 * anchors + i];
      const h = data[3 * anchors + i];
      candidates.push({
        index: i,
        score,
        cx,
        cy,
        w,
        h,
        x1: cx - w / 2,
        y1: cy - h / 2,
        x2: cx + w / 2,
        y2: cy + h / 2,
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    const kept = [];
    for (const candidate of candidates) {
      let suppressed = false;
      for (const other of kept) {
        if (iou(candidate, other) > IOU_THRESHOLD) {
          suppressed = true;
          break;
        }
      }
      if (!suppressed) kept.push(candidate);
    }

    const protoData = protos.data;
    const gridPixels = GRID * GRID;

    kept.forEach((det, order) => {
      const mask = new Float32Array(gridPixels);
      for (let k = 0; k < NUM_MASKS; k++) {
        const coeff = data[(maskOffset + k) * anchors + det.index];
        if (coeff === 0) continue;
        const base = k * gridPixels;
        for (let j = 0; j < gridPixels; j++) {
          mask[j] += coeff * protoData[base + j];
        }
      }

      const gridScale = GRID / INPUT_SIZE;
      const bx1 = Math.max(0, Math.floor(det.x1 * gridScale));
      const by1 = Math.max(0, Math.floor(det.y1 * gridScale));
      const bx2 = Math.min(GRID, Math.ceil(det.x2 * gridScale));
      const by2 = Math.min(GRID, Math.ceil(det.y2 * gridScale));

      let area = 0;
      const alphaMask = new Uint8ClampedArray(gridPixels);
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          const j = y * GRID + x;
          const inside = x >= bx1 && x < bx2 && y >= by1 && y < by2;
          const value = 1 / (1 + Math.exp(-mask[j]));
          if (inside && value > 0.5) {
            alphaMask[j] = 255;
            area++;
          }
        }
      }

      det.mask = alphaMask;
      det.color = PALETTE[order % PALETTE.length];
      det.areaPercent = (area / gridPixels) * 100;
    });

    return kept;
  }

  function drawDetections(box, detections) {
    const canvas = els.canvas;
    const ctx = canvas.getContext("2d");
    const { scale, rw, rh, padX, padY, w, h } = box;

    const dispScale = Math.min(1, 960 / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * dispScale));
    const ch = Math.max(1, Math.round(h * dispScale));

    canvas.width = cw;
    canvas.height = ch;
    canvas.classList.add("visible");
    els.placeholder.style.display = "none";

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(state.image, 0, 0, cw, ch);

    if (detections.length) {
      const maskLayer = document.createElement("canvas");
      maskLayer.width = INPUT_SIZE;
      maskLayer.height = INPUT_SIZE;
      const maskCtx = maskLayer.getContext("2d");

      detections.forEach((det) => {
        const tile = document.createElement("canvas");
        tile.width = GRID;
        tile.height = GRID;
        const tileCtx = tile.getContext("2d");
        const imageData = tileCtx.createImageData(GRID, GRID);
        const [r, g, b] = det.color;
        for (let j = 0; j < GRID * GRID; j++) {
          if (det.mask[j]) {
            imageData.data[j * 4] = r;
            imageData.data[j * 4 + 1] = g;
            imageData.data[j * 4 + 2] = b;
            imageData.data[j * 4 + 3] = 165;
          }
        }
        tileCtx.putImageData(imageData, 0, 0);
        maskCtx.drawImage(tile, 0, 0, GRID, GRID, 0, 0, INPUT_SIZE, INPUT_SIZE);
      });

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(maskLayer, padX, padY, rw, rh, 0, 0, cw, ch);
      ctx.restore();

      const sx = cw / rw;
      const sy = ch / rh;
      const toX = (value) => (value - padX) * sx;
      const toY = (value) => (value - padY) * sy;

      ctx.lineWidth = Math.max(2, Math.round(Math.max(cw, ch) / 256));
      ctx.font = `${Math.max(12, Math.round(Math.max(cw, ch) / 32))}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textBaseline = "top";

      detections.forEach((det) => {
        const x1 = toX(det.x1);
        const y1 = toY(det.y1);
        const x2 = toX(det.x2);
        const y2 = toY(det.y2);
        const color = `rgb(${det.color.join(",")})`;
        ctx.strokeStyle = color;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        const label = `tumor ${(det.score * 100).toFixed(0)}%`;
        const padding = 4;
        const textWidth = ctx.measureText(label).width;
        const labelHeight = Number.parseInt(ctx.font, 10) + padding * 2;
        const labelY = Math.max(0, y1 - labelHeight);
        ctx.fillStyle = color;
        ctx.fillRect(x1, labelY, textWidth + padding * 2, labelHeight);
        ctx.fillStyle = "#05101f";
        ctx.fillText(label, x1 + padding, labelY + padding);
      });
    }

    state.lastRender = canvas;
    els.download.disabled = false;
    renderResults(detections);
  }

  function renderResults(detections) {
    els.results.innerHTML = "";
    if (!detections.length) {
      const empty = document.createElement("p");
      empty.className = "result-empty";
      empty.textContent =
        "No tumor detected above the confidence threshold. Lower the threshold to inspect weaker predictions.";
      els.results.appendChild(empty);
      return;
    }

    detections.forEach((det) => {
      const item = document.createElement("div");
      item.className = "result-item";

      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = `rgb(${det.color.join(",")})`;

      const label = document.createElement("span");
      label.className = "label";
      label.textContent = "Tumor";

      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = `${(det.score * 100).toFixed(1)}% confidence · ~${det.areaPercent.toFixed(1)}% of slice`;

      item.append(swatch, label, meta);
      els.results.appendChild(item);
    });
  }

  async function runInference() {
    if (!state.session || !state.image) return;

    const confThreshold = Number(els.conf.value);
    els.run.disabled = true;
    setStatus("Running segmentation…", "busy");

    try {
      const box = letterbox(state.image);
      const feeds = {};
      feeds[state.session.inputNames[0]] = new ort.Tensor("float32", box.tensor, [
        1,
        3,
        INPUT_SIZE,
        INPUT_SIZE,
      ]);

      const started = performance.now();
      const outputs = await state.session.run(feeds);
      const elapsed = (performance.now() - started).toFixed(0);

      const preds = outputs[state.session.outputNames[0]];
      const protos = outputs[state.session.outputNames[1]];
      const detections = postprocess(preds, protos, confThreshold);

      state.detections = detections;
      drawDetections(box, detections);
      setStatus(
        detections.length
          ? `Detected ${detections.length} tumor region${detections.length > 1 ? "s" : ""} in ${elapsed} ms.`
          : `No tumor detected in ${elapsed} ms.`
      );
    } catch (error) {
      console.error(error);
      setStatus(`Inference failed: ${error.message}`, "error");
    } finally {
      els.run.disabled = false;
    }
  }

  async function loadImageFromSrc(src) {
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    await image.decode();
    state.image = image;
    els.placeholder.textContent = "Press “Run segmentation” to analyze this scan";
    els.placeholder.style.display = "block";
    els.canvas.classList.remove("visible");
    els.results.innerHTML = "";
    els.download.disabled = true;
    if (state.session) runInference();
  }

  function isTiffFile(file) {
    return file.type === "image/tiff" || /\.tiff?$/i.test(file.name || "");
  }

  async function decodeTiffToDataUrl(file) {
    if (typeof UTIF === "undefined") {
      throw new Error("TIFF decoder not loaded");
    }
    const buffer = await file.arrayBuffer();
    const ifds = UTIF.decode(buffer);
    if (!ifds || !ifds.length) {
      throw new Error("no image found in the TIFF file");
    }
    UTIF.decodeImage(buffer, ifds[0]);
    const rgba = UTIF.toRGBA8(ifds[0]);
    const width = ifds[0].width;
    const height = ifds[0].height;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(rgba);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  }

  async function handleFile(file) {
    if (!file) return;

    if (isTiffFile(file)) {
      setStatus("Decoding TIFF image…", "busy");
      try {
        const dataUrl = await decodeTiffToDataUrl(file);
        await loadImageFromSrc(dataUrl);
        setStatus("TIFF decoded. Running segmentation…");
      } catch (error) {
        setStatus(`Could not decode the TIFF file: ${error.message}`, "error");
      }
      return;
    }

    if (!file.type.startsWith("image/")) {
      setStatus("Unsupported file. Use PNG, JPG, WebP, BMP or TIFF.", "error");
      return;
    }
    const url = URL.createObjectURL(file);
    loadImageFromSrc(url)
      .catch((error) => setStatus(`Could not read the image: ${error.message}`, "error"))
      .finally(() => URL.revokeObjectURL(url));
  }

  els.browse.addEventListener("click", (event) => {
    event.stopPropagation();
    els.fileInput.click();
  });
  els.dropzone.addEventListener("click", () => els.fileInput.click());
  els.dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      els.fileInput.click();
    }
  });
  els.fileInput.addEventListener("change", () => handleFile(els.fileInput.files[0]));

  ["dragenter", "dragover"].forEach((name) =>
    els.dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      els.dropzone.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((name) =>
    els.dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      els.dropzone.classList.remove("dragover");
    })
  );
  els.dropzone.addEventListener("drop", (event) => {
    const file = event.dataTransfer.files[0];
    handleFile(file);
  });

  document.querySelectorAll(".sample-btn").forEach((button) =>
    button.addEventListener("click", () => {
      const src = button.getAttribute("data-src");
      loadImageFromSrc(src).catch((error) =>
        setStatus(`Could not load the sample: ${error.message}`, "error")
      );
    })
  );

  els.conf.addEventListener("input", () => {
    els.confValue.value = Number(els.conf.value).toFixed(2);
    if (state.session && state.image) runInference();
  });

  els.run.addEventListener("click", runInference);

  els.loadModelBtn.addEventListener("click", () => {
    if (els.modelSource.value === "file") {
      els.modelInput.click();
    } else {
      loadModelFromUrl();
    }
  });
  els.modelSource.addEventListener("change", () => {
    if (els.modelSource.value === "file") els.modelInput.click();
  });
  els.modelInput.addEventListener("change", () => {
    const file = els.modelInput.files[0];
    if (file) loadModelFromFile(file);
  });

  els.download.addEventListener("click", () => {
    if (!state.lastRender) return;
    state.lastRender.toBlob((blob) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "brain-scan-ai-segmentation.png";
      link.click();
      URL.revokeObjectURL(link.href);
    }, "image/png");
  });

  const shouldAutoload =
    params.has("model") || params.has("autoload") || Boolean(autoSample);
  if (shouldAutoload) loadModelFromUrl();
})();
