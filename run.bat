@echo off
REM ==============================================================================
REM Kyrandia 2: Hand of Fate - Asset Studio Launcher (Windows)
REM ==============================================================================
cd /d "%~dp0"

echo ==============================================================================
echo   KYRANDIA 2: HAND OF FATE - ASSET STUDIO ^& EXTRACTOR
echo ==============================================================================

where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not installed or not in your system PATH.
    echo Please install Python 3.8+ from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

python -c "import PIL" >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Installing required Pillow imaging library...
    python -m pip install -q -r requirements.txt
    if %ERRORLEVEL% NEQ 0 (
        echo [WARNING] Failed to auto-install Pillow. Run: pip install -r requirements.txt
        pause
    )
)

echo [INFO] Launching Asset Studio...
python app.py %*
if %ERRORLEVEL% NEQ 0 (
    pause
)
