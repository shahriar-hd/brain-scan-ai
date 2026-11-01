# Brain Scan AI — Browser Demo

A standalone, client-side demo of the `YOLO11m-seg` brain tumor segmentation model.
The page loads the ONNX model from Hugging Face, preprocesses the selected MRI slice,
runs inference with [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/), and
draws the predicted boxes and instance masks. Nothing is uploaded to a server.

**Live:** <https://shahriar-hd.github.io/brain-scan-ai/>

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Demo page |
| `styles.css` | Styling |
| `app.js` | Preprocessing, inference, YOLO post-processing (NMS + mask decoding), rendering |
| `samples/` | Sample MRI slices |

## Supported image formats

PNG, JPG/JPEG, WebP, BMP, and TIFF (`.tif` / `.tiff`). TIFF slices are decoded in the
browser with [UTIF.js](https://github.com/photopea/UTIF.js), so no server is involved.

## Run locally

Because the demo fetches the model over HTTPS, serve the folder with any static server:

```bash
# from the repository root
python -m http.server 8000
# then open http://localhost:8000/docs/
```

## Model source

The page can load the model from either:

- **Hugging Face** — downloads `shahriarhd/brain-scan-ai-yolov11-seg` (~85 MB, cached by the browser).
- **Local `.onnx` file** — pick an ONNX export from your machine; it is read locally and never uploaded.

Choose the source in the **Model source** dropdown and press **Load model**.

Query parameters:

| Parameter | Effect |
| --- | --- |
| `?model=<url>` | Load the ONNX model from a custom URL or path |
| `?sample=<url>` | Load an image and run inference automatically |
| `?autoload=1` | Load the default Hugging Face model on page load |

Examples:

```
# local export served from the repository root
http://localhost:8000/docs/?model=/exports/yolov11-seg-brain.onnx

# open a sample and run automatically
http://localhost:8000/docs/?sample=samples/tumor-mri.png

# download the model immediately on load
http://localhost:8000/docs/?autoload=1
```

## Model

Default source: <https://huggingface.co/shahriarhd/brain-scan-ai-yolov11-seg>

The ONNX file is about 85 MB and is cached by the browser after the first load.

> Not a medical device. For research and education only.
