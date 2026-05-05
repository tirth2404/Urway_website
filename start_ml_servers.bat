@echo off
echo Starting U'rWay Combined ML Service...

echo Starting Combined ML Server (Port 5006)...
start cmd /k "python ml\combined_app.py"

echo The Combined ML service has been started in a separate window!
echo Make sure you have your Python virtual environment activated if required.
pause

