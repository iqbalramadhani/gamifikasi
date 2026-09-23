# Game Project

This is a game project that uses Vite and Three.js for the frontend, and Express and SQLite3 for the backend.

## Prerequisites

- Node.js (version 16 or later recommended)
- npm (Node Package Manager)

## Setup and Installation

1. Clone the repository or download the source code.
2. Navigate to the project directory:
   ```bash
   cd /Users/iqbal/Downloads/game
   ```
3. Install the dependencies:
   ```bash
   npm install
   ```

## Running the Project

### Frontend Development Server

To start the Vite development server for the frontend, run:

```bash
npm run dev
```

The frontend will typically be accessible at `http://localhost:5173`.

### Backend Server

To start the Express backend server, run:

```bash
node server.js
```

## Building for Production

To build the frontend for production, run:

```bash
npm run build
```

This will create a `dist` directory with the optimized production files.

## Project Structure

- `server.js`: The entry point for the backend Express server.
- `index.html`: The main HTML file for the frontend.
- `src/`: Contains the frontend source code (JavaScript/TypeScript and CSS).
- `package.json`: Contains project dependencies and scripts.
- `game_save.sqlite`: SQLite database for game data.

## Technologies Used

- **Frontend:** HTML, CSS, JavaScript, [Three.js](https://threejs.org/), [Vite](https://vitejs.dev/)
- **Backend:** [Node.js](https://nodejs.org/), [Express](https://expressjs.com/), [SQLite3](https://www.sqlite.org/)
