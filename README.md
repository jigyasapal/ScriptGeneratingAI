# Podcast Pilot (Firebase Studio Project)

This is a Next.js application built in Firebase Studio that allows you to generate podcast scripts using AI, listen to them with text-to-speech, and customize various aspects of the script and playback.

To get started with development, take a look at `src/app/page.tsx`.

## Running Locally

1.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    # or
    pnpm install
    ```

2.  **Set up Environment Variables:**
    Create a `.env.local` file in the root of your project and add your Google Generative AI API key:
    ```env
    GOOGLE_GENAI_API_KEY=YOUR_API_KEY_HERE
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    # or
    pnpm dev
    ```
    The application will typically be available at `http://localhost:9002`.

4.  **Run Genkit (for AI flow development, in a separate terminal):**
    ```bash
    npm run genkit:watch
    ```

## Version Control with Git & GitHub

To manage your project with Git and host it on GitHub:

1.  **Initialize a Git repository (if you haven't already):**
    ```bash
    git init
    ```

2.  **Stage your files:**
    The `.gitignore` file (included in this project) will ensure that unnecessary files like `node_modules` are not tracked.
    ```bash
    git add .
    ```

3.  **Make your first commit:**
    ```bash
    git commit -m "Initial commit"
    ```

4.  **Create a repository on GitHub:**
    Go to [GitHub](https://github.com) and create a new repository. Do *not* initialize it with a README, .gitignore, or license if you plan to push this existing repository.

5.  **Link your local repository to the GitHub remote:**
    Replace `<YOUR_USERNAME>` and `<YOUR_REPOSITORY_NAME>` with your actual GitHub username and repository name.
    ```bash
    git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY_NAME>.git
    ```

6.  **Push your local changes to GitHub:**
    ```bash
    git push -u origin main
    # Or 'master' if your default branch is named master
    ```

Now your project code is on GitHub! You can continue to commit and push changes as you develop your application.
