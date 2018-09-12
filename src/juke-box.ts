import { SpotifyClient } from './spotify/spotify-client';
import { SpotifyApi, SpotifyPlayable } from './spotify/spotify-api';

export interface JukeBoxSearchResult {
    tracks: JukeBoxPlayable[];
    albums: JukeBoxPlayable[];
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

export class JukeBox {

    private searchCount = 0;
    private searchCache: { [key: string]: JukeBoxPlayable } = {};
    private playlist: JukeBoxPlayable[] = [];
    private playing: JukeBoxPlayable;

    private previousLength: number;
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
        }
    }

    async play(id: string): Promise<boolean> {
        const playable = this.searchCache[id];

        if (!playable) {
            return false;
        }

        if (playable.type === 'album') {
            return await this.queue(id, true, true) > -1;
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

    async queue(id: string, next?: boolean, now?: boolean): Promise<number> {
        const playable = this.searchCache[id];
        if (!playable) {
            return -1;
        }

        let addPlayables: JukeBoxPlayable[] = [playable];
        if (playable.type === 'album') {
            addPlayables = this.createPlayable(await SpotifyApi.getAlbumTracks(playable.serviceId));
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
        this.stopCheckPlayerPositionInterval();

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
        const position = await SpotifyClient.getCurrentTrackPosition();
        const length = await SpotifyClient.getCurrentTrackLength();

        // Fixes bug where a check happens while we're waiting for the above to resolve
        // this causes a double skip if it happens during a "skip" action
        if (!this.checkPlayerPositionInterval) {
            return;
        }

        if (!position || !length) {
            return;
        }

        const roundedPosition = Math.ceil(position);
        const roundedLength = Math.floor(length);

        // check if track length changes incase we miss the end of song position
        if (roundedPosition >= roundedLength || (this.previousLength && this.previousLength !== roundedLength)) {
            this.playNextSong();
        } else {
            this.previousLength = roundedLength;
        }
    }


    private stopCheckPlayerPositionInterval() {
        if (!this.checkPlayerPositionInterval) {
            return;
        }
        clearInterval(this.checkPlayerPositionInterval);
        this.previousLength = undefined;
        this.checkPlayerPositionInterval = undefined;
    }

    private startCheckPlayerPositionInterval() {
        if (this.checkPlayerPositionInterval) {
            return;
        }
        this.checkPlayerPositionInterval = setInterval(() => this.checkPlayerPosition(), 100);
    }

    private createPlayable(playables: SpotifyPlayable[]): JukeBoxPlayable[] {
        return playables.map((playable, i) => {
            const type = playable.type.charAt(0);
            const out: JukeBoxPlayable = {
                id: this.searchCount + type + (i + 1),
                name: playable.name,
                artists: playable.artists.map(artist => artist.name).join(', '),
                serviceHref: playable.href,
                serviceUri: playable.uri,
                serviceId: playable.id,
                type: playable.type,
                tracks: playable.total_tracks || 1,
            };

            this.searchCache[out.id] = out;

            return out;
        });
    }

}
