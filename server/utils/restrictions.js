const User = require("../models/User");
const Room = require("../models/Room");

/**
 * ONE CENTRAL RESTRICTION CHECKER
 * Checks active mute, room ban, global ban, and kick status with real-time expiry evaluation.
 * Returns a complete restrictions state object.
 *
 * @param {string|mongoose.Types.ObjectId} userId - ID of the user to check
 * @param {string} [roomId] - Name of the channel/room (optional)
 * @returns {Promise<Object>} Restrictions summary
 */
async function getUserRestrictions(userId, roomId = null) {
  const now = new Date();
  const result = {
    userId: String(userId || ""),
    username: "",
    isGlobalBanned: false,
    banReason: "",
    bannedAt: null,
    bannedUntil: null,

    isGlobalMuted: false,
    globalMuteReason: "",
    globalMutedUntil: null,
    globalMuteRemainingSeconds: 0,

    isRoomBanned: false,
    roomBanReason: "",
    roomBannedAt: null,
    roomBannedUntil: null,

    isKicked: false,
    kickReason: "",
    kickedAt: null,

    isRoomMuted: false,
    roomMuteReason: "",
    roomMutedUntil: null,
    roomMuteRemainingSeconds: 0,

    isBanned: false,
    isMuted: false,
    effectiveMuteReason: "",
    effectiveMutedUntil: null,
    effectiveMuteRemainingSeconds: 0,

    canAccessRoom: true,
    accessBlockReason: "",

    canSend: true,
    sendBlockReason: "",
  };

  if (!userId) {
    result.canAccessRoom = false;
    result.canSend = false;
    result.accessBlockReason = "User not identified";
    result.sendBlockReason = "User not identified";
    return result;
  }

  // 1. Check User document in Database
  let user = null;
  try {
    user = await User.findById(userId);
  } catch (err) {
    // In case invalid ObjectId or DB error
  }

  if (!user) {
    result.canAccessRoom = false;
    result.canSend = false;
    result.accessBlockReason = "User account not found";
    result.sendBlockReason = "User account not found";
    return result;
  }

  result.username = user.username;

  // Global Ban Check with Expiry
  if (user.isBanned) {
    if (user.bannedUntil && new Date(user.bannedUntil) <= now) {
      // Ban has expired! Automatically lift
      user.isBanned = false;
      user.banReason = "";
      user.bannedUntil = null;
      await user.save();
    } else {
      result.isGlobalBanned = true;
      result.banReason = user.banReason || "Your account has been permanently blacklisted from the community.";
      result.bannedAt = user.bannedAt;
      result.bannedUntil = user.bannedUntil;
    }
  }

  // Global Mute Check with Expiry
  if (user.isMuted || user.mutedUntil) {
    if (user.mutedUntil && new Date(user.mutedUntil) <= now) {
      // Global mute expired!
      user.isMuted = false;
      user.mutedUntil = null;
      user.muteReason = "";
      await user.save();
    } else {
      result.isGlobalMuted = true;
      result.globalMuteReason = user.muteReason || "Globally muted by administrator";
      result.globalMutedUntil = user.mutedUntil;
      result.globalMuteRemainingSeconds = user.mutedUntil
        ? Math.ceil((new Date(user.mutedUntil).getTime() - now.getTime()) / 1000)
        : -1; // -1 means permanent
    }
  }

  // 2. Check Room-level restrictions if roomId is provided and not a DM
  const cleanRoom = roomId ? String(roomId).trim() : null;
  if (cleanRoom && !cleanRoom.startsWith("dm_")) {
    try {
      const roomDoc = await Room.findOne({ name: cleanRoom });
      if (roomDoc) {
        // Room Ban Check
        const banEntry = roomDoc.bannedUsers?.find(
          (u) =>
            (u.userId && String(u.userId) === String(userId)) ||
            (u.username && u.username.toLowerCase() === user.username.toLowerCase())
        );

        if (banEntry) {
          if (banEntry.until && new Date(banEntry.until) <= now) {
            // Expired room ban -> clean up
            await Room.updateOne(
              { name: cleanRoom },
              { $pull: { bannedUsers: { _id: banEntry._id } } }
            );
          } else {
            result.isRoomBanned = true;
            result.roomBanReason = banEntry.reason || `Blacklisted from #${cleanRoom}`;
            result.roomBannedAt = banEntry.bannedAt;
            result.roomBannedUntil = banEntry.until;
          }
        }

        // Room Kick Check
        const kickEntry = roomDoc.kickedUsers?.find(
          (u) =>
            (u.userId && String(u.userId) === String(userId)) ||
            (u.username && u.username.toLowerCase() === user.username.toLowerCase())
        );

        if (kickEntry) {
          result.isKicked = true;
          result.kickReason = kickEntry.reason || `Removed from #${cleanRoom}`;
          result.kickedAt = kickEntry.kickedAt;
        }

        // Room Mute Check
        const muteEntry = roomDoc.mutedUsers?.find(
          (u) =>
            (u.userId && String(u.userId) === String(userId)) ||
            (u.username && u.username.toLowerCase() === user.username.toLowerCase())
        );

        if (muteEntry) {
          if (muteEntry.until && new Date(muteEntry.until) <= now) {
            // Expired room mute -> clean up
            await Room.updateOne(
              { name: cleanRoom },
              { $pull: { mutedUsers: { _id: muteEntry._id } } }
            );
          } else {
            result.isRoomMuted = true;
            result.roomMuteReason = muteEntry.reason || `Muted in #${cleanRoom}`;
            result.roomMutedUntil = muteEntry.until;
            result.roomMuteRemainingSeconds = muteEntry.until
              ? Math.ceil((new Date(muteEntry.until).getTime() - now.getTime()) / 1000)
              : -1;
          }
        }
      }
    } catch (err) {
      console.error("Room restriction query error:", err);
    }
  }

  // 3. Compute Aggregated States
  result.isBanned = result.isGlobalBanned || result.isRoomBanned;
  result.isMuted = result.isGlobalMuted || result.isRoomMuted;

  if (result.isGlobalMuted) {
    result.effectiveMuteReason = result.globalMuteReason;
    result.effectiveMutedUntil = result.globalMutedUntil;
    result.effectiveMuteRemainingSeconds = result.globalMuteRemainingSeconds;
  } else if (result.isRoomMuted) {
    result.effectiveMuteReason = result.roomMuteReason;
    result.effectiveMutedUntil = result.roomMutedUntil;
    result.effectiveMuteRemainingSeconds = result.roomMuteRemainingSeconds;
  }

  // 4. Compute Permissions
  if (result.isGlobalBanned) {
    result.canAccessRoom = false;
    result.canSend = false;
    result.accessBlockReason = result.banReason;
    result.sendBlockReason = result.banReason;
  } else if (result.isRoomBanned) {
    result.canAccessRoom = false;
    result.canSend = false;
    result.accessBlockReason = result.roomBanReason;
    result.sendBlockReason = result.roomBanReason;
  } else if (result.isKicked) {
    result.canAccessRoom = false;
    result.canSend = false;
    result.accessBlockReason = result.kickReason;
    result.sendBlockReason = result.kickReason;
  } else if (result.isMuted) {
    result.canAccessRoom = true; // Can still read room if only muted
    result.canSend = false;
    result.sendBlockReason = result.effectiveMuteReason;
  } else {
    result.canAccessRoom = true;
    result.canSend = true;
  }

  return result;
}

module.exports = {
  getUserRestrictions,
};
