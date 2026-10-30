#!/usr/bin/env python3
"""Export the trained YOLO11 segmentation checkpoint to safetensors and ONNX.

Usage:
    python scripts/export_model.py

Outputs are written to ./exports:
    - yolov11-seg-brain.safetensors  (weights-only state dict)
    - yolov11-seg-brain.onnx         (opset 12, fixed 256x256 input)
    - results.csv                    (per-epoch training metrics from the checkpoint)
    - training_curves.png            (training/validation curves)
"""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
import torch
from safetensors.torch import save_file
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
CHECKPOINT = ROOT / "app" / "models" / "yolov11-seg-brain.pt"
OUT_DIR = ROOT / "exports"
IMGSZ = 256


def export_safetensors(checkpoint: dict, out_path: Path) -> None:
    model = checkpoint["model"]
    state_dict = {name: tensor.detach().cpu().contiguous() for name, tensor in model.state_dict().items()}
    metadata = {
        "format": "pt",
        "architecture": "yolo11m-seg",
        "task": "segment",
        "nc": str(model.nc),
        "names": json.dumps(model.names),
        "imgsz": str(IMGSZ),
        "ultralytics_version": str(checkpoint.get("version", "")),
        "source": "brain-scan-ai/yolov11-seg-brain.pt",
    }
    save_file(state_dict, str(out_path), metadata=metadata)
    print(f"Saved {out_path} ({out_path.stat().st_size / 1024**2:.1f} MiB)")


def export_onnx(checkpoint_path: Path, out_path: Path) -> None:
    model = YOLO(str(checkpoint_path))
    exported = Path(
        model.export(
            format="onnx",
            imgsz=IMGSZ,
            opset=12,
            simplify=False,
            dynamic=False,
            half=False,
        )
    )
    if exported.resolve() != out_path.resolve():
        exported.replace(out_path)
    print(f"Saved {out_path} ({out_path.stat().st_size / 1024**2:.1f} MiB)")


def export_training_history(checkpoint: dict, out_dir: Path) -> None:
    history = checkpoint.get("train_results")
    if not history:
        print("No train_results found in checkpoint; skipping metrics export.")
        return

    df = pd.DataFrame(history)
    df.columns = [column.strip() for column in df.columns]
    df.to_csv(out_dir / "results.csv", index=False)
    print(f"Saved {out_dir / 'results.csv'} ({len(df)} epochs)")

    fig, axes = plt.subplots(2, 2, figsize=(14, 9))

    axes[0, 0].plot(df["epoch"], df["train/box_loss"], label="train box")
    axes[0, 0].plot(df["epoch"], df["val/box_loss"], label="val box")
    axes[0, 0].set_title("Box loss")
    axes[0, 0].set_xlabel("epoch")
    axes[0, 0].set_ylabel("loss")
    axes[0, 0].legend()
    axes[0, 0].grid(True, alpha=0.3)

    axes[0, 1].plot(df["epoch"], df["train/seg_loss"], label="train seg")
    axes[0, 1].plot(df["epoch"], df["val/seg_loss"], label="val seg")
    axes[0, 1].set_title("Segmentation loss")
    axes[0, 1].set_xlabel("epoch")
    axes[0, 1].set_ylabel("loss")
    axes[0, 1].legend()
    axes[0, 1].grid(True, alpha=0.3)

    axes[1, 0].plot(df["epoch"], df["metrics/mAP50(B)"], label="box mAP50")
    axes[1, 0].plot(df["epoch"], df["metrics/mAP50(M)"], label="mask mAP50")
    axes[1, 0].set_title("mAP@0.5")
    axes[1, 0].set_xlabel("epoch")
    axes[1, 0].set_ylabel("mAP")
    axes[1, 0].legend()
    axes[1, 0].grid(True, alpha=0.3)

    axes[1, 1].plot(df["epoch"], df["metrics/mAP50-95(B)"], label="box mAP50-95")
    axes[1, 1].plot(df["epoch"], df["metrics/mAP50-95(M)"], label="mask mAP50-95")
    axes[1, 1].set_title("mAP@0.5:0.95")
    axes[1, 1].set_xlabel("epoch")
    axes[1, 1].set_ylabel("mAP")
    axes[1, 1].legend()
    axes[1, 1].grid(True, alpha=0.3)

    fig.suptitle("YOLO11m-seg brain tumor model — 100 epoch training", fontweight="bold")
    fig.tight_layout()
    fig.savefig(out_dir / "training_curves.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved {out_dir / 'training_curves.png'}")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    checkpoint = torch.load(CHECKPOINT, map_location="cpu", weights_only=False)
    export_safetensors(checkpoint, OUT_DIR / "yolov11-seg-brain.safetensors")
    export_training_history(checkpoint, OUT_DIR)
    export_onnx(CHECKPOINT, OUT_DIR / "yolov11-seg-brain.onnx")


if __name__ == "__main__":
    main()