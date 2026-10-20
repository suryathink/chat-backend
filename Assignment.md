Task: Chat Backend with PostgreSQL/MySQL & Firebase
Tech Stack

● Node.js + TypeScript (strict typing)

● PostgreSQL or MySQL

● Firebase Firestore (for messages and read receipts)
Task Overview
Build a chat backend with:

● Users & chats stored in a relational DB

● Messages and read receipts stored in Firebase Firestore

● Support 1:1 chats, message sending, ordering, read receipts, and last seen tracking
APIs to Implement

1. Create or Get Chat

   ● POST /chat/create
   ● Input: userAId, userBId
   ● Output: chatId

2. Send Message
   ● POST /chat/:chatId/message/send
   ● Input: senderId, text
   ● Store message in Firestore with timestamp

3. Get Messages
   ● GET /chat/:chatId/messages?limit=50
   ● Output: List of messages ordered by timestamp

4. Mark Message Read
   ● POST /chat/:chatId/message/:messageId/read
   ● Input: userId
   ● Update read receipt in Firestore

5. Update Last Seen Message
   ● POST /chat/:chatId/lastseen
   ● Input: userId, messageId
   ● Update last seen message per user in Firestore

6. List User Chats
   ● GET /user/:userId/chats
   ● Output: List of chats with member IDs from relational DB

   Bonus (Optional)
   ● Group chat creation & management
   ● Message edit/delet
