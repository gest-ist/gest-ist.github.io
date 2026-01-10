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

const RANGE_FILTERS = {
    playersMin: document.getElementById("filter-players-min"),
    playersMax: document.getElementById("filter-players-max"),
    timeMin: document.getElementById("filter-time-min"),
    timeMax: document.getElementById("filter-time-max"),
    weightMin: document.getElementById("filter-weight-min"),
    weightMax: document.getElementById("filter-weight-max"),
    yearMin: document.getElementById("filter-year-min"),
    yearMax: document.getElementById("filter-year-max"),
}

const SELECT_FILTERS = {
    sort: document.getElementById("sort-select"),
    status: document.getElementById("filter-status"),
}

const FILTERS = { ...SELECT_FILTERS, ...RANGE_FILTERS }

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

function applySort() {
    const comp = COMPARATORS[currentSort];
    const indices = games.map((_, i) => i);
    indices.sort((a, b) => comp(games[a], games[b]));
    indices.forEach((index, i) => games[index].element.style.order = i);
}

function fulfilFilter(game) {
    const [f, g] = [currentFilter, game]; // easier to read the rest
    return (f.status == Status.ANY || g.status == f.status)
        && intervalsIntersect(f.playersMin, f.playersMax, g.playersMin, g.playersMax)
        && intervalsIntersect(f.timeMin, f.timeMax, g.timeMin, g.timeMax)
        && inInterval(f.weightMin, g.weight, f.weightMax)
        && inInterval(f.yearMin, g.year, f.yearMax)
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
    element.addEventListener('click', () => openGameModal(game));
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

function openGameModal(game) {
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

    const playerRange = renderRange(game.playersMin, game.playersMax);
    const single = game.playersMin == game.playersMax;
    MODAL.querySelector(".modal-info .lang-pt.players").textContent = `${playerRange}${single ? "" : ` (Ótimo: ${game.playersBest})`}`;
    MODAL.querySelector(".modal-info .lang-en.players").textContent = `${playerRange}${single ? "" : ` (Best: ${game.playersBest})`}`;

    MODAL.querySelector(".modal-info .lang-pt.time").textContent =
        MODAL.querySelector(".modal-info .lang-en.time").textContent = renderRange(game.timeMin, game.timeMax) + " mins";

    MODAL_RATING.textContent = game.rating;
    MODAL_WEIGHT.textContent = game.weight;

    MODAL.querySelector(".modal-card-foot a").href =
        MODAL.querySelector(".modal-card-foot a + a").href = game.bgg();
}

function closeGameModal() {
    MODAL.classList.remove("is-active");
    HTML.classList.remove("is-clipped");
}

function readFilters() {
    const n = el => el.value == "" ? null : Number(el.value);
    Object.entries(FILTERS).forEach((key, el) => currentFilter[key] = n(el));
}

function clearFilters() {
    Object.values(RANGE_FILTERS).forEach(f => f.value = "");
    //this is needed because of the different languages
    Object.values(SELECT_FILTERS).forEach(f => {
        const first = f.options.find(o => !isHidden(o));
        if (first !== undefined) first.selected = true;
    });

    readFilters();
    applyFilter();
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

    document.querySelectorAll("#clear-filters").forEach(el =>
        el.addEventListener('click', _ => clearFilters)
    );

    // Close window when pressing ESC
    window.onkeydown = ev => { if (ev.key === "Escape") closeGameModal() };

    // Close modal when clicking on close buttons
    MODAL.querySelector(".close-modal").onclick =
        // Close modal when clicking outside
        MODAL.querySelector(".modal-background").onclick =
        // Close modal when touching outside (for mobile)
        MODAL.querySelector(".modal-background").ontouchcancel = closeGameModal;
}

// MAIN
load();
initListeners();
