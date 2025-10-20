import { Database } from "sqlite3";
import { errors } from "./errorUtils.ts";

export class DatabaseHelper {
  constructor(private db: Database) {}

  /**
   * Retrieves the avatar URL for a given user ID.
   * Throws an error if no avatar is found for the user.
   * @param userId - The ID of the user whose avatar to retrieve
   * @returns The avatar URL string
   * @throws {AppError} If no avatar is found for the user
   */
  async getAvatarUrl(userId: number): Promise<string> {
    const avatar = await this.get<{ file_url: string }>(
      "SELECT file_url FROM avatars WHERE user_id = ?",
      [userId]
    );
    
    if (!avatar || !avatar.file_url) {
      throw errors.notFound(`Avatar not found for user ${userId}`);
    }
    
    return avatar.file_url;
  }
  
  //here T is the type of the row returned
  // :Promise<T | null> means it will return a promis of that type
  //sql is the query as a string
  //params ae optional and default to an empty array
  async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    //here is the promise callabck that wraps the db.get
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(errors.internal(err.message));
        else resolve((row as T) || null);
      });
    });
  }
  
  async run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      //rrow functions don't have their own this
      // so we'd lose access to lastID and changes
      this.db.run(sql, params, function(err) {
        if (err) reject(errors.internal(err.message));
        //the lastID and changes are properties of the function context
        //lastID is the id of the last inserted row (only relevant if inserted else it is 0)
        //changes is the number of rows affected by the query (can be used to verify that the wanted changes happened)
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
  
  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(errors.internal(err.message));
        else resolve((rows as T[]) || []);
      });
    });
  }
}