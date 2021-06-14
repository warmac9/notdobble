const port = process.env.PORT ?? 80

const e = require('express');
var express = require('express')
var app = express()
var http = require('http').Server(app)
const { Server } = require("socket.io");
const io = new Server(http);

app.use(express.static('static'))

app.get('/', function (req, res) {
    res.sendFile(__dirname+'index.html')
})



class Room {
  constructor() {
    this.players = {}
    this.deckLastCount = undefined
  }
}


class Player {
  constructor(id, name='foo') {
    this.id = id
    this.name = name
    this.ready = false
    this.inGame = false
    this.score = 0
  }
}


rooms = {
  'main': new Room()
}

function getRoom(socket) {
  foo = new Set(socket.rooms)
  foo.delete(socket.id)
  return foo.values().next().value
}


function playersReady(roomId) {
  for({ready} of Object.values(rooms[roomId].players)) {
    if(!ready) return false
  }
  return true
}


function playersChanged(roomId) {
  io.to(roomId).emit('player-list', rooms[roomId].players)
  
  if(Object.keys(rooms[roomId].players).length >= 2 && playersReady(roomId)) {
    roundStart(roomId)
  }
}


function roundStart(roomId) {
  for(key of Object.keys(rooms[roomId].players)) {
    rooms[roomId].players[key].ready = false
    rooms[roomId].players[key].inGame = true
  }
  rooms[roomId].deckLastCount = undefined

  io.to(roomId).emit('player-list', rooms[roomId].players)
  io.to(roomId).emit('round-start', Date.now())
}


function roundEnd(roomId) {
  let scoreList = []
  for(key of Object.keys(rooms[roomId].players)) {
    if(rooms[roomId].players[key].inGame) {
      const { name, score } = rooms[roomId].players[key]
      scoreList.push([name, score])
    }
  }
  scoreList.sort((a, b) => b[1] - a[1])
  
  for(key of Object.keys(rooms[roomId].players)) {
    rooms[roomId].players[key].score = 0
    rooms[roomId].players[key].inGame = false
  }

  io.to(roomId).emit('player-list', rooms[roomId].players)
  io.to(roomId).emit('round-end', scoreList)
}


function onSymbolSelected(roomId, playerId, symbolId, deckCount) {
  let deckLastCount = rooms[roomId].deckLastCount

  if(deckCount >= deckLastCount && deckLastCount != undefined) return
    deckLastCount = deckCount
    
    rooms[roomId].players[playerId].score++
    io.to(roomId).emit('symbol-correct', rooms[roomId].players[playerId], symbolId)

    if(deckCount == 0) {
      roundEnd(roomId)
    }
}


function onSetPlayer(roomId, playerId, options) {
  for([key, value] of Object.entries(options)) {
    if(key == 'name')
      rooms[roomId].players[playerId][key] = value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
    else
      rooms[roomId].players[playerId][key] = value
  }
  
  playersChanged(roomId)
}


function joinRoom(socket, roomId, playerId, playerName) {
  socket.join(roomId)

  if(!rooms.hasOwnProperty(roomId)) {
    rooms[roomId] = new Room()
  }

  rooms[roomId].players[playerId] = new Player(playerId, playerName)
  playersChanged(roomId)
}


function leaveRoom(socket, roomId, playerId) {
  socket.leave(roomId)
  delete rooms[roomId].players[playerId]

  if(Object.keys(rooms[roomId].players).length === 0) {
    delete rooms[roomId]
  }
  else {
    playersChanged(roomId)
  }
}


io.on('connection', (socket) => {
  joinRoom(socket, 'main', socket.id)
  console.log(rooms)

  socket.on('set-room', (roomId) => {
    let oldRoomId = getRoom(socket)
    let playerName = rooms[oldRoomId].players[socket.id].name

    leaveRoom(socket, oldRoomId, socket.id)
    joinRoom(socket, (roomId == '' ? 'main' : roomId), socket.id, playerName)

    console.log(rooms)
  })

  socket.on('set-player', (options) => {
    onSetPlayer(getRoom(socket), socket.id, options)
  })

  socket.on('symbol-selected', (symbolId, deckCount) => {
    onSymbolSelected(getRoom(socket), socket.id, symbolId, deckCount)
  })

  socket.on("disconnecting", () => {
    leaveRoom(socket, getRoom(socket), socket.id)
  })
})

http.listen(port)