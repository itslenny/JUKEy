import * as https from 'https';
import { stringify } from 'querystring';

const { CLIENT_ID, CLIENT_SECRET } = process.env;

const SPOTIFY_API_HOST = 'api.spotify.com';
const SPOTIFY_API_SEARCH_URI = '/v1/search';
const SPOTIFY_API_ALBUM_TRACKS_URI = id => `/v1/albums/${id}/tracks`;
const SPOTIFY_API_PLAYLIST_TRACKS_URI = id => `/v1/playlists/${id}/tracks`;
const SPOTIFY_TOKEN_HOST = 'accounts.spotify.com';
const SPOTIFY_TOKEN_URI = '/api/token';

export interface SpotifyArtist {
    id: string;
    name: string;
}

export interface SpotifyPlayable {
    href: string;
    uri: string;
    id: string;
    name: string;
    artists?: SpotifyArtist[];
    type: string;
    total_tracks: number;
    tracks?: SpotifyPlayableTracks;
}

interface SpotifyPlayableTracks {
    href: string;
    total: number;
}

export interface SpotifySearchResult {
    tracks: SpotifyPlayable[];
    albums: SpotifyPlayable[];
    playlists: SpotifyPlayable[];
}

interface SpotifyAlbumTracksResponse {
    items: SpotifyPlayable[];
}
interface SpotifyPlaylistTracksResponse {
    items: { track: SpotifyPlayable }[];
}
interface SpotifySearchResponse {
    albums: { items: SpotifyPlayable[] };
    tracks: { items: SpotifyPlayable[] };
    playlists: { items: SpotifyPlayable[] };
}

// private
function request<T>(options: https.RequestOptions, content?: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const req = https.request(options, (res) => {
            if (res.statusCode !== 200) {
                return reject(res.statusCode + ' - ' + res.statusMessage);
            }

            let data = '';

            res.on('data', (newData: Buffer) => {
                data += (newData || new Buffer('')).toString();
            });

            res.on('end', () => {
                resolve(JSON.parse(data));
            });
        });

        if (content !== undefined) {
            req.write(content);
        }
        req.end();
    });
}

// private
async function getAccessToken(): Promise<string> {
    const token = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    const options: https.RequestOptions = {
        hostname: SPOTIFY_TOKEN_HOST,
        path: SPOTIFY_TOKEN_URI,
        method: 'POST',
        headers: {
            'Authorization': `Basic ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };
    type SpotifyAuthResponse = { access_token: string };
    const result = await request<SpotifyAuthResponse>(options, 'grant_type=client_credentials');
    return result.access_token;
}

/**
 * Makes calls to Spotify api 
 */
export class SpotifyApi {

    static async getPlaylistTracks(id: string): Promise<SpotifyPlayable[]> {
        const token = await getAccessToken();

        const options = {
            hostname: SPOTIFY_API_HOST,
            path: SPOTIFY_API_PLAYLIST_TRACKS_URI(id),
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        const result = await request<SpotifyPlaylistTracksResponse>(options, 'grant_type=client_credentials');
        return (result && result.items.map(item => item.track)) || [];
    }

    static async getAlbumTracks(id: string): Promise<SpotifyPlayable[]> {
        const token = await getAccessToken();

        const options = {
            hostname: SPOTIFY_API_HOST,
            path: SPOTIFY_API_ALBUM_TRACKS_URI(id),
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        const result = await request<SpotifyAlbumTracksResponse>(options, 'grant_type=client_credentials');
        return (result && result.items) || [];
    }

    static async search(term: string): Promise<SpotifySearchResult> {
        const token = await getAccessToken();
        const query = stringify({
            q: term,
            type: 'track,album,playlist',
            limit: 10,
            offset: 0,
        });

        const options = {
            hostname: SPOTIFY_API_HOST,
            path: SPOTIFY_API_SEARCH_URI + '?' + query,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };
        const result = await request<SpotifySearchResponse>(options);
        
        return {
            albums: (result && result.albums && result.albums.items) || [],
            tracks: (result && result.tracks && result.tracks.items) || [],
            playlists: (result && result.playlists && result.playlists.items) || [],
        }
    }
}