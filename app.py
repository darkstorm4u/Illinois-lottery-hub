import streamlit as st
import requests, random

st.set_page_config(page_title="IL Lottery Hub", layout="wide")
st.title("🎟️ Illinois Lottery Hub")

game = st.selectbox("Game", ["pick3", "pick4", "lotto", "lucky_day_lotto", "powerball", "mega_millions"])

if st.button("Fetch Live + Generate Tickets"):
    BASE = "https://www.drawanalytics.com/api/v1/illinois"
    
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
                picks = [sorted(random.choices(range(1, 70), weights=list(weights.values()), k=5)) for _ in range(5)]
                st.subheader("Your Weighted Tickets")
                for p in picks:
                    st.write(" • ".join(map(str, p)))
            else:
                # Fallback random ticket generation if API data is missing
                st.info("Generating random tickets (Hot/Cold frequency data unavailable)...")
                picks = [sorted(random.sample(range(1, 70), 5)) for _ in range(5)]
                st.subheader("Your Generated Tickets")
                for p in picks:
                    st.write(" • ".join(map(str, p)))

        except Exception as e:
            st.error("⚠️ Draw Analytics API is currently down or unresponsive.")
            st.info("Generating standard random tickets for you instead:")
            picks = [sorted(random.sample(range(1, 70), 5)) for _ in range(5)]
            for p in picks:
                st.write(" • ".join(map(str, p)))
