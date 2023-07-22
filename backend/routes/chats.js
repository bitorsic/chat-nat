const express = require('express');
const router = express.Router();
const auth = require('../helpers/auth');
const { users, chats } = require('../models');

router.post('/:username', auth, async (req, res) => {
	try {
		const unameA = req.user.username;
		const unameB = req.params.username;

		const userB = await users.findById(unameB).lean();
		if (!userB) throw 404;

		let chat; let message;
		if (!(unameA in userB.chats)) { // No chat initiated before, initiating now
			chat = await chats.create({ messages: [] });

			// Create a new object under the users' chats as { username: chatId }
			await users.findByIdAndUpdate(unameB, { [`chats.${unameA}`]: chat._id }, { new: true });

			if (unameA != unameB) { // No need to add again if message is to self
				await users.findByIdAndUpdate(unameA, { [`chats.${unameB}`]: chat._id }, { new: true });
			}
		} else chat = await chats.findById(userB.chats[unameA]);

		// // Let's create a messageObj with 'from' and 'content', as a string
		// const messageObj = JSON.stringify({ from: unameA, content: req.body.message, at: new Date() });

		// // Compute the shared key
		// const sharedKey = ecdhCompute(req.headers.priv, userB.pub);

		// // Now use this shared key to encrypt the messageObj
		// const encMessage = aesEncrypt(messageObj, sharedKey);

		// Upload this encrypted message to the database
		chat.messages.push(req.body.message); await chat.save();

		if (unameA != unameB) message = "Message sent to " + unameB;
		else message = "Note taken";

		res.status(200).send({ message });
	} catch (e) {
		let code = 500, message = e.message;
		if (e == 404) { code = e, message = "User not found" }
		res.status(code).send({ message });
	}
});

router.get('/:username', auth, async (req, res) => {
	try {
		const unameA = req.user.username;
		const unameB = req.params.username;

		const userB = await users.findById(unameB, 'pub chats').lean();
		if (!userB) throw 404;

		// Check if chat with user exists
		if (!(unameA in userB.chats)) throw 409;

		// Get the _id of chat, set the userB's public key to a variable
		const chatId = userB.chats[unameA]; const pub = userB.pub;
		
		// // Compute the shared key
		// const sharedKey = ecdhCompute(req.headers.priv, userB.pub);

		let chat = await chats.findById(chatId).lean();
		chat = chat.messages.reverse(); // so the most recent appears at the top

		// for (let i = 0; i < chat.length; i++) {
		// 	// Decrypt the content
		// 	chat[i] = aesDecrypt(chat[i], sharedKey);

		// 	// Parse the JSON
		// 	chat[i] = JSON.parse(chat[i]);

		// 	// If the chat is with self, remove the from field
		// 	if (unameA == unameB) delete chat[i].from;
		// 	// Or if the message was sent by the logged in user, replace the from field with "You"
		// 	else if (chat[i].from === unameA) chat[i].from = "You";
		// }

		res.status(200).send({ pub, chat });
	} catch (e) {
		let code = 500, message = e.message;
		if (e == 404) { code = e, message = "User not found" }
		if (e == 409) {
			code = e;
			if (req.user.username != req.params.username) {
				message = "No chat with " + req.params.username + " found"
			} else message = "No notes found"
		}
		res.status(code).send(message);
	}
});

router.get('/', auth, async (req, res) => {
	try {
		const unameA = req.user.username;
		const userA = await users.findById(unameA).lean();
		if (Object.keys(userA.chats).length === 0) throw 404;

		// Convert the object to array
		let chatList = Object.entries(userA.chats);

		for (let i = 0; i < chatList.length; i++) {
			// The username of the other user is at 0th index of each subarray
			const unameB = chatList[i][0];

			// Id of chat with userB is at 1st index of each subarray
			const chatId = chatList[i][1];

			// Get the public key of the userB
			const { pub } = await users.findById(unameB, 'pub').lean();
			
			// Get the last chat with the chatId
			let chat = await chats.findById(chatId, { messages: { $slice: -1 }, updatedAt: 1 }).lean();

			// Set key-values to the chat object
			chat.pub = pub;
			chat.message = chat.messages[0];
			chat.at = chat.updatedAt;
			delete chat.messages; delete chat.updatedAt; delete chat._id;

			// // Compute the shared key with the userB using their public key
			// const sharedKey = ecdhCompute(req.headers.priv, userB.pub);

			// // Decrypt the message using the shared key
			// chat = aesDecrypt(chat.messages[0], sharedKey);

			// // Parse the JSON
			// chat = JSON.parse(chat);

			// If the chat is with self, remove the from field
			// if (unameA == unameB) delete chat.from;
			// // Or if the message was sent by the logged in user, replace the from field with "You"
			// else if (chat.from === unameA) chat.from = "You"

			// // Convert date to number for sorting later on
			// chat.at = new Date(chat.at).getTime();

			// Update the index at chatlist with an object like this
			chatList[i] = {
			// 	// If the chat is with self, replace the 'with' field with 'Notes'
				with: unameB,
				...chat
			};
		}

		// // Sort the chats in a descending order of the time of the last message
		// chatList.sort((a, b) => b.at - a.at);

		// // Convert the 'at' number back to date
		// for (let i = 0; i < chatList.length; i++) { chatList[i].at = new Date(chatList[i].at); }

		res.status(200).send(chatList);
	} catch (e) {
		let code = 500, message = e.message;
		if (e == 404) { code = e, message = "No chats found" }
		res.status(code).send(message);
	}
});


module.exports = router;