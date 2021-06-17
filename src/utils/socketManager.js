import * as game from '../game.js'

var socket
export var curPlayerId


export function sendReady(ready) {
    socket.emit('set-player', { ready: ready })
}

export function sendName(name) {
    socket.emit('set-player', { name: name == '' ? 'foo' : name })
}

export function sendRoom(room) {
    socket.emit('set-room', '' ? 'main' : room)
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

    socket.on('round-end', (scorePlayers) => {
        game.onRoundEnd(scorePlayers)
    })

    game.onStartScreen()
}


export function initConnection() {
    socket = io()
    socket.on('connect', () => {
        onConnection()
    })
}