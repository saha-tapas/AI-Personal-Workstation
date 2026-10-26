# AI-Personal-Workstation

Initial project foundation with a Vite React frontend and a Node.js + Express backend.

## Install frontend dependencies

```bash
cd frontend
npm install
```

## Install backend dependencies

```bash
cd server
npm install
```

## Start the frontend

```bash
cd frontend
npm run dev
```

The Vite development server will print its local URL in the terminal.

## Start the backend

```bash
cd server
node src/index.js
```

The backend listens on port `8787`.

## Check the health endpoint

With the backend running, open or request:

```text
http://localhost:8787/api/health
```

Expected response:

```json
{ "ok": true }
```

This foundation does not include AI integration, authentication, database, terminal, editor, Git, file-manager, or project-manager functionality yet.
