// Slugs → the identifier in the link when you share a view
const EXISTING_SLUG = "mdvDO5fm2Fh8iXdafNlx63DKzxcIowciyf0Po25Y8d0"
const ALL_SLUG = "zv9hstXOXWdDo7_0LQ5L8hKKBk-nBrJtzxOlfs7Q8UU";
const SLUG = ALL_SLUG;  // active slug

const VIEW_INFO_URL = new URL(`https://api.baserow.io/api/database/views/${SLUG}/public/info/`)
const VIEW_ROWS_URL = new URL(`https://api.baserow.io/api/database/views/grid/${SLUG}/public/rows/`)

// I used this to get the rows from the database while only exposing a view of the database instead of the whole table
// https://api.baserow.io/api/redoc/#tag/Database-table-grid-view/operation/public_list_database_table_grid_view_rows

// 4 items per row, 100 rows (enough for our current <340 games)
// divides nicely into 2 for mobile viewports
const ENTRIES_PER_PAGE = 4 * 100;

const THUMB_PLACEHOLDER = "https://placehold.co/64x64";
const IMAGE_PLACEHOLDER = "https://placehold.co/350x350";

const SKELETON_INIT_HTML = `
<div class="column game is-half-mobile is-one-third-tablet is-one-quarter-desktop skeleton">
  <div class="box image-container">
    <figure class="image is-skeleton">
    </figure>
    <p class="has-text-grey is-size-7 game-year is-invisible">9999</p>
    <p class="game-title is-invisible">Title</p>
  </div>
</div>
`

const AVAILABILITY_HTML = {
  'Unavailable': '<span class="tag is-danger is-medium unavailable"><span class="lang lang-pt">Não Disponível</span><span class="lang lang-en is-hidden">Unavailable</span></span>',
  'Requested': '<span class="tag is-warning is-medium requested"><p class="lang lang-pt">Requisitado</p><p class="lang lang-en is-hidden">Requested</p></span>',
  'Available': ''
};

// ELEMENTS
const GRID = document.getElementById("game-grid");
const MODAL = document.getElementById("game-modal");

let games = [];
const fuse_options = { //TODO adjust these options
  keys: ['title'],
  threshold: 0.2,
  isCaseInsensitive: true,
  ignoreDiacritics: true,
}
let fuse;

let currentSearch = "";
let currentSearchedGames = new Set(); // Set

let currentSort = "rating-desc";

let currentFilter = {
  status: "Any",
  playersMin: null,
  playersMax: null,
  timeMin: null,
  timeMax: null,
  weightMin: null,
  weightMax: null,
  yearMin: null,
  yearMax: null,
}
let currentFilteredGames = new Set(); // Set

let field2id;
async function fieldName2Id() {
  const response = await fetch(VIEW_INFO_URL);
  let data = await response.json();
  let res = {};
  data.fields.forEach(field => {
    res[field.name] = field.id;
  });
  return res;
}

function renderRange(min, max) {
  return min == max ? min : `${min} — ${max}`;
}

function gameContainerTemplate(game) {
  return `
    <div class="box image-container">
      <figure class="image is-square">
          <img src="${game.thumb || THUMB_PLACEHOLDER}">
      </figure>
      ${AVAILABILITY_HTML[game.status]}
      <span class="tag is-rounded players"><i class="fas fa-users"></i>${renderRange(game.playersMin, game.playersMax)}</span>
      <span class="tag is-rounded time"><i class="fas fa-hourglass"></i>${renderRange(game.timeMin, game.timeMax)}</span>
    </div>
    <p class="has-text-grey is-size-7 game-year">${game.year}</p>
    <p class="game-title">${game.title}</p>
  `
}

function showHideGames() {
  let intersection = currentFilteredGames.intersection(currentSearchedGames);
  games.forEach(game => {
    if (intersection.has(game.id)) {
      game.element.classList.remove('is-hidden');
    } else {
      game.element.classList.add('is-hidden');
    }
  });
}

function applySearchFilter() {
  // No search → show everything
  let searchFilter = !currentSearch ? games : fuse.search(currentSearch).map(entry => entry.item);
  currentSearchedGames = new Set(searchFilter.map(game => game.id));
  showHideGames();
}

