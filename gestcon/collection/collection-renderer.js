const SLUG = 'PgslpkZShMbeWNDviq2vgcRWfj5l-ZVuN0K4sSOnSu0' // slug = the identifier in the link when you share a view

// I used this to get the rows from the database while only exposing a view of the database instead of the whole table
// https://api.baserow.io/api/redoc/#tag/Database-table-grid-view/operation/public_list_database_table_grid_view_rows

const ENTRIES_PER_PAGE = 100;

function cell_template(title, publishing_year, players_min, players_max, time_min, time_max, image, status){
  var availability_tag = {
    'Unavailable': '<span class="tag is-danger is-medium unavailable">Não Disponível</span>',
    'Requested':  '<span class="tag is-warning is-medium requested">Requisitado</span>',
    'Available': ''
  };
  return `
    <div class="box">
      <figure class="image}">
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

const skeleton =  `
  <div class="cell skeleton">
    <div class="box">
          <figure class="image is-skeleton">
              <img src="https://placehold.co/64x64">
          </figure>
      </div>
      <p class="has-text-grey is-size-7 game-year is-invisible">9999</p>
      <p class="game-title is-invisible">Title</p>
    </div>
  </div>
  `
async function field_name2id() {
  const response = await fetch(`https://api.baserow.io/api/database/views/${SLUG}/public/info/`, {method: "GET"});
  var data = await response.json();
  var res = {};
  data.fields.forEach((field) => {
    res[field.name] = field.id;
  });
  return res;
}

async function load_db_page(page) {
  const response = await fetch(`https://api.baserow.io/api/database/views/grid/${SLUG}/public/rows/?page=${page}&user_field_names=true&size=${ENTRIES_PER_PAGE}`, {method: "GET"});
  return await response.json();
}

async function load() {
  var field2id = await field_name2id();  
  var grid = document.querySelector('#game-grid');
  
  var page = 1;
  var pages_left = true;
  while(pages_left){
    grid.innerHTML += skeleton.repeat(ENTRIES_PER_PAGE);
    db = await load_db_page(page);
    if(db.next === null) pages_left = false;

    db.results.forEach(game => {
      function field(name){
        return game[`field_${field2id[name]}`]
      }
      if(field('Status').value != 'Unavailable') { // don't show games which are unavailable
        let cell = grid.querySelector(".skeleton");
        cell.classList.remove('skeleton');
        cell.innerHTML = cell_template(field('Title'), field('Publishing-year'), field('Players-min'), field('Players-max'), field('Time-min'), field('Time-max'), field('Image'), field('Status').value);
      }
    });
    page++;
  }
  document.querySelectorAll('.skeleton').forEach(el => el.remove());
}

load();
