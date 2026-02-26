import os
import time
import json
import requests
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

IN_CSV = "imdb_top250_with_lb_rt_mc.csv"
OUT_CSV = "imdb_top250_with_lb_rt_mc.csv"
API_KEY = os.getenv("OMDB_API_KEY")

if not API_KEY:
    raise RuntimeError("Missing OMDB_API_KEY in environment. Put it in .env and retry.")

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "Mozilla/5.0 (Top250StudentProject/1.0)"})

def fetch_omdb(tconst: str) -> dict | None:
    r = SESSION.get(
        "https://www.omdbapi.com/",
        params={"i": tconst, "apikey": API_KEY, "tomatoes": "true"},
        timeout=25,
    )
    r.raise_for_status()
    data = r.json()
    return data if data.get("Response") == "True" else None

def parse_rt_percent(omdb_data: dict) -> int | None:
    for item in omdb_data.get("Ratings", []) or []:
        if item.get("Source") == "Rotten Tomatoes":
            val = item.get("Value", "")
            if isinstance(val, str) and val.endswith("%"):
                try:
                    return int(val[:-1])
                except ValueError:
                    return None
    return None

def parse_metascore(omdb_data: dict) -> int | None:
    ms = omdb_data.get("Metascore")
    if ms in (None, "N/A"):
        return None
    try:
        return int(ms)
    except ValueError:
        return None

def main():
    df = pd.read_csv(IN_CSV)

    rt_vals = []
    mc_vals = []
    omdb_ratings_raw = []
    omdb_title = []
    omdb_year = []

    for idx, tconst in enumerate(df["tconst"].astype(str), start=1):
        print(f"[{idx}/{len(df)}] {tconst}")

        data = fetch_omdb(tconst)
        if not data:
            rt_vals.append(None)
            mc_vals.append(None)
            omdb_ratings_raw.append(None)
            omdb_title.append(None)
            omdb_year.append(None)
        else:
            rt_vals.append(parse_rt_percent(data))
            mc_vals.append(parse_metascore(data))
            omdb_ratings_raw.append(json.dumps(data.get("Ratings", [])))
            omdb_title.append(data.get("Title"))
            omdb_year.append(data.get("Year"))

        # be polite; also reduces chance of transient blocks
        time.sleep(0.25)

    df["rottenTomatoesPercent"] = rt_vals           # 0–100
    df["metacriticScore"] = mc_vals                # 0–100
    df["omdbRatingsRawJson"] = omdb_ratings_raw     # for debugging/audit
    df["omdbTitle"] = omdb_title
    df["omdbYear"] = omdb_year

    # keep your canonical ordering if present
    if "imdbTop250Rank" in df.columns:
        df = df.sort_values("imdbTop250Rank")

    df.to_csv(OUT_CSV, index=False)
    print("Saved:", OUT_CSV)

if __name__ == "__main__":
    main()