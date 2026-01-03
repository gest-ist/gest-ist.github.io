const SLUG = 'PgslpkZShMbeWNDviq2vgcRWfj5l-ZVuN0K4sSOnSu0' // slug = the identifier in the link when you share a view

// I used this to get the rows from the database while only exposing a view of the database instead of the whole table
// https://api.baserow.io/api/redoc/#tag/Database-table-grid-view/operation/public_list_database_table_grid_view_rows

const ENTRIES_PER_PAGE = 100;

let games = [];
const fuse_options = { //TODO adjust these options
    keys: ['title'],
    threshold: 0.0
  }
let fuse; 

let currentSearch = "";

let field2id;
async function field_name2id() {
  const response = await fetch(`https://api.baserow.io/api/database/views/${SLUG}/public/info/`, {method: "GET"});
  let data = await response.json();
  let res = {};
  data.fields.forEach((field) => {
    res[field.name] = field.id;
  });
  return res;
}

function gameField(game, name){
  return game[`field_${field2id[name]}`]
}

function game_container_template(title, publishing_year, players_min, players_max, time_min, time_max, image, status){
  let availability_tag = {
    'Unavailable': '<span class="tag is-danger is-medium unavailable">Não Disponível</span>',
    'Requested':  '<span class="tag is-warning is-medium requested">Requisitado</span>',
    'Available': ''
  };
  return `
    <div class="box image-container">
      <figure class="image is-square">
          <img src="${image === "" ? "https://placehold.co/64x64" : image}">
      </figure>
      ${
       availability_tag[status]
      }
      <span class="tag is-rounded players"><i class="fas fa-users"></i>${players_min == players_max ? players_min : `${players_min} - ${players_max}`}</span>
      <span class="tag is-rounded time"><i class="fas fa-hourglass"></i>${time_min == time_max ? time_min : `${time_min} - ${time_max}`}</span>
    </div>
    <p class="has-text-grey is-size-7 game-year">${publishing_year}</p>
    <p class="game-title">${title}</p>
  `
}

function skeleton(){
  const str =  `
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

function applySearchFilter() {
  const grid = document.querySelector('#game-grid');

  // No search → show everything
  if (!currentSearch) {
    grid.querySelectorAll('.column').forEach(el =>
      el.classList.remove('is-hidden')
    );
    return;
  }

  // Hide all first
  grid.querySelectorAll('.column').forEach(el =>
    el.classList.add('is-hidden')
  );

  // Show matches only
  fuse.search(currentSearch).forEach(({ item }) => {
    item.element.classList.remove('is-hidden');
  });
}



async function load_db_page(page) {
  const response = await fetch(`https://api.baserow.io/api/database/views/grid/${SLUG}/public/rows/?page=${page}&order_by=-field_${field2id['avgScore']}&size=${ENTRIES_PER_PAGE}`, {method: "GET"});
  return await response.json();
}

async function load() {
  field2id = await field_name2id();  
  let grid = document.querySelector('#game-grid');
  
  let page = 1;
  let pages_left = true;
  while(pages_left){
    for (let i = 0; i < ENTRIES_PER_PAGE; i++) {
      grid.appendChild(skeleton());
    }
    db = await load_db_page(page);
    if(db.next === null) pages_left = false;

    db.results.forEach(game => {
      field = (name) => gameField(game, name);
      if(field('status').value != 'Unavailable') { // don't show unavailable games
        let game_container = grid.querySelector(".skeleton");
        game_container.classList.remove('skeleton');
        game_container.innerHTML = game_container_template(field('title'), field('publishingYear'), field('playersMin'), field('playersMax'), field('timeMin'), field('timeMax'), field('image'), field('status').value);
        game_container.addEventListener('click', () => handleClickGame(game));
        games.push({title: field('title'), element: game_container});
      }
      fuse = new Fuse(games, fuse_options); 
      applySearchFilter();
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
  }

  // window.open(`https://boardgamegeek.com/boardgame/${gameField(game, 'bggId')}/`, '_blank');
}

// MAIN 

load();

document.querySelector('#search-bar').addEventListener('input', e => {
  currentSearch = e.target.value.trim();
  applySearchFilter();
});