import { ApiResponse, ErrorResponse } from "../../types/commonTypes.ts";

export interface Match {
  id: number;
  winner: string;
  loser: string;
  winner_score: number;
  loser_score: number;
  played_at: string;
};

export interface CreateMatchBody {
  winner: string;
  loser: string;
  winner_score: number;
  loser_score: number;
};

export interface GetMatchesQuery {
  username: string;
}

export type CreateMatchResponse = ApiResponse<Match>;
export type GetMatchResponse = ApiResponse<Match>;
export type GetMatchesResponse = ApiResponse<Match[]>;
export type MatchErrorResponse = ErrorResponse;