require("dotenv").config();
const mongoose = require("mongoose");

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/promoteUser.js user@example.com");
  process.exit(1);
}

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    const User = require("../src/models/User");
    const res = await User.updateOne({ email }, { $set: { role: "admin" } });
    console.log("Update result:", res);
    process.exit(0);
  } catch (err) {
    console.error("Error promoting user:", err);
    process.exit(2);
  }
};

run();
