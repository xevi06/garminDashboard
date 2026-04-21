#!/bin/bash
set -e
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate

echo "Installing dependencies..."
pip install -q -r requirements.txt

echo "Starting GarminDash backend on http://localhost:8000"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
