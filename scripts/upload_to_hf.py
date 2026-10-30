#!/usr/bin/env python3
"""Upload the converted model, training results and model card to Hugging Face.

Requires the HF_TOKEN environment variable with write access.
"""

from __future__ import annotations

import os
from pathlib import Path

from huggingface_hub import HfApi

ROOT = Path(__file__).resolve().parents[1]
EXPORTS = ROOT / "exports"
REPO_ID = os.environ.get("HF_REPO_ID", "shahriarhd/brain-scan-ai-yolov11-seg")

FILES = [
    (EXPORTS / "README.md", "README.md"),
    (ROOT / "app" / "models" / "yolov11-seg-brain.pt", "yolov11-seg-brain.pt"),
    (EXPORTS / "yolov11-seg-brain.safetensors", "yolov11-seg-brain.safetensors"),
    (EXPORTS / "yolov11-seg-brain.onnx", "yolov11-seg-brain.onnx"),
    (EXPORTS / "results.csv", "results.csv"),
    (EXPORTS / "training_curves.png", "training_curves.png"),
]


def main() -> None:
    api = HfApi()
    api.create_repo(repo_id=REPO_ID, repo_type="model", exist_ok=True)
    for local_path, path_in_repo in FILES:
        print(f"Uploading {local_path.name} -> {path_in_repo}")
        api.upload_file(
            path_or_fileobj=str(local_path),
            path_in_repo=path_in_repo,
            repo_id=REPO_ID,
            repo_type="model",
        )
    print("Uploading sample images -> samples/")
    api.upload_folder(
        folder_path=str(EXPORTS / "samples"),
        path_in_repo="samples",
        repo_id=REPO_ID,
        repo_type="model",
    )
    print(f"Done: https://huggingface.co/{REPO_ID}")


if __name__ == "__main__":
    main()