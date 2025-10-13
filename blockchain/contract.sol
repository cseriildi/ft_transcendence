// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract GameResult {
    struct Result {
        address player1;
        address player2;
        address winner;
        address loser;
        uint256 winner_score;
        uint256 loser_score;
        uint256 timestamp;
    }

    mapping(uint256 => Result) public results;
    mapping(address => uint256[]) public playerResults;
    mapping(address => uint256) public playerWins;
    mapping(address => uint256) public playerLosses;
    uint256 public resultCount;

    event ResultRecorded(
        uint256 indexed resultId, 
        address indexed winner,
        address indexed loser,
        uint256 winner_score, 
        uint256 loser_score
    );

    function recordResult(
        address player1, 
        address player2, 
        address winner, 
        address loser, 
        uint256 winner_score, 
        uint256 loser_score
    ) public returns (uint256) {
        require(player1 != player2, "Players must be different");
        require(winner == player1 || winner == player2, "Winner must be one of the players");
        require(loser == player1 || loser == player2, "Loser must be one of the players");
        require(winner != loser, "Winner and loser must be different");

        resultCount++;
        
        results[resultCount] = Result({
            player1: player1,
            player2: player2,
            winner: winner,
            loser: loser,
            winner_score: winner_score,
            loser_score: loser_score,
            timestamp: block.timestamp
        });

        playerResults[player1].push(resultCount);
        playerResults[player2].push(resultCount);

        playerWins[winner] += 1;
        playerLosses[loser] += 1;

        emit ResultRecorded(resultCount, winner, loser, winner_score, loser_score);

        return resultCount;
    }

    function getGameResult(uint256 resultId) public view returns (Result memory) {
        require(resultId > 0 && resultId <= resultCount, "Invalid result ID");
        return results[resultId];
    }

    function getPlayerResults(address player) public view returns (uint256[] memory) {
        return playerResults[player];
    }

    function getPlayerStats(address player) public view returns (uint256 wins, uint256 losses) {
        return (playerWins[player], playerLosses[player]);
    }
}




