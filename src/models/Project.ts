import mongoose, { Schema, type Model } from "mongoose";

export type ProjectStatus =
  | "draft"
  | "generating"
  | "ready"
  | "error";

export interface IProjectFile {
  path: string;
  content: string;
}

export interface IProjectVersion {
  version: number;
  label: string;
  files: IProjectFile[];
  createdAt: Date;
}

export interface IProject {
  name: string;
  description: string;
  prompt: string;
  status: ProjectStatus;
  framework: "react";
  files: IProjectFile[];
  versions: IProjectVersion[];
  createdAt: Date;
  updatedAt: Date;
}

const projectFileSchema = new Schema<IProjectFile>(
  {
    path: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const projectVersionSchema = new Schema<IProjectVersion>(
  {
    version: {
      type: Number,
      required: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    files: {
      type: [projectFileSchema],
      default: [],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const projectSchema = new Schema<IProject>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    prompt: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    status: {
      type: String,
      enum: ["draft", "generating", "ready", "error"],
      default: "draft",
    },

    framework: {
      type: String,
      enum: ["react"],
      default: "react",
    },

    files: {
      type: [projectFileSchema],
      default: [],
    },

    versions: {
      type: [projectVersionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const Project: Model<IProject> =
  (mongoose.models.Project as Model<IProject>) ||
  mongoose.model<IProject>("Project", projectSchema);

export default Project;