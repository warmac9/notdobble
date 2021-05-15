const symbolsNum = 31
const symbolsOffsets = [0, 1, 3, 10, 14, 26]


export function generateCards(symbolsNum, symbolsOffsets, ) {
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


export function randomizeCards(seed, cardSymbols) {
    let engine = Random.MersenneTwister19937.seed(seed)
    let random = new Random.Random(engine);

    random.shuffle(cardSymbols)
    
    for (let index = 0; index < cardSymbols.length; index++) {
        cardSymbols[index] = random.shuffle(cardSymbols[index])
    }

    return cardSymbols
}