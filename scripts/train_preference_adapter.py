"""
RLHF / Preference Fine-Tuning Pipeline Adapter for Carbonexo EcoMind.
Prepares train/validation/test splits from exported preferences, checks evaluation leak prevention,
and formats data for preference optimization (DPO / KTO).

Status for Gemini 3 Preview: NOT SUPPORTED by Vertex AI custom tuning.
Status for Gemini 2.5 Flash: SFT supported on select Vertex AI regions; DPO/RLHF requires custom container.
"""

import json
import sys
from pathlib import Path

def prepare_preference_dataset(export_file="preferences_export.jsonl", output_dir="datasets/rlhf"):
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    
    input_path = Path(export_file)
    if not input_path.exists():
        print(f"[RLHF Pipeline] Notice: {export_file} does not exist yet. Using empty manifest.")
        pairs = []
    else:
        with open(input_path, "r", encoding="utf-8") as f:
            pairs = [json.loads(line) for line in f if line.strip()]

    print(f"[RLHF Pipeline] Loaded {len(pairs)} preference pairs.")
    
    # Eval leak check: verify no test prompts appear in training data
    eval_suite_path = Path("ECOMIND_EVAL_SUITE.jsonl")
    held_out_prompts = set()
    if eval_suite_path.exists():
        with open(eval_suite_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    held_out_prompts.add(json.loads(line)["question"].strip().lower())
        print(f"[RLHF Pipeline] Identified {len(held_out_prompts)} held-out evaluation prompts.")

    sanitized = []
    leak_count = 0
    for p in pairs:
        prompt_text = p.get("prompt", "").strip().lower()
        if prompt_text in held_out_prompts:
            leak_count += 1
            continue
        sanitized.append(p)

    print(f"[RLHF Pipeline] Sanitized pairs: {len(sanitized)} (Filtered {leak_count} eval leaks).")

    # Split 80% train, 20% validation
    split_idx = int(len(sanitized) * 0.8)
    train_data = sanitized[:split_idx]
    val_data = sanitized[split_idx:]

    with open(out_path / "train.jsonl", "w", encoding="utf-8") as f:
        for item in train_data:
            f.write(json.dumps(item) + "\n")
            
    with open(out_path / "val.jsonl", "w", encoding="utf-8") as f:
        for item in val_data:
            f.write(json.dumps(item) + "\n")

    manifest = {
        "pipeline_version": "carbonexo-rlhf-v1",
        "dataset_size": len(sanitized),
        "train_size": len(train_data),
        "val_size": len(val_data),
        "held_out_eval_leak_count": leak_count,
        "supported_models": {
            "gemini-3-flash-preview": {
                "sft": "NOT SUPPORTED (Vertex AI Preview restriction)",
                "rlhf_reward_model": "NOT SUPPORTED (Google Cloud does not offer custom RLHF on preview endpoints)"
            },
            "gemini-2.5-flash": {
                "sft": "SUPPORTED (Vertex AI supervised tuning)",
                "rlhf_reward_model": "BLOCKED (Requires custom TPU/GPU container with explicit approval)"
            }
        }
    }

    with open(out_path / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print("[RLHF Pipeline] Dataset preparation completed. Manifest written to datasets/rlhf/manifest.json")
    return manifest

if __name__ == "__main__":
    prepare_preference_dataset()
