"""faster-whisper 기반 트랜스크립션 스크립트 (청크 병렬 처리).

Usage:
    python transcribe.py <audio_path> [--language ko] [--model small] [--workers 4] [--chunk-sec 300]

stdout으로 트랜스크립션 텍스트를 출력한다.
진행 상황은 stderr로 출력한다.
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import time
from multiprocessing import Pool, current_process

# 워커 프로세스 전역 모델 참조
_worker_model = None
_worker_language = None
_worker_total_chunks = 0


def get_audio_duration(audio_path: str) -> float:
    """오디오 파일의 길이(초)를 반환한다."""
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v", "quiet",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                audio_path,
            ],
            capture_output=True,
            text=True,
        )
        return float(result.stdout.strip())
    except Exception:
        return 0.0


def format_time(seconds: float) -> str:
    """초를 MM:SS 형식으로 변환한다."""
    m, s = divmod(int(seconds), 60)
    return f"{m:02d}:{s:02d}"


def split_audio(audio_path: str, chunk_sec: int, temp_dir: str) -> list[str]:
    """오디오를 chunk_sec 단위로 분할하여 청크 파일 경로 목록을 반환한다."""
    duration = get_audio_duration(audio_path)
    if duration <= 0 or duration <= chunk_sec:
        return [audio_path]

    chunks: list[str] = []
    start = 0.0
    idx = 0
    while start < duration:
        chunk_path = os.path.join(temp_dir, f"chunk_{idx:04d}.wav")
        result = subprocess.run(
            [
                "ffmpeg", "-y",
                "-ss", str(start),
                "-i", audio_path,
                "-t", str(chunk_sec),
                "-acodec", "pcm_s16le",
                "-ar", "16000",
                "-ac", "1",
                chunk_path,
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            sys.stderr.write(
                f"[transcribe] 청크 분할 실패 (idx={idx}): {result.stderr[:200]}\n"
            )
            sys.stderr.flush()
            break
        chunks.append(chunk_path)
        start += chunk_sec
        idx += 1

    return chunks if chunks else [audio_path]


def init_worker(model_name: str, language: str, total_chunks: int) -> None:
    """워커 프로세스 초기화: 모델을 한 번만 로드한다."""
    global _worker_model, _worker_language, _worker_total_chunks
    from faster_whisper import WhisperModel

    _worker_model = WhisperModel(model_name, compute_type="int8", cpu_threads=2)
    _worker_language = language
    _worker_total_chunks = total_chunks
    sys.stderr.write(f"[transcribe] 워커 {current_process().name} 모델 로딩 완료\n")
    sys.stderr.flush()


def transcribe_chunk(chunk_info: tuple[int, str]) -> tuple[int, str, float]:
    """단일 청크를 트랜스크립션한다. (인덱스, 텍스트, 소요시간) 반환."""
    idx, chunk_path = chunk_info
    global _worker_model, _worker_language, _worker_total_chunks

    chunk_label = f"청크 {idx + 1}/{_worker_total_chunks}"
    worker_name = current_process().name

    sys.stderr.write(f"[transcribe] [{worker_name}] {chunk_label} 처리 시작\n")
    sys.stderr.flush()

    chunk_start = time.time()
    chunk_duration = get_audio_duration(chunk_path)

    segments, _ = _worker_model.transcribe(
        chunk_path,
        language=_worker_language,
        vad_filter=True,
    )

    text_parts: list[str] = []
    last_report = time.time()
    for segment in segments:
        text_parts.append(segment.text)

        now = time.time()
        if now - last_report >= 5.0 and chunk_duration > 0:
            elapsed = now - chunk_start
            progress = segment.end / chunk_duration * 100
            sys.stderr.write(
                f"[transcribe] [{worker_name}] {chunk_label} "
                f"진행: {progress:.0f}% | 경과: {format_time(elapsed)}\n"
            )
            sys.stderr.flush()
            last_report = now

    chunk_elapsed = time.time() - chunk_start
    result_text = "".join(text_parts)
    sys.stderr.write(
        f"[transcribe] [{worker_name}] {chunk_label} 완료 "
        f"({len(result_text)}자, {format_time(chunk_elapsed)})\n"
    )
    sys.stderr.flush()
    return (idx, result_text, chunk_elapsed)


def transcribe_single(audio_path: str, model_name: str, language: str) -> None:
    """청크가 1개일 때 기존 방식으로 처리한다."""
    from faster_whisper import WhisperModel

    sys.stderr.write("[transcribe] 모델 로딩 중...\n")
    sys.stderr.flush()

    load_start = time.time()
    model = WhisperModel(model_name, compute_type="int8", cpu_threads=2)
    load_elapsed = time.time() - load_start
    sys.stderr.write(f"[transcribe] 모델 로딩 완료 ({load_elapsed:.1f}초)\n")
    sys.stderr.write("[transcribe] 트랜스크립션 시작...\n")
    sys.stderr.flush()

    duration = get_audio_duration(audio_path)
    transcribe_start = time.time()
    segments, info = model.transcribe(
        audio_path,
        language=language,
        vad_filter=True,
    )

    if duration > 0:
        sys.stderr.write(
            f"[transcribe] 감지된 언어: {info.language} "
            f"(확률: {info.language_probability:.1%})\n"
        )
        sys.stderr.flush()

    segment_count = 0
    last_report = time.time()
    for segment in segments:
        sys.stdout.write(segment.text)
        segment_count += 1

        now = time.time()
        if now - last_report >= 5.0:
            elapsed = now - transcribe_start
            progress = segment.end / duration * 100 if duration > 0 else 0
            remaining = (
                (elapsed / segment.end * (duration - segment.end))
                if segment.end > 0 and duration > 0
                else 0
            )
            sys.stderr.write(
                f"[transcribe] 진행: {progress:.0f}% | "
                f"경과: {format_time(elapsed)} | "
                f"남은 예상: {format_time(remaining)}\n"
            )
            sys.stderr.flush()
            last_report = now

    total_elapsed = time.time() - transcribe_start
    sys.stderr.write(
        f"[transcribe] 완료! 세그먼트: {segment_count}개 | "
        f"총 소요: {format_time(total_elapsed)}\n"
    )
    sys.stderr.flush()


def main() -> None:
    parser = argparse.ArgumentParser(description="faster-whisper transcriber (parallel)")
    parser.add_argument("audio_path", help="오디오 파일 경로")
    parser.add_argument("--language", default="ko", help="언어 코드 (기본: ko)")
    parser.add_argument("--model", default="small", help="모델 이름 (기본: small)")
    parser.add_argument(
        "--workers", type=int, default=2,
        help="병렬 워커 수 (기본: 4, small 기준 워커당 ~1.0GB RAM)",
    )
    parser.add_argument(
        "--chunk-sec", type=int, default=300,
        help="청크 길이 초 (기본: 300 = 5분)",
    )
    args = parser.parse_args()

    file_size_mb = os.path.getsize(args.audio_path) / (1024 * 1024)
    duration = get_audio_duration(args.audio_path)

    sys.stderr.write(f"[transcribe] 파일: {os.path.basename(args.audio_path)}\n")
    sys.stderr.write(f"[transcribe] 크기: {file_size_mb:.1f} MB\n")
    if duration > 0:
        sys.stderr.write(f"[transcribe] 오디오 길이: {format_time(duration)}\n")
    sys.stderr.write(f"[transcribe] 모델: {args.model}\n")
    sys.stderr.write(f"[transcribe] 워커: {args.workers}개 | 청크: {args.chunk_sec}초\n")
    sys.stderr.flush()

    # 짧은 오디오는 분할 없이 처리
    if duration > 0 and duration <= args.chunk_sec:
        sys.stderr.write("[transcribe] 청크 분할 불필요 (단일 처리)\n")
        sys.stderr.flush()
        transcribe_single(args.audio_path, args.model, args.language)
        sys.stdout.write("\n")
        sys.stdout.flush()
        return

    # 청크 분할
    temp_dir = tempfile.mkdtemp(prefix="whisper_chunks_")
    try:
        sys.stderr.write("[transcribe] 오디오 분할 중...\n")
        sys.stderr.flush()

        split_start = time.time()
        chunks = split_audio(args.audio_path, args.chunk_sec, temp_dir)
        split_elapsed = time.time() - split_start
        sys.stderr.write(
            f"[transcribe] 분할 완료: {len(chunks)}개 청크 ({split_elapsed:.1f}초)\n"
        )
        sys.stderr.flush()

        if len(chunks) <= 1:
            transcribe_single(
                chunks[0] if chunks else args.audio_path,
                args.model,
                args.language,
            )
        else:
            total_chunks = len(chunks)
            actual_workers = min(args.workers, total_chunks)
            sys.stderr.write(
                f"[transcribe] 병렬 트랜스크립션 시작 "
                f"(워커 {actual_workers}개, 청크 {total_chunks}개)...\n"
            )
            sys.stderr.flush()

            transcribe_start = time.time()
            chunk_inputs = list(enumerate(chunks))
            collected: list[tuple[int, str, float]] = []

            with Pool(
                processes=actual_workers,
                initializer=init_worker,
                initargs=(args.model, args.language, total_chunks),
            ) as pool:
                for result in pool.imap_unordered(transcribe_chunk, chunk_inputs):
                    collected.append(result)
                    done = len(collected)
                    elapsed = time.time() - transcribe_start
                    avg_per_chunk = elapsed / done
                    remaining = avg_per_chunk * (total_chunks - done) / actual_workers
                    progress = done / total_chunks * 100

                    sys.stderr.write(
                        f"[transcribe] === 전체 진행: {done}/{total_chunks} "
                        f"({progress:.0f}%) | "
                        f"경과: {format_time(elapsed)} | "
                        f"남은 예상: {format_time(remaining)} ===\n"
                    )
                    sys.stderr.flush()

            collected.sort(key=lambda x: x[0])
            full_text = "".join(text for _, text, _ in collected)

            total_elapsed = time.time() - transcribe_start
            sys.stderr.write(
                f"[transcribe] 완료! 청크: {total_chunks}개 | "
                f"총 {len(full_text)}자 | "
                f"총 소요: {format_time(total_elapsed)}\n"
            )
            sys.stderr.flush()

            sys.stdout.write(full_text)

        sys.stdout.write("\n")
        sys.stdout.flush()
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
