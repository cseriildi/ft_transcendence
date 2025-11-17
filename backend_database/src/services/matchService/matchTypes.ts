export interface Match {
  id: number;
  winner_Id: number;
  loser_Id: number;
  winner_score: number;
  loser_score: number;
  played_at: string;
}

export interface CreateMatchBody {
  winner_Id: number;
  loser_Id: number;
  winner_score: number;
  loser_score: number;
}

export interface GetMatchesQuery {
  userId: string; // URL params are always strings, parsed to number in controller
}
