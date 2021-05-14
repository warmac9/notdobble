

var deck
var deckPos = [420, 50]

var deckBlocked = false
const deckBlockedDuration = 1500
const iconFadeDuration = 200

const deckOffRange = [10, 20]
const deckOffFreq = 5

const deckAnimDuration = 10
const discardAnimDuration = 100

var pile
const cardSize = 320

const pilePos = [20, 260]
const otherPilePos = [0, -cardSize]
const otherPileDiscardOpacity = 0.25

const cardLeftOffset = [
    deckPos[0]+cardSize-30, 
    deckPos[1]+cardSize-30
]

var playerDisplayOffset = [60, 0]
var playerLastDisplay
var playerStreak

const roundStartWait = 700
const roundEndWait = 1000
const endScreenWait = 1000

const playerSendNameTimeout = 500
var socket
var players
var curPlayerId


function randomRange(from, to) {
    let rangeLenght = to - from
    return Math.round(Math.random() * rangeLenght + from)
}

async function wait(millsec) {
    await new Promise(function(Resolve, Reject) {
        setTimeout(function() {
            Resolve()
        }, millsec)
    })
}

function viewTemplate(canvas, pos, symbolsId, cardTemplate) {
    Image(assets.card, {
        left: pos[0],
        top: pos[1],
    })

    for (let index = 0; index < cardTemplate.length; index++) {
        const {offset, size, rot} = cardTemplate[index]
        const symbolId = symbolsId[index]

        var rect = new fabric.Rect({
            left: pos[0] + offset[0],
            top: pos[1] + offset[1],
            width: size[0],
            height: size[1],
            fill: 'red'
        })

        rect.rotate(rot)
        canvas.add(rect)
    }
}


//deckGenerate.js

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
const symbolsNum = 31
const symbolsOffsets = [0, 1, 3, 10, 14, 26]


function generateCards(symbolsNum, symbolsOffsets) {
    let cards = Array(symbolsNum)
    for (let index = 0; index < cards.length; index++) {
        cards[index] = []
    }

    for(let symbolId = 0; symbolId < symbolsNum; symbolId++) {
        symbolsOffsets.forEach(offset => {
            cards[(symbolId+offset)%symbolsNum].push(symbolId)
        })
    }

    return cards
}

function randomizeCards(seed, cardSymbols) {
    let engine = Random.MersenneTwister19937.seed(seed)
    let random = new Random.Random(engine);

    random.shuffle(cardSymbols)
    
    for (let index = 0; index < cardSymbols.length; index++) {
        cardSymbols[index] = random.shuffle(cardSymbols[index])
    }

    return cardSymbols
}



//canvasManager.js
//dependant canvas

var canvas

function initCanvas() {
    canvas = new fabric.Canvas('canvas', {
        interactive: false,
        selection: false
    })
    canvas.on('mouse:down', onCanvasMouseDown)
    
    fabric.Object.prototype.selectable = false
    fabric.Object.prototype.hoverCursor = 'default'
}

function resizeImage(image, newWidth, newHeight) {
    image.scaleX =  newWidth / image.width
    image.scaleY =  newHeight / image.height
}

function initImage(imageElement, options) {
    const { resize, rotate, ...imgOptions } = options
    let imgInstance = new fabric.Image(imageElement, imgOptions)

    if(resize != undefined)
        resizeImage(imgInstance, ...resize)

    if(rotate != undefined)
        imgInstance.rotate(rotate)

    return imgInstance
}

function initCard(pos, symbolsId, cardTemplate, options=[], rotations) {
    let images = []

    let cardInstance = initImage(assets.card, {
        left: pos[0],
        top: pos[1],
        ...options
    })
    images.push(cardInstance)
    canvas.add(cardInstance)

    for (let index = 0; index < cardTemplate.length; index++) {
        const {offset, size, rot} = cardTemplate[index]
        const symbol = symbolsId[index]

        let rotation
        if(rotations == undefined)
            rotation = rot + randomRange(0, 4) * 90
        else
            rotation = rotations[index]

        let symbolInstance = initImage(assets.icons[symbol], {
            left: pos[0] + offset[0],
            top: pos[1] + offset[1],
            rotate: rotation,
            resize: [...size],
            symbolId: symbol,
            cardImage: images[0],
            ...options
        })
        images.push(symbolInstance)
        canvas.add(symbolInstance)
    }

    return {
        group: new fabric.Group(images, { left: pos[0], top: pos[1] }),
        images: images,
        cardImage: images[0],
        iconImages: images.slice(1),
        symbols: symbolsId
    }
}

