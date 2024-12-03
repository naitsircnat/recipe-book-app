// 1. SETUP EXPRESS
const express = require("express");
const cors = require("cors");

require("dotenv").config();
const MongoClient = require("mongodb").MongoClient;
const mongoUri = process.env.MONGO_URI;
const dbname = "recipe_book";

// 1a. create the app
const app = express();
app.use(express.json());

// !! Enable CORS
app.use(cors());

async function connect(uri, dbname) {
  let client = await MongoClient.connect(uri);
  let db = client.db(dbname);
  return db;
}

// async function connect(uri, dbname) {
//   let client = await MongoClient.connect(uri, {
//     useUnifiedTopology: true,
//   });
//   let _db = client.db(dbname);
//   return _db;
// }

async function main() {
  let db = await connect(mongoUri, dbname);

  // Routes

  // display recipes
  app.get("/recipes", async (req, res) => {
    try {
      const recipes = await db
        .collection("recipes")
        .find()
        .project({
          name: 1,
          cuisine: 1,
          tags: 1,
          prepTime: 1,
        })
        .toArray();

      res.json({ recipes });
    } catch (error) {
      console.error("Error fetching recipes:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // display recipe of a certain ID
  const { ObjectId } = require("mongodb");

  app.get("/recipes/:id", async (req, res) => {
    try {
      const id = req.params.id;

      // First, fetch the recipe
      const recipe = await db
        .collection("recipes")
        .findOne({ _id: new ObjectId(id) }, { projection: { _id: 0 } });

      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      res.json(recipe);
    } catch (error) {
      console.error("Error fetching recipe:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // perform search
  app.get("/recipes", async (req, res) => {
    try {
      const { tags, cuisine, ingredients, name } = req.query;
      let query = {};

      if (tags) {
        query["tags.name"] = { $in: tags.split(",") };
      }

      if (cuisine) {
        query["cuisine.name"] = { $regex: cuisine, $options: "i" };
      }

      if (ingredients) {
        query["ingredients.name"] = {
          $all: ingredients.split(",").map((i) => new RegExp(i, "i")),
        };
      }

      if (name) {
        query.name = { $regex: name, $options: "i" };
      }

      const recipes = await db
        .collection("recipes")
        .find(query)
        .project({
          name: 1,
          "cuisine.name": 1,
          "tags.name": 1,
          _id: 0,
        })
        .toArray();

      res.json({ recipes });
    } catch (error) {
      console.error("Error searching recipes:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}

main();

// 3. START SERVER (Don't put any routes after this line)
app.listen(3000, function () {
  console.log("Server has started");
});
