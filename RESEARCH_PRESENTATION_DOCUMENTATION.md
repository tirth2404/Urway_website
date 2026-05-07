# U'rWay: Research and Presentation Documentation

## 1. Project Overview
U'rWay is a student guidance and productivity platform that combines web, backend, machine learning, and generative AI components to help a student move from onboarding data collection to career prediction, wellness estimation, career-path clustering, roadmap generation, and activity tracking. The system is designed around a single idea: convert a learner's profile, preferences, progress signals, and activity context into actionable guidance that is personalized rather than generic.

The platform is not a single model. It is an orchestration of multiple services:
- A React-based frontend for onboarding, dashboards, and user-facing workflows.
- A Node.js/Express backend that coordinates authentication, data persistence, model calls, roadmap storage, and extension activity ingestion.
- A Python ML service that serves predictive models for career, wellness, career path, and student performance.
- A Python GenAI service that uses Gemini for cluster tagging, roadmap generation, and exam-question generation.
- A browser-extension/tracker subsystem that captures user activity and syncs it back to the platform.

## 2. Problem Statement
The project targets a common gap in student guidance systems: most tools either produce generic recommendations or only solve one narrow task such as career suggestion or study planning. U'rWay attempts to unify these into one pipeline so that the recommendation logic can use multiple signals at once:
- academic background
- skills and interests
- wellness and lifestyle inputs
- activity patterns from browser/editor usage
- target goals, timelines, and descriptions

This makes the roadmap generation more contextual and the career guidance more adaptable.

## 3. Technology Stack

### Frontend
- React
- Vite
- TypeScript
- Tailwind CSS
- Framer Motion
- React Router

### Backend
- Node.js
- Express
- MongoDB / Mongoose
- bcryptjs
- cookie-based refresh flow
- JWT-style access-token flow

### ML and AI Services
- Python
- Flask
- scikit-learn
- NumPy
- pandas
- pickle-based model bundles
- Google Gemini API via the GenAI service

### Data Storage and Sync
- MongoDB collections for user profiles, targets, roadmaps, credentials, and activity logs
- Browser extension sync for Chrome and VS Code activity

## 4. High-Level Architecture
The runtime architecture follows a hub-and-spoke design:

1. The user completes onboarding or creates a target.
2. The backend sends structured payloads to ML and GenAI services.
3. The ML service returns career, wellness, career-path, and student-performance predictions.
4. The GenAI service returns a virtual cluster label, roadmap steps, or exam questions.
5. The backend persists the profile and roadmap artifacts in MongoDB.
6. The browser extension and tracker modules provide additional context that improves future recommendations.

This architecture is intentionally service-oriented so that model retraining, prompt tuning, and UI development can evolve independently.

## 5. Data Flow

### 5.1 Onboarding Flow
The onboarding flow collects structured user information such as:
- email and password
- undergraduate course and specialization
- skills and interests
- score and background data
- wellness-related fields

The backend then calls the ML service to generate a set of predictions. Those predictions are stored with the user profile and can later influence roadmap generation.

### 5.2 Target Creation Flow
When a user creates a target, the backend:
- reads activity summary data from the extension/tracker pipeline
- extracts keywords from the target title and description
- calls the GenAI roadmap endpoint
- stores the resulting roadmap in MongoDB

The key design choice is that roadmap generation should be target-aware. The target name, description, and contextual keywords are merged before the prompt is sent so that goals like Node.js do not collapse into unrelated React or frontend templates.

### 5.3 Activity Tracking Flow
The extension subsystem captures user activity and syncs it securely. The documentation in `urway_tracker/PROJECT_DOCUMENTATION.md` describes encryption, sync, OAuth handling, and troubleshooting. This activity context is used as additional evidence for personalized recommendations and roadmap refinement.

## 6. Machine Learning Subsystems

### 6.1 Career Recommendation Model
The career recommender is served from `ml/combined_app.py` and uses a bundle produced by `ml/Education Information/export_pickles.py`.

