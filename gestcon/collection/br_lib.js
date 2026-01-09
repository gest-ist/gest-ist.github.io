/**
 * Availability status of games.
 */
class Status {
    static ANY = -1;
    static OK = 0;
    static TAKEN = 1;
    static MISSING = 2;

    static parse(rawStatus) {
        switch (rawStatus) {
            case undefined: return undefined;
            case "Available": return Status.OK;
            case "Requested": return Status.TAKEN;
            case "Unavailable": return Status.MISSING;
        }
    }
}

/**
 * A board game as stored in Baserow.
 */
class Game {
    img() {
        return `${Game.IMG_BASE_URL}/${this.id}.avif`;
    }

    bgg() {
        return `${Game.BGG_BASE_URL}/${this.id}/`
    }

    /**
     * Build a Game from the raw data obtained through Baserow.
     * Pass a mapper to handle the weird field look-up table required by views.
     */
    static fromRaw(raw, mapper = Game.DEFAULT_MAPPER) {
        const f = n => mapper(raw, n);
        return Object.assign(new Game(), {
            id: f("bggId"),
            title: f("title"),
            playersMin: f("playersMin"),
            playersMax: f("playersMax"),
            timeMin: f("timeMin"),
            timeMax: f("timeMax"),
            rating: f("avgScore"),
            weight: f("weight"),
            year: f("publishingYear"),
            status: Status.parse(f("status")?.value),
        });
    }

    static DEFAULT_MAPPER = (r, n) => r[n];

    static BGG_BASE_URL = "https://boardgamegeek.com/boardgame";

    /** The base URL to use for game images. */
    static IMG_BASE_URL = "https://gestcon-img.b-cdn.net/img";  // behind a caching CDN
    // static IMG_BASE_URL = "https://bgimg.tomasduarte.eu/img";  // directly from my server
}

class ViewAPI {
    constructor(slug) {
        this.slug = slug;
        this.fieldMap = {}
        this.fieldMapper = undefined
    }

    #infoUrl() {
        return new URL(`${ViewAPI.BASE_VIEW_URL}/${this.slug}/public/info/`);
    }
    #rowsUrl() {
        return new URL(`${ViewAPI.BASE_VIEW_URL}/grid/${this.slug}/public/rows/`);
    }

    /**
     * Loads and stores the weird field mapping from Baserow, in this.fieldMap.
     */
    async loadFieldMap() {
        const response = await fetch(this.#infoUrl());
        const data = await response.json();
        data.fields.forEach(f => this.fieldMap[f.name] = f.id);
        this.fieldMapper = (r, f) => r[`field_${this.fieldMap[f]}`];
    }

    /**
     * Loads the single page given.
     */
    async loadPage(page = 1) {
        const url = new URL(this.#rowsUrl());
        const sp = url.searchParams;
        sp.set("page", page);
        sp.set("size", ViewAPI.PAGE_SIZE);
        const response = await fetch(url);
        return await response.json();
    }

    /**
     * Load all games from this view.
     * You can pass a pre-load callback to load skeletons or whatever.
     */
    async loadAll(games, mapper = Game.DEFAULT_MAPPER, preLoad = () => { }) {
        let page = 1;
        while (true) {
            preLoad();

            const db = await this.loadPage(page);
            db.results.forEach(raw => {
                const game = Game.fromRaw(raw, mapper);
                if (game.status != Status.MISSING) games.push(game);
            });

            if (db.next === null) break;
            page++;
        }
    }

    static BASE_VIEW_URL = "https://api.baserow.io/api/database/views";

    // 4 items per row, 100 rows (enough for our current <340 games)
    // divides nicely into 2 for mobile viewports
    static PAGE_SIZE = 4 * 100;
}
