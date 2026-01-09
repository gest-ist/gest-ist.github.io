// Slugs → the identifier in the link when you share a view
const EXISTING_SLUG = "mdvDO5fm2Fh8iXdafNlx63DKzxcIowciyf0Po25Y8d0"
const ALL_SLUG = "zv9hstXOXWdDo7_0LQ5L8hKKBk-nBrJtzxOlfs7Q8UU";
const SLUG = ALL_SLUG;  // active slug

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
    0: '',
    1: '<span class="tag is-warning is-medium requested"><p class="lang lang-pt">Requisitado</p><p class="lang lang-en is-hidden">Requested</p></span>',
    2: '<span class="tag is-danger is-medium unavailable"><span class="lang lang-pt">Não Disponível</span><span class="lang lang-en is-hidden">Unavailable</span></span>',
};

// ELEMENTS
const HTML = document.querySelector("html");
const GRID = document.getElementById("game-grid");

const MODAL = document.getElementById("game-modal");
const MODAL_IMG = document.getElementById("modal-img");
const MODAL_STATUS = document.getElementById("modal-status");
const MODAL_STATUS_ICON = MODAL_STATUS.querySelector(".icon>i")
const MODAL_RATING = document.getElementById("rating");
const MODAL_WEIGHT = document.getElementById("weight");

const FUSE_OPTIONS = {
    keys: ["title"],
    threshold: 0.2,
    isCaseInsensitive: true,
    ignoreDiacritics: true,
}

let fuse;
let currentSearch = "";
let currentSearchedGames = new Set(); // Set
let currentSort = "rating-desc";
let currentFilter = {
    status: Status.ANY,
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

const COMPARATORS = {
    'rating-desc': (a, b) => b.rating - a.rating,
    'rating-asc': (a, b) => a.rating - b.rating,
    'title-asc': (a, b) => strngCmp(a.title, b.title),
    'title-desc': (a, b) => strngCmp(b.title, a.title),
}

const games = [];

function renderRange(min, max) {
    return min == max ? min : `${min} - ${max}`;
}

function gameContainerTemplate(game) {
    return `
    <div class="box image-container">
      <figure class="image is-square ${game.status == Status.OK ? "" : "grayed"}">
          <img src="${game.img()}" loading="lazy">
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


function strngCmp(a, b) {
    a = a.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    b = b.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    if (a < b) return -1;
    else if (b < a) return 1;
    else return 0;
}

function applySort() {
    const comp = COMPARATORS[currentSort];
    const indices = games.map((_, i) => i);
    indices.sort((a, b) => comp(games[a], games[b]));
    indices.forEach((index, i) => games[index].element.style.order = i);
}

function intervalsIntersect(min1, max1, min2, max2) {
    return (min1 == null || max2 == null || min1 <= max2) && (min2 == null || max1 == null || min2 <= max1);
}

function inInterval(min, x, max) {
    return (min == null || min <= x) && (max == null || x <= max);
}
function fulfilFilter(game) {
    return (currentFilter.status == Status.ANY || game.status == currentFilter.status)
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

function appendSkeleton() {
    const div = document.createElement('div');
    GRID.appendChild(div);
    div.outerHTML = SKELETON_INIT_HTML;
    return div;
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
    game.element = element;
    return element;
}

/** Initial page load logic. */
async function load() {
    const api = new ViewAPI(SLUG);

    await api.loadFieldMap();
    await api.loadAll(games, api.fieldMapper, () => {
        for (let i = 0; i < ViewAPI.PAGE_SIZE; ++i) appendSkeleton()
    })

    games.sort(COMPARATORS[currentSort]);
    games.forEach(game => prepareNewGameElement(game));
    fuse = new Fuse(games, FUSE_OPTIONS);
    applySearchFilter();
    applyFilter();
    applySort();

    document.querySelectorAll('.skeleton').forEach(el => el.remove());
}

function handleClickGame(game) {
    HTML.classList.add("is-clipped");

    MODAL.classList.add("is-active");
    MODAL.querySelector(".modal-card-title").textContent = game.title;

    MODAL_IMG.src = game.img();

    let spanClass, iconName, ptName, enName;
    switch (game.status) {
        case Status.OK:
            spanClass = "has-text-success";
            iconName = "fa-check";
            ptName = "Disponível";
            enName = "Available";
            break;
        case Status.TAKEN:
            spanClass = "has-text-warning";
            iconName = "fa-spiral";
            ptName = "Requisitado";
            enName = "Requested";
            break;
        case Status.MISSING:
            spanClass = "has-text-danger";
            iconName = "fa-xmark";
            ptName = "Indisponível";
            enName = "Unavailable";
            break;
    }

    MODAL_STATUS.className = spanClass;
    MODAL_STATUS_ICON.className = `fas ${iconName}`;
    MODAL_STATUS.querySelector(".lang-pt").textContent = ptName;
    MODAL_STATUS.querySelector(".lang-en").textContent = enName;

    MODAL.querySelector(".modal-info-group .lang-pt.players").textContent =
    MODAL.querySelector(".modal-info-group .lang-en.players").textContent = renderRange(game.playersMin, game.playersMax);

    MODAL.querySelector(".modal-info-group .lang-pt.time").textContent =
    MODAL.querySelector(".modal-info-group .lang-en.time").textContent = renderRange(game.timeMin, game.timeMax) + " mins";

    MODAL_RATING.textContent = game.rating;
    MODAL_WEIGHT.textContent = game.weight;

    MODAL.querySelector(".modal-card-foot a").href =
    MODAL.querySelector(".modal-card-foot a + a").href = game.bgg();

    function closeModal() {
        MODAL.classList.remove("is-active");
        HTML.classList.remove("is-clipped");
    }
}

function readFilters() {
    function n(x) {
        //short for number or normalize
        return x == "" ? null : Number(x);
    }
    currentFilter.status = Number(document.getElementById("filter-status").value);
    currentFilter.playersMin = n(document.getElementById("filter-players-min").value);
    currentFilter.playersMax = n(document.getElementById("filter-players-max").value);
    currentFilter.timeMin = n(document.getElementById("filter-time-min").value);
    currentFilter.timeMax = n(document.getElementById("filter-time-max").value);
    currentFilter.weightMin = n(document.getElementById("filter-weight-min").value);
    currentFilter.weightMax = n(document.getElementById("filter-weight-max").value);
    currentFilter.yearMin = n(document.getElementById("filter-year-min").value);
    currentFilter.yearMax = n(document.getElementById("filter-year-max").value);
}

function initListeners() {
    // Apply search filter on each search character
    document.getElementById("search-bar").addEventListener('input', e => {
        currentSearch = e.target.value.trim();
        applySearchFilter();
    });

    // Apply sort on each element change
    document.getElementById("sort-select").addEventListener('input', e => {
        currentSort = e.target.value;
        applySort();
    });

    // Apply search filter on each element change
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

    // Close window when pressing ESC
    window.onkeydown = ev => { if (ev.key === "Escape") closeModal() };

    // Close modal when clicking on close buttons
    MODAL.querySelector(".close-modal").onclick =
    // Close modal when clicking outside
    MODAL.querySelector(".modal-background").onclick =
    // Close modal when touching outside (for mobile)
    MODAL.querySelector(".modal-background").ontouchcancel = closeModal;
}

// MAIN
load();
initListeners();
