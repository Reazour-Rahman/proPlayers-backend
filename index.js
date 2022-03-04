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
    /* database */
    const database = client.db("proPlayer");
    const blogsCollection = database.collection("blogs");
    const usersCollection = database.collection("users");
    const userHelpCollection = database.collection("userHelp");

    /*::::::::::::::::::::::::::::::::::::::::: 
    access blogs collection including pagination
    :::::::::::::::::::::::::::::::::::::::::::*/
    app.get("/blogs", async (req, res) => {
      const cursor = blogsCollection.find({});
      const page = req.query.page;
      const size = parseInt(req.query.size);
      const count = await cursor.count();
      let blogs;
      if (page) {
        blogs = await cursor
          .skip(page * size)
          .limit(size)
          .toArray();
      } else {
        blogs = await cursor.toArray();
      }
      res.send({
        count,
        blogs,
      });
    });
    
    app.post("/blogs", async (req, res) => {
      const data = req.body;
      console.log(data);
      const user = await blogsCollection.insertOne(data);
      res.json(user);
    });

    /* :::::::::::::::::::::::::::::::::::::
    User signup data saving to db
    :::::::::::::::::::::::::::::::::::::::*/

    app.post("/users", async (req, res) => {
      const data = req.body;
      console.log(data);
      const user = await usersCollection.insertOne(data);
      res.json(user);
    });

    /* :::::::::::::::::::::::::::::::::::::
    Post User  list
    :::::::::::::::::::::::::::::::::::::::*/
    app.get("/users", async (req, res) => {
      const users = await usersCollection.find({}).toArray();
      res.send(users);
    });


    /* :::::::::::::::::::::::::::::::::::::
    put User  channel
    :::::::::::::::::::::::::::::::::::::::*/
    app.put('/users/:id', async (req, res) => {
      const id = req.params.id
      console.log(id);
      const data = req.body
      const query = {_id : ObjectId(id)}
      const option = {upsert : true}
      const updateDoc = {
          $set : {
            thumb : data.thumb, 
            title : data.title,
            totalHotel : data.totalHotel,
            avgPrice : data.avgPrice ,
            descAbout : data.descAbout,
            desc1 : data.desc1, 
            visitPlace : data.visitPlace, 
            image1 : data.image1, 
            image2 : data.image2, 
            image3 : data.image3,
            rating : data.rating,
            day : data.day,
            Latitude : data.Latitude,
            longitude : data.longitude,
            status : data.status
          }
      }
      const result = await blogsCollection.updateOne(query, updateDoc, option)
      res.json(result)
  })


    //   app.get('/users/:email', async (req, res) => {
    //     const email = req.params.email;
    //     const query = { email: email };
    //     const user = await usersCollection.findOne(query);
    //     let isAdmin = false;
    //     if (user?.role === 'admin') {
    //         isAdmin = true;
    //     }
    //     res.json({ admin: isAdmin });
    // })

      app.get('/users/:email', async (req, res) => {
        const email = req.params.email
        const query =  {email :  email}
        const user = await usersCollection.findOne(query)
        let isAdmin = false
        if (user?.role === 'admin') {
            isAdmin = true
        }
        else{
            isAdmin = false
        }
        res.send({admin : isAdmin})
    })

    // Make Admin jwt token
    app.get("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      console.log(req.headers);
      console.log(req.decodedAdminEmail);
      const requester = req.decodedAdminEmail;
      if (requester) {
        const requesterAccount = usersCollection.findOne({ email: requester });
        if (requester.role === "admin") {
          console.log("put", req.decodedAdminEmail);
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        res.status(403).json({ message: " You are not Admin" });
      }
    });



    //if your data already had saved in the database then we don't want save it again
    app.put("/users", async (req, res) => {
      const data = req.body;
      const filter = { email: data.email };
      const option = { upsert: true };
      const updateDoc = {
        $set: data,
      };
      const user = await usersCollection.updateOne(filter, updateDoc, option);
      res.json(user);
    });




    /* :::::::::::::::::::::::::::::::::::::
    Post User Help Message
    :::::::::::::::::::::::::::::::::::::::*/
    app.post("/userHelp", async (req, res) => {
      const data = req.body;
      console.log(data);
      const userHelp = await userHelpCollection.insertOne(data);
      res.json(userHelp);
    });



    /* :::::::::::::::::::::::::::::::::::::
    Load User Help Message
    :::::::::::::::::::::::::::::::::::::::*/
    app.get("/userHelp", async (req, res) => {
      const usersHelp = await userHelpCollection.find({}).toArray();
      res.send(usersHelp);
    });

    /* :::::::::::::::::::::::::::::::::::::
    post comment 
    :::::::::::::::::::::::::::::::::::::::*/

    app.put("/blogs/comment/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const data = req.body;
      const comment = { comment: data }
      const updateDoc = { $set: comment };
      console.log(updateDoc);
      const updatedPost = await blogsCollection.updateOne(filter, updateDoc);
      res.json(updatedPost);
    })

    //Get SIngle Blog
    app.get('/blogs/:id', async (req, res) => {
      const id = req.params;
      const query = { _id: ObjectId(id) }
      const result = await blogsCollection.findOne(query);
      res.json(result);
  });

  //sending likes array of object
  app.put("/blogs/likes/:id", async (req, res) => {
    const id = req.params.id;
    const filter = { _id: ObjectId(id) };
    const data = req.body;
    console.log(data);
    const likes = { likes: data.likes }
    console.log(likes);
    const updateDoc = { $set: likes };
    console.log(updateDoc);
    const updatedPost = await blogsCollection.updateOne(filter, updateDoc);
    res.json(updatedPost);
  })


    // Please write down codes with commenting as like as top get request...
    // to start this server follow this command (you must install nodemon globally in your computer before running command)
    // npm run start-dev
    // Start coding, Happy coding Turbo fighter.....sanaul
  } finally {
  }
}
run().catch(console.dir);

app.use('/auth', authRoutes);

app.get("/", (req, res) => {
  res.send("Pro player server is running now!");
});

app.listen(port, () => {
  console.log(`Turbo Server is running http://localhost:${port}`);
});
