const games = '760059';
const users = '760060';
const logs = '783823';

const ENTRIES_PER_PAGE = 200;

// ELEMENTS
const REQUEST_BTN = document.getElementById("request-button");
const REGISTER_BTN = document.getElementById("register-add-user");

const ERROR_MODAL = document.getElementById("error-modal");
const REQUEST_MODAL = document.getElementById("request-modal");
const RETURN_MODAL = document.getElementById("return-modal");
const REGISTER_MODAL = document.getElementById("add-user-modal");

const USER_NAME_FIELD = document.getElementById("add-user-name");
const USER_EMAIL_FIELD = document.getElementById("add-user-email");
const USER_PHONE_FIELD = document.getElementById("add-user-phone");

const USER_SELECT = new TomSelect("#select-user", {
    create: registerUserInline, //TODO would be neat if it were true and clicking it opened the create user modal
    valueField: "id",
    labelField: "name",
    searchField: "searchField",
    sortField: {
        field: "name",
        direction: "asc"
    },
    dropdownParent: "body",
});

let token;
let adminName;
// if we're registering a user inline it contains the TomSelect callback
let inInlineRegistration;

function writeHeader(token) {
    return {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
    }
}

function openModal($el) {
    $el.classList.add('is-active');
    document.querySelector('html').classList.add('is-clipped');
}

function closeModal($el) {
    $el.classList.remove('is-active');
}

function showError(str) {
    console.error(str);
    document.querySelector("#error-modal-text").innerHTML = str;
    openModal(ERROR_MODAL);
}

document.querySelectorAll('.close-modal').forEach(($el) => {
    const $target = $el.closest('.modal');

    $el.addEventListener('click', () => {
        closeModal($target);
        if ($target.id != "error-modal") {
            document.querySelector('html').classList.remove('is-clipped');
        }
    });
});

async function tokenVerification(tempToken) {
    for (const table of [games, users, logs]) {
        let res = await fetch(`https://api.baserow.io/api/database/rows/table/${table}/`, {
            method: "GET",
            headers: {
                Authorization: `Token ${tempToken}`
            }
        });
        if (res.status != 200) {
            let data = await res.json();
            throw new Error('Token inválido ou sem permissões<br>' + data.error + '–' + data.detail);
        }
    }
}

document.querySelector('#login-button').addEventListener('click', async () => {
    document.querySelector('#login-button').classList.add('is-loading');
    let tempToken = document.querySelector('#token-input').value;
    // idealy one would check if the token provided has the required permissions:
    //     - create, read and update permissions on users and games tables
    //     - create permissions on logs table
    // however, we can only test the read permission without changing the database
    // thus we only test the read permissions and pray to god that the user was
    // intelligent enough to not fuck it up. If they were not, then an error message
    // will show up whenever they get their permission denied. 
    // Status code is 401 wheter the token is invalid or does not have permissions,
    // but the error message after the json lets ou figure out which

    try {
        await tokenVerification(tempToken);
        adminName = document.querySelector('#user-name').value;
        if (adminName.length == 0) throw new Error("Insere o teu nome.");
        // verification successfull
        // keep token in local storage and close modal
        localStorage.setItem('token', tempToken);
        token = tempToken;
        localStorage.setItem('userName', adminName);
        closeModal(document.querySelector("#login-modal"));
        window.location.reload();
    } catch (error) {
        showError(error);
    }
    document.querySelector('#login-button').classList.remove('is-loading');
});

document.querySelector('#logout-button').addEventListener('click', async () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    window.location.reload();
});

const tbodyGame = document.querySelector('#game-table tbody');

