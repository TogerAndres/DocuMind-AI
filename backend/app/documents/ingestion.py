"""
Ingestion pipeline: file -> extracted text (per page) -> overlapping chunks.

Design notes for the README / interview talking points:
- PDFs are parsed page-by-page with PyMuPDF so every chunk can keep a
  `page_number` for citations in the UI.
- Chunking uses a sliding window measured in characters (fast, dependency-free)
  with a configurable overlap so a sentence split across a chunk boundary
  still has context on both sides.
- .md and .txt files are treated as a single "page" (page_number = None).
"""

from __future__ import annotations

from dataclasses import dataclass

import fitz  # PyMuPDF


@dataclass
class ExtractedPage:
    page_number: int | None
    text: str


@dataclass
class TextChunk:
    chunk_index: int
    page_number: int | None
    text: str


def extract_pages(file_path: str, file_type: str) -> list[ExtractedPage]:
    if file_type == "pdf":
        pages = []
        with fitz.open(file_path) as doc:
            for i, page in enumerate(doc):
                text = page.get_text("text").strip()
                if text:
                    pages.append(ExtractedPage(page_number=i + 1, text=text))
        return pages

    # markdown / plain text
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read().strip()
    return [ExtractedPage(page_number=None, text=content)] if content else []


def chunk_pages(
    pages: list[ExtractedPage], chunk_size: int = 800, overlap: int = 150
) -> list[TextChunk]:
    if overlap >= chunk_size:
        overlap = max(0, chunk_size // 4)

    chunks: list[TextChunk] = []
    idx = 0
    step = chunk_size - overlap

    for page in pages:
        text = " ".join(page.text.split())  # normalize whitespace
        if not text:
            continue

        start = 0
        length = len(text)
        while start < length:
            end = min(start + chunk_size, length)
            piece = text[start:end].strip()
            if piece:
                chunks.append(
                    TextChunk(chunk_index=idx, page_number=page.page_number, text=piece)
                )
                idx += 1
            if end == length:
                break
            start += step

    return chunks
