# notdobble
Notdobble is the digital version of the board game Dobble. Its creation was inspired by [.io games](https://iogames.space/), browser-based multiplayer casual games with minimalistic graphics.

![game-footage](https://user-images.githubusercontent.com/19654413/165942140-89e98ae9-4ecf-49be-b166-e96cb8e87ec3.gif)

### [Playable version](https://notadobble.herokuapp.com/)
*Note: It takes some time to load due to the fact it runs on free dyno on Heroku*

## Tech Details

The game is made with Node.js and uses Socket.io for communication between client and server.

The deck and its cards are rendered on canvas by [fabric.js](http://fabricjs.com/).

### Project Structure

> **./app.js** - server side game logic
>
> **./src** - contains modules for client's game logic 
>
> **./static** - static files used by client 
>
> **./static/game.js** - compiled client's game logic

### Server state

> The server **does not** hold **state of cards** contained in deck
>
> Instead server generates seed, which is sent to the client based on which cards are deterministically generated

The game state is contained in single ***rooms*** object:
> **key:** user-created id except for default room *'main'*
> 
> **value:** holds instances of ***Room*** class

```
rooms = {
  'main': ..., //default room
  'customRoomId': ..., //custom room created by user
  ....
}
```

The instance of ***Room*** class consists of:
> **players** property
> - **key:** id generated by Socket.io
> - **value:** holds instances of ***Player*** class
> 
> **deckLastCount** property
> - number of cards in the deck

```
class Room {
  constructor() {
    this.players = {}
    this.deckLastCount = undefined
  }
}
```

*Note: Upon joining the server, the client is connected to the main room by default, however the game also supports the creation of custom rooms.*

The instance of ***Player*** class consists of:
> - **id** - Socket.io generated id
> - **name** - user defined player name
> - **ready** - indicator, whether player is ready (All players in the room must be ready for the game to start)
> - **inGame** - indicator, whether player is currently in the game
> - **score** - score of the player (Each successfully matched symbols counts as 1 point)

```
class Player {
  constructor(id, name='foo') {
    this.id = id
    this.name = name
    this.ready = false
    this.inGame = false
    this.score = 0
  }
}
```

## Install Details

System requirements:
- Install node.js 8+

Download and set up:

```
git clone https://github.com/warmac9/notdobble.git
cd notdobble
npm install
npm run
```
