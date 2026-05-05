import os

# Paths
BASE_DIR = os.getcwd()
DATA_PATH = os.path.join(BASE_DIR, "Urway.csv")
PROCESSED_DATA_PATH = os.path.join(BASE_DIR, "data", "processed_data")
CLEAN_CSV_NAME = "cleaned_data.csv"
PROCESSED_CSV_PATH = os.path.join(PROCESSED_DATA_PATH, "urway_processed_v1.csv")

# Tokenization limits for U'rWay
MAX_INPUT_LEN = 512   
MAX_TARGET_LEN = 64   

# Model Hyperparameters
MODEL_NAME = "google/flan-t5-small"
BATCH_SIZE = 4 
LEARNING_RATE = 2e-4
EPOCHS = 4