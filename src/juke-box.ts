import { SpotifyClient } from './spotify/spotify-client';
import { SpotifyApi, SpotifyPlayable } from './spotify/spotify-api';

export interface JukeBoxSearchResult {
    tracks: JukeBoxPlayable[];
    albums: JukeBoxPlayable[];
    playlists: JukeBoxPlayable[];
}

export interface JukeBoxPlayable {
    id: string;
    name: string;
    artists: string;
    serviceUri: string;
    serviceHref: string;
    serviceId: string;
    type: string;
    tracks: number;
}

export interface JukeBoxStatus {
    trackName: string;
    artistName: string;
    playing: JukeBoxPlayable;
    position: number;
    length: number;
    playlist: JukeBoxPlayable[];
    state: string;
    vol: number;
}

const PLAYER_POLLING_INTERVAL = 500;

const SONG_END_OFFSET = 10;

export class JukeBox {

    private searchCount = 0;
    private searchCache: { [key: string]: JukeBoxPlayable } = {};
    private playlist: JukeBoxPlayable[] = [];
    private playing: JukeBoxPlayable;

    private nextTrackTimeout: NodeJS.Timer;
    private checkPlayerPositionInterval: NodeJS.Timer;

    constructor() {

    }

    destroy() {
        this.stopCheckPlayerPositionInterval();
    }

    async search(term: string): Promise<JukeBoxSearchResult> {
        this.searchCount++;
        const searchResult = await SpotifyApi.search(term);
        return {
            tracks: this.createPlayable(searchResult.tracks),
            albums: this.createPlayable(searchResult.albums),
            playlists: this.createPlayable(searchResult.playlists),
        }
    }

    async play(id: string): Promise<boolean> {
        this.clearNextTrackTimeout();
        this.stopCheckPlayerPositionInterval();

        const playable = this.searchCache[id];

        if (!playable) {
            return false;
        }

        if (playable.type === 'album') {
            return await this.queue([id], true, true) > -1;
        }

        const result = await SpotifyClient.play(playable.serviceUri);

        if (result) {
            this.playing = playable;
            this.startCheckPlayerPositionInterval();
        }

        return result;
    }

    pause(): Promise<boolean> {
        return SpotifyClient.pause();
    }

    resume(): Promise<boolean> {
        return SpotifyClient.resume();
    }

    async reset(): Promise<boolean> {
        await this.pause();
        this.playing = undefined;
        this.playlist = [];
        return true;
    }

    async queue(ids: string[], next?: boolean, now?: boolean): Promise<number> {
        const playables: JukeBoxPlayable[] = ids.map(id => this.searchCache[id]);

        if (!playables.reduce((state, p) => state && !!p, true)) {
            return -1;
        }

        let addPlayables: JukeBoxPlayable[] = [];

        for (let i = 0; i < playables.length; i++) {
            const playable = playables[i];
            if (playable.type === 'album') {
                const albumTrackPrefix = 'album' + Date.now();
                addPlayables = [...addPlayables, ...this.createPlayable(await SpotifyApi.getAlbumTracks(playable.serviceId), albumTrackPrefix)];
            } else if (playable.type === 'playlist') {
                const albumTrackPrefix = 'playlist' + Date.now();
                addPlayables = [...addPlayables, ...this.createPlayable(await SpotifyApi.getPlaylistTracks(playable.serviceId), albumTrackPrefix)];
            } else {
                addPlayables.push(playable);
            }
        }

        const state = await SpotifyClient.getState();

        if (state === 'playing' && !now) {
            this.startCheckPlayerPositionInterval();
            if (next) {
                return this.playlist.unshift(...addPlayables) - addPlayables.length;
            } else {
                return this.playlist.push(...addPlayables) - addPlayables.length;
            }
        } else {
            const firstTrack = addPlayables[0];
            if (addPlayables.length > 1) {
                addPlayables.shift();
                this.playlist.unshift(...addPlayables);
            }
            return await this.play(firstTrack.id) ? 0 : -1;
        }
    }

    async getStatus(): Promise<JukeBoxStatus> {
        const position = Math.ceil(await SpotifyClient.getCurrentTrackPosition());
        const length = Math.floor(await SpotifyClient.getCurrentTrackLength());
        const trackName = await SpotifyClient.getTrack();
        const artistName = await SpotifyClient.getArtist();
        const state = await SpotifyClient.getState();
        const vol = await SpotifyClient.getVol();

        return Promise.resolve({
            trackName,
            artistName,
            playing: Object.assign({}, this.playing),
            position,
            length,
            state,
            vol,
            playlist: this.playlist.slice(),
        });
    }

    getVol(): Promise<number> {
        return SpotifyClient.getVol();
    }

    volUp(): Promise<number> {
        return SpotifyClient.volUp();
    }

    volDown(): Promise<number> {
        return SpotifyClient.volDown();
    }

    setVol(val: number): Promise<number> {
        return SpotifyClient.setVol(val);
    }

    /**
     * Skips current song
     */
    async skip(): Promise<boolean> {
        // if the playlist is empty hit next on spotify so the UX is a song change
        return (await this.playNextSong()) || (await SpotifyClient.next());
    }

    /**
     * Plays next song in playlist
     */
    private async playNextSong(): Promise<boolean> {
        if (this.playlist.length < 1) {
            return false;
        }

        const track = this.playlist[0];

        const result = await this.play(track.id);

        if (result) {
            this.playlist.shift();
        }
        return result;
    }

    /**
     * Detects end of track and plays next item in playlist
     */
    private async checkPlayerPosition() {
        const remaining = await SpotifyClient.getCurrentTrackTimeRemaining();

        // Fixes bug where a check happens while we're waiting for the above to resolve
        // this causes a double skip if it happens during a "skip" action
        if (!this.checkPlayerPositionInterval) {
            return;
        }

        // don't abide bad data
        if (!remaining || isNaN(remaining)) {
            return;
        }

        // check if track length changes incase we miss the end of song position
        if (remaining < SONG_END_OFFSET && this.nextTrackTimeout === undefined) {
            this.nextTrackTimeout = setTimeout(() => {
                this.nextTrackTimeout = undefined;
                this.playNextSong()
            }, Math.floor(remaining * 1000));
        }
    }

    private clearNextTrackTimeout() {
        if (this.nextTrackTimeout) {
            clearTimeout(this.nextTrackTimeout);
            this.nextTrackTimeout = undefined;
        }
    }


    private stopCheckPlayerPositionInterval() {
        if (this.checkPlayerPositionInterval) {
            clearInterval(this.checkPlayerPositionInterval);
            this.checkPlayerPositionInterval = undefined;
        }
    }

    private startCheckPlayerPositionInterval() {
        if (this.checkPlayerPositionInterval) {
            return;
        }
        this.checkPlayerPositionInterval = setInterval(() => this.checkPlayerPosition(), PLAYER_POLLING_INTERVAL);
    }

    private createPlayable(playables: SpotifyPlayable[], idPrefix: string = ''): JukeBoxPlayable[] {
        return playables.map((playable, i) => {
            const type = playable.type.charAt(0);
            const out: JukeBoxPlayable = {
                id: idPrefix + this.searchCount + type + (i + 1),
                name: playable.name,
                artists: (playable.artists && playable.artists.map(artist => artist.name).join(', ')) || '',
                serviceHref: playable.href,
                serviceUri: playable.uri,
                serviceId: playable.id,
                type: playable.type,
                tracks: playable.tracks && playable.tracks.total || playable.total_tracks || 1,
            };

            this.searchCache[out.id] = out;

            return out;
        });
    }

}
