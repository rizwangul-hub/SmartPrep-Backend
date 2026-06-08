require("dotenv").config();
const mongoose = require("mongoose");

const [email, newPassword] = process.argv.slice(2);
if (!email || !newPassword) {
  console.error(
    "Usage: node scripts/setPassword.js user@example.com newPassword",
  );
  process.exit(1);
}

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    const User = require("../src/models/User");
    const user = await User.findOne({ email });
    if (!user) {
      console.error("User not found:", email);
      process.exit(2);
    }

    user.password = newPassword;
    await user.save();
    console.log("Password updated for", email);
    process.exit(0);
  } catch (err) {
    console.error("Error setting password:", err);
    process.exit(3);
  }
};

run();