Training/bundle facts:
- Best `K` for the recommender search: `10`
- SVD components: `50`
- Model family: `RandomForestClassifier`
- Supporting preprocessors: `OneHotEncoder`, `MultiLabelBinarizer`, `TruncatedSVD`

At inference time, the backend builds a feature vector from undergraduate course, specialization, skills, interests, and score, then sends the payload to `/api/career/predict`.

Notebook-reported performance:
- Random Forest 5-fold cross-validation accuracy: `0.8770 ± 0.0232`
- Classification report accuracy: `0.89` on `239` samples

### 6.2 Career Path Clustering Model
The career-path classifier is served from the combined ML app and trained in `ml/Presonal Information/Carrier Path/export_pickles.py`.

Training/bundle facts:
- Best `K`: `4`
- Model family: `KMeans`
- Feature scaling: `StandardScaler`
- Cluster labels:
  - `0`: Presenters
  - `1`: Leaders & Team Players
  - `2`: Communicators
  - `3`: Project-Driven Builders

This model maps numeric and binary profile features to a cluster that is later used as a career-path style signal.

### 6.3 Wellness Prediction
The wellness endpoint derives a health-oriented score from sleep, activity, diet, and stress inputs. It is intentionally lightweight and acts as a decision support signal rather than a medical diagnosis.

### 6.4 Student Performance Prediction
The student-performance endpoint estimates educational performance patterns from structured inputs. The combined ML service treats this as another support signal for the overall learner profile.

## 7. Generative AI Subsystem
The GenAI service is implemented in Flask and centers on Gemini-based generation. The service exposes prompt-driven endpoints for:
- roadmap generation
- virtual cluster classification
- exam-question generation

The roadmap generator enforces a structured JSON response and falls back to contextual step generation when the model fails or returns malformed output. The fallback logic is domain aware and includes branches for:
- machine learning and AI
- React / frontend / web / JavaScript / Node.js / full-stack / TypeScript
- architecture / design / AutoCAD / Revit / BIM / CAD
- data science / analytics / Python / SQL / statistics
- interviews / algorithms / DSA / LeetCode

This fallback strategy matters because it prevents the system from returning a static template that is unrelated to the user's real goal.

## 8. Model Evaluation and Reported Metrics
The project contains several notebook-level evaluation results. The most clearly surfaced values are below.

### 8.1 Clustering Metrics
From `ml/Extra Curricular Activities Information/student_activity_clustering copy.ipynb`:
- `K = 2 Score = 0.566282331943512`
- `K = 3 Score = 0.6278657913208008`
- `K = 4 Score = 0.6387922763824463`
- `K = 5 Score = 0.6425866484642029`
- `Improved Silhouette Score: 0.6426`

From the broader notebook search results:
- `Average Silhouette Score for Meta_Model: 0.6072`

Interpretation:
- The silhouette values show moderate-to-strong cluster separation.
- The best surfaced score around `0.6426` indicates that the chosen cluster structure is reasonably cohesive and separated.
- The meta-model score around `0.6072` suggests the stacked or aggregated clustering logic is also meaningful, though not perfect.

### 8.2 Classification Metrics
From `ml/Education Information/1career_recommender.ipynb`:
- Random Forest 5-fold CV accuracy: `0.8770 ± 0.0232`
- Reported test accuracy: `0.89`

These values indicate that the career recommendation classifier is performing at a strong level on the reported split, while still leaving room for improvement through feature engineering and tuning.

### 8.3 Metric Caveat
The metrics above are notebook-reported values from the training and evaluation phase. They should be presented in the paper or slides with the note that retraining, data reshuffling, or feature-set changes may slightly shift the numbers.

## 9. Data Processing Pipeline
The project uses a multi-stage data pipeline:

1. Raw student and activity data is collected from source datasets and user onboarding forms.
2. Data is cleaned and normalized with pandas and scikit-learn preprocessing utilities.
3. Categorical fields are encoded with one-hot or label encoders.
4. Text-like fields such as skills and interests are vectorized or multi-label encoded.
5. Numerical features are scaled when clustering or distance-based methods require it.
6. Model bundles are serialized with pickle for runtime inference.
7. Runtime inference returns predictions and cluster labels.
8. The backend stores the results in MongoDB and uses them as context for roadmap generation.

