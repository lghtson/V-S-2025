import time
import random
import requests
import pandas as pd
from bs4 import BeautifulSoup

FILE = "IMDb_top250_with_lb_rt_mc.csv"

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Top250ResearchProject/1.0)"
})

def slugify(title):
    slug = (
        title.lower()
        .replace(" ", "-")
        .replace(":", "")
        .replace("'", "")
        .replace(",", "")
        .replace(".", "")
    )
    return slug

def get_metacritic_user_score(title):
    slug = slugify(title)
    url = f"https://www.metacritic.com/movie/{slug}"

    try:
        r = session.get(url, timeout=20)
        if r.status_code != 200:
            return None

        soup = BeautifulSoup(r.text, "html.parser")

        block = soup.find("div", class_="c-siteReviewScore_user")
        if not block:
            return None

        score_span = block.find("span")
        if not score_span:
            return None

        return float(score_span.text.strip())

    except:
        return None

df = pd.read_csv(FILE)

# Only fetch for rows missing the column
if "metacriticUserScore" not in df.columns:
    df["metacriticUserScore"] = None

for i, row in df.iterrows():
    if pd.notna(row["metacriticUserScore"]):
        continue

    print(f"[{i+1}/{len(df)}] {row['primaryTitle']}")
    score = get_metacritic_user_score(row["primaryTitle"])
    df.at[i, "metacriticUserScore"] = score

    time.sleep(1 + random.random())

df.to_csv(FILE, index=False)

print("Updated:", FILE)