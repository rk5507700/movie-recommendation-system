const MODEL_FORMAT = 'cinematch-neighbor-index-v1';
let movies = [];
let recommendations = [];
let indexByTitle = new Map();

self.addEventListener('message', async ({ data }) => {
  if (data.type === 'initialize') await initialize(data.model);
  if (data.type === 'recommend') recommend(data.title, data.limit);
});

async function initialize(modelPath) {
  try {
    self.postMessage({ type: 'progress', message: 'Loading saved movie recommendations…' });
    const response = await fetch(modelPath);
    if (!response.ok) throw new Error(`Could not load ${modelPath} (${response.status}).`);
    const model = await response.json();
    if (model.format !== MODEL_FORMAT || !Array.isArray(model.movies) || !Array.isArray(model.recommendations)) {
      throw new Error('The saved recommendation model has an unsupported format.');
    }
    if (model.movies.length !== model.recommendations.length) {
      throw new Error('The saved recommendation model is incomplete.');
    }
    movies = model.movies;
    recommendations = model.recommendations;
    movies.forEach((movie, index) => {
      const key = movie.title.toLowerCase();
      if (!indexByTitle.has(key)) indexByTitle.set(key, index);
    });
    self.postMessage({ type: 'ready', movieCount: movies.length });
  } catch (error) {
    self.postMessage({ type: 'error', message: `${error.message} Keep recommendation_model.json beside the webpage files.` });
  }
}

function recommend(query, limit) {
  const selectedIndex = indexByTitle.get(query.trim().toLowerCase());
  if (selectedIndex === undefined) {
    self.postMessage({ type: 'recommendations', notFound: true, matches: closeMatches(query, 3) });
    return;
  }
  const results = recommendations[selectedIndex].slice(0, limit).map(([movieIndex, score]) => ({
    title: movies[movieIndex].title,
    genres: movies[movieIndex].genres,
    score,
  }));
  self.postMessage({
    type: 'recommendations',
    notFound: false,
    selectedTitle: movies[selectedIndex].title,
    results,
  });
}

function closeMatches(query, count) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return movies
    .map(movie => ({ title: movie.title, score: similarity(normalized, movie.title.toLowerCase()) }))
    .filter(item => item.score >= 0.4)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, count)
    .map(item => item.title);
}

function similarity(a, b) {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}
