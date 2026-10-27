const ENGLISH_STOP_WORDS = new Set('a about above across after afterwards again against all almost alone along already also although always am among amongst amoungst amount an and another any anyhow anyone anything anyway anywhere are around as at back be became because become becomes becoming been before beforehand behind being below beside besides between beyond bill both bottom but by call can cannot cant co con could couldnt cry de describe detail do done down due during each eg eight either eleven else elsewhere empty enough etc even ever every everyone everything everywhere except few fifteen fifty fill find fire first five for former formerly forty found four from front full further get give go had has hasnt have he hence her here hereafter hereby herein hereupon hers herself him himself his how however hundred i ie if in inc indeed interest into is it its itself keep last latter latterly least less ltd made many may me meanwhile might mill mine more moreover most mostly move much must my myself name namely neither never nevertheless next nine no nobody none noone nor not nothing now nowhere of off often on once one only onto or other others otherwise our ours ourselves out over own part per perhaps please put rather re same see seem seemed seeming seems serious several she should show side since sincere six sixty so some somehow someone something sometime sometimes somewhere still such system take ten than that the their them themselves then thence there thereafter thereby therefore therein thereupon these they thick thin third this those though three through throughout thru thus to together too top toward towards twelve twenty two un under until up upon us very via was we well were what whatever when whence whenever where whereafter whereas whereby wherein whereupon wherever whether which while whither who whoever whole whom whose why will with within without would yet you your yours yourself yourselves'.split(' '));
const TEXT_FIELDS = ['genres', 'overview', 'keywords', 'cast', 'director'];
let movies = [];
let indexByTitle = new Map();
let invertedIndex = new Map();
let vectors = [];

self.addEventListener('message', async ({ data }) => {
  if (data.type === 'initialize') await initialize(data.dataset);
  if (data.type === 'recommend') recommend(data.title, data.limit);
});

async function initialize(dataset) {
  try {
    self.postMessage({ type: 'progress', message: 'Loading the movie collection…' });
    const response = await fetch(dataset);
    if (!response.ok) throw new Error(`Could not load ${dataset} (${response.status}).`);
    const csvText = await response.text();
    const rows = parseCSV(csvText);
    if (rows.length < 2) throw new Error('The movie dataset is empty or could not be read.');
    const columns = rows[0].map(value => value.trim().toLowerCase());
    const titleColumn = columns.indexOf('title');
    if (titleColumn < 0) throw new Error('The CSV must have a title column.');
    const fieldIndexes = Object.fromEntries(TEXT_FIELDS.map(field => [field, columns.indexOf(field)]));
    movies = rows.slice(1).filter(row => row[titleColumn]?.trim()).map(row => {
      const movie = { title: row[titleColumn].trim(), genres: valueAt(row, fieldIndexes.genres) };
      movie.tokens = tokenize(TEXT_FIELDS.map(field => valueAt(row, fieldIndexes[field])).join(' '));
      return movie;
    });
    if (!movies.length) throw new Error('No movie titles were found in the CSV.');
    self.postMessage({ type: 'progress', message: `Building text features for ${movies.length.toLocaleString()} movies…` });
    buildIndex();
    indexByTitle = new Map();
    movies.forEach((movie, index) => {
      const key = movie.title.toLowerCase();
      if (!indexByTitle.has(key)) indexByTitle.set(key, index);
    });
    self.postMessage({ type: 'ready', movieCount: movies.length });
  } catch (error) {
    self.postMessage({ type: 'error', message: `${error.message} Start this page through the included local server instructions so it can read the CSV.` });
  }
}

function valueAt(row, index) { return index < 0 ? '' : (row[index] || ''); }

function tokenize(text) {
  const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.match(/[a-z0-9]{2,}/g)?.filter(token => !ENGLISH_STOP_WORDS.has(token)) || [];
}

function buildIndex() {
  const documentFrequency = new Map();
  for (const movie of movies) {
    movie.counts = new Map();
    for (const token of movie.tokens) movie.counts.set(token, (movie.counts.get(token) || 0) + 1);
    for (const token of movie.counts.keys()) documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
    delete movie.tokens;
  }
  const total = movies.length;
  invertedIndex = new Map();
  vectors = new Array(total);
  for (let movieIndex = 0; movieIndex < total; movieIndex++) {
    const counts = movies[movieIndex].counts;
    let normSquared = 0;
    const weighted = [];
    for (const [token, termFrequency] of counts) {
      const inverseFrequency = Math.log((1 + total) / (1 + documentFrequency.get(token))) + 1;
      const weight = termFrequency * inverseFrequency;
      weighted.push([token, weight]);
      normSquared += weight * weight;
    }
    const norm = Math.sqrt(normSquared) || 1;
    const normalizedVector = new Map();
    for (const [token, weight] of weighted) {
      const normalizedWeight = weight / norm;
      normalizedVector.set(token, normalizedWeight);
      let postings = invertedIndex.get(token);
      if (!postings) invertedIndex.set(token, postings = []);
      postings.push([movieIndex, normalizedWeight]);
    }
    vectors[movieIndex] = normalizedVector;
    delete movies[movieIndex].counts;
  }
}

function recommend(query, limit) {
  const key = query.trim().toLowerCase();
  const selectedIndex = indexByTitle.get(key);
  if (selectedIndex === undefined) {
    self.postMessage({ type: 'recommendations', notFound: true, matches: closeMatches(query, 3) });
    return;
  }
  const scores = new Float64Array(movies.length);
  const selected = movies[selectedIndex];
  // Reuse the selected movie's normalized TF-IDF vector for an exact cosine score.
  const selectedVector = vectors[selectedIndex];
  for (const [token, selectedWeight] of selectedVector) {
    for (const [movieIndex, weight] of invertedIndex.get(token) || []) scores[movieIndex] += selectedWeight * weight;
  }
  const ranked = movies.map((movie, index) => ({ movie, index, score: scores[index] }))
    .filter(item => item.index !== selectedIndex)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(item => ({ title: item.movie.title, genres: item.movie.genres, score: item.score }));
  self.postMessage({ type: 'recommendations', notFound: false, selectedTitle: selected.title, results: ranked });
}


function closeMatches(query, count) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return movies.map(movie => ({ title: movie.title, score: similarity(normalized, movie.title.toLowerCase()) }))
    .filter(item => item.score >= 0.4)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, count).map(item => item.title);
}

function similarity(a, b) {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = current;
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

function parseCSV(text) {
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(value); value = ''; }
    else if (char === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; }
    else value += char;
  }
  if (value.length || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row); }
  return rows;
}
