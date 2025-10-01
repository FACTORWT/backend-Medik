let mongoose = require("mongoose");
let router = require("express").Router();
let User = mongoose.model("User");
let ChatGroup = mongoose.model("ChatGroup");
let Message = mongoose.model("Message");
let auth = require("../auth");

let {
  OkResponse,
  BadRequestResponse,
  NotFoundResponse,
  UnauthorizedResponse,
} = require("express-http-response");
const { emitEvent } = require("../../utilities/realTime");
const { sendPushNotification } = require("../../utilities/notification");

const getChatGroupById = async (req, res, next, _id) => {
  try {
    const chatGroup = await ChatGroup.findOne({ _id });
    if (!chatGroup) {
      return next(new BadRequestResponse("ChatGroup not found!", 423));
    }
    req.chatGroup = chatGroup;
    next();
  } catch (error) {
    return next(new BadRequestResponse(error));
  }
};

router.param("chatGroupId", getChatGroupById);

// Create a chat group
router.post(
  "/create-chat-group",
  auth.required,
  auth.user,
  async (req, res, next) => {
    try {
      if (!req.body) {
        return next(new BadRequestResponse("Missing required parameter.", 422));
      }

      const { doctorId, lastMessageId, patientId } = req.body;

      let query = {
        $and: [{ patient: patientId }, { doctor: doctorId }],
      };

      let chatGroup = await ChatGroup.findOne(query);

      if (!chatGroup) {
        chatGroup = new ChatGroup({
          patient: patientId,
          doctor: doctorId,
        });

        if (lastMessageId) query.lastMessage = lastMessageId;

        chatGroup = await chatGroup.save();
      }

      return next(new OkResponse(chatGroup));
    } catch (error) {
      return next(new BadRequestResponse(error));
    }
  }
);

// Get all chat groups
router.get(
  "/all-chat-groups",
  auth.required,
  auth.user,
  async (req, res, next) => {
    try {
      let query = {
        $or: [
          { patient: req.user._id, deletedBy: { $ne: req.user._id } },
          { doctor: req.user._id, deletedBy: { $ne: req.user._id } },
        ],
      };

      const options = {
        sort: {
          updatedAt: -1,
        },
      };

      const chatGroups = await ChatGroup.find(query, null, options);
      return next(new OkResponse(chatGroups));
    } catch (error) {
      return next(new BadRequestResponse(error));
    }
  }
);

// Create a new message

router.post("/", auth.required, auth.user, async (req, res, next) => {
  try {
    if (!req.body) {
      return next(new BadRequestResponse("Missing required parameter.", 422));
    }

    const { chatId, sender, message, receiver } = req.body;

    const chat = await ChatGroup.findOne({ _id: chatId });
    if (!chat) {
      return next(new BadRequestResponse("Chat group not found.", 404));
    }

    if (chat.deletedBy && chat.deletedBy.includes(receiver)) {
      // Remove the receiver from the deletedBy array
      chat.deletedBy = chat.deletedBy.filter(
        (id) => id.toString() !== receiver.toString()
      );
      if (chat.deletedBy.length === 0) {
        chat.isDeleted = false;
        chat.deletedAt = null;
      }

      await chat.save();
    }

    // If the chat wasn't deleted by the receiver, create the message as usual
    const newMessage = new Message({
      chatGroup: chatId,
      sender: sender,
      text: message,
      receiver: receiver,
    });

    // Save the new message
    const messageDoc = await newMessage.save();

    // Update the last message
    chat.lastMessage = messageDoc._id;
    await chat.save();

    emitEvent(`${receiver}-new-message`, messageDoc);
    await sendPushNotification("Message", message, receiver);

    return next(new OkResponse(messageDoc));
  } catch (error) {
    return next(new BadRequestResponse(error));
  }
});

router.put("/:messageId/update", auth.required, async (req, res, next) => {
  try {
    // Find the message by its ID
    const message = await Message.findById(req.params.messageId);

    // Check if the message exists
    if (!message) {
      return next(new NotFoundResponse("Message not found", 404));
    }

    // Update the message text
    const { text } = req.body;
    if (!text || !text.trim()) {
      return next(new BadRequestResponse("Message text cannot be empty", 400));
    }

    message.text = text.trim();
    await message.save();
    emitEvent(`${message.receiver._id}-message-updated`, message);

    // Send a success response
    return next(new OkResponse("Message updated successfully.", message));
  } catch (error) {
    // Handle any errors during the process
    return next(new BadRequestResponse(error.message, 500));
  }
});
 

