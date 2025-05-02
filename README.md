# Gemini AI File/Directory Processor Frontend (React TypeScript)

Frontend application built with React and TypeScript, designed to provide a user interface for interacting with the local Azure Functions backend that processes files/directories using the Google Gemini AI API.

**⚠️ SECURITY WARNING ⚠️**
**This frontend should NEVER be deployed to a production environment or hosted anywhere accessible to the public internet while configured to point to that insecure backend.**

## Features

*   User interface to input a local directory path and a prompt.
*   Displays conversation history with the Gemini API.
*   Sidebar to list previous conversations.
*   Ability to load and continue previous conversations by clicking on them in the sidebar.
*   Automatic management of session IDs for continuing conversations.
*   Uses Markdown rendering (`react-markdown`) to display formatted responses from Gemini.
*   Stores the list of conversation IDs and titles locally in the browser's `localStorage` for persistence between browser sessions.

## Prerequisites
*   **Node.js:** Version 14 or later is recommended.
*   **A package manager:** npm, yarn, or pnpm.
*   **The backend Azure Functions project running locally:** Ensure your backend is started (`func start`) and listening on `http://localhost:7071` (or the port indicated in its output) and is configured with your Gemini API key and CORS settings to allow requests from your frontend's development port

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Akmalfazili/my-gemini-frontend.git
    cd <project_folder> # Navigate to the project folder 
    ```
2.  **Install dependencies:**
    ```bash
    # Using npm
    npm install
    ```

## Running Locally

1.  **Ensure your backend Azure Function is running** in a separate terminal:
    ```bash
    cd <path_to_backend_project>
    func start
    ```
2.  **Open your terminal** in the frontend project directory.
3.  **Start the React development server:**
    ```bash
    # Using npm
    npm run dev
    ```
4.  The server will start, and you will see a local URL.
5.  **Open this URL** in your web browser.
