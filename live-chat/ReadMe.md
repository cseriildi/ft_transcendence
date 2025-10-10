# Simple chat setup:
## How to test:
### just run `npm run dev` and open `index.html` file in `src/www/` directory. Client will prompt you to enter your username and connect you to lobby route from where you can see other connected users (open multiple tabs to test).
### Right now only local memory is utilized and message history is retrieved for every chat, so even if you open a new tab with the same username, chats with other users will be shown.


## ToDo:
### 1. Setup the database to update user connections and token check upon connection.
### 2. Manage blocked users.
### 3. Use one websocket to manage all connections per client.