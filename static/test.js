function resizeImage(image, newWidth, newHeight) {
    image.scaleX =  newWidth / image.width
    image.scaleY =  newHeight / image.height
}

export function initImage(imageElement, options) {
    const { resize, rotate, ...imgOptions } = options
    let imgInstance = new fabric.Image(imageElement, imgOptions)

    if(resize != undefined)
        resizeImage(imgInstance, ...resize)

    if(rotate != undefined)
        imgInstance.rotate(rotate)

    return imgInstance
}