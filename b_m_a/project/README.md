

# AI Education

Welcome to the **AI Education** project. This repository hosts a project designed to explore and educate users about artificial intelligence through interactive web experiences and learning resources. The project leverages modern web development technologies alongside AI-related integrations.

## Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Technologies Used](#technologies-used)
- [Installation](#installation)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Overview

The **AI Education** project is intended as a platform for exploring AI concepts in an educational setting. It includes both frontend and backend components with dedicated folders for various parts of the project. Whether you are an educator, student, or developer, this project aims to offer a practical introduction to AI and related technologies.

## Project Structure

The repository is organized as follows:

```
ai_education/
├── b_m_a/
│   └── project/
│       ├── .ai/          # (AI configuration or assets)
│       ├── backend/      # (Backend code and API services)
│       ├── project/      # (Additional project-specific files)
│       ├── src/          # (Frontend source code)
│       ├── index.html    # (Entry point for the web application)
│       ├── package.json  # (NPM project configuration)
│       ├── package-lock.json
│       ├── vite.config.js
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       ├── .gitignore
│       └── eslint.config.js
```

This structure separates concerns to keep the codebase organized:
- **Frontend:** Managed under `src/` with an HTML entry point.
- **Backend:** Housed in the `backend/` folder for server-side logic.
- **AI Assets/Config:** Located under the `.ai` folder.

## Technologies Used

- **JavaScript/TypeScript:** Main language for frontend and build tools.
- **Python:** Used in backend or AI modules (if applicable).
- **Vite:** Fast development server and build tool.
- **Tailwind CSS:** Utility-first CSS framework for styling.
- **ESLint:** For linting JavaScript code.

## Installation

To get started with the project locally, follow these steps:

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Sagar387/ai_education.git
   cd ai_education/b_m_a/project
   ```


2.  Setup Python Environment:**

   If the backend requires Python dependencies, navigate to the backend directory and install the necessary packages (ensure you have Python installed):

   ```bash
   cd backend
   .\venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```


Once the installation is complete, you can run the development server:
Open a new terminal and keep the backend terminal open
Dirct to src folder

3. **Start the frontend development server:**

   ```bash
   cd src
   npm i/ npm install
   npm run dev
   ```

   This will launch the project on a local server (usually at `http://localhost:3000` or as specified by Vite).

4. To access azure here are the credentials where you can find the azure keys and database models
    username: bluemarbleai@outlook.com
    password: 4<Fid=)6cV/Va4;

## Contributing

Contributions are welcome! If you have suggestions, improvements, or bug fixes, please open an issue or submit a pull request. For major changes, it’s best to open an issue first to discuss what you would like to change.

## License

This project does not currently have a license. Please add a license if you intend to open source it or share it with the community.

## Contact

For any questions or feedback, feel free to reach out via [GitHub Issues](https://github.com/Sagar387/ai_education/issues) or contact the repository owner directly on GitHub.

---

*Created by [Sagar387](https://github.com/Sagar387)*

---

Feel free to adjust the sections and details as your project evolves. Enjoy building and learning with AI!
