import streamlit as st
import requests, random

st.set_page_config(page_title="IL Lottery Hub", layout="wide")
st.title("🎟️ Illinois Lottery Hub")
BASE = "https://www.drawanalytics.com/api/v1/illinois"

game = st.selectbox("Game", ["pick4", "powerball", "mega_millions"])
if st.button("Fetch Live + Generate Tickets"):
    try:
        r = requests.get(f"{BASE}/{game}/latest", timeout=5).json()
        st.success(f"Latest draw: {r['data']['numbers']}")
        hc = requests.get(f"{BASE}/{game}/hot-cold?days=30", timeout=5).json()["data"]
        weights = {n["number"]: n["count"] for n in hc["hot"]}
        picks = [sorted(random.choices(range(1, 70), weights=weights, k=5)) for _ in range(5)]
        st.subheader("Your Weighted Tickets")
        for p in picks: st.write(" • ".join(map(str, p)))
    except Exception as e:
        st.error(f"API hiccup: {e}. Check connection.")
st.caption("Local: streamlit run app.py | Deploy: Push to GitHub → streamlit.io")
