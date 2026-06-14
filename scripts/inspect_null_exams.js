const mongoose = require("mongoose");
const Question = require("../src/models/Question");

const MONGO_URL = "mongodb+srv://rizwangul535_db_user:LYGTNebZbKQQ0csd@cluster0.wun93hu.mongodb.net/SmartPrepAI";

async function main() {
  await mongoose.connect(MONGO_URL);
  console.log("Connected to MongoDB!");

  const nullExamQuestions = await Question.find({ examName: { $in: [null, ""] } }).limit(20).lean();
  console.log("Questions with null/empty examName:");
  nullExamQuestions.forEach(q => {
    console.log(`- Subject: ${q.subject}, Text: ${q.text.substring(0, 60)}`);
  });

  const pmaSample = await Question.find({ examName: "PMA" }).limit(5).lean();
  console.log("\nSample PMA Questions:");
  pmaSample.forEach(q => {
    console.log(`- Subject: ${q.subject}, Text: ${q.text.substring(0, 60)}`);
  });

  await mongoose.disconnect();
}

main().catch(console.error);
