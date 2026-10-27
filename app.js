const form = document.querySelector('#recommend-form');
const input = document.querySelector('#movie-title');
const countSelect = document.querySelector('#recommendation-count');
const submitButton = document.querySelector('#submit-button');
const statusLine = document.querySelector('#model-status');
const resultsSection = document.querySelector('#results-section');
const resultsList = document.querySelector('#results-list');
const resultSummary = document.querySelector('#result-summary');
const suggestionsBox = document.querySelector('#suggestions');
const emptyState = document.querySelector('#empty-state');
const worker = new Worker('worker.js');
let modelReady = false;

function setStatus(message, state = '') {
  statusLine.className = `model-status ${state}`;
  statusLine.querySelector('.status-spinner').hidden = state === 'ready' || state === 'error';
  statusLine.lastChild.textContent = ` ${message}`;
}

worker.addEventListener('message', ({ data }) => {
  if (data.type === 'progress') {
    setStatus(data.message);
    return;
  }
  if (data.type === 'ready') {
    modelReady = true;
    input.disabled = false;
    countSelect.disabled = false;
    submitButton.disabled = false;
    setStatus(`Ready · ${data.movieCount.toLocaleString()} movies loaded`, 'ready');
    input.focus({ preventScroll: true });
    return;
  }
  if (data.type === 'error') {
    setStatus(data.message, 'error');
    return;
  }
  if (data.type === 'recommendations') {
    renderRecommendations(data);
  }
});

worker.postMessage({ type: 'initialize', dataset: 'movie_recommendation_dataset.csv' });

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!modelReady) return;
  const title = input.value.trim();
  if (!title) return;
  submitButton.disabled = true;
  submitButton.querySelector('span').textContent = 'Finding…';
  suggestionsBox.hidden = true;
  resultsList.replaceChildren();
  resultsSection.hidden = false;
  emptyState.hidden = true;
  resultSummary.textContent = 'Comparing movie details…';
  worker.postMessage({ type: 'recommend', title, limit: Number(countSelect.value) });
});

worker.addEventListener('message', ({ data }) => {
  if (data.type === 'recommendations') {
    submitButton.disabled = false;
    submitButton.querySelector('span').textContent = 'Find movies';
  }
});

document.querySelectorAll('.title-chip').forEach(button => {
  button.addEventListener('click', () => {
    input.value = button.textContent;
    if (modelReady) form.requestSubmit();
  });
});

function renderRecommendations(data) {
  resultsList.replaceChildren();
  suggestionsBox.replaceChildren();
  suggestionsBox.hidden = true;
  if (data.notFound) {
    resultSummary.textContent = 'We couldn’t find that exact title.';
    if (data.matches.length) {
      suggestionsBox.append(document.createTextNode('Did you mean '));
      data.matches.forEach((match, index) => {
        if (index) suggestionsBox.append(document.createTextNode(', '));
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = match;
        button.addEventListener('click', () => { input.value = match; form.requestSubmit(); });
        suggestionsBox.append(button);
      });
      suggestionsBox.append(document.createTextNode('?'));
      suggestionsBox.hidden = false;
    }
    return;
  }
  resultSummary.textContent = `Because you chose ${data.selectedTitle} · Top ${data.results.length} matches`;
  data.results.forEach((movie, index) => {
    const card = document.createElement('article');
    card.className = 'result-card';
    const number = document.createElement('div');
    number.className = 'result-number';
    number.textContent = String(index + 1).padStart(2, '0');
    const detail = document.createElement('div');
    const title = document.createElement('h3');
    title.className = 'result-title';
    title.textContent = movie.title;
    const genres = document.createElement('p');
    genres.className = 'result-genres';
    genres.textContent = movie.genres || 'Genre information unavailable';
    detail.append(title, genres);
    const scoreBox = document.createElement('div');
    scoreBox.className = 'score-box';
    const score = document.createElement('span');
    score.className = 'score-value';
    score.textContent = movie.score.toFixed(3);
    const label = document.createElement('span');
    label.className = 'score-label';
    label.textContent = 'similarity score';
    const track = document.createElement('div');
    track.className = 'score-track';
    track.setAttribute('aria-label', `Similarity score ${movie.score.toFixed(3)}`);
    const fill = document.createElement('div');
    fill.className = 'score-fill';
    fill.style.width = `${Math.max(1, Math.min(100, movie.score * 100))}%`;
    track.append(fill);
    scoreBox.append(score, label, track);
    card.append(number, detail, scoreBox);
    resultsList.append(card);
  });
}