function applySort() {
  function strngCmp(a, b) {
    a = a.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    b = b.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    if (a < b) return -1;
    else if (b < a) return 1;
    else return 0;
  }
  comprFn = {
    'rating-desc': (a, b) => b.rating - a.rating,
    'rating-asc': (a, b) => a.rating - b.rating,
    'title-asc': (a, b) => strngCmp(a.title, b.title),
    'title-desc': (a, b) => strngCmp(b.title, a.title),
  }

  const indices = games.map((_, i) => i);
  indices.sort((a, b) => comprFn[currentSort](games[a], games[b]));
  indices.forEach((index, i) => {
    games[index].element.style.order = i;
  });
}

function intervalsIntersect(min1, max1, min2, max2) {
  return (min1 == null || max2 == null || min1 <= max2) && (min2 == null || max1 == null || min2 <= max1);
}

function inInterval(min, x, max) {
  return (min == null || min <= x) && (max == null || x <= max);
}
function fulfilFilter(game) {
  return (currentFilter.status == 'Any' || game.status == currentFilter.status)
    && intervalsIntersect(currentFilter.playersMin, currentFilter.playersMax, game.playersMin, game.playersMax)
    && intervalsIntersect(currentFilter.timeMin, currentFilter.timeMax, game.timeMin, game.timeMax)
    && inInterval(currentFilter.weightMin, game.weight, currentFilter.weightMax)
    && inInterval(currentFilter.yearMin, game.year, currentFilter.yearMax)
}

function applyFilter() {
  let filter = games.filter(fulfilFilter);
  currentFilteredGames = new Set(filter.map(game => game.id));
  showHideGames();
}

async function loadDbPage(page) {
  const url = new URL(VIEW_ROWS_URL);
  const sp = url.searchParams;
  sp.set("page", page);
  sp.set("size", 500);
  const response = await fetch(url);
  return await response.json();
}

function appendSkeleton() {
  const div = document.createElement('div');
  GRID.appendChild(div);
  div.outerHTML = SKELETON_INIT_HTML;
  return div;
}

function game_field(raw_game, name) {
  return raw_game[`field_${field2id[name]}`]
}

function rawToGame(raw) {
  field = (name) => game_field(raw, name);
  return {
    id: field("bggId"),
    title: field("title"),
    playersMin: field("playersMin"),
    playersMax: field("playersMax"),
    timeMin: field("timeMin"),
    timeMax: field("timeMax"),
    rating: field("avgScore"),
    weight: field("weight"),
    year: field("publishingYear"),
    image: field("image"),
    thumb: field("thumb"),
    status: field("status").value,
  };
}

function prepareNewGameElement(game) {
  let element = GRID.querySelector(".skeleton");
  if (element === null) {
    console.warn(`No skeleton for game: ${game.title}`);
    return;
  }
  element.classList.remove('skeleton');
  element.innerHTML = gameContainerTemplate(game);
  element.addEventListener('click', () => handleClickGame(game));
  return element;
}

async function load() {
  field2id = await fieldName2Id();

  let page = 1;
  while (true) {
    for (let i = 0; i < ENTRIES_PER_PAGE; ++i) appendSkeleton()

    db = await loadDbPage(page);

    db.results.forEach(raw_game => {
      let game = rawToGame(raw_game);
      console.log(game.title)
      game.element = prepareNewGameElement(game);
      games.push(game);

      fuse = new Fuse(games, fuse_options);
      applySearchFilter();
      applyFilter();
      applySort();
    });

    if (db.next === null) break;
    page++;
  }

  document.querySelectorAll('.skeleton').forEach(el => el.remove());
}

