const games = '760059';
const users = '760060';
const logs = '783823';

const ENTRIES_PER_PAGE = 100;

let token;
let userName;

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
    openModal(document.querySelector("#error-modal"))
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
        userName = document.querySelector('#user-name').value;
        if (userName.length == 0) throw new Error("Insere o teu nome.");
        // verification successfull
        // keep token in local storage and close modal
        localStorage.setItem('token', tempToken);
        token = tempToken;
        localStorage.setItem('userName', userName);
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

function addRowGame({ id, title, bggId, status, currentReserver, noOfReservations, shelfCode }) {


    const availabilityTag = {
        'Unavailable': '<span class="tag is-danger is-medium">Não Disponível</span>',
        'Requested': '<span class="tag is-warning is-medium">Requisitado</span>',
        'Available': '<span class="tag is-success is-medium">Disponível</span>',
    };
    const row = tbodyGame.insertRow();

    row.insertCell().innerHTML = `<a target="_blank" href="https://boardgamegeek.com/boardgame/${bggId}/">${bggId}</a>`;
    row.insertCell().textContent = title;
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

function addRowUser({ id, name, email, phoneNumber, currentReservation, noOfReservations }) {
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
    openModal(document.querySelector("#request-modal"));
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
    openModal(document.querySelector("#return-modal"));
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
            if (item.status.value == "Unavailable") return; // TODO: temp
            item.row = addRowCallback(item);
            item.cR = item.currentReserver.length == 1 ? item.currentReserver[0].value : undefined;
            list.push(item)
        });
        list.push(...db.results);
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

async function loadUsers() {
    const select = new TomSelect("#select-user", {
        create: false, //TODO would be neat if it were true and clicking it opened the create user modal
        valueField: 'id',
        labelField: 'name',
        searchField: 'searchField',
        sortField: {
            field: "name",
            direction: "asc"
        },
        dropdownParent: 'body',
    });

    select.disable();

    await load(users, addRowUser, userList, 'name', 'users', fuseOptionsUsers, applySearchFilterUsers);
    document.querySelector('.select').classList.remove('is-loading');

    userList.forEach(user => user.searchField = user.name + ' ' + user.email + ' ' + user.phoneNumber);
    select.addOptions(userList);
    select.enable();

    const btn = document.querySelector('#request-button')
    select.on('item_add', (userId) => {
        const user = userList.find(user => user.id == userId)
        if (user.currentReservation.length != 0) { // if hasn't returned previuosly requested game.
            showError(`O utilizador ${user.name} ainda não devolveu o jogo ${user.currentReservation[0].value}.`)
            select.clear();
        } else {
            btn.disabled = false;
            btn.addEventListener('click', async () => {
                try {
                    btn.classList.add('is-loading');
                    await handleRegisterGameRequest(userId, btn.dataset.gameId);
                    window.location.reload();
                } catch (error) {
                    showError('Algo correu mal, mostra esta mensagem ao Simão<br>' + error);
                }
            });
        }
    });
    select.on('item_remove', () => {
        btn.disabled = true;
    });
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
            "registeredBy": userName,
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
            "registeredBy": userName,
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

//SWITCH TABS
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

//USERS

document.querySelector('#add-user').addEventListener('click', () => {
    openModal(document.querySelector('#add-user-modal'));
});

document.querySelectorAll('#add-user-modal input').forEach(el => el.addEventListener('input', () => {
    if (document.querySelector('#add-user-name').value == '' || document.querySelector('#add-user-phone').value == '') {
        document.querySelector('#register-add-user').disabled = true;
    } else {
        document.querySelector('#register-add-user').disabled = false;
    }
}));

document.querySelector('#register-add-user').addEventListener('click', async () => {
    // add to logs table
    let res = await fetch(`https://api.baserow.io/api/database/rows/table/${users}/?user_field_names=true`, {
        method: "POST",
        headers: writeHeader(token),
        body: JSON.stringify({
            "name": document.querySelector('#add-user-name').value,
            "email": document.querySelector('#add-user-email').value,
            "phoneNumber": document.querySelector('#add-user-phone').value,
            "registeredBy": userName,
        }),
    });
    document.querySelectorAll('#add-user-modal input').forEach(e => e.value = "");
    await checkError(res);
    window.location.reload();
});

// MAIN
token = localStorage.getItem('token');
userName = localStorage.getItem('userName');
if (token == null) {
    openModal(document.querySelector("#login-modal"))
} else {
    document.querySelector('#user-name-display').textContent = `Olá ${userName}! 👋`;
    loadGames();
    loadUsers();
}
