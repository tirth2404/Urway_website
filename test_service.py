import sys
import os
from dotenv import load_dotenv
load_dotenv(r"d:\6th sem\SGP\Urway_website\genai-service\.env")

sys.path.append(r"d:\6th sem\SGP\Urway_website\genai-service")
from service.gemini_service import generate_exam_questions

res = generate_exam_questions(["test material"], {}, {"targetName": "React", "priorKnowledge": 5})
print("Final result:", res)