function initDeck(cardSymbols, deckPos, deckOffRange) {
    let deck = []

    for (let index = 0; index < cardSymbols.length; index++) {
        var cardPos = [...deckPos]

        if(index%deckOffFreq == 0) {
            cardPos[0] += randomRange(...deckOffRange) * (-1 + randomRange(0, 1) * 2)
            cardPos[1] += randomRange(...deckOffRange) * (-1 + randomRange(0, 1) * 2)
        }

        deck.push(
            initCard(cardPos, cardSymbols[index], cardTemplate, { opacity: 0 })
        )
    }

    return deck
}

function moveTopCardFront(topCard) {
    let oldTopCard = topCard
    let rotations = []

    oldTopCard.iconImages.forEach(image => {
        rotations.push(image.angle)
    })
    
    topCard = initCard(
        [oldTopCard.group.left, oldTopCard.group.top],
        oldTopCard.symbols,
        cardTemplate,
        [],
        rotations
    )

    oldTopCard.images.forEach(image => {
        canvas.remove(image)
    })

    return topCard
}

function onCanvasMouseDown(event) {
    let symbolId = event?.target?.symbolId
    if(symbolId == undefined || deck[deck.length - 1].cardImage != event.target.cardImage && pile.cardImage != event.target.cardImage) return
    
    onSymbolSelected(symbolId)
}



//canvasAnimations.js

class animHandle {
    constructor() {
        this.abort = false
    }
    stop() {
        this.abort = true
    }
}

async function animate(animated, animHandle=null) {
    let inProgress = animated.length

    await new Promise((Resolve, Reject) => {
        async function onCompleted() {
            inProgress--
            if(inProgress == 0) {
                await wait(10)
                Resolve()
            }
        }

        for(const {obj, attr, endValue, duration} of animated) {
            obj.animate(attr, endValue, {
                onChange: canvas.renderAll.bind(canvas),
                duration: duration,
                onComplete: onCompleted,
                abort: function() {
                    if(animHandle == null) return false
                    return animHandle.abort
                }
            })
        }
    })
}

async function deckAnimate(deck, deckAnimMillSpeed) {
    let deckImages = []
    for(const {images} of deck) {
        deckImages.splice(0, 0, images)
    }

    while(true) {
        let cardImages = deckImages.pop()
        cardLeftNumEl.innerHTML++

        if (cardImages == undefined)
            return

        for(let image of cardImages) {
            image.set({ opacity: 1})
        }

        canvas.renderAll()
        await wait(10)
    }
}

async function discardAnimate(topCard, cardEndPos) {
    let animateArgs = []

    animateArgs.push({
        obj: topCard.group,
        attr: 'left',
        endValue: cardEndPos[0],
        duration: discardAnimDuration
    })
    animateArgs.push({
        obj: topCard.group,
        attr: 'top',
        endValue: cardEndPos[1],
        duration: discardAnimDuration
    })

    await animate(animateArgs)
}

function cardHideAnimate() {
    let animateArgs = []
    deckBlocked = true

    deck[deck.length - 1].images.slice(1).forEach(image => {
        animateArgs.push({
            obj: image,
            attr: 'opacity',
            endValue: 0,
            duration: iconFadeDuration
        })
    })
    animate(animateArgs)

    setTimeout(function() {
        if(!deckBlocked) return

        deckBlocked = false
        let animateArgs = []

        deck[deck.length - 1].images.slice(1).forEach(image => {
            animateArgs.push({
                obj: image,
                attr: 'opacity',
                endValue: 1,
                duration: iconFadeDuration
            })
        })
        animate(animateArgs)

    }, deckBlockedDuration)
}



//events gameEventManager 
//deck vars dependant

function onSymbolSelected(symbolId) {
    if(deckBlocked) return

    if(pile.symbols.includes(symbolId) && deck[deck.length-1].symbols.includes(symbolId)) {
        sendCorrectSymbol(symbolId)
        return
    }

    cardHideAnimate()
}

async function discardCard(toMyPile=false) {
    let topCard = deck.pop()
    if(topCard == undefined) return
    topCard = moveTopCardFront(topCard)
    
    if(!toMyPile)
        topCard.group.set({ opacity: otherPileDiscardOpacity })
    await discardAnimate(topCard, (toMyPile ? pilePos : otherPilePos))
    
    if(!toMyPile) return
    
    if(pile != undefined)
        pile.images.forEach(image => {
            canvas.remove(image)
        })
    pile = topCard

    cardLeftNumEl.innerHTML = deck.length
}