function addRowGame(item, { id, title, bggId, status, currentReserver, noOfReservations, shelfCode }) {
    if (status.value == "Unavailable") {
        return null;
    }

    const availabilityTag = {
        'Unavailable': '<span class="tag is-danger is-medium">Não Disponível</span>',
        'Requested': '<span class="tag is-warning is-medium">Requisitado</span>',
        'Available': '<span class="tag is-success is-medium">Disponível</span>',
    };
    const row = tbodyGame.insertRow();

    item.cR = item.currentReserver.length == 1 ? item.currentReserver[0].value : undefined;

    // TODO: VERY temporary
    const game = Game.fromRaw(item);
    row.insertCell().innerHTML = `<a target="_blank" href="https://boardgamegeek.com/boardgame/${bggId}/">${bggId}</a>`;
    row.insertCell().innerHTML = `<img class="image is-64x64" src="${game.thmb()}" loading="lazy"></img>`
    row.insertCell().textContent = title
    // row.insertCell().innerHTML = `<span class="icon"><img src="${game.img()}"></img></span><span>${title}</span>`;
    row.insertCell().textContent = shelfCode;
    row.insertCell().innerHTML = availabilityTag[status.value];
    row.insertCell().textContent = currentReserver.length == 1 ? currentReserver[0].value : ""; //TODO when you click it should open the user profile
    row.insertCell().textContent = noOfReservations;

    let actionCell = row.insertCell();
    if (status.value != 'Unavailable') {
        const btn = document.createElement('button');
        btn.className = 'button is-outlined ' + (status.value == 'Available' ? 'is-warning' : 'is-success');
        btn.textContent = status.value == 'Available' ? 'Requisição' : 'Devolução';

        if (status.value == 'Available') {
            btn.addEventListener('click', () => {
                requestGame(id);
            });
        } else {
            btn.addEventListener('click', () => {
                returnGame(id);
            });
        }
        actionCell.appendChild(btn);
    }

    actionCell = row.insertCell();
    btn = document.createElement('button');
    btn.className = 'button';
    btn.textContent = 'Log';
    actionCell.appendChild(btn);
    btn.addEventListener('click', () => {
        openLogGame(id);
    });
    return row;
}

const tbodyUser = document.querySelector('#user-table tbody');

function addRowUser(item, { id, name, email, phoneNumber, currentReservation, noOfReservations }) {
    const row = tbodyUser.insertRow();
    row.insertCell().textContent = name;
    row.insertCell().textContent = email;
    row.insertCell().textContent = phoneNumber;
    row.insertCell().textContent = currentReservation.length == 0 ? "" : currentReservation[0].value; //TODO yada yada
    row.insertCell().textContent = noOfReservations;

    let actionCell = row.insertCell();
    btn = document.createElement('button');
    btn.className = 'button';
    btn.textContent = 'Log';
    actionCell.appendChild(btn);
    btn.addEventListener('click', () => {
        openLogUser(id);
    });
    return row;
}

function requestGame(rowId) {
    const game = gameList.find(item => item.id == rowId);
    document.querySelector('#request-modal img').src = game.image;
    document.querySelector('#request-modal .game-title').textContent = game.title;
    if (game.shelfCode == null) {
        document.querySelector('#request-modal .game-shelf').classList.add('is-hidden');
    } else {
        document.querySelector('#request-modal .game-shelf').classList.remove('is-hidden');
        document.querySelector('#request-modal .game-shelf').textContent = 'Prateleira ' + game.shelfCode;
    }
    document.querySelector('#request-modal .button').dataset.gameId = game.id;
    openModal(REQUEST_MODAL);
}

function returnGame(rowId) {
    const game = gameList.find(item => item.id == rowId);
    document.querySelector('#return-modal img').src = game.image;
    document.querySelector('#return-modal .game-title').textContent = game.title;
    if (game.shelfCode == null) {
        document.querySelector('#return-modal .game-shelf').classList.add('is-hidden');
    } else {
        document.querySelector('#return-modal .game-shelf').textContent = 'Prateleira ' + game.shelfCode;
    }
    document.querySelector('#return-modal .current-requester').textContent = 'Na posse de: ' + game.currentReserver[0].value; // TODO should be a tag which opens a modal
    document.querySelector('#return-modal .button').dataset.gameId = game.id;
    openModal(RETURN_MODAL);
}

function openLogGame(rowId) {
    console.log('Game Log ', rowId);
    // do whatever you need here
}

function openLogUser(rowId) {
    console.log('User Log ', rowId);
    // do whatever you need here
}

async function load_db_page(page, table, orderBy) {
    const response = await fetch(`https://api.baserow.io/api/database/rows/table/${table}/?page=${page}${orderBy ? `&order_by=${orderBy}` : ""}&user_field_names=true&size=${ENTRIES_PER_PAGE}`, {
        headers: { Authorization: `Token ${token}` }
    });
    return await response.json();
}

async function load(table, addRowCallback, list, orderBy, tableName, fuseOptions, applySearchFilter) {
    let page = 1;
    let pages_left = true;
    while (pages_left) {
        db = await load_db_page(page, table, orderBy);
        if (db.next === null) pages_left = false;

        db.results.forEach(item => {
            item.row = addRowCallback(item, item);
            if (item.row !== null) list.push(item)
        });
        searchEngines[tableName] = new Fuse(list, fuseOptions);
        applySearchFilter();
        page++;
    }
}

