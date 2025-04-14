# Margonem Global Addon

## Description

An addon dedicated to a private Margonem server, extending the game with additional features:

* Global chat for addon users.
* Login and registration system for addon users.
* Tracking and displaying battle history (PvP) and clan battles.
* Displaying a list of currently logged-in players.
* Rank and battle points system.
* User verification system.
* Fetching information from player profiles and saving it to the database.
* Ability for GMs to ban and mute users on the global chat.

## Tech Stack

* **Backend:** Node.js, Express, MongoDB (Mongoose), Socket.IO.
* **Frontend:** Client script (browser addon) injected into the Margonem game.

## Setup & Configuration

### Backend (Server)

1.  Navigate to the main project directory.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Create a `.env` file in the main directory based on required environment variables (e.g., `DB_URL`, `PORT`). Example:
    ```dotenv
    DB_URL=mongodb://localhost:27017/margonemAddon
    PORT=2222 # Default port if not set otherwise in .env
    ```
4.  Start the server:
    ```bash
    npm start
    ```
    The server should be running on `http://localhost:2222` (or the port defined in `.env`).

### Frontend (Client Script)

* The script (`client.js`) is likely injected into the game using a browser addon (e.g., Tampermonkey) or as part of an extension.
* Client-side configuration is not detailed in the provided files but requires connecting to the Socket.IO server.

## API Endpoints & Socket.IO Events

### User Authentication & Session (API)

<details>
<summary>`POST /api/register` - Register a new addon user</summary>

**Requires verification via a code in the Margonem profile.**

**Request Body:**
```json
{
  "user_id": "Number", // Margonem account ID
  "password": "String",
  "nickname": "String" // Main nickname from Margonem profile
}
```
</details>

<details>
<summary>`POST /api/login` - Log in an addon user</summary>

**Request Body:**
```json
{
  "user_id": "Number", // Margonem account ID
  "password": "String"
}
```
**Response Body (success):**
```json
{
  "session": "String", // Unique session token
  "charList": "Object" // Character list (without EQ)
}
```
</details>

<details>
<summary>`POST /api/getSession` - Get session data and character list</summary>

**Request Body:**
```json
{
  "user_id": "Number", // Margonem account ID
  "session": "String" // Session token obtained during login
}
```
**Response Body (success):**
```json
{
  "charList": "Object", // Account owner's character list (without EQ)
  "owner": "Number", // Account owner's ID
  "guest": "Object", // (Optional) Substitute's character list (without EQ)
  "guestID": "Number" // (Optional) Substitute's account ID
}
```
</details>

### Real-time Communication (Socket.IO)

**Namespace:** `/orvidia`

<details>
<summary>`connect` - Establish a connection</summary>

**Query Parameters:**
* `user_id`: Number - Margonem account ID.
* `session`: String - Session token.
* `guest`: Number (0 or 1) - Whether the user is logged in as a substitute.
* `char`: Number - ID of the currently logged-in character.
* `nickname`: String - Nickname of the currently logged-in character.
</details>

<details>
<summary>`newMessage` (emit) - Send a message to the global chat</summary>

**Payload:**
```json
{
  "nickname": "String",
  "user_id": "Number",
  "message": "String",
  "session": "String",
  "permission": "Number" // Character permission level
}
```
</details>

<details>
<summary>`newMessage` (on) - Receive a new message or response</summary>

**Payload (chat message):**
```json
{
  "k": 4, // Message type (global chat)
  "n": "String", // Sender's nickname
  "t": "String", // Message content
  "ts": "Number", // Timestamp
  "created_id": "Number", // Sender's account ID
  "permission": "Number", // Sender's permissions
  "s": "String", // Message style (e.g., "sys_red" for system)
  "guest": "Number" // Whether the sender is a substitute
}
```
**Payload (response from player menu - GMenu):**
```json
{
 "profile": "String", // Text from the player's profile
 "charList": "Object", // Character list
 "guest": "Number", // Substitute account ID (if exists)
 "nickname": "String", // Player's main nickname
 // ... other profile data
}
```
</details>

<details>
<summary>`getChat` (emit) - Request to fetch recent chat messages</summary>
<br>
</details>

<details>
<summary>`getChat` (on) - Receive a list of recent messages</summary>

**Payload:** Array of message objects (format as in `newMessage` (on)).
</details>

<details>
<summary>`newBattle` (emit) - Send data about a finished battle</summary>

**Payload:**
```json
{
  "battle": "Object", // Object with combatant data (g.battle.f)
  "map": "String", // Map name
  "user_id": "Number",
  "session": "String",
  "nickname": "String", // Nickname of the reporting character
  "winner": "String" // String from battleMsg containing the winner
}
```
</details>

<details>
<summary>`newBattle` (on) - Receive information about a new PvP battle</summary>

**Payload:**
```json
{
  "newBattle": true,
  "team1": "Object", // Team 1 data
  "team2": "Object"  // Team 2 data
}
```
</details>

<details>
<summary>`inits` (on) - Receive initialization data after connection</summary>

**Payload:**
```json
{
  "chatMessages": "Array", // Recent chat messages
  "lastBattles": "Array", // Recent PvP battles
  "rankingInits": "Object", // Player ranking
  "rankingInitsClans": "Object" // Clan ranking
}
```
</details>

<details>
<summary>`online` (on) - Receive information about the number of players online</summary>

**Payload:**
```json
{
  "usersOnline": "Number", // Number of connected addon users
  "connectSM": "Array" // List of connected SM/MC nicknames
}
```
</details>

<details>
<summary>`info` (on) - Receive system information or errors</summary>

**Payload:**
```json
{
  "message": "String" // or "error": "String"
}
```
</details>

<details>
<summary>`exit` (on) - Information about disconnection (e.g., due to login from another location)</summary>

**Payload:**
```json
{
  "message": "String"
}
```
</details>

## Additional Information

* The application uses `socket.io` for real-time communication between the server and clients (in-game addons).
* Rate limiting is applied using `express-rate-limit` and `rate-limiter-flexible` to prevent abuse.
* Client IP address is checked using the `cf-connecting-ip` header or `socket.handshake.address`.
* Data about accounts, characters, chat, and battles are stored in a MongoDB database using Mongoose.
* The system tracks PvP and group battles, updating player and clan rankings.
* There is a mechanism for fetching data from Margonem player profiles (`getProfile.js`).
* The addon includes functionality for relogging between characters, including substitute accounts.
* Registration verification requires pasting a unique code into the player's Margonem profile.
* Chat messages are subject to censorship defined on the server.
* Administrators have the ability to block the chat and mute users (`/lock`, `/unlock`, `/gmute`).
* There is a `/gmenu` command to display player information (requires admin privileges).
