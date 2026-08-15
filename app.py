import streamlit as st
import requests, random

st.set_page_config(page_title="IL Lottery Hub Engine", layout="wide")
st.title("🎟️ Illinois Lottery Engine & Simulator")

# Preserved Game Matrix Rules + Expanded Simulation Constraints:
# Format: (min_num, max_num, count_needed, allows_duplicates, min_special, max_special, min_sum, max_sum)
GAME_RULES = {
    "pick3": (0, 9, 3, True, None, None, 6, 21),
    "pick4": (0, 9, 4, True, None, None, 10, 26),
    "lotto": (1, 50, 6, False, None, None, 100, 200),
    "lucky_day_lotto": (1, 45, 5, False, None, None, 70, 160),
    "powerball": (1, 69, 5, False, 1, 26, 100, 220),
    "mega_millions": (1, 70, 5, False, 1, 24, 100, 225)
}

game = st.selectbox("Select Target Lottery Game", list(GAME_RULES.keys()))

def generate_single_ball(valid_range, weights=None):
    if weights and len(weights) == len(valid_range):
        return random.choices(valid_range, weights=weights, k=1)[0]
    return random.choice(valid_range)

def generate_raw_line(min_val, max_val, count, allow_dup, hot_dict=None, cold_dict=None):
    valid_range = list(range(min_val, max_val + 1))
    
    # Combined Hot/Cold Weighted Probabilities (60% Hot, 40% Cold)
    weights = None
    if hot_dict or cold_dict:
        weights = []
        for n in valid_range:
            h_score = hot_dict.get(n, 1) if hot_dict else 1
            c_score = cold_dict.get(n, 1) if cold_dict else 1
            weights.append((h_score * 0.6) + (c_score * 0.4))
            
    if allow_dup:
        return [generate_single_ball(valid_range, weights) for _ in range(count)]
    else:
        selected = set()
        attempts = 0
        while len(selected) < count and attempts < 500:
            attempts += 1
            pick = generate_single_ball(valid_range, weights)
            selected.add(pick)
        if len(selected) < count:
            selected = set(random.sample(valid_range, count))
        return sorted(list(selected))

def validate_and_generate(game_key, hot_dict=None, cold_dict=None):
    min_m, max_m, count_m, dup, min_s, max_s, min_sum, max_sum = GAME_RULES[game_key]
    
    for _ in range(1000):  # Monte-Carlo loop to ensure lines hit real-world statistical distribution targets
        main_nums = generate_raw_line(min_m, max_m, count_m, dup, hot_dict, cold_dict)
        
        # 1. Sum Range Constraint Check
        total_sum = sum(main_nums)
        if not (min_sum <= total_sum <= max_sum):
            continue
            
        # 2. Odd/Even Balance Constraint Check (for 5+ ball sets)
        if count_m >= 5:
            odds = sum(1 for n in main_nums if n % 2 != 0)
            if odds == 0 or odds == count_m:  # Filters out extreme all-odd or all-even outliers
                continue
                
        # 3. Dedicated Special Ball Generation (Powerball / Mega Ball)
        special_ball = None
        if min_s is not None and max_s is not None:
            special_ball = random.randint(min_s, max_s)
            
        return main_nums, special_ball, total_sum
        
    # Safe Fallback Line
    fallback_main = generate_raw_line(min_m, max_m, count_m, dup)
    fallback_spec = random.randint(min_s, max_s) if min_s else None
    return fallback_main, fallback_spec, sum(fallback_main)

if st.button("Run Simulation Engine"):
    BASE = "https://www.drawanalytics.com/api/v1/illinois"
    
    with st.spinner("Processing API matrices & running statistical filters..."):
        hot_data, cold_data = {}, {}
        try:
            # 1. Fetch Latest Recorded Draw
            res_latest = requests.get(f"{BASE}/{game}/latest", timeout=8)
            if res_latest.status_code == 200:
                l_data = res_latest.json().get("data", {})
                if "numbers" in l_data:
                    st.success(f"Latest Recorded Draw: {l_data['numbers']}")

            # 2. Fetch Hot/Cold Frequencies
            res_hc = requests.get(f"{BASE}/{game}/hot-cold?days=30", timeout=8)
            if res_hc.status_code == 200:
                hc_json = res_hc.json().get("data", {})
                hot_list = hc_json.get("hot", [])
                cold_list = hc_json.get("cold", [])
                
                hot_data = {n["number"]: n["count"] for n in hot_list if "number" in n}
                cold_data = {n["number"]: n["count"] for n in cold_list if "number" in n}
                st.caption("Live Hot/Cold matrix successfully loaded.")
        except Exception:
            st.warning("⚠️ API connection unreachable. Engine running in pure mathematical simulation mode.")

        st.subheader("Generated Tickets (Statistically Screened)")
        
        for i in range(1, 6):
            main_p, spec_p, sum_p = validate_and_generate(game, hot_data, cold_data)
            main_str = " • ".join(f"{n:02d}" if GAME_RULES[game][1] > 9 else str(n) for n in main_p)
            
            if spec_p is not None:
                if game == "powerball":
                    st.markdown(f"**Ticket {i}:** `{main_str}` | 🔴 **Powerball:** `{spec_p:02d}` *(Sum: {sum_p})*")
                elif game == "mega_millions":
                    st.markdown(f"**Ticket {i}:** `{main_str}` | 🟡 **Mega Ball:** `{spec_p:02d}` *(Sum: {sum_p})*")
            else:
                st.markdown(f"**Ticket {i}:** `{main_str}` *(Sum: {sum_p})*")
