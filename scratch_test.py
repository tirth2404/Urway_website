import urllib.request
import json

url = "http://127.0.0.1:5001/api/exam-questions"
headers = {
    "Content-Type": "application/json",
    "X-Service-Secret": "31744ad0fd45e0210d73730a4c5b3880938dab027efa4bbe4f38313305132e29"
}
data = {
    "sourceMaterial": ["some text about machine learning"],
    "profile": {},
    "targetInfo": {"targetName": "ML", "priorKnowledge": 5}
}
req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="POST")
try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode("utf-8"))
except Exception as e:
    print("Error:", e)
    if hasattr(e, 'read'):
        print(e.read().decode("utf-8"))
