var socket = null;
var url = document.URL.split("//")[1];
var gameRoom = null;
var storedGameRoom = null;
var playerNumber = null;
var initialized = false;

var canvas, hoverCanvas, ctx, hCtx, width, height;

var currentTurn = 1;
var gameRunning = false;
var gameState = new Array(6).fill(0).map(() => new Array(7).fill(0));
function setConnected(connected) {
    $("#connect").prop("disabled", connected);
    $("#disconnect").prop("disabled", !connected);
    if (connected) {
        $("#aboveBoard").show();
        $("#board").show();
        $("#room").hide();
        window.localStorage.setItem("connected-game", gameRoom);
    }
    else {
        $("#aboveBoard").hide();
        $("#board").hide();
        $("#room").show();
    }
}

function connect() {
    if(storedGameRoom) { gameRoom = storedGameRoom}
    else gameRoom = $("#room").val();
    socket = new WebSocket('ws://' + url + 'game' + gameRoom);
    socket.binaryType = "arraybuffer";
    socket.onopen = function(e) {
        setConnected(true);
        console.log("Connected to: room " + gameRoom);
    }
    socket.onclose = function(e) { disconnect(); }
    socket.onmessage = function(e) { onMessage(e); }
}

function onMessage(e) {
    var view = new DataView(e.data);
    // single byte determining if player is 1 or 2
    if(view.byteLength==2) {
        playerNumber = view.getInt8(0);
        gameRunning = true;
        currentTurn = view.getInt8(1);
    }
    // initial game state from server
    if(view.byteLength==42) {
        let c = 0;
        for(let x = 0; x < 6; x++) {
            for(let y = 0; y < 7; y++) {
                gameState[x][y] = view.getInt8(c++);

            }
        }
    }
    // new player turn
    if(view.byteLength==3) {
        let p = view.getInt8(0);
        currentTurn = (p == 1) ? 2 : 1;
        let x = view.getInt8(1);
        let y = view.getInt8(2);
        gameState[x][y] = p;
    }
    // game ended
    if(view.byteLength==4) {
        let result = view.getInt8(0);
        let message = "";

        switch(result) {
            case 0:
                message = "It's a tie!";
                break;
            case 1:
                message = "Player 1 has won!";
                break;
            case 2:
                message = "Player 2 has won!";
                break;
        }

        console.log(message);

        gameRunning = false;

        // display winning text
        hCtx.clearRect(0, 0, hoverCanvas.width, hoverCanvas.height);
        hCtx.fillStyle = "rgb(255, 0, 0)";
        hCtx.font = "30px Arial";
//        let result = view.getInt8(0);
        hCtx.fillText(message, 100, 50);

        setTimeout(function() {
            disconnectBtn();
        }, 10000)
    }

    // redraw board after update from server
    drawBoard();
}

function disconnect() {
    if (socket !== null) {
        socket.close();
    }
    setConnected(false);
    console.log("Disconnected");
}

// clear states variables and canvas
function disconnectBtn() {
    localStorage.removeItem("connected-game");
    disconnect();
    hCtx.clearRect(0, 0, hoverCanvas.width, hoverCanvas.height);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    currentTurn = 1;
}

function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgb(0,200,255)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for(let x = 0; x < 7; x++) {
        for(let y = 0; y < 6; y++) {

            ctx.beginPath();
            ctx.arc(x*width+width/2, y*height+height/2, 0.85*width/2, 0, 2 * Math.PI);
            ctx.fillStyle = "rgb(0, 230, 255)";
            ctx.fill();

            ctx.beginPath();
            ctx.arc(x*width+width/2, y*height+height/2, 0.8*width/2, 0, 2 * Math.PI);
            if(gameState[y][x] == 1) {
                ctx.fillStyle = "rgb(255, 0, 0)";
            } else if (gameState[y][x] == 2) {
                ctx.fillStyle = "rgb(255, 255, 0)"
            } else {
                ctx.fillStyle = "rgb(255, 255, 255)"
            }
            ctx.fill();

            if(gameState[y][x] == 1 || gameState[y][x] == 2) {
                ctx.beginPath();
                ctx.arc(x*width+width/2, y*height+height/2, 0.6*width/2, 0, 2 * Math.PI);
                ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
                ctx.stroke();
            }
        }
    }
}

// finding lowest possible place for new token
function findLowestInCol(col) {
    let res = -1;
    for(let i = 5; i>=0; i--) {
        if(gameState[i][col]==0) {
            return i;
        }
    }
    return res;
}


//initialization

$(function () {
    $("form").on('submit', function (e) {
        e.preventDefault();
    });
    $( "#connect" ).click(function() { connect(); });
    $( "#disconnect" ).click(function() { disconnectBtn(); });

    storedGameRoom = window.localStorage.getItem("connected-game");
    if(storedGameRoom) connect(); //if player has game in progress

    canvas = document.getElementById("board");
    ctx = canvas.getContext('2d');
    width = canvas.width/7;
    height = canvas.height/6;

    hoverCanvas = document.getElementById("aboveBoard");
    hCtx = hoverCanvas.getContext('2d');

    $("#board").hide();

    canvas.addEventListener("mousemove", function(e) {
        if(gameRunning) {
            let rect = canvas.getBoundingClientRect();
            let clientX = e.clientX - rect.left;
            let col = Math.floor(clientX / width);
            let circleX = col*width;
            hCtx.clearRect(0, 0, hoverCanvas.width, hoverCanvas.height);
            hCtx.beginPath();
            hCtx.arc(circleX+width/2, height/2, 0.8*width/2, 0, 2 * Math.PI);
            if(playerNumber==1)
            hCtx.fillStyle = "rgba(255, 0, 0, 0.5)";
            else if(playerNumber==2)
            hCtx.fillStyle = "rgba(255, 255, 0, 0.5)";
            hCtx.fill();

            hCtx.beginPath();
            hCtx.arc(circleX+width/2, height/2, 0.6*width/2, 0, 2 * Math.PI);
            hCtx.fillStyle = "rgba(125, 125, 125, 0.1)";
            hCtx.stroke();
        }
    });

    canvas.addEventListener("mousedown", function(e) {
        if(currentTurn == playerNumber && gameRunning) {
            let rect = canvas.getBoundingClientRect();
            let clientX = e.clientX - rect.left;
            let col = Math.floor(clientX / width);
            let row = findLowestInCol(col);
            let buffer = new ArrayBuffer(2);
            let dv = new DataView(buffer, 0);
            dv.setInt8(0, row);
            dv.setInt8(1, col);
            if(row != -1) {
              socket.send(dv);
            }
        }
    });

    canvas.addEventListener("mouseleave", function(e) {
        if(gameRunning){
            hCtx.clearRect(0, 0, hoverCanvas.width, hoverCanvas.height);
        }
    });

//    url = document.URL.split("//")[1];
});
