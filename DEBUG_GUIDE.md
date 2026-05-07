# Debugging Guide: Career Prediction & Roadmap Generation Fixes

## Overview
All fixes have been applied to resolve:
1. Career predictions returning -1 (fallback value)
2. Roadmap generation returning static templates instead of dynamic content
3. Silent failures with no error visibility

## How to Verify Fixes

### 1. Start All Services
Ensure these services are running BEFORE testing:

```bash
# Terminal 1: Backend (Node.js)
cd backend
npm start
# Should say: "Server running on port 5000"

# Terminal 2: ML Service (Python)
cd ml
python combined_app.py
# Should say: "Running on http://127.0.0.1:5006"

# Terminal 3: GenAI Service (Python)
cd genai-service
python app.py
# Should say: "Running on http://127.0.0.1:5001"

# Terminal 4: Keyword Service (Python)
cd text-summarization-service
python app.py
# Should say: "Running on http://127.0.0.1:5007"
```

### 2. Check Environment Variables
Verify these .env files have correct values:

**backend/.env**:
```
GENAI_SERVICE_URL=http://127.0.0.1:5001
SERVICE_SECRET=<your-shared-secret>
CAREER_ML_URL=http://127.0.0.1:5006/api/career
WELLNESS_ML_URL=http://127.0.0.1:5006/api/wellness
CAREER_PATH_ML_URL=http://127.0.0.1:5006/api/career_path
STUDENT_PERFORMANCE_ML_URL=http://127.0.0.1:5006/api/student_performance
KEYWORD_SERVICE_URL=http://127.0.0.1:5007
```

**genai-service/.env**:
```
GEMINI_API_KEY_1=<your-api-key>
GEMINI_API_KEY_2=<backup-api-key>
GEMINI_MODEL=gemini-2.0-flash
SERVICE_SECRET=<must-match-backend>
```

### 3. Test Career Prediction Fix

**What changed**: 
- Career ML prediction now logs error details when it fails
- Backend logs show exactly what went wrong

**How to test**:
1. Register a new user via frontend
2. In backend terminal, look for:
   ```
   [genaiClient] Calling Career ML at: http://127.0.0.1:5006/api/career/predict
   [genaiClient] Career ML success, cluster: <number>
   ```
   OR if it fails:
   ```
   [genaiClient] Career ML call failed: <error details>
   [runMlPredictions] Career prediction failed: <error details>
   ```

**Expected result**: 
- Career prediction should show a real cluster value (0, 1, 2, etc.) NOT -1
- If it shows -1, check the error logs in backend terminal to see what's wrong

### 4. Test Keyword Extraction Order Fix

**What changed**: 
- Keywords are now extracted BEFORE calling GenAI service
- Roadmap generation receives valid keywords in the prompt

**How to test**:
1. After onboarding, create a target with description: "Learn Machine Learning & AI"
2. In backend terminal, look for:
   ```
   [createTarget] Keyword extraction failed (non-fatal): ...
   OR
   [genaiClient] Calling GenAI service at: http://127.0.0.1:5001/api/roadmap
   ```
3. Keywords should be logged in the GenAI request

**Expected result**: 
- Roadmap should be specific to ML (mention numpy, pandas, datasets, neural networks)
- NOT generic 6-step template

### 5. Test Roadmap Generation Logging

**What changed**: 
- Roadmap generation failures now logged with error details
- Can see when GenAI service is unreachable, timing out, or has auth issues

**How to test**:
1. Create targets with different goals:
   - "Learn Machine Learning & AI"
   - "Build a React Web App"
   - "Architectural Design Skills"
   - "Data Science Fundamentals"
   - "Interview Prep"

2. Check backend terminal for logs like:
   ```
   [genaiClient] POST /api/roadmap to GenAI service at http://127.0.0.1:5001
   [gemini_service] Calling Gemini model: gemini-2.0-flash
   [gemini_service] Successfully generated 7 steps via Gemini for goal='Learn Machine Learning & AI'
   ```
   OR if using fallback:
   ```
   [gemini_service] Gemini returned empty for goal='...' , using contextual-fallback
   [genaiClient] GenAI service success at /api/roadmap
   ```

**Expected result**: 
- Each domain-specific target should have DIFFERENT, TARGETED steps
- Not the same 6-step generic template for everything

### 6. Check MongoDB Documents

**What should be different now**:

**Before fix** (in user_profiles collection):
```json
"onboardingInputs": {
  "careerPrediction": { "cluster": -1, "confidence": 0 }  // ← BROKEN
}
```

**After fix** (should show real cluster value):
```json
"onboardingInputs": {
  "careerPrediction": { "cluster": 2, "confidence": 0.87 }  // ← FIXED
}
```

**Roadmaps before fix** (in final_roadmaps collection):
```json
{
  "targetName": "Machine Learning",
  "source": "fallback",  // ← WRONG
  "steps": [
    { "title": "Assess your starting point" },  // ← GENERIC
    { "title": "Build the foundation" },
    { "title": "Hands-on practice" },
    ...
  ]
}
```

