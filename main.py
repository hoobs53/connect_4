import uuid
from abc import ABC

import tornado.web
import tornado.websocket
import tornado.ioloop
import numpy as np
import os

ROOMS = 4
ROWS = 6
COLS = 7

handlers = {}


def init_new_game():
    new_game = {"game_state": np.zeros(shape=(ROWS, COLS), dtype=int), "players": 0, "player1": None,
                "player2": None, "current-turn": 1, "tokens": 0}
    return new_game


class MainHandler(tornado.web.RequestHandler, ABC):
    def get(self):
        if not self.get_cookie("user"):
            cookie = str(uuid.uuid4())
            self.set_cookie("user", str(cookie))
        self.render("index.html")


def reset_game(name):
    GamePool.games[name] = init_new_game()


class GamePool:
    games = {}
    for i in range(1, ROOMS):
        name = "game" + str(i)
        games[name] = init_new_game()


def check_if_won(game_state, player):
    res = False
    for i in range(ROWS-3):
        for j in range(COLS):
            if game_state[i][j] == player and game_state[i+1][j] == player \
                    and game_state[i+2][j] == player and game_state[i+3][j] == player:
                res = True

    for i in range(ROWS):
        for j in range(COLS-3):
            if game_state[i][j] == player and game_state[i][j + 1] == player \
                    and game_state[i][j + 2] == player and game_state[i][j + 3] == player:
                res = True

    for i in range(ROWS-3):
        for j in range(COLS-3):
            if game_state[i][j] == player and game_state[i+1][j + 1] == player \
                    and game_state[i+2][j + 2] == player and game_state[i+3][j + 3] == player:
                res = True

    for i in range(3, ROWS):
        for j in range(COLS - 3):
            if game_state[i][j] == player and game_state[i - 1][j + 1] == player \
                    and game_state[i - 2][j + 2] == player and game_state[i - 3][j + 3] == player:
                res = True

    return res


def is_player_in_game(cookie, game_name):
    return cookie == GamePool.games[game_name]["player1"] \
           or cookie == GamePool.games[game_name]["player2"]


def build_game_state_payload(game_state):
    result = []
    for i in range(ROWS):
        for j in range(COLS):
            result.append(game_state[i][j])
    return bytes(result)


class GameHandler(tornado.websocket.WebSocketHandler, ABC):
    game_pool = GamePool.games

    def __init__(self, application, request, game_num, **kwargs):
        super(GameHandler, self).__init__(application, request, **kwargs)
        self.player = None
        self.game_num = game_num
        self.game_name = "game" + str(self.game_num)
        self.game = GameHandler.game_pool[self.game_name]
        self.cookie = self.get_cookie("user")

    def prepare(self):
        players = self.game["players"]
        if players >= 2 or (self.game["player1"] and self.game["player2"]):
            if is_player_in_game(self.get_cookie("user"), self.game_name):
                if self.cookie == self.game["player1"]:
                    self.player = 1
                else:
                    self.player = 2
                pass
            else:
                print("GAME" + str(self.game_num) + ": Room is full")
                self.finish()
        else:
            pass

    def open(self):
        self.game["players"] += 1

        if not self.game["player1"]:
            self.game["player1"] = self.cookie
            self.player = 1
        elif not self.game["player2"]:
            self.game["player2"] = self.cookie
            self.player = 2

        # payload = self.player.to_bytes(1, 'big')
        payload = bytes([self.player, self.game["current-turn"]])
        self.write_message(payload, binary=True)  # send info if new player is player 1 or player 2
        payload = build_game_state_payload(self.game["game_state"])
        self.write_message(payload, binary=True)  # send current game state

        handlers[self.cookie] = self
        print("GAME" + str(self.game_num) + ": player " + str(self.player) + " connected")

    def on_close(self):
        self.game["players"] -= 1
        print("GAME" + str(self.game_num) + ": player " + str(self.player) + " disconnected")
        if self.game["players"] == 0:
            # cleanup
            print("GAME" + str(self.game_num) + ": Room is empty, reseting game")
            reset_game(self.game_name)
            cookie1 = self.game["player1"]
            cookie2 = self.game["player2"]
            if handlers[cookie1]:
                del (handlers[cookie1])
            if handlers[cookie2]:
                del (handlers[cookie2])

    def on_message(self, message):
        x = message[0]
        y = message[1]

        self.game["game_state"][x][y] = self.player
        self.game["tokens"] += 1

        next_turn = 2 if self.player == 1 else 1
        GamePool.games[self.game_name]["current-turn"] = next_turn
        payload = [self.player, message[0], message[1]]
        print("GAME" + str(self.game_num) + ": player " + str(self.player) + " turn: " + str(message[0]) + ", " + str(message[1]))

        cookie1 = self.game["player1"]
        cookie2 = self.game["player2"]

        if self.game["players"] == 2:
            handlers[cookie1].write_message(bytes(payload), binary=True)
            handlers[cookie2].write_message(bytes(payload), binary=True)
        else:
            handlers[self.cookie].write_message(bytes(payload), binary=True)

        if check_if_won(self.game["game_state"], self.player):
            print("GAME" + str(self.game_num) + ": player " + str(self.player)
                  + " has won game " + str(self.game_num) + "!")

            handlers[cookie1].write_message(bytes([self.player, 7, 7, 7]), binary=True)
            handlers[cookie2].write_message(bytes([self.player, 7, 7, 7]), binary=True)

        elif self.game["tokens"] == 42:
            print("GAME" + str(self.game_num) + ": Tied!")

            handlers[cookie1].write_message(bytes([0, 7, 7, 7]), binary=True)
            handlers[cookie2].write_message(bytes([0, 7, 7, 7]), binary=True)

    def check_origin(self, origin):
        return True


if __name__ == "__main__":
    app = tornado.web.Application([
        (r"/", MainHandler),
        ("/game1", GameHandler, dict(game_num=1)),
        ("/game2", GameHandler, dict(game_num=2)),
        ("/game3", GameHandler, dict(game_num=3)),
        ("/game4", GameHandler, dict(game_num=4)),
    ], template_path=os.path.join(os.path.dirname(__file__), "templates"),
        static_path=os.path.join(os.path.dirname(__file__), "static"))
    app.listen(8888)
    tornado.ioloop.IOLoop.instance().start()
