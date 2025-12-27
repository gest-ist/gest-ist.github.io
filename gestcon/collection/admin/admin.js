const games = '760059';
const users = '760060';
const logs = '783823';

let token;

function openModal($el) {
    $el.classList.add('is-active');
}

function closeModal($el) {
    $el.classList.remove('is-active');
}

function showError(str) {
    document.querySelector("#error-modal-text").innerHTML = str;
    openModal(document.querySelector("#error-modal"))
}

document.querySelectorAll('.close-modal').forEach(($el) => {
    const $target = $el.closest('.modal');

    $el.addEventListener('click', () => {
        closeModal($target);
    });
});

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
        for(const table of [games, users]){
            let res = await fetch(`https://api.baserow.io/api/database/rows/table/${table}/`, {
                method: "GET",
                headers: {
                    Authorization: `Token ${tempToken}`
                }}
            );
            if(res.status != 200) {
                let data = await res.json();
                console.log(data);
                throw new Error(data.error + '–' + data.detail);
            }
        }
        // verification successfull
        // keep token in local storage and close modal
        localStorage.setItem('token', tempToken);
        token = tempToken;
        closeModal(document.querySelector("#login-modal"));
    } catch(error) {
        showError('Token inválido ou sem permissões<br>' + error);
    }
    document.querySelector('#login-button').classList.remove('is-loading');
});

document.querySelector('#logout-button').addEventListener('click', async () => {
    localStorage.removeItem("token");
    window.location.reload();
});

// MAIN
token = localStorage.getItem('token');
if(token == null) {
    openModal(document.querySelector("#login-modal"))
}
