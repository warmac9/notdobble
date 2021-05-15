import { byClass, wait } from './utils/utilFunc.js'
import { generateCards, randomizeCards } from './utils/deckGenerator.js'

import * as canvas from './canvas/canvasManager.js'

import * as socketManager from './utils/socketManager.js'
import { curPlayerId } from './utils/socketManager.js'



const symbolsNum = 31
const symbolsOffsets = [0, 1, 3, 10, 14, 26]

const deckPos = [420, 50]

const deckBlockedDuration = 1500
const symbolFadeDuration = 200

const deckOffRange = [10, 20]
const deckOffFreq = 5

const deckAnimDuration = 10
const discardAnimDuration = 100

const cardTemplate = [
    {
        offset: [125, 20],
        size: [97, 97],
        rot: 13,
    },
    {
        offset: [215, 110],
        size: [79, 79],
        rot: 40,
    },
    {
        offset: [120, 210],
        size: [91, 91],
        rot: 350,
    },
    {
        offset: [55, 165],
        size: [55, 55],
        rot: 0,
    },
    {
        offset: [37, 70],
        size: [71, 71],
        rot: 337,
    },
    {
        offset: [125, 130],
        size: [70, 70],
        rot: 0,
    },
]
const cardSize = 320

const pilePos = [20, 260]
const otherPilePos = [0, -cardSize]
const otherPileDiscardOpacity = 0.25

const cardLeftOffset = [
    deckPos[0]+cardSize-30, 
    deckPos[1]+cardSize-30
]
const playerDisplayOffset = [60, 0]


const playerSendNameTimeout = 500
const roundStartWait = 700
const roundEndWait = 1000
const endScreenWait = 1000


var playerLastDisplay
var playerStreak

var deck
var deckBlocked = false
var pile


function setPosTextEl() {
    let canvasOffset = [
        (window.innerWidth-byClass('game-canvas').width)/2,
        (window.innerHeight-byClass('game-canvas').height)/2
    ]

    byClass('card-left').style.left = `${canvasOffset[0]+cardLeftOffset[0]}px`
    byClass('card-left').style.top = `${canvasOffset[1]+cardLeftOffset[1]}px`
    
    byClass('player-display').style.left = `${canvasOffset[0]+playerDisplayOffset[0]}px`
    byClass('player-display').style.top = `${canvasOffset[1]+playerDisplayOffset[1]}px`
}

async function discardCard(toMyPile=false) {
    let topCard = await canvas.discardAnimate(
        deck.pop(), pile, (toMyPile ? pilePos : otherPilePos), toMyPile, 
        discardAnimDuration, otherPileDiscardOpacity
    )

    if(toMyPile)
        pile = topCard
    byClass('card-left-num').innerHTML = deck.length
}

function symbolBelongTopCard(event) {
    return deck[deck.length - 1].cardImage == event.target.cardImage || pile.cardImage == event.target.cardImage
}

function onSymbolSelected(event) {
    let symbolId = event?.target?.symbolId
    if(symbolId == undefined ||
        deckBlocked || 
        !symbolBelongTopCard(event)) return

    if(pile.symbols.includes(symbolId) && deck[deck.length-1].symbols.includes(symbolId)) {
        socketManager.sendCorrectSymbol(symbolId, deck.length)
        return
    }

    deckBlocked = true
    canvas.symbolsFadeAnimate(deck[deck.length - 1].symbolImages, 0, symbolFadeDuration)

    setTimeout(function() {
        canvas.symbolsFadeAnimate(deck[deck.length - 1].symbolImages, 1, symbolFadeDuration)
        deckBlocked = false
    }, deckBlockedDuration)
}


function resetScene() {}


export async function onSymbolGlobalCorrect(player, symbolId) {
    if(playerLastDisplay == player.id) {
        playerStreak++
        byClass('player-display-streak').classList.remove('hide')
    } else {
        playerStreak = 1
        byClass('player-display-streak').classList.add('hide')
    }

    byClass('player-display').classList.remove('fade-from-down')
    playerLastDisplay = player.id
    byClass('player-display-name').innerHTML = player.name
    byClass('player-display-streak-num').innerHTML = playerStreak.toString()
    
    setTimeout(function() {
        byClass('player-display').classList.add('fade-from-down')
    }, 150)

    deckBlocked = false
    discardCard((player.id == curPlayerId))
}

