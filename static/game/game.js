import { randomRange, wait } from './utils/utilFunc.js'
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


var canvasEl
var cardLeftEl
var cardLeftNumEl

var playerDisplayEl
var playerDisplayNameEl
var playerDisplayStreakEl
var playerDisplayStreakNumEl

var playerStartScreenEl
var playerEndScreenEl

var playerNameInputEl
var playerReadyInputEl
var playerListEl
var playerScoreEl


function setPosTextEl() {
    let canvasOffset = [
        (window.innerWidth-canvasEl.width)/2,
        (window.innerHeight-canvasEl.height)/2
    ]

    cardLeftEl.style.left = `${canvasOffset[0]+cardLeftOffset[0]}px`
    cardLeftEl.style.top = `${canvasOffset[1]+cardLeftOffset[1]}px`
    
    playerDisplayEl.style.left = `${canvasOffset[0]+playerDisplayOffset[0]}px`
    playerDisplayEl.style.top = `${canvasOffset[1]+playerDisplayOffset[1]}px`
}

async function discardCard(toMyPile=false) {
    let topCard = await canvas.discardAnimate(
        deck.pop(), pile, (toMyPile ? pilePos : otherPilePos), toMyPile, 
        discardAnimDuration, otherPileDiscardOpacity
    )

    if(toMyPile)
        pile = topCard
    cardLeftNumEl.innerHTML = deck.length
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

//sceneManager.js
//scenes

function resetScene() {}

export async function onSymbolGlobalCorrect(player, symbolId) {
    if(playerLastDisplay == player.id) {
        playerStreak++
        playerDisplayStreakEl.classList.remove('hide')
    } else {
        playerStreak = 1
        playerDisplayStreakEl.classList.add('hide')
    }
    console.log(player)
    playerDisplayEl.classList.remove('fade-from-down')
    playerLastDisplay = player.id
    playerDisplayNameEl.innerHTML = player.name
    playerDisplayStreakNumEl.innerHTML = playerStreak.toString()
    
    setTimeout(function() {
        playerDisplayEl.classList.add('fade-from-down')
    }, 150)

    deckBlocked = false
    discardCard((player.id == curPlayerId))
}

export function onPlayerListChange(players) {
    delete players[curPlayerId]
    playerListEl.innerHTML = ''

    if(Object.keys(players).length == 0) {
        let node = document.createElement('LI')
        node.innerHTML = 'Nikto nie je pripojený :('
        playerListEl.appendChild(node)
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
        
        playerListEl.appendChild(node)
    }
}

export async function onRoundStart(seed) {
    await wait(roundStartWait)

    playerStreak = 0
    playerLastDisplay = undefined

    playerStartScreenEl.classList.add('hide')
    playerNameInputEl.onkeyup = () => {}
    playerReadyInputEl.onchange = () => {}
    
    deck = canvas.initDeck(
        cardTemplate,
        randomizeCards(seed, generateCards(symbolsNum, symbolsOffsets)), 
        deckPos, 
        deckOffRange,
        deckOffFreq
    )
    
    cardLeftNumEl.innerHTML = 0
    cardLeftEl.classList.remove('hide')

    let deckAnimateGenerator = canvas.deckAnimate(deck, deckAnimDuration)
    while(true) {
        let endAnimate = deckAnimateGenerator.next().value
        if(endAnimate) break

        cardLeftNumEl.innerHTML++
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
    
    cardLeftEl.classList.add('hide')
    playerDisplayEl.classList.add('hide')
    playerDisplayEl.classList.remove('fade-from-down')

    await wait(100)
}

export function onStartScreen() {
    playerEndScreenEl.classList.add('hide')
    playerStartScreenEl.classList.remove('hide')
    playerReadyInputEl.checked = false
    
    let sendNameTimeout
    playerNameInputEl.onkeyup = () => {
        clearTimeout(sendNameTimeout)
        sendNameTimeout = setTimeout(() => {
            socketManager.sendName(playerNameInputEl.value)
        }, playerSendNameTimeout)
    }

    playerReadyInputEl.onchange = () => {
        socketManager.sendReady(playerReadyInputEl.checked)
    }

    socketManager.sendReady(true)
}

export async function onEndScreen(players) {
    playerScoreEl.innerHTML = ''
    playerEndScreenEl.classList.remove('hide')

    for(const [name, score] of players) {
        let node = document.createElement('TR')
        node.innerHTML = `<td>${name}</td><td>${score}</td>`
        playerScoreEl.appendChild(node)
    }

    await wait(endScreenWait)
    document.onclick = (event) => {
        if(playerEndScreenEl.contains(event.target)) return

        onStartScreen()
        document.onclick = () => {}
    }
}

function initElements() {
    canvasEl = document.getElementsByClassName('game-canvas')[0]

    cardLeftNumEl = document.getElementsByClassName('card-left-num')[0]
    cardLeftEl = document.getElementsByClassName('card-left')[0]

    playerDisplayEl = document.getElementsByClassName('player-display')[0]
    playerDisplayNameEl = document.getElementsByClassName('player-display-name')[0]
    playerDisplayStreakEl = document.getElementsByClassName('player-display-streak')[0]
    playerDisplayStreakNumEl = document.getElementsByClassName('player-display-streak-num')[0]
    setPosTextEl()
    window.addEventListener('resize', setPosTextEl)

    playerStartScreenEl = document.getElementsByClassName('player-start-screen')[0]
    playerEndScreenEl = document.getElementsByClassName('player-end-screen')[0]

    playerNameInputEl = document.getElementsByClassName('player-name-input')[0]
    playerReadyInputEl = document.getElementsByClassName('player-ready-input')[0]
    playerListEl = document.getElementsByClassName('player-list')[0]
    playerScoreEl = document.getElementsByClassName('player-score')[0]
}

// document.addEventListener('mousemove', event => {
//     floatingTextEl.style.transform = `translate(
//         ${Math.min(event.clientX + 30, window.innerWidth - 250)}px,
//         ${Math.min(event.clientY + 10, window.innerHeight - 60)}px
//     )`
// })


// -----> ss 

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
    initElements()

    canvas.passAssets(await loadAssets())
    canvas.initCanvas()
    canvas.onMouseDown(onSymbolSelected)

    socketManager.initConnection()
}

document.addEventListener('DOMContentLoaded', onPageLoaded)