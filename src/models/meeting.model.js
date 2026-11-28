import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['host', 'participant'],
      default: 'participant',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    leftAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const transcriptSchema = new mongoose.Schema(
  {
    speakerName: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      default: null,
    },
    text: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const meetingSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Meeting code is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    title: {
      type: String,
      default: 'Live Meeting',
      trim: true,
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    hostName: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['instant', 'scheduled'],
      default: 'instant',
    },
    scheduledStartTime: {
      type: Date,
      default: null,
    },
    passcode: {
      type: String,
      default: null,
    },
    settings: {
      isLocked: {
        type: Boolean,
        default: false,
      },
      waitingRoomEnabled: {
        type: Boolean,
        default: false,
      },
      chatEnabled: {
        type: Boolean,
        default: true,
      },
      screenShareEnabled: {
        type: Boolean,
        default: true,
      },
    },
    status: {
      type: String,
      enum: ['waiting', 'active', 'ended'],
      default: 'active',
    },
    participants: [participantSchema],
    transcripts: [transcriptSchema],
  },
  {
    timestamps: true,
  }
);

export const Meeting = mongoose.model('Meeting', meetingSchema);
export default Meeting;