const gameList = [];
const userList = [];

const searchEngines = {
    'games': null,
    'users': null,
}

const fuseOptionsGames = {
    keys: ["title", "cR"],
    threshold: 0.2,
    isCaseInsensitive: true,
    ignoreDiacritics: true,
}

const fuseOptionsUsers = {
    keys: ['name', 'email', 'phoneNumber'],
    threshold: 0.2,
    isCaseInsensitive: true,
    ignoreDiacritics: true,
}

const gamesSearch = document.getElementById("games-search-bar");
const usersSearch = document.getElementById("users-search-bar");

function applySearchFilter(searchBar, list, tableName) {
    return function () {
        const query = searchBar.value.trim();
        let show;
        if (!query) {
            show = new Set(list.map(item => item.id));
        } else {
            show = new Set(searchEngines[tableName].search(query).map(entry => entry.item.id));
        }
        list.forEach(item => {
            if (show.has(item.id)) {
                item.row.classList.remove('is-hidden');
            } else {
                item.row.classList.add('is-hidden');
            }
        });
    }
}

const applySearchFilterGames = applySearchFilter(gamesSearch, gameList, 'games');
const applySearchFilterUsers = applySearchFilter(usersSearch, userList, 'users');

gamesSearch.addEventListener('input', e => {
    applySearchFilterGames();
});

usersSearch.addEventListener('input', e => {
    applySearchFilterUsers();
});

async function loadGames() {
    load(games, addRowGame, gameList, '-status,title', 'games', fuseOptionsGames, applySearchFilterGames);
}

function prepareUserSearch(user) {
    user.searchField = user.name + ' ' + user.email + ' ' + user.phoneNumber
}

async function loadUsers() {
    USER_SELECT.disable();

    await load(users, addRowUser, userList, "name", "users", fuseOptionsUsers, applySearchFilterUsers);
    document.querySelector(".select").classList.remove("is-loading");

    userList.forEach(prepareUserSearch);
    USER_SELECT.addOptions(userList);
    USER_SELECT.enable();
}

async function checkError(res) { //throws a JS error if the request was unsuccessful
    if (res.status != 200) {
        let data = await res.json();
        throw new Error(data.error + '–' + data.detail);
    }
}

async function handleRegisterGameRequest(userId, gameId) {
    // add to logs table
    let res = await fetch(`https://api.baserow.io/api/database/rows/table/${logs}/?user_field_names=true`, {
        method: "POST",
        headers: writeHeader(token),
        body: JSON.stringify({
            "game": [Number(gameId)],
            "user": [Number(userId)],
            "type": 'request',
            "registeredBy": adminName,
        }),
    });
    await checkError(res);
    // update games table
    res = await fetch(`https://api.baserow.io/api/database/rows/table/${games}/${gameId}/?user_field_names=true`, {
        method: "PATCH",
        headers: writeHeader(token),
        body: JSON.stringify({
            "currentReserver": [Number(userId)],
            "reservers": gameList.find(game => game.id == gameId).reservers.map(reserver => Number(reserver.id)).concat([Number(userId)]),
            "status": "Requested",
        }),
    });
    document.getElementById('select-request').value = "";
    await checkError(res);
}

document.querySelector('#return-button').addEventListener('click', async (e) => {
    try {
        e.currentTarget.classList.add('is-loading');
        await handleRegisterGameReturn(e.currentTarget.dataset.gameId);
        gamesSearch.value = "";
        window.location.reload();
    } catch (error) {
        showError('Algo correu mal, mostra esta mensagem ao Simão<br>' + error);
    }
});

async function handleRegisterGameReturn(gameId) {
    const game = gameList.find(game => game.id == gameId);
    // add to logs table
    let res = await fetch(`https://api.baserow.io/api/database/rows/table/${logs}/?user_field_names=true`, {
        method: "POST",
        headers: writeHeader(token),
        body: JSON.stringify({
            "game": [Number(gameId)],
            "user": [Number(game.currentReserver[0].id)],
            "type": 'return',
            "registeredBy": adminName,
        }),
    });
    await checkError(res);
    // update games table
    res = await fetch(`https://api.baserow.io/api/database/rows/table/${games}/${gameId}/?user_field_names=true`, {
        method: "PATCH",
        headers: writeHeader(token),
        body: JSON.stringify({
            "currentReserver": [],
            "status": "Available",
        }),
    });
    await checkError(res);
}

