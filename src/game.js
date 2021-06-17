import { byClass, wait, randomChoice } from './utils/utilFunc'
import { generateCards, randomizeCards } from './utils/deckGenerator'

import * as canvas from './canvas/canvasManager'

import * as socketManager from './utils/socketManager'
import { curPlayerId } from './utils/socketManager'


const symbolsNum = 31
const symbolsOffsets = [0, 1, 3, 10, 14, 26]

const deckPos = [420, 50]
const deckOffRange = [10, 20]
const deckOffFreq = 5

const deckBlockedDuration = 1500
const symbolFadeDuration = 200
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

const playerDisplayOffset = [350, 50]
const playerDisplayWidth = 800


const playerSendNameTimeout = 250
const roundStartWait = 700
const roundEndWait = 1000
const endScreenWait = 500


var assets = {
    card: null,
    symbols: []
}

var currentRoom = ''
var oldPlayersList

var playerLastDisplay
var playerStreak

var deck
var deckBlocked = false
var pile



function setPosGameUi() {
    let canvasOffset = [
        (window.innerWidth-byClass('game-canvas').width)/2,
        (window.innerHeight-byClass('game-canvas').height)/2
    ]

    byClass('card-left').style.left = `${canvasOffset[0]+cardLeftOffset[0]}px`
    byClass('card-left').style.top = `${canvasOffset[1]+cardLeftOffset[1]}px`
    
    byClass('player-display').style.width = `${playerDisplayWidth}px`
    byClass('player-display').style.left = `${canvasOffset[0]+playerDisplayOffset[0]-playerDisplayWidth}px`
    byClass('player-display').style.top = `${canvasOffset[1]+playerDisplayOffset[1]}px`
}

