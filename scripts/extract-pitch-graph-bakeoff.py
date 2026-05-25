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

    run_extractor(
        result,
        "onseiPraat",
        lambda: extract_onsei_praat(y, sample_rate),
        sample_interval_ms=5,
    )
    run_swift_f0_extractors(result, y, sample_rate)
    run_extractor(result, "worldHarvest", lambda: extract_world(y, sample_rate, args.hop_ms))
    run_extractor(
        result, "praatRaw", lambda: extract_praat(y, sample_rate, args.hop_ms)
    )
    run_extractor(result, "pyinRaw", lambda: extract_pyin(y, sample_rate, args.hop_ms))

    print(json.dumps(result, ensure_ascii=False))


def run_extractor(
    result: dict[str, Any], key: str, extractor, sample_interval_ms: float | None = None
) -> None:
    try:
        extractor_output = normalize_extractor_output(extractor())
        output = {"rawValues": clean_values(extractor_output["values"])}
        if extractor_output["timestamps_ms"] is not None:
            output["timestampsMs"] = clean_timestamps(
                extractor_output["timestamps_ms"]
            )
        if sample_interval_ms is not None:
            output["sampleIntervalMs"] = round(sample_interval_ms)
        result["extractors"][key] = output
    except Exception as error:  # pragma: no cover - surfaced in the JSON report.
        result["errors"][key] = str(error)


def normalize_extractor_output(output) -> dict[str, Any]:
    if isinstance(output, tuple):
        values, timestamps = output
        return {"values": values, "timestamps_ms": np.asarray(timestamps) * 1000}

    return {"values": output, "timestamps_ms": None}


def extract_world(y: np.ndarray, sample_rate: int, hop_ms: float) -> np.ndarray:
    f0, time_axis = pyworld.harvest(
        y.astype(np.float64),
        sample_rate,
        f0_floor=50.0,
        f0_ceil=500.0,
        frame_period=hop_ms,
    )
    return (
        pyworld.stonemask(y.astype(np.float64), f0, time_axis, sample_rate),
        time_axis,
    )


def extract_praat(y: np.ndarray, sample_rate: int, hop_ms: float) -> np.ndarray:
    return extract_praat_from_temp_wav(
        y,
        sample_rate,
        lambda sound: sound.to_pitch(
            time_step=hop_ms / 1000,
            pitch_floor=50.0,
            pitch_ceiling=500.0,
        ),
    )


def extract_onsei_praat(y: np.ndarray, sample_rate: int) -> np.ndarray:
    # Mirrors itsupera/onsei's SpeechRecord pitch path:
    # Sound.to_pitch(time_step=0.005).kill_octave_jumps().smooth().
    return extract_praat_from_temp_wav(
        y,
        sample_rate,
        lambda sound: sound.to_pitch(time_step=0.005)
        .kill_octave_jumps()
        .smooth(),
    )


def extract_praat_from_temp_wav(y: np.ndarray, sample_rate: int, extractor) -> np.ndarray:
    pcm = np.clip(y, -1.0, 1.0)
    pcm = (pcm * 32767).astype(np.int16)
    temp_path = ""

    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            temp_path = temp_file.name

        wavfile.write(temp_path, sample_rate, pcm)
        sound = parselmouth.Sound(temp_path)
        pitch = extractor(sound)
        return pitch.selected_array["frequency"], pitch.xs()
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
    timestamps = librosa.frames_to_time(
        np.arange(len(f0)), sr=sample_rate, hop_length=hop_length
    )

    return f0, timestamps


