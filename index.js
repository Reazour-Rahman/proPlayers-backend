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
const stripe = require("stripe")(process.env.STRIPE_SECRET);

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

    const productsCollection = database.collection("products");
    const cartCollection = database.collection("cart");
    const amazonProductsCollection = database.collection("amazonProducts");
    const viewsCollection = database.collection("views");
    const revenueCollection = database.collection("revenue");
    const costCollection = database.collection("cost");
    const bookingProductsCollection = database.collection("bookingProducts");
    const uniqueVisitorsCollection = database.collection("uniqueVisitors")

    /*::::::::::::::::::::::::::::::::::::::::: 
    access blogs collection including pagination
    :::::::::::::::::::::::::::::::::::::::::::*/
    app.get("/blogs", async (req, res) => {
      let query = {};
      const email = req.query.email;
      if (email) {
        query = { bloggerEmail: email };
      }
      let cursor = blogsCollection.find(query);
      const page = req.query?.page;
      const category = req.query.filter;
      const size = parseInt(req.query?.size);
      let count = await cursor.count();
      let blogs;
      if (page && size) {
        blogs = await cursor
          .skip(page * size)
          .limit(size)
          .toArray();
        console.log(page, size);
      } else if (category) {
        /* ::::: Filter by Category :::::: */
        const filter = category.charAt(0).toUpperCase() + category.slice(1);
        console.log(filter);

        if (filter === "All") {
          blogs = await cursor.toArray();
        } else {
          cursor = blogsCollection.find({ category: { $all: [filter] } });
          blogs = await cursor.toArray();
          count = await cursor.count();
        }
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
    app.put("/users/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const data = req.body;
      const query = { _id: ObjectId(id) };
      const option = { upsert: true };
      const updateDoc = {
        $set: {
          thumb: data.thumb,
          title: data.title,
          totalHotel: data.totalHotel,
          avgPrice: data.avgPrice,
          descAbout: data.descAbout,
          desc1: data.desc1,
          visitPlace: data.visitPlace,
          image1: data.image1,
          image2: data.image2,
          image3: data.image3,
          rating: data.rating,
          day: data.day,
          Latitude: data.Latitude,
          longitude: data.longitude,
          status: data.status,
        },
      };
      const result = await blogsCollection.updateOne(query, updateDoc, option);
      res.json(result);
    });

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

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      } else {
        isAdmin = false;
      }
      res.send({ admin: isAdmin });
    });

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

    // Make Admin

    app.put("/makeAdmin", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email, role: user.role };
      console.log("role", user);
      if (user.role == "admin") {
        const updateDoc = {
          $set: { role: "user" },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.json(result);
      } else {
        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.json(result);
      }

      // const result = await usersCollection.updateOne(filter, updateDoc);
      // res.json(result);
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

    /*::::: payment intent from stripe::::::::: */
    app.post("/create-payment-intent", async (req, res) => {
      const paymentInfo = req.body;
      // console.log(paymentInfo.amount * 100);
      const amount = paymentInfo.amount * 100;
      console.log(amount);
      if (amount > 1) {
        const paymentIntent = await stripe.paymentIntents.create({
          currency: "usd",
          amount: amount,
          payment_method_types: ["card"],
        });
        res.json({ clientSecret: paymentIntent.client_secret });
      }
    });
    /* :::::payment gateway starts ::::: */
    /*:::: post payment info :::::::: */
    /* app.put("/blogs/payment/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const payment = req.body;
      const option = { upsert: true };
      console.log(payment);
      const updatePaymet = {
        $push: {
          payment: {
            $each: [{ _id: ObjectId(), ...payment }],
            $sort: -1,
          },
        },
      };
      const result = await blogsCollection.updateOne(
        filter,
        updatePaymet,
        option
      );
      res.json(result);
    }); */

    /*:::: post payment info :::::::: */
    app.put("/blogs/payment/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const payment = req.body;
      const option = { upsert: true };
      console.log(payment);
      const updatePayment = {
        $push: {
          payment: {
            $each: [{ _id: ObjectId(), ...payment }],
            $sort: -1,
          },
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updatePayment,
        option
      );
      res.json(result);
    });
    /* :::::payment gateway end ::::: */

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
      const comment = { comment: data };
      const updateDoc = { $set: comment };
      console.log(updateDoc);
      const updatedPost = await blogsCollection.updateOne(filter, updateDoc);
      res.json(updatedPost);
    });

    //Get SIngle Blog
    app.get("/blogs/:id", async (req, res) => {
      const id = req.params;
      const query = { _id: ObjectId(id) };
      const result = await blogsCollection.findOne(query);
      res.json(result);
    });

    //sending likes array of object
    app.put("/blogs/likes/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const data = req.body;
      const likes = {
        likes: data?.likes,
        likers: data?.likers,
      };
      console.log(likes);
      const updateDoc = { $set: likes };
      // console.log(updateDoc);
      const updatedPost = await blogsCollection.updateOne(filter, updateDoc);
      res.json(updatedPost);
    });

    app.put("/blogs/views/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const data = req.body;
      console.log(data);
      const views = { views: data.views, viewers: data.viewers };
      const updateDoc = { $set: views };
      console.log(updateDoc);
      const updatedPost = await blogsCollection.updateOne(filter, updateDoc);
      res.json(updatedPost);
    });

    app.put("/users/room/:email", async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const filter = { email: email };
      const data = req.body;
      console.log(data);
      const room = { room: data };
      const updateDoc = { $set: room };
      // console.log(updateDoc);
      const createRoom = await usersCollection.updateOne(filter, updateDoc);
      res.json(createRoom);
    });

    app.get("/users/room/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });

    app.put("/users/followers/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const data = req.body;
      console.log(data);
      const followers = {
        followersCount: data.followersCount,
        followers: data.followers,
      };
      const updateDoc = { $set: followers };
      console.log(updateDoc);
      const updatedPost = await usersCollection.updateOne(filter, updateDoc);
      res.json(updatedPost);
    });

    // Please write down codes with commenting as like as top get request...
    // to start this server follow this command (you must install nodemon globally in your computer before running command)
    // npm run start-dev
    // Start coding, Happy coding Turbo fighter.....sanaul

    /* ===============Amazon Products related============== */

    /* Get All Products */
    app.get("/products", async (req, res) => {
      const cursor = productsCollection.find({});
      const page = req.query.page;
      const size = parseInt(req.query.size);
      let products;
      const count = await cursor.count();
      if (page) {
        products = await cursor
          .skip(page * size)
          .limit(size)
          .toArray();
      } else {
        products = await cursor.toArray();
      }

      res.json({ count, products });
    });

    /* Get A single Products */
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const product = await productsCollection.findOne(query);
      res.json(product);
    });

    // /* Post a Product */
    app.post("/products", async (req, res) => {
      const productTitle = req.body.productTitle;
      const productPrice = req.body.productPrice;
      const description = req.body.description;
      const image = req.files.image;
      const imageData = image.data;
      const incodedImage = imageData.toString("base64");
      const imageBuffer = Buffer.from(incodedImage, "base64");
      const product = {
        productTitle,
        productPrice,
        description,
        imageBuffer,
      };
      const result = await productsCollection.insertOne(product);
      res.json(result);
    });

    /* ::: Single User :::: */
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.json(user);
    });

    /* :::::::::::::::::::::::::::::::::::::
    Post product add to the cart
    :::::::::::::::::::::::::::::::::::::::*/
    app.post("/cart", async (req, res) => {
      const data = req.body;
      console.log(data);
      const cart = await cartCollection.insertOne(data);
      res.json(cart);
    });

    /* :::::::::::::::::::::::::::::::::::::
    Load cart collection
    :::::::::::::::::::::::::::::::::::::::*/
    app.get("/cart", async (req, res) => {
      const cart = await cartCollection.find({}).toArray();
      res.send(cart);
    });

    app.post("/views", async (req, res) => {
      const data = req.body;
      console.log(data);
      const user = await viewsCollection.insertOne(data);
      res.json(user);
    });

    app.get("/views", async (req, res) => {
      const result = await viewsCollection.find({}).toArray();
      res.json(result);
    });

    app.delete("/views/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: ObjectId(id) };
      const result = await viewsCollection.deleteOne(query);
      res.json(result);
    });

    app.put("/revenue", async (req, res) => {
      const data = req.body;
      console.log(data);
      const filter = { year: data.year };
      const option = { upsert: true };
      const updateDoc = {
        $set: data,
      };
      const revenue = await revenueCollection.updateOne(
        filter,
        updateDoc,
        option
      );
      res.json(revenue);
    });

    app.get("/revenue", async (req, res) => {
      const result = await revenueCollection.find({}).toArray();
      res.json(result);
    });

    app.put("/cost", async (req, res) => {
      const data = req.body;
      console.log(data);
      const filter = { year: data.year };
      const option = { upsert: true };
      const updateDoc = {
        $set: data,
      };
      const revenue = await costCollection.updateOne(filter, updateDoc, option);
      res.json(revenue);
    });

    app.get("/cost", async (req, res) => {
      const result = await costCollection.find({}).toArray();
      res.json(result);
    });

    /* :::::::::::::::::::::::::::::::::::::
    Post booking-product add to the cart
    :::::::::::::::::::::::::::::::::::::::*/
    app.post("/bookingProducts", async (req, res) => {
      const data = req.body;
      console.log(data);
      const bookingProduct = await bookingProductsCollection.insertOne(data);
      res.json(bookingProduct);
    });

    /* :::::::::::::::::::::::::::::::::::::
    Load bookingProducts collection
    :::::::::::::::::::::::::::::::::::::::*/
    app.get("/bookingProducts", async (req, res) => {
      const bookingProduct = await bookingProductsCollection.find({}).toArray();
      res.send(bookingProduct);
    });


    //blog delete 

    app.delete("/blogs/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: ObjectId(id) };
      console.log(query);
      const result = await blogsCollection.deleteOne(query);
      res.json(result);
    });




    /* ::::::::::::::::::::::::::::
    Unique visitors post
    ::::::::::::::::::::::::::::::::::::*/
    app.post("/uniqueVisitors", async (req, res) => {
      const data = req.body;
      
      const visitors = await uniqueVisitorsCollection.insertOne(data);
      console.log(visitors);
      res.json(visitors);
    });

    /* :::::::::::::::::::::::::::::::::::::
    Load visitors
    :::::::::::::::::::::::::::::::::::::::*/
    app.get("/uniqueVisitors", async (req, res) => {
      const visitors = await uniqueVisitorsCollection.find({}).toArray();
      res.send(visitors);
    });

    //Please dont uncomment the code below.
    /*     const updateUserQuery = {};
    const updateUserOptions = { upsert: true };
    const updateUser = {
      $set: {
        payment: [],
      },
    }; 
    const updateUserResult = await usersCollection.updateMany(
      updateUserQuery,
      updateUser,
      updateUserOptions
    ); */
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
