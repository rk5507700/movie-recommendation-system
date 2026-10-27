"""Build a compact, browser-ready top-neighbor index from the project CSV."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

TEXT_COLUMNS = ["genres", "overview", "keywords", "cast", "director"]


def clean_text(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9\s]", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=Path("movie_recommendation_dataset.csv"))
    parser.add_argument("--output", type=Path, default=Path("recommendation_model.json"))
    parser.add_argument("--neighbors", type=int, default=15)
    parser.add_argument("--chunk-size", type=int, default=64)
    args = parser.parse_args()
    if args.neighbors < 1 or args.chunk_size < 1:
        parser.error("--neighbors and --chunk-size must be positive")

    frame = pd.read_csv(args.dataset)
    required = ["title", *TEXT_COLUMNS]
    missing_columns = [name for name in required if name not in frame.columns]
    if missing_columns:
        parser.error(f"dataset is missing columns: {', '.join(missing_columns)}")
    for column in required:
        frame[column] = frame[column].fillna("").astype(str)

    descriptions = frame[TEXT_COLUMNS].agg(" ".join, axis=1).apply(clean_text)
    vectorizer = TfidfVectorizer(stop_words="english")
    matrix = vectorizer.fit_transform(descriptions)
    movie_count = len(frame)
    limit = min(args.neighbors, max(0, movie_count - 1))
    recommendations: list[list[list[float | int]]] = []

    for start in range(0, movie_count, args.chunk_size):
        stop = min(start + args.chunk_size, movie_count)
        similarities = cosine_similarity(matrix[start:stop], matrix, dense_output=True)
        for offset, row in enumerate(similarities):
            source_index = start + offset
            ranked_indices = np.argsort(-row, kind="stable")
            selected = [int(i) for i in ranked_indices if int(i) != source_index][:limit]
            recommendations.append([[i, round(float(row[i]), 8)] for i in selected])
        print(f"Indexed similarity rows {stop:,}/{movie_count:,}")

    artifact = {
        "format": "cinematch-neighbor-index-v1",
        "method": "TF-IDF over genres, overview, keywords, cast, and director; cosine similarity",
        "movie_count": movie_count,
        "feature_count": int(matrix.shape[1]),
        "neighbors_per_movie": limit,
        "movies": [
            {"title": row.title, "genres": row.genres}
            for row in frame[["title", "genres"]].itertuples(index=False)
        ],
        "recommendations": recommendations,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as output_file:
        json.dump(artifact, output_file, ensure_ascii=False, separators=(",", ":"))
        output_file.write("\n")
    print(f"Saved {movie_count:,} movies × {limit} neighbors, {matrix.shape[1]:,} terms to {args.output}")


if __name__ == "__main__":
    main()
