import { GameServer } from "../gameTypes.js";

/**
 * Predicts where the ball will be after a given time
 * Takes into account wall bounces
 */
function predictBallPosition(game: GameServer, timeMs: number): { x: number; y: number } {
  const ball = game.Ball;
  const timeSteps = Math.round(timeMs / (1000 / game.physicsInterval));

  let predictedX = ball.x;
  let predictedY = ball.y;
  let speedX = ball.speedX;
  let speedY = ball.speedY;

  // Simulate ball movement for the prediction time
  for (let i = 0; i < timeSteps; i++) {
    predictedX += speedX;
    predictedY += speedY;

    // Handle top/bottom wall bounces
    if (predictedY - ball.radius <= 0) {
      predictedY = ball.radius;
      speedY = -speedY;
    } else if (predictedY + ball.radius >= game.Field.height) {
      predictedY = game.Field.height - ball.radius;
      speedY = -speedY;
    }
  }

  return { x: predictedX, y: predictedY };
}

/**
 * Calculates when the ball will reach the paddle's X position
 */
function timeUntilBallReachesPaddle(game: GameServer, playerNumber: 1 | 2): number {
  const paddle = playerNumber === 1 ? game.Paddle1 : game.Paddle2;
  const ball = game.Ball;

  const movingTowardsPaddle =
    (playerNumber === 1 && ball.speedX < 0) || (playerNumber === 2 && ball.speedX > 0);

  if (!movingTowardsPaddle || ball.speedX === 0) {
    return Infinity;
  }

  const distance = Math.abs(paddle.cx - ball.x);
  const timeSteps = distance / Math.abs(ball.speedX);
  const timeMs = timeSteps * (1000 / game.physicsInterval);

  return timeMs;
}

/**
 * Predicts where the ball will be when it reaches the paddle
 * Accounts for wall bounces during travel
 */
export function predictInterceptionPoint(game: GameServer, playerNumber: 1 | 2): number {
  const paddle = playerNumber === 1 ? game.Paddle1 : game.Paddle2;

  const timeToReach = timeUntilBallReachesPaddle(game, playerNumber);

  if (timeToReach === Infinity) {
    return game.Field.height / 2;
  }

  const prediction = predictBallPosition(game, timeToReach);

  const paddleHalfLength = paddle.length / 2;
  return Math.max(paddleHalfLength, Math.min(prediction.y, game.Field.height - paddleHalfLength));
}

/**
 * Get error configuration based on difficulty
 */
export function getErrorConfig(difficulty: string) {
  switch (difficulty) {
    case "easy":
      return {
        positionError: 0.7, // 70% of paddle length
        reactionTime: 1100, // 1.1 seconds
        chanceToMissPredict: 0.3, // 30% chance to predict wrong direction
      };
    case "medium":
      return {
        positionError: 0.5, // 50% of paddle length
        reactionTime: 1000, // 1.0 seconds
        chanceToMissPredict: 0.1, // 10% chance to predict wrong
      };
    case "hard":
      return {
        positionError: 0.2, // 20% of paddle length
        reactionTime: 1000, // 1 second
        chanceToMissPredict: 0.0, // 0% chance to predict wrong
      };
    default:
      return {
        positionError: 0.5,
        reactionTime: 1000,
        chanceToMissPredict: 0.1,
      };
  }
}
