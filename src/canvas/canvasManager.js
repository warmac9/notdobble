import { randomRange, wait } from '../utils/utilFunc.js'
export { randomRange, wait } from '../utils/utilFunc.js'
export * from './animations/canvasAnimations.js'

export var canvas
var assets


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
        const symbolId = symbolsId[index]

        let rotation
        if(rotations == undefined)
            rotation = rot + randomRange(0, 4) * 90
        else
            rotation = rotations[index]

        let symbolInstance = initImage(assets.symbols[symbolId], {
            left: pos[0] + offset[0],
            top: pos[1] + offset[1],
            rotate: rotation,
            resize: [...size],
            symbolId: symbolId,
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
        cardTemplate: cardTemplate,
        symbolImages: images.slice(1),
        symbols: symbolsId
    }
}


export function initDeck(cardTemplate, cardSymbols, deckPos, deckOffRange, deckOffFreq) {
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


export function moveTopCardFront(topCard) {
    let oldTopCard = topCard
    let rotations = []

    oldTopCard.symbolImages.forEach(image => {
        rotations.push(image.angle)
    })
    
    topCard = initCard(
        [oldTopCard.group.left, oldTopCard.group.top],
        oldTopCard.symbols,
        oldTopCard.cardTemplate,
        [],
        rotations
    )

    oldTopCard.images.forEach(image => {
        canvas.remove(image)
    })

    return topCard
}


export function onMouseDown(func) {
    canvas.on('mouse:down', func)
}


export function passAssets(assetsData) {
    assets = assetsData
}


export function initCanvas() {
    canvas = new fabric.Canvas('canvas', {
        interactive: false,
        selection: false
    })
    
    fabric.Object.prototype.selectable = false
    fabric.Object.prototype.hoverCursor = 'default'
}