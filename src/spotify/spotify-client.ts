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
    remaining: 'tell application "Spotify" to ((duration of current track / 1000) - (player position)) as string',
}

const VOLUME_INCREMENT = 10;

// kill apple script commands after this delay
const PROCESS_TERMINATION_DELAY = 500;

export type SpotifyState = 'playing' | 'stopped' | 'paused';

/**
 * Controls spotify player via AppleScript
 */
export class SpotifyClient {

    static async play(uri: string): Promise<boolean> {
        await this.runCommand(SPOTIFY_DO_COMMANDS.play(uri));
        return true;
    }

    static async pause(): Promise<boolean> {
        const state = await SpotifyClient.getState();
        if (state === 'playing') {
            await this.runCommand(SPOTIFY_DO_COMMANDS.pause());
            return true;
        }
        return false;
    }

    static async resume(): Promise<boolean> {
        const state = await SpotifyClient.getState();

        if (state !== 'playing') {
            await this.runCommand(SPOTIFY_DO_COMMANDS.pause());
            return true;
        }
        return false;
    }

    static async next(): Promise<boolean> {
        await this.runCommand(SPOTIFY_DO_COMMANDS.next());
        return true;
    }

    static async getVol(): Promise<number> {
        const vol = parseInt(await this.runCommand(SPOTIFY_GET_COMMANDS.volume), 10);
        // round to 10s - Spotify is off by 1 even when explicitly set for odd 10s (10, 30, 50, 70...)
        return Math.ceil(vol / VOLUME_INCREMENT) * VOLUME_INCREMENT;
    }

    static async volUp(): Promise<number> {
        const vol = await SpotifyClient.getVol();
        if (vol >= 100) {
            return -1;
        }
        return SpotifyClient.setVol(Math.min(100, vol + VOLUME_INCREMENT));
    }

    static async volDown(): Promise<number> {
        const vol = await SpotifyClient.getVol();
        if (vol <= 0) {
            return -1;
        }

        return SpotifyClient.setVol(Math.max(0, vol - VOLUME_INCREMENT));
    }

    static async setVol(val: number): Promise<number> {
        if (isNaN(val) || val < 0 || val > 100) {
            return -1;
        }
        val = Math.ceil(val / VOLUME_INCREMENT) * VOLUME_INCREMENT
        await this.runCommand(SPOTIFY_DO_COMMANDS.volume(val));
        return val;
    }

    static getState(): Promise<SpotifyState> {
        return <any>SpotifyClient.runCommand(SPOTIFY_GET_COMMANDS.state);
    }

    static getArtist(): Promise<string> {
        return SpotifyClient.runCommand(SPOTIFY_GET_COMMANDS.artist);
    }

    static getAlbum(): Promise<string> {
        return SpotifyClient.runCommand(SPOTIFY_GET_COMMANDS.album);
    }

    static getTrack(): Promise<string> {
        return SpotifyClient.runCommand(SPOTIFY_GET_COMMANDS.track);
    }

    static async getCurrentTrackPosition(): Promise<number> {
        return parseFloat('0' + await SpotifyClient.runCommand(SPOTIFY_GET_COMMANDS.position));
    }

    static async getCurrentTrackLength(): Promise<number> {
        return parseFloat('0' + await SpotifyClient.runCommand(SPOTIFY_GET_COMMANDS.length));
    }

    static async getCurrentTrackTimeRemaining(): Promise<number> {
        return parseFloat('0' + await SpotifyClient.runCommand(SPOTIFY_GET_COMMANDS.remaining));
    }

    private static runCommand(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            let p = exec(`osascript -e '${command}'`, (err, out, stderr) => {
                if (err || stderr) {
                    resolve();
                }
                resolve(out.toString().trim());
            });
            setTimeout(() => {
                p.kill();
                p = undefined;
            }, PROCESS_TERMINATION_DELAY);
        });
    }
}