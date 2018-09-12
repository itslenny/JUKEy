import { resolve } from 'path';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import { JukeBox } from './juke-box';
import { ChatHandler } from './chat-handler';

const PORT = 4567;

const app = express();
const jukebox = new JukeBox();
const chatHandler = new ChatHandler(jukebox);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', async (req, res) => {
    res.sendFile(resolve(__dirname, 'views', 'index.html'));
});

app.get('/status', async (req, res) => {
    const { trackName, artistName, state, vol, position, length } = await jukebox.getStatus();
    res.json({ trackName, artistName, state, vol, position, length });
});

app.post('/', async (req, res) => {
    console.log('received request...');
    if (!req.body || !req.body.text) {
        console.log('bad request');
        return res.status(400).send('bad request');
    }
    console.log('good request:', req.body.text);

    const result = await chatHandler.handle(req.body.text);

    console.log('sent response:', result);

    res.send({ response_type: 'in_channel', text: result });
});

app.listen(PORT, () => {
    console.log(`Listening on ${PORT} yo!!!`);
});