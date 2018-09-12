import { JukeBox } from './juke-box';

const CHAT_COMMANDS = new Set(['find', 'play', 'pause', 'skip', 'status', 'help', 'vol']);
const CHAT_COMMAND_ALIASES = { search: 'find', volume: 'vol' };

export class ChatHandler {

    constructor(
        private readonly jukebox: JukeBox,
    ) { }

    async handle(input: string): Promise<string> {
        const matcher = input.match(/^(\S+)(\s.*)?/);

        let command = matcher && matcher.length > 1 ? matcher[1].toLowerCase() : '';
        const text = matcher && matcher.length > 2 ? matcher[2] : '';

        if (CHAT_COMMAND_ALIASES.hasOwnProperty(command)) {
            command = CHAT_COMMAND_ALIASES[command];
        }

        if (!CHAT_COMMANDS.has(command)) {
            return `\`${command}\`?!?! Never heard of 'em.`;
        }

        const handler = this[command + 'Handler'];
        if (!handler) {
            return `I know about \`${command}\`, but I have no clue what to do with it. (try status or help)`;
        }

        return handler.bind(this)(text);
    }

    private helpHandler(): Promise<string> {
        return Promise.resolve(
            'JUKEy Commands \n' +
            '/jukey find [search term] - /jukey find who let the dogs out \n' +
            '/jukey play [song id] - adds a song to the queue \n' +
            '/jukey play [song id] next - adds a song to the queue to be played next \n' +
            '/jukey play [song id] now - starts playing your song immediately \n' +
            '/jukey pause - pauses the music \n' +
            '/jukey play - unpauses the music \n' +
            '/jukey skip - skips to the next song \n' +
            '/jukey vol up - volume up \n' +
            '/jukey vol down - volume down \n' +
            '/jukey status - get player status \n'
        );
    }

    private async statusHandler(): Promise<string> {
        const status = await this.jukebox.getStatus();
        let upcoming = status.playlist.slice(0, 10).map(t => `• ${t.name} by ${t.artists}`).join('\n');
        if (status.playlist.length > 10) {
            upcoming += `\n• _...and ${status.playlist.length - 10} more_`;
        }

        function formatTime(time: number): string {
            const seconds = time % 60;
            const minutes = Math.floor(time / 60);
            return ('0' + minutes).slice(-2) + ':' + ('0' + seconds).slice(-2);
        }

        return Promise.resolve(
            '*JUKEy status report* \n' +
            '----------------------------- \n' +
            `*Currently playing:* ${status.trackName} by ${status.artistName} \n` +
            `*Position:* ${formatTime(status.position)} / ${formatTime(status.length)} \n` +
            '*Up next:* \n' +
            `${upcoming} \n`
        );
    }

    private async findHandler(input: string): Promise<string> {
        const searchResults = await this.jukebox.search(input);
        return `\n` +
            `*${input} (Tracks):* \n` +
            searchResults.tracks.map(track => `• ${track.id} – *${track.name}* by *${track.artists}*`).join('\n') + '\n\n' +
            `*${input} (Albums):* \n` +
            searchResults.albums.map(album => `• ${album.id} – *${album.name}* by *${album.artists}*`).join('\n') + '\n';
    }

    private async playHandler(input?: string): Promise<string> {
        if (!input || input.length < 1) {
            return this.jukebox.resume() ? 'Let there be sound!' : `Correct me if I'm wrong, but I think it's already playing`;
        }

        const [id, when = ''] = input.trim().split(' ');

        if (when === 'now') {
            if (await this.jukebox.play(id)) {
                return 'Coming right up!';
            }
        } else if (when === 'next') {
            if (-1 !== await this.jukebox.queue(id, true)) {
                return `It'll be up next!`;
            }
        } else {
            const pos = await this.jukebox.queue(id);
            if (pos !== -1) {
                const s = pos === 1 ? '' : 's';
                return `Added to queue. There are ${pos} song${s} ahead of you`;
            }
        }

        return `Sorry, I couldn't seem to do that...`;
    }

    private async pauseHandler(): Promise<string> {
        return this.jukebox.pause() ? 'Music paused' : `I can't do that. Are you sure it's playing?`;
    }

    private async skipHandler(): Promise<string> {
        return await this.jukebox.next() ? 'On to bigger and better things!' : `Sorry, I can't do that`;
    }

    private async volHandler(input: string = ''): Promise<string> {
        const currentVol = await this.jukebox.getVol();
        input = input.trim();
        if (input === '') {
            return `Current volume ${currentVol}%. Use vol up / vol down / vol [number] to change`;
        } else if (input === 'up') {
            if (await this.jukebox.volUp()) {
                return 'Pumping it up!';
            } else {
                return 'It is already on 11. Maybe get bigger speakers?'
            }
        } else if (input === 'down') {
            if (await this.jukebox.volDown()) {
                return 'Taking it down a notch...';
            } else {
                return 'Looks like this is as quiet as it goes.';
            }
        } else {
            const val = parseInt(input);

            if (isNaN(val) || val < 0 || val > 100) {
                return 'I can on handle `vol up` or `vol down` or `vol [number]` (0-100).';
            } else {
                await this.jukebox.setVol(val);
                return `Aye Aye! Changing volume from ${currentVol}% to ${val}%`;
            }
        }


    }
}