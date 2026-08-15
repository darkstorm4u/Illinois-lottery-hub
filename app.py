import streamlit as st
import requests, random

st.set_page_config(page_title="IL Lottery Hub", layout="wide")
st.title("🎟️ Illinois Lottery Hub")

# Game configurations: (min_num, max_num, count_needed, allows_duplicates)
GAME_RULES = {
    "pick3": (0, 9, 3, True),
    "pick4": (0, 9, 4, True),
    "lotto": (1, 50, 6, False),
    "lucky_day_lotto": (1, 45, 5, False),
    "powerball": (1, 69, 5, False),
    "mega_millions": (1, 70, 5, False)
}

game = st.selectbox("Game", list(GAME_RULES.keys()))

def generate_line(min_val, max_val, count, allow_dup, weight_dict=None):
    valid_range = range(min_val, max_val + 1)
    
    # If using weighted probabilities from live API
    if weight_dict:
        weights = [weight_dict.get(n, 1) for n in valid_range]
        if allow_dup:
            return random.choices(valid_range, weights=weights, k=count)
        else:
            selected = set()
            while len(selected) < count:
                pick = random.choices(valid_range, weights=weights, k=1)[0]
                selected.add(pick)
            return sorted(list(selected))
            
    # Standard random fallback
    else:
        if allow_dup:
            return [random.randint(min_val, max_val) for _ in range(count)]
        else:
            return sorted(random.sample(valid_range, count))

if st.button("Fetch Live + Generate Tickets"):
    BASE = "https://www.drawanalytics.com/api/v1/illinois"
    min_n, max_n, count, allow_dup = GAME_RULES[game]
    
    with st.spinner("Fetching data..."):
        try:
            # 1. Fetch Latest Draw
            res_latest = requests.get(f"{BASE}/{game}/latest", timeout=10)
            res_latest.raise_for_status()
            latest_json = res_latest.json()
            
            if "data" in latest_json and "numbers" in latest_json["data"]:
                st.success(f"Latest draw: {latest_json['data']['numbers']}")
            else:
                st.warning("Latest draw data unavailable right now.")

            # 2. Fetch Hot/Cold Data
            res_hc = requests.get(f"{BASE}/{game}/hot-cold?days=30", timeout=10)
            res_hc.raise_for_status()
            hc_json = res_hc.json()
            
            hot_list = hc_json.get("data", {}).get("hot", [])
            
            if hot_list:
                weights = {n["number"]: n["count"] for n in hot_list}
                picks = [generate_line(min_n, max_n, count, allow_dup, weights) for _ in range(5)]
                st.subheader("Your Weighted Tickets")
            else:
                st.info("Generating standard random tickets (Hot/Cold frequency data unavailable)...")
                picks = [generate_line(min_n, max_n, count, allow_dup) for _ in range(5)]
                st.subheader("Your Generated Tickets")

        except Exception:
            st.error("⚠️ Draw Analytics API is currently down or unresponsive.")
            st.info("Generating standard random tickets for you instead:")
            picks = [generate_line(min_n, max_n, count, allow_dup) for _ in range(5)]

        for p in picks:
            st.write(" • ".join(map(str, p)))