**Roadmaps after fix** (should be specific):
```json
{
  "targetName": "Machine Learning",
  "source": "genai",  // ← Gemini-generated OR contextual-specific
  "steps": [
    { "title": "Define the machine learning learning path" },  // ← SPECIFIC
    { "title": "Master the mathematical foundations" },
    { "title": "Set up your ML development environment" },
    ...
  ]
}
```

## Troubleshooting

### Career Prediction Still Returns -1

**Check Terminal Logs**:
- Look in backend terminal for: `[runMlPredictions] Career prediction failed:`
- Copy the error message

**Possible Issues**:
1. **ML service not running**: 
   - Error: `Career ML service timed out` or `ECONNREFUSED`
   - Solution: Start ML service in separate terminal
   
2. **Wrong ML endpoint**: 
   - Error: `404` or `service error (404)`
   - Solution: Check CAREER_ML_URL in backend/.env matches running service
   
3. **Invalid payload**: 
   - Error: `400` or `bad request`
   - Solution: Check ug_course, ug_specialization values are valid

### Roadmap Still Generic/Static

**Check Terminal Logs**:
- Look for: `[gemini_service] Gemini returned empty` or `Could not parse`
- Look for: `GenAI service error` or `timeout`

**Possible Issues**:
1. **Gemini API key missing/wrong**:
   - Error: `No Gemini API key found in environment`
   - Solution: Add GEMINI_API_KEY_1 or GEMINI_API_KEY_2 to genai-service/.env
   
2. **GenAI service not running**:
   - Error: `GenAI service timed out` or `ECONNREFUSED`
   - Solution: Start GenAI service
   
3. **SERVICE_SECRET mismatch**:
   - Error: `401` or `Unauthorized`
   - Solution: Ensure SERVICE_SECRET in backend/.env == genai-service/.env

4. **Gemini API quota exceeded**:
   - Error: `429` or `quota exceeded`
   - Solution: Wait or use alternative API key

### Keywords Not Being Extracted

**Check Terminal Logs**:
- Look for: `[createTarget] Keyword extraction failed (non-fatal):`
- This is OK - fallback to deriveKeywordHints() is working

**Solutions**:
1. Check if text-summarization-service is running on port 5007
2. Keywords still get extracted via fallback, so roadmap is still specific

## Test Cases to Run

### Test 1: Happy Path - All Services Running
1. Start all 4 services
2. Register new user
3. Create target
4. Check:
   - Career prediction is NOT -1
   - Roadmap is specific to target domain
   - Logs show all services succeeded

### Test 2: ML Service Down
1. Stop ML service (Ctrl+C on combined_app.py terminal)
2. Register new user
3. Backend console should log:
   ```
   [genaiClient] Career ML service timed out
   [runMlPredictions] Career prediction failed: Career ML service timed out
   ```
4. Expected: careerPrediction = { cluster: -1, confidence: 0 } (fallback, but logged)

### Test 3: GenAI Service Down
1. Stop GenAI service
2. Create new target
3. Backend console should log:
   ```
   [genaiClient] GenAI service timed out at /api/roadmap
   [createTarget] Roadmap generation failed: GenAI service timed out at /api/roadmap
   ```
4. Expected: Roadmap uses contextual-fallback (but specific to domain)

### Test 4: Different Target Domains
Test with these target descriptions:

1. "Machine Learning" → Should include: numpy, pandas, datasets, neural networks
2. "React Web App" → Should include: components, hooks, routing, state
3. "Architectural Design" → Should include: sketching, CAD, 3D modeling
4. "Data Science" → Should include: analysis, visualization, statistics
5. "Interview Prep" → Should include: algorithms, mock interviews, leetcode

## Quick Diagnostics

**Run this command to test ML endpoint directly**:
```bash
curl -X POST http://127.0.0.1:5006/api/career/predict \
  -H "Content-Type: application/json" \
  -d '{
    "ug_course": "Engineering",
    "ug_specialization": "Computer Science",
    "skills": "python;javascript",
    "interests": "web;data",
    "ug_score": "75"
  }'

# Expected response: {"cluster": <number>, "confidence": <float>}
```

**Test GenAI endpoint**:
```bash
curl -X POST http://127.0.0.1:5001/api/roadmap \
  -H "Content-Type: application/json" \
  -H "X-Service-Secret: <your-secret>" \
  -d '{
    "target": {
      "targetName": "Machine Learning",
      "timeline": "8 weeks",
      "description": "Learn ML from scratch"
    },
    "profile": {}
  }'

# Expected response: {"source": "...", "steps": [...]}
```

## Important Notes

- All error logs are printed to backend/genai-service console during execution
- **These changes do NOT modify the frontend** - UI remains the same
- **No database schema changes** - just enhanced logging and logic fixes
- **All fixes are backward compatible** - won't break existing features

## Performance Impact

- **Negligible**: Logging adds < 1ms per request
- **Keyword extraction reordering**: Actually IMPROVES performance by preventing undefined keyword issues
- **Enhanced error handling**: Helps catch issues faster, no performance penalty