This design ensures training-time decisions and inference-time decisions remain aligned.

## 10. Backend Orchestration
The backend controller logic is the glue for the whole system. It handles:
- validation of request payloads
- transport to ML and GenAI services
- error logging and fallback handling
- user authentication and token issuance
- roadmap persistence
- prediction recomputation for stale or missing data

One important design choice is that service failures are not hidden. If a remote prediction endpoint is unavailable, the backend logs the failure and falls back to a deterministic local behavior instead of storing unusable placeholder output.

## 11. Roadmap Generation Design
Roadmap generation is one of the most important user-facing behaviors in the platform.

The final workflow is:
- collect the target title and description
- derive keyword hints from both the target name and supporting text
- optionally fold in activity or profile context
- call the GenAI roadmap endpoint
- normalize the response into structured steps
- save the roadmap in the database

The roadmap logic was improved specifically to avoid generic template leakage. In practice that means the system should prefer a Node.js-oriented path for Node.js targets, a React-oriented path for React targets, and so on.

## 12. Browser Extension and Tracker Layer
The browser extension / tracker layer is part of the project's evidence-gathering system. It is used to:
- capture activity signals
- sync encrypted or secured payloads
- support login or connection workflows
- provide a stronger behavioral context for recommendations

This layer matters for the research story because it turns the platform from a static recommender into a context-aware monitoring and guidance system.

## 13. Why This Project Is Research-Relevant
The project is suitable for a research paper because it combines:
- supervised learning for career recommendation
- unsupervised clustering for learner archetypes
- generative AI for roadmap synthesis
- secure data collection through a browser extension
- multi-service orchestration for real-time personalization

That combination is stronger than a single-model demo because it supports a full user journey from input collection to actionable guidance.

## 14. Key Contributions
- A unified architecture for onboarding, prediction, roadmap generation, and activity tracking.
- A bundle-based ML deployment strategy using serialized preprocessing and model artifacts.
- A contextual roadmap generator that avoids static generic templates.
- Cluster-aware personalization with measurable silhouette scores.
- Strong classifier performance on the career recommender, with notebook-reported CV accuracy around `0.8770`.

## 15. Limitations and Future Work
The current project is useful, but it still has clear research directions:
- Collect larger and more diverse training data.
- Report a consistent evaluation table across every model in one place.
- Add formal ablation studies for keyword hints, cluster tags, and activity signals.
- Measure roadmap quality with human evaluation or task-completion metrics.
- Improve offline resilience when remote ML/GenAI services are unavailable.

## 16. Suggested Presentation Narrative
If you are preparing slides, the clean story is:
1. Problem: students receive generic advice.
2. Idea: use onboarding, activity signals, clustering, and GenAI together.
3. Method: train ML models, expose them through Flask services, and orchestrate them in Node.js.
4. Results: silhouette scores around `0.64` and Random Forest CV accuracy around `0.877`.
5. Impact: personalized roadmaps and learner guidance that adapt to the user's profile and target.

## 17. Source Files Referenced
- [README.md](README.md)
- [urway_tracker/PROJECT_DOCUMENTATION.md](urway_tracker/PROJECT_DOCUMENTATION.md)
- [ml/combined_app.py](ml/combined_app.py)
- [ml/Education Information/export_pickles.py](ml/Education%20Information/export_pickles.py)
- [ml/Presonal Information/Carrier Path/export_pickles.py](ml/Presonal%20Information/Carrier%20Path/export_pickles.py)
- [ml/Education Information/1career_recommender.ipynb](ml/Education%20Information/1career_recommender.ipynb)
- [ml/Extra Curricular Activities Information/student_activity_clustering copy.ipynb](ml/Extra%20Curricular%20Activities%20Information/student_activity_clustering%20copy.ipynb)

## 18. Final Note
This document is intended to be used as a research-paper and presentation reference. The evaluation numbers included here are the most clearly surfaced notebook outputs found in the project workspace, and they should be quoted with the dataset/version context used during training.