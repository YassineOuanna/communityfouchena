const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const User = require("../models/User");
const Room = require("../models/Room");
const AuditLog = require("../models/AuditLog");
const BannedIdentifier = require("../models/BannedIdentifier");
const { getUserRestrictions } = require("../utils/restrictions");

// Tracking maps
// userSockets: userId -> Set<socketId> (tracks all open tabs/devices per user)
const userSockets = new Map();
// onlineUsers: socketId -> { userId, username, isAdmin, role, customStatus, avatar }
const onlineUsers = new Map();

// Helper to determine security hierarchy levels
function getRoleLevel(username = "", userDoc = null) {
  const u = (username || "").toLowerCase();
  if (["admin", "wana"].includes(u)) return 100; // Master Admin
  if (userDoc?.isAdmin || userDoc?.role === "admin") return 50; // Admin
  if (userDoc?.role === "moderator") return 30; // Moderator
  return 0; // Standard User
}

module.exports = (io) => {
  // ==========================================
  // HANDSHAKE: Authenticate & Enforce Ban Check
  // ==========================================
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded || !decoded.id) {
        return next(new Error("Invalid session token"));
      }

      const user = await User.findById(decoded.id);
      if (!user) {
        return next(new Error("User account not found"));
      }

      // 1. Check Central Restrictions: Auto-reconnect fails if banned!
      const restrictions = await getUserRestrictions(user._id);
      if (restrictions.isGlobalBanned) {
        return next(
          new Error(
            `BANNED: Your account is blacklisted from CommunityFouchena. Reason: ${
              restrictions.banReason || "Violation of rules"
            }`
          )
        );
      }

      // 2. Check session revocation (e.g. password reset / logout)
      if (decoded.tokenVersion !== undefined && user.tokenVersion !== decoded.tokenVersion) {
        return next(new Error("SESSION_REVOKED: Your session was invalidated. Please log in again."));
      }

      socket.user = {
        id: user._id.toString(),
        _id: user._id,
        username: user.username,
        isAdmin: !!user.isAdmin || ["admin", "wana"].includes(user.username.toLowerCase()),
        role: user.role,
        customStatus: user.customStatus,
        avatar: user.avatar,
      };
      next();
    } catch (err) {
      next(new Error("Invalid or expired session token"));
    }
  });

  io.on("connection", async (socket) => {
    const { id: userId, username, isAdmin, role, customStatus, avatar } = socket.user;

    // Track multi-tab sockets for this user
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    onlineUsers.set(socket.id, {
      userId,
      username,
      isAdmin,
      role,
      customStatus: customStatus || "Exploring the community ✨",
      avatar: avatar || null,
    });

    // Broadcast updated online list
    io.emit("online_users", getOnlineList());

    // Send initial restrictions state in background without blocking listener registration
    getUserRestrictions(userId, "global")
      .then((initialRestrictions) => {
        socket.emit("restrictions_state", initialRestrictions);
      })
      .catch(() => {});

    // ==========================================
    // 1. JOIN ROOM: Strict Ban & Kick Rejection
    // ==========================================
    socket.on("join_room", async ({ room }) => {
      if (!room || typeof room !== "string") return;
      const cleanRoom = room.slice(0, 50).trim();

      const restrictions = await getUserRestrictions(userId, cleanRoom);
      if (!restrictions.canAccessRoom) {
        socket.emit("kicked_from_room", {
          room: cleanRoom,
          message: restrictions.accessBlockReason,
          isRoomBanned: restrictions.isRoomBanned,
          isKicked: restrictions.isKicked,
        });
        return;
      }

      socket.rooms.forEach((r) => {
        if (r !== socket.id) socket.leave(r);
      });
      socket.join(cleanRoom);
      socket.currentRoom = cleanRoom;

      // Provide room-specific restrictions state
      socket.emit("restrictions_state", restrictions);
    });

    // ==========================================
    // 2. SEND MESSAGE: Central Mute & Ban Check
    // ==========================================
    socket.on("send_message", async ({ room, content, replyTo, attachment }) => {
      const hasContent = content && typeof content === "string" && content.trim().length > 0;
      const hasAttachment = attachment && (attachment.url || attachment.data);
      if (!hasContent && !hasAttachment) return;

      if (!room || typeof room !== "string") return;
      const cleanRoom = room.slice(0, 50).trim();

      // ONE CENTRAL CHECK
      const restrictions = await getUserRestrictions(userId, cleanRoom);
      if (!restrictions.canSend) {
        socket.emit("muted_error", {
          error: "muted",
          reason: restrictions.sendBlockReason,
          until: restrictions.effectiveMutedUntil,
          remainingSeconds: restrictions.effectiveMuteRemainingSeconds,
          message: `You are restricted from sending messages: ${restrictions.sendBlockReason}`,
        });
        return; // REJECTED! Message is NOT saved and NOT broadcast to anyone.
      }

      const cleanContent = hasContent ? content.trim().slice(0, 2000) : "";

      try {
        const msgPayload = {
          sender: userId,
          senderName: username,
          content: cleanContent,
          room: cleanRoom,
          seenBy: [],
        };

        if (replyTo && replyTo.messageId) {
          msgPayload.replyTo = {
            messageId: replyTo.messageId,
            senderName: replyTo.senderName || "",
            content: (replyTo.content || "").slice(0, 150),
          };
        }

        if (attachment) {
          msgPayload.attachment = {
            url: attachment.url || attachment.data,
            fileType: attachment.fileType || "file",
            fileName: attachment.fileName || "attachment",
            fileSize: attachment.fileSize || 0,
            duration: attachment.duration || null,
          };
        }

        const msg = await Message.create(msgPayload);

        // Broadcast to public channels so other users receive unread counts and desktop toasts
        const targetRoomDoc = await Room.findOne({ name: cleanRoom });
        if (!targetRoomDoc || !targetRoomDoc.isPrivate) {
          io.emit("new_message", msg);
        } else {
          io.to(cleanRoom).emit("new_message", msg);
        }
      } catch (err) {
        socket.emit("error", { message: "Failed to send message: " + err.message });
      }
    });

    // ==========================================
    // 3. SEND DM: Check Global Mute & Ban
    // ==========================================
    socket.on("send_dm", async ({ toUserId, toUsername, content, replyTo, attachment }) => {
      const hasContent = content && typeof content === "string" && content.trim().length > 0;
      const hasAttachment = attachment && (attachment.url || attachment.data);
      if (!hasContent && !hasAttachment) return;
      if (!toUserId) return;

      // ONE CENTRAL CHECK
      const restrictions = await getUserRestrictions(userId);
      if (!restrictions.canSend) {
        socket.emit("muted_error", {
          error: "muted",
          reason: restrictions.sendBlockReason,
          until: restrictions.effectiveMutedUntil,
          remainingSeconds: restrictions.effectiveMuteRemainingSeconds,
          message: `You cannot send DMs while restricted: ${restrictions.sendBlockReason}`,
        });
        return;
      }

      // Check target restrictions
      const targetRestrictions = await getUserRestrictions(toUserId);
      if (targetRestrictions.isGlobalBanned) {
        socket.emit("error", { message: "Cannot message a blacklisted user." });
        return;
      }

      const cleanContent = hasContent ? content.trim().slice(0, 2000) : "";

      try {
        const msgPayload = {
          sender: userId,
          senderName: username,
          content: cleanContent,
          room: `dm_${[userId, toUserId].sort().join("_")}`,
          dmTo: toUserId,
          seenBy: [],
        };

        if (replyTo && replyTo.messageId) {
          msgPayload.replyTo = {
            messageId: replyTo.messageId,
            senderName: replyTo.senderName || "",
            content: (replyTo.content || "").slice(0, 150),
          };
        }

        if (attachment) {
          msgPayload.attachment = {
            url: attachment.url || attachment.data,
            fileType: attachment.fileType || "file",
            fileName: attachment.fileName || "attachment",
            fileSize: attachment.fileSize || 0,
            duration: attachment.duration || null,
          };
        }

        const msg = await Message.create(msgPayload);

        // Deliver to target user sockets
        const targetSockets = userSockets.get(toUserId);
        if (targetSockets) {
          for (const sId of targetSockets) {
            io.to(sId).emit("new_dm", { ...msg.toObject(), fromUsername: username });
          }
        }
        socket.emit("new_dm", { ...msg.toObject(), fromUsername: username });
      } catch (err) {
        socket.emit("error", { message: "Failed to send DM: " + err.message });
      }
    });

    // ==========================================
    // 4. EDIT MESSAGE: Block if Muted or Unauthorized
    // ==========================================
    socket.on("edit_message", async ({ messageId, newContent, room }) => {
      if (!messageId || !newContent || typeof newContent !== "string") return;

      const restrictions = await getUserRestrictions(userId, room);
      if (restrictions.isMuted || !restrictions.canSend) {
        socket.emit("muted_error", { message: "Cannot edit messages while muted." });
        return;
      }

      try {
        const msg = await Message.findById(messageId);
        if (!msg) return;
        if (msg.sender.toString() !== userId) {
          socket.emit("error", { message: "You can only edit your own messages" });
          return;
        }
        msg.content = newContent.trim().slice(0, 2000);
        msg.isEdited = true;
        msg.editedAt = new Date();
        await msg.save();
        io.to(room).emit("message_edited", msg);
      } catch (err) {
        socket.emit("error", { message: "Failed to edit message" });
      }
    });

    // ==========================================
    // 5. DELETE MESSAGE
    // ==========================================
    socket.on("delete_message", async ({ messageId, room }) => {
      if (!messageId) return;
      try {
        const msg = await Message.findById(messageId);
        if (!msg) return;
        const canDelete = msg.sender.toString() === userId || isAdmin;
        if (!canDelete) {
          socket.emit("error", { message: "Permission denied" });
          return;
        }
        msg.isDeleted = true;
        msg.content = "This message was deleted.";
        msg.attachment = null;
        await msg.save();
        io.to(room).emit("message_deleted", { messageId, room, isDeleted: true });
      } catch (err) {
        socket.emit("error", { message: "Failed to delete message" });
      }
    });

    // ==========================================
    // 6. REACT TO MESSAGE: Block if Muted
    // ==========================================
    socket.on("react_message", async ({ messageId, emoji, room }) => {
      if (!messageId || !emoji) return;

      const restrictions = await getUserRestrictions(userId, room);
      if (restrictions.isMuted) {
        socket.emit("muted_error", { message: "Cannot react while muted." });
        return;
      }

      try {
        const msg = await Message.findById(messageId);
        if (!msg) return;
        if (!Array.isArray(msg.reactions)) msg.reactions = [];

        const existingReaction = msg.reactions.find((r) => r.emoji === emoji);
        if (existingReaction) {
          const userIdx = existingReaction.users.findIndex(
            (u) => u.username === username || u.userId === userId
          );
          if (userIdx > -1) {
            existingReaction.users.splice(userIdx, 1);
            if (existingReaction.users.length === 0) {
              msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji);
            }
          } else {
            existingReaction.users.push({ userId, username });
          }
        } else {
          msg.reactions.push({
            emoji,
            users: [{ userId, username }],
          });
        }

        await msg.save();
        io.to(room).emit("message_reacted", {
          messageId,
          reactions: msg.reactions,
          room,
        });
      } catch (err) {
        socket.emit("error", { message: "Failed to react to message" });
      }
    });

    // ==========================================
    // 7. TYPING INDICATOR: Block if Muted
    // ==========================================
    socket.on("typing", async ({ room, isTyping }) => {
      if (!room || typeof room !== "string") return;
      const restrictions = await getUserRestrictions(userId, room);
      if (restrictions.isMuted || !restrictions.canSend) return; // Silent block
      socket.to(room).emit("user_typing", { username, isTyping: !!isTyping });
    });

    // ==========================================
    // 8. REAL-TIME CALLS & WEBRTC SIGNALING
    // ==========================================
    socket.on("call_user", async ({ toUserId, toUsername, room, type, offer }) => {
      const restrictions = await getUserRestrictions(userId, room);
      if (restrictions.isMuted || !restrictions.canSend) {
        socket.emit("muted_error", { message: "Cannot start calls while restricted." });
        return;
      }

      let targetId = toUserId;
      if (!targetId && toUsername) {
        for (const [sId, u] of onlineUsers.entries()) {
          if (u.username && u.username.toLowerCase() === toUsername.toLowerCase()) {
            targetId = u.userId;
            break;
          }
        }
      }

      if (targetId) {
        const targetSockets = userSockets.get(targetId);
        if (targetSockets && targetSockets.size > 0) {
          for (const sId of targetSockets) {
            io.to(sId).emit("incoming_call", {
              fromUserId: userId,
              fromUsername: username,
              type: type || "voice",
              room,
              offer,
            });
          }
        } else {
          socket.emit("call_status", {
            action: "offline",
            message: `${toUsername || "User"} is currently offline.`,
          });
        }
      } else if (room) {
        socket.to(room).emit("incoming_call", {
          fromUserId: userId,
          fromUsername: username,
          type: type || "voice",
          room,
          offer,
        });
      }
    });

    socket.on("call_answer", ({ toUserId, answer, room }) => {
      if (toUserId) {
        const targetSockets = userSockets.get(toUserId);
        if (targetSockets) {
          for (const sId of targetSockets) {
            io.to(sId).emit("call_answered", {
              fromUserId: userId,
              fromUsername: username,
              answer,
              room,
            });
          }
        }
      } else if (room) {
        socket.to(room).emit("call_answered", {
          fromUserId: userId,
          fromUsername: username,
          answer,
          room,
        });
      }
    });

    socket.on("ice_candidate", ({ toUserId, candidate, room }) => {
      if (toUserId) {
        const targetSockets = userSockets.get(toUserId);
        if (targetSockets) {
          for (const sId of targetSockets) {
            io.to(sId).emit("ice_candidate", {
              fromUserId: userId,
              candidate,
            });
          }
        }
      } else if (room) {
        socket.to(room).emit("ice_candidate", {
          fromUserId: userId,
          candidate,
        });
      }
    });

    socket.on("call_response", ({ toUserId, action, reason, room }) => {
      if (toUserId) {
        const targetSockets = userSockets.get(toUserId);
        if (targetSockets) {
          for (const sId of targetSockets) {
            io.to(sId).emit("call_status", {
              fromUserId: userId,
              fromUsername: username,
              action,
              reason,
              room,
            });
          }
        }
      }
      if (room) {
        socket.to(room).emit("call_status", {
          fromUserId: userId,
          fromUsername: username,
          action,
          reason,
          room,
        });
      }
    });

    socket.on("end_call", ({ toUserId, room }) => {
      if (toUserId) {
        const targetSockets = userSockets.get(toUserId);
        if (targetSockets) {
          for (const sId of targetSockets) {
            io.to(sId).emit("call_ended", {
              fromUserId: userId,
              fromUsername: username,
              room,
            });
          }
        }
      }
      if (room) {
        socket.to(room).emit("call_ended", {
          fromUserId: userId,
          fromUsername: username,
          room,
        });
      }
    });

    // ==========================================
    // 9. MODERATION: Server-side Verification & Multi-tab Effect
    // ==========================================
    socket.on("moderate_user", async ({ targetUserId, targetUsername, action, room, durationMinutes, reason }) => {
      // 1. Verify Caller role directly from DB (NEVER trust client payload)
      let callerDoc = null;
      try {
        callerDoc = await User.findById(userId);
      } catch {}
      if (!callerDoc) {
        socket.emit("error", { message: "Authentication failed" });
        return;
      }

      // 2. Identify Target User
      let targetUser = null;
      if (targetUserId) {
        targetUser = await User.findById(targetUserId);
      }
      if (!targetUser && targetUsername) {
        targetUser = await User.findOne({ username: new RegExp(`^${targetUsername}$`, "i") });
      }
      if (!targetUser) {
        socket.emit("error", { message: "Target user not found" });
        return;
      }

      const effectiveTargetId = targetUser._id.toString();
      const effectiveTargetName = targetUser.username;

      // 3. Security Checks (Requirement H)
      // Cannot moderate yourself
      if (effectiveTargetId === userId) {
        socket.emit("error", { message: "You cannot perform moderation actions on yourself." });
        return;
      }

      const callerLevel = getRoleLevel(callerDoc.username, callerDoc);
      const targetLevel = getRoleLevel(targetUser.username, targetUser);

      // Check Room creator status
      let isRoomCreator = false;
      if (room && !room.startsWith("dm_")) {
        const rDoc = await Room.findOne({ name: room });
        if (rDoc && (rDoc.createdBy?.toString() === userId || rDoc.creator === callerDoc.username)) {
          isRoomCreator = true;
        }
      }

      // Master admin check
      if (targetLevel >= 100) {
        socket.emit("moderation_error", { message: "Cannot perform moderation actions on master administrators." });
        socket.emit("error", { message: "Cannot perform moderation actions on master administrators." });
        return;
      }

      // Hierarchy rule: Caller must outrank target
      if (callerLevel <= targetLevel) {
        socket.emit("moderation_error", { message: "Permission denied: Target user holds an equal or higher role." });
        socket.emit("error", { message: "Permission denied: Target user holds an equal or higher role." });
        return;
      }

      // Global actions require at least Admin role (level 50+)
      const isGlobalAction = ["ban_global", "unban_global", "mute_global", "unmute_global"].includes(action);
      if (isGlobalAction && callerLevel < 50) {
        socket.emit("moderation_error", { message: "Global moderation requires administrator privileges." });
        socket.emit("error", { message: "Global moderation requires administrator privileges." });
        return;
      }

      // Room actions require room creator or admin
      if (!isGlobalAction && callerLevel < 50 && !isRoomCreator) {
        socket.emit("moderation_error", { message: "You do not have moderator permissions for this room." });
        socket.emit("error", { message: "You do not have moderator permissions for this room." });
        return;
      }

      const cleanReason = reason && typeof reason === "string" ? reason.trim().slice(0, 200) : "Violating community standards";
      const targetSocketIds = userSockets.get(effectiveTargetId) || new Set();

      try {
        // ------------------------------------------
        // A. KICK FROM ROOM (All open tabs/devices)
        // ------------------------------------------
        if (action === "kick_room" && room) {
          await Room.findOneAndUpdate(
            { name: room },
            {
              $setOnInsert: { description: "Community Channel", createdBy: callerDoc._id },
              $addToSet: {
                kickedUsers: {
                  userId: effectiveTargetId,
                  username: effectiveTargetName,
                  reason: cleanReason,
                  kickedAt: new Date(),
                },
              },
            },
            { upsert: true }
          );

          // Remove ALL tabs/devices of target from socket channel
          for (const sId of targetSocketIds) {
            const tSock = io.sockets.sockets.get(sId);
            if (tSock) {
              tSock.leave(room);
              tSock.emit("kicked_from_room", {
                room,
                message: `You were removed from #${room} by @${callerDoc.username}. Reason: ${cleanReason}`,
                reason: cleanReason,
              });
            }
          }

          // Broadcast system message in room (Requirement G)
          io.to(room).emit("moderation_alert", {
            room,
            message: `@${effectiveTargetName} was removed from #${room} by @${callerDoc.username}. Reason: ${cleanReason}`,
          });

          socket.emit("moderation_success", { message: `@${effectiveTargetName} kicked from #${room}.` });
        }

        // ------------------------------------------
        // B. MUTE IN ROOM (With Expiry)
        // ------------------------------------------
        else if (action === "mute_room" && room) {
          const until = durationMinutes ? new Date(Date.now() + durationMinutes * 60 * 1000) : null;

          await Room.findOneAndUpdate(
            { name: room },
            {
              $setOnInsert: { description: "Community Channel", createdBy: callerDoc._id },
              $pull: { mutedUsers: { username: effectiveTargetName } }
            },
            { upsert: true }
          );
          await Room.findOneAndUpdate(
            { name: room },
            {
              $push: {
                mutedUsers: {
                  userId: effectiveTargetId,
                  username: effectiveTargetName,
                  reason: cleanReason,
                  until,
                  mutedAt: new Date(),
                },
              },
            },
            { upsert: true }
          );

          const durStr = durationMinutes ? `${durationMinutes} minute(s)` : "permanently";
          // Instant live effect on all open tabs (Requirement F)
          for (const sId of targetSocketIds) {
            io.to(sId).emit("user_muted", {
              room,
              until,
              durationMinutes,
              reason: cleanReason,
              message: `You have been muted in #${room} for ${durStr} by @${callerDoc.username}. Reason: ${cleanReason}`,
            });
          }

          // System message to room (Requirement G)
          io.to(room).emit("moderation_alert", {
            room,
            message: `@${effectiveTargetName} was muted in #${room} for ${durStr} by @${callerDoc.username}. Reason: ${cleanReason}`,
          });

          socket.emit("moderation_success", { message: `@${effectiveTargetName} muted in #${room} (${durStr}).` });
        }

        // ------------------------------------------
        // C. UNMUTE IN ROOM
        // ------------------------------------------
        else if (action === "unmute_room" && room) {
          await Room.findOneAndUpdate(
            { name: room },
            { $pull: { mutedUsers: { username: effectiveTargetName } } }
          );

          for (const sId of targetSocketIds) {
            io.to(sId).emit("user_unmuted", {
              room,
              message: `You have been unmuted in #${room}.`,
            });
          }

          io.to(room).emit("moderation_alert", {
            room,
            message: `@${effectiveTargetName} was unmuted in #${room} by @${callerDoc.username}.`,
          });

          socket.emit("moderation_success", { message: `@${effectiveTargetName} unmuted in #${room}.` });
        }

        // ------------------------------------------
        // D. BAN FROM ROOM
        // ------------------------------------------
        else if (action === "ban_room" && room) {
          await Room.findOneAndUpdate(
            { name: room },
            {
              $setOnInsert: { description: "Community Channel", createdBy: callerDoc._id },
              $addToSet: {
                bannedUsers: {
                  userId: effectiveTargetId,
                  username: effectiveTargetName,
                  reason: cleanReason,
                  bannedAt: new Date(),
                },
              },
            },
            { upsert: true }
          );

          for (const sId of targetSocketIds) {
            const tSock = io.sockets.sockets.get(sId);
            if (tSock) {
              tSock.leave(room);
              tSock.emit("kicked_from_room", {
                room,
                message: `You have been blacklisted from #${room}. Reason: ${cleanReason}`,
                isRoomBanned: true,
              });
            }
          }

          io.to(room).emit("moderation_alert", {
            room,
            message: `@${effectiveTargetName} has been blacklisted from #${room} by @${callerDoc.username}.`,
          });

          socket.emit("moderation_success", { message: `@${effectiveTargetName} blacklisted from #${room}.` });
        }

        // ------------------------------------------
        // E. UNBAN FROM ROOM
        // ------------------------------------------
        else if (action === "unban_room" && room) {
          await Room.findOneAndUpdate(
            { name: room },
            {
              $pull: {
                bannedUsers: { username: effectiveTargetName },
                kickedUsers: { username: effectiveTargetName },
              },
            }
          );
          socket.emit("moderation_success", { message: `Blacklist lifted for @${effectiveTargetName} in #${room}.` });
        }

        // ------------------------------------------
        // F. GLOBAL BAN: Disconnect all tabs, invalidate tokens, evasion protection
        // ------------------------------------------
        else if (action === "ban_global") {
          targetUser.isBanned = true;
          targetUser.banReason = cleanReason;
          targetUser.bannedAt = new Date();
          // Invalidate all existing auth tokens immediately
          targetUser.tokenVersion = (targetUser.tokenVersion || 0) + 1;
          await targetUser.save();

          // Store in BannedIdentifier for evasion protection
          try {
            await BannedIdentifier.findOneAndUpdate(
              { type: "username", value: effectiveTargetName.toLowerCase() },
              { type: "username", value: effectiveTargetName.toLowerCase(), reason: cleanReason, bannedAt: new Date() },
              { upsert: true }
            );
            if (targetUser.email) {
              await BannedIdentifier.findOneAndUpdate(
                { type: "email", value: targetUser.email.toLowerCase() },
                { type: "email", value: targetUser.email.toLowerCase(), reason: cleanReason, bannedAt: new Date() },
                { upsert: true }
              );
            }
          } catch {}

          // Immediately disconnect ALL open tabs and devices (Requirement D)
          for (const sId of targetSocketIds) {
            const tSock = io.sockets.sockets.get(sId);
            if (tSock) {
              tSock.emit("banned", {
                reason: cleanReason,
                message: `Your account has been permanently blacklisted from CommunityFouchena. Reason: ${cleanReason}`,
              });
              tSock.disconnect(true);
            }
            onlineUsers.delete(sId);
          }
          userSockets.delete(effectiveTargetId);

          // Broadcast updated online list immediately (Requirement G)
          io.emit("online_users", getOnlineList());
          io.emit("moderation_alert", {
            message: `@${effectiveTargetName} has been permanently blacklisted from the community.`,
          });

          socket.emit("moderation_success", { message: `@${effectiveTargetName} blacklisted globally.` });
        }

        // ------------------------------------------
        // G. UNBAN GLOBAL
        // ------------------------------------------
        else if (action === "unban_global") {
          targetUser.isBanned = false;
          targetUser.banReason = "";
          await targetUser.save();

          await BannedIdentifier.deleteMany({
            $or: [
              { type: "username", value: effectiveTargetName.toLowerCase() },
              ...(targetUser.email ? [{ type: "email", value: targetUser.email.toLowerCase() }] : []),
            ],
          });

          socket.emit("moderation_success", { message: `Global blacklist lifted for @${effectiveTargetName}.` });
        }

        // 4. Audit Log (Requirement H)
        await AuditLog.create({
          moderatorId: callerDoc._id,
          moderatorName: callerDoc.username,
          targetUserId: targetUser._id,
          targetUsername: effectiveTargetName,
          action,
          room: room || null,
          reason: cleanReason,
          durationMinutes: durationMinutes || null,
          ip: socket.handshake.address || "",
        });
      } catch (err) {
        socket.emit("error", { message: "Moderation action failed: " + err.message });
      }
    });

    // Mark messages as seen
    socket.on("mark_seen", async ({ room }) => {
      if (!room || typeof room !== "string") return;
      try {
        await Message.updateMany(
          {
            room,
            sender: { $ne: userId },
            "seenBy.username": { $ne: username },
          },
          {
            $push: { seenBy: { userId, username, seenAt: new Date() } },
            $set: { seen: true },
          }
        );
        io.to(room).emit("messages_seen", { room, userId, username });
      } catch (err) {
        console.error("mark_seen error:", err);
      }
    });

    // Disconnect
    socket.on("disconnect", () => {
      onlineUsers.delete(socket.id);
      const userSocketsSet = userSockets.get(userId);
      if (userSocketsSet) {
        userSocketsSet.delete(socket.id);
        if (userSocketsSet.size === 0) {
          userSockets.delete(userId);
        }
      }
      io.emit("online_users", getOnlineList());
    });
  });

  function getOnlineList() {
    const seen = new Set();
    const list = [];
    for (const { userId, username, isAdmin, role, customStatus, avatar } of onlineUsers.values()) {
      if (!seen.has(userId)) {
        seen.add(userId);
        list.push({
          userId,
          username,
          isAdmin: !!isAdmin,
          role: role || "user",
          customStatus: customStatus || "Exploring the community ✨",
          avatar: avatar || null,
        });
      }
    }
    return list;
  }
};