export function onPlayerListChange(players) {
    delete players[curPlayerId]
    byClass('player-list').innerHTML = ''

    if(Object.keys(players).length == 0) {
        let node = document.createElement('LI')
        node.innerHTML = 'Nikto nie je pripojený :('
        byClass('player-list').appendChild(node)
        return
    } 

    for(const [playerId, player] of Object.entries(players)) {
        const { name, ready, inGame } = player

        let node = document.createElement('LI')
        node.innerHTML = `<b>${name}</b>` 
        if(ready)
            node.innerHTML += ' je pripravený/á'
        else if(inGame)
            node.innerHTML += ' je práve v hre'
        
        byClass('player-list').appendChild(node)
    }
}

export async function onRoundStart(seed) {
    await wait(roundStartWait)

    playerStreak = 0
    playerLastDisplay = undefined

    byClass('player-start-screen').classList.add('hide')
    byClass('player-name-input').onkeyup = () => {}
    byClass('player-ready-input').onchange = () => {}
    
    deck = canvas.initDeck(
        cardTemplate,
        randomizeCards(seed, generateCards(symbolsNum, symbolsOffsets)), 
        deckPos, 
        deckOffRange,
        deckOffFreq
    )
    
    byClass('card-left-num').innerHTML = 0
    byClass('card-left').classList.remove('hide')

    let deckAnimateGenerator = canvas.deckAnimate(deck, deckAnimDuration)
    while(true) {
        let endAnimate = deckAnimateGenerator.next().value
        if(endAnimate) break

        byClass('card-left-num').innerHTML++
        await wait(deckAnimDuration)
    }

    discardCard(true)
}

export async function onRoundEnd() {
    await wait(roundEndWait)

    deck.push(pile)
    deck.forEach(card => {
        card.images.forEach(image => {
            canvas.canvas.remove(image)
        })
    })
    
    byClass('card-left').classList.add('hide')
    byClass('player-display').classList.add('hide')
    byClass('player-display').classList.remove('fade-from-down')

    await wait(100)
}

export function onStartScreen() {
    byClass('player-end-screen').classList.add('hide')
    byClass('player-start-screen').classList.remove('hide')
    byClass('player-ready-input').checked = false
    
    let sendNameTimeout
    byClass('player-name-input').onkeyup = () => {
        clearTimeout(sendNameTimeout)
        sendNameTimeout = setTimeout(() => {
            socketManager.sendName(byClass('player-name-input').value)
        }, playerSendNameTimeout)
    }

    byClass('player-ready-input').onchange = () => {
        socketManager.sendReady(byClass('player-ready-input').checked)
    }

    socketManager.sendReady(true)
}

export async function onEndScreen(players) {
    byClass('player-score').innerHTML = ''
    byClass('player-end-screen').classList.remove('hide')

    for(const [name, score] of players) {
        let node = document.createElement('TR')
        node.innerHTML = `<td>${name}</td><td>${score}</td>`
        byClass('player-score').appendChild(node)
    }

    await wait(endScreenWait)
    document.onclick = (event) => {
        if(byClass('player-end-screen').contains(event.target)) return

        onStartScreen()
        document.onclick = () => {}
    }
}

// document.addEventListener('mousemove', event => {
//     floatingTextEl.style.transform = `translate(
//         ${Math.min(event.clientX + 30, window.innerWidth - 250)}px,
//         ${Math.min(event.clientY + 10, window.innerHeight - 60)}px
//     )`
// })


//gameLoad.js
var assets = {
    card: null,
    symbols: []
}

async function loadAssets() {        
    let assets = {}
    let res = await axios.get('assets.json')
    let assetsUrl = res.data
    
    let assetsLoaded = 0
    let assetsAll = 1 + assetsUrl.symbols.length
    assets.symbols = Array(assetsAll)

    await new Promise((Resolve, Reject) => {
        function eventAssetLoaded() {
            assetsLoaded++
        
            if(assetsAll == assetsLoaded) {
                Resolve()
            }
        }

        fabric.Image.fromURL(assetsUrl.card, function(img) {
            assets.card = img.getElement()
            eventAssetLoaded()
        })

        for (let index = 0; index < assetsUrl.symbols.length; index++) {
            const iconUrl = assetsUrl.symbols[index]

            fabric.Image.fromURL(iconUrl, function(img) {
                assets.symbols[index] = img.getElement()
                eventAssetLoaded()
            })
        }
    })

    return assets
}

async function onPageLoaded() {
    setPosTextEl()
    canvas.passAssets(await loadAssets())
    canvas.initCanvas()
    canvas.onMouseDown(onSymbolSelected)

    socketManager.initConnection()
}

document.addEventListener('DOMContentLoaded', onPageLoaded)