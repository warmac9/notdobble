import { canvas, moveTopCardFront } from '../canvasManager.js'
import { randomRange, wait } from '../canvasManager.js'


export class animHandle {
    constructor() {
        this.abort = false
    }
    stop() {
        this.abort = true
    }
}


export async function animate(animated, animHandle=null) {
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


export function* deckAnimate(deck) {
    let deckImages = []
    for(const {images} of deck) {
        deckImages.splice(0, 0, images)
    }

    while(true) {
        let cardImages = deckImages.pop()
        
        if (cardImages == undefined)
            return true
        
        for(let image of cardImages) {
            image.set({ opacity: 1})
        }
        
        canvas.renderAll()
        yield false
    }
}


export async function discardAnimate(topCard, pileCard, endPos, toMyPile, animDuration, otherPileDiscardOpacity) {
    if(topCard == undefined) return

    let animateArgs = []
    topCard = moveTopCardFront(topCard)

    animateArgs.push({
        obj: topCard.group,
        attr: 'left',
        endValue: endPos[0],
        duration: animDuration
    })
    animateArgs.push({
        obj: topCard.group,
        attr: 'top',
        endValue: endPos[1],
        duration: animDuration
    })

    if(!toMyPile)
        topCard.group.set({ opacity: otherPileDiscardOpacity })

    await animate(animateArgs)

    if(pileCard != undefined)
        pileCard.images.forEach(image => {
            canvas.remove(image)
        })

    return topCard
}


export function symbolsFadeAnimate(symbolImages, opacity, fadeDuration) {
    let animateArgs = []

    symbolImages.forEach(image => {
        animateArgs.push({
            obj: image,
            attr: 'opacity',
            endValue: opacity,
            duration: fadeDuration
        })
    })
    animate(animateArgs)
}