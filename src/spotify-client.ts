import { exec } from 'child_process';

const SPOTIFY_DO_COMMANDS = {
    play: uri => `tell application "Spotify" to play track "${uri}"`,
    pause: () => 'tell application "Spotify" to playpause',
    volume: val => `tell application \"Spotify\" to set sound volume to ${val}`,
    next: () => 'tell application "Spotify" to next track',
}

const SPOTIFY_GET_COMMANDS = {
    state: 'tell application "Spotify" to player state as string',
    artist: 'tell application "Spotify" to artist of current track as string',
    album: 'tell application "Spotify" to album of current track as string',
    track: 'tell application "Spotify" to name of current track as string',
    position: 'tell application "Spotify" to player position as string',
    length: 'tell application "Spotify" to (duration of current track / 1000) as string',
    volume: 'tell application "Spotify" to sound volume as integer',
}

const VOLUME_INCREMENT = 10;

export type SpotifyState = 'playing' | 'stopped' | 'paused';

export class SpotifyClient {

    static play(uri: string) {
        const result = this.runCommand(SPOTIFY_DO_COMMANDS.play(uri));
        return true;
    }

    static async pause() {
        const state = await SpotifyClient.getState();
        if (state === 'playing') {
            await this.runCommand(SPOTIFY_DO_COMMANDS.pause());
            return true;
        }
        return false;
    }

    static async resume() {
        const state = await SpotifyClient.getState();

        if (state !== 'playing') {
            await this.runCommand(SPOTIFY_DO_COMMANDS.pause());
            return true;
        }
        return false;
    }

    static async next() {
        await this.runCommand(SPOTIFY_DO_COMMANDS.next());
        return true;
    }

    static async getVol(): Promise<number> {
        return parseInt(await this.runCommand(SPOTIFY_GET_COMMANDS.volume));
    }

    static async volUp() {
        const vol = await SpotifyClient.getVol();
        if (vol >= 100) {
            return false;
        }

        await SpotifyClient.setVol(Math.min(100, vol + VOLUME_INCREMENT));
        return true;
    }

    static async volDown() {
        const vol = await SpotifyClient.getVol();
        if (vol <= 0) {
            return false;
        }

        await SpotifyClient.setVol(Math.max(0, vol - VOLUME_INCREMENT));
        return true;
    }

    static async setVol(val: number) {
        if(isNaN(val) || val < 0 || val > 100) {
            return false;
        }
        await this.runCommand(SPOTIFY_DO_COMMANDS.volume(val));
        return true;
    }

    static getState(): Promise<SpotifyState> {
        return <any>SpotifyClient.runCommand(SPOTIFY_GET_COMMANDS.state);
    }

    static getArtist() {
        return SpotifyClient.runCommand(SPOTIFY_GET_COMMANDS.artist);
    }

    static getAlbum() {
        return SpotifyClient.runCommand(SPOTIFY_GET_COMMANDS.album);
    }

    static getTrack() {
        return SpotifyClient.runCommand(SPOTIFY_GET_COMMANDS.track);
    }

    static getCurrentTrackPosition() {
        return SpotifyClient.runCommand(SPOTIFY_GET_COMMANDS.position);
    }

    static getCurrentTrackLength() {
        return SpotifyClient.runCommand(SPOTIFY_GET_COMMANDS.length);
    }

    private static runCommand(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            exec(`osascript -e '${command}'`, (err, out, stderr) => {
                if (err || stderr) {
                    resolve();
                }
                resolve(out.toString().trim());
            });
        });
    }
}