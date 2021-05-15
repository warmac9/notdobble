
export function randomRange(from, to) {
    let rangeLenght = to - from
    return Math.round(Math.random() * rangeLenght + from)
}


export async function wait(millsec) {
    await new Promise(function(Resolve, Reject) {
        setTimeout(function() {
            Resolve()
        }, millsec)
    })
}


export function viewTemplate(canvas, pos, symbolsId, cardTemplate) {
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