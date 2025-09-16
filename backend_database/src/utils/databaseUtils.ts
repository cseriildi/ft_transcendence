import { Database } from "sqlite3";
import { errors } from "./errorUtils.ts";

export class DatabaseHelper {
  constructor(private db: Database) {}
  
  //here T is the type of the row returned
  // :Promise<T | null> means it will return a promis of that type
  //sql is the query as a string
  //params ae optional and default to an empty array
  async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    //here is the promise callabck that wraps the db.get
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(errors.internal("Database error"));
        else resolve(row || null);
      });
    });
  }
  
  async run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      //rrow functions don't have their own this
      // so we'd lose access to lastID and changes
      this.db.run(sql, params, function(err) {
        if (err) reject(errors.internal("Database error"));
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
        if (err) reject(errors.internal("Database error"));
        else resolve(rows || []);
      });
    });
  }
}