async function onSymbolGlobalCorrect(playerId, symbolId) {
    if(playerLastDisplay == playerId) {
        playerStreak++
        playerDisplayStreakEl.classList.remove('hide')
    } else {
        playerStreak = 1
        playerDisplayStreakEl.classList.add('hide')
    }

    playerDisplayEl.classList.remove('fade-from-down')
    playerLastDisplay = playerId
    playerDisplayNameEl.innerHTML = players[playerId].name
    playerDisplayStreakNumEl.innerHTML = playerStreak.toString()
    
    setTimeout(function() {
        playerDisplayEl.classList.add('fade-from-down')
    }, 150)

    deckBlocked = false
    discardCard((playerId == curPlayerId))
}



//sceneManager.js
//modifies html

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
var floatingTextEl


function setPlayerList(players) {
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

async function onRoundStart(seed, playersData) {
    await wait(roundStartWait)

    players = playersData
    playerStreak = 0
    playerLastDisplay = undefined

    playerStartScreenEl.classList.add('hide')
    playerNameInputEl.onkeyup = () => {}
    playerReadyInputEl.onchange = () => {}
    floatingTextEl.classList.add('hide')
    
    deck = initDeck(
        randomizeCards(seed, generateCards(symbolsNum, symbolsOffsets)), 
        deckPos, 
        deckOffRange
    )
    
    cardLeftNumEl.innerHTML = 0
    cardLeftEl.classList.remove('hide')
    
    await deckAnimate(deck, deckAnimDuration)
    discardCard(true)
}

async function onRoundEnd() {
    deck.push(pile)
    deck.forEach(card => {
        card.images.forEach(image => {
            canvas.remove(image)
        })
    })
    
    cardLeftEl.classList.add('hide')
    playerDisplayEl.classList.add('hide')
    playerDisplayEl.classList.remove('fade-from-down')

    await wait(100)
}

function onStartScreen() {
    playerEndScreenEl.classList.add('hide')
    playerStartScreenEl.classList.remove('hide')
    playerReadyInputEl.checked = false
    floatingTextEl.classList.remove('hide')
    
    let sendNameTimeout
    playerNameInputEl.onkeyup = () => {
        clearTimeout(sendNameTimeout)
        sendNameTimeout = setTimeout(sendName, playerSendNameTimeout)
    }

    playerReadyInputEl.onchange = () => {
        sendReady(playerReadyInputEl.checked)
    }
}

async function onEndScreen(players) {
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
    floatingTextEl = document.getElementsByClassName('floating-text')[0]
}



//socketManager.js

function sendReady(ready) {
    socket.emit('set-player', { ready: ready })
}

function sendName() {
    if(playerNameInputEl.value == '') {
        socket.emit('set-player', { name: 'foo' })
        return
    }
    socket.emit('set-player', { name: playerNameInputEl.value })
}

function sendCorrectSymbol(symbolId) {
    socket.emit('symbol-selected', symbolId, deck.length)
}

function onConnection() {
    curPlayerId = socket.id

    socket.on('round-start', (seed, players) => {
        onRoundStart(seed, players)
    })

    socket.on('symbol-correct', (playerId, symbolId) => {
        onSymbolGlobalCorrect(playerId)
    })

    socket.on('player-list', (players) => {
        setPlayerList(players)
    })

    socket.on('round-end', async (players) => {
        await wait(roundEndWait)
        await onRoundEnd()
        onEndScreen(players)
    })

    onStartScreen()
}

function initSocketConnection() {
    socket = io()
    socket.on('connect', () => {
        onConnection()
    })
}



//gameLoad.js
var assets = {
    card: null,
    icons: []
}

async function loadAssets() {        
    var res = await axios.get('assets.json')
    var assetsUrl = res.data
    
    var assetsLoaded = 0
    var assetsAll = 1 + assetsUrl.icons.length
    assets.icons = Array(assetsAll)

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

        for (let index = 0; index < assetsUrl.icons.length; index++) {
            const iconUrl = assetsUrl.icons[index]

            fabric.Image.fromURL(iconUrl, function(img) {
                assets.icons[index] = img.getElement()
                eventAssetLoaded()
            })
        }
    })
}

async function onPageLoaded() {
    initElements()
    initCanvas()
    await loadAssets()

    document.addEventListener('mousemove', event => {
        floatingTextEl.style.transform = `translate(
            ${Math.min(event.clientX + 30, window.innerWidth - 250)}px,
            ${Math.min(event.clientY + 10, window.innerHeight - 60)}px
        )`
    })

    initSocketConnection()
}

document.addEventListener('DOMContentLoaded', onPageLoaded)