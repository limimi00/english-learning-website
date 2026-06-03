#!/usr/bin/env python3
import argparse
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree


VOCAB_HEADINGS = {
    "new words",
    "words",
    "vocabulary",
    "people",
    "place",
    "places",
    "country / city",
    "country",
    "city",
    "things",
    "color",
    "colors",
    "adjectives",
    "jobs",
    "food",
    "daily life",
    "days of the week",
}

STOP_HEADINGS = {
    "translate",
    "grammar",
    "listening",
    "answer the questions",
    "questions",
    "exercise",
    "complete",
    "match",
    "write",
}


def read_docx_text(path):
    with zipfile.ZipFile(path) as archive:
        xml = archive.read("word/document.xml")

    root = ElementTree.fromstring(xml)
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = []

    for paragraph in root.findall(".//w:p", namespace):
        chunks = []
        for node in paragraph.findall(".//w:t", namespace):
            chunks.append(node.text or "")
        text = "".join(chunks).strip()
        if text:
            paragraphs.append(text)

    return "\n".join(paragraphs)


def parse_lesson_text(text, lesson_id, title):
    lines = [clean_line(line) for line in text.splitlines()]
    lines = [line for line in lines if line]

    vocabulary = []
    sentences = []
    questions = []
    translations = []
    grammar = []
    mode = None
    category = "general"

    for line in lines:
        lower = normalize_heading(line)

        if lower in VOCAB_HEADINGS:
            mode = "vocab"
            category = lower
            continue

        if is_reading_heading(lower):
            mode = "sentences"
            continue

        if lower.startswith("translate"):
            mode = "translate"
            continue

        if "answer the questions" in lower or lower == "questions":
            mode = "questions"
            continue

        if lower == "grammar":
            mode = "grammar"
            continue

        if lower in STOP_HEADINGS:
            mode = None
            continue

        if mode == "vocab" and looks_like_vocab(line):
            for term in split_vocab_line(line):
                vocabulary.append({"en": term, "cn": "", "category": category})
            continue

        if mode == "sentences" and looks_like_sentence(line):
            sentences.append(strip_number(line))
            continue

        if mode == "questions" and "?" in line:
            questions.append(strip_number(line))
            continue

        if mode == "translate" and contains_cjk(line):
            translations.append({"cn": strip_number(line), "en": ""})
            continue

        if mode == "grammar" and len(line) < 80:
            grammar.append(line)

    return {
        "id": lesson_id,
        "title": title,
        "grammar": dedupe_strings(grammar),
        "vocabulary": dedupe_vocab(vocabulary),
        "sentences": dedupe_strings(sentences),
        "translations": translations,
        "questions": dedupe_strings(questions),
    }


def clean_line(line):
    return (
        line.replace("\u2022", " ")
        .replace("\t", " ")
        .replace("\xa0", " ")
        .strip()
    )


def normalize_heading(line):
    return re.sub(r"[:：]+$", "", line.strip().lower())


def is_reading_heading(lower):
    return lower.startswith("reading") or lower.startswith("text") or lower.startswith("examples") or lower == "example"


def looks_like_vocab(line):
    if contains_cjk(line):
        return False
    if len(line) > 60:
        return False
    if re.search(r"[.!?。！？]", line):
        return False
    return bool(re.search(r"[A-Za-z]", line))


def split_vocab_line(line):
    cleaned = strip_number(line)
    cleaned = re.sub(r"^[-–—]\s*", "", cleaned)
    cleaned = re.sub(r"/[^/]+/", "", cleaned).strip()
    pieces = re.split(r"\s{2,}|[，,]\s+| - ", cleaned)
    return [piece.strip() for piece in pieces if piece.strip()]


def looks_like_sentence(line):
    return bool(re.search(r"[.!?]", line)) and bool(re.search(r"[A-Za-z]", line))


def strip_number(line):
    return re.sub(r"^\s*\d+[\.)]?\s*", "", line).strip()


def contains_cjk(line):
    return bool(re.search(r"[\u4e00-\u9fff]", line))


def dedupe_strings(items):
    seen = set()
    result = []
    for item in items:
        key = item.lower()
        if key not in seen:
            seen.add(key)
            result.append(item)
    return result


def dedupe_vocab(items):
    seen = set()
    result = []
    for item in items:
        key = re.sub(r"\s+", " ", item["en"].lower()).strip()
        if key and key not in seen:
            seen.add(key)
            result.append(item)
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description="Convert a lesson DOCX file into starter lesson JSON.")
    parser.add_argument("docx", help="Path to the .docx lesson file")
    parser.add_argument("--id", dest="lesson_id", help="Lesson id, for example part-7")
    parser.add_argument("--title", help="Lesson title")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON")
    args = parser.parse_args(argv)

    path = Path(args.docx)
    lesson_id = args.lesson_id or re.sub(r"[^a-z0-9]+", "-", path.stem.lower()).strip("-")
    title = args.title or path.stem
    result = parse_lesson_text(read_docx_text(path), lesson_id=lesson_id, title=title)
    json.dump(result, sys.stdout, ensure_ascii=False, indent=2 if args.pretty else None)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