// Create a new message
router.post("/send", auth.required, auth.user, async (req, res, next) => {
  try {
    if (!req.body) {
      return next(new BadRequestResponse("Missing required parameter.", 422));
    }

    const { chatId, sender, message, receiver } = req.body;

    const newMessage = new Message({
      chatGroup: chatId,
      sender: sender,
      text: message,
      receiver: receiver,
    });

    const messageDoc = await newMessage.save();

    const chat = await ChatGroup.findOne({ _id: chatId });
    chat.lastMessage = messageDoc._id;
    await chat.save();

    emitEvent(`${chatId}-new-message`, messageDoc);
    await sendPushNotification("Message", message, receiver);

    return next(new OkResponse(messageDoc));
  } catch (error) {
    return next(new BadRequestResponse(error));
  }
});

// Get messages by chatGroup ID
router.get(
  "/by-chatGroup/:chatGroupId",
  auth.required,
  auth.user,
  async (req, res, next) => {
    try {
      const { chatGroupId } = req.params;
      const user = req.user; // The user making the request

      // Fetch the chat group
      const chatGroup = await ChatGroup.findById(chatGroupId);
      if (!chatGroup) {
        return next(new BadRequestResponse("Chat Group not found"));
      }

     

      if (chatGroup.deletedBy && chatGroup.deletedBy.includes(user._id)) {
        const messagesAfterDeletion = await Message.find({
          chatGroup: chatGroupId,
          createdAt: { $gt: chatGroup.deletedAt }, // Only messages after deletion time
        }).sort({ createdAt: 1 });

        return next(new OkResponse(messagesAfterDeletion));
      }

      // If the chat was not deleted by the current user, fetch all messages
      const allMessages = await Message.find({
        chatGroup: chatGroupId,
      }).sort({ createdAt: 1 });

      return next(new OkResponse(allMessages));
    } catch (error) {
      return next(new BadRequestResponse(error));
    }
  }
);

router.get("/random", auth.required, auth.user, async (req, res, next) => {
  try {
    let query = { receiver: req.user._id };

    const options = {
      limit: 10,
      sort: {
        createdAt: -1,
      },
    };

    const messages = await Message.find(query, null, options);
    return next(new OkResponse(messages));
  } catch (error) {
    return next(new BadRequestResponse(error));
  }
});

router.delete(
  "/chatGroup/:chatGroupId/delete",
  auth.required,
  auth.user,
  async (req, res, next) => {
    try {
      // Find the chat group by ID
      const chatGroup = await ChatGroup.findById(req.params.chatGroupId);
      if (!chatGroup) {
        return next(new NotFoundResponse("Chat group not found!", 404));
      }

      // Check if the user has already deleted the chat
      if (chatGroup.deletedBy.includes(req.user._id)) {
        return next(
          new BadRequestResponse(
            "Chat has already been deleted by this user.",
            400
          )
        );
      }

      // Add the user to the deletedBy array
      chatGroup.deletedBy.push(req.user._id);
      chatGroup.deletedAt = new Date();
      chatGroup.isDeleted = chatGroup.deletedBy.length > 0; // Chat is deleted if any user has deleted

      // Save the updated chat group
      await chatGroup.save();

      // Return success response
      return next(new OkResponse("Chat group deleted successfully."));
    } catch (error) {
      return next(new BadRequestResponse(error.message, 500));
    }
  }
);

router.delete("/:messageId/delete", auth.required, async (req, res, next) => {
  try {
    // Find the message by its ID
    const message = await Message.findById(req.params.messageId);

    // Check if the message exists
    if (!message) {
      return next(new NotFoundResponse("Message not found", 404));
    }

    // Delete the message from the database
    await message.remove();

    // Get the chat group of the deleted message
    const chatGroup = await ChatGroup.findById(message.chatGroup);

    // Find the latest non-deleted message (if any)
    const lastMessage = await Message.findOne({
      chatGroup: message.chatGroup,
      _id: { $ne: message._id },
    }).sort({ createdAt: -1 }); // Sorting to get the most recent message

    // Update the lastMessage in the ChatGroup
    chatGroup.lastMessage = lastMessage ? lastMessage._id : null;

    // Save the updated chat group
    await chatGroup.save();

    // Emit event for message deletion
    emitEvent(`${message.receiver._id}-deleted-message`, message);

    // Send a success response
    return next(new OkResponse("Message deleted successfully."));
  } catch (error) {
    return next(new BadRequestResponse(error.message, 500));
  }
});


module.exports = router;
