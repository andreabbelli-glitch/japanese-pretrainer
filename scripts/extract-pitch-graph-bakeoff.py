#!/usr/bin/env python3
import argparse
import json
import math
import os
import tempfile
from typing import Any

import librosa
import numpy as np
import parselmouth
import pyworld
from scipy.io import wavfile


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", required=True)
    parser.add_argument("--sample-rate", default=16000, type=int)
    parser.add_argument("--hop-ms", default=10, type=float)
    args = parser.parse_args()

    y, sample_rate = librosa.load(args.audio, sr=args.sample_rate, mono=True)
    duration_ms = round((len(y) / sample_rate) * 1000)
    result: dict[str, Any] = {
        "durationMs": duration_ms,
        "errors": {},
        "extractors": {},
        "sampleIntervalMs": round(args.hop_ms),
    }

    run_extractor(result, "worldHarvest", lambda: extract_world(y, sample_rate, args.hop_ms))
    run_extractor(
        result, "praatRaw", lambda: extract_praat(y, sample_rate, args.hop_ms)
    )
    run_extractor(result, "pyinRaw", lambda: extract_pyin(y, sample_rate, args.hop_ms))

    print(json.dumps(result, ensure_ascii=False))


def run_extractor(result: dict[str, Any], key: str, extractor) -> None:
    try:
        result["extractors"][key] = {"rawValues": clean_values(extractor())}
    except Exception as error:  # pragma: no cover - surfaced in the JSON report.
        result["errors"][key] = str(error)


def extract_world(y: np.ndarray, sample_rate: int, hop_ms: float) -> np.ndarray:
    f0, time_axis = pyworld.harvest(
        y.astype(np.float64),
        sample_rate,
        f0_floor=50.0,
        f0_ceil=500.0,
        frame_period=hop_ms,
    )
    return pyworld.stonemask(y.astype(np.float64), f0, time_axis, sample_rate)


def extract_praat(y: np.ndarray, sample_rate: int, hop_ms: float) -> np.ndarray:
    pcm = np.clip(y, -1.0, 1.0)
    pcm = (pcm * 32767).astype(np.int16)
    temp_path = ""

    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            temp_path = temp_file.name

        wavfile.write(temp_path, sample_rate, pcm)
        sound = parselmouth.Sound(temp_path)
        pitch = sound.to_pitch(
            time_step=hop_ms / 1000,
            pitch_floor=50.0,
            pitch_ceiling=500.0,
        )

        return pitch.selected_array["frequency"]
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
            except FileNotFoundError:
                pass


def extract_pyin(y: np.ndarray, sample_rate: int, hop_ms: float) -> np.ndarray:
    hop_length = max(1, round(sample_rate * hop_ms / 1000))
    f0, _, _ = librosa.pyin(
        y,
        fmin=50.0,
        fmax=500.0,
        frame_length=1024,
        hop_length=hop_length,
        sr=sample_rate,
    )
    return f0


def clean_values(values: np.ndarray) -> list[float]:
    cleaned: list[float] = []

    for value in values:
        number = float(value)
        if math.isfinite(number) and number > 0:
            cleaned.append(round(number, 1))
        else:
            cleaned.append(0)

    return cleaned


if __name__ == "__main__":
    main()
