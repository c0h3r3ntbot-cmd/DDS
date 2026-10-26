# Bridge Double Dummy Solver

Interactive double-dummy play using Bo Haglund's DDS via the Python `endplay` library, with a Next.js table UI.

## Run

From the project root (starts backend **and** frontend; Ctrl+C stops both):

```bash
# macOS / Linux
./start.sh

# Windows
start.bat
```

- Backend: http://127.0.0.1:8000
- Frontend: http://127.0.0.1:3000

First-time setup if needed: create `.venv`, `pip install -r backend/requirements.txt`, and `npm install` in `frontend/`.

Open http://127.0.0.1:3000. Upload a `.pbn` file (see `frontend/public/sample.pbn`) or play the default deal. Green badges are optimal trick counts for the side on play; red badges drop a trick.
