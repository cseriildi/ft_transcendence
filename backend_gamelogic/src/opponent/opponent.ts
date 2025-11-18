import { GameServer } from "../gameTypes.js";
import { getErrorConfig, predictInterceptionPoint } from "./opponent.utils.js";

/**
 * AI opponent that only "sees" the game state periodically
 * and must predict ball movement with errors
 */
export function updateDummyPaddle(game: GameServer, playerNumber: 1 | 2) {
  const paddle = playerNumber === 1 ? game.Paddle1 : game.Paddle2;
  const now = Date.now();
  const timeElapsed = now - game.aiPlayer.aiLastDecisionTime;

  const errorConfig = getErrorConfig(game.aiPlayer.aiDifficulty);
  let positionError = errorConfig.positionError;

  // AI makes decisions based on difficulty reaction time
  if (timeElapsed >= errorConfig.reactionTime || game.isServe) {
    let predictedY = predictInterceptionPoint(game, playerNumber);

    // Random chance to increase error
    if (Math.random() < errorConfig.chanceToExtraError) {
      positionError *= 2;
    }

    // Add random position error
    const maxError = paddle.length * positionError;
    const error = (Math.random() - 0.5) * maxError * 2; // Range: [-maxError, +maxError]

    // Apply error and clamp to field bounds
    game.aiPlayer.aiTargetY = Math.max(
      paddle.length / 2,
      Math.min(predictedY + error, game.Field.height - paddle.length / 2)
    );

    game.aiPlayer.aiLastDecisionTime = now;
    if (game.isServe) {
      game.isServe = false;
    }
  }

  // Move towards the predicted target position
  const targetY = game.aiPlayer.aiTargetY ?? game.Field.height / 2;
  const diff = targetY - paddle.cy;
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
