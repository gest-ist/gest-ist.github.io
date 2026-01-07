const SLUG = 'PgslpkZShMbeWNDviq2vgcRWfj5l-ZVuN0K4sSOnSu0' // slug = the identifier in the link when you share a view

// I used this to get the rows from the database while only exposing a view of the database instead of the whole table
// https://api.baserow.io/api/redoc/#tag/Database-table-grid-view/operation/public_list_database_table_grid_view_rows

const ENTRIES_PER_PAGE = 100;

let games = [];
const fuse_options = { //TODO adjust these options
  keys: ['title'],
  threshold: 0.2
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
async function field_name2id() {
  const response = await fetch(`https://api.baserow.io/api/database/views/${SLUG}/public/info/`, { method: "GET" });
  let data = await response.json();
  let res = {};
  data.fields.forEach((field) => {
    res[field.name] = field.id;
  });
  return res;
}

function gameField(game, name) {
  return game[`field_${field2id[name]}`]
}

function game_container_template(title, publishing_year, players_min, players_max, time_min, time_max, image, status) {
  let availability_tag = {
    'Unavailable': '<span class="tag is-danger is-medium unavailable">Não Disponível</span>',
    'Requested': '<span class="tag is-warning is-medium requested">Requisitado</span>',
    'Available': ''
  };
  return `
    <div class="box image-container">
      <figure class="image is-square">
          <img src="${image === "" ? "https://placehold.co/64x64" : image}">
      </figure>
      ${availability_tag[status]
    }
      <span class="tag is-rounded players"><i class="fas fa-users"></i>${players_min == players_max ? players_min : `${players_min} - ${players_max}`}</span>
      <span class="tag is-rounded time"><i class="fas fa-hourglass"></i>${time_min == time_max ? time_min : `${time_min} - ${time_max}`}</span>
    </div>
    <p class="has-text-grey is-size-7 game-year">${publishing_year}</p>
    <p class="game-title">${title}</p>
  `
}

function skeleton() {
  const str = `
  <div class="column game is-half-mobile is-one-third-tablet is-one-quarter-desktop skeleton">
    <div class="box image-container">
        <figure class="image is-skeleton">
            <img src="https://placehold.co/64x64">
        </figure>
      <p class="has-text-grey is-size-7 game-year is-invisible">9999</p>
      <p class="game-title is-invisible">Title</p>
    </div>
  </div>
  `
  const div = document.createElement('div');
  div.innerHTML = str.trim();
  return div.firstElementChild;
}

function showHideGames() {
  let intersection = currentFilteredGames.intersection(currentSearchedGames);
  games.forEach(game => {
    if(intersection.has(game.id)){
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



async function load_db_page(page) {
  const response = await fetch(`https://api.baserow.io/api/database/views/grid/${SLUG}/public/rows/?page=${page}&order_by=-field_${field2id['avgScore']}&filter__field_${field2id['status']}__single_select_not_equal=Unavailable&size=${ENTRIES_PER_PAGE}`, { method: "GET" });
  return await response.json();
}

async function load() {
  field2id = await field_name2id();
  let grid = document.querySelector('#game-grid');

  let page = 1;
  let pages_left = true;
  while (pages_left) {
    for (let i = 0; i < ENTRIES_PER_PAGE; i++) {
      grid.appendChild(skeleton());
    }
    db = await load_db_page(page);
    if (db.next === null) pages_left = false;

    db.results.forEach(game => {
      field = (name) => gameField(game, name);
      if (field('status').value != 'Unavailable') { // don't show unavailable games
        let game_container = grid.querySelector(".skeleton");
        game_container.classList.remove('skeleton');
        game_container.innerHTML = game_container_template(field('title'), field('publishingYear'), field('playersMin'), field('playersMax'), field('timeMin'), field('timeMax'), field('image'), field('status').value);
        game_container.addEventListener('click', () => handleClickGame(game));
        games.push({ title: field('title'), playersMin: field('playersMin'), playersMax: field('playersMax'), timeMin: field('timeMin'), timeMax: field('timeMax'), rating: field('avgScore'), weight: field('weight'), year: field('publishingYear'), id: field('bggId'), status: field('status').value, element: game_container });
      }
      fuse = new Fuse(games, fuse_options);
      applySearchFilter();
      applyFilter();
      applySort();
    });
    page++;
  }
  document.querySelectorAll('.skeleton').forEach(el => el.remove());
}

function handleClickGame(game) {
  const modal = document.querySelector('#game-modal');
  modal.classList.add('is-active');
  modal.querySelector('.modal-card-title').textContent = gameField(game, 'title');
  modal.querySelector('.modal-image img').src = gameField(game, 'image') || "https://placehold.co/350x350";
  modal.querySelector('.lang-pt').textContent = `Estado: ${gameField(game, 'status').value === 'Available' ? 'Disponível' : gameField(game, 'status').value === 'Requested' ? 'Requisitado' : 'Indisponível'}`;
  if (gameField(game, 'playersMin') == gameField(game, 'playersMax')) {
    modal.querySelector('.lang-pt + p').textContent = `Jogadores: ${gameField(game, 'playersMin')}`;
  } else {
    modal.querySelector('.lang-pt + p').textContent = `Jogadores: ${gameField(game, 'playersMin')}- ${gameField(game, 'playersMax')}`;
  }
  modal.querySelector('.lang-pt + p').textContent += ` (Ótimo: ${gameField(game, 'playersBest')}) | Duração: ${gameField(game, 'timeMin')}-${gameField(game, 'timeMax')} mins`;
  modal.querySelector('.lang-pt + p + p').textContent = `Classificação BGG: ${gameField(game, 'avgScore')} | Peso: ${gameField(game, 'weight')}`;

  modal.querySelector('.lang-en').textContent = `Status: ${gameField(game, 'status').value === 'Available' ? 'Available' : gameField(game, 'status').value === 'Requested' ? 'Requested' : 'Unavailable'}`;
  if (gameField(game, 'playersMin') == gameField(game, 'playersMax')) {
    modal.querySelector('.lang-en + p').textContent = `Players: ${gameField(game, 'playersMin')}`;
  } else {
    modal.querySelector('.lang-en + p').textContent = `Players: ${gameField(game, 'playersMin')}- ${gameField(game, 'playersMax')}`;
  }
  modal.querySelector('.lang-en + p').textContent += ` (Best: ${gameField(game, 'playersBest')}) | Duration: ${gameField(game, 'timeMin')}-${gameField(game, 'timeMax')} mins`;
  modal.querySelector('.lang-en + p + p').textContent = `BGG Rating: ${gameField(game, 'avgScore')} | Weight: ${gameField(game, 'weight')}`;

  modal.querySelector('.modal-card-foot a').href = `https://boardgamegeek.com/boardgame/${gameField(game, 'bggId')}/`;
  modal.querySelector('.modal-card-foot a + a').href = `https://boardgamegeek.com/boardgame/${gameField(game, 'bggId')}/`;

  modal.querySelector('.close-modal').onclick = () => {
    modal.classList.remove('is-active');
  };
  // close window when pressing ESC
  window.onkeydown = (e) => {
    if (e.key === "Escape") {
      modal.classList.remove('is-active');
    }
  };

  // close modal when clicking outside
  modal.querySelector('.modal-background').onclick = () => {
    modal.classList.remove('is-active');
  };

  // close modal when touching outside (for mobile) 
  modal.querySelector('.modal-background').ontouchcancel = () => {
    modal.classList.remove('is-active');
  };

  // window.open(`https://boardgamegeek.com/boardgame/${gameField(game, 'bggId')}/`, '_blank');
}

// MAIN 

load();

document.querySelector('#search-bar').addEventListener('input', e => {
  currentSearch = e.target.value.trim();
  applySearchFilter();
});

document.querySelector("#sort-select").addEventListener('input', e => {
  currentSort = e.target.value;
  applySort();
});

function readFilters() {
  function n(x) {
    //short for number or normalize
    return x == "" ? null : Number(x);
  }
  currentFilter.status = document.querySelector("#filter-status").value;
  currentFilter.playersMin = n(document.querySelector("#filter-players-min").value);
  currentFilter.playersMax = n(document.querySelector("#filter-players-max").value);
  currentFilter.timeMin = n(document.querySelector("#filter-time-min").value);
  currentFilter.timeMax = n(document.querySelector("#filter-time-max").value);
  currentFilter.weightMin = n(document.querySelector("#filter-weight-min").value);
  currentFilter.weightMax = n(document.querySelector("#filter-weight-max").value);
  currentFilter.yearMin = n(document.querySelector("#filter-year-min").value);
  currentFilter.yearMax = n(document.querySelector("#filter-year-max").value);
}

document.querySelectorAll(".filter").forEach(function (element) {
  element.addEventListener('input', e => {
    readFilters();
    applyFilter();
  });
});

document.querySelectorAll("#clear-filters").forEach(function (element) {
  element.addEventListener('click', e => {
    //this is needed because of the different languages
    for(const select of [document.getElementById('sort-select'), document.getElementById('filter-status')]){
      // Find the first option that does NOT have the 'is-hidden' class
      const firstVisibleOption = Array.from(select.options).find(opt => 
        !opt.classList.contains('is-hidden')
      );
      firstVisibleOption.selected = true;
    }

    document.querySelector("#filter-players-min").value = "";
    document.querySelector("#filter-players-max").value = "";
    document.querySelector("#filter-time-min").value = "";
    document.querySelector("#filter-time-max").value = "";
    document.querySelector("#filter-weight-min").value = "";
    document.querySelector("#filter-weight-max").value = "";
    document.querySelector("#filter-year-min").value = "";
    document.querySelector("#filter-year-max").value = "";
    readFilters();
    applyFilter();
  });
});