// SWITCH TABS
document.querySelector("#tab-users").addEventListener('click', () => {
    document.querySelector("#games").classList.add('is-hidden');
    document.querySelector("#tab-games").classList.remove('is-active');
    document.querySelector("#users").classList.remove('is-hidden');
    document.querySelector("#tab-users").classList.add('is-active');
});

document.querySelector("#tab-games").addEventListener('click', () => {
    document.querySelector("#users").classList.add('is-hidden');
    document.querySelector("#tab-users").classList.remove('is-active');
    document.querySelector("#games").classList.remove('is-hidden');
    document.querySelector("#tab-games").classList.add('is-active');
});

// USERS

document.querySelector("#add-user").addEventListener("click", () => {
    openModal(document.querySelector("#add-user-modal"));
});

document.querySelectorAll("#add-user-modal input").forEach(el => el.addEventListener("input", () => {
    REGISTER_BTN.disabled = USER_NAME_FIELD.value == '' || USER_PHONE_FIELD.value == '';
}));

async function registerUser(name, phone, email = "") {
    // add to logs table
    const res = await fetch(`https://api.baserow.io/api/database/rows/table/${users}/?user_field_names=true`, {
        method: "POST",
        headers: writeHeader(token),
        body: JSON.stringify({
            "name": name,
            "email": email,
            "phoneNumber": phone,
            "registeredBy": adminName,
        }),
    });

    REGISTER_MODAL.querySelectorAll("input").forEach(e => e.value = "");
    usersSearch.value = "";
    await checkError(res);

    const data = await res.json();
    const user = { id: data.id, name: name, currentReservation: [] };

    prepareUserSearch(user);
    userList.push(user);
    USER_SELECT.addOption(user);
    USER_SELECT.refreshOptions();
    USER_SELECT.addItem(user);

    return user;
}

document.querySelector('#register-add-user').addEventListener('click', async () => {
    const user = await registerUser(USER_NAME_FIELD.value, USER_PHONE_FIELD.value, USER_EMAIL_FIELD.value);
    closeModal(REGISTER_MODAL);
    if (inInlineRegistration !== undefined) {
        inInlineRegistration({ value: user.id, text: user.name });
        USER_SELECT.setValue(user.id);
        setTimeout(() => {
            USER_SELECT.blur();
            REQUEST_BTN.disabled = false
        }, 20);
        inInlineRegistration = undefined;
    } else {
        window.location.reload();
    }
});

async function registerUserInline(input, callback) {
    inInlineRegistration = callback; // jAnK
    USER_NAME_FIELD.value = input;
    USER_SELECT.close(false);
    openModal(REGISTER_MODAL);
}

function initRequestListeners() {
    USER_SELECT.on("item_add", userId => {
        const user = userList.find(user => user.id == userId)
        console.log(1)
        if (user.currentReservation.length != 0) { // if hasn't returned previuosly requested game.
            showError(`O utilizador ${user.name} ainda não devolveu o jogo ${user.currentReservation[0].value}.`)
            USER_SELECT.clear();
        } else {
            REQUEST_BTN.disabled = false;
        }
    });

    USER_SELECT.on("item_remove", () => {
        REQUEST_BTN.disabled = true;
    });

    REQUEST_BTN.addEventListener("click", async () => {
        try {
            REQUEST_BTN.classList.add("is-loading");
            await handleRegisterGameRequest(userList[userList.length - 1].id, REQUEST_BTN.dataset.gameId);
            gamesSearch.value = "";
            window.location.reload();
        } catch (error) {
            showError("Algo correu mal, mostra esta mensagem ao Tomás/Simão<br>" + error);
        }
    });
}

function initListeners() {
    initRequestListeners();
}

// MAIN
token = localStorage.getItem('token');
adminName = localStorage.getItem('userName');
if (token == null) {
    openModal(document.querySelector("#login-modal"))
} else {
    document.querySelector('#user-name-display').textContent = `Olá ${adminName}? ඞ`;
    loadGames();
    loadUsers();
}

window.onkeydown = ev => {
    if (ev.key === "Escape")
        document.querySelectorAll(".modal").forEach(el => closeModal(el));
};

initListeners();
