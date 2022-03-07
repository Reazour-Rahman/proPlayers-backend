const express = require("express");
const { MongoClient } = require("mongodb");
require("dotenv").config();
const ObjectId = require("mongodb").ObjectId;
const mongoose = require("mongoose");
const fileUpload = require("express-fileupload");
const serviceAccount = require("./proplayers-firebase-adminsdk.json");
const authRoutes = require("./routes/auth.js");
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

var cors = require("cors");
const { json } = require("body-parser");
const { parse } = require("dotenv");

const app = express();
const port = process.env.PORT || 5000;

//middle ware
app.use(cors());
app.use(express.json());
app.use(fileUpload());
app.use(express.urlencoded());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cexwu.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// jwt token
async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const idToken = req.headers.authorization.split(" ")[1];
    console.log("Bearer", idToken);
    try {
      const decodedAdmin = await admin.auth().verifyIdToken(idToken);
      console.log("email :", decodedAdmin.email);
      req.decodedAdminEmail = decodedAdmin.email;
    } catch {}
  }
  next();
}

async function run() {
  try {
    await client.connect();


    // Please write down codes with commenting as like as top get request...
    // to start this server follow this command (you must install nodemon globally in your computer before running command)
    // npm run start-dev
    // Start coding, Happy coding Turbo fighter.....sanaul
  } finally {
  }
}
run().catch(console.dir);

app.use("/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("Pro player server is running now!");
});

app.listen(port, () => {
  console.log(`Turbo Server is running http://localhost:${port}`);
});
