import { GameServer } from "../gameTypes";

export function updateDummyPaddle(game: GameServer, playerNumber: 1 | 2) {
    const paddle = playerNumber === 1 ? game.Paddle1 : game.Paddle2;
    const ball = game.Ball;

    const diff = ball.y - paddle.cy;
    const deadZone = paddle.length / 4;
    
    if (Math.abs(diff) < deadZone) {
        paddle.ySpeed = 0;
        return;
    }

    if (diff > 0) {
        paddle.ySpeed = paddle.speed;
    } else {
        paddle.ySpeed = -paddle.speed;
    }
}