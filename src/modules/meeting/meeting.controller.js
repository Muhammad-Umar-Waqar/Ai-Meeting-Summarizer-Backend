import bcrypt from 'bcryptjs';
import Meeting from '../../models/meeting.model.js';
import { generateMeetingCode } from '../../utils/codeGenerator.js';

export const createInstantMeeting = async (req, res) => {
  try {
    let code;
    let exists = true;
    while (exists) {
      code = generateMeetingCode();
      const found = await Meeting.findOne({ code });
      if (!found) exists = false;
    }

    const meeting = await Meeting.create({
      code,
      title: req.body.title?.trim() || 'Instant Meeting',
      host: req.user._id,
      hostName: req.user.name,
      type: 'instant',
      participants: [
        {
          userId: req.user._id,
          name: req.user.name,
          role: 'host',
          joinedAt: new Date(),
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: 'Instant meeting created successfully',
      meeting: {
        id: meeting._id,
        code: meeting.code,
        title: meeting.title,
        hostName: meeting.hostName,
        type: meeting.type,
        settings: meeting.settings,
        status: meeting.status,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create instant meeting',
      error: error.message,
    });
  }
};

export const scheduleMeeting = async (req, res) => {
  try {
    const { title, scheduledStartTime, passcode, waitingRoomEnabled } = req.body;

    let code;
    let exists = true;
    while (exists) {
      code = generateMeetingCode();
      const found = await Meeting.findOne({ code });
      if (!found) exists = false;
    }

    let hashedPasscode = null;
    if (passcode && passcode.trim().length > 0) {
      const salt = await bcrypt.genSalt(10);
      hashedPasscode = await bcrypt.hash(passcode.trim(), salt);
    }

    const meeting = await Meeting.create({
      code,
      title: title?.trim() || 'Scheduled Meeting',
      host: req.user._id,
      hostName: req.user.name,
      type: 'scheduled',
      scheduledStartTime: scheduledStartTime ? new Date(scheduledStartTime) : null,
      passcode: hashedPasscode,
      settings: {
        waitingRoomEnabled: Boolean(waitingRoomEnabled),
        chatEnabled: true,
        screenShareEnabled: true,
        isLocked: false,
      },
      participants: [
        {
          userId: req.user._id,
          name: req.user.name,
          role: 'host',
          joinedAt: new Date(),
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: 'Meeting scheduled successfully',
      meeting: {
        id: meeting._id,
        code: meeting.code,
        title: meeting.title,
        hostName: meeting.hostName,
        type: meeting.type,
        scheduledStartTime: meeting.scheduledStartTime,
        hasPasscode: Boolean(hashedPasscode),
        settings: meeting.settings,
        status: meeting.status,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to schedule meeting',
      error: error.message,
    });
  }
};

export const getMeetingInfo = async (req, res) => {
  try {
    const cleanCode = req.params.code?.toLowerCase().trim();
    const meeting = await Meeting.findOne({ code: cleanCode });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found. Please verify the meeting code or link.',
      });
    }

    const isHost = req.user ? req.user._id.equals(meeting.host) : false;

    return res.status(200).json({
      success: true,
      meeting: {
        id: meeting._id,
        code: meeting.code,
        title: meeting.title,
        hostName: meeting.hostName,
        hostId: meeting.host,
        isHost,
        type: meeting.type,
        scheduledStartTime: meeting.scheduledStartTime,
        requiresPasscode: Boolean(meeting.passcode),
        settings: meeting.settings,
        status: meeting.status,
        createdAt: meeting.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve meeting details',
      error: error.message,
    });
  }
};

export const verifyMeetingPasscode = async (req, res) => {
  try {
    const cleanCode = req.params.code?.toLowerCase().trim();
    const { passcode } = req.body;

    const meeting = await Meeting.findOne({ code: cleanCode });
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found',
      });
    }

    if (!meeting.passcode) {
      return res.status(200).json({
        success: true,
        valid: true,
        message: 'No passcode required for this meeting',
      });
    }

    if (!passcode) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Passcode is required to join this meeting',
      });
    }

    const isMatch = await bcrypt.compare(passcode.trim(), meeting.passcode);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        valid: false,
        message: 'Incorrect meeting passcode. Please try again.',
      });
    }

    return res.status(200).json({
      success: true,
      valid: true,
      message: 'Passcode verified successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error verifying meeting passcode',
      error: error.message,
    });
  }
};

export const updateMeetingSettings = async (req, res) => {
  try {
    const cleanCode = req.params.code?.toLowerCase().trim();
    const meeting = await Meeting.findOne({ code: cleanCode });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found',
      });
    }

    if (!req.user._id.equals(meeting.host)) {
      return res.status(403).json({
        success: false,
        message: 'Only the meeting host can modify room settings',
      });
    }

    const { isLocked, waitingRoomEnabled, chatEnabled, screenShareEnabled } = req.body;

    if (typeof isLocked === 'boolean') meeting.settings.isLocked = isLocked;
    if (typeof waitingRoomEnabled === 'boolean') meeting.settings.waitingRoomEnabled = waitingRoomEnabled;
    if (typeof chatEnabled === 'boolean') meeting.settings.chatEnabled = chatEnabled;
    if (typeof screenShareEnabled === 'boolean') meeting.settings.screenShareEnabled = screenShareEnabled;

    await meeting.save();

    return res.status(200).json({
      success: true,
      message: 'Meeting settings updated',
      settings: meeting.settings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update meeting settings',
      error: error.message,
    });
  }
};