async function endScreen(players) {
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

function startAnimation(el, animClass) {
    let animList = ['explode', 'mini-explode']

    let animate = (el) => {
        animList.forEach(anim => {
            el.classList.remove(anim)
        })
        el.classList.remove(animClass)
        setTimeout(function() {
            el.classList.add(animClass)
        }, 30)
    }
    if(typeof el == 'string')
        Array.from(document.getElementsByClassName(el)).forEach(el => { animate(el) })
    else
        animate(el)
}


async function discardCard(toMyPile=false) {
    let topCard = await canvas.discardAnimate(
        deck.pop(), pile, (toMyPile ? pilePos : otherPilePos), toMyPile, 
        discardAnimDuration, otherPileDiscardOpacity
    )

    if(toMyPile)
        pile = topCard
    byClass('card-left-num').innerHTML = deck.length

    //temp
    if(deck.length == 5) {
        byClass('card-left').classList.add('shake')
    }
}

function symbolBelongTopCard(event) {
    return deck[deck.length - 1].cardImage == event.target.cardImage || pile.cardImage == event.target.cardImage
}

function symbolSelected(event) {
    let symbolId = event?.target?.symbolId
    if(symbolId == undefined ||
        deckBlocked || 
        !symbolBelongTopCard(event)) return

    if(pile.symbols.includes(symbolId) && deck[deck.length-1].symbols.includes(symbolId)) {
        socketManager.sendCorrectSymbol(symbolId, deck.length - 1)
        return
    }

    deckBlocked = true
    canvas.symbolsFadeAnimate(deck[deck.length - 1].symbolImages, 0, symbolFadeDuration)

    setTimeout(function() {
        canvas.symbolsFadeAnimate(deck[deck.length - 1].symbolImages, 1, symbolFadeDuration)
        deckBlocked = false
    }, deckBlockedDuration)
}



// ----->  network events


export function onStartScreen() {
    byClass('player-end-screen').classList.add('hide')
    byClass('player-start-screen').classList.remove('hide')
    byClass('player-ready-input').checked = false
}


export function onPlayerListChange(players) {
    delete players[curPlayerId]
    byClass('player-list').innerHTML = ''

    if(Object.keys(players).length == 0) {
        let node = document.createElement('LI')
        node.innerHTML = 'Nobody is connected :('
        byClass('player-list').appendChild(node)
    } 

    for(const [playerId, player] of Object.entries(players)) {
        const { name, ready, inGame } = player

        let node = document.createElement('LI')
        node.innerHTML = `<b>${name} </b>`
        if(ready)
            node.innerHTML += '\'s ready to play!'
        else if(inGame)
            node.innerHTML += '\'s in the game.'
        
        byClass('player-list').appendChild(node)

    }

    if(oldPlayersList != undefined && (Object.entries(players).length != 0 && Object.keys(players).join() != oldPlayersList))
        startAnimation('player-list-container', 'mini-explode')

    oldPlayersList = Object.keys(players).join()
}


export async function onRoundStart(seed) {
    await wait(roundStartWait)

    playerStreak = 1
    playerLastDisplay = undefined
    
    deck = canvas.initDeck(
        cardTemplate,
        randomizeCards(seed, generateCards(symbolsNum, symbolsOffsets)), 
        deckPos, 
        deckOffRange,
        deckOffFreq
        )
        
    byClass('player-start-screen').classList.add('hide')
    byClass('card-left-num').innerHTML = 0
    byClass('card-left').classList.remove('hide')
    byClass('card-left').classList.remove('shake')

    let deckAnimateGenerator = canvas.deckAnimate(deck, deckAnimDuration)
    while(true) {
        let endAnimate = deckAnimateGenerator.next().value
        if(endAnimate) break

        byClass('card-left-num').innerHTML++
        await wait(deckAnimDuration)
    }

    discardCard(true)
}


export async function onSymbolGlobalCorrect(player, symbolId) {
    //prevent game ui from appearing in menu
    if(deck === undefined) return
    byClass('player-display').classList.remove('hide')
    
    if(playerLastDisplay == player.id) {
        playerStreak++
        byClass('player-display-streak').style.visibility = 'visible'
        startAnimation('player-display-streak', 'explode')

    } else {
        playerStreak = 1
        byClass('player-display-streak').style.visibility = 'hidden'
        startAnimation('player-display', 'fade-from-down')
    }

    byClass('player-display-name').innerHTML = player.name
    byClass('player-display-streak-num').innerHTML = playerStreak.toString()

    playerLastDisplay = player.id
    deckBlocked = false
    discardCard((player.id == curPlayerId))
}


export async function onRoundEnd(scorePlayers) {
    await wait(roundEndWait)

    deck.push(pile)
    deck.forEach(card => {
        card.images.forEach(image => {
            canvas.canvas.remove(image)
        })
    })
    deck = undefined
    
    byClass('card-left').classList.add('hide')
    byClass('player-display').classList.add('hide')
    byClass('player-display').classList.remove('fade-from-down')

    await wait(100)
    endScreen(scorePlayers)
}



// ----->  game load


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
    setPosGameUi()
    window.addEventListener('resize', setPosGameUi)

    canvas.passAssets(await loadAssets())
    canvas.initCanvas()
    canvas.onMouseDown(symbolSelected)

    socketManager.initConnection()
    byClass('player-name-input').value = ''
    byClass('room-set-but').value = ''

    let sendNameTimeout
    byClass('player-name-input').addEventListener('keyup', (event) => {
        clearTimeout(sendNameTimeout)
        sendNameTimeout = setTimeout(() => {
            socketManager.sendName(byClass('player-name-input').value)
        }, playerSendNameTimeout)
    })
    byClass('player-ready-input').addEventListener('change', (event) => {
        socketManager.sendReady(byClass('player-ready-input').checked)
    })

    byClass('room-set-input').addEventListener('keydown', (event) => {
        if(event.keyCode == 32) event.preventDefault()
    })
    byClass('room-set-but').addEventListener('click', (event) => {
        currentRoom = byClass('room-set-input').value
        startAnimation('room-set-but', 'mini-explode')
        socketManager.sendRoom(byClass('room-set-input').value)
        byClass('player-ready-input').checked = false
    })
    document.addEventListener('click', (event) => {
        if(event.target != byClass('room-set-but')) 
            byClass('room-set-input').value = currentRoom
    })

    byClass('intro').addEventListener('click', (event) => {
        byClass('intro').classList.add('fade-up')
        setTimeout(() => {
            byClass('intro').classList.add('hide')
        }, 1000);
    })


    let res = await axios.get('assets.json')
    let symbolsSrc = res.data.symbols.slice(1, 5)

    let setSrcPopup = (prev=[]) => {
        let curSymbols = []

        Array.from(document.getElementsByClassName('popup-symbol')).forEach(el => {
            let randomSrc = randomChoice(symbolsSrc.filter(el => !prev.includes(el) && !curSymbols.includes(el)))
            curSymbols.push(randomSrc)
            el.firstElementChild.src = randomSrc
        })

        return curSymbols
    }

    let autoHidePopup = () => {
        Array.from(document.getElementsByClassName('popup-symbol')).forEach(el => {
            if(window.innerWidth > 1600 && window.innerHeight > 800)
                el.classList.remove('hide')
            else
                el.classList.add('hide')
        })
    }

    window.addEventListener('resize', autoHidePopup)
    autoHidePopup()

    Array.from(document.getElementsByClassName('popup-symbol')).forEach(el => {
        el.addEventListener('mouseenter', () => {
            startAnimation(el, 'explode')
        })
    })

    let prevSymbols = []
    setInterval(() => {
        startAnimation('popup-symbol', 'mini-explode')
        prevSymbols = setSrcPopup(prevSymbols)
    }, 5000);
    setSrcPopup()
}

document.addEventListener('DOMContentLoaded', onPageLoaded)