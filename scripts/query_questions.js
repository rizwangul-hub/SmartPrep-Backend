const mongoose = require("mongoose");
const Question = require("../src/models/Question");

const MONGO_URL = "mongodb+srv://rizwangul535_db_user:LYGTNebZbKQQ0csd@cluster0.wun93hu.mongodb.net/SmartPrepAI";

async function main() {
  await mongoose.connect(MONGO_URL);
  console.log("Connected to MongoDB!");

  const examNames = await Question.distinct("examName");
  console.log("Distinct examNames in Question collection:", examNames);

  const subjects = await Question.distinct("subject");
  console.log("Distinct subjects in Question collection:", subjects);

  const count = await Question.countDocuments();
  console.log("Total questions in collection:", count);

  // Group by examName
  const groupByExam = await Question.aggregate([
    { $group: { _id: "$examName", count: { $sum: 1 } } }
  ]);
  console.log("Questions grouped by examName:", JSON.stringify(groupByExam, null, 2));

  // Group by subject
  const groupBySubject = await Question.aggregate([
    { $group: { _id: "$subject", count: { $sum: 1 } } }
  ]);
  console.log("Questions grouped by subject:", JSON.stringify(groupBySubject, null, 2));

  await mongoose.disconnect();
}

main().catch(console.error);
