const port = process.env.PORT ?? 80

var express = require('express')
var app = express()
var http = require('http').Server(app)
const { Server } = require("socket.io");
const io = new Server(http);

app.use(express.static('static'))

app.get('/', function (req, res) {
    res.sendFile(__dirname+'index.html')
})


var players = {}
var deckLastCount

class Player {
  constructor(id) {
    this.id = id
    this.name = 'foo'
    this.ready = false
    this.inGame = false
    this.score = 0
  }
}


function playersReady() {
  for({ready} of Object.values(players)) {
    if(!ready) return false
  }
  return true
}


function playersChanged() {
  io.emit('player-list', players)
  
  if(Object.keys(players).length >= 2 && playersReady()) {
    roundStart()
  }
}


function roundStart() {
  for(key of Object.keys(players)) {
    players[key].ready = false
    players[key].inGame = true
  }
  deckLastCount = undefined

  io.emit('player-list', players)
  io.emit('round-start', Date.now())
}


function roundEnd() {
  let scoreList = []
  for(key of Object.keys(players)) {
    if(players[key].score != 0) {
      const { name, score } = players[key]
      scoreList.push([name, score])
    }
  }
  scoreList.sort((a, b) => b[1] - a[1])
  
  for(key of Object.keys(players)) {
    players[key].score = 0
    players[key].inGame = false
  }

  io.emit('player-list', players)
  io.emit('round-end', scoreList)
}


io.on('connection', (socket) => {
  players[socket.id] = new Player(socket.id)
  playersChanged()


  socket.on('set-player', (options) => {
    for([key, value] of Object.entries(options)) {
      players[socket.id][key] = value
    }
    playersChanged()
  })


  socket.on('symbol-selected', (symbolId, deckCount) => {
    if(deckCount >= deckLastCount && deckLastCount != undefined) return
    deckLastCount = deckCount
    
    players[socket.id].score++
    io.emit('symbol-correct', players[socket.id], symbolId)

    if(deckCount == 28) {
      roundEnd()
    }
  })


  socket.on('disconnect', (reason) => {
    delete players[socket.id]
    playersChanged()
  })
})

http.listen(port)