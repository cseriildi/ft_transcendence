export interface Match {
  id: number;
  winner_id: number;
  loser_id: number;
  winner_name: string;
  loser_name: string;
  winner_score: number;
  loser_score: number;
  played_at: string;
}

export interface CreateMatchBody {
  winner_id: number;
  loser_id: number;
  winner_score: number;
  loser_score: number;
}

export interface GetMatchesQuery {
  userId: string; // URL params are always strings, parsed to number in controller
}