def run_swift_f0_extractors(
    result: dict[str, Any], y: np.ndarray, sample_rate: int
) -> None:
    try:
        from swift_f0 import SwiftF0

        detector = SwiftF0(
            confidence_threshold=0.9,
            fmin=65.0,
            fmax=400.0,
        )
        detection = detector.detect_from_array(y.astype(np.float32), sample_rate)
        sample_interval_ms = calculate_swift_sample_interval_ms(detection.timestamps)
        raw_values = clean_values(detection.pitch_hz)
        normalized_values = normalize_swift_values(
            detection.pitch_hz,
            detection.voicing,
        )
        smoothed_values = smooth_pitch_values(normalized_values)

        result["extractors"]["swiftF0Raw"] = {
            "rawValues": raw_values,
            "sampleIntervalMs": sample_interval_ms,
            "timestampsMs": clean_timestamps(detection.timestamps * 1000),
        }
        result["extractors"]["swiftF0Normalized"] = {
            "rawValues": normalized_values,
            "sampleIntervalMs": sample_interval_ms,
            "timestampsMs": clean_timestamps(detection.timestamps * 1000),
        }
        result["extractors"]["swiftF0Smoothed"] = {
            "rawValues": smoothed_values,
            "sampleIntervalMs": sample_interval_ms,
            "timestampsMs": clean_timestamps(detection.timestamps * 1000),
        }
    except Exception as error:  # pragma: no cover - surfaced in the JSON report.
        message = str(error)
        result["errors"]["swiftF0Raw"] = message
        result["errors"]["swiftF0Normalized"] = message
        result["errors"]["swiftF0Smoothed"] = message


def calculate_swift_sample_interval_ms(timestamps: np.ndarray) -> int:
    if len(timestamps) > 1:
        return max(1, round(float(np.median(np.diff(timestamps))) * 1000))

    return 16


def normalize_swift_values(
    pitch_hz: np.ndarray, voicing: np.ndarray
) -> list[float]:
    normalized: list[float] = []

    for pitch, voiced in zip(pitch_hz, voicing):
        number = float(pitch)
        if voiced and math.isfinite(number) and number > 0:
            normalized.append(round(number, 1))
        else:
            normalized.append(0)

    return normalized


def smooth_pitch_values(values: list[float]) -> list[float]:
    if not values:
        return []

    interpolated = interpolate_short_gaps(np.array(values, dtype=np.float64), max_gap=3)
    smoothed = np.zeros_like(interpolated)
    index = 0

    while index < len(interpolated):
        if interpolated[index] <= 0:
            index += 1
            continue

        start = index
        while index < len(interpolated) and interpolated[index] > 0:
            index += 1

        segment = interpolated[start:index]
        smoothed[start:index] = smooth_segment(segment)

    return clean_values(smoothed)


def interpolate_short_gaps(values: np.ndarray, max_gap: int) -> np.ndarray:
    output = values.copy()
    index = 0

    while index < len(output):
        if output[index] > 0:
            index += 1
            continue

        start = index
        while index < len(output) and output[index] <= 0:
            index += 1

        end = index
        gap_length = end - start
        if (
            0 < start
            and end < len(output)
            and output[start - 1] > 0
            and output[end] > 0
            and gap_length <= max_gap
        ):
            output[start:end] = np.linspace(
                output[start - 1],
                output[end],
                gap_length + 2,
            )[1:-1]

    return output


def smooth_segment(segment: np.ndarray) -> np.ndarray:
    if len(segment) < 3:
        return segment

    window_size = min(5, len(segment))
    if window_size % 2 == 0:
        window_size -= 1
    if window_size < 3:
        return segment

    kernel = np.ones(window_size, dtype=np.float64) / window_size
    padding = window_size // 2
    padded = np.pad(segment, (padding, padding), mode="edge")

    return np.convolve(padded, kernel, mode="valid")


def clean_values(values: np.ndarray) -> list[float]:
    cleaned: list[float] = []

    for value in values:
        number = float(value)
        if math.isfinite(number) and number > 0:
            cleaned.append(round(number, 1))
        else:
            cleaned.append(0)

    return cleaned


def clean_timestamps(values: np.ndarray) -> list[float]:
    cleaned: list[float] = []

    for value in values:
        number = float(value)
        if math.isfinite(number):
            cleaned.append(round(number * 10) / 10)

    return cleaned


if __name__ == "__main__":
    main()
