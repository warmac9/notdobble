(function (exports) {
    'use strict';

    function byClass(className) {
        return document.getElementsByClassName(className)[0]
    }


    function randomRange(from, to) {
        let rangeLenght = to - from;
        return Math.round(Math.random() * rangeLenght + from)
    }


    function randomChoice(arr) {
        return arr[randomRange(0, arr.length-1)]
    }


    async function wait(millsec) {
        await new Promise(function(Resolve, Reject) {
            setTimeout(function() {
                Resolve();
            }, millsec);
        });
    }

    function generateCards(symbolsNum, symbolsOffsets, ) {
        let cards = Array(symbolsNum);
        for (let index = 0; index < cards.length; index++) {
            cards[index] = [];
        }

        for(let symbolId = 0; symbolId < symbolsNum; symbolId++) {
            symbolsOffsets.forEach(offset => {
                cards[(symbolId+offset)%symbolsNum].push(symbolId);
            });
        }

        return cards
    }


    function randomizeCards(seed, cardSymbols) {
        let engine = Random.MersenneTwister19937.seed(seed);
        let random = new Random.Random(engine);

        random.shuffle(cardSymbols);
        
        for (let index = 0; index < cardSymbols.length; index++) {
            cardSymbols[index] = random.shuffle(cardSymbols[index]);
        }

        return cardSymbols
    }

    async function animate(animated, animHandle=null) {
        let inProgress = animated.length;

        await new Promise((Resolve, Reject) => {
            async function onCompleted() {
                inProgress--;
                if(inProgress == 0) {
                    await wait(10);
                    Resolve();
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
                });
            }
        });
    }


    function* deckAnimate(deck) {
        let deckImages = [];
        for(const {images} of deck) {
            deckImages.splice(0, 0, images);
        }

        while(true) {
            let cardImages = deckImages.pop();
            
            if (cardImages == undefined)
                return true
            
            for(let image of cardImages) {
                image.set({ opacity: 1});
            }
            
            canvas.renderAll();
            yield false;
        }
    }


    async function discardAnimate(topCard, pileCard, endPos, toMyPile, animDuration, otherPileDiscardOpacity) {
        if(topCard == undefined) return

        let animateArgs = [];
        topCard = moveTopCardFront(topCard);

        animateArgs.push({
            obj: topCard.group,
            attr: 'left',
            endValue: endPos[0],
            duration: animDuration
        });
        animateArgs.push({
            obj: topCard.group,
            attr: 'top',
            endValue: endPos[1],
            duration: animDuration
        });

        if(!toMyPile)
            topCard.group.set({ opacity: otherPileDiscardOpacity });

        await animate(animateArgs);

        if(toMyPile && pileCard != undefined)
            pileCard.images.forEach(image => {
                canvas.remove(image);
            });

        return topCard
    }


    function symbolsFadeAnimate(symbolImages, opacity, fadeDuration) {
        let animateArgs = [];

        symbolImages.forEach(image => {
            animateArgs.push({
                obj: image,
                attr: 'opacity',
                endValue: opacity,
                duration: fadeDuration
            });
        });
        animate(animateArgs);
    }

    var canvas;
    var assets;


    function resizeImage(image, newWidth, newHeight) {
        image.scaleX =  newWidth / image.width;
        image.scaleY =  newHeight / image.height;
    }

    function initImage(imageElement, options) {
        const { resize, rotate, ...imgOptions } = options;
        let imgInstance = new fabric.Image(imageElement, imgOptions);

        if(resize != undefined)
            resizeImage(imgInstance, ...resize);

        if(rotate != undefined)
            imgInstance.rotate(rotate);

        return imgInstance
    }


    function initCard(pos, symbolsId, cardTemplate, options=[], rotations) {
        let images = [];

        let cardInstance = initImage(assets.card, {
            left: pos[0],
            top: pos[1],
            ...options
        });
        images.push(cardInstance);
        canvas.add(cardInstance);

        for (let index = 0; index < cardTemplate.length; index++) {
            const {offset, size, rot} = cardTemplate[index];
            const symbolId = symbolsId[index];

            let rotation;
            if(rotations == undefined)
                rotation = rot + randomRange(0, 4) * 90;
            else
                rotation = rotations[index];

            let symbolInstance = initImage(assets.symbols[symbolId], {
                left: pos[0] + offset[0],
                top: pos[1] + offset[1],
                rotate: rotation,
                resize: [...size],
                symbolId: symbolId,
                cardImage: images[0],
                ...options
            });
            images.push(symbolInstance);
            canvas.add(symbolInstance);
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


    function initDeck(cardTemplate, cardSymbols, deckPos, deckOffRange, deckOffFreq) {
        let deck = [];

        for (let index = 0; index < cardSymbols.length; index++) {
            var cardPos = [...deckPos];

            if(index%deckOffFreq == 0) {
                cardPos[0] += randomRange(...deckOffRange) * (-1 + randomRange(0, 1) * 2);
                cardPos[1] += randomRange(...deckOffRange) * (-1 + randomRange(0, 1) * 2);
            }

            deck.push(
                initCard(cardPos, cardSymbols[index], cardTemplate, { opacity: 0 })
            );
        }

        return deck
    }


    function moveTopCardFront(topCard) {
        let oldTopCard = topCard;
        let rotations = [];

        oldTopCard.symbolImages.forEach(image => {
            rotations.push(image.angle);
        });
        
        topCard = initCard(
            [oldTopCard.group.left, oldTopCard.group.top],
            oldTopCard.symbols,
            oldTopCard.cardTemplate,
            [],
            rotations
        );

        oldTopCard.images.forEach(image => {
            canvas.remove(image);
        });

        return topCard
    }


    function onMouseDown(func) {
        canvas.on('mouse:down', func);
    }


    function passAssets(assetsData) {
        assets = assetsData;
    }


    function initCanvas() {
        canvas = new fabric.Canvas('canvas', {
            interactive: false,
            selection: false
        });
        
        fabric.Object.prototype.selectable = false;
        fabric.Object.prototype.hoverCursor = 'default';
    }

    var socket;
    var curPlayerId;


    function sendReady(ready) {
        socket.emit('set-player', { ready: ready });
    }

    function sendName(name) {
        socket.emit('set-player', { name: name == '' ? 'foo' : name });
    }

    function sendRoom(room) {
        socket.emit('set-room', room);
    }

    function sendCorrectSymbol(symbolId, deckLength) {
        socket.emit('symbol-selected', symbolId, deckLength);
    }


    function onConnection() {
        curPlayerId = socket.id;

        socket.on('round-start', (seed) => {
            onRoundStart(seed);
        });

        socket.on('symbol-correct', (player, symbolId) => {
            onSymbolGlobalCorrect(player);
        });

        socket.on('player-list', (players) => {
            onPlayerListChange(players);
        });

        socket.on('round-end', (scorePlayers) => {
            onRoundEnd(scorePlayers);
        });

        onStartScreen();
    }


    function initConnection() {
        socket = io();
        socket.on('connect', () => {
            onConnection();
        });
    }

    const symbolsNum = 31;
    const symbolsOffsets = [0, 1, 3, 10, 14, 26];

    const deckPos = [420, 50];
    const deckOffRange = [10, 20];
    const deckOffFreq = 5;

    const deckBlockedDuration = 1500;
    const symbolFadeDuration = 200;
    const deckAnimDuration = 10;
    const discardAnimDuration = 100;


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
    ];
    const cardSize = 320;

    const pilePos = [20, 260];
    const otherPilePos = [0, -cardSize];
    const otherPileDiscardOpacity = 0.25;


    const cardLeftOffset = [
        deckPos[0]+cardSize-30, 
        deckPos[1]+cardSize-30
    ];

    const playerDisplayOffset = [350, 50];
    const playerDisplayWidth = 800;


    const playerSendNameTimeout = 250;
    const roundStartWait = 700;
    const roundEndWait = 1000;
    const endScreenWait = 500;

    var currentRoom = '';
    var oldPlayersList;

    var playerLastDisplay;
    var playerStreak;

    var deck;
    var deckBlocked = false;
    var pile;



    function setPosGameUi() {
        let canvasOffset = [
            (window.innerWidth-byClass('game-canvas').width)/2,
            (window.innerHeight-byClass('game-canvas').height)/2
        ];

        byClass('card-left').style.left = `${canvasOffset[0]+cardLeftOffset[0]}px`;
        byClass('card-left').style.top = `${canvasOffset[1]+cardLeftOffset[1]}px`;
        
        byClass('player-display').style.width = `${playerDisplayWidth}px`;
        byClass('player-display').style.left = `${canvasOffset[0]+playerDisplayOffset[0]-playerDisplayWidth}px`;
        byClass('player-display').style.top = `${canvasOffset[1]+playerDisplayOffset[1]}px`;
    }

    async function endScreen(players) {
        byClass('player-score').innerHTML = '';
        byClass('player-end-screen').classList.remove('hide');

        for(const [name, score] of players) {
            let node = document.createElement('TR');
            node.innerHTML = `<td>${name}</td><td>${score}</td>`;
            byClass('player-score').appendChild(node);
        }

        await wait(endScreenWait);
        document.onclick = (event) => {
            if(byClass('player-end-screen').contains(event.target)) return

            onStartScreen();
            document.onclick = () => {};
        };
    }

    function startAnimation(el, animClass) {
        let animList = ['explode', 'mini-explode'];

        let animate = (el) => {
            animList.forEach(anim => {
                el.classList.remove(anim);
            });
            el.classList.remove(animClass);
            setTimeout(function() {
                el.classList.add(animClass);
            }, 30);
        };
        if(typeof el == 'string')
            Array.from(document.getElementsByClassName(el)).forEach(el => { animate(el); });
        else
            animate(el);
    }


    async function discardCard(toMyPile=false) {
        let topCard = await discardAnimate(
            deck.pop(), pile, (toMyPile ? pilePos : otherPilePos), toMyPile, 
            discardAnimDuration, otherPileDiscardOpacity
        );

        if(toMyPile)
            pile = topCard;
        byClass('card-left-num').innerHTML = deck.length;

        //temp
        if(deck.length == 5) {
            byClass('card-left').classList.add('shake');
        }
    }

    function symbolBelongTopCard(event) {
        return deck[deck.length - 1].cardImage == event.target.cardImage || pile.cardImage == event.target.cardImage
    }

    function symbolSelected(event) {
        let symbolId = event?.target?.symbolId;
        if(symbolId == undefined ||
            deckBlocked || 
            !symbolBelongTopCard(event)) return

        if(pile.symbols.includes(symbolId) && deck[deck.length-1].symbols.includes(symbolId)) {
            sendCorrectSymbol(symbolId, deck.length - 1);
            return
        }

        deckBlocked = true;
        symbolsFadeAnimate(deck[deck.length - 1].symbolImages, 0, symbolFadeDuration);

        setTimeout(function() {
            symbolsFadeAnimate(deck[deck.length - 1].symbolImages, 1, symbolFadeDuration);
            deckBlocked = false;
        }, deckBlockedDuration);
    }



    // ----->  network events


    function onStartScreen() {
        byClass('player-end-screen').classList.add('hide');
        byClass('player-start-screen').classList.remove('hide');
        byClass('player-ready-input').checked = false;
    }


    function onPlayerListChange(players) {
        delete players[curPlayerId];
        byClass('player-list').innerHTML = '';

        if(Object.keys(players).length == 0) {
            let node = document.createElement('LI');
            node.innerHTML = 'Nobody is connected :(';
            byClass('player-list').appendChild(node);
        } 

        for(const [playerId, player] of Object.entries(players)) {
            const { name, ready, inGame } = player;

            let node = document.createElement('LI');
            node.innerHTML = `<b>${name} </b>`;
            if(ready)
                node.innerHTML += '\'s ready to play!';
            else if(inGame)
                node.innerHTML += '\'s in the game.';
            
            byClass('player-list').appendChild(node);

        }

        if(oldPlayersList != undefined && (Object.entries(players).length != 0 && Object.keys(players).join() != oldPlayersList))
            startAnimation('player-list-container', 'mini-explode');

        oldPlayersList = Object.keys(players).join();
    }


    async function onRoundStart(seed) {
        await wait(roundStartWait);

        playerStreak = 1;
        playerLastDisplay = undefined;
        
        deck = initDeck(
            cardTemplate,
            randomizeCards(seed, generateCards(symbolsNum, symbolsOffsets)), 
            deckPos, 
            deckOffRange,
            deckOffFreq
            );
            
        byClass('player-start-screen').classList.add('hide');
        byClass('card-left-num').innerHTML = 0;
        byClass('card-left').classList.remove('hide');
        byClass('card-left').classList.remove('shake');

        let deckAnimateGenerator = deckAnimate(deck);
        while(true) {
            let endAnimate = deckAnimateGenerator.next().value;
            if(endAnimate) break

            byClass('card-left-num').innerHTML++;
            await wait(deckAnimDuration);
        }

        discardCard(true);
    }


    async function onSymbolGlobalCorrect(player, symbolId) {
        //prevent game ui from appearing in menu
        if(deck === undefined) return
        byClass('player-display').classList.remove('hide');
        
        if(playerLastDisplay == player.id) {
            playerStreak++;
            byClass('player-display-streak').style.visibility = 'visible';
            startAnimation('player-display-streak', 'explode');

        } else {
            playerStreak = 1;
            byClass('player-display-streak').style.visibility = 'hidden';
            startAnimation('player-display', 'fade-from-down');
        }

        byClass('player-display-name').innerHTML = player.name;
        byClass('player-display-streak-num').innerHTML = playerStreak.toString();

        playerLastDisplay = player.id;
        deckBlocked = false;
        discardCard((player.id == curPlayerId));
    }


    async function onRoundEnd(scorePlayers) {
        await wait(roundEndWait);

        deck.push(pile);
        deck.forEach(card => {
            card.images.forEach(image => {
                canvas.remove(image);
            });
        });
        deck = undefined;
        
        byClass('card-left').classList.add('hide');
        byClass('player-display').classList.add('hide');
        byClass('player-display').classList.remove('fade-from-down');

        await wait(100);
        endScreen(scorePlayers);
    }



    // ----->  game load


    async function loadAssets() {        
        let assets = {};
        let res = await axios.get('assets.json');
        let assetsUrl = res.data;
        
        let assetsLoaded = 0;
        let assetsAll = 1 + assetsUrl.symbols.length;
        assets.symbols = Array(assetsAll);

        await new Promise((Resolve, Reject) => {
            function eventAssetLoaded() {
                assetsLoaded++;
            
                if(assetsAll == assetsLoaded) {
                    Resolve();
                }
            }

            fabric.Image.fromURL(assetsUrl.card, function(img) {
                assets.card = img.getElement();
                eventAssetLoaded();
            });

            for (let index = 0; index < assetsUrl.symbols.length; index++) {
                const iconUrl = assetsUrl.symbols[index];

                fabric.Image.fromURL(iconUrl, function(img) {
                    assets.symbols[index] = img.getElement();
                    eventAssetLoaded();
                });
            }
        });

        return assets
    }

    async function onPageLoaded() {
        setPosGameUi();
        window.addEventListener('resize', setPosGameUi);

        passAssets(await loadAssets());
        initCanvas();
        onMouseDown(symbolSelected);

        initConnection();
        byClass('player-name-input').value = '';
        byClass('room-set-but').value = '';

        let sendNameTimeout;
        byClass('player-name-input').addEventListener('keyup', (event) => {
            clearTimeout(sendNameTimeout);
            sendNameTimeout = setTimeout(() => {
                sendName(byClass('player-name-input').value);
            }, playerSendNameTimeout);
        });
        byClass('player-ready-input').addEventListener('change', (event) => {
            sendReady(byClass('player-ready-input').checked);
        });

        byClass('room-set-input').addEventListener('keydown', (event) => {
            if(event.keyCode == 32) event.preventDefault();
        });
        byClass('room-set-but').addEventListener('click', (event) => {
            currentRoom = byClass('room-set-input').value;
            startAnimation('room-set-but', 'mini-explode');
            sendRoom(byClass('room-set-input').value);
            byClass('player-ready-input').checked = false;
        });
        document.addEventListener('click', (event) => {
            if(event.target != byClass('room-set-but')) 
                byClass('room-set-input').value = currentRoom;
        });

        byClass('intro').addEventListener('click', (event) => {
            byClass('intro').classList.add('fade-up');
            setTimeout(() => {
                byClass('intro').classList.add('hide');
            }, 1000);
        });


        let res = await axios.get('assets.json');
        let symbolsSrc = res.data.symbols.slice(1, 5);

        let setSrcPopup = (prev=[]) => {
            let curSymbols = [];

            Array.from(document.getElementsByClassName('popup-symbol')).forEach(el => {
                let randomSrc = randomChoice(symbolsSrc.filter(el => !prev.includes(el) && !curSymbols.includes(el)));
                curSymbols.push(randomSrc);
                el.firstElementChild.src = randomSrc;
            });

            return curSymbols
        };

        let autoHidePopup = () => {
            Array.from(document.getElementsByClassName('popup-symbol')).forEach(el => {
                if(window.innerWidth > 1600 && window.innerHeight > 800)
                    el.classList.remove('hide');
                else
                    el.classList.add('hide');
            });
        };

        window.addEventListener('resize', autoHidePopup);
        autoHidePopup();

        Array.from(document.getElementsByClassName('popup-symbol')).forEach(el => {
            el.addEventListener('mouseenter', () => {
                startAnimation(el, 'explode');
            });
        });

        let prevSymbols = [];
        setInterval(() => {
            startAnimation('popup-symbol', 'mini-explode');
            prevSymbols = setSrcPopup(prevSymbols);
        }, 5000);
        setSrcPopup();
    }

    document.addEventListener('DOMContentLoaded', onPageLoaded);

    exports.onPlayerListChange = onPlayerListChange;
    exports.onRoundEnd = onRoundEnd;
    exports.onRoundStart = onRoundStart;
    exports.onStartScreen = onStartScreen;
    exports.onSymbolGlobalCorrect = onSymbolGlobalCorrect;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

}({}));
