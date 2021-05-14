import * as game from './game.js'

var socket
export var curPlayerId

export function sendReady(ready) {
    socket.emit('set-player', { ready: ready })
}

export function sendName(name) {
    if(name == '') {
        socket.emit('set-player', { name: 'foo' })
        return
    }
    socket.emit('set-player', { name: name })
}

export function sendCorrectSymbol(symbolId, deckLength) {
    socket.emit('symbol-selected', symbolId, deckLength)
}


function onConnection() {
    curPlayerId = socket.id

    socket.on('round-start', (seed) => {
        game.onRoundStart(seed)
    })

    socket.on('symbol-correct', (player, symbolId) => {
        game.onSymbolGlobalCorrect(player)
    })

    socket.on('player-list', (players) => {
        game.onPlayerListChange(players)
    })

    socket.on('round-end', async (scorePlayers) => {
        await game.onRoundEnd()
        game.onEndScreen(scorePlayers)
    })

    game.onStartScreen()
}

export function initConnection() {
    socket = io()
    socket.on('connect', () => {
        onConnection()
    })
}