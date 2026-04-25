import json
import re
from functools import lru_cache
from pathlib import Path

LANGUAGE_LABELS = {
    "english": "English",
    "spanish": "Spanish",
    "french": "French",
    "german": "German",
    "tagalog": "Tagalog",
    "punjabi": "Punjabi",
}

STOP_WORDS = {
    "about",
    "after",
    "also",
    "and",
    "are",
    "because",
    "been",
    "before",
    "from",
    "have",
    "into",
    "just",
    "more",
    "only",
    "should",
    "that",
    "them",
    "then",
    "they",
    "this",
    "what",
    "when",
    "where",
    "which",
    "with",
    "would",
    "your",
}


def _content_path_candidates():
    backend_dir = Path(__file__).resolve().parent
    return [
        backend_dir / "content.json",
        backend_dir.parent / "content.json",
    ]


@lru_cache(maxsize=1)
def get_content_path():
    for candidate in _content_path_candidates():
        if candidate.exists():
            return candidate

    raise FileNotFoundError(
        "Could not find content.json. Place it beside backend/lambda_function.py "
        "or in the project root before deploying."
    )


@lru_cache(maxsize=1)
def load_manuals():
    with get_content_path().open(encoding="utf-8") as infile:
        data = json.load(infile)

    return {str(key).lower(): str(value) for key, value in data.items()}


def get_available_languages():
    return sorted(load_manuals().keys())


def get_language_label(language):
    return LANGUAGE_LABELS.get(language, language.title())


def _clean_lines(text):
    cleaned = []

    for raw_line in str(text).splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            continue
        if len(line) == 1 and not line.isalnum():
            continue
        cleaned.append(line)

    return cleaned


def _infer_chunk_title(chunk_lines, index):
    for line in chunk_lines[:5]:
        if 4 <= len(line) <= 90:
            return line
    return f"Section {index + 1}"


def build_manual_chunks(text, *, target_chars=1800, overlap_lines=3):
    lines = _clean_lines(text)
    chunks = []
    start = 0
    index = 0

    while start < len(lines):
        current_length = 0
        end = start

        while end < len(lines) and current_length < target_chars:
            current_length += len(lines[end]) + 1
            end += 1

        chunk_lines = lines[start:end]
        if not chunk_lines:
            break

        chunks.append(
            {
                "index": index,
                "title": _infer_chunk_title(chunk_lines, index),
                "text": "\n".join(chunk_lines).strip(),
            }
        )
        index += 1

        if end >= len(lines):
            break

        start = max(end - overlap_lines, start + 1)

    return chunks


def build_generation_sections(language, *, target_chars=4200):
    manuals = load_manuals()
    if language not in manuals:
        raise KeyError(f"Unsupported language: {language}")

    return build_manual_chunks(
        manuals[language],
        target_chars=target_chars,
        overlap_lines=6,
    )


def _query_terms(query):
    tokens = re.findall(r"[a-z0-9']+", str(query).lower())
    return [token for token in tokens if len(token) > 2 and token not in STOP_WORDS]


def _score_chunk(chunk, query, terms):
    text = chunk["text"].lower()
    title = chunk["title"].lower()
    lowered_query = str(query).strip().lower()
    score = 0

    if lowered_query and lowered_query in text:
        score += 12

    for term in terms:
        score += text.count(term) * 2
        if term in title:
            score += 4

    if terms and all(term in text for term in terms[:2]):
        score += 3

    return score


def find_relevant_manual_excerpt(language, query, *, max_chunks=2):
    manuals = load_manuals()
    candidates = [language]

    if language != "english" and "english" in manuals:
        candidates.append("english")

    best_result = None
    terms = _query_terms(query)

    for candidate_language in candidates:
        chunks = build_manual_chunks(
            manuals[candidate_language],
            target_chars=1400,
            overlap_lines=4,
        )

        scored = [
            {
                "score": _score_chunk(chunk, query, terms),
                "chunk": chunk,
            }
            for chunk in chunks
        ]
        scored.sort(
            key=lambda item: (item["score"], -item["chunk"]["index"]),
            reverse=True,
        )

        selected = [item for item in scored[:max_chunks] if item["score"] > 0]
        if not selected:
            selected = scored[:1]

        if not selected:
            continue

        result = {
            "language": candidate_language,
            "score": sum(item["score"] for item in selected),
            "source_titles": [item["chunk"]["title"] for item in selected],
            "excerpt": "\n\n".join(
                f"[{item['chunk']['title']}]\n{item['chunk']['text']}"
                for item in selected
            ).strip(),
        }

        if best_result is None or result["score"] > best_result["score"]:
            best_result = result

    if best_result is None:
        raise RuntimeError("Could not build a manual excerpt from content.json")

    return best_result
