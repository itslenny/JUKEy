# Jukey

A simple slack bot jukebox for spotify.

Uses a combination of the slack API and AppleScript to allow users to remote control spotify from the chat room. Currently only works on Mac with Spotify, but it'd be cool to expand in the future.

> Note: this was slapped together in a few hours, but I'm using it daily at my work and will refine it over time.

## Basic Usage Example

![](https://raw.githubusercontent.com/itslenny/JUKEy/master/images/JUKEyDemo.gif)


## Slack Commands

* `/jukey find [search term]` - Search for a song or album
* `/jukey play [song ids]` - adds a song to the queue
* `/jukey play next [song ids]` - adds a song to the queue to be played next
* `/jukey play now [song ids]` - starts playing your song immediately
* `/jukey pause` - pauses the music
* `/jukey play` - unpauses the music
* `/jukey skip` - skips to the next song
* `/jukey vol up` - volume up
* `/jukey vol down` - volume down
* `/jukey status` - get player status
* `/jukey reset` - resets jukey (stops music / clears playlist)

### examples

* /jukey find dmx
* /jukey play 1t1 1t2 1t3 1t4
* /jukey play now 1t5

## Server Setup

* clone repo / cd to root
* `npm i` - install dependencies
* Set up credentials
  * Create an [app in spotify](https://developer.spotify.com/dashboard/applications) an get client id / secret
  * Set environment variables (`CLIENT_ID`/`CLIENT_SECRET`)
  * OR create a `.env` file in the root of the repo with the credentials and they'll be loaded via [foreman](https://github.com/strongloop/node-foreman)
* `npm start` - run the server
* go to [http://localhost:4567/](http://localhost:4567/) to test it out


## Slack setup

* Set up dynamic dns / port forwarding
* Add `/jukey` slash command to slack pointing to the server


## Future hopes and dreams

- Other music services
- Other chat services
- Cross platform support
- Maybe some tests???
