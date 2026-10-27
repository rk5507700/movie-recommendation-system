# CineMatch movie recommender

CineMatch is a browser based movie recommender built from the project's dataset. It combines genres, overview, keywords, cast, and director, then uses TF-IDF vectors and cosine similarity to rank similar titles. Recommendations run in the browser; no application server or external API is needed after the files are hosted.

## Run locally

1. Open Terminal and change to this project folder:

   ```sh
   cd "/Users/rahulkumawat/DS Lab Movie recommendation system"
   ```

2. Start a local web server:

   ```sh
   python3 -m http.server 8000
   ```

3. Open [http://localhost:8000](http://localhost:8000). To stop the server, return to Terminal and press `Control+C`.

## Publish with GitHub Pages

The `.github/workflows/pages.yml` workflow deploys the webpage and its CSV when changes are pushed to `main`, and can also be started manually from the Actions tab. To enable it:

1. Push the project files and workflow to the GitHub repository's `main` branch.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. Open **Actions** and wait for **Deploy static site to GitHub Pages** to complete. GitHub will show the published URL in the deployment summary and the Pages settings.

Keep `index.html`, `styles.css`, `app.js`, `worker.js`, and `movie_recommendation_dataset.csv` together in the repository root. The site needs the CSV to generate recommendations, and the dataset will be publicly accessible from the published site.

The recommendation score measures metadata similarity, not an individual viewer's preference. The page includes close-title suggestions when an exact title match is unavailable.
