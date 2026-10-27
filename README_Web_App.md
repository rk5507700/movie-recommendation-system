# CineMatch movie recommender

CineMatch is a browser based movie recommender built from the project's dataset. The recommendation index is precomputed with the project's TF-IDF and cosine-similarity method. It stores each movie's title, genres, and 15 highest-scoring neighbors. The webpage loads this index, so it does not need the raw CSV or a server-side model at runtime.

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

Keep `index.html`, `styles.css`, `app.js`, `worker.js`, and `recommendation_model.json` together. The page only loads the precomputed JSON index; the CSV is not needed to run the webpage.

## Rebuild the recommendation index

If the dataset changes, regenerate the index from the CSV:

```sh
python3 -m pip install -r requirements-model.txt
python3 build_recommendation_model.py
```

The script applies the same text cleaning, five metadata fields, English stop-word TF-IDF, and cosine similarity as the notebook. It processes similarity scores in chunks and saves the top 15 neighbors for every movie in `recommendation_model.json`.

## Publish with GitHub Pages

The `.github/workflows/pages.yml` workflow deploys the webpage and precomputed index when changes are pushed to `main`, and can also be started manually from the Actions tab. To enable it:

1. Push the project files and workflow to the GitHub repository's `main` branch.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. Open **Actions** and wait for **Deploy static site to GitHub Pages** to complete. GitHub will show the published URL in the deployment summary and the Pages settings.

The deployment includes the webpage and `recommendation_model.json`, not the raw CSV or notebook. The source CSV remains in the repository so the index can be rebuilt; anyone with access to that repository can still access it there.

The recommendation score measures metadata similarity, not an individual viewer's preference. The page includes close-title suggestions when an exact title match is unavailable.