function handleClickGame(game) {
  MODAL.classList.add('is-active');
  document.querySelector('html').classList.add('is-clipped');
  MODAL.querySelector('.modal-card-title').textContent = game.title;
  let img = MODAL.querySelector('.modal-image img');
  img.src = game.thumb
  img.src = game.image || game.thumb || IMAGE_PLACEHOLDER;
  MODAL.querySelector('.lang-pt').textContent = `Estado: ${game.status === 'Available' ? 'Disponível' : game.status === 'Requested' ? 'Requisitado' : 'Indisponível'}`;
  if (game.playersMin == game.playersMax) {
    MODAL.querySelector('.lang-pt + p').textContent = `Jogadores: ${game.playersMin}`;
  } else {
    MODAL.querySelector('.lang-pt + p').textContent = `Jogadores: ${game.playersMin}- ${game.playersMax}`;
    MODAL.querySelector('.lang-pt + p').textContent += ` (Ótimo: ${game.playersBest})`;
  }

  if (game.timeMin == game.timeMax) {
    MODAL.querySelector('.lang-pt + p').textContent += ` | Duração: ${game.timeMin} mins`;
  }
  else {
    MODAL.querySelector('.lang-pt + p').textContent += ` | Duração: ${game.timeMin}-${game.timeMax} mins`;
  }
  MODAL.querySelector('.lang-pt + p + p').textContent = `Classificação BGG: ${game.avgScore} | Peso: ${game.weight}`;

  MODAL.querySelector('.lang-en').textContent = `Status: ${game.status === 'Available' ? 'Available' : game.status === 'Requested' ? 'Requested' : 'Unavailable'}`;
  if (game.playersMin == game.playersMax) {
    MODAL.querySelector('.lang-en + p').textContent = `Players: ${game.playersMin}`;
  } else {
    MODAL.querySelector('.lang-en + p').textContent = `Players: ${game.playersMin}- ${game.playersMax}`;
    MODAL.querySelector('.lang-en + p').textContent += ` (Best: ${game.playersBest})`;
  }

  if (game.timeMin == game.timeMax) {
    MODAL.querySelector('.lang-en + p').textContent += ` | Duration: ${game.timeMin} mins`;
  }
  else {
    MODAL.querySelector('.lang-en + p').textContent += ` | Duration: ${game.timeMin}-${game.timeMax} mins`;
  }

  MODAL.querySelector('.lang-en + p + p').textContent = `BGG Rating: ${game.avgScore} | Weight: ${game.weight}`;

  MODAL.querySelector('.modal-card-foot a').href = `https://boardgamegeek.com/boardgame/${game.bggId}/`;
  MODAL.querySelector('.modal-card-foot a + a').href = `https://boardgamegeek.com/boardgame/${game.bggId}/`;

  MODAL.querySelector('.close-modal').onclick = () => {
    closeModal();
  };
  // close window when pressing ESC
  window.onkeydown = (e) => {
    if (e.key === "Escape") {
      closeModal();
    }
  };

  // close modal when clicking outside
  MODAL.querySelector('.modal-background').onclick = () => {
    closeModal();
  };

  // close modal when touching outside (for mobile) 
  MODAL.querySelector('.modal-background').ontouchcancel = () => {
    closeModal();
  };

  function closeModal() {
    MODAL.classList.remove('is-active');
    document.querySelector('html').classList.remove('is-clipped');
  }
}

// MAIN

load();

document.getElementById("search-bar").addEventListener('input', e => {
  currentSearch = e.target.value.trim();
  applySearchFilter();
});

document.getElementById("sort-select").addEventListener('input', e => {
  currentSort = e.target.value;
  applySort();
});

function readFilters() {
  function n(x) {
    //short for number or normalize
    return x == "" ? null : Number(x);
  }
  currentFilter.status = document.getElementById("filter-status").value;
  currentFilter.playersMin = n(document.getElementById("filter-players-min").value);
  currentFilter.playersMax = n(document.getElementById("filter-players-max").value);
  currentFilter.timeMin = n(document.getElementById("filter-time-min").value);
  currentFilter.timeMax = n(document.getElementById("filter-time-max").value);
  currentFilter.weightMin = n(document.getElementById("filter-weight-min").value);
  currentFilter.weightMax = n(document.getElementById("filter-weight-max").value);
  currentFilter.yearMin = n(document.getElementById("filter-year-min").value);
  currentFilter.yearMax = n(document.getElementById("filter-year-max").value);
}

document.querySelectorAll(".filter").forEach(el =>
  el.addEventListener('input', _ => {
    readFilters();
    applyFilter();
  })
);

document.querySelectorAll("#clear-filters").forEach(function (element) {
  element.addEventListener('click', e => {
    //this is needed because of the different languages
    for (const select of [document.getElementById('sort-select'), document.getElementById('filter-status')]) {
      // Find the first option that does NOT have the 'is-hidden' class
      const firstVisibleOption = Array.from(select.options).find(opt =>
        !opt.classList.contains('is-hidden')
      );
      firstVisibleOption.selected = true;
    }

    document.getElementById("filter-players-min").value = "";
    document.getElementById("filter-players-max").value = "";
    document.getElementById("filter-time-min").value = "";
    document.getElementById("filter-time-max").value = "";
    document.getElementById("filter-weight-min").value = "";
    document.getElementById("filter-weight-max").value = "";
    document.getElementById("filter-year-min").value = "";
    document.getElementById("filter-year-max").value = "";
    readFilters();
    applyFilter();
  });
});
