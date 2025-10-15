export interface Match {
  id: number;
  winner: string;
  loser: string;
  winner_score: number;
  loser_score: number;
  played_at: string;
}

export interface CreateMatchBody {
  winner: string;
  loser: string;
  winner_score: number;
  loser_score: number;
}

export interface GetMatchesQuery {
  username: string;
}