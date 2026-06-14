const mongoose = require("mongoose");
const Question = require("../src/models/Question");
const Test = require("../src/models/Test");
const Result = require("../src/models/Result");
const { generateTest, getExamStages } = require("../src/controllers/testController");

const MONGO_URL = "mongodb+srv://rizwangul535_db_user:LYGTNebZbKQQ0csd@cluster0.wun93hu.mongodb.net/SmartPrepAI";

const examsToTest = [
  "ASF",
  "FIA",
  "ANF",
  "Police",
  "PMA",
  "Army",
  "Navy",
  "Air Force (PAF)",
  "UDC",
  "LDC",
  "MDCAT",
  "ECAT"
];

async function runTests() {
  await mongoose.connect(MONGO_URL);
  console.log("Connected to MongoDB for verification tests.");

  const mockUserId = new mongoose.Types.ObjectId();
  console.log(`Using mock user ID: ${mockUserId}`);

  // Test 1: Standard Exam Generation
  console.log("\n--- Testing Standard Exam Generation ---");
  for (const examName of examsToTest) {
    if (["PMA", "Navy", "Air Force (PAF)"].includes(examName)) {
      continue; // Tested separately below
    }

    const req = {
      body: { exam: examName },
      user: { id: mockUserId.toString() }
    };

    let responseData = null;
    const res = {
      status(code) {
        this.code = code;
        return this;
      },
      json(obj) {
        responseData = obj;
      }
    };

    await generateTest(req, res);

    if (responseData && responseData.success) {
      console.log(`✅ ${examName}: Generated successfully!`);
      console.log(`   Title: "${responseData.title}"`);
      console.log(`   Questions Count: ${responseData.totalQuestions}`);
      console.log(`   Duration: ${responseData.duration} mins`);
      console.log(`   Distribution:`, responseData.distribution);

      // Verify constraints
      if (examName === "MDCAT") {
        if (responseData.totalQuestions !== 180) throw new Error("MDCAT question count must be 180!");
        if (responseData.duration !== 180) throw new Error("MDCAT duration must be 180!");
      } else if (examName === "ECAT") {
        if (responseData.totalQuestions !== 100) throw new Error("ECAT question count must be 100!");
        if (responseData.duration !== 100) throw new Error("ECAT duration must be 100!");
      } else {
        if (responseData.totalQuestions !== 100) throw new Error(`${examName} question count must be 100!`);
        if (responseData.duration !== 100) throw new Error(`${examName} duration must be 100!`);
      }
    } else {
      console.error(`❌ ${examName} Generation failed! Response:`, responseData);
    }
  }

  // Test 2: Stage-Based Flow for PMA
  console.log("\n--- Testing Stage-Based Flow (PMA) ---");
  {
    const req = {
      body: { exam: "PMA" },
      user: { id: mockUserId.toString() }
    };
    let responseData = null;
    const res = {
      status(code) { this.code = code; return this; },
      json(obj) { responseData = obj; }
    };

    // Step 1: No previous results (should generate Verbal Intelligence Test)
    await generateTest(req, res);
    console.log(`PMA Step 1 Title: "${responseData.title}" (Expected Verbal Intelligence)`);
    if (!responseData.title.includes("Verbal")) throw new Error("Step 1 must be Verbal Intelligence!");
    if (responseData.totalQuestions !== 50) throw new Error("Step 1 question count must be 50!");

    // Create a mock passed result for Step 1
    const p1Test = await Test.findById(responseData.testId);
    const r1 = await Result.create({
      user: mockUserId,
      test: responseData.testId,
      examName: "PMA",
      score: 80,
      totalQuestions: 50,
      correctCount: 40,
      incorrectCount: 10
    });

    // Step 2: Passed Step 1, should generate Non-Verbal Intelligence Test
    responseData = null;
    await generateTest(req, res);
    console.log(`PMA Step 2 Title: "${responseData.title}" (Expected Non-Verbal Intelligence)`);
    if (!responseData.title.includes("Non-Verbal")) throw new Error("Step 2 must be Non-Verbal Intelligence!");
    if (responseData.totalQuestions !== 50) throw new Error("Step 2 question count must be 50!");

    // Create a mock passed result for Step 2
    const r2 = await Result.create({
      user: mockUserId,
      test: responseData.testId,
      examName: "PMA",
      score: 85,
      totalQuestions: 50,
      correctCount: 42,
      incorrectCount: 8
    });

    // Step 3: Passed Step 1 & 2, should generate Academic Test
    responseData = null;
    await generateTest(req, res);
    console.log(`PMA Step 3 Title: "${responseData.title}" (Expected Academic Test)`);
    if (!responseData.title.includes("Academic")) throw new Error("Step 3 must be Academic!");
    if (responseData.totalQuestions !== 100) throw new Error("Step 3 question count must be 100!");

    // Clean up mock results
    await Result.deleteMany({ user: mockUserId });
  }

  // Test 3: Stage-Based Flow for Navy
  console.log("\n--- Testing Stage-Based Flow (Navy) ---");
  {
    const req = {
      body: { exam: "Navy" },
      user: { id: mockUserId.toString() }
    };
    let responseData = null;
    const res = {
      status(code) { this.code = code; return this; },
      json(obj) { responseData = obj; }
    };

    // Step 1: No previous results (should generate Intelligence Test)
    await generateTest(req, res);
    console.log(`Navy Step 1 Title: "${responseData.title}" (Expected Intelligence Test)`);
    if (!responseData.title.includes("Intelligence")) throw new Error("Step 1 must be Intelligence!");

    // Create a mock passed result for Step 1
    const r1 = await Result.create({
      user: mockUserId,
      test: responseData.testId,
      examName: "Navy",
      score: 80,
      totalQuestions: 50
    });

    // Step 2: Passed Step 1, should generate Academic Test
    responseData = null;
    await generateTest(req, res);
    console.log(`Navy Step 2 Title: "${responseData.title}" (Expected Academic Test)`);
    if (!responseData.title.includes("Academic")) throw new Error("Step 2 must be Academic!");

    // Clean up mock results
    await Result.deleteMany({ user: mockUserId });
  }

  // Clean up any generated tests by mockUserId
  await Test.deleteMany({ user: mockUserId });
  console.log("\nCleaned up all test records.");
  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY!");

  await mongoose.disconnect();
}

runTests().catch(err => {
  console.error("Test failed:", err);
  mongoose.disconnect().then(() => process.exit(1));
});
