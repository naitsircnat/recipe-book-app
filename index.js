const bcrypt = require("bcrypt");

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

  // Add a POST /recipes route
  app.post("/recipes", async (req, res) => {
    try {
      const {
        name,
        cuisine,
        prepTime,
        cookTime,
        servings,
        ingredients,
        instructions,
        tags,
      } = req.body;

      // Basic validation
      if (!name || !cuisine || !ingredients || !instructions || !tags) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Fetch the cuisine document
      const cuisineDoc = await db
        .collection("cuisines")
        .findOne({ name: cuisine });
      if (!cuisineDoc) {
        return res.status(400).json({ error: "Invalid cuisine" });
      }

      // Fetch the tag documents
      const tagDocs = await db
        .collection("tags")
        .find({ name: { $in: tags } })
        .toArray();
      if (tagDocs.length !== tags.length) {
        return res.status(400).json({ error: "One or more invalid tags" });
      }

      // Create the new recipe object
      const newRecipe = {
        name,
        cuisine: {
          _id: cuisineDoc._id,
          name: cuisineDoc.name,
        },
        prepTime,
        cookTime,
        servings,
        ingredients,
        instructions,
        tags: tagDocs.map((tag) => ({
          _id: tag._id,
          name: tag.name,
        })),
      };

      // Insert the new recipe into the database
      const result = await db.collection("recipes").insertOne(newRecipe);

      // Send back the created recipe
      res.status(201).json({
        message: "Recipe created successfully",
        recipeId: result.insertedId,
      });
    } catch (error) {
      console.error("Error creating recipe:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Add a PUT route for recipes
  app.put("/recipes/:id", async (req, res) => {
    try {
      const recipeId = req.params.id;
      const {
        name,
        cuisine,
        prepTime,
        cookTime,
        servings,
        ingredients,
        instructions,
        tags,
      } = req.body;

      // Basic validation
      if (!name || !cuisine || !ingredients || !instructions || !tags) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Fetch the cuisine document
      const cuisineDoc = await db
        .collection("cuisines")
        .findOne({ name: cuisine });
      if (!cuisineDoc) {
        return res.status(400).json({ error: "Invalid cuisine" });
      }

      // Fetch the tag documents
      const tagDocs = await db
        .collection("tags")
        .find({ name: { $in: tags } })
        .toArray();
      if (tagDocs.length !== tags.length) {
        return res.status(400).json({ error: "One or more invalid tags" });
      }

      // Create the updated recipe object
      const updatedRecipe = {
        name,
        cuisine: {
          _id: cuisineDoc._id,
          name: cuisineDoc.name,
        },
        prepTime,
        cookTime,
        servings,
        ingredients,
        instructions,
        tags: tagDocs.map((tag) => ({
          _id: tag._id,
          name: tag.name,
        })),
      };

      // Update the recipe in the database
      const result = await db
        .collection("recipes")
        .updateOne({ _id: new ObjectId(recipeId) }, { $set: updatedRecipe });

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      // Send back the success response
      res.json({
        message: "Recipe updated successfully",
      });
    } catch (error) {
      console.error("Error updating recipe:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Add a route to delete recipes
  app.delete("/recipes/:id", async (req, res) => {
    try {
      const recipeId = req.params.id;

      // Attempt to delete the recipe
      const result = await db
        .collection("recipes")
        .deleteOne({ _id: new ObjectId(recipeId) });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      res.json({ message: "Recipe deleted successfully" });
    } catch (error) {
      console.error("Error deleting recipe:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Add a post route for reviews
  app.post("/recipes/:id/reviews", async (req, res) => {
    try {
      const recipeId = req.params.id;
      const { user, rating, comment } = req.body;

      // Basic validation
      if (!user || !rating || !comment) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Create the new review object
      const newReview = {
        review_id: new ObjectId(),
        user,
        rating: Number(rating),
        comment,
        date: new Date(),
      };

      // Add the review to the recipe
      const result = await db
        .collection("recipes")
        .updateOne(
          { _id: new ObjectId(recipeId) },
          { $push: { reviews: newReview } }
        );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      res.status(201).json({
        message: "Review added successfully",
        reviewId: newReview.review_id,
      });
    } catch (error) {
      console.error("Error adding review:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update a specific review in a recipe
  app.put("/recipes/:recipeId/reviews/:reviewId", async (req, res) => {
    try {
      const recipeId = req.params.recipeId;
      const reviewId = req.params.reviewId;
      const { user, rating, comment } = req.body;

      if (!user || !rating || !comment) {
        return res.status(400)({ error: "Missing required fields." });
      }

      const updatedReview = {
        review_id: new ObjectId(reviewId),
        user,
        rating: Number(rating),
        comment,
        date: new Date(),
      };

      const result = await db.collection("recipes").updateOne(
        {
          _id: new ObjectId(recipeId),
          "reviews.review_id": new ObjectId(reviewId),
        },
        {
          $set: { "reviews.$": updatedReview },
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: "Recipe or review not found" });
      }

      res.json({
        message: "Review updated successfully",
        reviewId: reviewId,
      });
    } catch (error) {
      console.error("Error updating review:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete a review route
  app.delete("/recipes/:recipeId/reviews/:reviewId", async (req, res) => {
    try {
      const recipeId = req.params.recipeId;
      const reviewId = req.params.reviewId;

      // Remove the specific review from the recipe document
      const result = await db.collection("recipes").updateOne(
        { _id: new ObjectId(recipeId) },
        {
          $pull: {
            reviews: { review_id: new ObjectId(reviewId) },
          },
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      if (result.modifiedCount === 0) {
        return res.status(404).json({ error: "Review not found" });
      }

      res.json({
        message: "Review deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting review:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/users", async function (req, res) {
    const result = await db.collection("users").insertOne({
      email: req.body.email,
      password: await bcrypt.hash(req.body.password, 12),
    });
    res.json({
      message: "New user account",
      result: result,
    });
  });
}

main();

// 3. START SERVER (Don't put any routes after this line)
app.listen(3000, function () {
  console.log("Server has started");
});
