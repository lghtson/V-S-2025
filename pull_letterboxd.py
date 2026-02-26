import os
import time
import random
import pandas as pd

from letterboxdpy.search import Search
from letterboxdpy.movie import Movie

INPUT_CSV = "imdb_top250_full.csv"
OUTPUT_CSV = "imdb_top250_with_letterboxd.csv"
CHECKPOINT_EVERY = 10  # save every 10 films


def polite_sleep():
    time.sleep(0.6 + random.random() * 1.0)


def main():
    src = pd.read_csv(INPUT_CSV)

    # Resume support
    if os.path.exists(OUTPUT_CSV):
        out = pd.read_csv(OUTPUT_CSV)
        done = set(out["tconst"].astype(str))
        print(f"Resuming: {len(done)} already done.")
    else:
        out = pd.DataFrame()
        done = set()

    buffer = []

    for i, row in src.iterrows():
        tconst = str(row["tconst"]).strip()
        if tconst in done:
            continue

        title = str(row.get("primaryTitle", "")).strip()
        year = str(row.get("startYear", "")).strip()

        print(f"[{i+1}/{len(src)}] {tconst} — {title} ({year})")

        lb_slug = None
        lb_url = None
        lb_rating = None

        # 1) Find slug via IMDb operator (most reliable)
        try:
            res = Search(f"imdb:{tconst}", "films").get_results(max=1)
            if res.get("available") and res.get("results"):
                hit = res["results"][0]
                lb_slug = hit.get("slug")
                lb_url = hit.get("url")
        except Exception as e:
            print("  Search(imdb:...) failed:", e)

        polite_sleep()

        # 2) Pull rating via Movie(slug)
        if lb_slug:
            try:
                m = Movie(lb_slug)
                md = m.__dict__ if hasattr(m, "__dict__") else {}

                # letterboxdpy returns rating as float out of 5 (when available)
                lb_rating = md.get("rating")

                # If url missing from search, try from movie payload
                if not lb_url:
                    lb_url = md.get("url")

            except Exception as e:
                print("  Movie(slug) failed:", e)

        out_row = dict(row)
        out_row.update({
            "letterboxdSlug": lb_slug,
            "letterboxdUrl": lb_url,
            "letterboxdRatingOutOf5": lb_rating,
        })
        buffer.append(out_row)

        # checkpoint
        if len(buffer) % CHECKPOINT_EVERY == 0:
            out = pd.concat([out, pd.DataFrame(buffer)], ignore_index=True)
            # preserve official order if present
            if "imdbTop250Rank" in out.columns:
                out = out.sort_values("imdbTop250Rank")
            out.to_csv(OUTPUT_CSV, index=False)
            buffer = []
            print(f"  ✅ checkpoint saved ({OUTPUT_CSV})")

        polite_sleep()

    # final flush
    if buffer:
        out = pd.concat([out, pd.DataFrame(buffer)], ignore_index=True)

    if "imdbTop250Rank" in out.columns:
        out = out.sort_values("imdbTop250Rank")

    out.to_csv(OUTPUT_CSV, index=False)
    print("✅ Done. Saved:", OUTPUT_CSV)


if __name__ == "__main__":
    main()