import { JukeBox } from './juke-box';
import { formatTime } from './util/format-time';
import { doesNotReject } from 'assert';

const CHAT_COMMANDS = new Set(['find', 'play', 'pause', 'skip', 'status', 'help', 'vol', 'reset']);
const CHAT_COMMAND_ALIASES = { search: 'find', volume: 'vol', next: 'skip' };

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
            return `\`${command}\`?!?! Never heard of 'em. (try \`/jukey help\`)`;
        }

        const handler = this[command + 'Handler'];
        if (!handler) {
            return `I know about \`${command}\`, but I have no clue what to do with it.`;
        }

        return handler.bind(this)(text);
    }

    private async resetHandler(): Promise<string> {
        return await this.jukebox.reset() ? 'All done! Fresh and so clean clean!' : `Hmm... Couldn't get it done. Sorry.`;
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
            '/jukey status - get player status \n' +
            '/jukey reset - resets jukey (stops music / clears playlist) \n'
        );
    }

    private async statusHandler(): Promise<string> {
        const status = await this.jukebox.getStatus();
        let upcoming = status.playlist.slice(0, 10).map(t => `• ${t.name} by ${t.artists}`).join('\n');
        if (status.playlist.length > 10) {
            upcoming += `\n• _...and ${status.playlist.length - 10} more_`;
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

        const trackCount = (searchResults.tracks && searchResults.tracks.length) || 0;
        const albumCount = (searchResults.albums && searchResults.albums.length) || 0;
        const playlistCount = (searchResults.playlists && searchResults.playlists.length) || 0;

        const trackResult = trackCount > 0 ?
            `*Tracks (${trackCount}):* \n` + searchResults.tracks.map(track => `• ${track.id} – *${track.name}* by *${track.artists}*`).join('\n') :
            `No tracks found.`;

        const albumResult = albumCount > 0 ?
            `*Albums (${albumCount}):* \n` + searchResults.albums.map(album => `• ${album.id} – *${album.name}* by *${album.artists}* (${album.tracks} tracks)`).join('\n') :
            `No albums found.`;

        const playlistResult = playlistCount > 0 ?
            `*Playlists (${playlistCount}):* \n` + searchResults.playlists.map(playlist => `• ${playlist.id} – *${playlist.name}* by *${playlist.artists}* (${playlist.tracks} tracks)`).join('\n') :
            `No playlists found.`;

        return `JUKEy Search Results \`${input}\`: \n\n ${trackResult}\n\n${albumResult}\n\n${playlistResult}`;


    }

    private async playHandler(input?: string): Promise<string> {
        if (!input || input.length < 1) {
            return this.jukebox.resume() ? 'Let there be sound!' : `Correct me if I'm wrong, but I think it's already playing`;
        }

        const fields = input.trim().split(' ');
        const ids = [];
        const commands = new Set();
        fields.forEach(field => {
            const trimField = field.trim();
            if (trimField.match(/^\d+\S\d+$/)) {
                ids.push(trimField);
            } else {
                commands.add(trimField);
            }
        });

        let result = `Sorry, I couldn't seem to do that. Are you sure all the ids you entered are valid?`;

        if (commands.has('next') || commands.has('now')) {

            if (-1 !== await this.jukebox.queue(ids, true, commands.has('now'))) {
                return `It'll be up next!`;
            }
        } else {
            const pos = await this.jukebox.queue(ids);
            if (pos !== -1) {
                const s = pos === 1 ? '' : 's';
                return `Added to queue. There are ${pos} song${s} ahead of you`;
            }
        }

        return result;
    }

    private async pauseHandler(): Promise<string> {
        return this.jukebox.pause() ? 'Music paused' : `I can't do that. Are you sure it's playing?`;
    }

    private async skipHandler(): Promise<string> {
        return await this.jukebox.skip() ? 'On to bigger and better things!' : `Sorry, I can't do that`;
    }

    private async volHandler(input: string = ''): Promise<string> {
        const currentVol = await this.jukebox.getVol();
        input = input.trim();
        if (input === '') {
            return `Current volume ${currentVol}%. Use vol up / vol down / vol [number] to change`;
        } else if (input === 'up') {
            const volUpResult = await this.jukebox.volUp();
            if (volUpResult !== -1) {
                return `Pumping it up! (${volUpResult}%)`;
            } else {
                return 'It is already on 11. Maybe get bigger speakers?'
            }
        } else if (input === 'down') {
            const volDownResult = await this.jukebox.volDown();
            if (volDownResult !== -1) {
                return `Taking it down a notch...  (${volDownResult}%)`;
            } else {
                return 'Looks like this is as quiet as it goes.';
            }
        } else {
            const val = parseInt(input);

            if (isNaN(val) || val < 0 || val > 100) {
                return 'I can on handle `vol up` or `vol down` or `vol [number]` (0-100).';
            } else {
                const volResult = await this.jukebox.setVol(val);
                return `Aye Aye! Changing volume from ${currentVol}% to ${volResult}%`;
            }
        }


    }
}