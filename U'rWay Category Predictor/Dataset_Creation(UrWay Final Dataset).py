import csv
import time
from googleapiclient.discovery import build

# --- CONFIGURATION ---
API_KEY = "AIzaSyDWuIx3nwLnWhe6svV5tyZVCCG04nPxByY"

# Mapping Main Categories to their technical sub-topics
URWAY_MAP = {
    "Blockchain and Solidity Programming": [
        "Solidity Smart Contract Security", "Ethereum Web3.js vs Ethers.js", 
        "DeFi Yield Farming and Staking", "Hardhat and Truffle Frameworks", 
        "ERC20 and ERC721 Token Standards", "Consensus Algorithms Proof of Stake", 
        "Layer 2 Scaling Solutions", "Zero Knowledge Proofs ZK-Snarks"
    ],
    "Data Science and Data Analytics": [
        "Exploratory Data Analysis EDA", "Pandas Data Wrangling", "SQL Joins and Window Functions", 
        "Statistical Hypothesis Testing", "Probability Distributions", "Data Visualization with Seaborn", 
        "Time Series Analysis and Forecasting", "Big Data Processing with PySpark"
    ],
    "Medical": [
        "Human Anatomy and Histology", "Pathology and Disease Mechanisms", 
        "Pharmacology and Drug Kinetics", "Cardiology and ECG Interpretation", 
        "Neurology and Brain Function", "Surgical Procedures and Techniques", 
        "Microbiology and Immunology"
    ],
    "Commerce": [
        "Financial Auditing Standards", "Corporate Taxation and GST", 
        "Portfolio Management and Risk", "Macroeconomics and Fiscal Policy", 
        "Cost and Management Accounting", "Company Law and Governance", 
        "Financial Derivative Markets"
    ]
}

def fetch_granular_data(api_key, urway_map):
    youtube = build('youtube', 'v3', developerKey=api_key)
    final_data = []

    for main_cat, topics in urway_map.items():
        # Calculate how many videos per sub-topic to hit ~1000 total for the category
        limit_per_topic = 1000 // len(topics)
        
        for topic in topics:
            print(f"Deep Search: {main_cat} -> {topic} (Target: {limit_per_topic})")
            fetched = 0
            token = None
            
            while fetched < limit_per_topic:
                batch = min(50, limit_per_topic - fetched)
                try:
                    request = youtube.search().list(
                        q=topic,
                        part="snippet",
                        type="video",
                        order="relevance",
                        maxResults=batch,
                        pageToken=token
                    )
                    response = request.execute()

                    for item in response.get('items', []):
                        final_data.append({
                            'title': item['snippet']['title'],
                            'Category': main_cat,
                            'SubTopic': topic
                        })
                    
                    fetched += len(response.get('items', []))
                    token = response.get('nextPageToken')
                    if not token: break
                except Exception as e:
                    print(f"Quota likely hit or Error: {e}")
                    return final_data # Return what we have so far
                    
    return final_data

# Execute
results = fetch_granular_data(API_KEY, URWAY_MAP)

# Save
with open('UrWay_Deep_Dataset.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['title', 'Category', 'SubTopic'])
    writer.writeheader()
    writer.writerows(results)

print(f"Finished! Gathered {len(results)} high-depth records.")